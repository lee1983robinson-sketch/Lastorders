// Club Fruitie: an old-school British pub fruit machine. Number reels climb the trail, the trail puts you on the
// feature board (cash, cash ladder, streak, nudges, again, jackpot), plus holds, nudges, a Hi-Lo gamble and a pick-a-pint bonus.
// Free play only: credits are pretend, can't be bought and can't be cashed out. World 360 x 640.
(() => {
  "use strict";
  const { $, store, REDUCED, beep, noise, cheer, fanfare, sad, wireMute, fit, show, gate, toast, rr, particles } = PUB;
  const W = 360, H = 640;
  let g = null; fit($("game"), W, H, (o) => { g = o.g; });
  const FX = particles();

  // ---------- the maths (simulated: ~21% hit rate, feature board about every 23 spins, ~85% return with holds and nudges) ----------
  const STRIPS = [
    "CH LE OR PL CH ME LE BE OR BAR CH PL LE 7 OR ME CH BE LE PINT PL OR".split(" "),
    "LE OR CH PL ME LE BE OR BAR PL CH LE 7 OR ME BE LE PINT PL OR CH LE".split(" "),
    "OR LE PL ME CH BE LE OR BAR PL LE 7 OR LE BE LE PINT PL OR CH OR LE".split(" "),
  ];
  const NUMS = [0, 1, 0, 0, 2, 0, 0, 1, 0, 0, 0, 3, 0, 0, 1, 0, 0, 0, 2, 0, 0, 0];
  const NUMR = [NUMS, NUMS.slice(7).concat(NUMS.slice(0, 7)), NUMS.slice(13).concat(NUMS.slice(0, 13))];
  const TRAIL = 30;
  const PAY3 = { LE: 6, OR: 8, PL: 10, ME: 13, BE: 25, BAR: 50, "7": 100, PINT: 200, CH: 16 };
  const NAMES = { CH: "Cherries", LE: "Lemons", OR: "Oranges", PL: "Plums", ME: "Melons", BE: "Bells", BAR: "BARs", "7": "Sevens", PINT: "Pints" };
  const STAKES = [10, 20, 50, 100];
  function linePay(l) {
    const [a, b, c] = l;
    if (a === b && b === c) return PAY3[a];
    if (a === "CH" && b === "CH") return 3;
    if (a === "CH") return 1;
    return 0;
  }
  // feature board, clockwise from top left. [kind, value, label, weight]
  const BOARD = [["C", 3, "3×", 18], ["C", 5, "5×", 14], ["N", 6, "NUDGE ×6", 8], ["C", 8, "8×", 9], ["L", 0, "LADDER", 5], ["C", 3, "3×", 18], ["S", 5, "STREAK", 5],
    ["C", 10, "10×", 6], ["A", 0, "AGAIN", 5], ["C", 20, "20×", 3], ["L", 0, "LADDER", 5], ["C", 5, "5×", 14], ["J", 200, "JACKPOT", 1], ["C", 4, "4×", 14]];
  const LADDER = [5, 10, 20, 40, 80, 150];

  // ---------- layout ----------
  const RX = [78, 180, 282], RW = 92, RH = 56, WY = 266, WH = RH * 3, LINE_Y = WY + RH * 1.5;
  const SYM_SIZE = 58, SYM_K = 0.84;
  const BOX_W = 56, BOX_H = 30, BX = [26, 89, 152, 215, 278];
  const BOXES = [...BX.map((x) => [x, 22]), [278, 66], [278, 112], ...BX.slice().reverse().map((x) => [x, 158]), [26, 112], [26, 66]];

  // ---------- state ----------
  let credits = Math.max(0, +(store.get("slotCredits") || 1000)), stakeI = Math.min(3, Math.max(0, +(store.get("slotStake") || 0)));
  let trail = Math.min(TRAIL - 1, Math.max(0, +(store.get("slotTrail") || 0)));
  let win = 0, shownCredits = credits, state = "menu", t = 0, nudges = 0, holdsLit = false, heldSpin = false, lineFlash = 0, bigGlow = 0, msgI = 0;
  let freeSpins = 0, streakMult = 1, boardDue = false, lit = -1, chase = null, ladderI = 0, pendingLine = 0, trailFlash = 0, freeSpin = false;
  const reels = STRIPS.map((strip, i) => ({ i, strip, pos: Math.floor(Math.random() * strip.length), held: false, phase: "idle", speed: 0, from: 0, to: 0, lt: 0, ldur: 0.45, tStop: 0, lastTick: 0, jolt: 0 }));
  const save = () => { store.set("slotCredits", String(credits)); store.set("slotStake", String(stakeI)); store.set("slotTrail", String(trail)); };
  const stake = () => STAKES[stakeI];
  const mod = (a, n) => ((a % n) + n) % n;
  const idxAt = (r, k) => mod(Math.round(r.pos) + k, r.strip.length);
  const symAt = (r, k) => r.strip[idxAt(r, k)];
  const line = () => reels.map((r) => symAt(r, 0));
  const lineNums = () => reels.reduce((s, r) => s + NUMR[r.i][idxAt(r, 0)], 0);
  const window9 = () => reels.flatMap((r) => [symAt(r, -1), symAt(r, 0), symAt(r, 1)]);

  // ---------- sound: a real machine is all clicks, clunks and coins ----------
  const click = (p = 1) => beep(1700 * p, 1200 * p, 0.015, "square", 0.025);
  const clunk = () => { beep(220, 80, 0.09, "sine", 0.14); noise(0.05, 0.08, 900); };
  const coin = (d = 0) => { beep(2600, 2400, 0.05, "triangle", 0.045, d); beep(3900, 3600, 0.04, "sine", 0.02, d + 0.01); };
  const lampOn = () => beep(880, 1320, 0.08, "triangle", 0.05);
  const stepSound = (n) => beep(500 + n * 25, 520 + n * 25, 0.05, "square", 0.04);
  const motorOn = () => noise(1.6, 0.03, 380, 0, 2);

  // ---------- symbols, drawn once at 3x and reused ----------
  const SYMS = {};
  function symCanvas(id) {
    if (SYMS[id]) return SYMS[id];
    const S = 3, D = SYM_SIZE * S, c = document.createElement("canvas"); c.width = c.height = D; const x = c.getContext("2d"); x.scale(S, S); x.translate(SYM_SIZE / 2, SYM_SIZE / 2);
    const glossy = (r, c1, c2, cx = 0, cy = 0) => { const gr = x.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r); gr.addColorStop(0, c1); gr.addColorStop(1, c2); x.fillStyle = gr; };
    const shine = (cx, cy, rx, ry) => { x.fillStyle = "rgba(255,255,255,.55)"; x.beginPath(); x.ellipse(cx, cy, rx, ry, -0.5, 0, 7); x.fill(); };
    x.lineJoin = "round"; x.lineCap = "round";
    if (id === "CH") {
      x.strokeStyle = "#3A7A1A"; x.lineWidth = 3; x.beginPath(); x.moveTo(-9, 6); x.quadraticCurveTo(-4, -14, 8, -20); x.moveTo(10, 8); x.quadraticCurveTo(8, -8, 8, -20); x.stroke();
      x.fillStyle = "#4CAF2A"; x.beginPath(); x.ellipse(14, -20, 9, 4.5, -0.4, 0, 7); x.fill();
      for (const [cx, cy] of [[-10, 10], [10, 12]]) { glossy(11, "#FF6A6A", "#8A0012", cx, cy); x.beginPath(); x.arc(cx, cy, 11, 0, 7); x.fill(); x.strokeStyle = "#5A0010"; x.lineWidth = 1.2; x.stroke(); shine(cx - 4, cy - 4, 3.5, 2.2); }
    } else if (id === "LE") {
      glossy(22, "#FFF7A0", "#E0B400"); x.beginPath(); x.ellipse(0, 0, 23, 16, -0.25, 0, 7); x.fill();
      x.beginPath(); x.ellipse(-22, 5, 5, 3.5, -0.25, 0, 7); x.ellipse(22, -5, 5, 3.5, -0.25, 0, 7); x.fill(); x.strokeStyle = "#A07E00"; x.lineWidth = 1.2; x.beginPath(); x.ellipse(0, 0, 23, 16, -0.25, 0, 7); x.stroke();
      x.fillStyle = "rgba(160,120,0,.25)"; for (let i = 0; i < 18; i++) { x.beginPath(); x.arc(Math.sin(i * 7.1) * 16, Math.cos(i * 3.3) * 10, 0.9, 0, 7); x.fill(); } shine(-8, -7, 7, 3.5);
    } else if (id === "OR") {
      glossy(21, "#FFC070", "#E0660A"); x.beginPath(); x.arc(0, 2, 21, 0, 7); x.fill(); x.strokeStyle = "#A04400"; x.lineWidth = 1.2; x.stroke();
      x.fillStyle = "rgba(150,60,0,.25)"; for (let i = 0; i < 22; i++) { x.beginPath(); x.arc(Math.sin(i * 5.3) * 15, 2 + Math.cos(i * 2.7) * 15, 0.9, 0, 7); x.fill(); }
      x.fillStyle = "#3A7A1A"; x.beginPath(); x.ellipse(5, -19, 7, 3.5, -0.5, 0, 7); x.fill(); x.fillStyle = "#5A3A10"; x.fillRect(-1, -22, 2.5, 5); shine(-8, -6, 7, 4);
    } else if (id === "PL") {
      glossy(20, "#C08AE8", "#3A0A5A"); x.beginPath(); x.ellipse(0, 3, 18, 21, 0.15, 0, 7); x.fill(); x.strokeStyle = "#2A0640"; x.lineWidth = 1.2; x.stroke();
      x.strokeStyle = "rgba(40,6,64,.6)"; x.lineWidth = 1.5; x.beginPath(); x.moveTo(2, -16); x.quadraticCurveTo(-6, 4, 2, 23); x.stroke();
      x.strokeStyle = "#5A3A10"; x.lineWidth = 2.5; x.beginPath(); x.moveTo(2, -17); x.lineTo(5, -25); x.stroke(); x.fillStyle = "#3A7A1A"; x.beginPath(); x.ellipse(11, -22, 7, 3, -0.3, 0, 7); x.fill(); shine(-7, -6, 5, 3);
    } else if (id === "ME") {
      x.save(); x.beginPath(); x.ellipse(0, 2, 25, 19, 0, 0, 7); x.clip(); glossy(25, "#9AF07A", "#1A6A1A"); x.fillRect(-26, -18, 52, 42);
      x.strokeStyle = "rgba(10,60,10,.55)"; x.lineWidth = 3.5; for (let i = -3; i <= 3; i++) { x.beginPath(); x.moveTo(i * 8, -20); x.quadraticCurveTo(i * 11, 2, i * 8, 24); x.stroke(); } x.restore();
      x.strokeStyle = "#0A4A0A"; x.lineWidth = 1.2; x.beginPath(); x.ellipse(0, 2, 25, 19, 0, 0, 7); x.stroke(); shine(-9, -8, 8, 4);
    } else if (id === "BE") {
      glossy(22, "#FFF3B0", "#C07A00"); x.beginPath(); x.moveTo(0, -22); x.quadraticCurveTo(-17, -20, -17, 2); x.lineTo(-21, 14); x.lineTo(21, 14); x.lineTo(17, 2); x.quadraticCurveTo(17, -20, 0, -22); x.fill();
      x.strokeStyle = "#8A5200"; x.lineWidth = 1.4; x.stroke(); x.fillStyle = "#8A5200"; x.beginPath(); x.arc(0, 18, 5, 0, 7); x.fill(); x.fillRect(-2, -26, 4, 5); x.fillStyle = "#FFE27A"; x.fillRect(-21, 11, 42, 3); shine(-7, -9, 4, 8);
    } else if (id === "BAR") {
      const gr = x.createLinearGradient(0, -16, 0, 16); gr.addColorStop(0, "#3A3A4A"); gr.addColorStop(0.5, "#0A0A12"); gr.addColorStop(1, "#2A2A36"); x.fillStyle = gr; rr(x, -26, -14, 52, 28, 6); x.fill();
      x.strokeStyle = "#FFB627"; x.lineWidth = 2.5; rr(x, -25, -13, 50, 26, 5); x.stroke();
      x.fillStyle = "#FFF6E0"; x.font = "17px Bungee, Impact, sans-serif"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText("BAR", 0, 1.5);
    } else if (id === "7") {
      x.font = "52px Bungee, Impact, sans-serif"; x.textAlign = "center"; x.textBaseline = "middle"; x.lineWidth = 7; x.strokeStyle = "#FFB627"; x.strokeText("7", 0, 3);
      const gr = x.createLinearGradient(0, -20, 0, 24); gr.addColorStop(0, "#FF6A6A"); gr.addColorStop(1, "#9A0018"); x.fillStyle = gr; x.fillText("7", 0, 3); x.lineWidth = 1.5; x.strokeStyle = "#5A0010"; x.strokeText("7", 0, 3);
    } else if (id === "PINT") {
      const im = PUB.art("drinks/lager");
      if (!im) return null;   // the photo is still loading; try again next frame
      const k = 50 / im.naturalHeight; x.drawImage(im, -im.naturalWidth * k / 2, -25, im.naturalWidth * k, 50);
    }
    return (SYMS[id] = c);
  }
  function drawSym(id, cx, cy, sx = 1, sy = 1, a = 1) {
    const c = symCanvas(id);
    if (!c) { g.fillStyle = "#FFB627"; g.font = "14px Bungee, Impact"; g.textAlign = "center"; g.fillText(id, cx, cy); return; }
    g.globalAlpha = a; g.drawImage(c, cx - SYM_SIZE * sx / 2, cy - SYM_SIZE * sy / 2, SYM_SIZE * sx, SYM_SIZE * sy); g.globalAlpha = 1;
  }

  // ---------- spinning ----------
  function press() {
    if (state === "won") return collect();
    if (state === "board") return startChase();
    spin();
  }
  function spin() {
    if (state !== "ready" && state !== "nudge") return;
    freeSpin = freeSpins > 0;
    if (!freeSpin) {
      if (credits < stake()) { if (credits < STAKES[0]) return show("over"); toast("Lower your stake", 900); return; }
      credits -= stake(); shownCredits = credits;
    } else freeSpins--;
    save(); PUB.ctx && PUB.ctx();
    nudges = 0; win = 0; lineFlash = 0;
    heldSpin = reels.some((r) => r.held);
    state = "spinning"; holdsLit = false; motorOn(); clunk();   // held reels keep their hold for this spin
    const stagger = REDUCED ? [0.35, 0.5, 0.65] : [0.75, 1.1, 1.45];
    let k = 0;
    for (const r of reels) { if (r.held) { r.phase = "idle"; continue; } r.phase = "spin"; r.speed = 0; r.tStop = t + stagger[k++] + Math.random() * 0.08; }
    ui();
  }
  const backOut = (k) => { const c1 = 1.4, c3 = c1 + 1; return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2); };
  function updateReels(dt) {
    let busy = false;
    for (const r of reels) {
      if (r.phase === "spin") {
        busy = true; r.speed = Math.min(22, r.speed + 90 * dt); r.pos -= r.speed * dt;
        if (Math.floor(r.pos) !== r.lastTick) { r.lastTick = Math.floor(r.pos); if (Math.random() < 0.5) click(0.9 + Math.random() * 0.2); }
        if (t >= r.tStop) { // land on a random stop 2 to 3 symbols further on, with a little bounce
          const target = Math.floor(Math.random() * r.strip.length), n = r.strip.length; let d = mod(r.pos - target, n); if (d < 2) d += n;
          r.phase = "land"; r.from = r.pos; r.to = r.pos - d; r.lt = 0; r.ldur = REDUCED ? 0.25 : 0.42 + d * 0.012;
        }
      } else if (r.phase === "land") {
        busy = true; r.lt += dt; const k = Math.min(1, r.lt / r.ldur); r.pos = r.from + (r.to - r.from) * (REDUCED ? k : backOut(k));
        if (Math.floor(r.pos) !== r.lastTick) { r.lastTick = Math.floor(r.pos); click(); }
        if (k >= 1) { r.pos = mod(Math.round(r.to), r.strip.length); r.phase = "idle"; clunk(); if (!REDUCED) r.jolt = 1; }
      } else if (r.phase === "nudge") {
        busy = true; r.lt += dt; const k = Math.min(1, r.lt / 0.2); r.pos = r.from + (r.to - r.from) * backOut(k);
        if (k >= 1) { r.pos = mod(Math.round(r.to), r.strip.length); r.phase = "idle"; afterNudge(); }
      }
    }
    if (state === "spinning" && !busy) finish();
  }

  // ---------- after the reels stop ----------
  function climb(n) { // numbers on the win line move you up the trail
    if (n <= 0) return;
    const before = trail; trail = Math.min(TRAIL, trail + n); trailFlash = 1.2; save();
    for (let i = 0; i < trail - before; i++) setTimeout(() => stepSound(before + i), i * 90);
    if (trail >= TRAIL) boardDue = true;
  }
  function finish() {
    for (const r of reels) r.held = false;
    climb(lineNums());
    const pints = window9().filter((s) => s === "PINT").length;
    const pay = linePay(line()) * stake() * (freeSpin ? streakMult : 1);
    if (freeSpins === 0 && freeSpin) streakMult = 1;
    if (pints >= 3) { state = "bonus"; pendingLine = pay; setTimeout(startBonus, 600); ui(); return; }
    if (pay > 0) return awardWin(pay);
    if (boardDue) return enterBoard();
    state = "ready";
    if (freeSpins === 0) {
      if (Math.random() < 0.18) { nudges = 1 + Math.floor(Math.random() * 3); state = "nudge"; lampOn(); toast(`${nudges} NUDGE${nudges > 1 ? "S" : ""}!`, 1100); }
      else if (!heldSpin && Math.random() < 0.28) { holdsLit = true; lampOn(); toast("HOLDS ON!", 900); }
    }
    if (credits < STAKES[0] && freeSpins === 0) setTimeout(() => { if (state === "ready" && credits < STAKES[0]) show("over"); }, 900);
    ui();
  }
  function awardWin(amount) {
    win = amount; state = "won"; lineFlash = 2.4; nudges = 0; holdsLit = false;
    const mult = amount / stake();
    if (mult >= 75) { bigGlow = 2.5; fanfare(); cheer(true); FX.burst(W / 2, LINE_Y, "#FFD45C", 40, 260, 4); toast(`BIG WIN!<br>${amount.toLocaleString()}`, 1800); }
    else if (mult >= 15) { bigGlow = 1.2; cheer(false); FX.burst(W / 2, LINE_Y, "#FFB627", 24, 200, 3.5); toast(`WINNER!<br>${amount.toLocaleString()}`, 1300); }
    else { [0, 0.08, 0.16].forEach((d, i) => beep([784, 988, 1175][i], [784, 988, 1175][i], 0.12, "triangle", 0.06, d)); toast(`WIN ${amount.toLocaleString()}`, 900); }
    ui();
  }
  function collect() {
    if (state !== "won" || win <= 0) return;
    const amount = win; win = 0; credits += amount; save(); lineFlash = 0;
    PUB.best("slotBest", amount); PUB.submit("slots", amount);
    const steps = Math.min(30, Math.max(4, Math.round(Math.log2(amount + 1) * 3)));
    for (let i = 0; i < steps; i++) coin(i * 0.045);
    if (boardDue) { state = "ready"; setTimeout(enterBoard, 500); ui(); return; }
    state = "ready"; ui();
  }

  // ---------- the feature board ----------
  function enterBoard() {
    boardDue = false; trail = 0; save(); state = "board"; lit = -1; holdsLit = false; nudges = 0;
    fanfare(); toast("ON THE BOARD!", 1300); bigGlow = 0.8; ui();
  }
  function startChase() {
    if (state !== "board") return;
    // the landing box is chosen fairly by weight; the light then runs round to it
    let r = Math.random() * BOARD.reduce((s, b) => s + b[3], 0), target = 0;
    for (let i = 0; i < BOARD.length; i++) { r -= BOARD[i][3]; if (r <= 0) { target = i; break; } }
    const from = lit < 0 ? 0 : lit, laps = REDUCED ? 1 : 2 + Math.floor(Math.random() * 2);
    const total = laps * BOARD.length + mod(target - from, BOARD.length);
    chase = { k: 0, total, from, next: t, target };
    state = "chase"; ui();
  }
  function updateChase() {
    if (!chase || t < chase.next) return;
    chase.k++; lit = mod(chase.from + chase.k, BOARD.length);
    const p = chase.k / chase.total; beep(900 + p * 600, 900 + p * 600, 0.03, "square", 0.035);
    chase.next = t + 0.035 + 0.32 * Math.pow(p, 3);
    if (chase.k >= chase.total) { chase = null; setTimeout(() => landBoard(lit), 350); }
  }
  function landBoard(i) {
    const [kind, v, label] = BOARD[i];
    FX.burst(BOXES[i][0] + BOX_W / 2, BOXES[i][1] + BOX_H / 2, "#FFD45C", 18, 160, 3);
    if (kind === "C") { toast(`${label} STAKE!`, 1000); return awardWin(v * stake()); }
    if (kind === "J") { toast("JACKPOT!!!", 2200); try { PUB.confetti(200, ["#FFD45C", "#FFB627", "#FFF6C4", "#FF3D7F"]); } catch (e) {} return awardWin(v * stake()); }
    if (kind === "A") { toast("GO AGAIN!", 1000); lampOn(); state = "board"; ui(); return; }
    if (kind === "N") { state = "nudge"; nudges = v; lampOn(); toast("6 NUDGES!<br>FIND A WIN", 1400); ui(); return; }
    if (kind === "S") { freeSpins = v; streakMult = 2; state = "ready"; lampOn(); toast("STREAK!<br>5 FREE SPINS, WINS ×2", 1600); ui(); return; }
    if (kind === "L") { openLadder(); }
  }
  // cash ladder: gamble up a rung (50/50) or take it. Lose and you drop two rungs.
  function openLadder() {
    ladderI = 0; state = "ladder"; $("ladder").hidden = false; drawLadder(); lampOn(); ui();
  }
  function drawLadder() {
    $("lRungs").innerHTML = LADDER.slice().reverse().map((m, j) => { const i = LADDER.length - 1 - j; return `<span class="${i === ladderI ? "on" : i < ladderI ? "past" : ""}">${(m * stake()).toLocaleString()}</span>`; }).join("");
    $("lUp").disabled = ladderI >= LADDER.length - 1;
  }
  function ladderUp() {
    if (state !== "ladder") return; $("lUp").disabled = $("lTake").disabled = true;
    let n = 0; const flick = setInterval(() => { n++; ladderI += n % 2 ? 1 : -1; drawLadder(); beep(700 + (n % 2) * 300, 700 + (n % 2) * 300, 0.04, "square", 0.04); }, 90);
    const startI = ladderI;
    setTimeout(() => {
      clearInterval(flick); ladderI = startI;
      if (Math.random() < 0.5) { ladderI++; [0, 0.07].forEach((d, i) => beep([988, 1319][i], [988, 1319][i], 0.1, "triangle", 0.06, d)); }
      else { ladderI -= 2; sad(); }
      $("lTake").disabled = false;
      if (ladderI < 0) { toast("OFF THE LADDER!", 1100); $("ladder").hidden = true; state = "ready"; ui(); return; }
      drawLadder(); if (ladderI >= LADDER.length - 1) { toast("TOP OF THE LADDER!", 1100); setTimeout(ladderTake, 900); }
    }, REDUCED ? 300 : 900);
  }
  function ladderTake() { if (state !== "ladder") return; $("ladder").hidden = true; const amount = LADDER[ladderI] * stake(); state = "won"; win = amount; collect(); toast(`LADDER PAYS ${amount.toLocaleString()}`, 1200); }

  // ---------- holds and nudges ----------
  function holdOrNudge(i) {
    const r = reels[i];
    if (state === "nudge" && nudges > 0 && r.phase === "idle") {
      nudges--; r.phase = "nudge"; r.from = r.pos; r.to = r.pos - 1; r.lt = 0; clunk(); click(); ui(); return;
    }
    if (holdsLit && state === "ready") {
      if (!r.held && reels.filter((x) => x.held).length >= 2) { toast("You can hold two at most", 900); return; }
      r.held = !r.held; beep(r.held ? 660 : 440, r.held ? 990 : 330, 0.07, "square", 0.04); ui();
    }
  }
  function afterNudge() {
    const pay = linePay(line()) * stake();
    if (pay > 0) { nudges = 0; return awardWin(pay); }
    if (nudges <= 0) { state = "ready"; if (boardDue) return enterBoard(); }
    ui();
  }

  // ---------- gamble: higher or lower on 1-12, double or nothing ----------
  let gNum = 7, gRounds = 0;
  const TRAIL_MAX = 5;
  function openGamble() {
    if (state !== "won") return;
    state = "gamble"; gRounds = 0; gNum = 2 + Math.floor(Math.random() * 10); $("gCard").textContent = gNum; gambleText(); $("gamble").hidden = false; ui();
  }
  function gambleText() {
    $("gText").innerHTML = `Win <b style="color:#FFB627">${win.toLocaleString()}</b>. Guess right and it's <b style="color:#5FE3B0">${(win * 2).toLocaleString()}</b>.`;
    $("gTrail").innerHTML = Array.from({ length: TRAIL_MAX }, (_, i) => `<span class="${i < gRounds ? "on" : ""}">${(win / Math.pow(2, gRounds) * Math.pow(2, i + 1)).toLocaleString()}</span>`).join("");
    $("gHi").disabled = $("gLo").disabled = gRounds >= TRAIL_MAX;
  }
  function guess(up) {
    if (state !== "gamble") return; $("gHi").disabled = $("gLo").disabled = true;
    let next; do { next = 1 + Math.floor(Math.random() * 12); } while (next === gNum && Math.random() < 0.5);
    $("gCard").classList.add("flip"); beep(520, 780, 0.08, "square", 0.04);
    setTimeout(() => {
      $("gCard").textContent = next; $("gCard").classList.remove("flip");
      if (next === gNum) { toast("SAME NUMBER. GO AGAIN", 900); gNum = next; gambleText(); return; }
      const right = up ? next > gNum : next < gNum; gNum = next;
      if (right) { win *= 2; gRounds++; [0, 0.07].forEach((d, i) => beep([988, 1319][i], [988, 1319][i], 0.1, "triangle", 0.06, d)); FX.burst(W / 2, 300, "#5FE3B0", 18, 200, 3); gambleText();
        if (gRounds >= TRAIL_MAX) { toast("TOP OF THE LADDER!", 1100); setTimeout(takeGamble, 900); } }
      else { sad(); win = 0; toast("UNLUCKY!", 1000); setTimeout(() => { $("gamble").hidden = true; state = "ready"; if (boardDue) enterBoard(); ui(); }, 900); }
    }, 260);
  }
  function takeGamble() { if (state !== "gamble") return; $("gamble").hidden = true; state = "won"; collect(); }

  // ---------- Pub Crawl bonus: pick a pint ----------
  function startBonus() {
    $("bonus").hidden = false; [0, 0.1, 0.2, 0.3].forEach((d, i) => beep([1319, 1568, 1976, 2637][i], [1319, 1568, 1976, 2637][i], 0.22, "sine", 0.05, d));
    const prizes = [5, 10, 20].sort(() => Math.random() - 0.5);
    const btns = [...$("pints").querySelectorAll("button")]; btns.forEach((b) => { b.className = ""; b.innerHTML = ""; b.disabled = false; });
    btns.forEach((b, i) => { b.onclick = () => {
      btns.forEach((x) => (x.disabled = true));
      btns.forEach((x, j) => { x.innerHTML = `<span>${prizes[j]}×</span>`; x.classList.add(j === i ? "got" : "dim"); });
      const amount = prizes[i] * stake() + pendingLine; pendingLine = 0;
      fanfare(); FX.burst(W / 2, 300, "#FFD45C", 30, 240, 4);
      setTimeout(() => { $("bonus").hidden = true; awardWin(amount); }, 1500);
    }; });
  }

  // ---------- buttons ----------
  $("spin").addEventListener("click", press);
  $("holds").querySelectorAll("button").forEach((b) => b.addEventListener("click", () => holdOrNudge(+b.dataset.r)));
  $("stake").addEventListener("click", () => { if ((state !== "ready" && state !== "nudge") || freeSpins > 0) return; stakeI = (stakeI + 1) % STAKES.length; save(); beep(600 + stakeI * 120, 900 + stakeI * 120, 0.06, "square", 0.04); ui(); });
  $("pays").addEventListener("click", () => { if (state === "won") return openGamble(); if (state === "ready" || state === "nudge" || state === "board") { $("payPanel").hidden = false; } });
  $("payClose").addEventListener("click", () => ($("payPanel").hidden = true));
  $("gHi").addEventListener("click", () => guess(true)); $("gLo").addEventListener("click", () => guess(false)); $("gTake").addEventListener("click", takeGamble);
  $("lUp").addEventListener("click", ladderUp); $("lTake").addEventListener("click", ladderTake);
  $("topup").addEventListener("click", () => { credits += 500; shownCredits = credits; save(); show(null); state = "ready"; for (let i = 0; i < 12; i++) coin(i * 0.05); ui(); });
  $("go").addEventListener("click", () => { show(null); state = "ready"; PUB.ctx && PUB.ctx(); if (credits < STAKES[0]) show("over"); ui(); });
  addEventListener("keydown", (e) => {
    if (e.code === "Space" || e.code === "Enter") { if (state === "gamble" || state === "ladder" || !$("bonus").hidden) return; e.preventDefault(); press(); }
    if (e.code === "Digit1" || e.code === "Digit2" || e.code === "Digit3") holdOrNudge(+e.code.slice(-1) - 1);
    if (e.code === "KeyG") openGamble();
  });
  $("paytable").innerHTML = ["PINT", "7", "BAR", "BE", "CH", "ME", "PL", "OR", "LE"].map((k) => `<span>3 × ${NAMES[k]}</span><b>${PAY3[k]}×</b>`).join("") +
    `<span>2 Cherries (reels 1 and 2)</span><b>3×</b><span>1 Cherry (reel 1)</span><b>1×</b><span>3 Pints anywhere</span><b>BONUS</b><span>Numbers on the win line</span><b>TRAIL</b>`;

  function ui() {
    const hb = $("holds").querySelectorAll("button");
    hb.forEach((b, i) => {
      const r = reels[i]; b.classList.remove("lit", "on", "nudge");
      if (state === "nudge" && nudges > 0) { b.textContent = "NUDGE ▼"; b.classList.add("nudge"); b.disabled = false; }
      else if (holdsLit && state === "ready") { b.textContent = r.held ? "HELD" : "HOLD"; b.classList.add(r.held ? "on" : "lit"); b.disabled = false; }
      else { b.textContent = "HOLD"; b.disabled = true; }
    });
    const sp = $("spin"); sp.classList.toggle("collect", state === "won"); sp.classList.toggle("board", state === "board");
    sp.textContent = state === "won" ? "COLLECT" : state === "board" ? "START" : freeSpins > 0 ? `FREE ×${freeSpins}` : "SPIN";
    sp.disabled = !(state === "ready" || state === "nudge" || state === "won" || state === "board");
    $("stakeVal").textContent = stake(); $("stake").disabled = !(state === "ready" || state === "nudge") || freeSpins > 0;
    const pb = $("pays"); pb.classList.toggle("gamble", state === "won"); pb.innerHTML = state === "won" ? "GAMBLE<br>IT?" : "PAYS<br>&amp; RULES";
    pb.disabled = !(state === "ready" || state === "nudge" || state === "won" || state === "board");
  }

  // ---------- drawing the cabinet ----------
  const MSGS = ["FEED ME", "NUMBERS ON THE WIN LINE CLIMB THE TRAIL", "FILL THE TRAIL TO GET ON THE BOARD", "LADDER, STREAK, NUDGES OR THE JACKPOT", "HOLDS AND NUDGES LIGHT UP AT RANDOM", "3 PINTS ANYWHERE = PUB CRAWL BONUS", "FREE PLAY ONLY - CREDITS AREN'T MONEY"];
  function ledText(txt, x, y, col, size = 13, align = "left") { g.font = `${size}px Bungee, Impact, sans-serif`; g.textAlign = align; g.textBaseline = "middle"; g.fillStyle = col; g.fillText(txt, x, y); }
  function drawBoard() {
    const top = g.createLinearGradient(0, 16, 0, 196); top.addColorStop(0, "#1A0A3A"); top.addColorStop(1, "#2A0A2A"); g.fillStyle = top; rr(g, 20, 16, W - 40, 180, 14); g.fill();
    const onBoard = state === "board" || state === "chase";
    BOARD.forEach(([kind, , label], i) => {
      const [x, y] = BOXES[i];
      const isLit = i === lit && (onBoard || state === "won" || state === "ladder" || state === "nudge");
      const twinkle = !onBoard && Math.sin(t * 2.2 + i * 1.7) > 0.93;
      const base = kind === "J" ? ["#FFD45C", "#5A3A00"] : kind === "C" ? ["#FFB627", "#3A2410"] : kind === "A" ? ["#5FE3B0", "#0A3A2A"] : ["#3DE0FF", "#0A2A3A"];
      const bright = isLit || twinkle || (onBoard && Math.sin(t * 6 + i) > 0.6 && state === "board");
      g.fillStyle = bright ? base[0] : base[1]; rr(g, x, y, BOX_W, BOX_H, 7); g.fill();
      if (isLit) { g.fillStyle = "rgba(255,255,255,.35)"; rr(g, x - 3, y - 3, BOX_W + 6, BOX_H + 6, 9); g.fill(); g.fillStyle = base[0]; rr(g, x, y, BOX_W, BOX_H, 7); g.fill(); }
      g.strokeStyle = bright ? "#FFF6E0" : "rgba(255,255,255,.18)"; g.lineWidth = 1.5; rr(g, x, y, BOX_W, BOX_H, 7); g.stroke();
      const fs = label.length > 6 ? 9 : label.length > 4 ? 10.5 : 14;
      ledText(label, x + BOX_W / 2, y + BOX_H / 2 + 1, bright ? "#1A0A00" : base[0] + "AA", fs, "center");
    });
    // centre: the name and the number trail
    g.save(); g.textAlign = "center"; g.textBaseline = "middle";
    g.font = "10px Bungee, Impact, sans-serif"; g.fillStyle = `rgba(61,224,255,${0.7 + Math.sin(t * 3) * 0.3})`; g.fillText(onBoard ? "ON THE BOARD!" : "CLUB FRUITIE", W / 2, 66);
    g.font = "21px Bungee, Impact, sans-serif"; g.lineWidth = 5; g.strokeStyle = "#5A1A00"; g.strokeText("LAST ORDERS", W / 2, 86);
    const tg = g.createLinearGradient(0, 76, 0, 96); tg.addColorStop(0, "#FFF6C4"); tg.addColorStop(0.5, "#FFC53D"); tg.addColorStop(1, "#E07A00"); g.fillStyle = tg; g.fillText("LAST ORDERS", W / 2, 86); g.restore();
    const cols = 10, lw = 15, gap = 2, x0 = W / 2 - (cols * (lw + gap) - gap) / 2;
    for (let i = 0; i < TRAIL; i++) {
      const cx = x0 + (i % cols) * (lw + gap), cy = 104 + Math.floor(i / cols) * 16, on = i < trail, fresh = on && trailFlash > 0 && i >= trail - 4;
      g.fillStyle = on ? (fresh && Math.sin(t * 20) > 0 ? "#FFFFFF" : i === TRAIL - 1 ? "#FF3D7F" : "#FFB627") : "#2A1A30"; rr(g, cx, cy, lw, 13, 3); g.fill();
      ledText(i === TRAIL - 1 ? "F" : String(i + 1), cx + lw / 2, cy + 7, on ? "#2A1400" : "#5A4A5A", 7.5, "center");
    }
  }
  function draw(dt) {
    g.fillStyle = "#0A0814"; g.fillRect(0, 0, W, H); PUB.backdrop(g, W, H, 0.7);
    const body = g.createLinearGradient(0, 0, W, 0); body.addColorStop(0, "#3A0612"); body.addColorStop(0.5, "#7A0E24"); body.addColorStop(1, "#3A0612");
    g.fillStyle = "rgba(0,0,0,.5)"; rr(g, 14, 12, W - 20, 584, 22); g.fill();
    g.fillStyle = body; rr(g, 10, 8, W - 20, 584, 22); g.fill();
    const chrome = g.createLinearGradient(0, 8, 0, 592); chrome.addColorStop(0, "#F4F4FF"); chrome.addColorStop(0.3, "#8A8AA0"); chrome.addColorStop(0.6, "#E0E0F0"); chrome.addColorStop(1, "#5A5A70");
    g.strokeStyle = chrome; g.lineWidth = 4; rr(g, 10, 8, W - 20, 584, 22); g.stroke();
    drawBoard(); if (trailFlash > 0) trailFlash -= dt;
    // feature lamps
    const lamps = [["HOLD", holdsLit && state === "ready"], ["NUDGE", state === "nudge"], [freeSpins > 0 ? `STREAK ${freeSpins}` : "STREAK", freeSpins > 0], ["GAMBLE", state === "won" || state === "gamble" || state === "ladder"]];
    lamps.forEach(([txt, on], i) => { const x = 24 + i * 79, flick = on && Math.sin(t * 12) > -0.3; g.fillStyle = flick ? "#FFB627" : "#2A1A20"; rr(g, x, 204, 75, 22, 8); g.fill();
      ledText(txt, x + 37.5, 215.5, flick ? "#2A1400" : "#6A4A40", 10.5, "center"); });
    // scrolling LED message
    g.fillStyle = "#0A0204"; rr(g, 24, 232, W - 48, 24, 6); g.fill();
    g.save(); rr(g, 26, 234, W - 52, 20, 5); g.clip();
    const fixed = state === "won" ? `WIN ${win.toLocaleString()}   COLLECT OR GAMBLE IT   ` : state === "nudge" ? `${nudges} NUDGE${nudges === 1 ? "" : "S"} LEFT - PICK A REEL   ` : state === "board" ? "ON THE BOARD - PRESS START   " : freeSpins > 0 ? `STREAK - ${freeSpins} FREE SPINS - WINS PAY DOUBLE   ` : null;
    const msg = fixed || MSGS[msgI % MSGS.length] + "      ";
    g.font = "13px Bungee, Impact, sans-serif"; const mw = g.measureText(msg).width; const off = (t * 55) % (mw + W);
    if (!fixed && off > mw + W - 2) msgI++;
    g.fillStyle = "#FF5A3A"; g.textBaseline = "middle"; g.textAlign = "left"; g.fillText(msg, W - 24 - off, 244.5); if (fixed) g.fillText(msg, W - 24 - off + mw, 244.5); g.restore();
    // reel window
    g.fillStyle = "#000"; rr(g, 24, WY - 6, W - 48, WH + 12, 10); g.fill();
    for (let i = 0; i < 3; i++) drawReel(reels[i], RX[i]);
    const sh = g.createLinearGradient(0, WY, 0, WY + WH); sh.addColorStop(0, "rgba(0,0,0,.75)"); sh.addColorStop(0.22, "rgba(0,0,0,0)"); sh.addColorStop(0.78, "rgba(0,0,0,0)"); sh.addColorStop(1, "rgba(0,0,0,.75)");
    g.fillStyle = sh; g.fillRect(28, WY, W - 56, WH);
    g.fillStyle = "rgba(255,255,255,.06)"; g.beginPath(); g.moveTo(40, WY); g.lineTo(130, WY); g.lineTo(70, WY + WH); g.lineTo(28, WY + WH); g.closePath(); g.fill();
    const lf = lineFlash > 0 ? (Math.sin(t * 18) > 0 ? 1 : 0.35) : 0.55;
    g.strokeStyle = `rgba(255,61,127,${lf})`; g.lineWidth = lineFlash > 0 ? 3 : 2; g.beginPath(); g.moveTo(26, LINE_Y); g.lineTo(W - 26, LINE_Y); g.stroke();
    g.fillStyle = "#FF3D7F"; for (const [x, d] of [[22, 1], [W - 22, -1]]) { g.beginPath(); g.moveTo(x, LINE_Y - 9); g.lineTo(x + d * 11, LINE_Y); g.lineTo(x, LINE_Y + 9); g.closePath(); g.fill(); }
    if (lineFlash > 0) { lineFlash = Math.max(0.6, lineFlash - dt); for (let i = 0; i < 3; i++) { g.strokeStyle = `rgba(255,214,92,${0.5 + Math.sin(t * 10) * 0.4})`; g.lineWidth = 3; rr(g, RX[i] - RW / 2 + 3, LINE_Y - RH / 2 + 2, RW - 6, RH - 4, 8); g.stroke(); } }
    g.strokeStyle = chrome; g.lineWidth = 3; rr(g, 24, WY - 6, W - 48, WH + 12, 10); g.stroke();
    // meters
    shownCredits += (credits - shownCredits) * Math.min(1, dt * 6); if (Math.abs(credits - shownCredits) < 0.5) shownCredits = credits;
    meter(24, 446, 176, "CREDIT", Math.round(shownCredits).toLocaleString(), "#FF5A3A");
    meter(208, 446, 128, "WIN", win > 0 ? win.toLocaleString() : "0", win > 0 && Math.sin(t * 10) > -0.5 ? "#5FE3B0" : "#3A6A5A");
    // button deck
    const deck = g.createLinearGradient(0, 494, 0, 588); deck.addColorStop(0, "#2A0A12"); deck.addColorStop(1, "#14040A"); g.fillStyle = deck; rr(g, 20, 494, W - 40, 92, 14); g.fill();
    if (bigGlow > 0) { bigGlow = Math.max(0, bigGlow - dt); const e = g.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.7); e.addColorStop(0, "rgba(255,212,92,0)"); e.addColorStop(1, `rgba(255,212,92,${Math.min(0.5, bigGlow * 0.3)})`); g.fillStyle = e; g.fillRect(0, 0, W, H); }
    FX.step(dt); FX.draw(g);
  }
  function meter(x, y, w, label, val, col) {
    g.fillStyle = "#0A0204"; rr(g, x, y, w, 42, 8); g.fill(); g.strokeStyle = "#3A2A30"; g.lineWidth = 2; rr(g, x, y, w, 42, 8); g.stroke();
    ledText(label, x + 10, y + 11, "#8A6A60", 9); ledText(val, x + w - 10, y + 27, col, 19, "right");
  }
  function drawReel(r, cx) {
    const x0 = cx - RW / 2;
    const paper = g.createLinearGradient(x0, 0, x0 + RW, 0); paper.addColorStop(0, "#CFC6B2"); paper.addColorStop(0.5, "#FFFBF0"); paper.addColorStop(1, "#CFC6B2");
    g.save(); g.beginPath(); g.rect(x0, WY, RW, WH); g.clip(); g.fillStyle = paper; g.fillRect(x0, WY, RW, WH);
    const base = Math.floor(r.pos), frac = r.pos - base, fast = r.phase === "spin" && r.speed > 12;
    let jolt = 0; if (r.jolt) { jolt = r.jolt * 3; r.jolt = Math.max(0, r.jolt - 0.15); }
    const R = RH * 1.55;
    for (let k = -3; k <= 3; k++) {
      const dy = (k - frac) * RH, ang = dy / R; if (Math.abs(ang) > 1.45) continue;
      const y = LINE_Y + Math.sin(ang) * R + jolt, sy = Math.max(0.05, Math.cos(ang));
      const idx = mod(base + k, r.strip.length), id = r.strip[idx];
      if (fast) { drawSym(id, cx - 8, y, SYM_K, sy * SYM_K * 1.35, 0.55); drawSym(id, cx - 8, y - 12, SYM_K, sy * SYM_K * 1.2, 0.25); }
      else drawSym(id, cx - 8, y, SYM_K, sy * SYM_K);
      // the number for the trail, if this symbol carries one
      const num = NUMR[r.i][idx];
      if (num && !fast) { const onLine = Math.abs(dy) < RH * 0.4 && r.phase === "idle"; g.fillStyle = onLine && Math.sin(t * 10) > -0.4 ? "#FF3D7F" : "#1A0A3A"; g.beginPath(); g.arc(cx + RW / 2 - 15, y, 10 * sy, 0, 7); g.fill();
        g.fillStyle = "#FFF6E0"; g.font = `${Math.max(1, 12 * sy)}px Bungee, Impact, sans-serif`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(num, cx + RW / 2 - 15, y + 1); }
      g.strokeStyle = "rgba(0,0,0,.06)"; g.lineWidth = 1; g.beginPath(); g.moveTo(x0, y + RH * sy / 2); g.lineTo(x0 + RW, y + RH * sy / 2); g.stroke();
    }
    g.restore();
    if (r.held) { g.fillStyle = "rgba(255,61,127,.18)"; g.fillRect(x0, WY, RW, WH); ledText("HELD", cx, WY + 10, "#FF3D7F", 10, "center"); }
    g.fillStyle = "#3A3A4A"; g.fillRect(x0 + RW, WY, 2, WH);
  }

  let last = performance.now();
  function loop(now) { const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt; updateReels(dt); if (state === "chase") updateChase(); if (g) draw(dt); requestAnimationFrame(loop); }
  wireMute(); ui();
  gate(() => show("start"));
  requestAnimationFrame(loop);
})();
