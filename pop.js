// Pub Pop: bubble shooter. World is 360 x 640.
(() => {
  "use strict";
  const { $, store, REDUCED, pop, thud, cheer, fanfare, sad, burp, beep, music, wireMute, fit, show, gate, toast, share, best, rr, particles } = PUB;
  const W = 360, H = 640, R = 18.5, D = R * 2, ROWH = R * Math.sqrt(3), COLS = 9, LEFT = (W - (COLS * D + R)) / 2, TOP = 76, LOSE_Y = 548, SX = 180, SY = 594;
  const COLORS = [
    { c: "#FFB627", d: "#B86E00", sym: "pint", name: "Lager" }, { c: "#EE3A55", d: "#8A1028", sym: "heart", name: "Red wine" },
    { c: "#3FCB6A", d: "#147A3A", sym: "leaf", name: "Cider" }, { c: "#3D8BFF", d: "#1840A0", sym: "drop", name: "Blue" },
    { c: "#A45CFF", d: "#5A22A8", sym: "star", name: "Blackcurrant" }, { c: "#E8ECF5", d: "#8A93AA", sym: "diamond", name: "Gin" },
  ];

  let view = null, g = null; const FX = particles();
  // ---------- sprites ----------
  let SPR = [], BOMB = null;
  function sprite(col, sym) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5) * view.scale, s = Math.ceil(D * dpr) + 4, c = document.createElement("canvas"); c.width = c.height = s; const b = c.getContext("2d"); b.scale(s / (D + 4 / dpr), s / (D + 4 / dpr)); b.translate(R + 2 / dpr, R + 2 / dpr);
    const gr = b.createRadialGradient(-R * 0.35, -R * 0.4, R * 0.1, 0, 0, R); gr.addColorStop(0, "#FFFFFF"); gr.addColorStop(0.18, col.c); gr.addColorStop(0.8, col.c); gr.addColorStop(1, col.d);
    b.fillStyle = gr; b.beginPath(); b.arc(0, 0, R - 0.5, 0, 7); b.fill();
    b.strokeStyle = "rgba(0,0,0,.25)"; b.lineWidth = 1; b.stroke();
    // fizz
    b.fillStyle = "rgba(255,255,255,.35)"; for (const [x, y, r] of [[5, 8, 1.6], [-6, 9, 1.1], [8, 1, 1.2], [-2, 12, 0.9]]) { b.beginPath(); b.arc(x, y, r, 0, 7); b.fill(); }
    // emblem
    b.fillStyle = "rgba(255,255,255,.55)"; b.strokeStyle = "rgba(255,255,255,.6)"; b.lineWidth = 2; b.beginPath();
    if (sym === "pint") { b.moveTo(-5, -5); b.lineTo(5, -5); b.lineTo(4, 7); b.lineTo(-4, 7); b.closePath(); b.fill(); b.fillStyle = "rgba(255,255,255,.85)"; b.fillRect(-5.5, -8, 11, 3.5); }
    else if (sym === "heart") { b.moveTo(0, 7); b.bezierCurveTo(-11, -1, -5, -10, 0, -4); b.bezierCurveTo(5, -10, 11, -1, 0, 7); b.fill(); }
    else if (sym === "leaf") { b.ellipse(0, 1, 5, 8, 0.6, 0, 7); b.fill(); }
    else if (sym === "drop") { b.moveTo(0, -8); b.quadraticCurveTo(7, 2, 0, 7); b.quadraticCurveTo(-7, 2, 0, -8); b.fill(); }
    else if (sym === "star") { for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr2 = i % 2 ? 3.4 : 8; b.lineTo(Math.cos(a) * rr2, Math.sin(a) * rr2 + 1); } b.closePath(); b.fill(); }
    else if (sym === "diamond") { b.moveTo(0, -8); b.lineTo(6, 0); b.lineTo(0, 8); b.lineTo(-6, 0); b.closePath(); b.fill(); }
    else if (sym === "bomb") { b.fillStyle = "#FFF6E0"; b.font = "bold 9px Bungee, Impact, sans-serif"; b.textAlign = "center"; b.textBaseline = "middle"; b.fillText("BOOM", 0, 1); }
    // shine
    b.fillStyle = "rgba(255,255,255,.75)"; b.beginPath(); b.ellipse(-R * 0.38, -R * 0.45, R * 0.28, R * 0.16, -0.6, 0, 7); b.fill();
    return c;
  }
  fit($("game"), W, H, (o) => { view = o; g = o.g; buildSprites(); });
  function buildSprites() { SPR = COLORS.map((c) => sprite(c, c.sym)); BOMB = sprite({ c: "#FF3D7F", d: "#7A0A30" }, "bomb"); }
  function drawBubble(x, y, ci, scale = 1, alpha = 1) { const s = ci === -1 ? BOMB : SPR[ci]; if (!s) return; const sz = (D + 4 / (Math.min(window.devicePixelRatio || 1, 2.5) * view.scale)) * scale; g.globalAlpha = alpha; g.drawImage(s, x - sz / 2, y - sz / 2, sz, sz); g.globalAlpha = 1; }

  // ---------- grid ----------
  let grid = [], parity = 0; // grid[r][c] = colour index or -9 for empty
  const odd = (r) => (r + parity) % 2 === 1, ncols = (r) => (odd(r) ? COLS - 1 : COLS);
  const cx = (r, c) => LEFT + R + c * D + (odd(r) ? R : 0), cy = (r) => TOP + R + r * ROWH;
  const get = (r, c) => (r >= 0 && r < grid.length && c >= 0 && c < ncols(r) ? grid[r][c] : -9);
  function neighbours(r, c) { const o = odd(r), L = [[r, c - 1], [r, c + 1]]; for (const dr of [-1, 1]) { if (o) L.push([r + dr, c], [r + dr, c + 1]); else L.push([r + dr, c - 1], [r + dr, c]); } return L.filter(([a, b]) => a >= 0 && b >= 0 && b < ncols(a)); }
  function ensureRow(r) { while (grid.length <= r) { const rr2 = grid.length; grid.push(new Array(ncols(rr2)).fill(-9)); } }
  let rnd = Math.random;
  function seeded(n) { let s = n * 9301 + 49297; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; }
  function colourCount() { return Math.min(6, 3 + Math.floor((level - 1) / 3)); }
  function present() { const s = new Set(); for (const row of grid) for (const v of row) if (v >= 0) s.add(v); return [...s]; }
  function randColour() { const p = present(); return p.length ? p[Math.floor(Math.random() * p.length)] : Math.floor(Math.random() * colourCount()); }
  function buildLevel() {
    grid = []; parity = 0; rnd = seeded(level * 7 + 3); const rows = Math.min(10, 5 + Math.floor((level - 1) / 2)), nc = colourCount();
    for (let r = 0; r < rows; r++) { ensureRow(r); for (let c = 0; c < ncols(r); c++) { let v = Math.floor(rnd() * nc); if (c > 0 && rnd() < 0.45) v = grid[r][c - 1]; else if (r > 0 && rnd() < 0.3) { const up = get(r - 1, c); if (up >= 0) v = up; } grid[r][c] = v; } }
    startCount = count();
  }
  const count = () => grid.reduce((n, row) => n + row.filter((v) => v >= 0).length, 0);
  function pushRow() {
    parity = 1 - parity; const nc = colourCount(), p = present(), row = [];
    grid.unshift(row); for (let c = 0; c < ncols(0); c++) row.push(p.length ? p[Math.floor(Math.random() * p.length)] : Math.floor(Math.random() * nc));
    // the old rows keep their own lengths because parity flipped with the shift
    beep(200, 120, 0.25, "sawtooth", 0.05); toast("THE CEILING DROPS!", 900);
  }

  // ---------- game state ----------
  let state = "menu", level = +(store.get("popLevel") || 1), score = 0, shots = 0, misses = 0, startCount = 0, cur = 0, nxt = 0, ball = null, aim = null, aiming = false, falling = [], popping = [], t = 0, bombReady = false, combo = 0;
  function newLevel() { buildLevel(); score = 0; shots = 0; misses = 0; ball = null; falling = []; popping = []; bombReady = false; cur = randColour(); nxt = randColour(); state = "play"; show(null); hud(); music([[48, 52, 55], [45, 48, 52], [41, 45, 48], [43, 47, 50]], [72, 0, 76, 0, 79, 76, 74, 0, 72, 0, 69, 72, 74, 0, 0, 0, 71, 0, 74, 77, 76, 74, 72, 0, 74, 0, 71, 67, 72, 0, 0, 0], 120); }
  function hud() { $("lvl").textContent = level; $("score").textContent = score; $("left").textContent = Math.max(0, missesAllowed() - misses); }
  const missesAllowed = () => Math.max(4, 7 - Math.floor(level / 4));

  // ---------- shooting ----------
  const MINA = 0.14, SPEED = 980;
  function angleTo(p) { let a = Math.atan2(SY - p.y, p.x - SX); return Math.max(MINA, Math.min(Math.PI - MINA, a)); }
  function fire() { if (!aim || ball || state !== "play") return; const a = aim; ball = { x: SX, y: SY, vx: Math.cos(a) * SPEED, vy: -Math.sin(a) * SPEED, c: bombReady ? -1 : cur }; if (bombReady) bombReady = false; else { cur = nxt; nxt = randColour(); } shots++; beep(500, 900, 0.08, "triangle", 0.05); }
  function stepBall(dt) {
    const n = 6; for (let i = 0; i < n; i++) {
      ball.x += ball.vx * dt / n; ball.y += ball.vy * dt / n;
      if (ball.x < LEFT + R) { ball.x = LEFT + R; ball.vx = -ball.vx; beep(900, 700, 0.03, "sine", 0.03); }
      if (ball.x > W - LEFT - R) { ball.x = W - LEFT - R; ball.vx = -ball.vx; beep(900, 700, 0.03, "sine", 0.03); }
      let hit = ball.y <= TOP + R;
      if (!hit) for (let r = 0; r < grid.length && !hit; r++) { const y = cy(r); if (Math.abs(y - ball.y) > D) continue; for (let c = 0; c < ncols(r); c++) if (grid[r][c] >= 0 && Math.hypot(cx(r, c) - ball.x, y - ball.y) < D * 0.88) { hit = true; break; } }
      if (hit) { settle(); return; }
    }
  }
  function settle() {
    // find the nearest empty cell next to the ball
    let bestCell = null, bd = 1e9;
    const consider = (r, c) => { if (r < 0 || c < 0 || c >= ncols(r)) return; if (get(r, c) >= 0) return; const d = Math.hypot(cx(r, c) - ball.x, cy(r) - ball.y); if (d < bd) { bd = d; bestCell = [r, c]; } };
    const r0 = Math.max(0, Math.round((ball.y - TOP - R) / ROWH));
    for (let r = Math.max(0, r0 - 1); r <= r0 + 1; r++) for (let c = 0; c < COLS; c++) consider(r, c);
    if (!bestCell) bestCell = [r0, 0];
    const [r, c] = bestCell; ensureRow(r); const col = ball.c; ball = null;
    if (col === -1) { explode(r, c); return afterShot(true); }
    grid[r][c] = col; thud();
    const group = flood(r, c, (v) => v === col);
    if (group.length >= 3) { removeCells(group, true); const dropped = dropFloating(); combo = group.length + dropped; if (combo >= 7) { bombReady = true; toast("KEBAB BOMB READY!", 1200); burp(); } else if (combo >= 5) toast(["LOVELY!", "GET IN!", "CRACKING!"][Math.floor(Math.random() * 3)]); afterShot(true); }
    else afterShot(false);
  }
  function explode(r, c) { const x0 = cx(r, c), y0 = cy(r); const cells = []; for (let rr2 = 0; rr2 < grid.length; rr2++) for (let cc = 0; cc < ncols(rr2); cc++) if (grid[rr2][cc] >= 0 && Math.hypot(cx(rr2, cc) - x0, cy(rr2) - y0) < D * 2.3) cells.push([rr2, cc]); FX.ring(x0, y0, "#FF3D7F", 90); FX.burst(x0, y0, "#FF3D7F", 30, 260, 4); removeCells(cells, true); dropFloating(); beep(120, 40, 0.5, "sawtooth", 0.1); toast("BOOM!"); }
  function flood(r, c, test) { const seen = new Set([r + "," + c]), out = [[r, c]], q = [[r, c]]; while (q.length) { const [a, b] = q.pop(); for (const [nr, nc] of neighbours(a, b)) { const k = nr + "," + nc; if (seen.has(k)) continue; seen.add(k); if (test(get(nr, nc))) { out.push([nr, nc]); q.push([nr, nc]); } } } return out; }
  function removeCells(cells, popIt) { cells.forEach(([r, c], i) => { const v = grid[r][c]; if (v < 0) return; grid[r][c] = -9; score += 10; popping.push({ x: cx(r, c), y: cy(r), c: v, t: -i * 0.03 }); if (popIt) setTimeout(() => pop(1 + i * 0.04), i * 30); }); hud(); }
  function dropFloating() {
    const keep = new Set(); for (let c = 0; c < ncols(0); c++) if (get(0, c) >= 0) for (const [r, cc] of flood(0, c, (v) => v >= 0)) keep.add(r + "," + cc);
    let n = 0; for (let r = 0; r < grid.length; r++) for (let c = 0; c < ncols(r); c++) if (grid[r][c] >= 0 && !keep.has(r + "," + c)) { falling.push({ x: cx(r, c), y: cy(r), vx: (Math.random() - 0.5) * 120, vy: -60 - Math.random() * 80, c: grid[r][c] }); grid[r][c] = -9; n++; score += 20; }
    if (n) { FX.text(W / 2, H * 0.45, "+" + n * 20 + " DROPPED", "#5FE3B0", 18); }
    while (grid.length && grid[grid.length - 1].every((v) => v < 0)) grid.pop(); hud(); return n;
  }
  function afterShot(scored) {
    if (!scored) { misses++; if (misses >= missesAllowed()) { misses = 0; pushRow(); } }
    hud();
    if (!present().length) return setTimeout(win, 500);
    for (let r = 0; r < grid.length; r++) if (grid[r].some((v) => v >= 0) && cy(r) + R > LOSE_Y) return lose();
    if (!present().includes(cur) && cur !== -1) cur = randColour(); if (!present().includes(nxt)) nxt = randColour();
  }
  function stars() { const par = Math.ceil(startCount / 2.6); return shots <= par ? 3 : shots <= par * 1.4 ? 2 : 1; }
  function win() {
    if (state !== "play") return; state = "over"; const s = stars(); score += s * 100; fanfare(); cheer(false);
    const prev = +(store.get("popStars" + level) || 0); if (s > prev) store.set("popStars" + level, String(s));
    PUB.submit("pop", level); level++; store.set("popLevel", String(Math.max(level, +(store.get("popLevel") || 1)))); best("popBest", level - 1);
    $("oTitle").textContent = "LEVEL " + (level - 1) + " CLEARED!"; $("oStars").innerHTML = [1, 2, 3].map((i) => `<span class="${i <= s ? "on" : ""}">★</span>`).join(""); $("oStars").hidden = false;
    $("oSub").textContent = s === 3 ? "Three stars. Absolute pro." : s === 2 ? "Not bad at all. Fewer shots for three stars." : "Done it! Try fewer shots for more stars.";
    $("oScore").textContent = score; $("oShots").textContent = shots; $("again").textContent = "NEXT LEVEL"; $("shareMsg").hidden = true; show("over"); hud();
  }
  function lose() {
    if (state !== "play") return; state = "over"; sad();
    $("oTitle").textContent = "OUT OF ROOM!"; $("oStars").hidden = true; $("oSub").textContent = "The bubbles reached the bar. Have another go at level " + level + ".";
    $("oScore").textContent = score; $("oShots").textContent = shots; $("again").textContent = "TRY AGAIN"; $("shareMsg").hidden = true; show("over");
  }

  // ---------- input ----------
  const cv = $("game");
  cv.addEventListener("pointerdown", (e) => {
    if (state !== "play") return; PUB.ctx(); const p = view.point(e);
    if (Math.hypot(p.x - 112, p.y - 606) < 26 && !ball && !bombReady) { [cur, nxt] = [nxt, cur]; beep(600, 800, 0.05, "triangle", 0.04); return; }
    aiming = true; aim = angleTo(p); cv.setPointerCapture(e.pointerId);
  });
  cv.addEventListener("pointermove", (e) => { if (aiming) aim = angleTo(view.point(e)); });
  cv.addEventListener("pointerup", () => { if (!aiming) return; aiming = false; fire(); });
  cv.addEventListener("pointercancel", () => { aiming = false; });

  // ---------- drawing ----------
  const BOKEH = Array.from({ length: 14 }, () => ({ x: Math.random() * W, y: Math.random() * H * 0.9, r: 14 + Math.random() * 40, c: ["#FFB62722", "#FF3D7F1c", "#3DE0FF18", "#FFD27A22"][Math.floor(Math.random() * 4)], s: Math.random() * 6 }));
  function guide() {
    if (!aiming || ball) return; let x = SX, y = SY, vx = Math.cos(aim), vy = -Math.sin(aim), bounces = 0, len = 0;
    g.fillStyle = "rgba(255,246,224,.8)";
    for (let i = 0; i < 260 && bounces < 3; i++) {
      x += vx * 4; y += vy * 4; len += 4;
      if (x < LEFT + R || x > W - LEFT - R) { vx = -vx; bounces++; }
      if (y < TOP + R) break; let hit = false; for (let r = 0; r < grid.length && !hit; r++) { const yy = cy(r); if (Math.abs(yy - y) > D) continue; for (let c = 0; c < ncols(r); c++) if (grid[r][c] >= 0 && Math.hypot(cx(r, c) - x, yy - y) < D * 0.9) { hit = true; break; } } if (hit) break;
      if (i % 4 === 0) { g.globalAlpha = Math.max(0.15, 1 - len / 900); g.beginPath(); g.arc(x, y, 2.2, 0, 7); g.fill(); }
    }
    g.globalAlpha = 1;
  }
  function draw(dt) {
    const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, "#1B1240"); bg.addColorStop(0.6, "#120E2C"); bg.addColorStop(1, "#2A160E"); g.fillStyle = bg; g.fillRect(0, 0, W, H); PUB.backdrop(g, W, H, 0.64);
    for (const b of BOKEH) { g.fillStyle = b.c; g.beginPath(); g.arc(b.x + Math.sin(t * 0.3 + b.s) * 6, b.y, b.r, 0, 7); g.fill(); }
    // ceiling beam + lose line
    g.fillStyle = "#3A2418"; g.fillRect(0, TOP - 14, W, 14); g.fillStyle = "#5A3A22"; g.fillRect(0, TOP - 4, W, 4);
    g.setLineDash([6, 6]); g.strokeStyle = "rgba(255,61,127,.45)"; g.lineWidth = 2; g.beginPath(); g.moveTo(0, LOSE_Y); g.lineTo(W, LOSE_Y); g.stroke(); g.setLineDash([]);
    // bar top
    const bar = g.createLinearGradient(0, LOSE_Y + 14, 0, H); bar.addColorStop(0, "#6A3E22"); bar.addColorStop(0.12, "#4A2A16"); bar.addColorStop(1, "#24130A"); g.fillStyle = bar; g.fillRect(0, LOSE_Y + 14, W, H);
    g.fillStyle = "#8A5A32"; g.fillRect(0, LOSE_Y + 14, W, 4);
    for (let r = 0; r < grid.length; r++) for (let c = 0; c < ncols(r); c++) if (grid[r][c] >= 0) drawBubble(cx(r, c), cy(r) + (REDUCED ? 0 : Math.sin(t * 2 + r * 0.6 + c) * 0.6), grid[r][c]);
    for (let i = popping.length - 1; i >= 0; i--) { const p = popping[i]; p.t += dt; if (p.t < 0) { drawBubble(p.x, p.y, p.c); continue; } if (!p.burst) { p.burst = true; FX.burst(p.x, p.y, COLORS[p.c] ? COLORS[p.c].c : "#FF3D7F", 10, 150, 3); FX.ring(p.x, p.y, "#FFF6E0", 26); } const k = p.t / 0.12; if (k >= 1) { popping.splice(i, 1); continue; } drawBubble(p.x, p.y, p.c, 1 + k * 0.5, 1 - k); }
    for (let i = falling.length - 1; i >= 0; i--) { const f = falling[i]; f.vy += 1400 * dt; f.x += f.vx * dt; f.y += f.vy * dt; if (f.y > H + 30) { falling.splice(i, 1); continue; } if (f.y > LOSE_Y + 30 && !f.splashed) { f.splashed = true; FX.burst(f.x, LOSE_Y + 22, COLORS[f.c].c, 6, 120, 3); pop(0.8); } drawBubble(f.x, f.y, f.c); }
    guide();
    if (ball) drawBubble(ball.x, ball.y, ball.c);
    // the tap (shooter)
    g.fillStyle = "#2A160E"; rr(g, SX - 34, SY + 10, 68, 26, 10); g.fill();
    const brass = g.createLinearGradient(SX - 14, 0, SX + 14, 0); brass.addColorStop(0, "#8A6A2A"); brass.addColorStop(0.5, "#F2D27A"); brass.addColorStop(1, "#8A6A2A"); g.fillStyle = brass; rr(g, SX - 10, SY + 4, 20, 14, 4); g.fill();
    if (aim != null) { g.save(); g.translate(SX, SY); g.rotate(-aim + Math.PI / 2); g.fillStyle = brass; rr(g, -6, -38, 12, 34, 5); g.fill(); g.restore(); }
    if (!ball && state === "play") drawBubble(SX, SY, bombReady ? -1 : cur, 1 + (REDUCED ? 0 : Math.sin(t * 5) * 0.03));
    // next bubble
    g.fillStyle = "#1A0E08cc"; g.beginPath(); g.arc(112, 606, 24, 0, 7); g.fill(); g.strokeStyle = "#8A5A32"; g.lineWidth = 2; g.stroke();
    if (state === "play") drawBubble(112, 606, nxt, 0.8);
    g.fillStyle = "#F4E2C2"; g.font = "bold 10px Inter, Arial"; g.textAlign = "center"; g.fillText("TAP TO SWAP", 112, 640 - 4);
    FX.step(dt); FX.draw(g);
  }
  let last = performance.now();
  function loop(now) { const dt = Math.min(0.033, (now - last) / 1000); last = now; t += dt; if (ball && state === "play") stepBall(dt); draw(dt); requestAnimationFrame(loop); }

  // ---------- screens ----------
  $("go").addEventListener("click", () => newLevel());
  $("again").addEventListener("click", () => newLevel());
  $("pick1").addEventListener("click", () => { level = 1; newLevel(); });
  $("share").addEventListener("click", () => share(`I'm on level ${level} of Pub Pop 🍻 Beat that.`, $("shareMsg")));
  wireMute();
  function startScreen() { $("startLvl").textContent = level; $("pick1").hidden = level <= 1; show("start"); }
  buildLevel(); cur = randColour(); nxt = randColour();
  gate(startScreen);
  requestAnimationFrame(loop);
})();
