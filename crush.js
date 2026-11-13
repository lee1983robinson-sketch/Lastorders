// Bar Crush: match-3. World 360 x 640, 8 x 8 board.
(() => {
  "use strict";
  const { $, store, REDUCED, pop, thud, cheer, fanfare, sad, burp, beep, music, wireMute, fit, show, gate, toast, share, best, rr, shade, particles } = PUB;
  const W = 360, H = 640, N = 8, S = 41, BX = (W - N * S) / 2, BY = 150;
  const TYPES = [
    { name: "Pint", c: "#FFB627" }, { name: "Shot", c: "#EE3A55" }, { name: "Wine", c: "#A45CFF" },
    { name: "Cocktail", c: "#2EC4E0" }, { name: "Kebab", c: "#F07A2A" }, { name: "Crisps", c: "#3D7BFF" },
  ];
  let g = null, view = null, SPR = [];
  fit($("game"), W, H, (o) => { view = o; g = o.g; buildSprites(); });
  const FX = particles();

  // ---------- tile art ----------
  function icon(b, t, s) {
    const k = s / 40; b.save(); b.scale(k, k); b.translate(20, 21);
    if (t === 0) { b.fillStyle = "#FFB627"; b.beginPath(); b.moveTo(-9, -8); b.lineTo(9, -8); b.lineTo(7, 12); b.lineTo(-7, 12); b.closePath(); b.fill(); b.fillStyle = "#FFD27A"; b.fillRect(-7, -5, 3, 15); b.fillStyle = "#FFF6E0"; b.beginPath(); b.arc(-5, -9, 5, 0, 7); b.arc(1, -11, 6, 0, 7); b.arc(7, -9, 4.5, 0, 7); b.fill(); }
    else if (t === 1) { b.fillStyle = "rgba(255,255,255,.55)"; b.beginPath(); b.moveTo(-8, -9); b.lineTo(8, -9); b.lineTo(6, 11); b.lineTo(-6, 11); b.closePath(); b.fill(); b.fillStyle = "#EE3A55"; b.beginPath(); b.moveTo(-7.4, -3); b.lineTo(7.4, -3); b.lineTo(6, 10); b.lineTo(-6, 10); b.closePath(); b.fill(); b.fillStyle = "#FFFFFF"; b.fillRect(-8, -10, 16, 2); }
    else if (t === 2) { b.fillStyle = "rgba(255,255,255,.5)"; b.fillRect(-1.2, 2, 2.4, 9); b.beginPath(); b.ellipse(0, 12, 7, 2, 0, 0, 7); b.fill(); b.beginPath(); b.moveTo(-9, -12); b.lineTo(9, -12); b.quadraticCurveTo(10, 3, 0, 3); b.quadraticCurveTo(-10, 3, -9, -12); b.fill(); b.fillStyle = "#8A1A5A"; b.beginPath(); b.moveTo(-9.4, -5); b.lineTo(9.4, -5); b.quadraticCurveTo(9.5, 2.5, 0, 2.5); b.quadraticCurveTo(-9.5, 2.5, -9.4, -5); b.fill(); }
    else if (t === 3) { b.fillStyle = "rgba(255,255,255,.6)"; b.fillRect(-1, -1, 2, 12); b.beginPath(); b.ellipse(0, 12, 6, 1.8, 0, 0, 7); b.fill(); b.beginPath(); b.moveTo(-12, -11); b.lineTo(12, -11); b.lineTo(0, 0); b.closePath(); b.fill(); b.fillStyle = "#2EC4E0"; b.beginPath(); b.moveTo(-9.5, -9); b.lineTo(9.5, -9); b.lineTo(0, -1.5); b.closePath(); b.fill(); b.fillStyle = "#5FBF5A"; b.beginPath(); b.arc(5, -12, 3, 0, 7); b.fill(); b.strokeStyle = "#FFF"; b.lineWidth = 1.2; b.beginPath(); b.moveTo(5, -12); b.lineTo(10, -17); b.stroke(); }
    else if (t === 4) { b.fillStyle = "#F2D29A"; b.beginPath(); b.moveTo(-11, -4); b.quadraticCurveTo(0, -18, 11, -4); b.lineTo(7, 12); b.lineTo(-7, 12); b.closePath(); b.fill(); b.fillStyle = "#8A4A26"; b.fillRect(-8, -6, 16, 7); b.fillStyle = "#5FBF5A"; b.fillRect(-7, -9, 5, 3); b.fillRect(2, -10, 6, 3); b.fillStyle = "#E4473A"; b.fillRect(-2, -9, 4, 3); }
    else if (t === 5) { b.fillStyle = "#2F6BEA"; rr(b, -9, -12, 18, 24, 4); b.fill(); b.fillStyle = "#FFD24A"; rr(b, -7, -6, 14, 6, 2); b.fill(); b.fillStyle = "#F2C14E"; b.beginPath(); b.ellipse(0, 5, 4.5, 3, 0.3, 0, 7); b.fill(); b.fillStyle = "#1E4FC0"; b.fillRect(-9, -12, 18, 2.5); b.fillRect(-9, 9.5, 18, 2.5); }
    b.restore();
  }
  function buildSprites() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5) * view.scale, px = Math.ceil(S * dpr);
    SPR = TYPES.map((T, i) => { const c = document.createElement("canvas"); c.width = c.height = px; const b = c.getContext("2d"); b.scale(px / S, px / S);
      const gr = b.createLinearGradient(0, 0, 0, S); gr.addColorStop(0, shade(T.c, 0.35)); gr.addColorStop(1, shade(T.c, -0.35)); b.fillStyle = gr; rr(b, 2, 2, S - 4, S - 4, 9); b.fill();
      b.fillStyle = "rgba(10,8,30,.55)"; rr(b, 4.5, 4.5, S - 9, S - 9, 7); b.fill();
      b.fillStyle = "rgba(255,255,255,.18)"; rr(b, 5, 5, S - 10, (S - 10) * 0.42, 6); b.fill();
      icon(b, i, S); return c; });
  }
  function drawTile(tile, x, y, sc = 1) {
    if (tile.s === "all") { g.save(); g.translate(x + S / 2, y + S / 2); g.scale(sc, sc); g.rotate(t * 1.5);
      const gr = g.createConicGradient ? g.createConicGradient(0, 0, 0) : null; if (gr) { ["#FFB627", "#EE3A55", "#A45CFF", "#2EC4E0", "#5FE3B0", "#FFB627"].forEach((c, i) => gr.addColorStop(i / 5, c)); g.fillStyle = gr; } else g.fillStyle = "#FFB627";
      g.beginPath(); g.arc(0, 0, S * 0.44, 0, 7); g.fill(); g.rotate(-t * 1.5); g.fillStyle = "#1A1030"; g.beginPath(); g.arc(0, 0, S * 0.3, 0, 7); g.fill(); g.fillStyle = "#FFF6E0"; g.font = "bold 8px Bungee, Impact, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("ROUND", 0, -3); g.fillText("ON ME", 0, 6); g.restore(); return; }
    const s = SPR[tile.t]; if (!s) return; const w = S * sc; g.drawImage(s, x + (S - w) / 2, y + (S - w) / 2, w, w);
    if (tile.s === "row" || tile.s === "col") { g.save(); g.beginPath(); rr(g, x + 5, y + 5, S - 10, S - 10, 7); g.clip(); g.strokeStyle = "rgba(255,255,255,.75)"; g.lineWidth = 3;
      for (let i = -2; i <= 2; i++) { g.beginPath(); if (tile.s === "row") { g.moveTo(x, y + S / 2 + i * 7); g.lineTo(x + S, y + S / 2 + i * 7); } else { g.moveTo(x + S / 2 + i * 7, y); g.lineTo(x + S / 2 + i * 7, y + S); } g.globalAlpha = 0.35 + 0.25 * Math.sin(t * 6 + i); g.stroke(); } g.restore(); g.globalAlpha = 1; }
  }

  // ---------- board ----------
  let grid = [], dying = [], state = "menu", busy = false, level = +(store.get("crushLevel") || 1), score = 0, moves = 0, target = 0, t = 0, idle = 0, hintCells = null, sel = null, idSeq = 1, colours = 5;
  const tile = (tt, s = null) => ({ t: tt, s, oy: 0, ox: 0, id: idSeq++ });
  const randT = () => Math.floor(Math.random() * colours);
  const at = (r, c) => (r >= 0 && r < N && c >= 0 && c < N ? grid[r][c] : null);
  function fill() { grid = []; for (let r = 0; r < N; r++) { grid.push([]); for (let c = 0; c < N; c++) { let tt; do { tt = randT(); } while ((c >= 2 && grid[r][c - 1].t === tt && grid[r][c - 2].t === tt) || (r >= 2 && grid[r - 1][c].t === tt && grid[r - 2][c].t === tt)); grid[r].push(tile(tt)); grid[r][c].oy = -(N - r) * S - 60 - c * 12; } } if (!hasMove()) fill(); }
  function runs() {
    const out = [];
    for (let r = 0; r < N; r++) { let c = 0; while (c < N) { const a = grid[r][c]; let e = c + 1; if (a && a.t >= 0) while (e < N && grid[r][e] && grid[r][e].t === a.t) e++; if (e - c >= 3) out.push({ dir: "h", cells: Array.from({ length: e - c }, (_, i) => [r, c + i]) }); c = e; } }
    for (let c = 0; c < N; c++) { let r = 0; while (r < N) { const a = grid[r][c]; let e = r + 1; if (a && a.t >= 0) while (e < N && grid[e][c] && grid[e][c].t === a.t) e++; if (e - r >= 3) out.push({ dir: "v", cells: Array.from({ length: e - r }, (_, i) => [r + i, c]) }); r = e; } }
    return out;
  }
  function swapCells(a, b) { const t1 = grid[a[0]][a[1]]; grid[a[0]][a[1]] = grid[b[0]][b[1]]; grid[b[0]][b[1]] = t1; }
  function hasMove(find) {
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) for (const [dr, dc] of [[0, 1], [1, 0]]) { const r2 = r + dr, c2 = c + dc; if (r2 >= N || c2 >= N) continue;
      if (grid[r][c].s === "all" || grid[r2][c2].s === "all") return find ? [[r, c], [r2, c2]] : true;
      swapCells([r, c], [r2, c2]); const ok = runs().length > 0; swapCells([r, c], [r2, c2]); if (ok) return find ? [[r, c], [r2, c2]] : true; }
    return find ? null : false;
  }
  const sleep = (ms) => new Promise((res) => setTimeout(res, REDUCED ? ms * 0.5 : ms));

  async function trySwap(a, b) {
    if (busy || state !== "play") return; busy = true; idle = 0; hintCells = null; sel = null;
    const A = at(...a), B = at(...b); swapCells(a, b); animSwap(a, b); beep(520, 640, 0.06, "triangle", 0.04); await sleep(160);
    if (A.s === "all" || B.s === "all") { moves--; hud(); const other = A.s === "all" ? B : A, me = A.s === "all" ? a : b, them = A.s === "all" ? b : a; const set = new Set([me.join(), them.join()]);
      if (other.s === "all") { for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) set.add(r + "," + c); toast("DRINKS ALL ROUND!", 1400); }
      else { for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (grid[r][c].t === other.t) set.add(r + "," + c); toast("ROUND ON ME!", 1200); }
      burp(); await clearSet(set, 2); await resolve(null); return endCheck(); }
    if (!runs().length) { swapCells(a, b); animSwap(a, b); beep(300, 200, 0.1, "sine", 0.04); await sleep(180); busy = false; return; }
    moves--; hud(); await resolve(b); endCheck();
  }
  function animSwap(a, b) { const A = at(...a), B = at(...b); if (A) { A.ox = (b[1] - a[1]) * S; A.oy2 = (b[0] - a[0]) * S; } if (B) { B.ox = (a[1] - b[1]) * S; B.oy2 = (a[0] - b[0]) * S; } }
  async function resolve(focus) {
    let cascade = 1;
    for (;;) {
      const rs = runs(); if (!rs.length) break;
      const set = new Set(), make = [];
      for (const run of rs) {
        for (const [r, c] of run.cells) set.add(r + "," + c);
        if (run.cells.length >= 4) { let cell = run.cells[Math.floor(run.cells.length / 2)]; if (focus && run.cells.some(([r, c]) => r === focus[0] && c === focus[1])) cell = focus; make.push({ cell, s: run.cells.length >= 5 ? "all" : run.dir === "h" ? "row" : "col", t: at(...run.cells[0]).t }); }
      }
      const total = rs.reduce((n, r) => n + r.cells.length, 0);
      if (cascade > 1) toast(["NICE ONE!", "CRACKING!", "LOVELY JUBBLY!", "ABSOLUTE SCENES!", "LEGEND!"][Math.min(4, cascade - 2)], 900);
      await clearSet(set, cascade, make);
      for (const m of make) { const [r, c] = m.cell; grid[r][c] = tile(m.s === "all" ? -1 : m.t, m.s); grid[r][c].pop = 1; beep(880, 1320, 0.15, "triangle", 0.05); }
      gravity(); await sleep(300); cascade++; focus = null;
    }
    if (!hasMove()) { toast("SHUFFLE!"); await sleep(400); shuffle(); }
    busy = false;
  }
  async function clearSet(set, mult, keep = []) {
    // set off any specials caught in the blast
    let grew = true; const done = new Set();
    while (grew) { grew = false; for (const k of [...set]) { if (done.has(k)) continue; done.add(k); const [r, c] = k.split(",").map(Number), tl = at(r, c); if (!tl) continue;
      if (tl.s === "row") { for (let i = 0; i < N; i++) set.add(r + "," + i); FX.ring(BX + c * S + S / 2, BY + r * S + S / 2, "#FFF6E0", 120); grew = true; beep(1200, 300, 0.25, "sawtooth", 0.05); }
      if (tl.s === "col") { for (let i = 0; i < N; i++) set.add(i + "," + c); FX.ring(BX + c * S + S / 2, BY + r * S + S / 2, "#FFF6E0", 120); grew = true; beep(1200, 300, 0.25, "sawtooth", 0.05); }
      if (tl.s === "all" && keep.length === 0 && mult < 50) { const tt = randT(); for (let rr2 = 0; rr2 < N; rr2++) for (let cc = 0; cc < N; cc++) if (grid[rr2][cc].t === tt) set.add(rr2 + "," + cc); grew = true; } } }
    for (const m of keep) set.delete(m.cell.join());
    let i = 0; const pts = set.size * 10 * mult; score += pts; hud();
    for (const k of set) { const [r, c] = k.split(",").map(Number), tl = at(r, c); if (!tl) continue; const x = BX + c * S, y = BY + r * S; dying.push({ tile: tl, x, y, t: 0 }); FX.burst(x + S / 2, y + S / 2, tl.t >= 0 ? TYPES[tl.t].c : "#FFB627", 8, 140, 3); grid[r][c] = null; setTimeout(() => pop(1 + Math.min(i, 12) * 0.05), Math.min(i, 12) * 18); i++; }
    if (set.size) { const ks = [...set][0].split(",").map(Number); FX.text(BX + ks[1] * S + S / 2, BY + ks[0] * S, "+" + pts, "#FFF6E0", 16); }
    await sleep(220);
  }
  function gravity() {
    for (let c = 0; c < N; c++) { let w = N - 1; for (let r = N - 1; r >= 0; r--) if (grid[r][c]) { if (w !== r) { grid[w][c] = grid[r][c]; grid[w][c].oy = (r - w) * S; grid[r][c] = null; } w--; }
      for (let r = w; r >= 0; r--) { grid[r][c] = tile(randT()); grid[r][c].oy = -(w + 1) * S - 20; } }
  }
  function shuffle() { const all = grid.flat(); do { for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [all[i], all[j]] = [all[j], all[i]]; } for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) { grid[r][c] = all[r * N + c]; grid[r][c].oy = -30; } } while (runs().length || !hasMove()); }
  function endCheck() {
    if (moves > 0) return;
    if (score >= target) { state = "over"; const s = score >= target * 1.8 ? 3 : score >= target * 1.4 ? 2 : 1; fanfare(); cheer(true); const prev = +(store.get("crushStars" + level) || 0); if (s > prev) store.set("crushStars" + level, String(s)); level++; store.set("crushLevel", String(level)); best("crushBest", level - 1);
      $("oTitle").textContent = "LEVEL " + (level - 1) + " SMASHED!"; $("oStars").hidden = false; $("oStars").innerHTML = [1, 2, 3].map((i) => `<span class="${i <= s ? "on" : ""}">★</span>`).join(""); $("oSub").textContent = s === 3 ? "Three stars! Barman of the year." : "Target beaten. Score higher for more stars."; $("again").textContent = "NEXT LEVEL"; }
    else { state = "over"; sad(); $("oTitle").textContent = "LAST ORDERS!"; $("oStars").hidden = true; $("oSub").textContent = "Out of moves. You needed " + target.toLocaleString() + "."; $("again").textContent = "TRY AGAIN"; }
    $("oScore").textContent = score.toLocaleString(); $("oTarget").textContent = target.toLocaleString(); $("shareMsg").hidden = true; setTimeout(() => show("over"), 700);
  }
  function hud() { $("lvl").textContent = level; $("moves").textContent = moves; $("score").textContent = score.toLocaleString(); }
  function start() { colours = level < 4 ? 5 : 6; target = 2000 + (level - 1) * 900; moves = 22; score = 0; dying = []; busy = false; sel = null; fill(); state = "play"; show(null); hud(); toast("TARGET " + target.toLocaleString(), 1500);
    music([[45, 48, 52], [41, 45, 48], [48, 52, 55], [43, 47, 50]], [76, 0, 76, 79, 81, 0, 79, 76, 74, 0, 72, 74, 76, 0, 0, 0, 72, 0, 72, 74, 76, 0, 74, 72, 71, 0, 69, 71, 72, 0, 0, 0], 126); }

  // ---------- input ----------
  const cv = $("game"); let downCell = null, downPt = null;
  const cellAt = (p) => { const c = Math.floor((p.x - BX) / S), r = Math.floor((p.y - BY) / S); return r >= 0 && r < N && c >= 0 && c < N ? [r, c] : null; };
  cv.addEventListener("pointerdown", (e) => { if (state !== "play" || busy) return; PUB.ctx(); const p = view.point(e), cell = cellAt(p); if (!cell) return; downCell = cell; downPt = p; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener("pointermove", (e) => { if (!downCell) return; const p = view.point(e), dx = p.x - downPt.x, dy = p.y - downPt.y; if (Math.max(Math.abs(dx), Math.abs(dy)) < 14) return;
    const to = Math.abs(dx) > Math.abs(dy) ? [downCell[0], downCell[1] + Math.sign(dx)] : [downCell[0] + Math.sign(dy), downCell[1]]; const from = downCell; downCell = null; if (at(...to)) trySwap(from, to); });
  cv.addEventListener("pointerup", () => { if (!downCell) return; const c = downCell; downCell = null; if (sel && Math.abs(sel[0] - c[0]) + Math.abs(sel[1] - c[1]) === 1) { const s = sel; sel = null; trySwap(s, c); } else sel = sel && sel[0] === c[0] && sel[1] === c[1] ? null : c; });

  // ---------- draw ----------
  function back() {
    const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, "#2A1A3A"); bg.addColorStop(1, "#140C18"); g.fillStyle = bg; g.fillRect(0, 0, W, H);
    // bar shelves with bottles
    for (const sy of [70, 118]) { g.fillStyle = "#5A3A22"; g.fillRect(0, sy, W, 5); for (let i = 0; i < 16; i++) { const x = 8 + i * 22.5, h = 22 + ((i * 7) % 12), col = ["#3DAA5A", "#A86A2A", "#2E6ABA", "#C83A4A", "#E8E8E8", "#7A3AA8"][(i + sy) % 6]; g.fillStyle = col; g.globalAlpha = 0.55; rr(g, x, sy - h, 12, h, 3); g.fill(); g.fillRect(x + 4, sy - h - 7, 4, 8); g.globalAlpha = 1; } }
    // board panel
    g.fillStyle = "rgba(0,0,0,.45)"; rr(g, BX - 8, BY - 8, N * S + 16, N * S + 16, 16); g.fill(); g.strokeStyle = "#5A3A22"; g.lineWidth = 3; g.stroke();
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if ((r + c) % 2) { g.fillStyle = "rgba(255,255,255,.035)"; g.fillRect(BX + c * S, BY + r * S, S, S); }
    // bar top
    const bar = g.createLinearGradient(0, BY + N * S + 14, 0, H); bar.addColorStop(0, "#7A4A28"); bar.addColorStop(1, "#2A160C"); g.fillStyle = bar; g.fillRect(0, BY + N * S + 14, W, H);
    // progress to target
    const py = BY + N * S + 32, pw = W - 60, k = Math.min(1, score / (target * 1.8));
    g.fillStyle = "#0A0E24cc"; rr(g, 30, py, pw, 16, 8); g.fill(); const pg = g.createLinearGradient(30, 0, 30 + pw, 0); pg.addColorStop(0, "#FFB627"); pg.addColorStop(1, "#FF3D7F"); g.fillStyle = pg; rr(g, 30, py, Math.max(16, pw * k), 16, 8); g.fill();
    for (const [f, n] of [[1, 1], [1.4, 2], [1.8, 3]]) { const x = 30 + pw * (f / 1.8); g.fillStyle = score >= target * f ? "#FFB627" : "#3A3E70"; g.font = "16px Bungee, Impact, sans-serif"; g.textAlign = "center"; g.fillText("★".repeat(1), x - 2, py + 36); }
    g.fillStyle = "#F4E2C2"; g.font = "bold 12px Inter, Arial"; g.textAlign = "center"; g.fillText("Target " + target.toLocaleString(), W / 2, py + 54);
  }
  function draw(dt) {
    back();
    if (state === "play" && !busy) { idle += dt; if (idle > 5 && !hintCells) hintCells = hasMove(true); }
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) { const tl = grid[r] && grid[r][c]; if (!tl) continue;
      if (tl.oy < 0) tl.oy = Math.min(0, tl.oy + (900 + Math.abs(tl.oy) * 6) * dt); else if (tl.oy > 0) tl.oy = Math.max(0, tl.oy - 1200 * dt);
      if (tl.ox) tl.ox = Math.abs(tl.ox) < 1 ? 0 : tl.ox * Math.pow(0.0008, dt); if (tl.oy2) tl.oy2 = Math.abs(tl.oy2) < 1 ? 0 : tl.oy2 * Math.pow(0.0008, dt);
      let x = BX + c * S - (tl.ox || 0), y = BY + r * S + tl.oy - (tl.oy2 || 0), sc = 1;
      if (tl.pop) { tl.pop = Math.max(0, tl.pop - dt * 3); sc = 1 + Math.sin(tl.pop * Math.PI) * 0.3; }
      if (hintCells && hintCells.some(([a, b]) => a === r && b === c)) sc = 1 + Math.sin(t * 8) * 0.06;
      if (y < BY - S) continue; g.save(); g.beginPath(); g.rect(BX - 4, BY - 4, N * S + 8, N * S + 8); g.clip(); drawTile(tl, x, y, sc); g.restore();
      if (sel && sel[0] === r && sel[1] === c) { g.strokeStyle = "#FFF6E0"; g.lineWidth = 2.5; rr(g, x + 2, y + 2, S - 4, S - 4, 9); g.stroke(); } }
    for (let i = dying.length - 1; i >= 0; i--) { const d = dying[i]; d.t += dt; const k = d.t / 0.2; if (k >= 1) { dying.splice(i, 1); continue; } g.globalAlpha = 1 - k; drawTile(d.tile, d.x, d.y, 1 + k * 0.6); g.globalAlpha = 1; }
    FX.step(dt); FX.draw(g);
  }
  let last = performance.now();
  function loop(now) { const dt = Math.min(0.033, (now - last) / 1000); last = now; t += dt; draw(dt); requestAnimationFrame(loop); }
  $("go").addEventListener("click", start); $("again").addEventListener("click", start);
  $("pick1").addEventListener("click", () => { level = 1; start(); });
  $("share").addEventListener("click", () => share(`I'm on level ${level} of Bar Crush 🍺🍸 Beat that.`, $("shareMsg")));
  wireMute(); fill();
  gate(() => { $("startLvl").textContent = level; $("pick1").hidden = level <= 1; show("start"); });
  requestAnimationFrame(loop);
})();
