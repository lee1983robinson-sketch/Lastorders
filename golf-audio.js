// Pub Golf sound: every effect and every note is synthesised live (no recordings, nothing copyrighted).
// Two buses, music and effects, each with its own volume, both behind the site's mute button.
const PUB = window.PUB;
let A = null, NB = null, sfxBus = null, musBus = null, ambBus = null;
const vol = { music: 0.6, sfx: 0.9 };
function init() {
  if (A) { if (A.state === "suspended") A.resume(); return A; }
  const b = PUB.bus(); A = b.ac; NB = b.noise;
  sfxBus = A.createGain(); sfxBus.gain.value = vol.sfx; sfxBus.connect(b.master);
  ambBus = A.createGain(); ambBus.gain.value = vol.sfx * 0.6; ambBus.connect(b.master);
  musBus = A.createGain(); musBus.gain.value = vol.music * 0.55; musBus.connect(b.master);
  return A;
}
export function setVolumes(m, s) { vol.music = m; vol.sfx = s; if (A) { musBus.gain.setTargetAtTime(m * 0.55, A.currentTime, 0.05); sfxBus.gain.setTargetAtTime(s, A.currentTime, 0.05); ambBus.gain.setTargetAtTime(s * 0.6, A.currentTime, 0.05); } }
export const audioReady = () => { try { init(); return true; } catch (e) { return false; } };

// ---------------------------------------------------------------- building blocks
function tone(f1, f2, dur, type = "sine", v = 0.1, at = 0, bus = sfxBus, att = 0.004) {
  const t = A.currentTime + at, o = A.createOscillator(), g = A.createGain(); o.type = type; o.frequency.setValueAtTime(f1, t); if (f2 !== f1) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + att); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g).connect(bus); o.start(t); o.stop(t + dur + 0.02);
}
function nz(dur, v, f, q = 1, at = 0, type = "bandpass", bus = sfxBus, att = 0.003) {
  const t = A.currentTime + at, s = A.createBufferSource(), fl = A.createBiquadFilter(), g = A.createGain(); s.buffer = NB; fl.type = type; fl.frequency.value = f; fl.Q.value = q;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + att); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); s.connect(fl).connect(g).connect(bus); s.start(t, Math.random() * 2); s.stop(t + dur + 0.02);
}
const safe = (f) => (...a) => { try { init(); f(...a); } catch (e) {} };

