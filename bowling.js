// Bottle Bowling: ten frames, ten beer bottles. World 360 x 640, lane simulated in metres and drawn in perspective.
(() => {
  "use strict";
  const { $, store, REDUCED, pop, thud, smash, cheer, fanfare, sad, beep, noise, music, wireMute, fit, show, gate, toast, share, best, rr, particles } = PUB;
  const W = 360, H = 640, HOR = 176, FOC = 500, CAMH = 1.15, LANE = 1.06, LEN = 12, BR = 0.12, PR = 0.08; let camZ = -2.3;
  let g = null, view = null; fit($("game"), W, H, (o) => { view = o; g = o.g; });
  const FX = particles();
  const P = (x, y, z) => { const d = z - camZ, s = FOC / d; return { x: W / 2 + x * s, y: HOR + (CAMH - y) * s, s }; };
  // standard pin spots (1 at the front), 30.5 cm apart
  const SPOTS = (() => { const out = [], d = 0.36, rows = [[0], [-0.5, 0.5], [-1, 0, 1], [-1.5, -0.5, 0.5, 1.5]]; rows.forEach((row, r) => row.forEach((c) => out.push({ x: c * d, z: LEN - 0.9 + r * d * 0.866 }))); return out; })();
  const COLS = ["#5A3A12", "#2E6B2A", "#5A3A12", "#2E6B2A", "#7A4A16", "#5A3A12", "#2E6B2A", "#5A3A12", "#2E6B2A", "#7A4A16"];

  let state = "menu", pins = [], ball = null, frames = [], frameNo = 0, rollNo = 0, standing = 10, settleT = 0, t = 0, aimX = 0, drag = null, total = 0, hint = true;
  function rack(all) { if (all) pins = SPOTS.map((s, i) => ({ x: s.x, z: s.z, vx: 0, vz: 0, down: false, fall: 0, fa: 0, col: COLS[i], gone: false })); else pins = pins.filter((p) => !p.down).map((p) => ({ ...p, vx: 0, vz: 0 })); }
  function start() { frames = Array.from({ length: 10 }, () => []); frameNo = 0; rollNo = 0; total = 0; standing = 10; rack(true); ball = null; aimX = 0; state = "play"; show(null); sheet(); hud(); toast("FRAME 1", 900); music([[48, 52, 55], [45, 48, 52], [41, 45, 48], [43, 47, 50]], [67, 0, 72, 0, 76, 0, 74, 72, 74, 0, 72, 0, 69, 0, 0, 0, 65, 0, 69, 0, 72, 0, 71, 69, 71, 0, 67, 0, 72, 0, 0, 0], 108); }

  // ---------- scoring ----------
  function scoreFrames() {
    const rolls = frames.flat(); let s = 0, i = 0; const out = [];
    for (let f = 0; f < 10; f++) {
      if (rolls[i] === undefined) break;
      if (rolls[i] === 10) { if (rolls[i + 2] === undefined) break; s += 10 + rolls[i + 1] + rolls[i + 2]; i += 1; }
      else { if (rolls[i + 1] === undefined) break; if (rolls[i] + rolls[i + 1] === 10) { if (rolls[i + 2] === undefined) break; s += 10 + rolls[i + 2]; } else s += rolls[i] + rolls[i + 1]; i += 2; }
      out.push(s);
    }
    return out;
  }
  function marks(f) { const r = frames[f], m = []; for (let k = 0; k < r.length; k++) { const v = r[k]; if (f < 9) { if (k === 0 && v === 10) { m.push("", "X"); break; } if (k === 1 && r[0] + v === 10) { m.push("/"); continue; } m.push(v === 0 ? "-" : String(v)); } else { const prev = r[k - 1]; if (v === 10 && (k === 0 || prev === 10 || (k === 2 && r[0] + r[1] === 10))) m.push("X"); else if (k > 0 && prev !== 10 && !(k === 2 && r[0] + r[1] === 10) && prev + v === 10) m.push("/"); else m.push(v === 0 ? "-" : String(v)); } } return m; }
  function sheet() {
    const sc = scoreFrames(); total = sc.length ? sc[sc.length - 1] : 0;
    $("sheet").innerHTML = frames.map((r, f) => `<div class="fr ${f === frameNo && state === "play" ? "on" : ""}"><div class="mk">${marks(f).map((m) => `<i>${m}</i>`).join("")}</div><b>${sc[f] !== undefined ? sc[f] : ""}</b></div>`).join("");
  }
  function hud() { $("total").textContent = total; $("frame").textContent = Math.min(10, frameNo + 1); }

  // ---------- throwing ----------
  const cv = $("game");
  const laneX = (sx) => Math.max(-LANE / 2 + BR, Math.min(LANE / 2 - BR, (sx - W / 2) / P(0, 0, 0).s));
  cv.addEventListener("pointerdown", (e) => { if (state !== "play" || ball) return; PUB.ctx(); const p = view.point(e); drag = { pts: [{ ...p, t: performance.now() }] }; aimX = laneX(p.x); cv.setPointerCapture(e.pointerId); });
  cv.addEventListener("pointermove", (e) => { if (!drag) return; const p = view.point(e); drag.pts.push({ ...p, t: performance.now() }); if (drag.pts.length > 30) drag.pts.shift(); if (p.y > 470) aimX = laneX(p.x); });
  cv.addEventListener("pointerup", () => {
    if (!drag) return; const pts = drag.pts; drag = null; if (pts.length < 3) return;
    const a = pts.find((q) => pts[pts.length - 1].t - q.t < 220) || pts[0], b = pts[pts.length - 1], dy = a.y - b.y, dx = b.x - a.x, dt = Math.max(30, b.t - a.t);
    if (dy < 40) { toast("SWIPE UP TO BOWL", 900); return; }
    const speed = Math.max(4.5, Math.min(10.5, (dy / dt) * 7.5)), ang = Math.max(-0.09, Math.min(0.09, Math.atan2(dx, dy) * 0.35));
    // hook: how the swipe curved at the end
    const mid = pts[Math.floor(pts.length / 2)], hook = Math.max(-1, Math.min(1, ((b.x - mid.x) - (mid.x - pts[0].x)) / 60));
    ball = { x: aimX, z: 0.2, vx: Math.sin(ang) * speed, vz: Math.cos(ang) * speed, hook: hook * 0.9, gutter: false, spin: 0 };
    hint = false; noise(1.4, 0.05, 160, 0, 0.5); beep(110, 90, 1.2, "sine", 0.05);
  });

  // ---------- physics ----------
  function hitPins(a, ra, ma) {
    for (const p of pins) { if (p.gone) continue; const dx = p.x - a.x, dz = p.z - a.z, d = Math.hypot(dx, dz), min = ra + PR; if (d >= min || d === 0) continue;
      const nx = dx / d, nz = dz / d, ov = min - d, mp = 1, tot = ma + mp; a.x -= nx * ov * (mp / tot); a.z -= nz * ov * (mp / tot); p.x += nx * ov * (ma / tot); p.z += nz * ov * (ma / tot);
      const rv = (p.vx - a.vx) * nx + (p.vz - a.vz) * nz; if (rv < 0) { const j = -(1.6) * rv / (1 / ma + 1 / mp); a.vx -= (j / ma) * nx; a.vz -= (j / ma) * nz; p.vx += (j / mp) * nx; p.vz += (j / mp) * nz; }
      if (!p.down && Math.hypot(p.vx, p.vz) > 0.35) knock(p); }
  }
  function knock(p) { p.down = true; p.fa = Math.atan2(p.vx, p.vz); const s = P(p.x, 0.2, p.z); FX.burst(s.x, s.y, "#FFB627", 5, 60, 2); setTimeout(() => smash(), Math.random() * 60); }
  function physics(dt) {
    const n = 8, h = dt / n;
    for (let k = 0; k < n; k++) {
      if (ball) {
        ball.z += ball.vz * h; ball.x += ball.vx * h; ball.spin += ball.vz * h / BR;
        if (!ball.gutter) { if (ball.z > LEN * 0.55) ball.vx += ball.hook * 2.6 * h; if (Math.abs(ball.x) > LANE / 2 - 0.02) { ball.gutter = true; ball.x = Math.sign(ball.x) * (LANE / 2 + 0.09); ball.vx = 0; toast("GUTTER BALL!", 900); beep(200, 80, 0.4, "sawtooth", 0.05); } }
        if (!ball.gutter) hitPins(ball, BR, 7);
        if (ball.z > LEN + 0.9) ball = null;
      }
      for (const p of pins) { if (p.gone) continue; p.x += p.vx * h; p.z += p.vz * h; p.vx *= 1 - 2.2 * h; p.vz *= 1 - 2.2 * h; if (Math.abs(p.x) > LANE / 2 + 0.12 || p.z > LEN + 0.6) { p.gone = true; if (!p.down) knock(p); } }
      for (const p of pins) if (!p.gone && Math.hypot(p.vx, p.vz) > 0.25) hitPins(p, PR, 1);
    }
    for (const p of pins) if (p.down && p.fall < 1) p.fall = Math.min(1, p.fall + dt * 4);
  }
  function settle() {
    const before = standing, knocked = pins.filter((p) => p.down).length;
    frames[frameNo].push(knocked); standing = before - knocked;
    const f = frames[frameNo], ten = frameNo === 9;
    if (knocked === before && rollNo === 0 && before === 10) { toast("STRIKE!", 1300); cheer(true); FX.text(W / 2, 260, "X", "#FFB627", 60); }
    else if (standing === 0) { toast("SPARE!", 1100); cheer(false); }
    else if (knocked === 0) toast(["Oh dear.", "Not a sausage.", "Wide of the mark."][Math.floor(Math.random() * 3)], 900);
    else beep(500, 700, 0.12, "triangle", 0.05);
    let next = false, reset = false;
    if (!ten) { if (rollNo === 0 && knocked === 10) next = true; else if (rollNo === 1) next = true; }
    else { const sum2 = f[0] + (f[1] || 0); if (f.length === 3 || (f.length === 2 && sum2 < 10)) { return finish(); } if (standing === 0) reset = true; }
    if (next) { frameNo++; rollNo = 0; standing = 10; rack(true); if (frameNo < 10) toast("FRAME " + (frameNo + 1), 800); }
    else { rollNo++; if (reset) { standing = 10; rack(true); } else rack(false); }
    sheet(); hud();
  }
  function finish() {
    state = "over"; sheet(); hud(); const sc = scoreFrames(), tot = sc[9] || 0; const b = best("bowlBest", tot); PUB.submit("bowling", tot);
    tot >= 200 ? (fanfare(), cheer(true)) : tot >= 120 ? cheer(false) : sad();
    $("oScore").textContent = tot; $("oBest").textContent = b; $("oSub").textContent = tot === 300 ? "A PERFECT GAME. Drinks are on you." : tot >= 200 ? "Proper bowler, you." : tot >= 120 ? "Solid night at the lanes." : "More practice, fewer pints."; $("shareMsg").hidden = true;
    setTimeout(() => show("over"), 1200);
  }

  // ---------- drawing ----------
  function quad(a, b, c, d, fill) { g.fillStyle = fill; g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.lineTo(c.x, c.y); g.lineTo(d.x, d.y); g.closePath(); g.fill(); }
  function bottle(p) {
    if (p.z - camZ < 0.6) return;
    const s = P(p.x, 0, p.z), k = s.s, hgt = 0.46, w = 0.095;
    g.save(); g.translate(s.x, s.y);
    if (p.down) { const side = Math.sin(p.fa) >= 0 ? 1 : -1; g.rotate(side * p.fall * 1.45); }
    g.fillStyle = "rgba(0,0,0,.3)"; g.beginPath(); g.ellipse(0, 0, w * k * 0.9, w * k * 0.3, 0, 0, 7); g.fill();
    const bw = w * k, bh = hgt * k;
    const gr = g.createLinearGradient(-bw / 2, 0, bw / 2, 0); gr.addColorStop(0, p.col); gr.addColorStop(0.35, "#FFFFFF66"); gr.addColorStop(0.5, p.col); gr.addColorStop(1, "#00000088");
    g.fillStyle = gr; g.beginPath(); g.moveTo(-bw / 2, 0); g.lineTo(-bw / 2, -bh * 0.55); g.quadraticCurveTo(-bw / 2, -bh * 0.7, -bw * 0.18, -bh * 0.78); g.lineTo(-bw * 0.18, -bh); g.lineTo(bw * 0.18, -bh); g.lineTo(bw * 0.18, -bh * 0.78); g.quadraticCurveTo(bw / 2, -bh * 0.7, bw / 2, -bh * 0.55); g.lineTo(bw / 2, 0); g.closePath(); g.fill();
    g.fillStyle = "#F2E2B6"; g.fillRect(-bw / 2, -bh * 0.45, bw, bh * 0.2); g.fillStyle = "#D02040"; g.fillRect(-bw / 2, -bh * 0.4, bw, bh * 0.06);
    g.fillStyle = "#C8CCD8"; g.fillRect(-bw * 0.2, -bh - bh * 0.04, bw * 0.4, bh * 0.05);
    g.restore();
  }
  function drawBall(b) {
    if (b.z - camZ < 0.6) return;
    const y = b.gutter ? -0.06 : 0, s = P(b.x, y + BR, b.z), r = BR * s.s;
    g.fillStyle = "rgba(0,0,0,.35)"; const sh = P(b.x, y, b.z); g.beginPath(); g.ellipse(sh.x, sh.y, r * 0.9, r * 0.3, 0, 0, 7); g.fill();
    const gr = g.createRadialGradient(s.x - r * 0.35, s.y - r * 0.4, r * 0.1, s.x, s.y, r); gr.addColorStop(0, "#FF8AA8"); gr.addColorStop(0.3, "#C8143A"); gr.addColorStop(1, "#3A0414"); g.fillStyle = gr; g.beginPath(); g.arc(s.x, s.y, r, 0, 7); g.fill();
    g.fillStyle = "#1A0008"; for (const a of [0, 0.5, 1]) { const ang = b.spin + a; g.beginPath(); g.arc(s.x + Math.cos(ang) * r * 0.35, s.y - r * 0.3 + Math.sin(ang) * r * 0.15, r * 0.09, 0, 7); g.fill(); }
  }
  function draw(dt) {
    const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, "#120A24"); bg.addColorStop(1, "#2A1606"); g.fillStyle = bg; g.fillRect(0, 0, W, H);
    // back wall with neon
    g.fillStyle = "#1A1236"; g.fillRect(0, 0, W, HOR + 6); g.save(); g.shadowColor = "#3DE0FF"; g.shadowBlur = 14; g.strokeStyle = "#3DE0FF"; g.lineWidth = 2.5; rr(g, 95, 108, 170, 40, 10); g.stroke(); g.fillStyle = "#3DE0FF"; g.font = "16px Bungee, Impact, sans-serif"; g.textAlign = "center"; g.fillText("LAST ORDERS", 180, 126); g.font = "10px Bungee, Impact, sans-serif"; g.fillStyle = "#FF3D7F"; g.fillText("BOTTLE BOWLING", 180, 141); g.restore();
    // gutters + lane
    quad(P(-LANE / 2 - 0.24, 0, LEN + 1), P(LANE / 2 + 0.24, 0, LEN + 1), P(LANE / 2 + 0.24, 0, camZ + 0.4), P(-LANE / 2 - 0.24, 0, camZ + 0.4), "#14121E");
    quad(P(-LANE / 2, 0, LEN + 1), P(LANE / 2, 0, LEN + 1), P(LANE / 2, 0, camZ + 0.4), P(-LANE / 2, 0, camZ + 0.4), "#C8925A");
    for (let i = 1; i < 12; i++) { const x = -LANE / 2 + (LANE / 12) * i; const a = P(x, 0, LEN + 1), b = P(x, 0, camZ + 0.4); g.strokeStyle = i % 2 ? "rgba(90,50,20,.25)" : "rgba(255,230,190,.15)"; g.lineWidth = 1; g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke(); }
    const shine = g.createLinearGradient(0, HOR, 0, H); shine.addColorStop(0, "rgba(255,255,255,0)"); shine.addColorStop(0.7, "rgba(255,240,210,.12)"); shine.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = shine; g.fillRect(0, HOR, W, H);
    // arrows + foul line
    for (let i = -2; i <= 2; i++) { const s = P(i * 0.16, 0, 4.6 + Math.abs(i) * 0.3); g.fillStyle = "#5A2A0A"; g.beginPath(); g.moveTo(s.x, s.y - 6); g.lineTo(s.x - 4, s.y + 3); g.lineTo(s.x + 4, s.y + 3); g.fill(); }
    const f1 = P(-LANE / 2, 0, 0), f2 = P(LANE / 2, 0, 0); g.strokeStyle = "#3A1A0A"; g.lineWidth = 3; g.beginPath(); g.moveTo(f1.x, f1.y); g.lineTo(f2.x, f2.y); g.stroke();
    // pin deck shadow + pins (far to near)
    const list = pins.filter((p) => !p.gone || p.down).slice().sort((a, b) => b.z - a.z);
    for (const p of list) if (p.z > (ball ? ball.z : -9)) bottle(p);
    if (ball) drawBall(ball);
    for (const p of list) if (ball && p.z <= ball.z) bottle(p);
    // aim marker
    if (state === "play" && !ball && camZ < -1.5) { const s = P(aimX, BR, 0.2); const r = BR * s.s; const gr = g.createRadialGradient(s.x - r * 0.35, s.y - r * 0.4, r * 0.1, s.x, s.y, r); gr.addColorStop(0, "#FF8AA8"); gr.addColorStop(0.3, "#C8143A"); gr.addColorStop(1, "#3A0414"); g.fillStyle = gr; g.beginPath(); g.arc(s.x, s.y, r, 0, 7); g.fill();
      if (hint) { g.fillStyle = "rgba(255,246,224,.85)"; g.font = "bold 13px Inter, Arial"; g.textAlign = "center"; g.fillText("Drag sideways to line up, swipe up to bowl", W / 2, 470); g.fillText("Curve the end of your swipe to hook it", W / 2, 488); } }
    FX.step(dt); FX.draw(g);
  }
  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.033, (now - last) / 1000); last = now; t += dt;
    if (state === "play") { const was = !!ball; physics(dt); if (was && !ball) settleT = 1.1; if (!ball && settleT > 0) { settleT -= dt; if (settleT <= 0 && !pins.some((p) => !p.gone && Math.hypot(p.vx, p.vz) > 0.05)) settle(); else if (settleT <= 0) settleT = 0.2; } }
    const want = ball && !ball.gutter ? Math.min(ball.z - 3.2, LEN - 5.4) : ball ? Math.min(ball.z - 3.2, LEN - 5.4) : (settleT > 0 ? camZ : -2.3); camZ += (Math.max(-2.3, want) - camZ) * Math.min(1, dt * (ball ? 6 : 2.5));
    draw(dt); requestAnimationFrame(loop);
  }
  $("go").addEventListener("click", start); $("again").addEventListener("click", start);
  $("share").addEventListener("click", () => share(`I bowled ${total} at Bottle Bowling 🎳🍺 Beat that.`, $("shareMsg")));
  wireMute(); rack(true); frames = Array.from({ length: 10 }, () => []); sheet();
  gate(() => show("start"));
  requestAnimationFrame(loop);
})();
