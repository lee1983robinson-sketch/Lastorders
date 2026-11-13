// Higher or Lower: guess the next card. Aces high, a pair loses. World 360 x 640.
(() => {
  "use strict";
  const { $, store, REDUCED, pop, cheer, fanfare, sad, beep, noise, music, wireMute, fit, show, gate, toast, share, best, rr, particles } = PUB;
  const W = 360, H = 640, CW = 132, CH = 186;
  let g = null, view = null; fit($("game"), W, H, (o) => { view = o; g = o.g; });
  const FX = particles();
  const SUITS = ["♠", "♥", "♦", "♣"], RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
  let deck = [], cur = null, nxt = null, streak = 0, swaps = 1, state = "menu", flip = 0, flipping = false, t = 0, shake = 0, history = [];
  function newDeck() { deck = []; for (let s = 0; s < 4; s++) for (let r = 0; r < 13; r++) deck.push({ s, r }); for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; } }
  function draw1() { if (!deck.length) newDeck(); return deck.pop(); }
  function start() { newDeck(); cur = draw1(); nxt = draw1(); streak = 0; swaps = 1; history = [cur]; state = "play"; flip = 0; flipping = false; show(null); $("ctl").hidden = false; hud(); music([[45, 48, 52], [43, 47, 50], [41, 45, 48], [40, 44, 47]], [76, 0, 0, 74, 0, 72, 0, 0, 71, 0, 0, 72, 0, 74, 0, 0], 100); }
  function hud() { $("streak").textContent = streak; $("best").textContent = Math.max(streak, best("cardsBest")); $("swap").textContent = swaps ? "Change card (1)" : "No changes left"; $("swap").disabled = !swaps || flipping; $("hi").disabled = $("lo").disabled = flipping || state !== "play"; }
  function guess(up) {
    if (state !== "play" || flipping) return; PUB.ctx(); flipping = true; flip = 0; hud(); noise(0.12, 0.08, 3000);
    setTimeout(() => {
      const ok = up ? nxt.r > cur.r : nxt.r < cur.r, pair = nxt.r === cur.r;
      if (ok) { streak++; beep(660 + streak * 30, 990 + streak * 30, 0.12, "triangle", 0.06); FX.burst(W / 2, 330, "#FFB627", 14, 170, 3); if (streak % 5 === 0) { fanfare(); toast(streak + " IN A ROW!", 1100); } else toast(["YES!", "LOVELY!", "GOOD GUESS!", "SPOT ON!"][Math.floor(Math.random() * 4)], 600); }
      setTimeout(() => {
        if (!ok) { shake = 0.4; return lose(pair); }
        cur = nxt; history.push(cur); nxt = draw1(); flip = 0; flipping = false; hud();
      }, 700);
    }, 260);
  }
  function lose(pair) {
    state = "over"; sad(); const b = best("cardsBest", streak); if (streak > 0) PUB.submit("cards", streak); $("ctl").hidden = true;
    $("oTitle").textContent = pair ? "A PAIR! YOU LOSE" : "WRONG CALL!"; $("oScore").textContent = streak; $("oBest").textContent = b;
    $("oSub").textContent = streak >= 10 ? "What a run. The pub is in awe." : streak >= 5 ? "Decent run, that." : "Unlucky. Shuffle up and go again.";
    $("shareMsg").hidden = true; setTimeout(() => show("over"), 1200);
  }
  $("hi").addEventListener("click", () => guess(true)); $("lo").addEventListener("click", () => guess(false));
  $("swap").addEventListener("click", () => { if (!swaps || flipping || state !== "play") return; swaps--; cur = draw1(); history.push(cur); nxt = draw1(); beep(500, 800, 0.1, "triangle", 0.05); hud(); });
  addEventListener("keydown", (e) => { if (e.code === "ArrowUp") { e.preventDefault(); guess(true); } if (e.code === "ArrowDown") { e.preventDefault(); guess(false); } });

  // ---------- drawing ----------
  function card(c, x, y, sc = 1, face = true, scaleX = 1) {
    g.save(); g.translate(x, y); g.scale(sc * Math.max(0.02, Math.abs(scaleX)), sc);
    g.fillStyle = "rgba(0,0,0,.35)"; rr(g, -CW / 2 + 5, -CH / 2 + 7, CW, CH, 12); g.fill();
    if (!face) { g.save(); rr(g, -CW / 2, -CH / 2, CW, CH, 12); g.clip(); const gr = g.createLinearGradient(-CW / 2, -CH / 2, CW / 2, CH / 2); gr.addColorStop(0, "#2A1A6A"); gr.addColorStop(1, "#140C3A"); g.fillStyle = gr; rr(g, -CW / 2, -CH / 2, CW, CH, 12); g.fill(); g.strokeStyle = "#3DE0FF"; g.lineWidth = 3; rr(g, -CW / 2 + 8, -CH / 2 + 8, CW - 16, CH - 16, 8); g.stroke();
      g.fillStyle = "#3DE0FF22"; for (let i = -6; i < 8; i++) { g.beginPath(); g.moveTo(-CW / 2 + 8, -CH / 2 + 8 + i * 22); g.lineTo(-CW / 2 + 8 + 40, -CH / 2 + 8 + i * 22 + 40); g.lineTo(-CW / 2 + 8, -CH / 2 + 8 + i * 22 + 80); g.fill(); }
      g.fillStyle = "#FFB627"; g.font = "18px Bungee, Impact, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("LAST", 0, -12); g.fillText("ORDERS", 0, 12); g.restore(); g.restore(); return; }
    g.fillStyle = "#FBF8EF"; rr(g, -CW / 2, -CH / 2, CW, CH, 12); g.fill(); g.strokeStyle = "#D8D2C0"; g.lineWidth = 1.5; g.stroke();
    const red = c.s === 1 || c.s === 2, col = red ? "#C8102E" : "#16161E", rk = RANKS[c.r], su = SUITS[c.s];
    g.fillStyle = col; g.textAlign = "center"; g.textBaseline = "middle";
    g.font = "bold 26px Georgia, 'Times New Roman', serif"; g.fillText(rk, -CW / 2 + 20, -CH / 2 + 22); g.font = "22px Georgia, serif"; g.fillText(su, -CW / 2 + 20, -CH / 2 + 46);
    g.save(); g.rotate(Math.PI); g.font = "bold 26px Georgia, serif"; g.fillText(rk, -CW / 2 + 20, -CH / 2 + 22); g.font = "22px Georgia, serif"; g.fillText(su, -CW / 2 + 20, -CH / 2 + 46); g.restore();
    if (c.r >= 9 && c.r <= 11) { g.fillStyle = red ? "#FBE3E6" : "#E6E6F0"; rr(g, -34, -54, 68, 108, 8); g.fill(); g.fillStyle = "#FFB627"; g.beginPath(); g.moveTo(-18, -26); g.lineTo(-12, -40); g.lineTo(-4, -30); g.lineTo(0, -44); g.lineTo(4, -30); g.lineTo(12, -40); g.lineTo(18, -26); g.closePath(); g.fill(); g.fillStyle = col; g.font = "bold 44px Georgia, serif"; g.fillText(rk, 0, 12); }
    else { g.font = c.r === 12 ? "84px Georgia, serif" : "64px Georgia, serif"; g.fillText(su, 0, 6); }
    g.restore();
  }
  function draw(dt) {
    const bg = g.createRadialGradient(W / 2, 300, 40, W / 2, 320, 420); bg.addColorStop(0, "#1E7A44"); bg.addColorStop(1, "#0A2A16"); g.fillStyle = bg; g.fillRect(0, 0, W, H);
    g.strokeStyle = "rgba(255,255,255,.08)"; g.lineWidth = 2; g.beginPath(); g.ellipse(W / 2, 330, 160, 230, 0, 0, 7); g.stroke();
    g.save(); if (shake > 0 && !REDUCED) { g.translate((Math.random() - 0.5) * 12 * shake, 0); shake = Math.max(0, shake - dt); }
    // the trail of cards so far
    const trail = history.slice(-6, -1); trail.forEach((c, i) => card(c, 40 + i * 22, 140, 0.34, true));
    if (cur) card(cur, W / 2 - 74, 330, 0.95, true);
    if (nxt) { if (flipping) flip = Math.min(1, flip + dt * 3.2); const sx = Math.cos(flip * Math.PI); card(nxt, W / 2 + 74, 330 - (flipping ? Math.sin(flip * Math.PI) * 16 : 0), 0.95, flip > 0.5, sx); }
    g.restore();
    g.fillStyle = "rgba(255,246,224,.85)"; g.font = "bold 13px Inter, Arial"; g.textAlign = "center"; if (state === "play" && !flipping) g.fillText("Will the next card be higher or lower?", W / 2, 448); g.fillStyle = "rgba(255,246,224,.55)"; g.font = "600 11px Inter, Arial"; g.fillText("Aces are high. A pair loses.", W / 2, 466);
    FX.step(dt); FX.draw(g);
  }
  let last = performance.now();
  function loop(now) { const dt = Math.min(0.033, (now - last) / 1000); last = now; t += dt; draw(dt); requestAnimationFrame(loop); }
  $("go").addEventListener("click", start); $("again").addEventListener("click", start);
  $("share").addEventListener("click", () => share(`I got ${streak} in a row on Higher or Lower 🃏🍺 Beat that.`, $("shareMsg")));
  wireMute(); newDeck(); cur = draw1(); nxt = draw1(); history = [cur];
  gate(() => show("start"));
  requestAnimationFrame(loop);
})();
