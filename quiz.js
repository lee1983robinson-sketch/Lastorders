// Pub Quiz: ten questions, beat the clock. Tonight's quiz is the same for everyone each day.
(() => {
  "use strict";
  const { $, store, REDUCED, pop, cheer, fanfare, sad, beep, music, wireMute, fit, show, gate, toast, share, best, rr, particles } = PUB;
  const W = 360, H = 640, TIME = 15;
  let g = null, view = null; fit($("game"), W, H, (o) => { view = o; g = o.g; });
  const FX = particles();
  const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });
  function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  const hash = (str) => { let h = 2166136261; for (const ch of str) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
  let state = "menu", qs = [], qi = 0, score = 0, right = 0, left = TIME, locked = false, tonight = false, t = 0;
  function pick(R) { const idx = QUIZ.map((_, i) => i); for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; } return idx.slice(0, 10).map((i) => { const q = QUIZ[i], opts = [q[1], q[2], q[3], q[4]]; for (let k = 3; k > 0; k--) { const j = Math.floor(R() * (k + 1)); [opts[k], opts[j]] = [opts[j], opts[k]]; } return { q: q[0], a: q[1], opts, cat: q[5] }; }); }
  function begin(daily) {
    tonight = daily; qs = pick(daily ? rng(hash("lastorders-quiz-" + today())) : Math.random); qi = 0; score = 0; right = 0; state = "play"; show(null); $("panel").hidden = false;
    if (daily) store.set("quizDay", today());
    music([[48, 52, 55], [45, 48, 52], [41, 45, 48], [43, 47, 50]], [72, 0, 0, 0, 74, 0, 0, 0, 76, 0, 0, 0, 74, 0, 0, 0], 84); ask();
  }
  function ask() {
    const q = qs[qi]; locked = false; left = TIME; $("qn").textContent = `Question ${qi + 1} of 10 · ${q.cat}`; $("q").textContent = q.q; $("qscore").textContent = score;
    $("opts").innerHTML = q.opts.map((o, i) => `<button type="button" class="opt" data-i="${i}"><span class="L">${"ABCD"[i]}</span><span>${esc(o)}</span></button>`).join("");
    $("opts").querySelectorAll(".opt").forEach((b) => b.addEventListener("click", () => answer(+b.dataset.i)));
  }
  const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  function answer(i) {
    if (locked || state !== "play") return; locked = true; PUB.ctx(); const q = qs[qi], btns = $("opts").querySelectorAll(".opt"), ok = i >= 0 && q.opts[i] === q.a;
    btns.forEach((b, k) => { if (q.opts[k] === q.a) b.classList.add("right"); else if (k === i) b.classList.add("wrong"); b.disabled = true; });
    if (ok) { const pts = 10 + Math.ceil(left); score += pts; right++; beep(880, 1320, 0.12, "triangle", 0.06); pop(1.2); toast("+" + pts, 700); FX.burst(W / 2, 200, "#5FE3B0", 16, 160, 3); }
    else { beep(300, 160, 0.3, "sawtooth", 0.05); toast(i < 0 ? "TIME'S UP!" : ["WRONG!", "NOPE!", "UNLUCKY!"][Math.floor(Math.random() * 3)], 800); }
    $("qscore").textContent = score;
    setTimeout(() => { qi++; if (qi >= 10) finish(); else ask(); }, 1400);
  }
  function finish() {
    state = "over"; $("panel").hidden = true; const b = best("quizBest", score);
    if (tonight) { store.set("quizScore-" + today(), String(score)); PUB.submit("quiz", score); }
    right >= 8 ? (fanfare(), cheer(true)) : right >= 5 ? cheer(false) : sad();
    $("oScore").textContent = score; $("oRight").textContent = right + "/10"; $("oSub").textContent = right === 10 ? "Ten out of ten! Quiz master." : right >= 8 ? "Cracking effort. Drinks on the team." : right >= 5 ? "Mid-table. Not bad at all." : "The pub team needs you to study.";
    $("oNote").textContent = tonight ? "Tonight's quiz counts for the leaderboard. A new one comes out at midnight." : "That was a practice round, so it doesn't count for the leaderboard.";
    $("shareMsg").hidden = true; show("over");
  }
  function startScreen() {
    const played = store.get("quizDay") === today(), sc = store.get("quizScore-" + today());
    $("goDaily").disabled = played; $("goDaily").textContent = played ? `TONIGHT'S QUIZ DONE${sc ? " · " + sc + " PTS" : ""}` : "PLAY TONIGHT'S QUIZ"; show("start");
  }
  $("goDaily").addEventListener("click", () => begin(true)); $("goPractice").addEventListener("click", () => begin(false));
  $("again").addEventListener("click", () => begin(false)); $("menu").addEventListener("click", startScreen);
  $("share").addEventListener("click", () => share(`I got ${right}/10 (${score} pts) on tonight's Last Orders Pub Quiz 🧠🍺 Your turn.`, $("shareMsg")));
  addEventListener("keydown", (e) => { const k = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, KeyA: 0, KeyB: 1, KeyC: 2, KeyD: 3 }[e.code]; if (k != null && state === "play") answer(k); });

  // ---------- background: the pub with the quiz board ----------
  function draw(dt) {
    const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, "#22142E"); bg.addColorStop(1, "#120A06"); g.fillStyle = bg; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 12; i++) { g.fillStyle = ["#FFB62714", "#FF3D7F12", "#3DE0FF10"][i % 3]; g.beginPath(); g.arc((i * 89 + Math.sin(t * 0.3 + i) * 8) % W, 60 + (i * 53) % 520, 20 + (i % 4) * 14, 0, 7); g.fill(); }
    g.fillStyle = "#5A3A22"; rr(g, 10, 64, W - 20, 470, 16); g.fill(); g.fillStyle = "#1B2620"; rr(g, 18, 72, W - 36, 454, 12); g.fill();
    if (state === "play" && !locked) { left = Math.max(0, left - dt); if (left <= 0) answer(-1); }
    if (state === "play") { const k = left / TIME; g.fillStyle = "#0A0E24"; rr(g, 30, 84, W - 60, 10, 5); g.fill(); g.fillStyle = k > 0.5 ? "#5FE3B0" : k > 0.25 ? "#FFB627" : "#FF3D7F"; rr(g, 30, 84, Math.max(10, (W - 60) * k), 10, 5); g.fill(); }
    FX.step(dt); FX.draw(g);
  }
  let last = performance.now();
  function loop(now) { const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt; draw(dt); requestAnimationFrame(loop); }
  wireMute(); gate(startScreen); requestAnimationFrame(loop);
})();
