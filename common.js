// Shared kit for the Last Orders pub games: storage, sound, screen fitting, 18+ gate, sharing.
window.PUB = (() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };
  const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---------- sound ----------
  let AC = null, MASTER = null, MUSIC = null, muted = store.get("loMute") === "1";
  function ctx() {
    if (!AC) { AC = new (window.AudioContext || window.webkitAudioContext)(); MASTER = AC.createGain(); MASTER.gain.value = muted ? 0 : 1; MASTER.connect(AC.destination); MUSIC = AC.createGain(); MUSIC.gain.value = 0.45; MUSIC.connect(MASTER); }
    if (AC.state === "suspended") AC.resume(); return AC;
  }
  function beep(f1, f2, dur, type = "square", vol = 0.06, delay = 0) {
    try { const A = ctx(), o = A.createOscillator(), g = A.createGain(), t0 = A.currentTime + delay; o.type = type; o.frequency.setValueAtTime(f1, t0); o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t0 + dur); g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur); o.connect(g).connect(MASTER); o.start(t0); o.stop(t0 + dur + 0.02); } catch (e) {}
  }
  function noise(dur, vol, freq, delay = 0, q = 0.8) {
    try { const A = ctx(), n = Math.floor(A.sampleRate * dur), buf = A.createBuffer(1, n, A.sampleRate), d = buf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      const s = A.createBufferSource(), f = A.createBiquadFilter(), g = A.createGain(), t0 = A.currentTime + delay; s.buffer = buf; f.type = "bandpass"; f.frequency.value = freq; f.Q.value = q;
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + Math.min(0.03, dur / 4)); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur); s.connect(f).connect(g).connect(MASTER); s.start(t0); s.stop(t0 + dur); } catch (e) {}
  }
  const pop = (pitch = 1, delay = 0) => { beep(700 * pitch, 1400 * pitch, 0.07, "sine", 0.09, delay); noise(0.05, 0.05, 3000 * pitch, delay); };
  const thud = () => { beep(160, 60, 0.12, "sine", 0.12); noise(0.08, 0.06, 500); };
  const smash = () => { noise(0.35, 0.18, 3500, 0, 0.6); noise(0.25, 0.1, 6000, 0.05, 0.6); beep(1800, 900, 0.1, "triangle", 0.04); };
  const cheer = (big) => { noise(big ? 2 : 1, big ? 0.3 : 0.16, 1200); noise(big ? 1.8 : 0.9, big ? 0.18 : 0.08, 600, 0.1); if (big) [0, 0.14, 0.28].forEach((d, i) => beep([523, 659, 784][i], [523, 659, 784][i], 0.25, "square", 0.04, d)); };
  const fanfare = () => [523, 659, 784, 1047].forEach((f, i) => beep(f, f * 1.01, 0.18, "square", 0.05, i * 0.1));
  const sad = () => { beep(392, 370, 0.25, "triangle", 0.06); beep(330, 311, 0.25, "triangle", 0.06, 0.25); beep(262, 196, 0.5, "triangle", 0.06, 0.5); };
  function burp() {
    try { const A = ctx(), t0 = A.currentTime, len = 0.55 + Math.random() * 0.35;
      const o = A.createOscillator(), lfo = A.createOscillator(), lg = A.createGain(), am = A.createGain(), f = A.createBiquadFilter(), g = A.createGain();
      o.type = "sawtooth"; o.frequency.setValueAtTime(95 + Math.random() * 25, t0); o.frequency.linearRampToValueAtTime(62, t0 + len);
      lfo.type = "square"; lfo.frequency.setValueAtTime(26 + Math.random() * 10, t0); lg.gain.value = 0.5; am.gain.value = 0.5; lfo.connect(lg).connect(am.gain);
      f.type = "lowpass"; f.frequency.setValueAtTime(900, t0); f.frequency.linearRampToValueAtTime(380, t0 + len); f.Q.value = 6;
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.32, t0 + 0.05); g.gain.setValueAtTime(0.28, t0 + len * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t0 + len);
      o.connect(am).connect(f).connect(g).connect(MASTER); o.start(t0); lfo.start(t0); o.stop(t0 + len + 0.05); lfo.stop(t0 + len + 0.05); } catch (e) {}
  }
  // background music: give it chords, a tune (MIDI numbers, 0 = rest) and a tempo
  let musicTimer = null;
  function music(chords, tune, bpm = 132) {
    try { ctx(); if (musicTimer) return; const N = (n) => 440 * Math.pow(2, (n - 69) / 12), STEP = 60 / bpm / 2; let step = 0, next = AC.currentTime + 0.05;
      const note = (f, at, dur, type, vol) => { const o = AC.createOscillator(), g = AC.createGain(); o.type = type; o.frequency.value = f; g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(vol, at + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, at + dur); o.connect(g).connect(MUSIC); o.start(at); o.stop(at + dur + 0.02); };
      const sched = () => { while (next < AC.currentTime + 0.25) { const ch = chords[Math.floor(step / 8) % chords.length], b = step % 8;
        if (b % 4 === 0) note(N(ch[0] - 12), next, STEP * 1.6, "triangle", 0.1); if (b % 4 === 2) note(N(ch[2] - 12), next, STEP * 1.6, "triangle", 0.08);
        if (b % 2 === 1) for (const c of ch) note(N(c), next, STEP * 0.6, "square", 0.011); const m = tune[step % tune.length]; if (m) note(N(m), next, STEP * 0.9, "triangle", 0.05);
        next += STEP; step++; } };
      sched(); musicTimer = setInterval(sched, 100); } catch (e) {}
  }
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
  const best = (key, v) => { const cur = +(store.get(key) || 0); if (v != null && v > cur) { store.set(key, String(v)); return v; } return cur; };
  if ("serviceWorker" in navigator) addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));

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
  return { $, store, REDUCED, ctx, beep, noise, pop, thud, smash, cheer, fanfare, sad, burp, music, wireMute, fit, show, gate, toast, share, best, rr, shade, particles };
})();
