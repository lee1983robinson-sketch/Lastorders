// Pint Stacker: tap to drop glasses onto the tray and build the tallest tower. World 360 x 640.
(() => {
  "use strict";
  const { $, store, REDUCED, pop, thud, smash, cheer, fanfare, sad, beep, music, wireMute, fit, show, gate, toast, share, best, rr, particles } = PUB;
  const W = 360, H = 640, BASE_Y = 560;
  let g = null, view = null; fit($("game"), W, H, (o) => { view = o; g = o.g; });
  const FX = particles();
  const KINDS = [
    { n: "pint", w: 50, h: 64, col: "#FFB627" }, { n: "half", w: 42, h: 46, col: "#FFB627" }, { n: "wine", w: 44, h: 60, col: "#9B1B3E" },
    { n: "stout", w: 52, h: 66, col: "#1B0F0B" }, { n: "shot", w: 30, h: 28, col: "#E89A2E" }, { n: "tankard", w: 58, h: 60, col: "#FFB627" },
  ];
  let state = "menu", stack = [], mover = null, falling = null, score = 0, perfect = 0, t = 0, cam = 0, camT = 0, lean = 0, topple = null;
  function nextKind() { const pool = score < 5 ? [0, 1, 5] : score < 12 ? [0, 1, 2, 3, 5] : [0, 1, 2, 3, 4, 5]; return KINDS[pool[Math.floor(Math.random() * pool.length)]]; }
  function top() { return stack[stack.length - 1]; }
  function spawnMover() { const k = nextKind(), y = top().y - top().h - 120; mover = { ...k, x: 60, y, dir: 1, speed: Math.min(120 + score * 9, 330) }; }
  function start() {
    stack = [{ n: "tray", w: 150, h: 10, x: W / 2, y: BASE_Y, col: "#C8CCD8" }]; score = 0; perfect = 0; cam = 0; camT = 0; lean = 0; topple = null; falling = null; state = "play"; show(null); hud(); spawnMover();
    music([[45, 48, 52], [41, 45, 48], [43, 47, 50], [45, 48, 52]], [69, 0, 72, 0, 76, 0, 74, 72, 71, 0, 72, 0, 74, 0, 0, 0, 72, 0, 74, 0, 76, 79, 77, 76, 74, 0, 72, 0, 69, 0, 0, 0], 116);
  }
  function hud() { $("score").textContent = score; $("best").textContent = Math.max(score, best("stackBest")); }
  function drop() { if (state !== "play" || !mover || falling) return; PUB.ctx(); falling = { ...mover, vy: 0 }; mover = null; beep(600, 300, 0.08, "sine", 0.04); }
  function land() {
    const f = falling, tp = top(); falling = null; let off = f.x - tp.x;
    if (Math.abs(off) > (tp.w / 2 + f.w / 2) * 0.62) { f.y = tp.y - tp.h; return fallOff(f, off); }
    if (Math.abs(off) < 4) { off = 0; f.x = tp.x; perfect++; FX.ring(f.x, f.y - f.h / 2 - cam, "#FFF6E0", 60); FX.burst(f.x, tp.y - tp.h - cam, "#FFB627", 14, 160, 3); toast(perfect >= 3 ? "PERFECT ×" + perfect + "!" : "PERFECT!", 800); beep(880 + perfect * 80, 1320 + perfect * 80, 0.12, "triangle", 0.06); score += perfect >= 3 ? 2 : 1; }
    else { perfect = 0; thud(); }
    f.y = tp.y - tp.h; stack.push(f); score++; hud();
    if (score % 10 === 0) { fanfare(); toast(score + " HIGH!", 1100); }
    // balance: for each level, the weight above it must sit over it
    for (let i = 0; i < stack.length - 1; i++) {
      const above = stack.slice(i + 1); let m = 0, cx = 0; for (const s of above) { const mass = s.w * s.h; m += mass; cx += s.x * mass; } cx /= m;
      if (Math.abs(cx - stack[i].x) > stack[i].w / 2 + 2) return toppleFrom(i + 1, Math.sign(cx - stack[i].x));
    }
    lean = 0; for (let i = 1; i < stack.length; i++) lean += (stack[i].x - stack[i - 1].x) / 600;
    camT = Math.max(0, (BASE_Y - top().y) - 260); spawnMover();
  }
  function fallOff(f, off) { topple = { items: [{ ...f, vx: Math.sign(off) * 120, vy: -60, a: 0, va: Math.sign(off) * 4 }] }; over("It slid right off!"); }
  function toppleFrom(i, dir) { topple = { items: stack.splice(i).map((s, k) => ({ ...s, vx: dir * (80 + k * 20), vy: -40 - k * 10, a: 0, va: dir * (2 + k * 0.3) })) }; over("TIMBER! The lot's gone over."); }
  function over(msg) { state = "over"; smash(); setTimeout(smash, 250); sad(); const b = best("stackBest", score); setTimeout(() => { $("oScore").textContent = score; $("oBest").textContent = b; $("oSub").textContent = msg; $("shareMsg").hidden = true; show("over"); }, 1300); }
  function update(dt) {
    t += dt; cam += (camT - cam) * Math.min(1, dt * 4);
    if (mover) { mover.x += mover.dir * mover.speed * dt; if (mover.x > W - mover.w / 2 - 8) { mover.x = W - mover.w / 2 - 8; mover.dir = -1; } if (mover.x < mover.w / 2 + 8) { mover.x = mover.w / 2 + 8; mover.dir = 1; } }
    if (falling) { falling.vy += 1800 * dt; falling.y += falling.vy * dt; if (falling.y >= top().y - top().h) land(); }
    if (topple) for (const it of topple.items) { it.vy += 1400 * dt; it.x += it.vx * dt; it.y += it.vy * dt; it.a += it.va * dt; if (!it.splashed && it.y > BASE_Y + 60) { it.splashed = true; FX.burst(it.x, BASE_Y + 40 - cam, "#CFE7F2", 14, 200, 2.5); } }
  }
  // ---------- drawing ----------
  function glass(k, x, y, a = 0) { // x, y = bottom centre in world, already camera-adjusted
    g.save(); g.translate(x, y); g.rotate(a); const w = k.w, h = k.h;
    if (k.n === "tray") { const tg = g.createLinearGradient(0, -h, 0, 0); tg.addColorStop(0, "#F0F2F8"); tg.addColorStop(1, "#8A90A2"); g.fillStyle = tg; rr(g, -w / 2, -h, w, h, 5); g.fill(); g.restore(); return; }
    if (k.n === "wine") { g.fillStyle = "rgba(220,235,255,.55)"; g.fillRect(-2, -h * 0.42, 4, h * 0.42); g.beginPath(); g.ellipse(0, -2, w * 0.34, 3.5, 0, 0, 7); g.fill();
      g.fillStyle = "rgba(220,235,255,.25)"; g.beginPath(); g.moveTo(-w / 2, -h); g.lineTo(w / 2, -h); g.quadraticCurveTo(w / 2 + 2, -h * 0.4, 0, -h * 0.42); g.quadraticCurveTo(-w / 2 - 2, -h * 0.4, -w / 2, -h); g.fill();
      g.fillStyle = k.col; g.beginPath(); g.moveTo(-w / 2 + 2, -h * 0.75); g.lineTo(w / 2 - 2, -h * 0.75); g.quadraticCurveTo(w / 2, -h * 0.42, 0, -h * 0.44); g.quadraticCurveTo(-w / 2, -h * 0.42, -w / 2 + 2, -h * 0.75); g.fill(); }
    else {
      const tw = w, bw = k.n === "shot" ? w * 0.8 : w * 0.82;
      g.fillStyle = "rgba(220,235,255,.25)"; g.beginPath(); g.moveTo(-tw / 2, -h); g.lineTo(tw / 2, -h); g.lineTo(bw / 2, 0); g.lineTo(-bw / 2, 0); g.closePath(); g.fill();
      const fillTop = k.n === "shot" ? -h * 0.7 : k.n === "stout" ? -h * 0.86 : -h * 0.8;
      g.fillStyle = k.col; g.beginPath(); g.moveTo(-tw / 2 + 2 + (tw - bw) / 2 * (1 + fillTop / h), fillTop); g.lineTo(tw / 2 - 2 - (tw - bw) / 2 * (1 + fillTop / h), fillTop); g.lineTo(bw / 2 - 2, -2); g.lineTo(-bw / 2 + 2, -2); g.closePath(); g.fill();
      if (k.n !== "shot") { g.fillStyle = k.n === "stout" ? "#F3E6C8" : "#FFF6E0"; rr(g, -tw / 2 + 2, -h - 2, tw - 4, (k.n === "stout" ? h * 0.16 : h * 0.22), 5); g.fill(); }
      if (k.n === "tankard") { g.strokeStyle = "rgba(220,235,255,.55)"; g.lineWidth = 5; g.beginPath(); g.arc(w / 2 + 6, -h * 0.5, h * 0.22, -1.4, 1.4); g.stroke(); }
      g.fillStyle = "rgba(255,255,255,.4)"; g.fillRect(-tw / 2 + 5, -h * 0.85, 3, h * 0.7);
    }
    g.strokeStyle = "rgba(255,255,255,.55)"; g.lineWidth = 1.2; g.beginPath(); g.moveTo(-w / 2, -h); g.lineTo(w / 2, -h); g.stroke();
    g.restore();
  }
  function draw(dt) {
    const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, "#1B1240"); bg.addColorStop(1, "#2A160E"); g.fillStyle = bg; g.fillRect(0, 0, W, H);
    // height markers
    g.fillStyle = "rgba(255,246,224,.12)"; g.font = "bold 11px Inter, Arial"; g.textAlign = "left";
    for (let m = 0; m < 400; m += 5) { const y = BASE_Y - m * 52 + cam; if (y < -20 || y > H) continue; g.fillRect(0, y, 18, 1.5); if (m) g.fillText(m, 22, y + 4); }
    // bar counter
    const by = BASE_Y + cam; const bar = g.createLinearGradient(0, by, 0, H); bar.addColorStop(0, "#9A6438"); bar.addColorStop(0.08, "#6A3E1E"); bar.addColorStop(1, "#2A160C"); g.fillStyle = bar; g.fillRect(0, by, W, H - by + 40);
    g.save(); const sway = REDUCED || state !== "play" ? 0 : Math.sin(t * 2) * lean * 0.6;
    g.translate(W / 2, by); g.rotate(sway); g.translate(-W / 2, -by);
    for (const s of stack) glass(s, s.x, s.y + cam);
    g.restore();
    if (falling) glass(falling, falling.x, falling.y + cam);
    if (mover) { glass(mover, mover.x, mover.y + cam); g.strokeStyle = "rgba(255,246,224,.15)"; g.setLineDash([3, 6]); g.beginPath(); g.moveTo(mover.x, mover.y + cam + 4); g.lineTo(mover.x, top().y - top().h + cam); g.stroke(); g.setLineDash([]); }
    if (topple) for (const it of topple.items) glass(it, it.x, it.y + cam, it.a);
    FX.step(dt); FX.draw(g);
  }
  let last = performance.now();
  function loop(now) { const dt = Math.min(0.033, (now - last) / 1000); last = now; update(dt); draw(dt); requestAnimationFrame(loop); }
  $("game").addEventListener("pointerdown", drop);
  addEventListener("keydown", (e) => { if (e.code === "Space") { e.preventDefault(); drop(); } });
  $("go").addEventListener("click", start); $("again").addEventListener("click", start);
  $("share").addEventListener("click", () => share(`I stacked ${score} drinks on Pint Stacker 🍺🍺🍺 Beat that.`, $("shareMsg")));
  wireMute(); stack = [{ n: "tray", w: 150, h: 10, x: W / 2, y: BASE_Y, col: "#C8CCD8" }]; hud();
  gate(() => show("start"));
  requestAnimationFrame(loop);
})();
