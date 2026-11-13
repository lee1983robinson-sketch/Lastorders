// Shared kit for the Last Orders pub games: storage, sound, screen fitting, 18+ gate, sharing.
window.PUB = (() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };
  const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---------- sound ----------
  let AC = null, MASTER = null, MUSIC = null, NOISE = null, muted = store.get("loMute") === "1";
  const MUSIC_VOL = 0.42;
  function ctx() {
    if (!AC) { AC = new (window.AudioContext || window.webkitAudioContext)(); MASTER = AC.createGain(); MASTER.gain.value = muted ? 0 : 1; MASTER.connect(AC.destination); MUSIC = AC.createGain(); MUSIC.gain.value = MUSIC_VOL; MUSIC.connect(MASTER);
      // one shared noise buffer instead of building a new one for every sound (smoother on phones)
      NOISE = AC.createBuffer(1, Math.floor(AC.sampleRate * 2.5), AC.sampleRate); const nd = NOISE.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1; }
    if (AC.state === "suspended") AC.resume(); return AC;
  }
  function beep(f1, f2, dur, type = "square", vol = 0.06, delay = 0) {
    try { const A = ctx(), o = A.createOscillator(), g = A.createGain(), t0 = A.currentTime + delay; o.type = type; o.frequency.setValueAtTime(f1, t0); o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t0 + dur); g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur); o.connect(g).connect(MASTER); o.start(t0); o.stop(t0 + dur + 0.02); } catch (e) {}
  }
  function noise(dur, vol, freq, delay = 0, q = 0.8) {
    try { const A = ctx();
      const s = A.createBufferSource(), f = A.createBiquadFilter(), g = A.createGain(), t0 = A.currentTime + delay; s.buffer = NOISE; f.type = "bandpass"; f.frequency.value = freq; f.Q.value = q;
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + Math.min(0.03, dur / 4)); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur); s.connect(f).connect(g).connect(MASTER); s.start(t0); s.stop(t0 + dur); } catch (e) {}
  }
  const pop = (pitch = 1, delay = 0) => { beep(700 * pitch, 1400 * pitch, 0.07, "sine", 0.09, delay); noise(0.05, 0.05, 3000 * pitch, delay); };
  const thud = () => { beep(160, 60, 0.12, "sine", 0.12); noise(0.08, 0.06, 500); };
  const smash = () => { noise(0.35, 0.18, 3500, 0, 0.6); noise(0.25, 0.1, 6000, 0.05, 0.6); beep(1800, 900, 0.1, "triangle", 0.04); };
  const cheer = (big) => { noise(big ? 2 : 1, big ? 0.3 : 0.16, 1200); noise(big ? 1.8 : 0.9, big ? 0.18 : 0.08, 600, 0.1); if (big) [0, 0.14, 0.28].forEach((d, i) => beep([523, 659, 784][i], [523, 659, 784][i], 0.25, "square", 0.04, d)); };
  const fanfare = () => { try { ctx(); const at = AC.currentTime + 0.01; duck(1.2); [72, 76, 79, 84].forEach((n, i) => piano(nf(n), at + i * 0.09, 0.3, 0.08, MASTER)); brass([60, 64, 67, 72], at + 0.38, 0.6, 0.03); cymbal(at + 0.38, 1.1, 0.07); } catch (e) {} try { confetti(); } catch (e) {} };
  let recordAt = 0;
  const sad = () => setTimeout(() => { if (Date.now() - recordAt < 2000) return; try { ctx(); const at = AC.currentTime + 0.01; [67, 66, 65].forEach((n, i) => brass([n - 12], at + i * 0.24, 0.22, 0.032)); brass([52], at + 0.72, 0.75, 0.032); } catch (e) {} }, 30);
  function burp() {
    try { const A = ctx(), t0 = A.currentTime, len = 0.55 + Math.random() * 0.35;
      const o = A.createOscillator(), lfo = A.createOscillator(), lg = A.createGain(), am = A.createGain(), f = A.createBiquadFilter(), g = A.createGain();
      o.type = "sawtooth"; o.frequency.setValueAtTime(95 + Math.random() * 25, t0); o.frequency.linearRampToValueAtTime(62, t0 + len);
      lfo.type = "square"; lfo.frequency.setValueAtTime(26 + Math.random() * 10, t0); lg.gain.value = 0.5; am.gain.value = 0.5; lfo.connect(lg).connect(am.gain);
      f.type = "lowpass"; f.frequency.setValueAtTime(900, t0); f.frequency.linearRampToValueAtTime(380, t0 + len); f.Q.value = 6;
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.32, t0 + 0.05); g.gain.setValueAtTime(0.28, t0 + len * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t0 + len);
      o.connect(am).connect(f).connect(g).connect(MASTER); o.start(t0); lfo.start(t0); o.stop(t0 + len + 0.05); lfo.stop(t0 + len + 0.05); } catch (e) {}
  }
  // ---------- the Last Orders house band (all original, all synthesised here) ----------
  const nf = (n) => 440 * Math.pow(2, (n - 69) / 12);
  function envG(g, at, peak, dur, attack = 0.006) { g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(peak, at + attack); g.gain.exponentialRampToValueAtTime(0.0001, at + dur); }
  // honky-tonk piano: two detuned voices with a percussive decay
  function piano(f, at, dur, vol, dest = MUSIC) {
    for (const [type, det, v] of [["triangle", -9, 1], ["square", 9, 0.2]]) { const o = AC.createOscillator(), g = AC.createGain(); o.type = type; o.frequency.value = f; o.detune.value = det;
      g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(vol * v, at + 0.006); g.gain.exponentialRampToValueAtTime(vol * v * 0.35, at + 0.12); g.gain.exponentialRampToValueAtTime(0.0001, at + dur + 0.08); o.connect(g).connect(dest); o.start(at); o.stop(at + dur + 0.1); }
  }
  function organ(f, at, dur, vol, dest = MUSIC) { for (const [m, v] of [[1, 1], [2, 0.45], [3, 0.2]]) { const o = AC.createOscillator(), g = AC.createGain(); o.type = "sine"; o.frequency.value = f * m; envG(g, at, vol * v, dur + 0.05, 0.02); o.connect(g).connect(dest); o.start(at); o.stop(at + dur + 0.08); } }
  function bells(f, at, dur, vol, dest = MUSIC) { for (const [m, v, d] of [[1, 1, 1], [2.76, 0.3, 0.5], [5.4, 0.12, 0.3]]) { const o = AC.createOscillator(), g = AC.createGain(); o.type = "sine"; o.frequency.value = f * m; envG(g, at, vol * v, (dur + 0.4) * d, 0.003); o.connect(g).connect(dest); o.start(at); o.stop(at + dur + 0.45); } }
  function pluck(f, at, dur, vol) { const o = AC.createOscillator(), fl = AC.createBiquadFilter(), g = AC.createGain(); o.type = "sawtooth"; o.frequency.value = f; fl.type = "lowpass"; fl.Q.value = 5; fl.frequency.setValueAtTime(1500, at); fl.frequency.exponentialRampToValueAtTime(170, at + 0.2); envG(g, at, vol, dur, 0.004); o.connect(fl).connect(g).connect(MUSIC); o.start(at); o.stop(at + dur + 0.02); }
  function hit(at, dur, vol, ftype, freq, dest = MUSIC, q = 0.8) { const src = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain(); src.buffer = NOISE; f.type = ftype; f.frequency.value = freq; f.Q.value = q; envG(g, at, vol, dur, 0.002); src.connect(f).connect(g).connect(dest); src.start(at, Math.random() * 1.5); src.stop(at + dur + 0.02); }
  function kick(at, vol = 0.26, dest = MUSIC) { const o = AC.createOscillator(), g = AC.createGain(); o.type = "sine"; o.frequency.setValueAtTime(150, at); o.frequency.exponentialRampToValueAtTime(45, at + 0.12); envG(g, at, vol, 0.2, 0.004); o.connect(g).connect(dest); o.start(at); o.stop(at + 0.22); }
  function snare(at, vol = 0.09, dest = MUSIC) { hit(at, 0.15, vol, "bandpass", 1900, dest); const o = AC.createOscillator(), g = AC.createGain(); o.type = "triangle"; o.frequency.value = 190; envG(g, at, vol * 0.7, 0.08); o.connect(g).connect(dest); o.start(at); o.stop(at + 0.1); }
  const cymbal = (at, len = 0.9, vol = 0.06) => hit(at, len, vol, "highpass", 5200, MASTER, 0.5);
  function brass(notes, at, dur, vol) { for (const n of notes) { const o = AC.createOscillator(), f = AC.createBiquadFilter(), g = AC.createGain(); o.type = "sawtooth"; o.frequency.value = nf(n); f.type = "lowpass"; f.frequency.setValueAtTime(600, at); f.frequency.linearRampToValueAtTime(2600, at + 0.08); f.frequency.linearRampToValueAtTime(1200, at + dur); g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(vol, at + 0.03); g.gain.setValueAtTime(vol, at + dur * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, at + dur); o.connect(f).connect(g).connect(MASTER); o.start(at); o.stop(at + dur + 0.02); } }
  function duck(len = 0.9, to = 0.2) { if (!AC || !MUSIC || !musicTimer) return; const n = AC.currentTime; MUSIC.gain.cancelScheduledValues(n); MUSIC.gain.setValueAtTime(MUSIC.gain.value, n); MUSIC.gain.linearRampToValueAtTime(MUSIC_VOL * to, n + 0.05); MUSIC.gain.setValueAtTime(MUSIC_VOL * to, n + len); MUSIC.gain.linearRampToValueAtTime(MUSIC_VOL, n + len + 0.35); }
  // each game keeps its own tune and chords; the band's lead instrument and drum feel suit the game
  const PAGE = (location.pathname.split("/").pop() || "home").replace(/\.html?$/i, "");
  const LEAD = { pool: organ, darts: organ, sort: bells, quiz: bells, cards: bells, pour: bells }[PAGE] || piano;
  const DRUMS = { sort: 1, quiz: 1, pour: 1, cards: 1 }[PAGE] || 2;
  let musicTimer = null;
  // background music: give it chords, a tune (MIDI numbers, 0 = rest) and a tempo
  function music(chords, tune, bpm = 132) {
    try { ctx(); if (musicTimer) return; const STEP = 60 / bpm / 2; let step = 0, next = AC.currentTime + 0.06;
      MUSIC.gain.cancelScheduledValues(AC.currentTime); MUSIC.gain.setValueAtTime(MUSIC_VOL, AC.currentTime);
      const sched = () => { if (!AC) return; while (next < AC.currentTime + 0.3) { const ch = chords[Math.floor(step / 8) % chords.length], b = step % 8, at = next;
        // plucked bass: root, bounce, fifth, octave pickup
        if (b === 0) pluck(nf(ch[0] - 12), at, STEP * 1.8, 0.13); if (b === 3) pluck(nf(ch[0] - 12), at, STEP * 0.9, 0.08);
        if (b === 4) pluck(nf(ch[2] - 12), at, STEP * 1.8, 0.11); if (b === 6) pluck(nf(ch[0]), at, STEP * 0.9, 0.07);
        // off-beat chords
        if (b === 2 || b === 6) for (const c of ch) piano(nf(c), at, STEP * 0.8, 0.02);
        // the tune, each note held until the next
        const m = tune[step % tune.length]; if (m) { let len = 1; while (len < 3 && !tune[(step + len) % tune.length]) len++; LEAD(nf(m), at, STEP * len * 0.92, LEAD === bells ? 0.05 : 0.065); }
        // drums
        if (b === 0 || b === 4) kick(at, DRUMS > 1 ? 0.26 : 0.16);
        if (DRUMS > 1 && (b === 2 || b === 6)) snare(at);
        hit(at, 0.035, DRUMS > 1 ? 0.026 : 0.016, "highpass", 7200);
        if (b === 7 && Math.floor(step / 8) % 4 === 3) { const o = AC.createOscillator(), g = AC.createGain(); o.type = "sine"; o.frequency.value = 2637; envG(g, at, 0.02, 0.18); o.connect(g).connect(MUSIC); o.start(at); o.stop(at + 0.2); } // glass clink
        next += STEP; step++; } };
      sched(); musicTimer = setInterval(sched, 90); } catch (e) {}
  }
  function stopMusic() { if (musicTimer) { clearInterval(musicTimer); musicTimer = null; } }
  // leaving a game stops the band and frees the audio
  addEventListener("pagehide", () => { stopMusic(); if (AC) { try { AC.close(); } catch (e) {} AC = null; MASTER = MUSIC = null; } });
  document.addEventListener("visibilitychange", () => { if (!AC) return; if (document.hidden) AC.suspend(); else AC.resume(); });
  function wireMute(btn = $("mute")) {
    if (!btn) return; const wave = btn.querySelector(".wave");
    const set = (m) => { muted = m; store.set("loMute", m ? "1" : "0"); if (MASTER) MASTER.gain.value = m ? 0 : 1; if (wave) wave.style.display = m ? "none" : ""; btn.setAttribute("aria-label", m ? "Turn sound on" : "Turn sound off"); };
    btn.addEventListener("click", (e) => { e.stopPropagation(); set(!muted); }); set(muted);
  }

  // ---------- fit a fixed-size world into the screen ----------
  function fit(canvas, W, H, onResize) {
    const g = canvas.getContext("2d"), screen = canvas.parentElement, stage = screen.parentElement; const o = { g, scale: 1 };
    const doFit = () => { const r = stage.getBoundingClientRect(), s = Math.min(r.width / W, r.height / H), dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      o.scale = s; for (const el of [screen, canvas]) { el.style.width = Math.floor(W * s) + "px"; el.style.height = Math.floor(H * s) + "px"; }
      canvas.width = Math.floor(W * s * dpr); canvas.height = Math.floor(H * s * dpr); g.setTransform(s * dpr, 0, 0, s * dpr, 0, 0); if (onResize) onResize(o); };
    addEventListener("resize", doFit); doFit();
    o.point = (e) => { const r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) / o.scale, y: (e.clientY - r.top) / o.scale }; };
    return o;
  }

  // ---------- screens ----------
  function show(id, ids = ["gate", "start", "over"]) { for (const k of ids) { const el = $(k); if (el) el.hidden = k !== id; } }
  function gate(after) {
    if (store.get("lo18") === "1" || !$("gate")) return after();
    show("gate"); $("yes").addEventListener("click", () => { store.set("lo18", "1"); after(); }); $("no").addEventListener("click", () => { $("gateMsg").hidden = false; });
  }
  let toastT = null;
  function toast(html, ms = 900) { const el = $("toast"); if (!el) return; el.innerHTML = html; el.classList.add("on"); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove("on"), ms); }
  async function share(text, msgEl) { if (msgEl) msgEl.hidden = false; try { await navigator.clipboard.writeText(text); if (msgEl) msgEl.textContent = "Copied. Paste it to a mate."; } catch (e) { if (msgEl) msgEl.textContent = text; } }
  // games whose best is a real high score get the new-personal-best celebration
  const RECORD_KEYS = { barBest: 1, bowlBest: 1, cardsBest: 1, mergeBest: 1, pongBest: 1, pourBest: 1, quizBest: 1, stackBest: 1 };
  const best = (key, v) => { const cur = +(store.get(key) || 0); if (v != null && v > cur) { store.set(key, String(v)); if (RECORD_KEYS[key] && cur > 0) record(cur, v); return v; } return cur; };
  let pendingRecord = null;
  const TROPHY = '<svg viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="pbtg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFF6C4"/><stop offset=".5" stop-color="#FFC53D"/><stop offset="1" stop-color="#C77700"/></linearGradient></defs><path d="M18 12H9c0 9 4 14 10 15M46 12h9c0 9-4 14-10 15" fill="none" stroke="#FFC53D" stroke-width="4" stroke-linecap="round"/><path d="M18 7h28v15c0 9-6 16-14 16s-14-7-14-16z" fill="url(#pbtg)"/><path d="M32 12l2.6 5.3 5.9.9-4.3 4.1 1 5.8L32 25.4l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" fill="#FFF8D6"/><rect x="28" y="37" width="8" height="9" fill="#E8A21A"/><rect x="20" y="46" width="24" height="8" rx="2" fill="url(#pbtg)"/><rect x="16" y="54" width="32" height="5" rx="2" fill="#B86E00"/></svg>';
  function clearRecord() { const over = $("over"); if (!over) return; const c = over.querySelector(".card"); if (c) c.classList.remove("pb-record"); over.querySelectorAll(".pb-banner").forEach((e) => e.remove()); }
  function showRecord(r) {
    const over = $("over"), card = over && over.querySelector(".card"); if (!card) return; clearRecord();
    const d = document.createElement("div"); d.className = "pb-banner"; d.innerHTML = TROPHY + '<div class="pb-title">NEW PERSONAL BEST!</div><div class="pb-sub">Previous best ' + r.prev + ' · beaten by ' + (r.v - r.prev) + '</div>';
    card.prepend(d); card.classList.add("pb-record");
    try { ctx(); const at = AC.currentTime + 0.05; duck(2.2, 0.1);
      [84, 88, 91, 96].forEach((n, i) => bells(nf(n), at + i * 0.08, 0.5, 0.05, MASTER));
      for (let i = 0; i < 8; i++) snare(at + 0.3 + i * 0.035, 0.03 + i * 0.008, MASTER);
      brass([60, 64, 67], at + 0.6, 0.14, 0.035); brass([60, 64, 67], at + 0.78, 0.14, 0.035); brass([65, 69, 72], at + 0.96, 0.2, 0.035); brass([67, 71, 74, 79], at + 1.2, 0.95, 0.035);
      kick(at + 1.2, 0.35, MASTER); cymbal(at + 1.2, 1.6, 0.08); } catch (e) {}
    try { confetti(170, ["#FFD45C", "#FFB627", "#FFF6C4", "#FF3D7F", "#3DE0FF"]); } catch (e) {}
  }
  // the celebration appears when the game-over card does (or straight away if it is already up)
  function record(prev, v) { recordAt = Date.now(); const over = $("over"); pendingRecord = { prev, v }; if (over && !over.hidden) { showRecord(pendingRecord); pendingRecord = null; } }
  // ---------- real artwork (loaded on demand, games fall back to their drawn versions until ready) ----------
  const ART = {};
  function art(name) { let a = ART[name]; if (!a) { a = ART[name] = new Image(); a.decoding = "async"; a.src = "/img/" + name + ".webp"; } return a.complete && a.naturalWidth ? a : null; }
  let backCache = null;
  // the pub photo, softly blurred and dimmed so the game stays easy to read; drawn from a cached canvas
  function backdrop(g, W, H, dim = 0.55) {
    const im = art("pub-bg"); if (!im) return false;
    if (!backCache || backCache.W !== W || backCache.H !== H || backCache.dim !== dim) {
      const c = document.createElement("canvas"); c.width = W * 2; c.height = H * 2; const x = c.getContext("2d"); x.scale(2, 2);
      const s = Math.max((W + 16) / im.naturalWidth, (H + 16) / im.naturalHeight), w = im.naturalWidth * s, h = im.naturalHeight * s;
      x.filter = "blur(2.5px) saturate(1.15)"; x.drawImage(im, (W - w) / 2, (H - h) / 2, w, h); x.filter = "none";
      const v = x.createLinearGradient(0, 0, 0, H); v.addColorStop(0, `rgba(10,8,30,${Math.min(0.95, dim + 0.15)})`); v.addColorStop(0.5, `rgba(12,8,26,${dim})`); v.addColorStop(1, `rgba(12,6,10,${Math.min(0.95, dim + 0.22)})`); x.fillStyle = v; x.fillRect(0, 0, W, H);
      backCache = { c, W, H, dim };
    }
    g.drawImage(backCache.c, 0, 0, W, H); return true;
  }
  // studio credit on every start screen
  addEventListener("DOMContentLoaded", () => { const c = document.querySelector("#start .card"); if (c && !c.querySelector(".credit") && !/Robbo/.test(c.textContent)) { const p = document.createElement("p"); p.className = "fine credit"; p.innerHTML = '18+ · Know your limits: drinkaware.co.uk<br>A Robbo\'s Game Lab game'; c.appendChild(p); } });
  if ("serviceWorker" in navigator) addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));



  // ---------- shared polish: confetti, count-up scores, score bumps, page fades ----------
  function confetti(n = 120, palette) {
    if (REDUCED) n = 30; const c = document.createElement("canvas"); c.style.cssText = "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:95"; document.body.appendChild(c);
    const dpr = Math.min(devicePixelRatio || 1, 2), w = innerWidth, h = innerHeight; c.width = w * dpr; c.height = h * dpr; const x = c.getContext("2d"); x.scale(dpr, dpr);
    const cols = palette || ["#FFB627", "#FF3D7F", "#3DE0FF", "#5FE3B0", "#FFF6E0", "#A45CFF"], P = [];
    for (let i = 0; i < n; i++) P.push({ x: w / 2 + (Math.random() - 0.5) * w * 0.3, y: h * 0.35, vx: (Math.random() - 0.5) * 700, vy: -300 - Math.random() * 600, r: Math.random() * 6, vr: (Math.random() - 0.5) * 12, s: 5 + Math.random() * 6, c: cols[i % cols.length] });
    let last = performance.now(), life = 0;
    (function f(now) { const dt = Math.min(0.033, (now - last) / 1000); last = now; life += dt; x.clearRect(0, 0, w, h);
      for (const p of P) { p.vy += 900 * dt; p.vx *= 0.99; p.x += p.vx * dt; p.y += p.vy * dt; p.r += p.vr * dt; x.save(); x.translate(p.x, p.y); x.rotate(p.r); x.globalAlpha = Math.max(0, 1 - life / 2.6); x.fillStyle = p.c; x.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); x.restore(); }
      if (life < 2.6) requestAnimationFrame(f); else c.remove(); })(last);
  }
  function countUp(el) {
    const raw = el.textContent.trim(), m = raw.match(/^([\d,]+)(.*)$/); if (!m || el.dataset.counted === raw) return; const target = +m[1].replace(/,/g, ""), suffix = m[2]; if (!(target > 0)) return;
    el.dataset.counted = raw; if (REDUCED) return; const t0 = performance.now(), dur = Math.min(1100, 400 + target * 4); el.classList.add("counting");
    (function f(now) { const k = Math.min(1, (now - t0) / dur), v = Math.round(target * (1 - Math.pow(1 - k, 3))); el.textContent = (raw.includes(",") ? v.toLocaleString() : v) + suffix; if (k < 1) requestAnimationFrame(f); else { el.textContent = raw; el.classList.remove("counting"); } })(t0);
  }
  addEventListener("DOMContentLoaded", () => {
    const over = $("over"); if (over) new MutationObserver(() => { if (!over.hidden) { if (pendingRecord) { showRecord(pendingRecord); pendingRecord = null; } setTimeout(() => over.querySelectorAll(".stat b").forEach(countUp), 120); } else clearRecord(); }).observe(over, { attributes: true, attributeFilter: ["hidden"] });
    document.querySelectorAll(".pill b, .nums .sc").forEach((b) => { let prev = b.textContent; new MutationObserver(() => { if (b.textContent !== prev) { prev = b.textContent; b.classList.remove("bump"); void b.offsetWidth; b.classList.add("bump"); setTimeout(() => b.classList.remove("bump"), 160); } }).observe(b, { childList: true, characterData: true, subtree: true }); });
  });
  document.addEventListener("click", (e) => {
    const b = e.target.closest && e.target.closest(".btn, .iconbtn, .who, .opp button, .drink"); if (b && !b.disabled) { beep(1300, 1000, 0.025, "sine", 0.025); if (navigator.vibrate && !REDUCED) navigator.vibrate(8); }
    const a = e.target.closest && e.target.closest("a[href^='/']"); if (a && !e.defaultPrevented && !a.hasAttribute("data-lb") && !e.metaKey && !e.ctrlKey && !REDUCED) { e.preventDefault(); document.body.classList.add("leaving"); setTimeout(() => (location.href = a.href), 160); }
  });
  addEventListener("pageshow", () => document.body && document.body.classList.remove("leaving"));
  // ---------- online leaderboards ----------
  const GAME_NAMES = { flying: "Flying Pint", goggles: "Beer Goggles", darts: "Darts", pop: "Pub Pop", merge: "Snack Merge", crush: "Bar Crush", barman: "Barman Rush", stack: "Pint Stacker",
    bowling: "Bottle Bowling", pong: "Beer Pong", pool: "Pool", pour: "Perfect Pour", sort: "Drink Sort", quiz: "Pub Quiz", cards: "Higher or Lower", slots: "Fruit Machine" };
  const UNITS = { pop: "level", crush: "level", sort: "level", darts: "legs won", stack: "high", cards: "in a row", slots: "credits" };
  const LB_API = (store.get("lbApi") || "https://lastorders-api.onrender.com").replace(/\/+$/, "");
  function playerId() { let id = store.get("lbId"); if (!id || !/^[a-z0-9]{12,40}$/.test(id)) { id = ""; const a = new Uint8Array(14); (crypto.getRandomValues ? crypto.getRandomValues(a) : a.forEach((_, i) => (a[i] = Math.random() * 256))); for (const b of a) id += (b % 36).toString(36); store.set("lbId", id); } return id; }
  async function api(path, body) {
    const r = await fetch(LB_API + path, { method: body ? "POST" : "GET", headers: body ? { "content-type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout ? AbortSignal.timeout(65000) : undefined });
    const j = await r.json().catch(() => ({})); if (!r.ok) throw Object.assign(new Error(j.error || "Scoreboard problem."), { status: r.status }); return j;
  }
  let flushing = false;
  async function flush() {
    if (flushing) return; flushing = true;
    try {
      if (store.get("lbNamePending") === "1" && store.get("lbName")) {
        try { const j = await api("/api/name", { id: playerId(), name: store.get("lbName") }); store.set("lbName", j.name); store.set("lbNamePending", "0"); }
        catch (e) { if (e.status === 400 || e.status === 409) { store.set("lbName", ""); store.set("lbNamePending", "0"); store.set("nameAsked", "0"); } }
      }
      let q = JSON.parse(store.get("lbQueue") || "[]");
      while (q.length) { const it = q[0]; try { const j = await api("/api/score", { game: it.game, score: it.score, id: playerId(), name: store.get("lbName") || undefined }); if (j.name) store.set("lbName", j.name); note(j, it.game); } catch (e) { if (e.status === 400) {} else break; } q.shift(); store.set("lbQueue", JSON.stringify(q)); q = JSON.parse(store.get("lbQueue") || "[]"); }
    } catch (e) {} flushing = false;
  }
  function submit(game, score) { score = Math.floor(score); if (!GAME_NAMES[game] || !(score > 0)) return; let q = []; try { q = JSON.parse(store.get("lbQueue") || "[]"); } catch (e) {} q = q.filter((x) => x.game !== game || x.score > score); if (!q.some((x) => x.game === game && x.score >= score)) q.push({ game, score }); store.set("lbQueue", JSON.stringify(q.slice(-30))); flush(); }
  function note(j, game) {
    if (!j || !j.today) return; const el = document.createElement("div"); el.className = "lb-note";
    el.innerHTML = `${j.todayBest ? "New best today! " : ""}You're <b>#${j.today.r}</b> today on ${GAME_NAMES[game]}` + (j.all ? ` · <b>#${j.all.r}</b> all time` : "") + ` <button type="button" data-lb="${game}">See board</button>`;
    document.body.appendChild(el); setTimeout(() => el.classList.add("on"), 20); setTimeout(() => { el.classList.remove("on"); setTimeout(() => el.remove(), 400); }, 6000);
  }
  const LBCSS = `.lb-wrap{position:fixed;inset:0;z-index:100;background:#050612cc;display:flex;align-items:center;justify-content:center;padding:14px;font-family:Inter,system-ui,sans-serif;color:#F4F1FF}
.lb-box{width:min(420px,100%);max-height:92vh;display:flex;flex-direction:column;gap:10px;background:#12153A;border:2px solid #2C2F66;border-radius:22px;padding:16px;box-shadow:0 20px 60px #000c}
.lb-head{display:flex;align-items:center;gap:8px}.lb-head h3{margin:0;flex:1;font:400 22px Bungee,Impact,sans-serif;color:#FFB627}
.lb-x{width:44px;height:44px;border-radius:12px;border:1px solid #2C2F66;background:#1C2150;color:#F4F1FF;font-size:20px;cursor:pointer}
.lb-box select,.lb-box input{min-height:44px;border-radius:12px;border:1px solid #2C2F66;background:#0A0E24;color:#F4F1FF;font:600 15px Inter,sans-serif;padding:0 12px;width:100%;box-sizing:border-box}
.lb-tabs{display:grid;grid-template-columns:1fr 1fr;gap:6px}.lb-tabs button{min-height:40px;border-radius:12px;border:1px solid #2C2F66;background:#0A0E24;color:#B9B6D9;font:800 14px Inter,sans-serif;cursor:pointer}.lb-tabs button.on{background:#FFB627;color:#2A1400;border-color:#FFB627}
.lb-list{overflow-y:auto;min-height:120px;display:flex;flex-direction:column;gap:4px;margin:0;padding:0;list-style:none}
.lb-list li{display:grid;grid-template-columns:38px 1fr auto;gap:8px;align-items:center;padding:8px 10px;border-radius:10px;background:#0A0E24;font-size:15px}
.lb-list li.me{background:#2A2350;outline:2px solid #FFB627}.lb-list .r{font:400 15px Bungee,Impact,sans-serif;color:#B9B6D9}.lb-list li:nth-child(1) .r{color:#FFD24A}.lb-list li:nth-child(2) .r{color:#D8DEE9}.lb-list li:nth-child(3) .r{color:#E0975A}
.lb-list .s{font:400 16px Bungee,Impact,sans-serif;color:#FFF6E0;font-variant-numeric:tabular-nums}.lb-list .n{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lb-msg{font-size:14px;color:#B9B6D9;text-align:center;padding:14px 4px}.lb-you{font-size:13px;color:#B9B6D9;text-align:center}
.lb-name{display:flex;gap:6px}.lb-name button{min-height:44px;border-radius:12px;border:0;background:#FFB627;color:#2A1400;font:400 15px Bungee,Impact,sans-serif;padding:0 14px;cursor:pointer;white-space:nowrap}
.lb-err{font-size:13px;color:#FF7A8E;min-height:1em}
.lb-as{font-size:13px;color:#B9B6D9;text-align:center}.lb-as b{color:#FFF6E0}.lb-as button{border:0;background:none;color:#FFB627;font:800 13px Inter,sans-serif;text-decoration:underline;cursor:pointer;padding:6px 2px}
.nm-box{text-align:center;gap:12px;padding:22px 18px;border-color:#FFB627;animation:nmIn .45s cubic-bezier(.2,1.4,.4,1)}.nm-emoji{font-size:44px;line-height:1}
.nm-h{margin:0;font:400 21px/1.15 Bungee,Impact,sans-serif;color:#FFB627}.nm-p{margin:0;font-size:14px;line-height:1.45;color:#B9B6D9}
.nm-box input{text-align:center;font-size:18px;min-height:52px}.nm-go{min-height:52px;border-radius:14px;border:0;background:#FFB627;color:#2A1400;font:400 19px Bungee,Impact,sans-serif;cursor:pointer;box-shadow:0 4px 0 #A86A00}.nm-go:disabled{opacity:.6}
.nm-later{border:0;background:none;color:#8F8CB8;font:700 13px Inter,sans-serif;cursor:pointer;padding:6px}
@keyframes nmIn{from{transform:translateY(24px) scale(.94);opacity:0}to{transform:none;opacity:1}}
.lb-note{position:fixed;left:50%;bottom:calc(16px + env(safe-area-inset-bottom,0px));transform:translate(-50%,30px);opacity:0;transition:.35s;z-index:90;background:#12153Aee;border:1px solid #FFB627;border-radius:14px;padding:10px 12px;font:600 13px Inter,sans-serif;color:#F4F1FF;width:max-content;max-width:calc(100% - 32px);text-align:center}
.lb-note.on{opacity:1;transform:translate(-50%,0)}.lb-note b{color:#FFB627}.lb-note button{margin-left:6px;border:0;border-radius:8px;background:#FFB627;color:#2A1400;font:800 12px Inter,sans-serif;padding:6px 8px;cursor:pointer}
.lb-btn{background:#1C2150!important;color:#F4F1FF!important}`;
  function openBoard(game) {
    if (!document.getElementById("lbcss")) { const st = document.createElement("style"); st.id = "lbcss"; st.textContent = LBCSS; document.head.appendChild(st); }
    const old = document.getElementById("lbWrap"); if (old) old.remove();
    let period = "today"; game = GAME_NAMES[game] ? game : "flying";
    const w = document.createElement("div"); w.className = "lb-wrap"; w.id = "lbWrap"; w.setAttribute("role", "dialog"); w.setAttribute("aria-modal", "true"); w.setAttribute("aria-label", "Leaderboard");
    w.innerHTML = `<div class="lb-box"><div class="lb-head"><h3>LEADERBOARD</h3><button class="lb-x" type="button" aria-label="Close">✕</button></div>
      <label for="lbGame" style="position:absolute;left:-9999px">Game</label><select id="lbGame">${Object.entries(GAME_NAMES).map(([k, v]) => `<option value="${k}" ${k === game ? "selected" : ""}>${v}</option>`).join("")}</select>
      <div class="lb-tabs" role="tablist"><button type="button" role="tab" data-p="today" class="on">Today</button><button type="button" role="tab" data-p="all">All time</button></div>
      <ol class="lb-list" id="lbList"></ol><div class="lb-you" id="lbYou"></div>
      <div class="lb-as" id="lbAs" ${realName() ? "" : "hidden"}>Playing as <b>${esc(realName() || "")}</b> · <button type="button" id="lbChange">Change name</button></div>
      <div class="lb-name" id="lbNameRow" ${realName() ? "hidden" : ""}><label for="lbNick" style="position:absolute;left:-9999px">Your nickname</label><input id="lbNick" maxlength="16" placeholder="Your nickname" autocomplete="nickname" value="${(realName() || "").replace(/"/g, "")}"><button type="button" id="lbSave">SAVE</button></div><div class="lb-err" id="lbErr" aria-live="polite"></div></div>`;
    document.body.appendChild(w);
    const close = () => w.remove(); w.addEventListener("click", (e) => { if (e.target === w) close(); }); w.querySelector(".lb-x").addEventListener("click", close);
    const unit = () => UNITS[game] || "";
    async function load() {
      const L = w.querySelector("#lbList"), Y = w.querySelector("#lbYou"); L.innerHTML = `<div class="lb-msg">Loading… The scoreboard can take up to a minute to wake up the first time.</div>`; Y.textContent = "";
      try { flush(); const j = await api(`/api/top?game=${game}&period=${period}&id=${playerId()}`);
        L.innerHTML = j.top.length ? j.top.map((r) => `<li class="${r.me ? "me" : ""}"><span class="r">${r.r}</span><span class="n">${esc(r.n)}${r.me ? " (you)" : ""}</span><span class="s">${r.s.toLocaleString()}</span></li>`).join("") : `<div class="lb-msg">No scores ${period === "today" ? "today" : "yet"}. Be the first!</div>`;
        Y.textContent = j.you ? `You're #${j.you.r} of ${j.total} with ${j.you.s.toLocaleString()} ${unit()}` : j.total ? `${j.total} players. Play a game to get on the board.` : "";
      } catch (e) { L.innerHTML = `<div class="lb-msg">Couldn't reach the scoreboard just now. Your scores are saved on your phone and will be sent next time.</div>`; }
    }
    w.querySelector("#lbGame").addEventListener("change", (e) => { game = e.target.value; load(); });
    w.querySelectorAll(".lb-tabs button").forEach((b) => b.addEventListener("click", () => { period = b.dataset.p; w.querySelectorAll(".lb-tabs button").forEach((x) => x.classList.toggle("on", x === b)); load(); }));
    w.querySelector("#lbChange").addEventListener("click", () => { w.querySelector("#lbAs").hidden = true; w.querySelector("#lbNameRow").hidden = false; w.querySelector("#lbNick").focus(); });
    w.querySelector("#lbSave").addEventListener("click", async () => { const n = w.querySelector("#lbNick").value.trim(), E = w.querySelector("#lbErr"); E.style.color = "#B9B6D9"; E.textContent = "Saving…";
      try { const j = await api("/api/name", { id: playerId(), name: n }); store.set("lbName", j.name); store.set("lbNamePending", "0"); store.set("nameAsked", "1"); E.style.color = "#5FE3B0"; E.textContent = "Saved. You're " + j.name + " now."; const as = w.querySelector("#lbAs"); as.querySelector("b").textContent = j.name; as.hidden = false; w.querySelector("#lbNameRow").hidden = true; load(); } catch (e) { E.style.color = "#FF7A8E"; E.textContent = e.message; } });
    load();
  }
  // a "Punter 1234" name is the scoreboard's placeholder, not one the player chose
  const realName = () => { const n = store.get("lbName") || ""; return n && !/^Punter \d+$/.test(n) ? n : ""; };
  function askName() {
    if (realName() || store.get("nameAsked") === "1" || store.get("lo18") !== "1" || document.getElementById("nameWrap") || document.getElementById("lbWrap")) return;
    if (!document.getElementById("lbcss")) { const st = document.createElement("style"); st.id = "lbcss"; st.textContent = LBCSS; document.head.appendChild(st); }
    const w = document.createElement("div"); w.className = "lb-wrap"; w.id = "nameWrap"; w.setAttribute("role", "dialog"); w.setAttribute("aria-modal", "true"); w.setAttribute("aria-label", "Pick a nickname");
    w.innerHTML = `<div class="lb-box nm-box"><div class="nm-emoji" aria-hidden="true">🍺</div><h3 class="nm-h">WHAT DO THEY CALL YOU DOWN THE PUB?</h3>
      <p class="nm-p">Pick a nickname for the leaderboards so your mates can see who's top of the pub. You only do this once.</p>
      <label for="nmIn" style="position:absolute;left:-9999px">Nickname</label><input id="nmIn" maxlength="16" placeholder="e.g. Robbo" autocomplete="nickname">
      <button type="button" class="nm-go" id="nmGo">LET'S GO</button><div class="lb-err" id="nmErr" aria-live="polite"></div>
      <button type="button" class="nm-later" id="nmLater">Maybe later</button></div>`;
    document.body.appendChild(w); setTimeout(() => { try { w.querySelector("#nmIn").focus(); } catch (e) {} }, 250);
    const close = () => { store.set("nameAsked", "1"); w.remove(); };
    w.querySelector("#nmLater").addEventListener("click", close);
    const go = async () => {
      const n = w.querySelector("#nmIn").value.replace(/\s+/g, " ").trim(), E = w.querySelector("#nmErr");
      if (n.length < 2) { E.style.color = "#FF7A8E"; E.textContent = "At least 2 letters, go on."; return; }
      E.style.color = "#B9B6D9"; E.textContent = "Saving…"; w.querySelector("#nmGo").disabled = true;
      try {
        // the free scoreboard can be asleep: wait 8 seconds at most, then keep the name and send it later
        const j = await Promise.race([api("/api/name", { id: playerId(), name: n }), new Promise((_, rej) => setTimeout(() => rej(Object.assign(new Error("slow"), { slow: true })), 8000))]);
        store.set("lbName", j.name); store.set("lbNamePending", "0"); close(); toastName(j.name);
      } catch (e) {
        if (e.status === 400 || e.status === 409) { E.style.color = "#FF7A8E"; E.textContent = e.message; w.querySelector("#nmGo").disabled = false; return; }
        store.set("lbName", n); store.set("lbNamePending", "1"); close(); toastName(n);
      }
    };
    w.querySelector("#nmGo").addEventListener("click", go); w.querySelector("#nmIn").addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });
  }
  function toastName(n) { const el = document.createElement("div"); el.className = "lb-note"; el.innerHTML = `Cheers, <b>${esc(n)}</b>. Good luck tonight! 🍻`; document.body.appendChild(el); setTimeout(() => el.classList.add("on"), 20); setTimeout(() => { el.classList.remove("on"); setTimeout(() => el.remove(), 400); }, 3500); }
  addEventListener("DOMContentLoaded", () => {
    setTimeout(askName, 600);
    // straight after someone says yes to the 18+ question
    document.addEventListener("click", (e) => { if (e.target && e.target.id === "yes") setTimeout(askName, 450); });
  });
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  document.addEventListener("click", (e) => { const el = e.target.closest && e.target.closest("[data-lb]"); if (!el) return; e.preventDefault(); openBoard(el.dataset.lb); });
  addEventListener("load", () => setTimeout(flush, 1500));
  // ---------- drawing helpers ----------
  function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  function shade(hex, amt) { const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255; const f = amt < 0 ? 0 : 255, t = Math.abs(amt); r = Math.round((f - r) * t + r); g = Math.round((f - g) * t + g); b = Math.round((f - b) * t + b); return `rgb(${r},${g},${b})`; }
  // a little particle system for pops and splashes
  function particles() {
    const list = [];
    return {
      burst(x, y, color, n = 14, speed = 160, size = 3.5) { if (REDUCED) n = Math.ceil(n / 3); for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, s = speed * (0.4 + Math.random() * 0.8); list.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40, life: 0.5 + Math.random() * 0.4, t: 0, color, size: size * (0.6 + Math.random() * 0.8) }); } },
      ring(x, y, color, r = 30) { list.push({ x, y, ring: true, r0: r * 0.3, r1: r, life: 0.35, t: 0, color }); },
      text(x, y, txt, color = "#FFF6E0", size = 18) { list.push({ x, y, txt, color, size, life: 0.9, t: 0, vy: -50 }); },
      step(dt) { for (let i = list.length - 1; i >= 0; i--) { const p = list[i]; p.t += dt; if (p.t >= p.life) { list.splice(i, 1); continue; } if (!p.ring && !p.txt) { p.vy += 420 * dt; p.x += p.vx * dt; p.y += p.vy * dt; } if (p.txt) p.y += p.vy * dt; } },
      draw(g) { for (const p of list) { const k = 1 - p.t / p.life; g.globalAlpha = Math.max(0, k);
        if (p.ring) { g.strokeStyle = p.color; g.lineWidth = 3 * k; g.beginPath(); g.arc(p.x, p.y, p.r0 + (p.r1 - p.r0) * (1 - k), 0, 7); g.stroke(); }
        else if (p.txt) { g.fillStyle = p.color; g.font = `${p.size}px Bungee, Impact, sans-serif`; g.textAlign = "center"; g.textBaseline = "middle"; g.lineWidth = 4; g.strokeStyle = "#000"; g.strokeText(p.txt, p.x, p.y); g.fillText(p.txt, p.x, p.y); }
        else { g.fillStyle = p.color; g.beginPath(); g.arc(p.x, p.y, p.size * k, 0, 7); g.fill(); } }
        g.globalAlpha = 1; },
      get count() { return list.length; },
    };
  }
  return { art, backdrop, record, stopMusic, confetti, submit, openBoard, playerId, GAME_NAMES, $, store, REDUCED, ctx, beep, noise, pop, thud, smash, cheer, fanfare, sad, burp, music, wireMute, fit, show, gate, toast, share, best, rr, shade, particles };
})();
