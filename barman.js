// Barman Rush: serve four bars before the punters reach you. World 360 x 640.
(() => {
  "use strict";
  const { $, store, REDUCED, pop, thud, smash, cheer, fanfare, sad, burp, beep, noise, music, wireMute, fit, show, gate, toast, share, best, rr, shade, particles } = PUB;
  const W = 360, H = 640, LANES = [196, 304, 412, 520], DOOR = 22, END = 296, BARMAN_X = 326;
  let g = null, view = null; fit($("game"), W, H, (o) => { view = o; g = o.g; });
  const FX = particles();
  const SKIN = ["#F2C9A8", "#E0AC84", "#C68B5E", "#8D5A3B", "#5E3A26", "#F5D5BC"], HAIR = ["#2B1A12", "#5A3A22", "#A0662E", "#D8B36A", "#1A1A1A", "#7A2E1E", "#9A9A9A"], TOPS = ["#3D8BFF", "#EE3A55", "#3FCB6A", "#A45CFF", "#FF8A1F", "#E8ECF5", "#2A2A3A"];
  const SHOUTS = ["Oi! Pint!", "Any chance?!", "I've been here ages!", "Where's my drink?!", "Service!"];

  let state = "menu", level = 1, score = 0, lives = 3, lane = 1, barmanY = LANES[1], pints = [], empties = [], punters = [], toSpawn = 0, spawnT = 0, t = 0, cool = [0, 0, 0, 0], pourT = 0, served = 0, bestScore = best("barBest");
  const spd = () => 22 + level * 5;
  function startLevel(first) {
    if (first) { score = 0; lives = 3; level = 1; }
    pints = []; empties = []; punters = []; toSpawn = 5 + level * 3; spawnT = 0.6; served = 0; state = "play"; show(null); hud(); toast("NIGHT " + level, 1300);
    music([[48, 52, 55], [53, 57, 60], [55, 59, 62], [48, 52, 55]], [72, 74, 76, 0, 79, 0, 76, 74, 72, 0, 74, 0, 76, 0, 0, 0, 77, 76, 74, 0, 72, 0, 71, 72, 74, 0, 71, 0, 67, 0, 0, 0], 144);
  }
  function hud() { $("lvl").textContent = level; $("score").textContent = score; $("lives").textContent = Math.max(0, lives); }
  function spawn() {
    const ln = Math.floor(Math.random() * 4);
    punters.push({ lane: ln, x: DOOR - 10, state: "walk", t: 0, pause: 0, skin: SKIN[Math.floor(Math.random() * SKIN.length)], hair: HAIR[Math.floor(Math.random() * HAIR.length)], top: TOPS[Math.floor(Math.random() * TOPS.length)], style: Math.floor(Math.random() * 4), thirst: 1 + (Math.random() < 0.2 + level * 0.05 ? 1 : 0), shout: 0 });
  }
  function serve(ln) {
    if (state !== "play") return; PUB.ctx(); lane = ln; if (cool[ln] > 0) return; cool[ln] = 0.28; pourT = 0.18;
    pints.push({ lane: ln, x: END - 6 }); noise(0.18, 0.06, 900); beep(500, 300, 0.06, "triangle", 0.04);
  }
  function loseLife(msg, x, y) { lives--; smash(); FX.burst(x, y, "#CFE7F2", 16, 200, 2.5); toast(msg, 1100); hud(); if (navigator.vibrate) try { navigator.vibrate(120); } catch (e) {} if (lives <= 0) setTimeout(gameOver, 700); }
  function gameOver() { if (state !== "play") return; state = "over"; sad(); bestScore = best("barBest", score); PUB.submit("barman", score); $("oScore").textContent = score; $("oBest").textContent = bestScore; $("oNight").textContent = level; $("oSub").textContent = level >= 5 ? "Proper Friday night shift, that." : "The landlord wants a word."; $("shareMsg").hidden = true; show("over"); }
  function update(dt) {
    t += dt; for (let i = 0; i < 4; i++) cool[i] = Math.max(0, cool[i] - dt); pourT = Math.max(0, pourT - dt);
    barmanY += (LANES[lane] - barmanY) * Math.min(1, dt * 18);
    if (state !== "play") return;
    if (toSpawn > 0) { spawnT -= dt; if (spawnT <= 0) { spawn(); toSpawn--; spawnT = Math.max(0.7, 2.6 - level * 0.18) * (0.6 + Math.random() * 0.8); } }
    for (const p of punters) {
      p.t += dt;
      if (p.state === "walk") { if (p.pause > 0) p.pause -= dt; else { p.x += spd() * dt; if (Math.random() < dt * 0.4) p.pause = 0.5 + Math.random() * 0.8; } if (p.x >= END - 12) { p.state = "angry"; p.shout = 1.5; loseLife(SHOUTS[Math.floor(Math.random() * SHOUTS.length)].toUpperCase(), END, LANES[p.lane] - 40); } }
      else if (p.state === "back") { p.x -= 160 * dt; p.bt -= dt; if (p.x < DOOR - 6) { p.state = "gone"; score += 50; served++; FX.text(DOOR + 30, LANES[p.lane] - 60, "+50", "#5FE3B0", 16); hud(); } else if (p.bt <= 0) { p.state = "drink"; p.dt = 0.9; } }
      else if (p.state === "drink") { p.dt -= dt; if (p.dt <= 0) { p.thirst--; empties.push({ lane: p.lane, x: p.x + 16 }); if (p.thirst <= 0) { p.state = "leave"; burp(); } else p.state = "walk"; } }
      else if (p.state === "leave") { p.x -= 120 * dt; if (p.x < DOOR - 6) { p.state = "gone"; score += 50; served++; hud(); } }
      else if (p.state === "angry") { p.shout -= dt; if (p.shout <= 0) p.state = "gone"; }
    }
    for (const pt of pints) {
      pt.x -= 300 * dt;
      const hit = punters.filter((p) => p.lane === pt.lane && p.state === "walk" && p.x + 18 >= pt.x && p.x - 10 <= pt.x).sort((a, b) => b.x - a.x)[0];
      if (hit) { pt.done = true; hit.state = "back"; hit.bt = 0.45; score += 10; hud(); pop(1); FX.burst(pt.x, LANES[pt.lane] - 24, "#FFF6E0", 8, 90, 2.5); }
      else if (pt.x < DOOR) { pt.done = true; loseLife("WASTED PINT!", DOOR + 10, LANES[pt.lane] - 20); }
    }
    pints = pints.filter((p) => !p.done);
    for (const e of empties) { e.x += 170 * dt; if (e.x >= END) { e.done = true; if (lane === e.lane) { score += 25; FX.text(END - 20, LANES[e.lane] - 50, "+25", "#FFB627", 14); beep(1200, 1600, 0.06, "triangle", 0.05); hud(); } else loseLife("SMASHED GLASS!", END + 4, LANES[e.lane] - 20); } }
    empties = empties.filter((e) => !e.done);
    punters = punters.filter((p) => p.state !== "gone");
    if (toSpawn === 0 && !punters.length && !pints.length && !empties.length && lives > 0) { state = "between"; level++; fanfare(); cheer(false); score += 100; hud(); toast("NIGHT CLEARED! +100", 1500); setTimeout(() => startLevel(false), 1700); }
  }

  // ---------- input: tap a bar to move there and pour ----------
  const cv = $("game");
  cv.addEventListener("pointerdown", (e) => { if (state !== "play") return; const p = view.point(e); let best_ = 0, bd = 1e9; LANES.forEach((y, i) => { const d = Math.abs(p.y - (y - 30)); if (d < bd) { bd = d; best_ = i; } }); serve(best_); });
  addEventListener("keydown", (e) => { if (state !== "play") return; if (e.code === "ArrowUp") { lane = Math.max(0, lane - 1); e.preventDefault(); } if (e.code === "ArrowDown") { lane = Math.min(3, lane + 1); e.preventDefault(); } if (e.code === "Space" || e.code === "ArrowLeft") { e.preventDefault(); serve(lane); } });

  // ---------- drawing ----------
  function pint(x, y, s = 1, empty = false) { const im = !empty && PUB.art("drinks/lager"); if (im) { g.drawImage(im, x - 7 * s, y - 26 * s, 14 * s, 26 * s); return; } g.save(); g.translate(x, y); g.scale(s, s); g.fillStyle = empty ? "rgba(200,230,255,.35)" : "#FFB627"; g.beginPath(); g.moveTo(-7, -18); g.lineTo(7, -18); g.lineTo(5.5, 0); g.lineTo(-5.5, 0); g.closePath(); g.fill(); g.strokeStyle = "rgba(255,255,255,.6)"; g.lineWidth = 1; g.stroke(); if (!empty) { g.fillStyle = "#FFF6E0"; g.beginPath(); g.arc(-4, -18, 3.5, 0, 7); g.arc(1, -20, 4, 0, 7); g.arc(5, -18, 3, 0, 7); g.fill(); } g.restore(); }
  function person(p) {
    const y = LANES[p.lane] - 34, bob = p.state === "walk" && p.pause <= 0 ? Math.abs(Math.sin(p.t * 9)) * 3 : 0, x = p.x;
    g.save(); g.translate(x, y - bob);
    g.fillStyle = p.top; rr(g, -15, -6, 30, 34, 10); g.fill(); // body
    g.fillStyle = p.skin; g.beginPath(); g.arc(0, -20, 13, 0, 7); g.fill(); // head
    g.fillStyle = p.hair; if (p.style === 0) { g.beginPath(); g.arc(0, -23, 13.5, Math.PI, 0); g.fill(); } else if (p.style === 1) { g.beginPath(); g.arc(0, -23, 13.5, Math.PI, 0); g.fill(); g.fillRect(-14, -24, 6, 18); } else if (p.style === 2) { g.beginPath(); g.ellipse(-3, -31, 12, 6, -0.2, 0, 7); g.fill(); } else { g.fillStyle = "#1A1A2A"; rr(g, -14, -38, 28, 10, 4); g.fill(); g.fillRect(-2, -32, 20, 4); }
    const mood = p.state === "angry" ? 2 : p.state === "drink" || p.state === "back" || p.state === "leave" ? 1 : 0;
    g.fillStyle = "#1A1420"; g.beginPath(); g.arc(4, -21, 1.8, 0, 7); g.arc(10, -21, 1.8, 0, 7); g.fill();
    g.strokeStyle = "#5A2A2A"; g.lineWidth = 1.8; g.beginPath(); if (mood === 1) g.arc(7, -15, 3.5, 0.1, Math.PI - 0.1); else if (mood === 2) g.arc(7, -11, 3.5, Math.PI + 0.3, -0.3); else { g.moveTo(4, -14); g.lineTo(10, -14); } g.stroke();
    if (p.state === "angry") { g.strokeStyle = "#EE3A55"; g.lineWidth = 2; g.beginPath(); g.moveTo(2, -26); g.lineTo(6, -24); g.moveTo(12, -26); g.lineTo(8, -24); g.stroke(); }
    if (p.state === "drink") { g.save(); g.translate(14, -12); g.rotate(-0.9); pint(0, 0, 0.8); g.restore(); burpBubble(p); }
    g.restore();
    if (p.state === "angry" && p.shout > 0) { g.fillStyle = "#FFF6E0"; rr(g, x - 30, y - 82, 92, 24, 8); g.fill(); g.fillStyle = "#2A1400"; g.font = "bold 11px Inter, Arial"; g.textAlign = "center"; g.fillText("OI! PINT!", x + 16, y - 66); }
  }
  function burpBubble() {}
  function draw(dt) {
    // back wall
    const wall = g.createLinearGradient(0, 0, 0, H); wall.addColorStop(0, "#3A2236"); wall.addColorStop(1, "#1A0F14"); g.fillStyle = wall; g.fillRect(0, 0, W, H); PUB.backdrop(g, W, H, 0.42);
    g.fillStyle = "#4A2A20"; g.fillRect(0, 90, W, 6);
    // window + neon
    g.fillStyle = "#16224A"; rr(g, 120, 104, 120, 50, 6); g.fill(); g.strokeStyle = "#5A3A22"; g.lineWidth = 4; g.stroke(); g.fillStyle = "#FFE7A8"; g.beginPath(); g.arc(214, 122, 8, 0, 7); g.fill();
    g.save(); g.shadowColor = "#FF3D7F"; g.shadowBlur = 12; g.fillStyle = "#FF3D7F"; g.font = "16px Bungee, Impact, sans-serif"; g.textAlign = "left"; g.fillText("OPEN", 20, 140); g.restore();
    // door
    g.fillStyle = "#2A160C"; rr(g, -10, 150, 26, 470, 6); g.fill();
    for (let i = 0; i < 4; i++) {
      const y = LANES[i];
      // bar counter
      const top = g.createLinearGradient(0, y - 6, 0, y + 6); top.addColorStop(0, "#B07A48"); top.addColorStop(1, "#6A3E1E"); g.fillStyle = top; rr(g, DOOR, y - 4, END - DOOR + 8, 10, 3); g.fill();
      g.fillStyle = "#4A2812"; g.fillRect(DOOR + 4, y + 6, END - DOOR, 34); g.fillStyle = "#3A1E0E"; for (let k = 0; k < 9; k++) g.fillRect(DOOR + 10 + k * 31, y + 10, 2, 26);
      g.fillStyle = "#D8B060"; g.fillRect(DOOR + 4, y + 34, END - DOOR, 3);
      // tap
      g.fillStyle = "#C8A050"; rr(g, END + 2, y - 48, 8, 44, 3); g.fill(); g.fillStyle = "#1A1A1A"; rr(g, END - 2, y - 58, 16, 12, 4); g.fill(); g.fillStyle = "#FFB627"; g.fillRect(END + 1, y - 55, 10, 6);
      if (cool[i] > 0) { g.fillStyle = "rgba(255,182,39,.6)"; g.fillRect(END + 4, y - 4, 3, 4); }
      // lane hint
      if (state === "play" && i === lane) { g.fillStyle = "rgba(255,182,39,.07)"; g.fillRect(DOOR, y - 70, W - DOOR, 76); }
    }
    for (const p of punters) person(p);
    for (const pt of pints) pint(pt.x, LANES[pt.lane] - 4);
    for (const e of empties) pint(e.x, LANES[e.lane] - 4, 0.9, true);
    // barman
    const by = barmanY - 34; g.save(); g.translate(BARMAN_X, by);
    g.fillStyle = "#F4F1EA"; rr(g, -14, -6, 28, 36, 9); g.fill(); g.fillStyle = "#2A2A3A"; rr(g, -11, 6, 22, 24, 5); g.fill(); // shirt + apron
    g.fillStyle = "#E8B48A"; g.beginPath(); g.arc(0, -20, 12, 0, 7); g.fill(); g.fillStyle = "#3A2416"; g.beginPath(); g.arc(0, -24, 12.5, Math.PI, 0); g.fill();
    g.fillStyle = "#1A1420"; g.beginPath(); g.arc(-6, -20, 1.8, 0, 7); g.fill(); g.strokeStyle = "#5A2A2A"; g.lineWidth = 1.6; g.beginPath(); g.arc(-4, -15, 3, 0.2, Math.PI - 0.2); g.stroke();
    g.fillStyle = "#E8B48A"; g.save(); g.translate(-12, 2); g.rotate(pourT > 0 ? -1.1 : -0.3); rr(g, -4, 0, 8, 22, 4); g.fill(); g.restore();
    g.restore();
    FX.step(dt); FX.draw(g);
  }
  let last = performance.now();
  function loop(now) { const dt = Math.min(0.033, (now - last) / 1000); last = now; update(dt); draw(dt); requestAnimationFrame(loop); }
  $("go").addEventListener("click", () => startLevel(true)); $("again").addEventListener("click", () => startLevel(true));
  $("share").addEventListener("click", () => share(`I scored ${score} on Barman Rush and lasted ${level} nights behind the bar 🍺 Beat that.`, $("shareMsg")));
  wireMute(); hud();
  gate(() => show("start"));
  requestAnimationFrame(loop);
})();