// ---------------------------------------------------------------- effects
export const sfx = {
  strike: safe((p) => { tone(1500, 700, 0.05, "triangle", 0.12 + p * 0.12); tone(420, 260, 0.09, "sine", 0.1 + p * 0.1); nz(0.03, 0.12 + p * 0.1, 3800, 0.8); }),
  // impact by material, louder for harder hits
  hit: safe((mat, sp) => {
    const v = Math.min(1, sp / 4) * 0.9 + 0.08;
    if (mat === "wood") { tone(260 + Math.random() * 60, 140, 0.09, "sine", 0.22 * v); nz(0.05, 0.12 * v, 900, 1.5); }
    else if (mat === "metal") { const f = 820 + Math.random() * 80; [1, 1.47, 2.09, 2.76].forEach((k, i) => tone(f * k, f * k * 0.998, 0.35 - i * 0.06, "sine", 0.06 * v / (i + 1))); nz(0.03, 0.08 * v, 4000, 1); }
    else if (mat === "glass") { const f = 2300 + Math.random() * 400; [1, 1.58, 2.31].forEach((k, i) => tone(f * k, f * k, 0.22 - i * 0.05, "sine", 0.06 * v / (i + 1))); nz(0.02, 0.06 * v, 6000, 1); }
    else if (mat === "barrel") { tone(120, 85, 0.22, "sine", 0.3 * v); tone(240, 170, 0.12, "triangle", 0.08 * v); nz(0.12, 0.12 * v, 320, 5); }
    else if (mat === "rubber") { tone(180, 90, 0.12, "sine", 0.26 * v); nz(0.04, 0.06 * v, 600, 1); }
    else if (mat === "bumper") { tone(520, 1040, 0.08, "square", 0.05 * v); tone(260, 260, 0.18, "triangle", 0.12 * v); nz(0.04, 0.1 * v, 2000, 1); }
    else if (mat === "chip") { nz(0.03, 0.18 * v, 3200, 3); nz(0.03, 0.12 * v, 4200, 3, 0.03); }
    else if (mat === "hay") { nz(0.14, 0.14 * v, 500, 0.6, 0, "lowpass"); }
    else if (mat === "ball") { tone(1800, 1600, 0.05, "sine", 0.16 * v); nz(0.02, 0.14 * v, 5000, 2); }
    else if (mat === "stone") { nz(0.04, 0.16 * v, 2200, 1.2); tone(400, 300, 0.05, "sine", 0.08 * v); }
    else { tone(300, 160, 0.08, "sine", 0.2 * v); nz(0.04, 0.08 * v, 1200, 1); }
  }),
  land: safe((sp) => { tone(110, 60, 0.12, "sine", Math.min(0.3, 0.08 + sp * 0.05)); nz(0.06, 0.08, 400, 1); }),
  cup: safe(() => { tone(1900, 1800, 0.12, "sine", 0.1); tone(1300, 1250, 0.15, "sine", 0.08, 0.09); tone(320, 180, 0.12, "sine", 0.22, 0.2); nz(0.04, 0.1, 2500, 2, 0.2); tone(900, 880, 0.06, "sine", 0.05, 0.32); tone(900, 880, 0.05, "sine", 0.03, 0.4); }),
  splash: safe(() => { nz(0.5, 0.3, 900, 0.7, 0, "lowpass"); nz(0.3, 0.14, 2400, 1, 0.05); tone(600, 200, 0.2, "sine", 0.05, 0.02); }),
  drop: safe(() => { tone(400, 80, 0.5, "sine", 0.12); nz(0.2, 0.1, 300, 1, 0.45); }),
  rustle: safe(() => { nz(0.45, 0.2, 3000, 0.5, 0, "highpass"); nz(0.3, 0.1, 1200, 1, 0.1); }),
  pocket: safe(() => { tone(700, 650, 0.05, "sine", 0.14); tone(240, 150, 0.2, "sine", 0.22, 0.06); nz(0.08, 0.1, 900, 2, 0.08); }),
  bell: safe(() => { const f = 523; [[1, 0.2, 2.4], [2.0, 0.08, 1.8], [2.4, 0.07, 1.6], [3.0, 0.05, 1.2], [4.2, 0.03, 0.9], [0.5, 0.06, 2.2]].forEach(([k, v, d]) => tone(f * k, f * k * 0.999, d, "sine", v)); }),
  creak: safe((v = 1) => { tone(90 + Math.random() * 20, 70, 0.35, "sawtooth", 0.012 * v, 0, sfxBus, 0.08); nz(0.3, 0.02 * v, 700, 6); }),
  whump: safe((v = 1) => { nz(0.25, 0.05 * v, 250, 0.8, 0, "lowpass"); }),
  clunk: safe(() => { tone(140, 90, 0.12, "square", 0.04); nz(0.08, 0.1, 500, 2); }),
  rumble: safe((d = 0.5) => { nz(d, 0.05, 160, 0.8, 0, "lowpass", sfxBus, 0.1); }),
  pipeIn: safe(() => { nz(0.6, 0.12, 700, 4); tone(300, 600, 0.5, "sine", 0.05); }),
  pipeOut: safe(() => { nz(0.25, 0.14, 1200, 3); tone(500, 250, 0.2, "triangle", 0.05); }),
  whoosh: safe(() => { nz(0.5, 0.12, 900, 1.2, 0, "bandpass", sfxBus, 0.15); }),
  bonus: safe(() => { [0, 0.07, 0.14, 0.21].forEach((d, i) => tone(784 * Math.pow(1.26, i), 784 * Math.pow(1.26, i), 0.18, "triangle", 0.07, d)); }),
  tick: safe(() => tone(1200, 1200, 0.02, "square", 0.025)),
  click: safe(() => { tone(1400, 1000, 0.03, "sine", 0.05); }),
  card: safe((i = 0) => { tone(660 + i * 30, 660 + i * 30, 0.05, "triangle", 0.04); }),
  // applause: lots of tiny hand claps, plus whoops for big moments
  applause: safe((big = false, dur = 2.2) => { const n = big ? 160 : 70; for (let i = 0; i < n; i++) { const at = Math.pow(Math.random(), 0.8) * dur; nz(0.03, (big ? 0.06 : 0.045) * (1 - at / dur * 0.7), 1400 + Math.random() * 1600, 1.8, at); } if (big) { nz(dur, 0.12, 900, 0.6, 0, "bandpass", sfxBus, 0.3); for (let i = 0; i < 5; i++) { const f = 700 + Math.random() * 500, at = Math.random() * 1.2; tone(f, f * 1.6, 0.4, "sine", 0.03, at, sfxBus, 0.05); } } }),
  fanfare: safe(() => { const ch = [[60, 64, 67, 72], [65, 69, 72, 77], [67, 71, 74, 79], [72, 76, 79, 84]]; ch.forEach((c, i) => c.forEach((m) => { const f = 440 * Math.pow(2, (m - 69) / 12); const t = A.currentTime + i * 0.16, o = A.createOscillator(), fl = A.createBiquadFilter(), g = A.createGain(); o.type = "sawtooth"; o.frequency.value = f; fl.type = "lowpass"; fl.frequency.setValueAtTime(800, t); fl.frequency.linearRampToValueAtTime(3200, t + 0.1); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.035, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + (i === 3 ? 1.4 : 0.3)); o.connect(fl).connect(g).connect(sfxBus); o.start(t); o.stop(t + 1.5); })); nz(1.4, 0.06, 7000, 0.7, 0.48, "highpass"); }),
  sad: safe(() => { tone(392, 370, 0.3, "triangle", 0.08); tone(349, 330, 0.3, "triangle", 0.08, 0.3); tone(294, 262, 0.6, "triangle", 0.08, 0.6); }),
};

