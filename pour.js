// Perfect Pour: hold to pour, let go on the line. Ten pours a shift. World 360 x 640.
(() => {
  "use strict";
  const { $, store, REDUCED, pop, thud, smash, cheer, fanfare, sad, burp, beep, noise, music, wireMute, fit, show, gate, toast, share, best, rr, shade, particles } = PUB;
  const W = 360, H = 640, GX = 180, GBOT = 520;
  let g = null, view = null; fit($("game"), W, H, (o) => { view = o; g = o.g; });
  const FX = particles();
  // h = glass height px, tw/bw = top/bottom width, target = fill line (0-1 of height), head = [min,max] foam wanted
  const GLASSES = [
    { n: "Pint of lager", h: 230, tw: 104, bw: 78, target: 0.93, head: [0.04, 0.11], col: "#FFB627", foamy: 1, tap: "LAGER" },
    { n: "Half of bitter", h: 160, tw: 86, bw: 66, target: 0.92, head: [0.03, 0.1], col: "#C8781E", foamy: 0.8, tap: "BITTER" },
    { n: "Glass of red", h: 170, tw: 92, bw: 92, target: 0.5, head: [0, 0.02], col: "#8A1A3A", foamy: 0, tap: "WINE", wine: true },
    { n: "Pint of stout", h: 236, tw: 100, bw: 76, target: 0.94, head: [0.06, 0.13], col: "#1E120C", foamy: 2.2, tap: "STOUT", stout: true },
    { n: "Pint of cider", h: 230, tw: 104, bw: 78, target: 0.93, head: [0.0, 0.05], col: "#F2C24A", foamy: 0.35, tap: "CIDER" },
    { n: "A shot", h: 64, tw: 50, bw: 42, target: 0.9, head: [0, 0.03], col: "#E89A2E", foamy: 0, tap: "SHOT", shot: true },
  ];
  let state = "menu", round = 0, total = 0, gl = null, liquid = 0, foam = 0, pouring = false, holdT = 0, settleT = 0, scored = false, t = 0, spill = 0, order = [], results = [];
  function startShift() { round = 0; total = 0; results = []; order = []; for (let i = 0; i < 10; i++) order.push(i < 2 ? 0 : Math.floor(Math.random() * GLASSES.length)); next(); state = "play"; show(null); music([[48, 52, 55], [53, 57, 60], [55, 59, 62], [48, 52, 55]], [79, 0, 76, 0, 72, 0, 76, 79, 81, 0, 79, 0, 76, 0, 0, 0, 77, 0, 74, 0, 71, 0, 74, 77, 79, 0, 77, 0, 72, 0, 0, 0], 100); }
  function next() { gl = GLASSES[order[round]]; liquid = 0; foam = 0; pouring = false; holdT = 0; settleT = 0; scored = false; spill = 0; hud(); toast((round + 1) + ". " + gl.n.toUpperCase(), 1100); }
  function hud() { $("round").textContent = Math.min(10, round + 1) + "/10"; $("total").textContent = total; }
  const cv = $("game");
  function down(e) { if (state !== "play" || scored) return; PUB.ctx(); pouring = true; holdT = 0; }
  function up() { if (!pouring) return; pouring = false; settleT = gl.stout ? 2.4 : 1.4; }
  cv.addEventListener("pointerdown", down); addEventListener("pointerup", up); addEventListener("pointercancel", up);
  addEventListener("keydown", (e) => { if (e.code === "Space" && !e.repeat) { e.preventDefault(); down(e); } }); addEventListener("keyup", (e) => { if (e.code === "Space") up(); });

  let pourSound = 0;
  function update(dt) {
    if (state !== "play" || !gl) return;
    const cap = 1.12;
    if (pouring) {
      holdT += dt; const rate = (gl.shot ? 0.28 : gl.wine ? 0.24 : 0.2) * Math.min(2.3, 1 + holdT * 0.85); // speeds up the longer you hold
      const f = gl.foamy * (0.18 + rate * 0.9); liquid += rate * dt * (1 - Math.min(0.8, f * 0.5)); foam += rate * dt * f * 0.55;
      pourSound -= dt; if (pourSound <= 0) { pourSound = 0.12; noise(0.14, 0.03 + Math.min(0.05, rate * 0.06), 700 + rate * 600); }
      if (liquid + foam > 1.0) { spill += (liquid + foam - 1.0); const ex = liquid + foam - 1.0; foam = Math.max(0, foam - ex); if (foam <= 0) liquid = Math.min(1.0, liquid); if (Math.random() < 0.5) FX.burst(GX + (Math.random() - 0.5) * gl.tw, GBOT - gl.h, gl.wine ? gl.col : "#FFF6E0", 1, 80, 2.5); }
    } else if (liquid > 0) {
      // the head settles: some foam turns back into drink
      const k = gl.stout ? 0.55 : 0.9; const conv = foam * k * dt; foam -= conv; liquid += conv * 0.55;
      if (settleT > 0) { settleT -= dt; if (settleT <= 0 && !scored) score(); }
    }
  }
  function score() {
    scored = true; const lvl = liquid + foam, head = foam, tgt = gl.target;
    let pts = Math.max(0, Math.round(100 - Math.abs(lvl - tgt) * 1400)); let note = "";
    if (spill > 0.02) { pts = Math.max(0, pts - 60); note = "Spilt it! Mop that up."; }
    if (gl.head[1] > 0.03) { if (head < gl.head[0]) { pts -= 25; note = note || "Flat as a pancake. Needs a head."; } else if (head > gl.head[1] + 0.04) { pts -= 30; note = note || "All froth, no pint."; } }
    pts = Math.max(0, Math.min(100, pts)); if (pts >= 95 && spill < 0.01) { pts = 120; note = "PERFECT POUR!"; }
    if (!note) note = pts >= 80 ? "Lovely pour, that." : pts >= 50 ? "Bit off. The landlord's watching." : lvl < tgt ? "Short measure! Top it up next time." : "Over the line.";
    total += pts; results.push(pts); hud();
    toast(`${pts >= 120 ? "PERFECT!" : "+" + pts}<br><span style="font:600 14px Inter,sans-serif">${note}</span>`, 1500);
    pts >= 120 ? (fanfare(), FX.burst(GX, GBOT - gl.h * tgt, "#FFB627", 26, 200, 3.5)) : pts >= 80 ? beep(880, 1320, 0.15, "triangle", 0.06) : pts > 0 ? beep(440, 330, 0.2, "triangle", 0.05) : beep(200, 100, 0.4, "sawtooth", 0.05);
    setTimeout(() => { round++; if (round >= 10) finish(); else next(); }, 1700);
  }
  function finish() {
    state = "over"; const b = best("pourBest", total); PUB.submit("pour", total); total >= 900 ? (fanfare(), cheer(true)) : total >= 600 ? cheer(false) : sad();
    $("oScore").textContent = total; $("oBest").textContent = b; $("oPerfect").textContent = results.filter((p) => p >= 120).length; $("oSub").textContent = total >= 1000 ? "Barman of the year." : total >= 750 ? "You can work my bar any day." : total >= 450 ? "Getting there. Watch the head." : "Stick to drinking them."; $("shareMsg").hidden = true;
    setTimeout(() => show("over"), 600);
  }

  // ---------- drawing ----------
  function glassPath(h, tw, bw, x = GX, y = GBOT) { g.beginPath(); g.moveTo(x - tw / 2, y - h); g.lineTo(x + tw / 2, y - h); g.lineTo(x + bw / 2, y - 6); g.quadraticCurveTo(x + bw / 2, y, x + bw / 2 - 6, y); g.lineTo(x - bw / 2 + 6, y); g.quadraticCurveTo(x - bw / 2, y, x - bw / 2, y - 6); g.closePath(); }
  function wineGlass() {
    const y0 = GBOT, bowlH = gl.h * 0.62, stemH = gl.h * 0.38, top = y0 - gl.h;
    g.fillStyle = "rgba(220,240,255,.5)"; g.fillRect(GX - 2, y0 - stemH, 4, stemH); g.beginPath(); g.ellipse(GX, y0, 34, 6, 0, 0, 7); g.fill();
    g.save(); g.beginPath(); g.moveTo(GX - gl.tw / 2, top); g.lineTo(GX + gl.tw / 2, top); g.quadraticCurveTo(GX + gl.tw / 2 + 8, y0 - stemH - 10, GX, y0 - stemH); g.quadraticCurveTo(GX - gl.tw / 2 - 8, y0 - stemH - 10, GX - gl.tw / 2, top); g.closePath();
    g.fillStyle = "rgba(200,230,255,.08)"; g.fill(); g.strokeStyle = "rgba(220,240,255,.7)"; g.lineWidth = 2; g.stroke(); g.clip();
    const ly = y0 - stemH - (bowlH) * Math.min(1.1, liquid / 1) * 1.0; g.fillStyle = gl.col; g.fillRect(GX - 80, ly, 160, 400); g.fillStyle = "rgba(255,255,255,.18)"; g.fillRect(GX - 80, ly, 160, 2);
    g.restore();
    return { top: y0 - stemH - bowlH, fillH: bowlH, base: y0 - stemH };
  }
  function draw(dt) {
    const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, "#24142E"); bg.addColorStop(1, "#140A06"); g.fillStyle = bg; g.fillRect(0, 0, W, H);
    // back bar mirror + bottles
    g.fillStyle = "#2E1A3E"; rr(g, 16, 70, W - 32, 140, 10); g.fill(); for (let i = 0; i < 12; i++) { const x = 30 + i * 26, h = 30 + (i * 13) % 26; g.fillStyle = ["#3DAA5A", "#A86A2A", "#2E6ABA", "#C83A4A", "#E8E8E8", "#7A3AA8"][i % 6]; g.globalAlpha = 0.6; rr(g, x, 196 - h, 14, h, 3); g.fill(); g.fillRect(x + 5, 188 - h, 4, 9); g.globalAlpha = 1; }
    // bar top
    const bar = g.createLinearGradient(0, GBOT, 0, H); bar.addColorStop(0, "#9A6438"); bar.addColorStop(0.1, "#6A3E1E"); bar.addColorStop(1, "#2A160C"); g.fillStyle = bar; g.fillRect(0, GBOT, W, H);
    g.fillStyle = "#2A1A10"; rr(g, GX - 70, GBOT - 2, 140, 10, 4); g.fill(); g.fillStyle = "#3A3A44"; for (let i = 0; i < 9; i++) g.fillRect(GX - 64 + i * 15, GBOT, 9, 6);
    if (!gl) return;
    // the tap
    const tapY = GBOT - gl.h - 70, pull = pouring ? 1 : 0;
    g.fillStyle = "#C8A050"; rr(g, GX - 7, tapY - 46, 14, 50, 4); g.fill(); g.fillStyle = "#8A6A2A"; rr(g, GX - 22, tapY - 54, 44, 12, 5); g.fill();
    g.save(); g.translate(GX, tapY - 54); g.rotate(-0.15 + pull * 0.55); g.fillStyle = "#1A1A1A"; rr(g, -8, -58, 16, 58, 6); g.fill(); g.fillStyle = gl.col === "#1E120C" ? "#F3E6C8" : gl.col; rr(g, -11, -64, 22, 24, 6); g.fill(); g.fillStyle = "#1A0E00"; g.font = "bold 7px Inter, Arial"; g.textAlign = "center"; g.fillText(gl.tap, 0, -49); g.restore();
    g.fillStyle = "#C8A050"; rr(g, GX - 4, tapY, 8, 14, 3); g.fill();
    // stream
    if (pouring) { const w = 3 + Math.min(4, holdT * 3), surf = gl.wine ? GBOT - gl.h * 0.38 - gl.h * 0.62 * liquid : GBOT - gl.h * (liquid + foam); g.fillStyle = gl.col; g.globalAlpha = 0.85; g.fillRect(GX - w / 2, tapY + 12, w, Math.max(0, surf - tapY - 12)); g.globalAlpha = 1; }
    // the glass
    let fillTop, fillH, base;
    if (gl.wine) { const w_ = wineGlass(); fillTop = w_.top; fillH = w_.fillH; base = w_.base; }
    else {
      base = GBOT; fillH = gl.h; fillTop = GBOT - gl.h; glassPath(gl.h, gl.tw, gl.bw); g.fillStyle = "rgba(200,230,255,.07)"; g.fill();
      g.save(); glassPath(gl.h, gl.tw, gl.bw); g.clip();
      const ly = GBOT - gl.h * liquid, fy = ly - gl.h * foam;
      const lg = g.createLinearGradient(GX - gl.tw / 2, 0, GX + gl.tw / 2, 0); lg.addColorStop(0, shade(gl.col, -0.3)); lg.addColorStop(0.45, shade(gl.col, gl.stout ? 0.08 : 0.2)); lg.addColorStop(1, shade(gl.col, -0.35)); g.fillStyle = lg; g.fillRect(GX - 80, ly, 160, 300);
      if (gl.stout && (pouring || foam > 0.05)) { g.fillStyle = "rgba(200,170,130,.25)"; for (let i = 0; i < 18; i++) { const yy = ly + ((t * 60 + i * 23) % Math.max(1, GBOT - ly)); g.fillRect(GX - gl.tw / 2 + (i * 17) % gl.tw, yy, 2, 6); } }
      else { g.fillStyle = "rgba(255,255,255,.4)"; for (let i = 0; i < 10; i++) { const yy = GBOT - ((t * 40 + i * 31) % Math.max(1, GBOT - ly)); g.beginPath(); g.arc(GX - gl.bw / 2 + 8 + (i * 13) % (gl.bw - 16), yy, 1.4, 0, 7); g.fill(); } }
      if (foam > 0.002) { g.fillStyle = gl.stout ? "#F3E6C8" : "#FFF8E8"; g.fillRect(GX - 80, fy, 160, ly - fy + 1); g.fillStyle = "rgba(0,0,0,.06)"; for (let i = 0; i < 12; i++) { g.beginPath(); g.arc(GX - gl.tw / 2 + (i * 11) % gl.tw, fy + 3 + (i % 3) * 3, 2.2, 0, 7); g.fill(); } }
      g.restore();
      glassPath(gl.h, gl.tw, gl.bw); g.strokeStyle = "rgba(220,240,255,.75)"; g.lineWidth = 2.2; g.stroke(); g.fillStyle = "rgba(255,255,255,.22)"; g.fillRect(GX - gl.tw / 2 + 8, GBOT - gl.h + 12, 5, gl.h - 40);
    }
    // the line
    const ly2 = base - fillH * gl.target; g.setLineDash([6, 5]); g.strokeStyle = "#FFB627"; g.lineWidth = 2; g.beginPath(); g.moveTo(GX - gl.tw / 2 - 18, ly2); g.lineTo(GX + gl.tw / 2 + 18, ly2); g.stroke(); g.setLineDash([]);
    g.fillStyle = "#FFB627"; g.font = "bold 11px Inter, Arial"; g.textAlign = "left"; g.fillText("LINE", GX + gl.tw / 2 + 22, ly2 + 4);
    if (gl.head[1] > 0.03) { g.fillStyle = "rgba(255,246,224,.7)"; g.font = "bold 10px Inter, Arial"; g.textAlign = "right"; g.fillText("needs a head", GX - gl.tw / 2 - 22, ly2 + 4); }
    if (gl.stout && !scored && liquid > 0.3 && !pouring) { g.fillStyle = "#FFF6E0"; g.font = "bold 13px Inter, Arial"; g.textAlign = "center"; g.fillText("Let it settle… then top up", GX, 250); }
    if (state === "play" && liquid === 0 && !pouring) { g.fillStyle = "rgba(255,246,224,.9)"; g.font = "bold 14px Inter, Arial"; g.textAlign = "center"; g.fillText("Hold anywhere to pour. Let go on the line.", GX, 590); }
    FX.step(dt); FX.draw(g);
  }
  let last = performance.now();
  function loop(now) { const dt = Math.min(0.033, (now - last) / 1000); last = now; t += dt; update(dt); draw(dt); requestAnimationFrame(loop); }
  // stout: letting go starts the settle, but you can pour again to top up before it scores
  cv.addEventListener("pointerdown", () => { if (gl && gl.stout && settleT > 0 && !scored) settleT = 0; });
  $("go").addEventListener("click", startShift); $("again").addEventListener("click", startShift);
  $("share").addEventListener("click", () => share(`I scored ${total} on Perfect Pour 🍺 Reckon you can pour a better pint?`, $("shareMsg")));
  wireMute(); gl = GLASSES[0];
  gate(() => show("start"));
  requestAnimationFrame(loop);
})();
