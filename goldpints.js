// Golden Pints: a modern 5-reel, 20-line slot. Cool Pint wilds, Bonus Bell free spins (x3, retrigger), anticipation,
// big-win celebrations, auto and turbo, levels and a daily bonus wheel.
// Free play only: credits are pretend, can't be bought and can't be cashed out. World 360 x 640.
(() => {
  "use strict";
  const { $, store, REDUCED, beep, noise, cheer, fanfare, wireMute, fit, show, gate, toast, rr, particles, music } = PUB;
  const W = 360, H = 640;
  let g = null; fit($("game"), W, H, (o) => { g = o.g; });
  const FX = particles();

  // ---------- maths (simulated: ~29% of spins win, free spins about 1 in 220, ~87% return) ----------
  const STRIPS = ["T K Q J ST S BO Q BO WI T LA WI J Q ST LA A K K J A A Q T BO WI Q T K J J T T A J K", "T J J K J WI Q LA K LA WI S BO T WI ST K BO K BO A Q W T K ST J Q A J T T T Q J A A Q",
    "A K T ST A Q J J K J LA BO WI ST T WI S Q W T Q T A BO LA J T K BO Q Q K T J J K A WI", "Q K ST K Q A T LA T BO J A J K K ST A J J W J WI Q T T A K J LA Q BO WI Q T WI BO T S",
    "A A Q BO J J J K T ST LA BO K J J A WI T K T T J Q T WI K K Q Q A T Q ST S WI LA BO"].map((s) => s.split(" "));
  const LINES = [[1,1,1,1,1],[0,0,0,0,0],[2,2,2,2,2],[0,1,2,1,0],[2,1,0,1,2],[0,0,1,2,2],[2,2,1,0,0],[1,0,0,0,1],[1,2,2,2,1],[1,0,1,2,1],
    [1,2,1,0,1],[0,1,0,1,0],[2,1,2,1,2],[0,1,1,1,0],[2,1,1,1,2],[1,1,0,1,1],[1,1,2,1,1],[0,2,0,2,0],[2,0,2,0,2],[0,2,2,2,0]];
  const PAY = { T: [14, 40, 140], J: [14, 40, 140], Q: [20, 55, 175], K: [20, 70, 210], A: [28, 85, 280], BO: [55, 170, 560], WI: [70, 210, 700], ST: [85, 350, 1050], LA: [140, 560, 2100], W: [140, 560, 2100] };
  const NAMES = { LA: "Lager", ST: "Stout", WI: "Wine", BO: "Bottle", A: "A", K: "K", Q: "Q", J: "J", T: "10", W: "Cool Pint (wild)" };
  const FS_AWARD = { 3: 10, 4: 15, 5: 20 }, FS_MULT = 3;
  const BETS = [20, 40, 100, 200, 400];
  const LINE_COLS = ["#FF3D7F", "#3DE0FF", "#FFB627", "#5FE3B0", "#B98CFF", "#FF7A3D", "#7BD86A", "#FFD45C", "#3D8BFF", "#FF6AD5"];

  // ---------- layout ----------
  const X0 = 14, RW = 64, GAP = 3, RH = 76, TOPY = 104, ROWS = 3, SYM = 62;
  const reelX = (i) => X0 + i * (RW + GAP);
  const cellC = (i, row) => [reelX(i) + RW / 2, TOPY + row * RH + RH / 2];

  // ---------- state ----------
  let credits = Math.max(0, +(store.get("slotCredits") || 1000)), betI = Math.min(4, Math.max(0, +(store.get("gpBet") || 0)));
  let level = Math.max(1, +(store.get("gpLevel") || 1)), xp = Math.max(0, +(store.get("gpXP") || 0));
  let state = "menu", t = 0, shownCredits = credits, lastWin = 0, wins = [], winT = 0, autoLeft = 0, turbo = store.get("gpTurbo") === "1";
  let fsLeft = 0, fsTotal = 0, fsActive = false, fsAwarded = 0, scatterCells = [], bigQueue = null;
  const reels = STRIPS.map((strip, i) => ({ i, strip, pos: Math.floor(Math.random() * strip.length), phase: "idle", speed: 0, from: 0, to: 0, lt: 0, ldur: 0.4, tStop: 0, lastTick: 0, tease: false, jolt: 0 }));
  const bet = () => BETS[betI], lineBet = () => bet() / 20;
  const save = () => { store.set("slotCredits", String(credits)); store.set("gpBet", String(betI)); store.set("gpLevel", String(level)); store.set("gpXP", String(xp)); };
  const mod = (a, n) => ((a % n) + n) % n;
  const symAt = (r, row) => r.strip[mod(Math.round(r.pos) + row - 1, r.strip.length)];   // row 0 top, 1 middle, 2 bottom
  const grid = () => reels.map((r) => [0, 1, 2].map((row) => symAt(r, row)));
  const xpNeed = () => 300 + level * 150;

  // ---------- sound ----------
  const tick = () => beep(1500, 1100, 0.012, "square", 0.018);
  const stopThump = (i) => { beep(180 - i * 8, 70, 0.08, "sine", 0.12); noise(0.04, 0.05, 1200); };
  const scatterDing = (n) => { beep(1046 * Math.pow(1.26, n), 1046 * Math.pow(1.26, n), 0.35, "sine", 0.07); beep(2093 * Math.pow(1.26, n), 2093 * Math.pow(1.26, n), 0.25, "sine", 0.025); };
  const coins = (n, gap = 0.04) => { for (let i = 0; i < n; i++) { beep(2600 + Math.random() * 400, 2400, 0.05, "triangle", 0.04, i * gap); } };
  function winChime(x) { const notes = x >= 5 ? [72, 76, 79, 84, 88] : x >= 1 ? [72, 76, 79, 84] : [76, 79]; notes.forEach((n, i) => { const f = 440 * Math.pow(2, (n - 69) / 12); beep(f, f, 0.14, "triangle", 0.06, i * 0.07); }); }
  let teaseTone = 0;

  // ---------- symbols: drawn once at 3x, reused every frame ----------
  let SYMS = {};
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { SYMS = {}; });
  const TILE = { LA: ["#FFD27A", "#7A4A00"], ST: ["#8A6A5A", "#1A0E0A"], WI: ["#E06A8A", "#4A0A1A"], BO: ["#D08A4A", "#3A1A06"] };
  const LETTER = { A: ["#FF8A8A", "#C8102E"], K: ["#8AC0FF", "#1A4ABF"], Q: ["#E0A0FF", "#7A2AC0"], J: ["#9AF0A0", "#1A8A3A"], T: ["#FFC890", "#D96A0A"] };
  function symCanvas(id) {
    if (SYMS[id]) return SYMS[id];
    const S = 3, D = SYM * S, c = document.createElement("canvas"); c.width = c.height = D; const x = c.getContext("2d"); x.scale(S, S);
    const h = SYM / 2; x.translate(h, h); x.textAlign = "center"; x.textBaseline = "middle"; x.lineJoin = "round";
    if (TILE[id]) {
      const im = PUB.art("drinks/" + { LA: "lager", ST: "stout", WI: "wine", BO: "bottle" }[id]); if (!im) return null;
      const bg = x.createRadialGradient(0, -8, 4, 0, 0, 36); bg.addColorStop(0, TILE[id][0]); bg.addColorStop(1, TILE[id][1]); x.fillStyle = bg; rr(x, -29, -29, 58, 58, 12); x.fill();
      const rim = x.createLinearGradient(0, -29, 0, 29); rim.addColorStop(0, "#FFF3B0"); rim.addColorStop(0.5, "#C88A10"); rim.addColorStop(1, "#FFE27A"); x.strokeStyle = rim; x.lineWidth = 2.5; rr(x, -28, -28, 56, 56, 11); x.stroke();
      const k = 50 / im.naturalHeight; x.drawImage(im, -im.naturalWidth * k / 2, -25, im.naturalWidth * k, 50);
      x.fillStyle = "rgba(255,255,255,.18)"; x.beginPath(); x.ellipse(-8, -18, 18, 6, -0.3, 0, 7); x.fill();
    } else if (LETTER[id]) {
      const txt = id === "T" ? "10" : id; x.font = `${id === "T" ? 32 : 40}px Bungee, Impact, sans-serif`;
      x.lineWidth = 7; x.strokeStyle = "#140A20"; x.strokeText(txt, 0, 3);
      const gr = x.createLinearGradient(0, -18, 0, 20); gr.addColorStop(0, "#FFFFFF"); gr.addColorStop(0.35, LETTER[id][0]); gr.addColorStop(1, LETTER[id][1]); x.fillStyle = gr; x.fillText(txt, 0, 3);
      x.lineWidth = 1.2; x.strokeStyle = "rgba(255,255,255,.6)"; x.strokeText(txt, 0, 3);
    } else if (id === "W") {
      const im = PUB.art("chars/cool"); if (!im) return null;
      const bg = x.createRadialGradient(0, -4, 4, 0, 0, 36); bg.addColorStop(0, "#7A5AFF"); bg.addColorStop(1, "#1A0A4A"); x.fillStyle = bg; rr(x, -29, -29, 58, 58, 12); x.fill();
      x.strokeStyle = "#3DE0FF"; x.lineWidth = 2.5; rr(x, -28, -28, 56, 56, 11); x.stroke();
      const k = 58 / im.naturalWidth; x.drawImage(im, -29, -27, 58, im.naturalHeight * k);
      ribbon(x, "WILD", "#3DE0FF", "#032A3A");
    } else if (id === "S") {
      const bg = x.createRadialGradient(0, -4, 4, 0, 0, 36); bg.addColorStop(0, "#FF6A9A"); bg.addColorStop(1, "#4A0A2A"); x.fillStyle = bg; rr(x, -29, -29, 58, 58, 12); x.fill();
      x.strokeStyle = "#FFD45C"; x.lineWidth = 2.5; rr(x, -28, -28, 56, 56, 11); x.stroke();
      const gb = x.createRadialGradient(-6, -12, 2, 0, -4, 22); gb.addColorStop(0, "#FFF6C4"); gb.addColorStop(1, "#C07A00"); x.fillStyle = gb;
      x.beginPath(); x.moveTo(0, -22); x.quadraticCurveTo(-16, -20, -16, 0); x.lineTo(-20, 10); x.lineTo(20, 10); x.lineTo(16, 0); x.quadraticCurveTo(16, -20, 0, -22); x.fill();
      x.fillStyle = "#8A5200"; x.beginPath(); x.arc(0, 13, 4.5, 0, 7); x.fill(); x.fillRect(-2, -26, 4, 5);
      ribbon(x, "BONUS", "#FFD45C", "#3A1C00");
    }
    return (SYMS[id] = c);
  }
  function ribbon(x, txt, bg, fg) { x.fillStyle = bg; rr(x, -27, 13, 54, 15, 5); x.fill(); x.fillStyle = fg; x.font = "11px Bungee, Impact, sans-serif"; x.fillText(txt, 0, 21); }
  function drawSym(id, cx, cy, s = 1, sy = 1, a = 1) {
    const c = symCanvas(id);
    if (!c) { g.fillStyle = "#FFB627"; g.font = "13px Bungee, Impact, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(NAMES[id] || id, cx, cy); return; }
    g.globalAlpha = a; g.drawImage(c, cx - SYM * s / 2, cy - SYM * s * sy / 2, SYM * s, SYM * s * sy); g.globalAlpha = 1;
  }

  // ---------- spin ----------
  function spinPressed() {
    if (state === "menu" || state === "wheel") return;
    if (state === "spinning") { if (autoLeft) { autoLeft = 0; ui(); } return quickStop(); }
    if (state === "ready") spin();
  }
  function spin() {
    if (state !== "ready") return;
    if (!fsActive) {
      if (credits < bet()) { autoLeft = 0; if (credits < BETS[0]) { show("over"); ui(); return; } toast("Lower your bet", 900); ui(); return; }
      credits -= bet(); shownCredits = credits; gainXP(bet());
    }
    save(); PUB.ctx && PUB.ctx();
    wins = []; winT = 0; lastWin = 0; scatterCells = []; state = "spinning";
    noise(0.25, 0.04, 2000, 0, 1.5);
    const quick = turbo || REDUCED, s0 = quick ? 0.35 : 0.7, gap = quick ? 0.1 : 0.22;
    reels.forEach((r, i) => { r.phase = "spin"; r.speed = 0; r.tStop = t + s0 + i * gap; r.tease = false; });
    ui();
  }
  function quickStop() { for (const r of reels) if (r.phase === "spin") r.tStop = Math.min(r.tStop, t + 0.05 + r.i * 0.04); }
  const backOut = (k) => { const c1 = 1.5, c3 = c1 + 1; return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2); };
  function updateReels(dt) {
    let busy = false;
    for (const r of reels) {
      if (r.phase === "spin") {
        busy = true; r.speed = Math.min(r.tease ? 13 : 26, r.speed + 120 * dt); if (r.tease && r.speed > 13) r.speed -= 30 * dt;
        r.pos -= r.speed * dt;
        if (Math.floor(r.pos) !== r.lastTick) { r.lastTick = Math.floor(r.pos); if (r.tease) beep(500 + teaseTone * 4, 520 + teaseTone * 4, 0.03, "sine", 0.03), teaseTone++; else if (Math.random() < 0.3) tick(); }
        if (t >= r.tStop) {
          const target = Math.floor(Math.random() * r.strip.length), n = r.strip.length; let d = mod(r.pos - target, n); if (d < 2) d += n;
          r.phase = "land"; r.from = r.pos; r.to = r.pos - d; r.lt = 0; r.ldur = REDUCED ? 0.18 : turbo ? 0.25 : 0.32 + d * 0.01;
        }
      } else if (r.phase === "land") {
        busy = true; r.lt += dt; const k = Math.min(1, r.lt / r.ldur); r.pos = r.from + (r.to - r.from) * (REDUCED ? k : backOut(k));
        if (k >= 1) { r.pos = mod(Math.round(r.to), r.strip.length); r.phase = "idle"; r.jolt = REDUCED ? 0 : 1; stopThump(r.i); landed(r); }
      }
    }
    if (state === "spinning" && !busy) settle();
  }
  // a reel has landed: ding for bonus bells, and slow the rest down if two bells are already showing
  function landed(r) {
    const col = [0, 1, 2].map((row) => symAt(r, row));
    col.forEach((s, row) => { if (s === "S") { scatterCells.push([r.i, row]); scatterDing(scatterCells.length); FX.ring(...cellC(r.i, row), "#FFD45C", 40); } });
    if (scatterCells.length >= 2 && !REDUCED) {
      let tStart = t;
      for (const o of reels) if (o.i > r.i && o.phase === "spin") { o.tease = true; tStart = Math.max(tStart + (turbo ? 0.6 : 1.1), o.tStop); o.tStop = tStart; teaseTone = 0; }
    }
  }

  // ---------- results ----------
  function evaluate(gr) {
    const out = [];
    LINES.forEach((L, li) => {
      const syms = L.map((row, i) => gr[i][row]);
      const first = syms.find((s) => s !== "W") || "W"; if (first === "S") return;
      let n = 0; for (const s of syms) { if (s === first || s === "W") n++; else break; }
      if (n >= 3) out.push({ li, sym: first, n, pay: PAY[first][n - 3], cells: L.slice(0, n).map((row, i) => [i, row]) });
    });
    return out;
  }
  function settle() {
    const gr = grid(); wins = evaluate(gr); const scat = scatterCells.length;
    const mult = fsActive ? FS_MULT : 1;
    lastWin = Math.round(wins.reduce((s, w) => s + w.pay, 0) * lineBet() * mult);
    winT = 0;
    if (lastWin > 0) { credits += lastWin; save(); if (fsActive) fsTotal += lastWin; }
    const x = lastWin / bet();
    if (lastWin > 0) { winChime(x); FX.burst(W / 2, TOPY + RH * 1.5, "#FFD45C", Math.min(40, 8 + Math.round(x * 4)), 200, 3); if (!fsActive) submitWin(lastWin); }
    if (!fsActive && x >= 15) bigQueue = lastWin;
    state = "ready";
    // free spins: award, retrigger or finish
    if (scat >= 3) {
      const add = FS_AWARD[Math.min(5, scat)];
      if (fsActive) { fsLeft += add; toast(`+${add} FREE SPINS!`, 1300); fanfare(); }
      else { fsAwarded = add; state = "fsintro"; setTimeout(() => { showBig(() => openFs(add)); }, 900); ui(); return; }
    }
    if (fsActive) { state = "freeplay"; setTimeout(fsLeft > 0 ? nextFree : endFs, lastWin > 0 ? 1300 : 600); ui(); return; }
    showBig(afterSpin);
    ui();
  }
  function submitWin(amount) { PUB.best("gpBest", amount); PUB.submit("mega", amount); }
  function afterSpin() {
    if (state !== "ready") return;
    if (credits < BETS[0] && !fsActive) { autoLeft = 0; setTimeout(() => show("over"), 700); ui(); return; }
    if (autoLeft > 0) { autoLeft--; ui(); if (autoLeft > 0) setTimeout(() => { if (state === "ready" && autoLeft > 0 && $("bigWin").hidden) spin(); }, turbo ? 350 : 750); }
  }

  // ---------- big win celebration ----------
  function showBig(then) {
    const amount = bigQueue; bigQueue = null;
    if (!amount) return then && then();
    const x = amount / bet(), title = x >= 100 ? "EPIC WIN!" : x >= 40 ? "MEGA WIN!" : "BIG WIN!";
    const el = $("bigWin"); $("bwTitle").textContent = title; $("bwVal").textContent = "0"; el.hidden = false;
    fanfare(); cheer(x >= 40); try { PUB.confetti(x >= 40 ? 220 : 120, ["#FFD45C", "#FFB627", "#FFF6C4", "#FF3D7F", "#3DE0FF"]); } catch (e) {}
    const t0 = performance.now(), dur = REDUCED ? 300 : Math.min(4200, 1600 + x * 20); let done = false, lastCoin = 0;
    const step = (now) => { if (done) return; const k = Math.min(1, (now - t0) / dur), v = Math.round(amount * (1 - Math.pow(1 - k, 2.2))); $("bwVal").textContent = v.toLocaleString();
      if (now - lastCoin > 70) { lastCoin = now; beep(2400 + Math.random() * 600, 2200, 0.04, "triangle", 0.035); }
      if (k < 1) requestAnimationFrame(step); else setTimeout(close, autoLeft > 0 || fsActive ? 1600 : 6000); };
    const close = () => { if (done) return; done = true; $("bwVal").textContent = amount.toLocaleString(); el.hidden = true; el.onclick = null; then && then(); };
    el.onclick = () => { if ($("bwVal").textContent !== amount.toLocaleString()) { $("bwVal").textContent = amount.toLocaleString(); } close(); };
    requestAnimationFrame(step);
  }

  // ---------- free spins ----------
  function openFs(n) {
    $("fsTitle").textContent = `${n} FREE SPINS!`; $("fsText").innerHTML = `Every win pays <b style="color:#5FE3B0">×${FS_MULT}</b>, and three more Bonus Bells add extra spins.`;
    $("fsGo").textContent = "LET'S GO"; $("fsGo").onclick = () => { $("fsPanel").hidden = true; startFs(n); }; $("fsPanel").hidden = false;
    [0, 0.12, 0.24, 0.36, 0.48].forEach((d, i) => beep([1319, 1568, 1976, 2349, 2637][i], [1319, 1568, 1976, 2349, 2637][i], 0.3, "sine", 0.05, d));
    if (autoLeft > 0) setTimeout(() => { if (!$("fsPanel").hidden) $("fsGo").click(); }, 2500);
  }
  function startFs(n) { fsActive = true; fsLeft = n; fsTotal = 0; state = "freeplay"; ui(); setTimeout(nextFree, 500); }
  function nextFree() { if (!fsActive) return; fsLeft--; state = "ready"; spin(); }
  function endFs() {
    fsActive = false; state = "fsend"; const total = fsTotal; ui();
    if (total > 0) submitWin(total);
    $("fsTitle").textContent = "FREE SPINS OVER"; $("fsText").innerHTML = `You won <b style="color:#FFB627;font-size:22px">${total.toLocaleString()}</b> credits.`;
    $("fsGo").textContent = "COLLECT"; $("fsPanel").hidden = false;
    $("fsGo").onclick = () => { $("fsPanel").hidden = true; coins(16); state = "ready"; if (total >= 15 * bet()) bigQueue = total; showBig(afterSpin); ui(); };
    if (autoLeft > 0) setTimeout(() => { if (!$("fsPanel").hidden) $("fsGo").click(); }, 2500);
  }

  // ---------- levels ----------
  function gainXP(n) {
    xp += n;
    while (xp >= xpNeed()) { xp -= xpNeed(); level++; const bonus = 100 + level * 50; credits += bonus; shownCredits = credits;
      setTimeout(() => { toast(`LEVEL ${level}!<br>+${bonus} CREDITS`, 1600); [0, 0.08, 0.16, 0.24].forEach((d, i) => beep([784, 988, 1175, 1568][i], [784, 988, 1175, 1568][i], 0.12, "triangle", 0.05, d)); FX.burst(W / 2, 62, "#5FE3B0", 22, 180, 3); }, 300); }
    save();
  }

  // ---------- daily bonus wheel ----------
  const WHEEL = [[200, 20], [500, 14], [250, 18], [1000, 8], [300, 16], [2500, 3], [400, 14], [5000, 1]];
  const WCOL = ["#FF3D7F", "#3DE0FF", "#FFB627", "#5FE3B0", "#B98CFF", "#FF7A3D", "#3D8BFF", "#FFD45C"];
  const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });
  let wheelAng = 0, wheelSpin = null;
  function giftUi() { const used = store.get("gpWheel") === today(); $("gift").disabled = used; $("gift").classList.toggle("ready", !used); $("gift").title = used ? "Come back tomorrow for another spin" : "Daily bonus wheel"; }
  function openWheel() { if (state !== "ready" || store.get("gpWheel") === today()) return; state = "wheel"; $("wheelPanel").hidden = false; $("wheelGo").disabled = false; $("wheelText").textContent = "One free spin of the wheel every day."; drawWheel(); ui(); }
  function spinWheel() {
    if (wheelSpin) return; $("wheelGo").disabled = true; PUB.ctx && PUB.ctx();
    let r = Math.random() * WHEEL.reduce((s, w) => s + w[1], 0), k = 0; for (let i = 0; i < WHEEL.length; i++) { r -= WHEEL[i][1]; if (r <= 0) { k = i; break; } }
    const seg = (Math.PI * 2) / WHEEL.length, target = -(k * seg + seg / 2) + (Math.random() - 0.5) * seg * 0.6;
    const from = wheelAng, to = target - Math.PI * 2 * (REDUCED ? 1 : 6) - mod(from - target, Math.PI * 2) + 0;
    wheelSpin = { from, to: from + (to - from), t0: performance.now(), dur: REDUCED ? 600 : 4200, k, lastSeg: -1 };
    store.set("gpWheel", today()); giftUi();
    requestAnimationFrame(wheelStep);
  }
  function wheelStep(now) {
    const s = wheelSpin; if (!s) return; const k = Math.min(1, (now - s.t0) / s.dur), e = 1 - Math.pow(1 - k, 3.4);
    wheelAng = s.from + (s.to - s.from) * e; drawWheel();
    const segN = Math.floor(mod(-wheelAng, Math.PI * 2) / ((Math.PI * 2) / WHEEL.length)); if (segN !== s.lastSeg) { s.lastSeg = segN; beep(1400, 1100, 0.02, "square", 0.03); }
    if (k < 1) return requestAnimationFrame(wheelStep);
    const prize = WHEEL[s.k][0]; wheelSpin = null; credits += prize; shownCredits = credits; save(); fanfare(); coins(14);
    $("wheelText").innerHTML = `You won <b style="color:#FFB627">${prize.toLocaleString()}</b> credits! Back tomorrow for another spin.`;
    $("wheelGo").textContent = "NICE ONE"; $("wheelGo").disabled = false; $("wheelGo").onclick = () => { $("wheelPanel").hidden = true; state = "ready"; $("wheelGo").textContent = "SPIN THE WHEEL"; $("wheelGo").onclick = spinWheel; ui(); };
  }
  function drawWheel() {
    const c = $("wheelC"), x = c.getContext("2d"), R = 240, seg = (Math.PI * 2) / WHEEL.length; x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, 520, 520); x.translate(260, 268);
    x.fillStyle = "#3A2A10"; x.beginPath(); x.arc(0, 0, R + 10, 0, 7); x.fill();
    x.save(); x.rotate(wheelAng);
    WHEEL.forEach(([v], i) => { x.fillStyle = WCOL[i]; x.beginPath(); x.moveTo(0, 0); x.arc(0, 0, R, -Math.PI / 2 + i * seg, -Math.PI / 2 + (i + 1) * seg); x.closePath(); x.fill();
      x.strokeStyle = "#FFF6E0"; x.lineWidth = 3; x.stroke();
      x.save(); x.rotate(-Math.PI / 2 + (i + 0.5) * seg); x.fillStyle = "#1A0A00"; x.font = "34px Bungee, Impact, sans-serif"; x.textAlign = "right"; x.textBaseline = "middle"; x.fillText(v.toLocaleString(), R - 18, 0); x.restore(); });
    x.restore();
    for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; x.fillStyle = Math.floor(t * 6 + i) % 2 ? "#FFF3B0" : "#8A5A10"; x.beginPath(); x.arc(Math.cos(a) * (R + 5), Math.sin(a) * (R + 5), 5, 0, 7); x.fill(); }
    x.fillStyle = "#FFB627"; x.beginPath(); x.arc(0, 0, 34, 0, 7); x.fill(); x.fillStyle = "#2A1400"; x.font = "20px Bungee, Impact, sans-serif"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText("SPIN", 0, 2);
    x.fillStyle = "#FFF6E0"; x.beginPath(); x.moveTo(-18, -R - 26); x.lineTo(18, -R - 26); x.lineTo(0, -R + 10); x.closePath(); x.fill(); x.strokeStyle = "#1A0A00"; x.lineWidth = 3; x.stroke();
  }

  // ---------- buttons ----------
  $("spin").addEventListener("click", () => { if (autoLeft > 0 && state !== "spinning") { autoLeft = 0; ui(); return; } spinPressed(); });
  $("betDown").addEventListener("click", () => { if (state !== "ready" || fsActive) return; betI = Math.max(0, betI - 1); save(); beep(500, 400, 0.05, "square", 0.04); ui(); });
  $("betUp").addEventListener("click", () => { if (state !== "ready" || fsActive) return; betI = Math.min(BETS.length - 1, betI + 1); save(); beep(600, 800, 0.05, "square", 0.04); ui(); });
  $("auto").addEventListener("click", () => { if (autoLeft > 0) { autoLeft = 0; ui(); return; } if (state !== "ready" || fsActive) return; autoLeft = 25; ui(); spin(); });
  $("turbo").addEventListener("click", () => { turbo = !turbo; store.set("gpTurbo", turbo ? "1" : "0"); beep(turbo ? 900 : 500, turbo ? 1300 : 400, 0.06, "square", 0.04); ui(); });
  $("gift").addEventListener("click", openWheel); $("wheelGo").onclick = spinWheel;
  $("info").addEventListener("click", () => { if (state === "ready" || state === "menu") $("payPanel").hidden = false; });
  $("payClose").addEventListener("click", () => ($("payPanel").hidden = true));
  $("topup").addEventListener("click", () => { credits += 500; shownCredits = credits; save(); show(null); state = "ready"; coins(12); ui(); });
  $("go").addEventListener("click", () => { show(null); state = "ready"; PUB.ctx && PUB.ctx();
    music([[48, 52, 55, 59], [53, 57, 60, 64], [50, 53, 57, 60], [55, 59, 62, 65]], [76, 0, 79, 0, 81, 79, 76, 0, 77, 0, 81, 0, 84, 0, 81, 0, 74, 0, 77, 0, 81, 77, 74, 0, 79, 0, 83, 0, 86, 0, 0, 0], 116);
    if (credits < BETS[0]) show("over"); ui(); });
  addEventListener("keydown", (e) => { if (e.code === "Space" || e.code === "Enter") { if (!$("fsPanel").hidden || !$("wheelPanel").hidden || !$("payPanel").hidden) return; e.preventDefault(); if (!$("bigWin").hidden) return $("bigWin").click(); spinPressed(); } });
  $("paytable").innerHTML = `<span></span><span class="h">×3</span><span class="h">×4</span><span class="h">×5</span>` +
    ["W", "LA", "ST", "WI", "BO", "A", "K", "Q", "J", "T"].map((k) => `<span>${NAMES[k]}</span><b>${PAY[k][0]}</b><b>${PAY[k][1]}</b><b>${PAY[k][2]}</b>`).join("") +
    `<span>Bonus Bells anywhere</span><b>10</b><b>15</b><b>20</b><span></span><span class="h" style="grid-column:2/5">free spins, wins ×3</span>`;

  function ui() {
    const sp = $("spin"); sp.classList.toggle("busy", state === "spinning"); sp.classList.toggle("free", fsActive);
    sp.innerHTML = fsActive ? `<span class="ring">★</span>FREE` : autoLeft > 0 ? `<span class="ring">■</span>STOP` : `<span class="ring">↻</span>SPIN`;
    const idle = state === "ready" && !fsActive;
    $("betDown").disabled = !idle || betI === 0; $("betUp").disabled = !idle || betI === BETS.length - 1;
    $("auto").classList.toggle("on", autoLeft > 0); $("auto").innerHTML = autoLeft > 0 ? `AUTO<br>${autoLeft}` : "AUTO";
    $("turbo").classList.toggle("on", turbo);
    giftUi();
  }

  // ---------- drawing ----------
  function draw(dt) {
    const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, fsActive ? "#2A1A00" : "#140A2E"); bg.addColorStop(1, fsActive ? "#140A00" : "#0A0614"); g.fillStyle = bg; g.fillRect(0, 0, W, H);
    PUB.backdrop(g, W, H, fsActive ? 0.78 : 0.82);
    // light rays behind the logo
    g.save(); g.translate(W / 2, 34); g.rotate(t * 0.15); g.fillStyle = fsActive ? "rgba(255,212,92,.08)" : "rgba(180,120,255,.07)";
    for (let i = 0; i < 12; i++) { g.rotate(Math.PI / 6); g.beginPath(); g.moveTo(0, 0); g.lineTo(-18, -220); g.lineTo(18, -220); g.closePath(); g.fill(); } g.restore();
    // logo
    g.save(); g.textAlign = "center"; g.textBaseline = "middle"; g.font = "30px Bungee, Impact, sans-serif"; g.lineJoin = "round"; g.lineWidth = 7; g.strokeStyle = "#3A1A00"; g.strokeText("GOLDEN PINTS", W / 2, 30);
    const lg = g.createLinearGradient(0, 16, 0, 44); lg.addColorStop(0, "#FFFFFF"); lg.addColorStop(0.4, "#FFE27A"); lg.addColorStop(1, "#D97A00"); g.fillStyle = lg; g.fillText("GOLDEN PINTS", W / 2, 30);
    g.restore();
    // level bar
    const lx = 70, lw = W - 140, ly = 54; g.fillStyle = "#0A0614"; rr(g, lx, ly, lw, 14, 7); g.fill();
    const pg = g.createLinearGradient(lx, 0, lx + lw, 0); pg.addColorStop(0, "#5FE3B0"); pg.addColorStop(1, "#3DE0FF"); g.fillStyle = pg; rr(g, lx, ly, Math.max(14, lw * Math.min(1, xp / xpNeed())), 14, 7); g.fill();
    g.fillStyle = "#FFF6E0"; g.font = "9px Bungee, Impact, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(`LEVEL ${level}  ·  ${Math.floor(xp)}/${xpNeed()} XP`, W / 2, ly + 7.5);
    // info strip
    g.fillStyle = fsActive ? "#FFB627" : "rgba(255,255,255,.08)"; rr(g, 24, 76, W - 48, 20, 10); g.fill();
    g.font = "11px Bungee, Impact, sans-serif"; g.fillStyle = fsActive ? "#2A1400" : "#B9B6D9";
    g.fillText(fsActive ? `FREE SPINS · ${fsLeft} LEFT · WINS ×${FS_MULT} · WON ${fsTotal.toLocaleString()}` : autoLeft > 0 ? `AUTO SPIN · ${autoLeft} LEFT` : "3 BONUS BELLS = FREE SPINS", W / 2, 86.5);
    // reel frame
    const fr = g.createLinearGradient(0, TOPY - 8, 0, TOPY + RH * 3 + 8); fr.addColorStop(0, "#FFE27A"); fr.addColorStop(0.5, "#8A5A10"); fr.addColorStop(1, "#FFD45C");
    g.fillStyle = fr; rr(g, X0 - 6, TOPY - 6, 5 * RW + 4 * GAP + 12, RH * 3 + 12, 14); g.fill();
    for (const r of reels) drawReel(r);
    drawWins(dt);
    // win banner
    if (lastWin > 0 && state !== "spinning") {
      const pulse = 1 + Math.sin(t * 6) * 0.04; g.save(); g.translate(W / 2, 360); g.scale(pulse, pulse);
      g.font = "26px Bungee, Impact, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.lineWidth = 6; g.strokeStyle = "#2A1400"; g.strokeText(`WIN ${lastWin.toLocaleString()}`, 0, 0);
      const wg = g.createLinearGradient(0, -14, 0, 14); wg.addColorStop(0, "#FFFFFF"); wg.addColorStop(0.5, "#FFE27A"); wg.addColorStop(1, "#FFB627"); g.fillStyle = wg; g.fillText(`WIN ${lastWin.toLocaleString()}`, 0, 0); g.restore();
      const w = wins.length ? wins[Math.floor(winT / 1.2) % wins.length] : null;
      if (w && wins.length) { g.font = "11px Inter, Arial"; g.fillStyle = "#B9B6D9"; g.textAlign = "center"; g.fillText(`Line ${w.li + 1}: ${w.n} × ${NAMES[w.sym]} pays ${Math.round(w.pay * lineBet() * (fsActive ? FS_MULT : 1)).toLocaleString()}`, W / 2, 384); }
    } else if (state === "ready" && !fsActive) { g.font = "12px Inter, Arial"; g.fillStyle = "rgba(185,182,217,.8)"; g.textAlign = "center"; g.fillText("Good luck!", W / 2, 362); }
    // meters
    shownCredits += (credits - shownCredits) * Math.min(1, dt * 5); if (Math.abs(credits - shownCredits) < 0.5) shownCredits = credits;
    meter(14, 396, 126, "CREDIT", Math.round(shownCredits).toLocaleString(), "#FFE27A");
    meter(146, 396, 96, "BET", bet().toLocaleString(), "#3DE0FF");
    meter(248, 396, 98, "WIN", lastWin.toLocaleString(), lastWin > 0 ? "#5FE3B0" : "#4A6A60");
    FX.step(dt); FX.draw(g);
  }
  function meter(x, y, w, label, val, col) {
    g.fillStyle = "rgba(10,6,20,.85)"; rr(g, x, y, w, 46, 10); g.fill(); g.strokeStyle = "rgba(255,255,255,.12)"; g.lineWidth = 1.5; rr(g, x, y, w, 46, 10); g.stroke();
    g.font = "9px Bungee, Impact, sans-serif"; g.fillStyle = "#8F8CB8"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(label, x + w / 2, y + 12);
    g.font = "17px Bungee, Impact, sans-serif"; g.fillStyle = col; g.fillText(val, x + w / 2, y + 31);
  }
  function drawReel(r) {
    const x0 = reelX(r.i), bgc = g.createLinearGradient(x0, 0, x0 + RW, 0); bgc.addColorStop(0, "#140A2A"); bgc.addColorStop(0.5, "#241446"); bgc.addColorStop(1, "#140A2A");
    g.save(); g.beginPath(); g.rect(x0, TOPY, RW, RH * 3); g.clip(); g.fillStyle = bgc; g.fillRect(x0, TOPY, RW, RH * 3);
    const base = Math.floor(r.pos), frac = r.pos - base, fast = r.phase === "spin" && r.speed > 14;
    let jolt = 0; if (r.jolt) { jolt = r.jolt * 4; r.jolt = Math.max(0, r.jolt - 0.12); }
    const winning = state !== "spinning" && wins.length > 0, show = winning ? wins[Math.floor(winT / 1.2) % wins.length] : null;
    for (let k = -1; k <= 3; k++) {
      const y = TOPY + (k - frac) * RH + RH / 2 + jolt, id = r.strip[mod(base + k - 1, r.strip.length)], cx = x0 + RW / 2;
      if (fast) { drawSym(id, cx, y, 1, 1.3, 0.5); drawSym(id, cx, y - 16, 1, 1.15, 0.22); continue; }
      const row = k, inWin = winning && row >= 0 && row <= 2 && wins.some((w) => w.cells.some(([i, rw]) => i === r.i && rw === row));
      const isScat = state !== "spinning" && row >= 0 && row <= 2 && id === "S" && scatterCells.length >= 3;
      let s = 1, a = 1;
      if (winning && !inWin) a = 0.38;
      if (inWin || isScat) { const on = show && show.cells.some(([i, rw]) => i === r.i && rw === row); s = 1 + Math.sin(t * 8) * (on ? 0.07 : 0.03); }
      drawSym(id, cx, y, s, 1, a);
    }
    g.restore();
    // depth shading
    const sh = g.createLinearGradient(0, TOPY, 0, TOPY + RH * 3); sh.addColorStop(0, "rgba(0,0,0,.55)"); sh.addColorStop(0.18, "rgba(0,0,0,0)"); sh.addColorStop(0.82, "rgba(0,0,0,0)"); sh.addColorStop(1, "rgba(0,0,0,.55)");
    g.fillStyle = sh; g.fillRect(x0, TOPY, RW, RH * 3);
    if (r.tease && r.phase !== "idle") { const a = 0.5 + Math.sin(t * 14) * 0.4; g.strokeStyle = `rgba(255,212,92,${a})`; g.lineWidth = 4; rr(g, x0 + 1, TOPY + 1, RW - 2, RH * 3 - 2, 6); g.stroke(); }
  }
  function drawWins(dt) {
    if (state === "spinning" || !wins.length) return; winT += dt;
    const allPhase = winT < 1.2, list = allPhase ? wins : [wins[Math.floor(winT / 1.2) % wins.length]];
    for (const w of list) {
      const col = LINE_COLS[w.li % LINE_COLS.length]; g.strokeStyle = col; g.lineWidth = 3.5; g.lineJoin = "round"; g.shadowColor = col; g.shadowBlur = allPhase ? 0 : 10;
      g.beginPath(); LINES[w.li].forEach((row, i) => { const [x, y] = cellC(i, row); if (i === 0) g.moveTo(x - RW / 2 - 4, y); g.lineTo(x, y); if (i === 4) g.lineTo(x + RW / 2 + 4, y); }); g.stroke(); g.shadowBlur = 0;
      if (!allPhase) for (const [i, row] of w.cells) { const [x, y] = cellC(i, row); g.strokeStyle = col; g.lineWidth = 3; rr(g, x - RW / 2 + 2, y - RH / 2 + 3, RW - 4, RH - 6, 10); g.stroke(); }
    }
  }

  let last = performance.now();
  function loop(now) { const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt; updateReels(dt); if (g) draw(dt); if (!$("wheelPanel").hidden && !wheelSpin) drawWheel(); requestAnimationFrame(loop); }
  wireMute(); ui();
  gate(() => show("start"));
  requestAnimationFrame(loop);
})();