// ---------------------------------------------------------------- the rolling ball: a loop whose loudness and colour follow speed and surface
export function roller() {
  let src = null, g = null, f = null, f2 = null;
  return { set(v, rate = 1, surf = "turf") { try { init(); if (!src) { src = A.createBufferSource(); src.buffer = NB; src.loop = true; f = A.createBiquadFilter(); f.type = "lowpass"; f2 = A.createBiquadFilter(); f2.type = "peaking"; f2.Q.value = 3; f2.gain.value = 0; g = A.createGain(); g.gain.value = 0; src.connect(f).connect(f2).connect(g).connect(sfxBus); src.start(); }
    const t = A.currentTime, k = { turf: [380, 0, 0.6], felt: [300, 0, 0.45], wood: [900, 9, 1.4], metal: [1600, 12, 1.2], glass: [2200, 10, 0.9] }[surf] || [380, 0, 0.6];
    g.gain.setTargetAtTime(v * k[2], t, 0.04); f.frequency.setTargetAtTime(k[0] * (0.6 + rate * 0.5), t, 0.05); f2.frequency.setTargetAtTime(k[0] * 0.8, t, 0.05); f2.gain.setTargetAtTime(k[1], t, 0.05); } catch (e) {} } };
}

// ---------------------------------------------------------------- ambience: pub chatter, garden birds, sea, wind, crowds
let amb = null;
export function ambience(kind) {
  try { init(); } catch (e) { return; }
  stopAmbience();
  const nodes = [], timers = [], out = A.createGain(); out.gain.value = 0; out.gain.setTargetAtTime(1, A.currentTime, 0.8); out.connect(ambBus);
  const loopNoise = (type, freq, q, gain) => { const s = A.createBufferSource(); s.buffer = NB; s.loop = true; const fl = A.createBiquadFilter(); fl.type = type; fl.frequency.value = freq; fl.Q.value = q; const g = A.createGain(); g.gain.value = gain; s.connect(fl).connect(g).connect(out); s.start(0, Math.random() * 2); nodes.push(s); return g; };
  const lfo = (param, rate, depth) => { const o = A.createOscillator(), g = A.createGain(); o.frequency.value = rate; g.gain.value = depth; o.connect(g).connect(param); o.start(); nodes.push(o); };
  const every = (ms, f) => { const id = setInterval(() => { try { f(); } catch (e) {} }, ms); timers.push(id); };
  const chatter = (lvl = 1) => { for (const [f, q, v, r] of [[420, 2.5, 0.05, 0.37], [800, 3, 0.04, 0.53], [1300, 3, 0.02, 0.71], [260, 2, 0.04, 0.23]]) { const g = loopNoise("bandpass", f, q, v * lvl); lfo(g.gain, r + Math.random() * 0.3, v * lvl * 0.7); }
    every(900, () => { if (Math.random() < 0.35) { const f = 2600 + Math.random() * 1600; tone(f, f, 0.12, "sine", 0.015 * lvl, Math.random() * 0.5, out); } if (Math.random() < 0.18) { const f = 220 + Math.random() * 160; for (let i = 0; i < 3; i++) tone(f * (1 + i * 0.04), f * 0.9, 0.09, "sawtooth", 0.006 * lvl, i * 0.13, out, 0.02); } }); };
  const birds = () => every(1300, () => { if (Math.random() < 0.55) { const f = 2400 + Math.random() * 1800, n = 2 + (Math.random() * 4 | 0); for (let i = 0; i < n; i++) tone(f, f * (1.2 + Math.random() * 0.3), 0.07, "sine", 0.012, i * 0.1, out); } });
  const sea = () => { const g = loopNoise("lowpass", 500, 0.7, 0.05); lfo(g.gain, 0.12, 0.045); every(4000, () => { if (Math.random() < 0.5) { const f = 1500 + Math.random() * 400; tone(f, f * 0.7, 0.3, "sine", 0.01, 0, out); tone(f * 0.9, f * 0.6, 0.35, "sine", 0.01, 0.35, out); } }); };
  const wind = (v = 0.04) => { const g = loopNoise("bandpass", 400, 0.5, v); lfo(g.gain, 0.08, v * 0.8); };
  const city = () => { loopNoise("lowpass", 200, 0.7, 0.04); every(5000, () => { if (Math.random() < 0.4) { tone(520, 500, 0.6, "square", 0.004, 0, out, 0.1); } }); };
  const crowd = () => { chatter(1.6); const g = loopNoise("bandpass", 1000, 0.6, 0.02); lfo(g.gain, 0.2, 0.015); };
  const fire = () => every(300, () => { if (Math.random() < 0.6) nz(0.03, 0.02, 2500 + Math.random() * 2000, 2, Math.random() * 0.2, "bandpass", out); });
  const drips = () => every(1700, () => { if (Math.random() < 0.5) { const f = 1200 + Math.random() * 900; tone(f, f * 1.6, 0.08, "sine", 0.02, 0, out); } });
  const hum = () => { const o = A.createOscillator(), g = A.createGain(); o.frequency.value = 55; o.type = "sawtooth"; const fl = A.createBiquadFilter(); fl.type = "lowpass"; fl.frequency.value = 160; g.gain.value = 0.01; o.connect(fl).connect(g).connect(out); o.start(); nodes.push(o); };
  const farm = () => every(6000, () => { if (Math.random() < 0.35) { const f = 140 + Math.random() * 30; tone(f, f * 0.8, 0.9, "sawtooth", 0.006, 0, out, 0.2); } });
  ({ pub: () => chatter(1), quiet: () => { chatter(0.6); fire(); }, garden: () => { chatter(0.6); birds(); }, sea: () => { chatter(0.5); sea(); }, neon: () => { chatter(0.7); hum(); }, brewery: () => { chatter(0.4); hum(); drips(); }, sports: () => crowd(), cellar: () => { chatter(0.35); drips(); }, roof: () => { chatter(0.5); city(); wind(0.02); }, festival: () => crowd(), alpine: () => { chatter(0.6); fire(); wind(0.03); }, farm: () => { chatter(0.5); birds(); farm(); }, finale: () => crowd() }[kind] || (() => chatter(1)))();
  amb = { stop() { const t = A.currentTime; out.gain.setTargetAtTime(0, t, 0.3); timers.forEach(clearInterval); setTimeout(() => { nodes.forEach((n) => { try { n.stop(); } catch (e) {} }); out.disconnect(); }, 1500); } };
}
export function stopAmbience() { if (amb) { amb.stop(); amb = null; } }

