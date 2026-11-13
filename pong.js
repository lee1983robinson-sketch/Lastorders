// Beer Pong: flick the ball into the cups. World 360 x 640, table in metres drawn in perspective.
(() => {
  "use strict";
  const { $, store, REDUCED, pop, thud, smash, cheer, fanfare, sad, burp, beep, noise, music, wireMute, fit, show, gate, toast, share, best, rr, particles } = PUB;
  const W = 360, H = 640, HOR = -30, FOC = 1250, CAMH = 1.1, CAMZ = -1.6, TW = 0.61, TL = 2.44, CR = 0.047, BR = 0.02;
  let g = null, view = null; fit($("game"), W, H, (o) => { view = o; g = o.g; });
  const FX = particles();
  const P = (x, y, z) => { const s = FOC / (z - CAMZ); return { x: W / 2 + x * s, y: HOR + (CAMH - y) * s, s }; };
  const RACK = (() => { const out = [], d = CR * 2.05, back = TL - 0.14; [[0], [-0.5, 0.5], [-1, 0, 1], [-1.5, -0.5, 0.5, 1.5]].forEach((row, r) => row.forEach((c) => out.push({ x: c * d, z: back - (3 - r) * d * 0.88 }))); return out; })();

  let state = "menu", cups = [], ball = null, score = 0, lives = 3, streak = 0, racks = 0, t = 0, drag = null, hint = true;
  function rack() { cups = RACK.map((c) => ({ ...c, alive: true, sink: 0 })); }
  function start() { score = 0; lives = 3; streak = 0; racks = 0; rack(); ball = null; state = "play"; show(null); hud(); music([[50, 54, 57], [47, 50, 54], [43, 47, 50], [45, 49, 52]], [74, 0, 78, 0, 81, 78, 76, 0, 74, 0, 71, 0, 74, 0, 0, 0, 76, 0, 79, 0, 83, 81, 79, 0, 78, 0, 76, 0, 74, 0, 0, 0], 128); }
  const mult = () => (streak >= 3 ? 3 : streak >= 2 ? 2 : 1);
  function hud() { $("score").textContent = score; $("lives").textContent = lives; $("streak").textContent = streak >= 3 ? "ON FIRE ×3" : streak >= 2 ? "HEATING UP ×2" : "×1"; $("streak").style.color = streak >= 3 ? "#FF5A2A" : streak >= 2 ? "#FFB627" : ""; }

  // ---------- throwing: swipe up ----------
  const cv = $("game");
  cv.addEventListener("pointerdown", (e) => { if (state !== "play" || ball) return; PUB.ctx(); const p = view.point(e); drag = [{ ...p, t: performance.now() }]; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener("pointermove", (e) => { if (!drag) return; drag.push({ ...view.point(e), t: performance.now() }); if (drag.length > 30) drag.shift(); });
  cv.addEventListener("pointerup", () => {
    if (!drag) return; const pts = drag; drag = null; if (pts.length < 3) return;
    const b = pts[pts.length - 1], a = pts.find((q) => b.t - q.t < 200) || pts[0], dy = a.y - b.y, dx = b.x - a.x, dt = Math.max(30, b.t - a.t);
    if (dy < 30) { toast("FLICK UPWARDS", 800); return; }
    const v = dy / dt; // px per ms
    const reach = Math.max(0.6, Math.min(TL + 0.6, 0.35 + v * 1.25)), side = Math.max(-0.45, Math.min(0.45, (dx / dy) * 0.55));
    const x0 = Math.max(-TW / 2 + 0.05, Math.min(TW / 2 - 0.05, (pts[0].x - W / 2) / P(0, 0, 0.1).s));
    const land = { x: x0 + side * reach + gauss() * 0.008, z: 0.1 + reach + gauss() * 0.012 };
    ball = { x0, z0: 0.08, y0: 0.32, x1: land.x, z1: land.z, t: 0, dur: 0.55 + reach * 0.12, phase: "fly" }; hint = false;
    beep(700, 1000, 0.06, "triangle", 0.04);
  });
  const gauss = () => { let u = 0, w = 0; while (!u) u = Math.random(); while (!w) w = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * w); };

  function landBall() {
    const hit = cups.filter((c) => c.alive).map((c) => ({ c, d: Math.hypot(c.x - ball.x1, c.z - ball.z1) })).sort((a, b) => a.d - b.d)[0];
    if (hit && hit.d < CR - BR * 0.3) return sink(hit.c, false);
    if (hit && hit.d < CR + BR) { // rim
      beep(1800, 1500, 0.05, "square", 0.04);
      if (Math.random() < 0.45) return sink(hit.c, true);
      const ang = Math.atan2(ball.x1 - hit.c.x, ball.z1 - hit.c.z) + (Math.random() - 0.5); const nx = hit.c.x + Math.sin(ang) * (CR * 2.4), nz = hit.c.z + Math.cos(ang) * (CR * 2.4);
      ball = { x0: ball.x1, z0: ball.z1, y0: 0.12, x1: nx, z1: nz, t: 0, dur: 0.32, phase: "bounce", n: (ball.n || 0) + 1 };
      if (ball.n > 2) return miss(); return;
    }
    if (ball.phase !== "off" && Math.abs(ball.x1) < TW / 2 && ball.z1 < TL) { pop(0.6); ball = { x0: ball.x1, z0: ball.z1, y0: 0, x1: ball.x1 + (ball.x1 - ball.x0) * 0.6, z1: ball.z1 + 0.7, t: 0, dur: 0.45, phase: "off" }; return; }
    miss();
  }
  function sink(c, rim) {
    c.alive = false; c.sink = 1; streak++; const pts = mult(); score += pts; ball = null; const s = P(c.x, 0.12, c.z);
    FX.burst(s.x, s.y - 10, "#FFB627", 18, 160, 3); FX.ring(s.x, s.y - 8, "#FFF6E0", 30); FX.text(s.x, s.y - 40, "+" + pts, "#FFF6E0", 18);
    noise(0.3, 0.12, 1800); pop(0.9);
    toast(rim ? "RIM... AND IN!" : streak === 2 ? "HEATING UP!" : streak === 3 ? "ON FIRE!" : streak > 3 ? "UNSTOPPABLE!" : ["SPLASH!", "GET IN!", "SINK IT!", "CLASS!"][Math.floor(Math.random() * 4)], 900);
    if (streak === 3) { fanfare(); burp(); }
    hud();
    if (!cups.some((x) => x.alive)) { racks++; score += 5; lives = Math.min(3, lives + 1); hud(); cheer(true); toast("RACK CLEARED! +5", 1400); setTimeout(() => { rack(); }, 1200); }
  }
  function miss() {
    ball = null; streak = 0; lives--; hud(); beep(260, 140, 0.25, "triangle", 0.05);
    toast(lives > 0 ? ["MISS!", "Wide!", "Nope.", "Air ball!"][Math.floor(Math.random() * 4)] : "LAST BALL GONE", 900);
    if (lives <= 0) { state = "over"; sad(); const b = best("pongBest", score); PUB.submit("pong", score); setTimeout(() => { $("oScore").textContent = score; $("oBest").textContent = b; $("oRacks").textContent = racks; $("oSub").textContent = score >= 25 ? "Beer pong legend." : score >= 10 ? "Decent arm on you." : "The cups win this round."; $("shareMsg").hidden = true; show("over"); }, 800); }
  }

  // ---------- drawing ----------
  function quad(a, b, c, d, fill) { g.fillStyle = fill; g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.lineTo(c.x, c.y); g.lineTo(d.x, d.y); g.closePath(); g.fill(); }
  function cup(c) {
    if (!c.alive && c.sink <= 0) return; const top = P(c.x, 0.12, c.z), bot = P(c.x, 0, c.z), rt = CR * top.s, rb = CR * 0.72 * bot.s, k = c.alive ? 1 : c.sink;
    g.save(); g.globalAlpha = k; if (!c.alive) { g.translate(0, (1 - k) * 30); c.sink = Math.max(0, c.sink - 0.03); }
    g.fillStyle = "rgba(0,0,0,.35)"; g.beginPath(); g.ellipse(bot.x, bot.y, rb * 1.3, rb * 0.4, 0, 0, 7); g.fill();
    const gr = g.createLinearGradient(top.x - rt, 0, top.x + rt, 0); gr.addColorStop(0, "#8A0A1E"); gr.addColorStop(0.35, "#FF4A5E"); gr.addColorStop(0.55, "#E01A36"); gr.addColorStop(1, "#6A0614");
    g.fillStyle = gr; g.beginPath(); g.moveTo(top.x - rt, top.y); g.lineTo(bot.x - rb, bot.y); g.ellipse(bot.x, bot.y, rb, rb * 0.3, 0, Math.PI, 0, true); g.lineTo(top.x + rt, top.y); g.closePath(); g.fill();
    g.fillStyle = "#FFFFFF"; g.beginPath(); g.ellipse(top.x, top.y, rt, rt * 0.34, 0, 0, 7); g.fill();
    g.fillStyle = "#E8A020"; g.beginPath(); g.ellipse(top.x, top.y + rt * 0.04, rt * 0.86, rt * 0.27, 0, 0, 7); g.fill();
    g.fillStyle = "#FFF3D0"; g.beginPath(); g.ellipse(top.x - rt * 0.2, top.y, rt * 0.4, rt * 0.1, 0, 0, 7); g.fill();
    g.restore();
  }
  function drawBall() {
    if (!ball) return; const k = Math.min(1, ball.t / ball.dur), x = ball.x0 + (ball.x1 - ball.x0) * k, z = ball.z0 + (ball.z1 - ball.z0) * k;
    const peak = ball.phase === "fly" ? 0.35 + (ball.z1 - ball.z0) * 0.22 : ball.phase === "bounce" ? 0.1 : 0.12;
    const y = ball.y0 * (1 - k) + Math.sin(k * Math.PI) * peak + (ball.phase === "off" ? -k * 0.4 : 0.12 * k * (ball.phase === "fly" ? 1 : 0));
    const sh = P(x, 0, z), s = P(x, y + BR, z), r = BR * s.s;
    if (ball.phase !== "off" || k < 0.5) { g.fillStyle = "rgba(0,0,0,.3)"; g.beginPath(); g.ellipse(sh.x, sh.y, r, r * 0.35, 0, 0, 7); g.fill(); }
    const gr = g.createRadialGradient(s.x - r * 0.3, s.y - r * 0.35, r * 0.1, s.x, s.y, r); gr.addColorStop(0, "#FFFFFF"); gr.addColorStop(1, "#C8CCD8"); g.fillStyle = gr; g.beginPath(); g.arc(s.x, s.y, Math.max(2, r), 0, 7); g.fill();
    if (streak >= 3) { FX.burst(s.x, s.y, Math.random() < 0.5 ? "#FF5A2A" : "#FFB627", 1, 40, 2.5); }
  }
  function draw(dt) {
    const bg = g.createRadialGradient(W / 2, 120, 20, W / 2, 200, 520); bg.addColorStop(0, "#3A1A4A"); bg.addColorStop(1, "#0A0816"); g.fillStyle = bg; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 10; i++) { g.fillStyle = ["#FF3D7F22", "#3DE0FF1c", "#FFB62722"][i % 3]; g.beginPath(); g.arc((i * 83) % W, 60 + (i * 37) % 160, 18 + (i % 3) * 12, 0, 7); g.fill(); }
    // table
    quad(P(-TW / 2 - 0.02, 0, TL + 0.02), P(TW / 2 + 0.02, 0, TL + 0.02), P(TW / 2 + 0.02, 0, -0.2), P(-TW / 2 - 0.02, 0, -0.2), "#E8E8F0");
    quad(P(-TW / 2, 0, TL), P(TW / 2, 0, TL), P(TW / 2, 0, -0.2), P(-TW / 2, 0, -0.2), "#141A3A");
    const m1 = P(0, 0, TL), m2 = P(0, 0, -0.2); g.strokeStyle = "rgba(255,255,255,.35)"; g.lineWidth = 2; g.beginPath(); g.moveTo(m1.x, m1.y); g.lineTo(m2.x, m2.y); g.stroke();
    const half = [P(-TW / 2, 0, TL / 2), P(TW / 2, 0, TL / 2)]; g.beginPath(); g.moveTo(half[0].x, half[0].y); g.lineTo(half[1].x, half[1].y); g.stroke();
    // logo on the table
    const lg = P(0, 0, TL * 0.42); g.save(); g.globalAlpha = 0.25; g.fillStyle = "#3DE0FF"; g.font = `${Math.round(lg.s * 0.05)}px Bungee, Impact, sans-serif`; g.textAlign = "center"; g.fillText("LAST ORDERS", lg.x, lg.y); g.restore();
    // cups far to near, ball sorted in
    const bz = ball ? ball.z0 + (ball.z1 - ball.z0) * Math.min(1, ball.t / ball.dur) : -9;
    const list = cups.slice().sort((a, b) => b.z - a.z); for (const c of list) if (c.z >= bz) cup(c); drawBall(); for (const c of list) if (c.z < bz) cup(c);
    if (state === "play" && !ball) { const s = P(0, 0.3, 0.08); const r = BR * s.s; g.fillStyle = "#F4F4FA"; g.beginPath(); g.arc(s.x, s.y + 40, r, 0, 7); g.fill();
      if (hint) { g.fillStyle = "rgba(255,246,224,.85)"; g.font = "bold 13px Inter, Arial"; g.textAlign = "center"; g.fillText("Flick up to throw. Harder flick, further throw.", W / 2, 520); } }
    FX.step(dt); FX.draw(g);
  }
  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.033, (now - last) / 1000); last = now; t += dt;
    if (ball) { ball.t += dt; if (ball.t >= ball.dur) { if (ball.phase === "off") miss(); else landBall(); } }
    draw(dt); requestAnimationFrame(loop);
  }
  $("go").addEventListener("click", start); $("again").addEventListener("click", start);
  $("share").addEventListener("click", () => share(`I sank ${score} on Beer Pong 🏓🍺 Beat that.`, $("shareMsg")));
  wireMute(); rack();
  gate(() => show("start"));
  requestAnimationFrame(loop);
})();
