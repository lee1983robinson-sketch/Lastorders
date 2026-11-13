// Pool: UK pub 8-ball (reds and yellows) against the pub regulars. World 360 x 640, table top-down.
(() => {
  "use strict";
  const { $, store, REDUCED, pop, thud, cheer, fanfare, sad, beep, noise, music, wireMute, fit, show, gate, toast, share, best, rr, shade, particles } = PUB;
  const W = 360, H = 640, X0 = 50, X1 = 310, Y0 = 108, Y1 = 556, R = 8.6, PR = 15;
  let g = null, view = null; fit($("game"), W, H, (o) => { view = o; g = o.g; });
  const FX = particles();
  const POCKETS = [[X0, Y0], [X1, Y0], [X0 - 3, (Y0 + Y1) / 2], [X1 + 3, (Y0 + Y1) / 2], [X0, Y1], [X1, Y1]];
  const OPP = [{ name: "Shaky Steve", err: 0.09, pow: 0.9 }, { name: "Big Dave", err: 0.045, pow: 1 }, { name: "The Landlord", err: 0.016, pow: 1 }];
  const COL = { c: "#F8F6EE", r: "#D8202E", y: "#F6C21C", b: "#151515" };
  let opp = Math.min(2, Math.max(0, +(store.get("poolOpp") || 1)));
  let balls = [], turn = 0, groups = [null, null], shots = 0, moving = false, aim = null, drag = null, foul = false, firstHit = null, potted = [], state = "menu", t = 0, wins = +(store.get("poolWins") || 0), freeShots = 0, cpuT = 0, msgShown = "";

  function rack() {
    balls = [{ k: "c", x: (X0 + X1) / 2, y: Y1 - 110, vx: 0, vy: 0, in: false }];
    const apex = { x: (X0 + X1) / 2, y: Y0 + 120 }, pattern = ["r", "y", "r", "r", "b", "y", "y", "r", "y", "r", "y", "y", "r", "r", "y"]; let i = 0;
    for (let row = 0; row < 5; row++) for (let c = 0; c <= row; c++) { const x = apex.x + (c - row / 2) * R * 2.02, y = apex.y - row * R * 1.76; balls.push({ k: pattern[i++], x, y, vx: 0, vy: 0, in: false }); }
  }
  const cue = () => balls[0];
  const mine = (p) => groups[p];
  const left = (k) => balls.filter((b) => b.k === k && !b.in).length;
  function start() { rack(); turn = 0; groups = [null, null]; freeShots = 0; foul = false; state = "play"; show(null); hud("Your break. Pull back from the white ball and let go."); music([[45, 48, 52], [41, 45, 48], [43, 47, 50], [40, 44, 47]], [69, 0, 0, 72, 0, 74, 0, 72, 69, 0, 0, 67, 0, 69, 0, 0, 65, 0, 0, 69, 0, 72, 0, 69, 68, 0, 0, 64, 0, 0, 0, 0], 92); }
  function hud(msg) {
    $("p0").classList.toggle("on", turn === 0); $("p1").classList.toggle("on", turn === 1); $("oppName").textContent = OPP[opp].name;
    for (const i of [0, 1]) { const gk = groups[i]; $("g" + i).innerHTML = gk ? `<span class="dot" style="background:${COL[gk]}"></span>${left(gk)} left` : "Open table"; }
    if (msg) $("msg").textContent = msg; $("free").hidden = freeShots < 1; $("free").textContent = freeShots > 1 ? "2 shots" : "1 shot left";
  }

  // ---------- physics ----------
  function step(dt) {
    const n = 10, h = dt / n; let any = false;
    for (let s = 0; s < n; s++) {
      for (const b of balls) { if (b.in) continue; b.x += b.vx * h; b.y += b.vy * h; }
      for (let i = 0; i < balls.length; i++) {
        const a = balls[i]; if (a.in) continue;
        // pockets
        for (const [px, py] of POCKETS) if (Math.hypot(a.x - px, a.y - py) < PR) { pocketBall(a, px, py); break; }
        if (a.in) continue;
        // cushions (with gaps at the pockets)
        const nearPocket = POCKETS.some(([px, py]) => Math.hypot(a.x - px, a.y - py) < PR + 10);
        if (!nearPocket) {
          if (a.x < X0 + R) { a.x = X0 + R; a.vx = Math.abs(a.vx) * 0.78; cushion(a); } if (a.x > X1 - R) { a.x = X1 - R; a.vx = -Math.abs(a.vx) * 0.78; cushion(a); }
          if (a.y < Y0 + R) { a.y = Y0 + R; a.vy = Math.abs(a.vy) * 0.78; cushion(a); } if (a.y > Y1 - R) { a.y = Y1 - R; a.vy = -Math.abs(a.vy) * 0.78; cushion(a); }
        } else { if (a.x < X0 - 12 || a.x > X1 + 12 || a.y < Y0 - 12 || a.y > Y1 + 12) pocketBall(a, a.x, a.y); }
        for (let j = i + 1; j < balls.length; j++) {
          const b = balls[j]; if (b.in) continue; const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy); if (d >= R * 2 || d === 0) continue;
          const nx = dx / d, ny = dy / d, ov = R * 2 - d; a.x -= nx * ov / 2; a.y -= ny * ov / 2; b.x += nx * ov / 2; b.y += ny * ov / 2;
          const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny; if (rv < 0) { const jj = -(1 + 0.95) * rv / 2; a.vx -= jj * nx; a.vy -= jj * ny; b.vx += jj * nx; b.vy += jj * ny; if (Math.abs(rv) > 30) clack(Math.abs(rv)); }
          if (i === 0 && !firstHit) firstHit = b.k; if (j === 0 && !firstHit) firstHit = a.k;
        }
      }
    }
    for (const b of balls) { if (b.in) continue; const sp = Math.hypot(b.vx, b.vy); if (sp < 4) { b.vx = b.vy = 0; continue; } const k = Math.max(0, sp - 95 * dt) / sp; b.vx *= k; b.vy *= k; any = true; }
    return any;
  }
  let clackT = 0; function clack(v) { if (t - clackT < 0.03) return; clackT = t; beep(2400, 1800, 0.03, "square", Math.min(0.08, v / 6000)); noise(0.03, Math.min(0.1, v / 5000), 4000); }
  function cushion(a) { const sp = Math.hypot(a.vx, a.vy); if (sp > 40) beep(160, 110, 0.06, "sine", Math.min(0.06, sp / 9000)); }
  function pocketBall(b, px, py) { b.in = true; b.vx = b.vy = 0; potted.push(b.k); FX.burst(px, py, COL[b.k], 8, 80, 2.5); beep(300, 120, 0.15, "sine", 0.08); noise(0.15, 0.08, 400); }

  // ---------- rules (UK pub style, simplified) ----------
  function shoot(dx, dy, power) { if (moving) return; const c = cue(); c.vx = dx * power; c.vy = dy * power; moving = true; potted = []; firstHit = null; aim = null; noise(0.05, 0.15, 2500); beep(900, 500, 0.04, "square", 0.05); }
  function endShot() {
    moving = false; const me = turn, myG = mine(me), oppG = mine(1 - me), cueIn = potted.includes("c"), black = potted.includes("b");
    let isFoul = false, keep = false, why = "";
    if (cueIn) { isFoul = true; why = "In-off! "; cue().in = false; cue().x = (X0 + X1) / 2; cue().y = Y1 - 110; for (const b of balls) if (!b.in && b !== cue() && Math.hypot(b.x - cue().x, b.y - cue().y) < R * 2) cue().x += R * 2.5; }
    const legal = myG ? (left(myG) + (potted.filter((k) => k === myG).length) > 0 ? myG : "b") : null;
    if (!firstHit) { isFoul = true; why += "Missed everything! "; }
    else if (legal && firstHit !== legal) { isFoul = true; why += "Hit the wrong ball first! "; }
    else if (!legal && firstHit === "b") { isFoul = true; why += "Hit the black first! "; }
    if (black) { const cleared = myG && left(myG) === 0 && !potted.slice(0, potted.indexOf("b")).some((k) => k === myG && false); return frameOver(cleared && !isFoul && !cueIn ? me : 1 - me, cleared && !isFoul && !cueIn ? "Black potted. Frame!" : "Black went down early. Frame lost."); }
    const ownPots = potted.filter((k) => k === "r" || k === "y");
    if (!myG && ownPots.length && !isFoul) { groups[me] = ownPots[0]; groups[1 - me] = ownPots[0] === "r" ? "y" : "r"; keep = true; toast(`${me === 0 ? "YOU'RE" : OPP[opp].name.toUpperCase() + " IS"} ${ownPots[0] === "r" ? "REDS" : "YELLOWS"}`, 1300); }
    else if (myG && ownPots.includes(myG) && !isFoul) keep = true;
    if (isFoul) { turn = 1 - me; freeShots = 2; toast("FOUL! " + why + (turn === 0 ? "Two shots to you." : "Two shots to " + OPP[opp].name + "."), 1600); beep(220, 110, 0.4, "sawtooth", 0.05); }
    else if (keep) { if (freeShots) freeShots = Math.max(freeShots, 1); }
    else if (freeShots > 1) { freeShots = 1; }
    else { freeShots = 0; turn = 1 - me; }
    hud(turn === 0 ? (keep ? "Nice. Go again." : "Your shot.") : OPP[opp].name + " is lining up…");
    if (turn === 1) cpuT = 1.1;
  }
  function frameOver(winner, msg) {
    state = "over"; moving = false;
    if (winner === 0) { wins++; store.set("poolWins", String(wins)); PUB.submit("pool", wins); fanfare(); cheer(true); } else sad();
    $("oTitle").textContent = winner === 0 ? "FRAME TO YOU!" : OPP[opp].name.toUpperCase() + " WINS"; $("oSub").textContent = msg; $("oWins").textContent = wins; $("shareMsg").hidden = true;
    setTimeout(() => show("over"), 1200);
  }

  // ---------- the pub regular's shot ----------
  function clearPath(x1, y1, x2, y2, skip) { for (const b of balls) { if (b.in || skip.includes(b)) continue; const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy), u = ((b.x - x1) * dx + (b.y - y1) * dy) / (L * L); if (u <= 0 || u >= 1) continue; if (Math.hypot(x1 + dx * u - b.x, y1 + dy * u - b.y) < R * 2) return false; } return true; }
  function cpuShot() {
    const c = cue(), myG = mine(1), targets = balls.filter((b) => !b.in && b !== c && (myG ? (left(myG) ? b.k === myG : b.k === "b") : b.k !== "b"));
    let bestShot = null;
    for (const b of targets) for (const [px, py] of POCKETS) {
      const tx = px - b.x, ty = py - b.y, tl = Math.hypot(tx, ty), gx = b.x - (tx / tl) * R * 2, gy = b.y - (ty / tl) * R * 2;
      const ax = gx - c.x, ay = gy - c.y, al = Math.hypot(ax, ay), cut = Math.acos(Math.max(-1, Math.min(1, (ax * tx + ay * ty) / (al * tl))));
      if (cut > 1.25) continue; const ok = clearPath(c.x, c.y, gx, gy, [c, b]) && clearPath(b.x, b.y, px, py, [b]);
      const score = (ok ? 0 : 3) + cut * 1.5 + (al + tl) / 400; if (!bestShot || score < bestShot.score) bestShot = { score, ax: ax / al, ay: ay / al, dist: al + tl * 1.4 };
    }
    let ax, ay, power;
    if (bestShot) { const e = (Math.random() - 0.5) * 2 * OPP[opp].err; ax = bestShot.ax * Math.cos(e) - bestShot.ay * Math.sin(e); ay = bestShot.ax * Math.sin(e) + bestShot.ay * Math.cos(e); power = Math.min(900, 280 + bestShot.dist * 1.15) * OPP[opp].pow; }
    else { const b = targets[0] || balls.find((x) => !x.in && x !== c); const dx = b.x - c.x, dy = b.y - c.y, l = Math.hypot(dx, dy); ax = dx / l; ay = dy / l; power = 600; }
    shoot(ax, ay, power);
  }

  // ---------- input: pull back from the white and let go ----------
  const cv = $("game"), MAXPULL = 120;
  cv.addEventListener("pointerdown", (e) => { if (state !== "play" || moving || turn !== 0) return; PUB.ctx(); const p = view.point(e); drag = { sx: p.x, sy: p.y, x: p.x, y: p.y }; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener("pointermove", (e) => { if (!drag) return; const p = view.point(e); drag.x = p.x; drag.y = p.y; });
  cv.addEventListener("pointerup", () => { if (!drag) return; const c = cue(); let dx = c.x - drag.x, dy = c.y - drag.y; const pull = Math.min(MAXPULL, Math.hypot(drag.x - drag.sx, drag.y - drag.sy)); const l = Math.hypot(dx, dy); drag = null; if (pull < 8 || l < 1) return; shoot(dx / l, dy / l, 120 + (pull / MAXPULL) * 900); });

  // ---------- drawing ----------
  function ballDraw(b) {
    const gr = g.createRadialGradient(b.x - R * 0.35, b.y - R * 0.4, R * 0.1, b.x, b.y, R); gr.addColorStop(0, "#FFFFFF"); gr.addColorStop(0.25, COL[b.k]); gr.addColorStop(1, shade(COL[b.k] === "#151515" ? "#333333" : COL[b.k], -0.45));
    g.fillStyle = "rgba(0,0,0,.35)"; g.beginPath(); g.arc(b.x + 2, b.y + 2.5, R, 0, 7); g.fill(); g.fillStyle = gr; g.beginPath(); g.arc(b.x, b.y, R, 0, 7); g.fill();
    if (b.k === "b") { g.fillStyle = "#FFF"; g.beginPath(); g.arc(b.x, b.y, R * 0.45, 0, 7); g.fill(); g.fillStyle = "#111"; g.font = "bold 8px Inter, Arial"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("8", b.x, b.y + 0.5); }
  }
  function guide() {
    if (!drag || moving) return; const c = cue(); let dx = c.x - drag.x, dy = c.y - drag.y; const l = Math.hypot(dx, dy); if (l < 1) return; dx /= l; dy /= l;
    const pull = Math.min(MAXPULL, Math.hypot(drag.x - drag.sx, drag.y - drag.sy));
    // cue stick
    g.save(); g.translate(c.x, c.y); g.rotate(Math.atan2(dy, dx)); const back = 12 + pull * 0.5; const sg = g.createLinearGradient(-back - 230, 0, -back, 0); sg.addColorStop(0, "#3A1A0A"); sg.addColorStop(0.7, "#C8924A"); sg.addColorStop(1, "#F2E2C2");
    g.fillStyle = sg; g.beginPath(); g.moveTo(-back, -2.2); g.lineTo(-back - 230, -4.5); g.lineTo(-back - 230, 4.5); g.lineTo(-back, 2.2); g.fill(); g.fillStyle = "#3D8BFF"; g.fillRect(-back - 1, -2.2, 3, 4.4); g.restore();
    // aim line to first ball, ghost ball and its path
    let best_ = null, bt = 1e9; for (const b of balls) { if (b.in || b === c) continue; const ox = b.x - c.x, oy = b.y - c.y, tproj = ox * dx + oy * dy; if (tproj <= 0) continue; const perp = Math.hypot(ox - dx * tproj, oy - dy * tproj); if (perp >= R * 2) continue; const tt = tproj - Math.sqrt(R * R * 4 - perp * perp); if (tt < bt) { bt = tt; best_ = b; } }
    const wallT = Math.min(dx > 0 ? (X1 - R - c.x) / dx : dx < 0 ? (X0 + R - c.x) / dx : 1e9, dy > 0 ? (Y1 - R - c.y) / dy : dy < 0 ? (Y0 + R - c.y) / dy : 1e9);
    const tEnd = Math.min(bt, wallT), ex = c.x + dx * tEnd, ey = c.y + dy * tEnd;
    g.strokeStyle = "rgba(255,255,255,.55)"; g.setLineDash([4, 5]); g.lineWidth = 1.5; g.beginPath(); g.moveTo(c.x, c.y); g.lineTo(ex, ey); g.stroke(); g.setLineDash([]);
    g.strokeStyle = "rgba(255,255,255,.7)"; g.beginPath(); g.arc(ex, ey, R, 0, 7); g.stroke();
    if (best_) { const nx = best_.x - ex, ny = best_.y - ey, nl = Math.hypot(nx, ny); g.strokeStyle = "rgba(255,246,170,.65)"; g.lineWidth = 2; g.beginPath(); g.moveTo(best_.x, best_.y); g.lineTo(best_.x + (nx / nl) * 60, best_.y + (ny / nl) * 60); g.stroke(); }
    // power
    g.fillStyle = "#0A0E24cc"; rr(g, W - 30, 200, 14, 200, 7); g.fill(); const pg = g.createLinearGradient(0, 400, 0, 200); pg.addColorStop(0, "#5FE3B0"); pg.addColorStop(0.6, "#FFB627"); pg.addColorStop(1, "#FF3D7F"); g.fillStyle = pg; const ph = 200 * pull / MAXPULL; rr(g, W - 30, 400 - ph, 14, Math.max(14, ph), 7); g.fill();
  }
  function draw(dt) {
    const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, "#1B1240"); bg.addColorStop(1, "#140C08"); g.fillStyle = bg; g.fillRect(0, 0, W, H);
    // light over the table
    const lt = g.createRadialGradient(W / 2, (Y0 + Y1) / 2, 40, W / 2, (Y0 + Y1) / 2, 360); lt.addColorStop(0, "rgba(255,230,170,.18)"); lt.addColorStop(1, "rgba(255,230,170,0)"); g.fillStyle = lt; g.fillRect(0, 0, W, H);
    // wood rails
    const wd = g.createLinearGradient(0, Y0 - 26, 0, Y1 + 26); wd.addColorStop(0, "#6A3A1A"); wd.addColorStop(0.5, "#8A5226"); wd.addColorStop(1, "#5A2E12"); g.fillStyle = wd; rr(g, X0 - 26, Y0 - 26, X1 - X0 + 52, Y1 - Y0 + 52, 18); g.fill();
    g.fillStyle = "#D8B060"; for (const [x, y] of [[X0 - 13, Y0 + 120], [X0 - 13, Y1 - 120], [X1 + 13, Y0 + 120], [X1 + 13, Y1 - 120], [(X0 + X1) / 2 - 60, Y0 - 13], [(X0 + X1) / 2 + 60, Y0 - 13], [(X0 + X1) / 2 - 60, Y1 + 13], [(X0 + X1) / 2 + 60, Y1 + 13]]) { g.beginPath(); g.arc(x, y, 2.5, 0, 7); g.fill(); }
    // cloth
    const cl = g.createRadialGradient(W / 2, (Y0 + Y1) / 2, 30, W / 2, (Y0 + Y1) / 2, 320); cl.addColorStop(0, "#1E8A4A"); cl.addColorStop(1, "#0E5A2E"); g.fillStyle = cl; g.fillRect(X0 - 6, Y0 - 6, X1 - X0 + 12, Y1 - Y0 + 12);
    g.strokeStyle = "rgba(255,255,255,.25)"; g.lineWidth = 1; g.beginPath(); g.moveTo(X0, Y1 - 120); g.lineTo(X1, Y1 - 120); g.stroke(); g.beginPath(); g.arc((X0 + X1) / 2, Y1 - 120, 40, 0, Math.PI); g.stroke();
    g.fillStyle = "rgba(255,255,255,.4)"; g.beginPath(); g.arc((X0 + X1) / 2, Y0 + 120, 2, 0, 7); g.fill();
    for (const [px, py] of POCKETS) { g.fillStyle = "#050505"; g.beginPath(); g.arc(px, py, PR, 0, 7); g.fill(); g.strokeStyle = "#3A1A0A"; g.lineWidth = 3; g.stroke(); }
    for (const b of balls) if (!b.in) ballDraw(b);
    guide();
    // potted tray
    let tx = 70; for (const b of balls) if (b.in && b.k !== "c") { const bb = { ...b, x: tx, y: H - 24 }; ballDraw(bb); tx += 15; }
    FX.step(dt); FX.draw(g);
  }
  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.025, (now - last) / 1000); last = now; t += dt;
    if (state === "play") {
      if (moving) { if (!step(dt)) endShot(); }
      else if (turn === 1) { cpuT -= dt; if (cpuT <= 0) { cpuT = 99; cpuShot(); } }
    }
    draw(dt); requestAnimationFrame(loop);
  }
  function drawOpp() { document.querySelectorAll(".opp button").forEach((b) => { const on = +b.dataset.o === opp; b.classList.toggle("on", on); b.setAttribute("aria-pressed", on ? "true" : "false"); }); }
  document.querySelectorAll(".opp button").forEach((b) => b.addEventListener("click", () => { opp = +b.dataset.o; store.set("poolOpp", String(opp)); drawOpp(); }));
  $("go").addEventListener("click", start); $("again").addEventListener("click", start); $("menu").addEventListener("click", () => { state = "menu"; drawOpp(); show("start"); });
  $("share").addEventListener("click", () => share(`I've won ${wins} frames of pool on Last Orders 🎱🍺 Fancy a game?`, $("shareMsg")));
  wireMute(); rack(); drawOpp(); hud("");
  gate(() => show("start"));
  requestAnimationFrame(loop);
})();