// ---------------------------------------------------------------- music: original loops in five styles
// Each hole gets a seeded 8-bar loop (chords, bass, drums, a lead line) scheduled on the audio clock, so it repeats seamlessly.
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
const STYLES = {
  acoustic: { bpm: 104, swing: 0, prog: [[0, 4, 7], [7, 11, 14], [9, 12, 16], [5, 9, 12], [0, 4, 7], [5, 9, 12], [7, 11, 14], [7, 11, 14]], key: 55, scale: [0, 2, 4, 7, 9], drums: "brush", inst: "guitar" },
  blues: { bpm: 88, swing: 0.33, prog: [[0, 4, 7, 10], [5, 9, 12, 15], [0, 4, 7, 10], [0, 4, 7, 10], [5, 9, 12, 15], [5, 9, 12, 15], [0, 4, 7, 10], [7, 11, 14, 17]], key: 52, scale: [0, 3, 5, 6, 7, 10], drums: "shuffle", inst: "organ" },
  rock: { bpm: 122, swing: 0, prog: [[0, 7, 12], [0, 7, 12], [-2, 5, 10], [5, 12, 17], [0, 7, 12], [0, 7, 12], [-4, 3, 8], [-2, 5, 10]], key: 52, scale: [0, 3, 5, 7, 10], drums: "rock", inst: "power" },
  lounge: { bpm: 96, swing: 0.2, prog: [[0, 4, 7, 11], [9, 12, 16, 19], [2, 5, 9, 12], [7, 11, 14, 17], [0, 4, 7, 11], [9, 12, 16, 19], [2, 5, 9, 12], [7, 11, 14, 17]], key: 57, scale: [0, 2, 4, 7, 9, 11], drums: "lounge", inst: "keys" },
  jig: { bpm: 116, swing: 0, triple: true, prog: [[0, 4, 7], [0, 4, 7], [5, 9, 12], [7, 11, 14], [0, 4, 7], [0, 4, 7], [5, 9, 12], [7, 11, 14]], key: 62, scale: [0, 2, 4, 5, 7, 9, 11], drums: "bodhran", inst: "fiddle" },
  finale: { bpm: 138, swing: 0, prog: [[0, 7, 12], [-4, 3, 8], [-2, 5, 10], [-5, 2, 7], [0, 7, 12], [-4, 3, 8], [-2, 5, 10], [-2, 5, 10]], key: 52, scale: [0, 2, 3, 5, 7, 8, 10], drums: "rock", inst: "power", lead: "saw" },
};
let mus = null;
export function playMusic(style, seed = 1) {
  try { init(); } catch (e) { return; }
  if (mus && mus.style === style && mus.seed === seed) return; stopMusic();
  const S = STYLES[style] || STYLES.acoustic, sub = S.triple ? 3 : 4, beat = 60 / S.bpm, steps = 8 * 4 * sub; // 8 bars of 4 beats
  let r = seed * 9301 + 49297; const rand = () => ((r = (r * 9301 + 49297) % 233280) / 233280);
  // a lead line: a motif of 2 bars, repeated with a variation, notes from the scale near the chord
  const lead = []; const motif = []; for (let i = 0; i < 2 * 4 * sub; i++) motif.push(rand() < (S.triple ? 0.7 : 0.45) ? (rand() * S.scale.length * 1.6) | 0 : -1);
  for (let bar = 0; bar < 8; bar++) for (let i = 0; i < 4 * sub; i++) { const m = motif[(bar % 2) * 4 * sub + i]; lead.push(bar >= 6 && rand() < 0.3 ? -1 : m < 0 ? -1 : m + (bar >= 4 && bar < 6 ? 2 : 0)); }
  const out = A.createGain(); out.gain.value = 0; out.gain.setTargetAtTime(1, A.currentTime, 0.4); out.connect(musBus);
  const comp = A.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 3; comp.connect(out);
  const dist = A.createWaveShaper(); { const n = 512, c = new Float32Array(n); for (let i = 0; i < n; i++) { const x = i / n * 2 - 1; c[i] = Math.tanh(x * 3.5); } dist.curve = c; } const distF = A.createBiquadFilter(); distF.type = "lowpass"; distF.frequency.value = 2400; const distG = A.createGain(); distG.gain.value = 0.22; dist.connect(distF).connect(distG).connect(comp);
  const note = (type, f, t, d, v, cut, dest = comp, att = 0.008) => { const o = A.createOscillator(), g = A.createGain(), fl = A.createBiquadFilter(); o.type = type; o.frequency.value = f; fl.type = "lowpass"; fl.frequency.setValueAtTime(cut, t); fl.frequency.exponentialRampToValueAtTime(Math.max(200, cut * 0.35), t + d); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + att); g.gain.exponentialRampToValueAtTime(0.0001, t + d); o.connect(fl).connect(g).connect(dest); o.start(t); o.stop(t + d + 0.03); };
  const drum = (k, t, v = 1) => { if (k === "kick") { const o = A.createOscillator(), g = A.createGain(); o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.16); g.gain.setValueAtTime(0.28 * v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22); o.connect(g).connect(comp); o.start(t); o.stop(t + 0.24); }
    else { const s = A.createBufferSource(), fl = A.createBiquadFilter(), g = A.createGain(), d = k === "snare" ? 0.16 : k === "brush" ? 0.12 : k === "ohat" ? 0.16 : 0.04; s.buffer = NB; fl.type = k === "snare" || k === "brush" ? "bandpass" : k === "tom" ? "lowpass" : "highpass"; fl.frequency.value = k === "snare" ? 1800 : k === "brush" ? 3500 : k === "tom" ? 300 : 7000; fl.Q.value = 0.7; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime((k === "snare" ? 0.16 : k === "tom" ? 0.3 : k === "brush" ? 0.05 : 0.045) * v, t + (k === "brush" ? 0.02 : 0.002)); g.gain.exponentialRampToValueAtTime(0.0001, t + d); s.connect(fl).connect(g).connect(comp); s.start(t, Math.random() * 2); s.stop(t + d + 0.02); if (k === "snare") note("triangle", 190, t, 0.08, 0.06, 2000); if (k === "tom") note("sine", 110, t, 0.18, 0.12, 800); } };
  let next = A.currentTime + 0.15, step = 0, on = true;
  function tickSched() {
    if (!on) return;
    while (next < A.currentTime + 0.35) {
      const s = step % steps, bar = Math.floor(s / (4 * sub)), inBar = s % (4 * sub), b = Math.floor(inBar / sub), sb = inBar % sub, ch = S.prog[bar], root = S.key + ch[0];
      let t = next; if (S.swing && sub === 4 && sb % 2 === 1) t += beat / 4 * S.swing;
      const dl = S.drums;
      if (dl === "rock") { if (sb === 0 && (b === 0 || b === 2)) drum("kick", t); if (sb === 2 && b === 2) drum("kick", t, 0.7); if (sb === 0 && (b === 1 || b === 3)) drum("snare", t); if (sb % 2 === 0) drum("hat", t, sb === 0 ? 1 : 0.6); if (s % (8 * sub * 4) === 0) drum("ohat", t, 2); }
      else if (dl === "shuffle") { if (sb === 0 && (b === 0 || b === 2)) drum("kick", t); if (sb === 0 && (b === 1 || b === 3)) drum("snare", t, 0.6); if (sb === 0 || sb === 3) drum("hat", t + (sb === 3 ? beat * 0.08 : 0), 0.8); }
      else if (dl === "brush") { if (sb === 0 && b % 2 === 0) drum("kick", t, 0.7); if (sb === 0 && b % 2 === 1) drum("brush", t, 1.4); if (sb === 2) drum("brush", t, 0.6); }
      else if (dl === "lounge") { if (sb === 0 && b === 0) drum("kick", t, 0.8); if (sb === 2 && b === 1) drum("kick", t, 0.5); if (sb === 0 && b === 2) drum("kick", t, 0.7); if (sb === 0 && (b === 1 || b === 3)) drum("brush", t, 1.6); if (sb % 2 === 0) drum("hat", t, 0.5); }
      else if (dl === "bodhran") { if (sb === 0) drum("tom", t, b % 2 ? 0.7 : 1); if (sb === 2) drum("tom", t, 0.45); if (sb === 1 && rand() < 0.3) drum("tom", t, 0.3); }
      // chords
      const inst = S.inst;
      if (inst === "guitar") { if (sb === 0 || (sb === 2 && b % 2 === 1)) ch.forEach((n, i) => note("triangle", hz(S.key + n), t + i * 0.012, beat * 1.2, 0.05, 2600)); if (sb === 0) note("sawtooth", hz(S.key + ch[0] + 12), t + 0.04, beat * 0.6, 0.012, 3200); }
      else if (inst === "organ") { if (sb === 0 && b === 0) ch.forEach((n) => { note("sine", hz(S.key + n + 12), t, beat * 3.8, 0.028, 2000, comp, 0.05); note("sine", hz(S.key + n + 24), t, beat * 3.8, 0.01, 3000, comp, 0.05); }); if (sb === 2 || sb === 0) ch.slice(1, 3).forEach((n) => note("square", hz(S.key + n + 12), t, beat * 0.25, 0.008, 1400)); }
      else if (inst === "power") { if (sb % 2 === 0) ch.forEach((n) => note("sawtooth", hz(S.key + n - 12), t, beat * (sb === 0 ? 0.5 : 0.3), 0.12, 3000, dist)); }
      else if (inst === "keys") { if (sb === 0 && (b === 0 || b === 2)) ch.forEach((n) => { note("sine", hz(S.key + n), t, beat * 1.9, 0.04, 3000, comp, 0.01); note("sine", hz(S.key + n + 12), t, beat * 0.8, 0.012, 4000, comp, 0.005); }); if (sb === 2 && b === 3) ch.forEach((n) => note("sine", hz(S.key + n + 12), t, beat * 0.4, 0.02, 3000)); }
      else if (inst === "fiddle") { if (sb === 0) ch.forEach((n) => note("triangle", hz(S.key + n - 12), t, beat * 0.8, 0.03, 2000)); }
      // bass
      if (S.triple) { if (sb === 0) note("triangle", hz(root - 24), t, beat * 0.8, 0.14, 700); }
      else if (dl === "shuffle") { if (sb === 0) note("triangle", hz(root - 24 + [0, 4, 7, 9][b]), t, beat * 0.9, 0.16, 600); }
      else if (inst === "power") { if (sb % 2 === 0) note("sawtooth", hz(root - 24), t, beat * 0.45, 0.07, 500); }
      else if (sb === 0 || (sb === 2 && b === 3)) note("triangle", hz(root - 24 + (b === 2 ? 7 : 0)), t, beat * 0.9, 0.15, 600);
      // lead
      const li = lead[s]; if (li >= 0) { const deg = S.scale[li % S.scale.length] + 12 * Math.floor(li / S.scale.length), f = hz(S.key + 12 + deg), d = beat / sub * (S.triple ? 1.6 : 2.2);
        if (inst === "fiddle") { const o = A.createOscillator(), g = A.createGain(), fl = A.createBiquadFilter(), vib = A.createOscillator(), vg = A.createGain(); o.type = "sawtooth"; o.frequency.value = f; vib.frequency.value = 5.5; vg.gain.value = f * 0.008; vib.connect(vg).connect(o.frequency); fl.type = "lowpass"; fl.frequency.value = 2600; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.03, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + d); o.connect(fl).connect(g).connect(comp); o.start(t); vib.start(t); o.stop(t + d + 0.05); vib.stop(t + d + 0.05); }
        else if (S.lead === "saw" || inst === "power") note("square", f, t, d, 0.025, 2600);
        else if (inst === "organ") note("square", f, t, d * 1.2, 0.02, 1600);
        else if (inst === "keys") { note("sine", f, t, d * 1.6, 0.04, 4000); note("sine", f * 2, t, d * 0.5, 0.01, 6000); }
        else note("triangle", f, t, d, 0.045, 3000); }
      next += beat / sub; step++;
    }
  }
  const id = setInterval(tickSched, 90); tickSched();
  mus = { style, seed, stop() { on = false; clearInterval(id); const t = A.currentTime; out.gain.setTargetAtTime(0, t, 0.25); setTimeout(() => out.disconnect(), 1500); } };
}
export function stopMusic() { if (mus) { mus.stop(); mus = null; } }
