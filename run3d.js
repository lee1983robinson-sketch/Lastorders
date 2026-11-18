// Beer Goggles 3D: an endless runner through British streets at night. Robbo's Game Lab.
// three.js r160, everything built in code. Built for phones first:
//  - the street is made of pre-baked chunk "templates" that are only moved, never rebuilt, while you run
//  - obstacles and power-ups come from pools made at load; coins and beers are instanced (one draw call each)
//  - only a couple of real lights follow you; every other lamp is a baked glow
//  - quality steps down on its own if the phone can't keep up
// Coordinates: you run towards -z. Lanes are x = -LANE, 0, +LANE.
import * as THREE from "/vendor/three.module.min.js";
import { EffectComposer } from "/vendor/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "/vendor/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "/vendor/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "/vendor/jsm/postprocessing/OutputPass.js";
import { ShaderPass } from "/vendor/jsm/postprocessing/ShaderPass.js";
import { RoundedBoxGeometry } from "/vendor/jsm/geometries/RoundedBoxGeometry.js";

// if the browser served an old copy of the page with this new script, reload once to get the matching page
if (!document.getElementById("loading")) { try { if (!sessionStorage.getItem("reloaded-loading")) { sessionStorage.setItem("reloaded-loading", "1"); location.replace(location.pathname + "?v=" + Date.now()); } } catch (e) {} throw new Error("stale page"); }
const $ = (id) => document.getElementById(id);
const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };
const lerp = (a, b, t) => a + (b - a) * t, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const mix = (c1, c2, t) => { const a = parseInt(c1.slice(1), 16), b = parseInt(c2.slice(1), 16); const r = Math.round(lerp(a >> 16, b >> 16, t)), gg = Math.round(lerp((a >> 8) & 255, (b >> 8) & 255, t)), bb = Math.round(lerp(a & 255, b & 255, t)); return `rgb(${r},${gg},${bb})`; };
const hexMix = (c1, c2, t) => new THREE.Color(c1).lerp(new THREE.Color(c2), t);
const rnd = (a, b) => a + Math.random() * (b - a), pick = (a) => a[Math.floor(Math.random() * a.length)], chance = (p) => Math.random() < p;
const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
const MOBILE = matchMedia("(pointer: coarse)").matches;
const J = (k, d) => { try { return Object.assign(d, JSON.parse(store.get(k) || "{}")); } catch (e) { return d; } };
const set = J("bgSet", { music: 0.7, sfx: 0.9, quality: "auto", shake: !REDUCED });
const saveSet = () => store.set("bgSet", JSON.stringify(set));

// ---------------------------------------------------------------- sound
let AC = null, MASTER = null, SFX = null, MUSIC = null, AMB = null, muted = store.get("loMute") === "1", noiseBuf = null;
function ctx() {
  if (!AC) {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    MASTER = AC.createGain(); MASTER.gain.value = muted ? 0 : 1; MASTER.connect(AC.destination);
    SFX = AC.createGain(); SFX.gain.value = set.sfx; SFX.connect(MASTER);
    MUSIC = AC.createGain(); MUSIC.gain.value = set.music * 0.55; MUSIC.connect(MASTER);
    noiseBuf = AC.createBuffer(1, AC.sampleRate * 2, AC.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    // city ambience: a low hum, distant traffic and (when it's wet) rain, all from one looped noise source
    const src = AC.createBufferSource(); src.buffer = noiseBuf; src.loop = true; src.start();
    const mk = (type, f, q, v) => { const fl = AC.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; const g = AC.createGain(); g.gain.value = v; src.connect(fl).connect(g).connect(SFX); return g; };
    AMB = { hum: mk("lowpass", 180, 0.7, 0.0001), traffic: mk("bandpass", 600, 0.5, 0.0001), rain: mk("highpass", 1600, 0.5, 0.0001) };
  }
  if (AC.state === "suspended") AC.resume(); return AC;
}
function beep(f1, f2, dur, type = "square", vol = 0.06, delay = 0, pan = 0) { try { const A = ctx(), o = A.createOscillator(), gn = A.createGain(), t0 = A.currentTime + delay; o.type = type; o.frequency.setValueAtTime(f1, t0); o.frequency.exponentialRampToValueAtTime(f2, t0 + dur); gn.gain.setValueAtTime(vol, t0); gn.gain.exponentialRampToValueAtTime(0.0001, t0 + dur); let out = gn; if (pan && A.createStereoPanner) { const p = A.createStereoPanner(); p.pan.value = pan; gn.connect(p); out = p; } o.connect(gn); out.connect(SFX); o.start(t0); o.stop(t0 + dur + 0.02); } catch (e) {} }
function hiss(dur, vol, type, f, q = 1, delay = 0, f2, pan = 0) { try { const A = ctx(), s = A.createBufferSource(), fl = A.createBiquadFilter(), g = A.createGain(), t0 = A.currentTime + delay; s.buffer = noiseBuf; s.playbackRate.value = rnd(0.8, 1.2); fl.type = type; fl.frequency.setValueAtTime(f, t0); if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t0 + dur); fl.Q.value = q; g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur); let out = g; if (pan && A.createStereoPanner) { const p = A.createStereoPanner(); p.pan.value = pan; g.connect(p); out = p; } s.connect(fl).connect(g); out.connect(SFX); s.start(t0, Math.random()); s.stop(t0 + dur + 0.02); } catch (e) {} }
function burp() {
  try {
    const A = ctx(), t0 = A.currentTime, len = 0.55 + Math.random() * 0.35;
    const o = A.createOscillator(), lfo = A.createOscillator(), lg = A.createGain(), am = A.createGain(), f = A.createBiquadFilter(), gn = A.createGain();
    o.type = "sawtooth"; o.frequency.setValueAtTime(95 + Math.random() * 25, t0); o.frequency.linearRampToValueAtTime(62, t0 + len);
    lfo.type = "square"; lfo.frequency.setValueAtTime(26 + Math.random() * 10, t0); lg.gain.value = 0.5; am.gain.value = 0.5; lfo.connect(lg).connect(am.gain);
    f.type = "lowpass"; f.frequency.setValueAtTime(900, t0); f.frequency.linearRampToValueAtTime(380, t0 + len); f.Q.value = 6;
    gn.gain.setValueAtTime(0.0001, t0); gn.gain.exponentialRampToValueAtTime(0.32, t0 + 0.05); gn.gain.setValueAtTime(0.28, t0 + len * 0.7); gn.gain.exponentialRampToValueAtTime(0.0001, t0 + len);
    o.connect(am).connect(f).connect(gn).connect(SFX); o.start(t0); lfo.start(t0); o.stop(t0 + len + 0.05); lfo.stop(t0 + len + 0.05);
  } catch (e) {}
}
const sfx = {
  step: (wet, k) => hiss(0.07, wet ? 0.09 : 0.06, wet ? "bandpass" : "lowpass", wet ? 2200 : 900, wet ? 1.4 : 0.8, 0, null, k ? 0.15 : -0.15),
  coin: () => { beep(1568, 2093, 0.07, "triangle", 0.05); beep(2093, 2637, 0.09, "triangle", 0.035, 0.05); },
  beer: () => { beep(1320, 1760, 0.06, "triangle", 0.05); beep(1760, 2200, 0.08, "triangle", 0.04, 0.05); hiss(0.18, 0.05, "highpass", 3000, 0.7, 0.02); },
  jump: () => { beep(260, 520, 0.14, "triangle", 0.05); hiss(0.12, 0.04, "bandpass", 1200, 1, 0, 2400); },
  land: () => { beep(120, 60, 0.12, "sine", 0.12); hiss(0.1, 0.06, "lowpass", 600); },
  slide: () => hiss(0.5, 0.08, "bandpass", 2500, 0.8, 0, 600),
  lane: (d) => hiss(0.12, 0.035, "bandpass", 1800, 1.2, 0, 900, d * 0.4),
  stumble: () => { beep(150, 60, 0.25, "square", 0.07); hiss(0.25, 0.12, "lowpass", 900); beep(90, 50, 0.2, "sine", 0.18); },
  crash: () => { hiss(0.6, 0.2, "lowpass", 1800, 0.7, 0, 200); beep(80, 40, 0.5, "sine", 0.25); beep(260, 50, 0.6, "sawtooth", 0.07); },
  power: () => { [0, 0.07, 0.14, 0.21].forEach((d, i) => beep([523, 659, 784, 1047][i], [523, 659, 784, 1047][i] * 1.01, 0.14, "triangle", 0.05, d)); },
  shield: () => { beep(400, 1200, 0.3, "sine", 0.06); beep(600, 1800, 0.3, "sine", 0.04, 0.05); },
  pop: () => { beep(900, 200, 0.25, "triangle", 0.06); hiss(0.3, 0.08, "highpass", 2000); },
  whoosh: (pan, big) => hiss(big ? 0.7 : 0.45, big ? 0.12 : 0.08, "bandpass", big ? 500 : 900, 0.6, 0, big ? 180 : 300, pan),
  horn: (pan) => { beep(392, 392, 0.35, "square", 0.035, 0, pan); beep(466, 466, 0.35, "square", 0.028, 0, pan); },
  heart: () => { beep(70, 50, 0.12, "sine", 0.2); beep(70, 50, 0.12, "sine", 0.14, 0.16); },
  level: () => [0, 0.1, 0.2, 0.32].forEach((dl, i) => beep([523, 659, 784, 1047][i], [523, 659, 784, 1047][i] * 1.01, 0.18, "square", 0.05, dl)),
};
// music: drums, bass and chords; layers come in as you speed up
const NT = (n) => 440 * Math.pow(2, (n - 69) / 12);
const CHORDS = [[45, 48, 52], [41, 45, 48], [43, 47, 50], [40, 44, 47]];
let mStep = 0, mNext = 0, musicOn = false, mTimer = null, energy = 0;
function mnote(f, at, dur, type, vol, cut = 3000) { const o = AC.createOscillator(), g = AC.createGain(), fl = AC.createBiquadFilter(); o.type = type; o.frequency.value = f; fl.type = "lowpass"; fl.frequency.value = cut; g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(vol, at + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, at + dur); o.connect(fl).connect(g).connect(MUSIC); o.start(at); o.stop(at + dur + 0.03); }
function mhit(at, dur, vol, type, f) { const s = AC.createBufferSource(), fl = AC.createBiquadFilter(), g = AC.createGain(); s.buffer = noiseBuf; fl.type = type; fl.frequency.value = f; g.gain.setValueAtTime(vol, at); g.gain.exponentialRampToValueAtTime(0.0001, at + dur); s.connect(fl).connect(g).connect(MUSIC); s.start(at, Math.random()); s.stop(at + dur + 0.02); }
function kick(at) { const o = AC.createOscillator(), g = AC.createGain(); o.frequency.setValueAtTime(150, at); o.frequency.exponentialRampToValueAtTime(45, at + 0.25); g.gain.setValueAtTime(0.5, at); g.gain.exponentialRampToValueAtTime(0.0001, at + 0.3); o.connect(g).connect(MUSIC); o.start(at); o.stop(at + 0.32); }
function schedule() {
  if (!musicOn) return; const S = 60 / 124 / 4;
  while (mNext < AC.currentTime + 0.25) {
    const st = mStep % 64, bar = Math.floor(st / 16), b = st % 16, ch = CHORDS[bar];
    if (b % 4 === 0) kick(mNext);
    if (b === 4 || b === 12) mhit(mNext, 0.16, 0.18, "bandpass", 1700);
    if (energy > 0.15 && b % 2 === 0) mhit(mNext, 0.04, 0.05 + energy * 0.04, "highpass", 7500);
    if (energy > 0.55 && b % 2 === 1) mhit(mNext, 0.03, 0.03, "highpass", 9000);
    if ([0, 3, 6, 8, 11, 14].includes(b)) mnote(NT(ch[0] - 12), mNext, S * 1.8, "sawtooth", 0.09, 500 + energy * 600);
    if (b === 0 || b === 8) for (const n of ch) mnote(NT(n + 12), mNext, S * 7, "triangle", 0.022);
    if (energy > 0.35 && b % 2 === 0) mnote(NT(ch[(b / 2) % 3] + 24), mNext, S * 0.9, "square", 0.012 + energy * 0.01, 2600);
    mNext += S; mStep++;
  }
}
function music(on) { try { ctx(); if (on && !musicOn) { musicOn = true; mNext = AC.currentTime + 0.05; mStep = 0; clearInterval(mTimer); mTimer = setInterval(schedule, 90); } if (!on && musicOn) { musicOn = false; clearInterval(mTimer); } } catch (e) {} }
document.addEventListener("visibilitychange", () => { if (!AC) return; if (document.hidden) { AC.suspend(); if (state === "play") pause(); } else AC.resume(); });
function setMute(m) { muted = m; store.set("loMute", m ? "1" : "0"); if (MASTER) MASTER.gain.value = m ? 0 : 1; for (const id of ["wave", "wave2"]) if ($(id)) $(id).style.display = m ? "none" : ""; for (const id of ["mute", "mute2"]) if ($(id)) $(id).setAttribute("aria-label", m ? "Turn sound on" : "Turn sound off"); }
for (const id of ["mute", "mute2"]) $(id).addEventListener("click", (e) => { e.stopPropagation(); setMute(!muted); });
setMute(muted);

// ---------------------------------------------------------------- chaser levels + 2D portrait (unchanged look)
const LEVELS = [
  { at: 0, name: "Swamp Monster", line: "The Swamp Monster got you. Absolutely grim." },
  { at: 10, name: "Bit Rough", line: "Caught by a Bit Rough. Could've been worse." },
  { at: 20, name: "Not Bad", line: "Not Bad caught you. Were you even running?" },
  { at: 35, name: "Fit", line: "Caught by a Fit one. You slowed down on purpose." },
  { at: 50, name: "Absolute Stunner", line: "An Absolute Stunner caught you. Sober you will have questions." },
];
const levelOf = (b) => { let i = 0; for (let k = 0; k < LEVELS.length; k++) if (b >= LEVELS[k].at) i = k; const nx = LEVELS[i + 1]; return { i, f: nx ? (b - LEVELS[i].at) / (nx.at - LEVELS[i].at) : 1 }; };
const looks = (b) => { const L = levelOf(b); return L.i === 4 ? 4 : L.i + L.f * 0.35; };
function face(c, x, y, r, lv, who) {
  const t = clamp(lv / 4, 0, 1), skin = mix("#6FA34A", who === "princess" ? "#F4C9A8" : "#E8B48A", clamp(t * 1.4, 0, 1));
  c.save(); c.translate(x, y); c.scale(r / 50, r / 50);
  if (lv >= 2.5) { c.fillStyle = who === "princess" ? mix("#7A4A22", "#F2C14E", clamp((lv - 2.5) / 1.5, 0, 1)) : "#3A2416"; if (who === "princess") { c.beginPath(); c.ellipse(0, 6, 40, 46, 0, 0, 7); c.fill(); } }
  c.fillStyle = skin; c.beginPath(); c.ellipse(0, 0, 32 + (1 - t) * 4, 38 - (1 - t) * 2, 0, 0, 7); c.fill();
  if (lv < 1.5) { c.beginPath(); c.arc(-26, -18, 9, 0, 7); c.arc(24, 10, 8, 0, 7); c.arc(10, -34, 7, 0, 7); c.fill(); }
  c.beginPath(); c.ellipse(-31, 2, 6 + (1 - t) * 6, 9, -0.3, 0, 7); c.ellipse(31, 2, 6 + (1 - t) * 6, 9, 0.3, 0, 7); c.fill();
  c.fillStyle = "#4A6B2A"; const warts = Math.round((1 - t) * 6); const WP = [[-14, -20], [18, -8], [-20, 14], [8, 22], [22, -24], [-6, 4]];
  for (let i = 0; i < warts; i++) { c.beginPath(); c.arc(WP[i][0], WP[i][1], 3.2, 0, 7); c.fill(); }
  const eyeW = lv < 1 ? [9, 5] : [7, 7];
  for (const [k, ex] of [[0, -12], [1, 12]]) {
    c.fillStyle = lv < 1 ? "#F4F09A" : "#FFFFFF"; c.beginPath(); c.ellipse(ex, -6 + (lv < 1 && k ? 3 : 0), eyeW[k], eyeW[k] * 0.9, 0, 0, 7); c.fill();
    c.fillStyle = lv < 1 ? "#B5322A" : lv > 3.5 ? "#2B6CB0" : "#2A1A12"; c.beginPath(); c.arc(ex + (lv < 1 ? (k ? -2 : 2) : 0), -5 + (lv < 1 && k ? 3 : 0), eyeW[k] * 0.48, 0, 7); c.fill();
    c.fillStyle = "#FFFFFF"; c.beginPath(); c.arc(ex + 2, -8, 1.6, 0, 7); c.fill();
    if (who === "princess" && lv >= 2.5) { c.strokeStyle = "#1A1020"; c.lineWidth = 1.6; for (const d of [-5, 0, 5]) { c.beginPath(); c.moveTo(ex + d, -12); c.lineTo(ex + d * 1.3, -16); c.stroke(); } }
  }
  c.strokeStyle = lv < 1.5 ? "#2A3A14" : who === "princess" ? "#5A3A22" : "#2A1A12"; c.lineCap = "round";
  if (lv < 1.5) { c.lineWidth = 6; c.beginPath(); c.moveTo(-22, -18); c.quadraticCurveTo(0, -12, 22, -19); c.stroke(); }
  else { c.lineWidth = who === "prince" ? 4 : 2.5; c.beginPath(); c.moveTo(-19, -17); c.quadraticCurveTo(-12, -21, -5, -17); c.moveTo(5, -17); c.quadraticCurveTo(12, -21, 19, -17); c.stroke(); }
  c.fillStyle = mix("#4F7A30", "#D9967A", t); c.beginPath(); c.ellipse(0, 6, lv < 1 ? 7 : 3.5, lv < 1 ? 8 : 4, 0, 0, 7); c.fill();
  if (lv < 1.5) {
    c.fillStyle = "#3A1A1A"; c.beginPath(); c.ellipse(0, 20, 15, 7, 0, 0, 7); c.fill();
    c.fillStyle = "#F2E8A0"; c.beginPath(); c.moveTo(-10, 15); c.lineTo(-6, 22); c.lineTo(-3, 15); c.moveTo(4, 15); c.lineTo(7, 24); c.lineTo(10, 16); c.fill();
    c.fillStyle = "#9FD6F099"; c.beginPath(); c.ellipse(9, 30, 2.5, 5, 0, 0, 7); c.fill();
  } else {
    c.strokeStyle = who === "princess" && lv >= 3 ? "#D23A5A" : "#7A3A2A"; c.lineWidth = who === "princess" && lv >= 3 ? 4 : 3;
    c.beginPath(); c.moveTo(-10, 17); c.quadraticCurveTo(0, 24 + lv, 10, 17); c.stroke();
    if (lv >= 2.5) { c.fillStyle = "#FF8AA055"; c.beginPath(); c.arc(-20, 10, 6, 0, 7); c.arc(20, 10, 6, 0, 7); c.fill(); }
    if (who === "prince" && lv >= 3) { c.fillStyle = "#2A1A1266"; c.beginPath(); c.ellipse(0, 24, 20, 12, 0, 0, Math.PI); c.fill(); }
  }
  if (lv < 1.5) { c.strokeStyle = "#3F5A1E"; c.lineWidth = 3; for (let i = -3; i <= 3; i++) { c.beginPath(); c.moveTo(i * 7, -34); c.quadraticCurveTo(i * 9 + 6, -48, i * 11, -44 + (i % 2) * 6); c.stroke(); } }
  else if (lv < 2.5) { c.fillStyle = "#5A3A22"; c.beginPath(); c.ellipse(0, -30, 30, 14, 0, Math.PI, 0); c.fill(); for (let i = -2; i <= 2; i++) { c.beginPath(); c.arc(i * 11, -32 + (i % 2) * 3, 8, 0, 7); c.fill(); } }
  else if (who === "princess") { c.fillStyle = mix("#7A4A22", "#F2C14E", clamp((lv - 2.5) / 1.5, 0, 1)); c.beginPath(); c.ellipse(0, -26, 34, 18, 0, Math.PI, 0); c.fill(); c.beginPath(); c.ellipse(-22, -18, 14, 10, -0.6, 0, 7); c.fill(); }
  else { c.fillStyle = "#3A2416"; c.beginPath(); c.moveTo(-30, -18); c.quadraticCurveTo(-28, -46, 4, -44); c.quadraticCurveTo(30, -44, 30, -18); c.quadraticCurveTo(18, -34, -4, -30); c.quadraticCurveTo(-18, -30, -30, -18); c.fill(); }
  if (lv >= 3.9) {
    c.fillStyle = "#FFD24A";
    if (who === "princess") { c.beginPath(); c.moveTo(-18, -38); c.lineTo(-12, -50); c.lineTo(-6, -42); c.lineTo(0, -56); c.lineTo(6, -42); c.lineTo(12, -50); c.lineTo(18, -38); c.closePath(); c.fill(); c.fillStyle = "#FF5C8A"; c.beginPath(); c.arc(0, -46, 3, 0, 7); c.fill(); }
    else { c.fillRect(-20, -52, 40, 10); c.beginPath(); c.moveTo(-20, -52); c.lineTo(-14, -64); c.lineTo(-8, -52); c.lineTo(0, -66); c.lineTo(8, -52); c.lineTo(14, -64); c.lineTo(20, -52); c.fill(); }
    c.fillStyle = "#FFFFFFCC"; for (const [sx, sy] of [[-40, -30], [38, -36], [40, 20]]) { c.beginPath(); c.moveTo(sx, sy - 6); c.lineTo(sx + 2, sy - 2); c.lineTo(sx + 6, sy); c.lineTo(sx + 2, sy + 2); c.lineTo(sx, sy + 6); c.lineTo(sx - 2, sy + 2); c.lineTo(sx - 6, sy); c.lineTo(sx - 2, sy - 2); c.fill(); }
  }
  c.restore();
}
function paintFace(canvas, lv, who) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5), s = canvas.dataset.s ? +canvas.dataset.s : (canvas.dataset.s = canvas.width);
  canvas.width = s * dpr; canvas.height = s * dpr; const c = canvas.getContext("2d"); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, s, s);
  face(c, s / 2, s / 2 + s * 0.06, s * 0.36, lv, who);
}

// ---------------------------------------------------------------- renderer, scene, camera, post
const cv = $("game");
const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: (devicePixelRatio || 1) < 2, powerPreference: "high-performance" });
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.3;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
const scene = new THREE.Scene(); scene.fog = new THREE.Fog(0x161a30, 30, 175);
const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 230);
const GradeShader = {
  uniforms: { tDiffuse: { value: null }, uSpeed: { value: 0 }, uVig: { value: 0.45 }, uDanger: { value: 0 } },
  vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uSpeed, uVig, uDanger; varying vec2 vUv;
  void main(){ vec2 c = vUv - 0.5; float r = length(c); vec3 col = texture2D(tDiffuse, vUv).rgb;
    if (uSpeed > 0.02) { float k = uSpeed * 0.035 * smoothstep(0.22, 0.75, r); vec3 a = col; for (int i = 1; i < 5; i++) a += texture2D(tDiffuse, vUv - c * k * float(i)).rgb; col = a / 5.0; }
    col *= 1.0 - uVig * smoothstep(0.35, 0.95, r); col = mix(col, col * vec3(1.25, 0.55, 0.55), uDanger * smoothstep(0.3, 0.8, r)); gl_FragColor = vec4(col, 1.0); }`,
};
let composer = null, bloom = null, grade = null;
try { composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType })); composer.addPass(new RenderPass(scene, camera)); bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.55, 0.42, 0.92); composer.addPass(bloom); grade = new ShaderPass(GradeShader); composer.addPass(grade); composer.addPass(new OutputPass()); } catch (e) { composer = null; }
let Q = set.quality === "auto" ? (MOBILE ? 1 : 2) : { high: 2, medium: 1, low: 0 }[set.quality] ?? 1;
function fit() {
  const r = $("stage").getBoundingClientRect(); renderer.setPixelRatio(Math.min(devicePixelRatio || 1, [1, MOBILE ? 1.35 : 1.5, MOBILE ? 1.75 : 2][Q]));
  renderer.setSize(r.width, r.height, false); cv.style.width = r.width + "px"; cv.style.height = r.height + "px"; camera.aspect = r.width / r.height; baseFov = camera.aspect < 0.7 ? 66 : 56; camera.fov = baseFov; camera.updateProjectionMatrix();
  if (composer) { const pr = renderer.getPixelRatio(); composer.setPixelRatio(pr); composer.setSize(r.width, r.height); bloom.setSize(Math.round(r.width * pr * 0.5), Math.round(r.height * pr * 0.5)); }
}
let baseFov = 62;
addEventListener("resize", fit);
const hemi = new THREE.HemisphereLight(0x7a80c8, 0x2a1c18, 1.0); scene.add(hemi);
const moon = new THREE.DirectionalLight(0xa9b8ff, 1.0); moon.shadow.mapSize.set(1024, 1024); moon.shadow.bias = -0.0006; moon.shadow.normalBias = 0.03;
Object.assign(moon.shadow.camera, { left: -8, right: 8, top: 12, bottom: -12, near: 1, far: 60 }); scene.add(moon, moon.target);
const LAMP_LIGHTS = []; for (let i = 0; i < 3; i++) { const l = new THREE.PointLight(0xffc477, 0, 20, 2); scene.add(l); LAMP_LIGHTS.push(l); }
function applyQuality() { moon.castShadow = Q >= 1; moon.shadow.mapSize.set(Q >= 2 ? 1024 : 512, Q >= 2 ? 1024 : 512); if (moon.shadow.map) { moon.shadow.map.dispose(); moon.shadow.map = null; } fit(); }

// ---------------------------------------------------------------- textures drawn in code
function ctex(w, h, draw, opt = {}) { const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d"), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = opt.linear ? THREE.NoColorSpace : THREE.SRGBColorSpace; t.anisotropy = 8; if (opt.repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; }
const speck = (g, w, h, n, cols, a = 0.5, s = 2) => { for (let i = 0; i < n; i++) { g.globalAlpha = Math.random() * a; g.fillStyle = pick(cols); g.fillRect(Math.random() * w, Math.random() * h, Math.random() * s + 0.5, Math.random() * s + 0.5); } g.globalAlpha = 1; };
const radial = ctex(64, 64, (g, w) => { const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.25, "rgba(255,255,255,.45)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, w, w); });
const streakTex = ctex(32, 128, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, "rgba(255,255,255,0)"); gr.addColorStop(0.7, "rgba(255,255,255,.55)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, w, h); const gx = g.createLinearGradient(0, 0, w, 0); gx.addColorStop(0, "rgba(0,0,0,1)"); gx.addColorStop(0.5, "rgba(0,0,0,0)"); gx.addColorStop(1, "rgba(0,0,0,1)"); g.globalCompositeOperation = "destination-out"; g.fillStyle = gx; g.fillRect(0, 0, w, h); });
const shadowTex = ctex(64, 64, (g, w) => { const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); gr.addColorStop(0, "rgba(0,0,0,.65)"); gr.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = gr; g.fillRect(0, 0, w, w); });
const LANE = 2.3, ROAD = 4.6, PAVE = 8.2, FRONT = 8.2, CH = 40, NVIS = 6;
const roadTex = ctex(512, 1024, (g, w, h) => {
  g.fillStyle = "#2a2b30"; g.fillRect(0, 0, w, h); speck(g, w, h, 26000, ["#383a40", "#1c1d22", "#45464c", "#121316"], 0.8, 2.2);
  for (let i = 0; i < 6; i++) { g.fillStyle = "rgba(12,12,16,.3)"; g.beginPath(); g.ellipse(Math.random() * w, Math.random() * h, rnd(20, 60), rnd(30, 90), 0, 0, 7); g.fill(); }
  const px = (x) => (x / (ROAD * 2) + 0.5) * w;
  g.fillStyle = "rgba(235,232,222,.9)"; for (const x of [-LANE / 2, LANE / 2]) for (let y = 0; y < h; y += h / 2) g.fillRect(px(x) - 4, y + 60, 8, h * 0.2);
  g.fillStyle = "#e8b818"; for (const x of [-ROAD + 0.22, -ROAD + 0.42, ROAD - 0.22, ROAD - 0.42]) g.fillRect(px(x) - 3, 0, 6, h);
}, { repeat: true });
roadTex.repeat.set(1, 26);
const paveTex = ctex(256, 256, (g, w, h) => { g.fillStyle = "#3a3a40"; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 64) for (let x = 0; x < w; x += 64) { const v = 82 + Math.random() * 24 | 0; g.fillStyle = `rgb(${v},${v},${v + 6})`; g.fillRect(x + 1, y + 1, 62, 62); } speck(g, w, h, 7000, ["#000", "#999"], 0.25); }, { repeat: true });
paveTex.repeat.set(1, 65);
const plateTex = ctex(128, 32, (g) => { g.fillStyle = "#f2c418"; g.fillRect(0, 0, 128, 32); g.fillStyle = "#1a3a9a"; g.fillRect(0, 0, 12, 32); g.fillStyle = "#111"; g.font = "bold 20px Arial"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("BG24 RUN", 70, 17); });

// building fronts: every facade is drawn into one atlas (colour + glow) so the whole street is one material
const AW = 8, AH = 4, SW = 256, SH = 352;
const atlasC = document.createElement("canvas"), glowC = document.createElement("canvas"); atlasC.width = glowC.width = AW * SW; atlasC.height = glowC.height = AH * SH;
const ag = atlasC.getContext("2d"), gg = glowC.getContext("2d"); gg.fillStyle = "#000"; gg.fillRect(0, 0, glowC.width, glowC.height);
const SLOTS = [];   // {kind, u: [su, sv, ou, ov]}
const BRICK = ["#8a3e2a", "#7a3424", "#9a4a32", "#6e3a2c", "#a8865a", "#c8c0b0", "#e0d4bc", "#b8d0c4", "#d8b8b8"];
const WARM = ["#ffc070", "#ffd8a0", "#ffb050", "#ffe0b8", "#a8c8ff"];
function slot(kind, draw) {
  const i = SLOTS.length, cx = (i % AW) * SW, cy = Math.floor(i / AW) * SH;
  ag.save(); gg.save(); ag.translate(cx, cy); gg.translate(cx, cy); ag.beginPath(); ag.rect(0, 0, SW, SH); ag.clip(); gg.beginPath(); gg.rect(0, 0, SW, SH); gg.clip();
  draw(ag, gg); ag.restore(); gg.restore();
  SLOTS.push({ kind, u: [SW / atlasC.width, SH / atlasC.height, cx / atlasC.width, 1 - (cy + SH) / atlasC.height] });
}
function bricks(g, col) { g.fillStyle = col; g.fillRect(0, 0, SW, SH); g.fillStyle = "rgba(0,0,0,.13)"; for (let y = 0; y < SH; y += 8) { g.fillRect(0, y, SW, 1.2); for (let x = (y / 8) % 2 ? 0 : 11; x < SW; x += 22) g.fillRect(x, y, 1.2, 8); } speck(g, SW, SH, 2500, ["#000", "#fff"], 0.12); }
function win(g, q, x, y, w, h, on) {
  g.fillStyle = "#ece8de"; g.fillRect(x - 5, y - 5, w + 10, h + 10);
  if (on) { const c = pick(WARM), gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, c); gr.addColorStop(1, "#c87830"); g.fillStyle = gr; g.fillRect(x, y, w, h); q.fillStyle = c; q.globalAlpha = rnd(0.5, 0.85); q.fillRect(x, y, w, h); q.globalAlpha = 1; if (chance(0.5)) { g.fillStyle = "rgba(90,30,30,.6)"; g.fillRect(x, y, w * 0.26, h); g.fillRect(x + w * 0.74, y, w * 0.26, h); q.fillStyle = "#000"; q.fillRect(x, y, w * 0.26, h); q.fillRect(x + w * 0.74, y, w * 0.26, h); } }
  else { g.fillStyle = "#121624"; g.fillRect(x, y, w, h); g.fillStyle = "rgba(140,160,210,.18)"; g.fillRect(x, y, w, h * 0.35); }
  g.fillStyle = "#ece8de"; g.fillRect(x + w / 2 - 2, y, 4, h); g.fillRect(x, y + h * 0.45, w, 3);
  g.fillStyle = "#d8cfba"; g.fillRect(x - 8, y + h + 4, w + 16, 6);
}
for (let i = 0; i < 10; i++) slot("house", (g, q) => { // terraced houses
  bricks(g, BRICK[i % BRICK.length]); win(g, q, 34, 46, 72, 90, chance(0.45)); win(g, q, 150, 46, 72, 90, chance(0.35));
  const dl = chance(0.5), dx = dl ? 26 : 156;
  if (chance(0.6)) { g.fillStyle = "#ece8de"; g.fillRect(dl ? 104 : 20, 186, 124, 150); win(g, q, dl ? 116 : 32, 200, 100, 100, chance(0.55)); } else win(g, q, dl ? 120 : 40, 205, 90, 95, chance(0.5));
  g.fillStyle = pick(["#8a1a1e", "#1b2b5a", "#1f4a2c", "#14161c", "#c8a21e", "#f0f0ea"]); g.fillRect(dx, 210, 74, 142); g.fillStyle = "#ece8de"; g.fillRect(dx - 6, 196, 86, 12);
  g.fillStyle = "#ffd890"; g.fillRect(dx + 8, 214, 58, 18); q.fillStyle = "#ffcf80"; q.globalAlpha = 0.7; q.fillRect(dx + 8, 214, 58, 18); q.globalAlpha = 1;
  g.fillStyle = "#d8b44a"; g.fillRect(dx + 60, 290, 6, 6); g.fillStyle = "#fff"; g.font = "bold 13px Arial"; g.textAlign = "center"; g.fillText(String(2 + Math.floor(Math.random() * 120)), dx + 37, 228);
});
const SHOP_SIGNS = [["KEBAB KING", "#c8101a", "#ffe45a"], ["CHIPPY", "#1446a8", "#fff"], ["OFFIE 24/7", "#1e8a3a", "#fff"], ["BOOKIES", "#0a2a6a", "#ffd23a"], ["PIZZA", "#1a6a2a", "#fff"], ["CHINESE", "#b8101a", "#ffd23a"], ["BARBERS", "#1a1a1a", "#fff"], ["LAUNDERETTE", "#2ba8c8", "#fff"], ["VAPE SHOP", "#2a2a5a", "#7ae8ff"], ["NAILS", "#d83a9a", "#fff"]];
for (let i = 0; i < 8; i++) slot("shop", (g, q) => { const [n, bg, fg] = SHOP_SIGNS[i];
  bricks(g, pick(BRICK.slice(0, 5))); win(g, q, 34, 40, 72, 84, chance(0.5)); win(g, q, 150, 40, 72, 84, chance(0.5));
  g.fillStyle = bg; g.fillRect(0, 160, SW, 46); q.fillStyle = bg; q.globalAlpha = 0.9; q.fillRect(0, 160, SW, 46); q.globalAlpha = 1;
  g.font = `800 ${n.length > 9 ? 26 : 32}px Bungee, Impact, sans-serif`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = fg; g.fillText(n, SW / 2, 184); q.fillStyle = "#fff"; q.font = g.font; q.textAlign = "center"; q.textBaseline = "middle"; q.fillText(n, SW / 2, 184);
  const gr = g.createLinearGradient(0, 214, 0, 352); gr.addColorStop(0, "#fff2d0"); gr.addColorStop(1, "#8a5a30"); g.fillStyle = gr; g.fillRect(10, 216, 170, 130); q.fillStyle = "#ffe0b0"; q.globalAlpha = 0.6; q.fillRect(10, 216, 170, 130); q.globalAlpha = 1;
  for (let r = 0; r < 3; r++) for (let k = 0; k < 14; k++) { g.fillStyle = pick(["#c83a3a", "#3a7ac8", "#e8c83a", "#3aa85a", "#eee"]); g.fillRect(16 + k * 11.5, 228 + r * 30, 8, 14); }
  g.fillStyle = "rgba(20,10,5,.85)"; g.beginPath(); g.arc(120, 290, 11, 0, 7); g.fill(); g.fillRect(106, 300, 28, 46);
  g.fillStyle = "#2a2d34"; g.fillRect(190, 216, 56, 136); g.fillStyle = "#bfc8d8"; g.fillRect(196, 224, 44, 80); q.fillStyle = "#fff5d8"; q.globalAlpha = 0.5; q.fillRect(196, 224, 44, 80); q.globalAlpha = 1;
  if (i === 0) { g.fillStyle = "#b8642a"; g.fillRect(30, 232, 16, 80); q.fillStyle = "#ff8a3a"; q.globalAlpha = 0.5; q.fillRect(30, 232, 16, 80); q.globalAlpha = 1; }
  g.strokeStyle = "rgba(255,255,255,.9)"; g.lineWidth = 3; g.strokeRect(198, 230, 40, 18); q.strokeStyle = "#ff3d7f"; q.lineWidth = 4; q.strokeRect(198, 230, 40, 18); g.fillStyle = "#ff3d7f"; g.font = "bold 12px Arial"; g.fillText("OPEN", 218, 240); q.fillStyle = "#ff3d7f"; q.font = "bold 12px Arial"; q.fillText("OPEN", 218, 240);
});
const PUB_NAMES = [["THE RED LION", "#0f3a24"], ["THE LOCK-IN", "#4a0e14"], ["ROSE & CROWN", "#1a2440"], ["THE WOBBLY GOOSE", "#0f3a24"], ["THE BLACK BULL", "#1a1a1a"], ["LAST ORDERS", "#4a0e14"]];
for (let i = 0; i < 6; i++) slot("pub", (g, q) => { const [n, bg] = PUB_NAMES[i];
  bricks(g, pick(BRICK.slice(0, 4))); win(g, q, 34, 40, 72, 84, chance(0.6)); win(g, q, 150, 40, 72, 84, chance(0.6));
  g.fillStyle = bg; g.fillRect(0, 150, SW, 202); g.fillStyle = "#e8c36a"; g.font = `800 ${n.length > 12 ? 18 : 22}px Georgia, serif`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(n, SW / 2, 172); q.fillStyle = "#e8b850"; q.globalAlpha = 0.7; q.font = g.font; q.textAlign = "center"; q.textBaseline = "middle"; q.fillText(n, SW / 2, 172); q.globalAlpha = 1;
  g.fillStyle = "#c8a050"; g.fillRect(0, 190, SW, 3);
  for (const x of [16, 140]) { const gr = g.createLinearGradient(0, 205, 0, 330); gr.addColorStop(0, "#ffd890"); gr.addColorStop(1, "#a85a20"); g.fillStyle = gr; g.fillRect(x, 205, 100, 110); q.fillStyle = "#ffb860"; q.globalAlpha = 0.7; q.fillRect(x, 205, 100, 110); q.globalAlpha = 1; g.fillStyle = "rgba(255,255,255,.35)"; g.fillRect(x, 262, 100, 53); g.strokeStyle = bg; g.lineWidth = 4; for (let k = 1; k < 4; k++) { g.beginPath(); g.moveTo(x + k * 25, 205); g.lineTo(x + k * 25, 315); g.stroke(); } }
  for (const x of [30, 200]) { g.fillStyle = "#2a5a22"; g.beginPath(); g.arc(x, 145, 15, 0, 7); g.fill(); for (let k = 0; k < 6; k++) { g.fillStyle = pick(["#e85a8a", "#f0e04a", "#fff", "#a85ae8"]); g.beginPath(); g.arc(x + rnd(-12, 12), 140 + rnd(-6, 10), 3, 0, 7); g.fill(); } }
});
for (let i = 0; i < 4; i++) slot("city", (g, q) => { // ground floor of a modern block: glass lobby and lit offices above
  g.fillStyle = pick(["#3a3e48", "#2e323c", "#4a4e58", "#5a5048"]); g.fillRect(0, 0, SW, SH);
  for (let r = 0; r < 3; r++) for (let k = 0; k < 4; k++) { const x = 14 + k * 60, y = 18 + r * 54, on = chance(0.45); g.fillStyle = on ? pick(["#ffe8b8", "#d8e8ff", "#fff4d8"]) : "#121722"; g.fillRect(x, y, 48, 40); if (on) { q.fillStyle = "#fff0d0"; q.globalAlpha = 0.75; q.fillRect(x, y, 48, 40); q.globalAlpha = 1; } }
  const gr = g.createLinearGradient(0, 190, 0, 352); gr.addColorStop(0, "#d8e4f0"); gr.addColorStop(1, "#4a4e58"); g.fillStyle = gr; g.fillRect(8, 190, 240, 162); q.fillStyle = "#fff8e8"; q.globalAlpha = 0.45; q.fillRect(8, 190, 240, 162); q.globalAlpha = 1;
  g.strokeStyle = "#1a1e28"; g.lineWidth = 5; for (let x = 8; x <= 248; x += 60) { g.beginPath(); g.moveTo(x, 190); g.lineTo(x, 352); g.stroke(); }
  const neon = pick(["#ff3d9a", "#3de0ff", "#ffd23a"]); g.fillStyle = neon; g.font = "800 20px Bungee, Impact"; g.textAlign = "center"; g.fillText(pick(["COCKTAILS", "NIGHTCLUB", "BAR & GRILL", "TAPAS"]), 128, 178); q.fillStyle = neon; q.font = g.font; q.textAlign = "center"; q.fillText(g.canvas ? "" : "", 0, 0); q.globalAlpha = 1; q.font = "800 20px Bungee, Impact"; q.fillText(["COCKTAILS", "NIGHTCLUB", "BAR & GRILL", "TAPAS"][i], 128, 178);
});
for (let i = 0; i < 4; i++) slot("mill", (g, q) => { // canal-side warehouses with arched windows
  bricks(g, pick(["#7a3a2a", "#6a3424", "#8a4a32"])); for (let r = 0; r < 3; r++) for (let k = 0; k < 3; k++) { const x = 26 + k * 76, y = 26 + r * 104, on = chance(0.3); g.fillStyle = "#d8cfba"; g.beginPath(); g.arc(x + 26, y + 20, 30, Math.PI, 0); g.fill(); g.fillStyle = on ? "#ffd8a0" : "#141824"; g.beginPath(); g.arc(x + 26, y + 20, 25, Math.PI, 0); g.lineTo(x + 51, y + 70); g.lineTo(x + 1, y + 70); g.fill(); if (on) { q.fillStyle = "#ffcf90"; q.globalAlpha = 0.6; q.fillRect(x + 1, y, 50, 70); q.globalAlpha = 1; } }
  if (i === 0) { g.fillStyle = "#e8e0cc"; g.font = "800 22px Georgia"; g.textAlign = "center"; g.fillText("VICTORIA MILL", 128, 16); }
});
for (let i = 0; i < 2; i++) slot("canalwall", (g) => { g.fillStyle = "#4a4a4e"; g.fillRect(0, 0, SW, SH); speck(g, SW, SH, 3000, ["#000", "#888"], 0.3); });
// the office windows above city ground floors (tiled)
const officeTex = ctex(256, 256, (g, w, h) => { g.fillStyle = "#2a2e38"; g.fillRect(0, 0, w, h); for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) { const on = chance(0.4); g.fillStyle = on ? pick(["#ffe8b8", "#d8e8ff", "#fff4d8"]) : "#101420"; g.fillRect(10 + k * 62, 10 + r * 62, 48, 46); } }, { repeat: true });
const officeGlow = ctex(256, 256, (g, w, h) => { g.fillStyle = "#000"; g.fillRect(0, 0, w, h); }, { repeat: true });
{ // glow for the office tiles matches the lit windows
  const src = officeTex.image.getContext("2d").getImageData(0, 0, 256, 256).data, gc = officeGlow.image.getContext("2d"), out = gc.createImageData(256, 256);
  for (let i = 0; i < src.length; i += 4) { const lit = src[i] > 150; out.data[i] = lit ? src[i] : 0; out.data[i + 1] = lit ? src[i + 1] : 0; out.data[i + 2] = lit ? src[i + 2] : 0; out.data[i + 3] = 255; }
  gc.putImageData(out, 0, 0); officeGlow.needsUpdate = true;
}
const atlasTex = new THREE.CanvasTexture(atlasC), atlasGlow = new THREE.CanvasTexture(glowC); atlasTex.colorSpace = atlasGlow.colorSpace = THREE.SRGBColorSpace; atlasTex.anisotropy = atlasGlow.anisotropy = 8;
const slotsOf = (k) => SLOTS.filter((s) => s.kind === k);

// ---------------------------------------------------------------- materials, shared geometry
const BOX = new THREE.BoxGeometry(1, 1, 1), PLANE = new THREE.PlaneGeometry(1, 1), CYL = new THREE.CylinderGeometry(0.5, 0.5, 1, 12), SPH = new THREE.SphereGeometry(0.5, 14, 10), CONE = new THREE.ConeGeometry(0.5, 1, 14), RBOX = new RoundedBoxGeometry(1, 1, 1, 3, 0.16);
const ROOF = (() => { const g = new THREE.BufferGeometry(), p = [], q = (a, b, c) => p.push(...a, ...b, ...c); const A = [-.5, 0, .5], B = [.5, 0, .5], C = [.5, 1, 0], D = [-.5, 1, 0], E = [-.5, 0, -.5], F = [.5, 0, -.5]; q(A, B, C); q(A, C, D); q(F, E, D); q(F, D, C); q(E, A, D); q(B, F, C); g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(new Array(36).fill(0), 2)); g.computeVertexNormals(); return g; })();
const M = {
  front: new THREE.MeshStandardMaterial({ map: atlasTex, emissiveMap: atlasGlow, emissive: 0xffffff, emissiveIntensity: 1.3, roughness: 0.85 }),
  office: new THREE.MeshStandardMaterial({ map: officeTex, emissiveMap: officeGlow, emissive: 0xffffff, emissiveIntensity: 1.1, roughness: 0.4, metalness: 0.4 }),
  plain: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 }),
  shiny: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.25, metalness: 0.6 }),
  lights: new THREE.MeshBasicMaterial({ vertexColors: true }),
  glow: new THREE.MeshBasicMaterial({ map: radial, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -3 }),
  streak: new THREE.MeshBasicMaterial({ map: streakTex, vertexColors: true, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -4 }),
  water: new THREE.MeshStandardMaterial({ color: 0x0a1420, roughness: 0.08, metalness: 0.85 }),
  road: new THREE.MeshStandardMaterial({ map: roadTex, roughness: 0.6, metalness: 0.1 }),
  pave: new THREE.MeshStandardMaterial({ map: paveTex, roughness: 0.7 }),
  paint: new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.5, clearcoat: 1, clearcoatRoughness: 0.08 }),
  tyre: new THREE.MeshStandardMaterial({ color: 0x0c0c0e, roughness: 0.9 }),
  glass: new THREE.MeshStandardMaterial({ color: 0x0a0e16, roughness: 0.05, metalness: 0.9 }),
  plate: new THREE.MeshBasicMaterial({ map: plateTex }),
};
// environment reflections for glossy cars and the wet road (baked once)
{ const env = new THREE.Scene(), sky = ctex(8, 128, (g) => { const gr = g.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, "#05060e"); gr.addColorStop(0.5, "#1a2040"); gr.addColorStop(0.55, "#4a3a3a"); gr.addColorStop(1, "#141416"); g.fillStyle = gr; g.fillRect(0, 0, 8, 128); });
  env.add(new THREE.Mesh(new THREE.SphereGeometry(20, 16, 8), new THREE.MeshBasicMaterial({ map: sky, side: THREE.BackSide })));
  for (let i = 0; i < 14; i++) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.6), new THREE.MeshBasicMaterial({ color: new THREE.Color(pick([0xffb060, 0xffe0b0, 0xff3d7f, 0x3de0ff])).multiplyScalar(6) })); const a = (i / 14) * 6.28; m.position.set(Math.cos(a) * 12, rnd(1, 5), Math.sin(a) * 12); env.add(m); }
  const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(env, 0.02).texture; pm.dispose();
  M.front.envMapIntensity = 0.15; M.plain.envMapIntensity = 0.4; M.pave.envMapIntensity = 0.5; }

// ---------------------------------------------------------------- baking static parts into a few meshes
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _n = new THREE.Matrix3();
const colCache = {}; const pc = (c) => (c == null ? null : typeof c === "object" ? c : colCache[c] || (colCache[c] = new THREE.Color(c)));
function P(list, geo, mat, col, x, y, z, sx, sy, sz, ry = 0, rx = 0, rz = 0, uv) { _e.set(rx, ry, rz); _q.setFromEuler(_e); _m.compose(_v.set(x, y, z), _q, _s.set(sx, sy, sz)); list.push({ geo, mat, m: _m.clone(), col: pc(col), uv }); }
function bake(list) {
  const groups = new Map(); for (const p of list) { if (!groups.has(p.mat)) groups.set(p.mat, []); groups.get(p.mat).push(p); }
  const out = [];
  for (const [mat, ps] of groups) {
    let nv = 0, ni = 0; for (const p of ps) { nv += p.geo.attributes.position.count; ni += p.geo.index ? p.geo.index.count : p.geo.attributes.position.count; }
    const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = new Float32Array(nv * 2), col = new Float32Array(nv * 3), idx = new Uint32Array(ni);
    let ov = 0, oi = 0;
    for (const p of ps) {
      const g = p.geo, Pp = g.attributes.position, Nn = g.attributes.normal, U = g.attributes.uv; _n.getNormalMatrix(p.m);
      const cr = p.col ? p.col.r : 1, cg = p.col ? p.col.g : 1, cb = p.col ? p.col.b : 1, su = p.uv ? p.uv[0] : 1, sv = p.uv ? p.uv[1] : 1, ou = p.uv && p.uv.length > 2 ? p.uv[2] : 0, ovv = p.uv && p.uv.length > 2 ? p.uv[3] : 0;
      for (let i = 0; i < Pp.count; i++) {
        _v.fromBufferAttribute(Pp, i).applyMatrix4(p.m); const k = (ov + i) * 3; pos[k] = _v.x; pos[k + 1] = _v.y; pos[k + 2] = _v.z;
        if (Nn) { _v.fromBufferAttribute(Nn, i).applyMatrix3(_n).normalize(); nor[k] = _v.x; nor[k + 1] = _v.y; nor[k + 2] = _v.z; }
        if (U) { uv[(ov + i) * 2] = U.getX(i) * su + ou; uv[(ov + i) * 2 + 1] = U.getY(i) * sv + ovv; }
        col[k] = cr; col[k + 1] = cg; col[k + 2] = cb;
      }
      if (g.index) for (let i = 0; i < g.index.count; i++) idx[oi + i] = g.index.getX(i) + ov; else for (let i = 0; i < Pp.count; i++) idx[oi + i] = i + ov;
      ov += Pp.count; oi += g.index ? g.index.count : Pp.count;
    }
    const bg = new THREE.BufferGeometry(); bg.setAttribute("position", new THREE.BufferAttribute(pos, 3)); bg.setAttribute("normal", new THREE.BufferAttribute(nor, 3)); bg.setAttribute("uv", new THREE.BufferAttribute(uv, 2)); bg.setAttribute("color", new THREE.BufferAttribute(col, 3)); bg.setIndex(new THREE.BufferAttribute(idx, 1)); bg.computeBoundingSphere();
    out.push(new THREE.Mesh(bg, mat));
  }
  return out;
}

// ---------------------------------------------------------------- environments and chunk templates
const ENVS = [
  { k: "high", name: "THE HIGH STREET", fog: 0x1a1830, sky: 0x0c0c22, mix: { shop: 0.5, pub: 0.25, house: 0.25 } },
  { k: "terrace", name: "THE TERRACES", fog: 0x141c30, sky: 0x080c1e, mix: { house: 0.85, shop: 0.1, pub: 0.05 } },
  { k: "city", name: "THE CITY CENTRE", fog: 0x1c1430, sky: 0x100a24, mix: { city: 1 } },
  { k: "canal", name: "THE CANAL", fog: 0x10202a, sky: 0x060e18, mix: { mill: 1 } },
];
function pickKind(mix) { let r = Math.random(); for (const [k, v] of Object.entries(mix)) { r -= v; if (r <= 0) return k; } return Object.keys(mix)[0]; }
const lampCol = new THREE.Color(1.0, 0.72, 0.42);
function building(L, side, kind, z0, w, rnd2) {
  const s = slotsOf(kind === "mill" ? "mill" : kind)[Math.floor(Math.random() * slotsOf(kind === "mill" ? "mill" : kind).length)];
  const ry = side < 0 ? Math.PI / 2 : -Math.PI / 2, x = side * FRONT, zc = z0 - w / 2;
  const H = kind === "city" ? 8 : kind === "mill" ? rnd(10, 13) : rnd(7.2, 8.4);
  P(L, PLANE, M.front, null, x, H / 2, zc, w, H, 1, ry, 0, 0, s.u);
  P(L, BOX, M.plain, "#2a2224", side * (FRONT + 4), H / 2, zc, 8, H, w - 0.05);
  if (kind === "city") { const T = rnd(14, 34); P(L, BOX, M.office, null, side * (FRONT + 4), H + T / 2, zc, 8, T, w - 0.05, 0, 0, 0, [w / 6, T / 6]); P(L, BOX, M.plain, "#1a1c22", side * (FRONT + 4), H + T + 0.3, zc, 8.4, 0.6, w + 0.2); if (chance(0.3)) P(L, BOX, M.lights, new THREE.Color(2, 0.2, 0.2), side * (FRONT + 2), H + T + 1, zc, 0.3, 0.3, 0.3); }
  else if (kind === "mill") { P(L, BOX, M.plain, "#3a2a24", side * (FRONT + 4), H + 0.3, zc, 8.4, 0.6, w + 0.1); if (chance(0.4)) { P(L, CYL, M.plain, "#6a3a2a", side * (FRONT + 5), H + 6, zc, 1.6, 12, 1.6); } }
  else {
    P(L, ROOF, M.plain, pick(["#2a2c34", "#34303a", "#3a2a26"]), side * (FRONT + 4), H, zc, w + 0.05, 2.6, 8.6, ry);
    P(L, BOX, M.plain, "#1c1c22", side * (FRONT - 0.1), H - 0.1, zc, 0.3, 0.25, w + 0.1);
    if (chance(0.6)) { P(L, BOX, M.plain, "#6a3a2a", side * (FRONT + 2.6), H + 2, z0 - 0.4, 0.9, 1.7, 0.7); for (const dz of [-0.2, 0.2]) P(L, CYL, M.plain, "#a0583a", side * (FRONT + 2.6), H + 3, z0 - 0.4 + dz, 0.2, 0.4, 0.2); }
  }
  if (kind === "shop" && chance(0.6)) { const c = new THREE.Color(pick(["#b81a1a", "#1a4aa8", "#1a7a3a", "#d87a1a", "#5a1a7a"])); P(L, BOX, M.plain, c, side * (FRONT - 0.55), 3.05, zc - 0.6, 1.1, 0.08, w - 1.6, 0, 0, side * 0.3); P(L, BOX, M.plain, c, side * (FRONT - 1.08), 2.85, zc - 0.6, 0.05, 0.36, w - 1.6); }
  if (kind === "pub") { P(L, BOX, M.plain, "#1a1a1a", side * (FRONT - 0.6), 4.0, z0 - 0.5, 1.2, 0.06, 0.06); P(L, BOX, M.plain, pick(["#4a0e14", "#0f3a24"]), side * (FRONT - 1.0), 3.5, z0 - 0.5, 0.06, 0.9, 0.75); P(L, BOX, M.lights, new THREE.Color(1.6, 1.2, 0.6), side * (FRONT - 0.25), 2.8, zc + w / 2 - 1.2, 0.18, 0.28, 0.18); }
  if (kind === "shop" || kind === "pub" || kind === "city") streak(L, side * (ROAD - 1.2), zc, kind === "city" ? new THREE.Color(0.25, 0.25, 0.35) : new THREE.Color(0.4, 0.28, 0.16), 2.2, w * 0.9);
}
function streak(L, x, z, col, w, len) { P(L, PLANE, M.streak, col, x, 0.02, z, w, len, 1, 0, -Math.PI / 2); }
function furniture(L, env, side, z) {
  const x = side * (ROAD + 0.75), r = Math.random();
  if (r < 0.1 && env !== "canal") { P(L, RBOX, M.shiny, "#c8101a", x + side * 0.5, 1.25, z, 0.95, 2.5, 0.95); P(L, BOX, M.shiny, "#c8101a", x + side * 0.5, 2.6, z, 1.08, 0.22, 1.08); P(L, BOX, M.lights, new THREE.Color(1.2, 1.1, 0.85), x + side * 0.5, 1.4, z, 0.97, 1.4, 0.75); }
  else if (r < 0.22) { P(L, CYL, M.shiny, "#c8101a", x, 0.75, z, 0.52, 1.25, 0.52); P(L, SPH, M.shiny, "#c8101a", x, 1.38, z, 0.54, 0.36, 0.54); P(L, CYL, M.plain, "#111", x, 0.17, z, 0.6, 0.06, 0.6); }
  else if (r < 0.36) { P(L, CYL, M.plain, "#1a1a1e", x, 0.58, z, 0.56, 0.9, 0.56); P(L, CYL, M.shiny, "#c8a040", x, 0.92, z, 0.58, 0.08, 0.58); }
  else if (r < 0.5) { for (let k = 0; k < 4; k++) P(L, CYL, M.shiny, "#0c0c0e", side * (ROAD + 0.35), 0.62, z + k * 1.3, 0.18, 0.9, 0.18); }
  else if (r < 0.62) { P(L, BOX, M.plain, "#4a3424", x + side * 0.9, 0.5, z, 0.5, 0.08, 1.8); P(L, BOX, M.plain, "#4a3424", x + side * 1.12, 0.8, z, 0.06, 0.45, 1.8); }
  else if (r < 0.8 && (env === "city" || env === "high" || env === "canal")) { P(L, CYL, M.plain, "#4a3020", x, 1.6, z, 0.26, 3.2, 0.26); P(L, SPH, M.plain, pick(["#2e5a2a", "#3a6a32", "#264e24"]), x, 4.1, z, 2.8, 2.6, 2.8); }
  else if (r < 0.88) { P(L, CYL, M.shiny, "#3c4048", x, 1.2, z, 0.08, 2.4, 0.08); P(L, CYL, M.plain, "#ffffff", x, 2.6, z - 0.03, 0.62, 0.06, 0.62, 0, Math.PI / 2); P(L, CYL, M.plain, "#d01822", x, 2.6, z - 0.02, 0.72, 0.05, 0.72, 0, Math.PI / 2); }
}
function buildTemplate(env) {
  const L = [];
  for (const side of [-1, 1]) {
    // pavement kerb + the buildings (or the canal on the left)
    if (env.k === "canal" && side < 0) {
      P(L, BOX, M.plain, "#5a5a60", -PAVE - 0.3, 0.5, -CH / 2, 0.4, 0.7, CH); for (let z = 0; z > -CH; z -= 2.5) P(L, BOX, M.shiny, "#1a1c20", -PAVE - 0.3, 1.2, z, 0.06, 0.8, 0.06); P(L, BOX, M.shiny, "#1a1c20", -PAVE - 0.3, 1.6, -CH / 2, 0.06, 0.06, CH);
      P(L, PLANE, M.water, null, -PAVE - 9, -0.8, -CH / 2, 17, CH, 1, 0, -Math.PI / 2);
      if (chance(0.7)) { const z = rnd(-30, -10), c = pick(["#1a4a2a", "#7a1a1a", "#1a2a5a"]); P(L, RBOX, M.plain, c, -PAVE - 4, -0.2, z, 2.2, 1.2, 14); P(L, BOX, M.plain, "#e8d8a0", -PAVE - 4, 0.6, z, 1.9, 0.9, 10); for (let k = 0; k < 5; k++) P(L, BOX, M.lights, new THREE.Color(1.3, 0.9, 0.5), -PAVE - 2.95, 0.65, z - 4 + k * 2, 0.04, 0.4, 0.8); }
      for (let k = 0; k < 3; k++) { const z = -k * 13 - rnd(2, 8); P(L, CYL, M.plain, "#3a2a1a", -PAVE - 18, 3, z, 0.4, 6, 0.4); P(L, SPH, M.plain, pick(["#1e3a1c", "#264a22"]), -PAVE - 18, 7, z, 7, 6, 7); }
    } else {
      let z = 0; const kinds = env.mix;
      while (z > -CH + 0.5) { const kind = pickKind(kinds), w = Math.min(kind === "city" ? rnd(10, 14) : kind === "mill" ? rnd(12, 16) : kind === "house" ? rnd(5.2, 6) : rnd(6.5, 8), z + CH); if (w < 2) break; building(L, side, kind, z, w); z -= w; }
    }
    // lamps every 20 m (staggered), each with a pool of light and a wet-road reflection
    for (const lz of side < 0 ? [-5, -25] : [-15, -35]) {
      const x = side * (ROAD + 0.55); P(L, CYL, M.shiny, "#3a3e46", x, 3.5, lz, 0.15, 7, 0.15); P(L, BOX, M.shiny, "#3a3e46", x - side * 0.6, 6.95, lz, 1.2, 0.1, 0.12);
      P(L, BOX, M.lights, new THREE.Color(2.4, 1.9, 1.3), x - side * 1.15, 6.85, lz, 0.55, 0.1, 0.3);
      P(L, PLANE, M.glow, new THREE.Color(0.5, 0.36, 0.22), x - side * 2, 0.025, lz, 11, 11, 1, 0, -Math.PI / 2);
      streak(L, x - side * 1.6, lz + 5, new THREE.Color(0.9, 0.62, 0.32), 1.1, 12);
    }
    for (let z = -3; z > -CH; z -= rnd(5, 9)) furniture(L, env.k, side, z);
  }
  const meshes = bake(L);
  return { env, meshes, lamps: [[-(ROAD + 0.55) + 1.15, -5], [-(ROAD + 0.55) + 1.15, -25], [(ROAD + 0.55) - 1.15, -15], [(ROAD + 0.55) - 1.15, -35]] };
}
// each template gets two placeable copies (meshes share the baked geometry, so copies cost nothing extra)
const TEMPLATES = [];
for (const env of ENVS) for (let v = 0; v < 4; v++) {
  const t = buildTemplate(env);
  for (let c = 0; c < 2; c++) { const g = new THREE.Group(); for (const m of t.meshes) { const mm = c ? new THREE.Mesh(m.geometry, m.material) : m; mm.receiveShadow = m.material !== M.glow && m.material !== M.streak; g.add(mm); } g.visible = false; scene.add(g); TEMPLATES.push({ env: env.k, g, lamps: t.lamps, used: false }); }
}
// the road and pavements are long strips that follow you (their textures scroll in step, so nothing is rebuilt)
const road = new THREE.Mesh(new THREE.PlaneGeometry(ROAD * 2, 260), M.road); road.rotation.x = -Math.PI / 2; road.receiveShadow = true; scene.add(road);
const paves = [-1, 1].map((s) => { const m = new THREE.Mesh(new THREE.BoxGeometry(PAVE - ROAD, 0.16, 260), M.pave); m.position.x = s * (ROAD + PAVE) / 2; m.position.y = 0.08; m.receiveShadow = true; scene.add(m); return m; });
const kerbs = [-1, 1].map((s) => { const m = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.17, 260), new THREE.MeshStandardMaterial({ color: 0x8a8a92, roughness: 0.6 })); m.position.set(s * (ROAD + 0.1), 0.085, 0); scene.add(m); return m; });
const grass = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: 0x0c1410, roughness: 1 })); grass.rotation.x = -Math.PI / 2; grass.position.y = -0.9; scene.add(grass);
// sky dome and distant skyline
const skyMat = new THREE.MeshBasicMaterial({ side: THREE.BackSide, fog: false, depthWrite: false });
const SKY = { night: ["#03050c", "#0a1028", "#1e2244", "#3a2e40"], dusk: ["#0c1030", "#3a2a6a", "#c85a6a", "#ffa060"], storm: ["#06080c", "#10141c", "#1e222a", "#262830"], fog: ["#2a2e38", "#3a3e48", "#4a4c54", "#505258"] };
const skyTex = {}; for (const [k, c] of Object.entries(SKY)) skyTex[k] = ctex(8, 256, (g) => { const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, c[0]); gr.addColorStop(0.42, c[1]); gr.addColorStop(0.5, c[2]); gr.addColorStop(0.53, c[3]); gr.addColorStop(1, c[2]); g.fillStyle = gr; g.fillRect(0, 0, 8, 256); });
const sky = new THREE.Mesh(new THREE.SphereGeometry(210, 24, 12), skyMat); sky.renderOrder = -10; scene.add(sky);
const stars = (() => { const st = []; for (let i = 0; i < 380; i++) { const a = Math.random() * Math.PI * 2, e = rnd(0.15, 1.4); st.push(Math.cos(a) * Math.cos(e) * 200, Math.sin(e) * 200, Math.sin(a) * Math.cos(e) * 200); } const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(st, 3)); return new THREE.Points(g, new THREE.PointsMaterial({ size: 1.4, color: 0xffffff, transparent: true, opacity: 0.8, fog: false, sizeAttenuation: false, depthWrite: false })); })(); sky.add(stars);
const moonDisc = new THREE.Mesh(new THREE.CircleGeometry(7, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.5, 1.3), fog: false })); moonDisc.position.set(-60, 90, -170); moonDisc.lookAt(0, 0, 0); sky.add(moonDisc);
const skyline = (() => { const tex = ctex(2048, 256, (g, w, h) => { for (let x = 0; x < w;) { const bw = rnd(20, 70), bh = rnd(20, 110); g.fillStyle = "#090b14"; g.fillRect(x, h - bh, bw, bh); for (let k = 0; k < bw * bh / 260; k++) { g.fillStyle = pick(["#ffc878", "#ffe0a8", "#9cc8ff"]); g.globalAlpha = rnd(0.3, 0.9); g.fillRect(x + rnd(2, bw - 4), h - bh + rnd(4, bh - 4), 2, 3); } g.globalAlpha = 1; if (chance(0.05)) { g.fillStyle = "#ff3030"; g.fillRect(x + bw / 2 - 2, h - bh - 4, 4, 4); } x += bw + rnd(0, 8); }
  g.fillStyle = "#090b14"; g.fillRect(1300, 120, 18, 136); g.beginPath(); g.moveTo(1296, 120); g.lineTo(1309, 86); g.lineTo(1322, 120); g.fill(); g.fillStyle = "#ffe8b0"; g.beginPath(); g.arc(1309, 134, 6, 0, 7); g.fill();
  g.strokeStyle = "rgba(200,120,255,.85)"; g.lineWidth = 3; g.beginPath(); g.arc(1500, 160, 70, 0, 7); g.stroke(); for (let a = 0; a < 6.28; a += 0.4) { g.beginPath(); g.moveTo(1500, 160); g.lineTo(1500 + Math.cos(a) * 70, 160 + Math.sin(a) * 70); g.stroke(); } });
  tex.wrapS = THREE.RepeatWrapping; const m = new THREE.Mesh(new THREE.CylinderGeometry(190, 190, 70, 40, 1, true), new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.BackSide, fog: false, depthWrite: false })); m.position.y = 22; scene.add(m); return m; })();

// ---------------------------------------------------------------- chunks: placing templates ahead of the runner
const chunks = [];   // {t: template, z0}
let envI = 0, envLeft = 6, envNow = ENVS[0];
function nextTemplate() {
  if (envLeft <= 0) { envI = (envI + 1) % ENVS.length; envLeft = rnd(5, 8) | 0; }
  envLeft--; const env = ENVS[envI];
  const free = TEMPLATES.filter((t) => t.env === env.k && !t.used); const t = free.length ? pick(free) : TEMPLATES.find((x) => !x.used);
  t.used = true; t.g.visible = true; return t;
}
function placeChunks(force) {
  if (force) { for (const c of chunks) { c.t.used = false; c.t.g.visible = false; } chunks.length = 0; envI = 0; envLeft = 6; }
  while (chunks.length < NVIS) { const z0 = chunks.length ? chunks[chunks.length - 1].z0 - CH : pz + CH; const t = nextTemplate(); t.g.position.z = z0; chunks.push({ t, z0 }); }
  while (chunks.length && chunks[0].z0 - CH > pz + 20) { const c = chunks.shift(); c.t.used = false; c.t.g.visible = false; const z0 = chunks[chunks.length - 1].z0 - CH, t = nextTemplate(); t.g.position.z = z0; chunks.push({ t, z0 }); }
}

// ---------------------------------------------------------------- weather & time of night (one per run)
const WEATHER = [
  { k: "clear", n: "Clear night", sky: "night", rain: 0, wet: 0.15, fogNear: 30, fogFar: 175, w: 3 },
  { k: "dusk", n: "Evening", sky: "dusk", rain: 0, wet: 0.1, fogNear: 34, fogFar: 185, w: 2.5 },
  { k: "fog", n: "Foggy", sky: "fog", rain: 0, wet: 0.4, fogNear: 6, fogFar: 70, w: 1 },
  { k: "rain", n: "Rainy night", sky: "storm", rain: 1, wet: 1, fogNear: 20, fogFar: 140, w: 1.4 },
];
let weather = WEATHER[0];
const RAIN_N = 900, rainPos = new Float32Array(RAIN_N * 6), rainGeo = new THREE.BufferGeometry(); rainGeo.setAttribute("position", new THREE.BufferAttribute(rainPos, 3));
const rain = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: 0x9fb4e0, transparent: true, opacity: 0.3, depthWrite: false })); rain.frustumCulled = false; scene.add(rain);
function seedDrop(i, z, top) { const x = rnd(-14, 14), y = top ? rnd(10, 15) : rnd(0, 15), zz = z + rnd(-30, 6); rainPos.set([x, y, zz, x + 0.02, y - 0.6, zz + 0.12], i * 6); }
for (let i = 0; i < RAIN_N; i++) seedDrop(i, 0, false);
function setWeather(w) {
  weather = w; skyMat.map = skyTex[w.sky]; skyMat.needsUpdate = true; stars.visible = w.sky === "night" || w.sky === "dusk"; moonDisc.visible = w.sky === "night";
  scene.fog.near = w.fogNear; scene.fog.far = w.fogFar; rain.visible = w.rain > 0; rainGeo.setDrawRange(0, Math.floor(RAIN_N * (Q >= 1 ? 1 : 0.5)) * 2);
  M.road.roughness = lerp(0.65, 0.18, w.wet); M.road.metalness = lerp(0.08, 0.35, w.wet); M.pave.roughness = lerp(0.75, 0.35, w.wet); M.streak.opacity = lerp(0.15, 0.6, w.wet);
  hemi.intensity = w.sky === "dusk" ? 1.35 : w.sky === "fog" ? 1.25 : w.sky === "storm" ? 0.8 : 1.0; moon.intensity = w.sky === "dusk" ? 1.2 : w.sky === "storm" ? 0.35 : 0.9; moon.color.set(w.sky === "dusk" ? 0xffa07a : 0xa9b8ff);
}

// ---------------------------------------------------------------- people: a proper little rig with clothes and a face
const CAPS = new THREE.CapsuleGeometry(0.5, 1, 6, 12);
function makePerson(o) {
  const mats = { skin: new THREE.MeshStandardMaterial({ color: o.skin, roughness: 0.6 }), top: new THREE.MeshStandardMaterial({ color: o.top, roughness: 0.75 }), legs: new THREE.MeshStandardMaterial({ color: o.legs, roughness: 0.85 }), hair: new THREE.MeshStandardMaterial({ color: o.hair, roughness: 0.8 }), shoe: new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.5 }), sole: new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.8 }), cap: new THREE.MeshStandardMaterial({ color: o.cap || 0xf2f2f2, roughness: 0.55 }), eye: new THREE.MeshBasicMaterial({ color: 0xffffff }), pupil: new THREE.MeshBasicMaterial({ color: 0x1a1210 }), dark: new THREE.MeshStandardMaterial({ color: 0x2a1a14, roughness: 0.8 }) };
  const cap = (r, len, m) => { const x = new THREE.Mesh(CAPS, m); x.scale.set(r * 2, len / 2 + r, r * 2); return x; };
  const root = new THREE.Group(), hips = new THREE.Group(); hips.position.y = 0.95; root.add(hips);
  const pelvis = new THREE.Mesh(SPH, mats.legs); pelvis.scale.set(0.42, 0.26, 0.3); hips.add(pelvis);
  const spine = new THREE.Group(); spine.position.y = 0.08; hips.add(spine);
  const torso = cap(0.2, 0.34, mats.top); torso.position.y = 0.3; torso.scale.x *= 1.15; torso.scale.z *= 0.78; spine.add(torso);
  const pocket = new THREE.Mesh(BOX, mats.top); pocket.scale.set(0.28, 0.1, 0.06); pocket.position.set(0, 0.18, -0.15); spine.add(pocket);
  const hood = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.06, 8, 16), mats.top); hood.position.set(0, 0.6, 0.06); hood.rotation.x = Math.PI / 2 + 0.3; spine.add(hood);
  const neck = new THREE.Group(); neck.position.y = 0.66; spine.add(neck);
  const head = new THREE.Group(); head.position.y = 0.17; neck.add(head);
  const skull = new THREE.Mesh(SPH, mats.skin); skull.scale.set(0.32, 0.37, 0.33); head.add(skull);
  const jaw = new THREE.Mesh(SPH, mats.skin); jaw.scale.set(0.26, 0.2, 0.26); jaw.position.set(0, -0.08, -0.03); head.add(jaw);
  const nose = new THREE.Mesh(SPH, mats.skin); nose.scale.set(0.05, 0.07, 0.06); nose.position.set(0, -0.01, -0.165); head.add(nose);
  const eyes = []; for (const x of [-0.06, 0.06]) { const e = new THREE.Mesh(SPH, mats.eye); e.scale.set(0.05, 0.04, 0.03); e.position.set(x, 0.035, -0.148); head.add(e); const p = new THREE.Mesh(SPH, mats.pupil); p.scale.set(0.024, 0.026, 0.02); p.position.set(x, 0.035, -0.162); head.add(p); const b = new THREE.Mesh(BOX, mats.dark); b.scale.set(0.07, 0.014, 0.02); b.position.set(x, 0.085, -0.155); head.add(b); eyes.push(e); }
  const mouth = new THREE.Mesh(BOX, mats.dark); mouth.scale.set(0.06, 0.012, 0.02); mouth.position.set(0, -0.085, -0.15); head.add(mouth);
  const ears = []; for (const x of [-0.16, 0.16]) { const e = new THREE.Mesh(SPH, mats.skin); e.position.set(x, 0, 0); e.scale.set(0.05, 0.09, 0.07); head.add(e); ears.push(e); }
  const limbs = {};
  for (const [name, x] of [["L", -0.1], ["R", 0.1]]) {
    const thigh = new THREE.Group(); thigh.position.set(x, -0.02, 0); hips.add(thigh);
    const ul = cap(0.085, 0.3, mats.legs); ul.position.y = -0.22; thigh.add(ul);
    const knee = new THREE.Group(); knee.position.y = -0.44; thigh.add(knee);
    const ll = cap(0.072, 0.3, mats.legs); ll.position.y = -0.2; knee.add(ll);
    const ankle = new THREE.Group(); ankle.position.y = -0.42; knee.add(ankle);
    const foot = new THREE.Mesh(RBOX, mats.shoe); foot.scale.set(0.12, 0.09, 0.27); foot.position.set(0, -0.02, -0.06); ankle.add(foot);
    const sole = new THREE.Mesh(BOX, mats.sole); sole.scale.set(0.125, 0.03, 0.28); sole.position.set(0, -0.065, -0.06); ankle.add(sole);
    const sh = new THREE.Group(); sh.position.set(x * 2.45, 0.56, 0); spine.add(sh);
    const ua = cap(0.065, 0.24, mats.top); ua.position.y = -0.15; sh.add(ua);
    const el = new THREE.Group(); el.position.y = -0.3; sh.add(el);
    const la = cap(0.058, 0.2, mats.top); la.position.y = -0.13; el.add(la);
    const hand = new THREE.Mesh(SPH, mats.skin); hand.scale.set(0.1, 0.11, 0.08); hand.position.y = -0.29; el.add(hand);
    limbs[name] = { thigh, knee, ankle, sh, el };
  }
  const H = {};
  const hairCap = () => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.5, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), mats.hair); m.scale.set(0.34, 0.4, 0.35); m.position.y = 0.01; return m; };
  H.short = hairCap();
  H.cap = new THREE.Group(); { const c = new THREE.Mesh(new THREE.SphereGeometry(0.5, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), mats.cap); c.scale.set(0.35, 0.36, 0.36); c.position.y = 0.04; const peak = new THREE.Mesh(CYL, mats.cap); peak.scale.set(0.3, 0.02, 0.18); peak.position.set(0, 0.06, -0.17); peak.rotation.x = -0.15; H.cap.add(c, peak); }
  H.pony = new THREE.Group(); { const t = cap(0.06, 0.24, mats.hair); t.position.set(0, -0.06, 0.2); t.rotation.x = 0.5; H.pony.add(hairCap(), t); H.pony.userData.tail = t; }
  H.long = new THREE.Group(); { const b = cap(0.15, 0.3, mats.hair); b.scale.x *= 1.15; b.scale.z *= 0.55; b.position.set(0, -0.16, 0.1); H.long.add(hairCap(), b); }
  H.quiff = new THREE.Group(); { const q = new THREE.Mesh(SPH, mats.hair); q.position.set(0, 0.17, -0.1); q.scale.set(0.26, 0.14, 0.2); H.quiff.add(hairCap(), q); }
  H.mop = new THREE.Group(); for (let i = 0; i < 9; i++) { const b = new THREE.Mesh(SPH, mats.hair); b.scale.setScalar(0.16); const a = (i / 9) * Math.PI * 2; b.position.set(Math.cos(a) * 0.13, 0.12 + Math.sin(i * 3) * 0.03, Math.sin(a) * 0.13); H.mop.add(b); }
  H.weed = new THREE.Group(); for (let i = 0; i < 9; i++) { const c = new THREE.Mesh(CONE, mats.hair); c.scale.set(0.05, 0.24, 0.05); const a = (i / 9) * Math.PI * 2; c.position.set(Math.cos(a) * 0.09, 0.2, Math.sin(a) * 0.09); c.rotation.set(Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6); H.weed.add(c); }
  const gold = new THREE.MeshStandardMaterial({ color: 0xffd24a, metalness: 0.9, roughness: 0.25, emissive: 0x6a4a00 });
  H.crown = new THREE.Group(); { const band = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.07, 20, 1, true), gold); band.position.y = 0.2; H.crown.add(band); for (let i = 0; i < 6; i++) { const s = new THREE.Mesh(CONE, gold); s.scale.set(0.07, 0.1, 0.07); const a = (i / 6) * Math.PI * 2; s.position.set(Math.cos(a) * 0.15, 0.27, Math.sin(a) * 0.15); H.crown.add(s); } }
  H.tiara = new THREE.Group(); { const t = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.012, 6, 24, Math.PI), gold); t.rotation.x = -Math.PI / 2; t.position.set(0, 0.17, 0); const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.035), new THREE.MeshStandardMaterial({ color: 0xff5c8a, emissive: 0x8a1030 })); gem.position.set(0, 0.22, -0.15); H.tiara.add(t, gem); }
  for (const k in H) { head.add(H[k]); H[k].visible = false; }
  const wartM = new THREE.MeshStandardMaterial({ color: 0x3f5a22, roughness: 0.9 }); const warts = new THREE.Group();
  for (const [x, y, z] of [[0.1, 0.05, -0.12], [-0.12, -0.04, -0.1], [0.05, -0.1, -0.14], [-0.04, 0.12, -0.12], [0.14, -0.06, 0.04], [-0.15, 0.06, 0.02]]) { const w = new THREE.Mesh(SPH, wartM); w.scale.setScalar(0.05); w.position.set(x, y, z); warts.add(w); }
  head.add(warts);
  root.traverse((m) => { if (m.isMesh) { m.castShadow = true; } });
  const blob = new THREE.Mesh(PLANE, new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false })); blob.rotation.x = -Math.PI / 2; blob.scale.set(0.9, 0.9, 1); blob.position.y = 0.17; root.add(blob);
  const Pp = { root, hips, spine, neck, head, torso, limbs, H, warts, ears, eyes, mats, style: null, blob };
  Pp.setStyle = (st, extra) => { for (const k in H) H[k].visible = false; if (H[st]) H[st].visible = true; if (extra && H[extra]) H[extra].visible = true; Pp.style = st; };
  return Pp;
}
// animation: a proper run cycle (arms opposite legs, knee lift, foot roll, torso twist and bob), jump, slide, stumble
function animate(Pp, ph, mode, k = 1, lean = 0) {
  const L = Pp.limbs.L, R = Pp.limbs.R, s = Math.sin(ph), c = Math.cos(ph);
  Pp.hips.position.y = 0.95; Pp.hips.rotation.set(0, 0, 0); Pp.spine.rotation.set(0, 0, 0); Pp.neck.rotation.set(0, 0, 0); Pp.root.rotation.z = lean;
  if (mode === "run" || mode === "reach") {
    for (const [Lg, sg] of [[L, 1], [R, -1]]) {
      const sw = s * sg; Lg.thigh.rotation.x = -sw * 0.95 * k; Lg.knee.rotation.x = Math.max(0, sw * 0.4 + 0.25 + Math.max(0, -Math.sin(ph + (sg > 0 ? 0 : Math.PI) - 0.9)) * 1.5) * k; Lg.ankle.rotation.x = -sw * 0.35 * k;
      Lg.sh.rotation.x = sw * 0.95 * k; Lg.sh.rotation.z = sg * -0.12; Lg.el.rotation.x = -1.35 + sw * 0.25;
    }
    Pp.hips.position.y = 0.95 + Math.abs(c) * 0.075 * k - 0.03; Pp.spine.rotation.x = -0.22 * k; Pp.spine.rotation.y = s * 0.16 * k; Pp.hips.rotation.y = -s * 0.1 * k; Pp.neck.rotation.x = 0.16 * k;
    if (mode === "reach") { L.sh.rotation.x = -2.5 + s * 0.15; R.sh.rotation.x = -2.5 - s * 0.15; L.el.rotation.x = -0.25; R.el.rotation.x = -0.25; Pp.spine.rotation.x = -0.3; }
  } else if (mode === "jump") {
    const t = k; // 0 = take off, 1 = top
    L.thigh.rotation.x = -1.3 * t - 0.2; R.thigh.rotation.x = -0.5 * t + 0.3; L.knee.rotation.x = 1.7 * t + 0.2; R.knee.rotation.x = 1.4 * t + 0.3; L.ankle.rotation.x = R.ankle.rotation.x = 0.3;
    L.sh.rotation.x = -2.2 * t; R.sh.rotation.x = -1.6 * t + 0.4; L.sh.rotation.z = 0.4; R.sh.rotation.z = -0.4; L.el.rotation.x = R.el.rotation.x = -0.5; Pp.spine.rotation.x = -0.2;
  } else if (mode === "slide") {
    Pp.hips.position.y = 0.36; Pp.hips.rotation.x = 1.05; Pp.spine.rotation.x = 0.25; Pp.neck.rotation.x = -0.7;
    L.thigh.rotation.x = -1.45; R.thigh.rotation.x = -0.9; L.knee.rotation.x = 0.1; R.knee.rotation.x = 1.2; L.ankle.rotation.x = R.ankle.rotation.x = 0.4;
    L.sh.rotation.x = 0.5; R.sh.rotation.x = 0.7; L.sh.rotation.z = 0.5; R.sh.rotation.z = -0.5; L.el.rotation.x = R.el.rotation.x = -0.3;
  } else if (mode === "stumble") {
    Pp.spine.rotation.x = -0.6; Pp.neck.rotation.x = 0.4; L.sh.rotation.x = -2.6; R.sh.rotation.x = -2.0; L.sh.rotation.z = 0.8; R.sh.rotation.z = -0.8;
    L.thigh.rotation.x = -s * 0.9; R.thigh.rotation.x = s * 0.9; L.knee.rotation.x = R.knee.rotation.x = 0.8;
  } else if (mode === "down") {
    Pp.hips.position.y = 0.3; Pp.hips.rotation.x = -1.4; L.thigh.rotation.x = R.thigh.rotation.x = 1.4; L.knee.rotation.x = R.knee.rotation.x = 0.1; L.sh.rotation.x = R.sh.rotation.x = -2.8;
  }
  if (Pp.H.pony.visible) Pp.H.pony.userData.tail.rotation.z = Math.sin(ph) * 0.4;
}

// ---------------------------------------------------------------- obstacles, traffic and pick-ups (all pooled)
const halo = (col, s) => { const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: radial, color: col, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); m.scale.set(s, s, 1); return m; };
function proto(build) { const L = []; build(L); const g = new THREE.Group(); for (const m of bake(L)) { if (m.material !== M.glow && m.material !== M.lights) m.castShadow = true; g.add(m); } return g; }
const stripeTex = ctex(256, 32, (g, w, h) => { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? "#f2f2f2" : "#d8261e"; g.beginPath(); g.moveTo(i * 32, 0); g.lineTo(i * 32 + 32, 0); g.lineTo(i * 32 + 16, h); g.lineTo(i * 32 - 16, h); g.fill(); } }, { repeat: true });
M.stripe = new THREE.MeshStandardMaterial({ map: stripeTex, roughness: 0.5 });
const vanLabel = ctex(256, 64, (g, w, h) => { g.fillStyle = "#ffd24a"; g.fillRect(0, 0, w, h); g.fillStyle = "#1a1a1a"; g.font = "bold 34px Arial Black, Impact, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("KEBAB XPRS", w / 2, h / 2 + 2); });
M.vanLabel = new THREE.MeshBasicMaterial({ map: vanLabel });
const busTex = ctex(512, 256, (g, w, h) => { g.fillStyle = "#c21e1e"; g.fillRect(0, 0, w, h); for (const y of [30, 140]) for (let x = 14; x < w - 20; x += 62) { g.fillStyle = "#ffe2a8"; g.fillRect(x, y, 52, 62); } g.fillStyle = "#e8e2d2"; g.fillRect(0, 112, w, 10); g.fillStyle = "#111"; g.fillRect(0, h - 26, w, 26); });
M.bus = new THREE.MeshStandardMaterial({ map: busTex, emissiveMap: busTex, emissive: 0x6a5030, roughness: 0.4, metalness: 0.2 });
const HEAD = new THREE.Color(4, 3.8, 3.4), TAIL = new THREE.Color(3.5, 0.15, 0.2);
function carParts(L, col, facing) { // facing -1: front towards +z (oncoming), the car's nose points at the runner
  const Lc = 4.3, f = facing;
  P(L, RBOX, M.paint, col, 0, 0.62, 0, 1.84, 0.66, Lc); P(L, RBOX, M.paint, col, 0, 1.12, -f * 0.25, 1.68, 0.58, Lc * 0.52); P(L, RBOX, M.glass, null, 0, 1.13, -f * 0.25, 1.74, 0.46, Lc * 0.49);
  for (const [wx, wz] of [[-0.86, -1.4], [0.86, -1.4], [-0.86, 1.4], [0.86, 1.4]]) { P(L, CYL, M.tyre, null, wx, 0.34, wz, 0.68, 0.26, 0.68, 0, 0, Math.PI / 2); P(L, CYL, M.shiny, "#b8bcc4", wx, 0.34, wz, 0.42, 0.27, 0.42, 0, 0, Math.PI / 2); }
  for (const s of [-0.62, 0.62]) { P(L, BOX, M.lights, HEAD, s, 0.74, f * (Lc / 2 - 0.02), 0.42, 0.14, 0.06); P(L, BOX, M.lights, TAIL, s, 0.8, -f * (Lc / 2 - 0.02), 0.4, 0.13, 0.06); P(L, PLANE, M.glow, new THREE.Color(1, 0.95, 0.85), s, 0.74, f * (Lc / 2 + 0.08), 1.3, 1.3, 1, f > 0 ? 0 : Math.PI); }
  P(L, PLANE, M.plate, null, 0, 0.48, f * (Lc / 2 + 0.03), 0.52, 0.12, 1, f > 0 ? 0 : Math.PI);
  P(L, PLANE, M.glow, new THREE.Color(0.45, 0.42, 0.36), 0, 0.03, f * (Lc / 2 + 6), 4.4, 12, 1, 0, -Math.PI / 2);
}
const PROTO = {
  bin: () => proto((L) => { const c = pick(["#2f6b3a", "#1c1e24", "#1e3a7a", "#6a4a1e"]); P(L, RBOX, M.plain, c, 0, 0.58, 0, 0.72, 1.0, 0.8); P(L, BOX, M.plain, c, 0, 1.12, 0.02, 0.8, 0.08, 0.88); for (const x of [-0.28, 0.28]) P(L, CYL, M.tyre, null, x, 0.1, 0.36, 0.2, 0.06, 0.2, 0, 0, Math.PI / 2); }),
  cone: () => proto((L) => { P(L, CONE, M.plain, "#ff5a12", 0, 0.42, 0, 0.52, 0.72, 0.52); P(L, CYL, M.plain, "#f2f2f2", 0, 0.48, 0, 0.32, 0.12, 0.32); P(L, BOX, M.plain, "#ff5a12", 0, 0.03, 0, 0.62, 0.06, 0.62); }),
  barrier: () => proto((L) => { P(L, BOX, M.stripe, null, 0, 0.75, 0, 2.1, 0.32, 0.12, 0, 0, 0, [2, 1]); for (const x of [-0.9, 0.9]) { P(L, BOX, M.plain, "#e8e8e8", x, 0.4, 0, 0.08, 0.8, 0.08); P(L, BOX, M.plain, "#2a2a2a", x, 0.04, 0, 0.1, 0.08, 0.6); } P(L, SPH, M.lights, new THREE.Color(3, 1.6, 0.2), 0.9, 1.0, 0, 0.16, 0.16, 0.16); }),
  scaffold: () => proto((L) => { for (const x of [-0.95, 0.95]) P(L, CYL, M.shiny, "#9aa2b8", x, 1.35, 0, 0.1, 2.7, 0.1); P(L, CYL, M.shiny, "#9aa2b8", 0, 2.65, 0, 0.1, 2.0, 0.1, 0, 0, Math.PI / 2); P(L, BOX, M.stripe, null, 0, 1.25, 0, 2.0, 0.34, 0.3, 0, 0, 0, [2, 1]); P(L, BOX, M.plain, "#8a6a3a", 0, 2.78, 0, 2.1, 0.08, 1.0); }),
  van: () => proto((L) => { P(L, RBOX, M.paint, "#e9edf5", 0, 1.25, 0, 1.7, 1.95, 4.4); for (const x of [-0.4, 0.4]) P(L, BOX, M.glass, null, x, 1.75, 2.21, 0.6, 0.5, 0.04); for (const x of [-0.72, 0.72]) P(L, BOX, M.lights, TAIL, x, 0.9, 2.21, 0.12, 0.35, 0.04); P(L, PLANE, M.vanLabel, null, 0, 1.25, 2.22, 1.2, 0.3, 1); for (const x of [-0.8, 0.8]) for (const z of [-1.4, 1.4]) P(L, CYL, M.tyre, null, x, 0.34, z, 0.68, 0.24, 0.68, 0, 0, Math.PI / 2); P(L, PLANE, M.plate, null, 0, 0.5, 2.23, 0.52, 0.12, 1); }),
  bus: () => proto((L) => { P(L, BOX, M.bus, null, 0, 2.35, 0, 2.5, 4.1, 10.5); P(L, BOX, M.paint, "#b01818", 0, 4.45, 0, 2.45, 0.12, 10.4); for (const x of [-1.15, 1.15]) for (const z of [-3.8, 3.2]) P(L, CYL, M.tyre, null, x, 0.5, z, 1, 0.32, 1, 0, 0, Math.PI / 2); for (const s of [-0.95, 0.95]) { P(L, BOX, M.lights, TAIL, s, 0.9, 5.28, 0.3, 0.3, 0.05); } P(L, BOX, M.lights, new THREE.Color(2.4, 1.6, 0.2), 0, 4.0, 5.27, 1.6, 0.35, 0.04); }),
  car: () => proto((L) => carParts(L, pick(["#0c0c10", "#e8e8ec", "#2a4a8a", "#7a1418", "#8a8e96", "#1a3a2a"]), 1)),
  cab: () => proto((L) => { carParts(L, "#0a0a0c", 1); P(L, BOX, M.lights, new THREE.Color(3, 2, 0.3), 0, 1.47, -0.25, 0.5, 0.16, 0.22); }),
};
// spec: how each obstacle behaves. h = clear it by jumping above this; slide = slide under; solid = caught on contact
const SPEC = { bin: { len: 0.9, w: 0.8, h: 1.15, hit: "stumble" }, cone: { len: 0.6, w: 0.6, h: 0.75, hit: "stumble" }, barrier: { len: 0.4, w: 2.1, h: 1.0, hit: "stumble" }, scaffold: { len: 1.0, w: 2.1, slide: true, hit: "caught" }, van: { len: 4.4, w: 1.8, hit: "caught" }, bus: { len: 10.5, w: 2.5, hit: "caught" }, car: { len: 4.3, w: 1.85, hit: "caught", moving: true }, cab: { len: 4.3, w: 1.85, hit: "caught", moving: true } };
const POOL = {}; const POOL_N = { bin: 10, cone: 10, barrier: 8, scaffold: 5, van: 6, bus: 3, car: 6, cab: 3 };
for (const k in POOL_N) { POOL[k] = []; for (let i = 0; i < POOL_N[k]; i++) { const g = PROTO[k](); g.visible = false; scene.add(g); POOL[k].push({ type: k, g, active: false, lane: 0, z: 0, hit: false, v: 0, honk: false, passed: false }); } }
const live = [];   // active obstacles
function spawnObs(type, lane, z) { const o = POOL[type].find((x) => !x.active); if (!o) return null; o.active = true; o.hit = false; o.lane = lane; o.z = z; o.honk = false; o.passed = false; o.v = SPEC[type].moving ? rnd(7, 10) : 0; o.g.visible = true; o.g.position.set(lane * LANE, 0, z); o.g.rotation.set(0, 0, 0); live.push(o); return o; }
function freeObs(o) { o.active = false; o.g.visible = false; }
// coins and beers: instanced, one draw call per mesh type
const COINS = 140, coinMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.3, 0.3, 0.06, 20), new THREE.MeshStandardMaterial({ color: 0xffc23a, roughness: 0.3, metalness: 0.7, emissive: 0xffa000, emissiveIntensity: 0.55 }), COINS);
const BEERS = 50, beerGlass = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.2, 0.16, 0.5, 16), new THREE.MeshStandardMaterial({ color: 0xffa51f, emissive: 0xff8a00, emissiveIntensity: 0.9, roughness: 0.1, transparent: true, opacity: 0.92 }), BEERS);
const beerFoam = new THREE.InstancedMesh(new THREE.SphereGeometry(0.19, 12, 8), new THREE.MeshStandardMaterial({ color: 0xfff6e0, roughness: 0.9, emissive: 0x3a3020 }), BEERS);
const beerHalo = new THREE.InstancedMesh(PLANE, new THREE.MeshBasicMaterial({ map: radial, color: 0xff9a20, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.6 }), BEERS);
for (const m of [coinMesh, beerGlass, beerFoam, beerHalo]) { m.frustumCulled = false; m.count = m === coinMesh ? COINS : BEERS; scene.add(m); }
const coins = Array.from({ length: COINS }, () => ({ on: false, x: 0, y: 0, z: 0 })), beersA = Array.from({ length: BEERS }, () => ({ on: false, x: 0, y: 0, z: 0 }));
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0); for (let i = 0; i < COINS; i++) coinMesh.setMatrixAt(i, ZERO); for (let i = 0; i < BEERS; i++) { beerGlass.setMatrixAt(i, ZERO); beerFoam.setMatrixAt(i, ZERO); beerHalo.setMatrixAt(i, ZERO); }
function addCoin(x, y, z) { const c = coins.find((q) => !q.on); if (c) { c.on = true; c.x = x; c.y = y; c.z = z; } }
function addBeer(x, z) { const b = beersA.find((q) => !q.on); if (b) { b.on = true; b.x = x; b.y = 1.0; b.z = z; } }
// power-ups: shield, magnet, kebab (speed boost)
const PU_COL = { shield: 0x3da0ff, magnet: 0xff3d5a, kebab: 0xffb030 };
const PUPS = [];
for (const k of ["shield", "magnet", "kebab"]) for (let i = 0; i < 2; i++) {
  const g = new THREE.Group(); const L = [];
  if (k === "shield") { P(L, SPH, M.shiny, "#3da0ff", 0, 0, 0, 0.5, 0.6, 0.12); P(L, SPH, M.lights, new THREE.Color(0.9, 1.4, 2.2), 0, 0.02, -0.07, 0.22, 0.3, 0.05); }
  if (k === "magnet") { P(L, new THREE.TorusGeometry(0.22, 0.09, 10, 20, Math.PI), M.shiny, "#e8203a", 0, 0.05, 0, 1, 1, 1, 0, 0, Math.PI); for (const x of [-0.22, 0.22]) P(L, BOX, M.shiny, "#e8e8f0", x, -0.05, 0, 0.18, 0.14, 0.18); }
  if (k === "kebab") { P(L, SPH, M.plain, "#e8c38a", 0, 0, 0, 0.6, 0.45, 0.33); P(L, BOX, M.plain, "#8a4a26", 0, 0.12, 0, 0.42, 0.16, 0.2); P(L, BOX, M.plain, "#5fbf5a", -0.1, 0.22, 0, 0.16, 0.06, 0.18); P(L, BOX, M.plain, "#e4473a", 0.1, 0.22, 0, 0.1, 0.06, 0.16); }
  for (const m of bake(L)) g.add(m); const h = halo(PU_COL[k], 2.2); g.add(h); g.visible = false; scene.add(g); PUPS.push({ k, g, on: false, x: 0, z: 0 });
}
function addPup(k, lane, z) { const p = PUPS.find((q) => q.k === k && !q.on); if (!p) return; p.on = true; p.x = lane * LANE; p.z = z; p.g.visible = true; p.g.position.set(p.x, 1.1, z); }
// shield bubble around the runner
const bubble = new THREE.Mesh(new THREE.SphereGeometry(1.1, 24, 16), new THREE.MeshBasicMaterial({ color: 0x3da0ff, transparent: true, opacity: 0.18, depthWrite: false, blending: THREE.AdditiveBlending })); bubble.visible = false; scene.add(bubble);
// sparks: one points system for every effect
const NP = 260, pPos = new Float32Array(NP * 3), pCol = new Float32Array(NP * 3), pVel = new Float32Array(NP * 3), pLife = new Float32Array(NP);
const pGeo = new THREE.BufferGeometry(); pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3)); pGeo.setAttribute("color", new THREE.BufferAttribute(pCol, 3));
const sparks = new THREE.Points(pGeo, new THREE.PointsMaterial({ size: 0.22, map: radial, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); sparks.frustumCulled = false; scene.add(sparks);
let pNext = 0; const _c = new THREE.Color();
function burst(x, y, z, n, col, spd, up = 3) { _c.set(col); for (let i = 0; i < n; i++) { const k = pNext++ % NP; pPos[k * 3] = x; pPos[k * 3 + 1] = y; pPos[k * 3 + 2] = z; pVel[k * 3] = rnd(-1, 1) * spd; pVel[k * 3 + 1] = rnd(0.3, 1) * up; pVel[k * 3 + 2] = rnd(-1, 1) * spd; pCol[k * 3] = _c.r; pCol[k * 3 + 1] = _c.g; pCol[k * 3 + 2] = _c.b; pLife[k] = rnd(0.4, 0.9); } }
function stepSparks(dt) { for (let k = 0; k < NP; k++) { if (pLife[k] <= 0) { pPos[k * 3 + 1] = -50; continue; } pLife[k] -= dt; pVel[k * 3 + 1] -= 9 * dt; pPos[k * 3] += pVel[k * 3] * dt; pPos[k * 3 + 1] += pVel[k * 3 + 1] * dt; pPos[k * 3 + 2] += pVel[k * 3 + 2] * dt; } pGeo.attributes.position.needsUpdate = true; }

// ---------------------------------------------------------------- game state
let who = store.get("bgWho") === "lass" ? "lass" : "lad";
const chaserKind = () => (who === "lad" ? "princess" : "prince");
const runner = makePerson({ skin: 0xe8b48a, top: 0xf2a91e, legs: 0x223258, hair: 0x3a2416, cap: 0xf2f2f2 }); scene.add(runner.root);
function dressRunner() { runner.mats.top.color.set(who === "lad" ? 0xf2a91e : 0xe8407a); runner.mats.hair.color.set(who === "lad" ? 0x3a2416 : 0x8a4a22); runner.setStyle(who === "lad" ? "cap" : "pony"); }
dressRunner();
const chaser = makePerson({ skin: 0x6fa34a, top: 0x6b5a3a, legs: 0x4a3a22, hair: 0x3f5a1e }); chaser.root.scale.setScalar(1.06); scene.add(chaser.root);
let chaserLook = -1;
function dressChaser(lv) {
  const kind = chaserKind(), t = clamp(lv / 4, 0, 1);
  chaser.mats.skin.color.copy(hexMix("#6fa34a", kind === "princess" ? "#f4c9a8" : "#e8b48a", clamp(t * 1.4, 0, 1)));
  chaser.mats.top.color.set(lv < 1.5 ? 0x6b5a3a : lv < 2.5 ? 0x4a5a7a : kind === "princess" ? 0xe05a9a : 0x2a4a9a);
  chaser.mats.legs.color.set(lv < 1.5 ? 0x4a3a22 : kind === "princess" && lv >= 2.5 ? 0xc04a86 : 0x222a44);
  chaser.mats.shoe.color.set(lv < 1.5 ? 0x3a3020 : 0xf2f2f2);
  chaser.mats.hair.color.copy(lv < 1.5 ? new THREE.Color(0x3f5a1e) : lv < 2.5 ? new THREE.Color(0x5a3a22) : kind === "princess" ? hexMix("#7a4a22", "#f2c14e", clamp((lv - 2.5) / 1.5, 0, 1)) : new THREE.Color(0x3a2416));
  chaser.setStyle(lv < 1.5 ? "weed" : lv < 2.5 ? "mop" : kind === "princess" ? "long" : "quiff", lv >= 3.9 ? (kind === "princess" ? "tiara" : "crown") : null);
  chaser.warts.visible = lv < 1.5; for (const e of chaser.ears) e.scale.set(0.05 + (1 - t) * 0.05, 0.09 + (1 - t) * 0.06, 0.07);
  chaser.eyes.forEach((e) => e.material.color.set(lv < 1 ? 0xf4f09a : 0xffffff));
}
let state = "menu", T = 0, travel = 0, speed = 10, beers = 0, coinsN = 0, score = 0, best = +(store.get("bgBest") || 0), totalCoins = +(store.get("bgCoins") || 0);
let lane = 0, px = 0, pz = 0, jy = 0, jv = 0, slideT = 0, chase = 0.45, stumbleT = 0, boostT = 0, magnetT = 0, shieldOn = false, nextRow = 30, shake = 0, lvShown = 0, deadAt = 0, leanV = 0, stepPh = 0, landT = 0, bestShown = false, heartT = 0, envShown = "";
let lastMode = "run";
function reset() {
  T = 0; travel = 0; speed = 10; beers = 0; coinsN = 0; score = 0; lane = 0; px = 0; pz = 0; jy = 0; jv = 0; slideT = 0; chase = 0.45; stumbleT = 0; boostT = 0; magnetT = 0; shieldOn = false; shake = 0; lvShown = 0; chaserLook = -1; bestShown = false; envShown = "";
  for (const o of live) freeObs(o); live.length = 0; for (const c of coins) c.on = false; for (const b of beersA) b.on = false; for (const p of PUPS) { p.on = false; p.g.visible = false; }
  placeChunks(true); nextRow = -28; hudForce();
}

// ---------------------------------------------------------------- spawning rows of trouble (always one way through)
const LN = [-1, 0, 1], other = (a) => LN.filter((x) => x !== a)[Math.floor(Math.random() * 2)];
function coinLine(ln, z, n, arc) { for (let i = 0; i < n; i++) addCoin(ln * LANE, arc ? 1.0 + Math.sin((i / (n - 1)) * Math.PI) * 1.6 : 1.0, z - i * 2.2); }
function spawnRow(z) {
  const hard = Math.min(1, travel / 2200), r = Math.random(), a = pick(LN);
  if (r < 0.16) { const t = pick(["bin", "cone", "bin"]); spawnObs(t, a, z); coinLine(a, z + 5, 5, true); beerOr(other(a), z); }
  else if (r < 0.3) { for (const x of LN) if (x !== a) spawnObs("van", x, z - 2); beerLine(a, z + 3, 3); }
  else if (r < 0.4 && travel > 150) { for (const x of LN) spawnObs("scaffold", x, z); coinLine(a, z + 4, 4); }
  else if (r < 0.52 && travel > 100) { for (const x of LN) if (x !== a || chance(hard * 0.4)) spawnObs("barrier", x, z); coinLine(a, z + 4, 5); addBeer(a * LANE, z); }
  else if (r < 0.62 && travel > 250) { const o = spawnObs(chance(0.3) ? "cab" : "car", a, z - 30); if (o) o.g.rotation.y = 0; coinLine(other(a), z, 6); }
  else if (r < 0.7 && travel > 200) { spawnObs("bus", a, z - 5); coinLine(other(a), z + 2, 5); if (chance(0.5)) spawnObs("cone", other(a), z - 12); }
  else if (r < 0.78) { const b = other(a); spawnObs("cone", a, z); spawnObs("cone", a, z - 2); spawnObs("barrier", b, z - 6); beerLine(LN.find((x) => x !== a && x !== b), z, 3); }
  else if (r < 0.84) { spawnObs("van", a, z - 2); addPup(pick(["kebab", "magnet", "shield", "kebab"]), other(a), z); }
  else { beerLine(a, z + 6, 5); if (chance(0.5 + hard * 0.4)) spawnObs("bin", other(a), z); coinLine(other(a), z - 6, 4); }
}
function beerLine(ln, z, n) { for (let i = 0; i < n; i++) addBeer(ln * LANE, z - i * 2.6); }
function beerOr(ln, z) { if (chance(0.5)) beerLine(ln, z, 2); else coinLine(ln, z, 4); }

// ---------------------------------------------------------------- input
function act(dir) {
  if (state !== "play") return;
  if (dir === "left" && lane > -1) { lane--; sfx.lane(-1); }
  if (dir === "right" && lane < 1) { lane++; sfx.lane(1); }
  if (dir === "up" && jy <= 0.001) { jv = 8.2; slideT = 0; sfx.jump(); }
  if (dir === "down") { if (slideT <= 0) sfx.slide(); slideT = 0.8; if (jy > 0) jv = -16; }
}
let sx0 = 0, sy0 = 0, swiping = false;
$("stage").addEventListener("pointerdown", (e) => { if (e.target.closest("button,a,.overlay,input,select,label")) return; sx0 = e.clientX; sy0 = e.clientY; swiping = true; });
$("stage").addEventListener("pointermove", (e) => { if (!swiping) return; const dx = e.clientX - sx0, dy = e.clientY - sy0; if (Math.max(Math.abs(dx), Math.abs(dy)) > 24) { swiping = false; act(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up")); } });
$("stage").addEventListener("pointerup", () => { if (swiping && state === "play") act("up"); swiping = false; });
addEventListener("keydown", (e) => {
  if (e.code === "KeyP" || e.code === "Escape") { if (state === "play") pause(); else if (state === "paused") resume(); return; }
  const k = { ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right", ArrowUp: "up", KeyW: "up", Space: "up", ArrowDown: "down", KeyS: "down" }[e.code];
  if (!k) return; e.preventDefault();
  if (state === "play") act(k); else if (state === "dead" && performance.now() - deadAt > 900 && e.code === "Space") begin();
});

// ---------------------------------------------------------------- screens
const OVERLAYS = ["gate", "start", "over", "pause"];
function show(id) { OVERLAYS.forEach((k) => ($(k).hidden = k !== id)); $("hud").hidden = id !== null; }
function begin() {
  ctx(); music(true); const w = (() => { const tot = WEATHER.reduce((a, x) => a + x.w, 0); let r = Math.random() * tot; for (const x of WEATHER) { r -= x.w; if (r <= 0) return x; } return WEATHER[0]; })();
  setWeather(w); reset(); state = "play"; show(null); toast(`${w.n.toUpperCase()}`, 1300);
}
function pause() { if (state !== "play") return; state = "paused"; music(false); syncSettings(); show("pause"); }
function resume() { if (state !== "paused") return; state = "play"; music(true); show(null); last = performance.now(); }
function caught() {
  if (state !== "play") return;
  state = "dead"; deadAt = performance.now(); shake = 0.25; sfx.crash(); music(false);
  totalCoins += coinsN; store.set("bgCoins", String(totalCoins));
  const L = levelOf(beers), isBest = score > best;
  if (isBest) { const prev = best; best = score; store.set("bgBest", String(best)); if (prev > 0 && window.PUB && PUB.record) PUB.record(prev, best); }
  if (window.PUB) PUB.submit("goggles", score);
  $("line").textContent = LEVELS[L.i].line; $("fScore").textContent = score.toLocaleString("en-GB"); $("fDist").textContent = Math.floor(travel) + " m"; $("fBeers").textContent = beers; $("fCoins").textContent = coinsN; $("fLevel").textContent = L.i + 1 + "/5"; $("fBest").textContent = best.toLocaleString("en-GB"); $("bestStart").textContent = best.toLocaleString("en-GB");
  $("newBest").hidden = !isBest; $("shareMsg").hidden = true;
  paintFace($("caughtBy"), looks(beers), chaserKind());
  setTimeout(() => { if (state === "dead") { show("over"); $("hud").hidden = true; } }, 1300);
}
function toast(msg, ms = 900, cls = "") { const el = $("toast"); el.className = "toast " + cls; el.textContent = msg; void el.offsetWidth; el.classList.add("on"); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove("on"), ms); }
// HUD: only touches the page when something changed, and at most 10 times a second
const hudLast = {}; let hudT = 0;
const put = (id, v) => { if (hudLast[id] !== v) { hudLast[id] = v; $(id).textContent = v; return true; } return false; };
function bump(id) { const el = $(id).parentElement; el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump"); }
function hudForce() { for (const k in hudLast) delete hudLast[k]; hud(); }
function hud() {
  put("score", score.toLocaleString("en-GB")); put("dist", Math.floor(travel) + " m");
  if (put("coinsN", String(coinsN))) bump("coinsN"); if (put("beersN", String(beers))) bump("beersN");
  const L = levelOf(beers); put("lvName", LEVELS[L.i].name); $("meter").style.width = Math.round((L.i === 4 ? 1 : L.f) * 100) + "%";
  $("chaseBar").style.width = Math.round(clamp(chase, 0, 1) * 100) + "%"; $("chaseBox").classList.toggle("hot", chase > 0.6);
  if (hudLast.face !== beers) { hudLast.face = beers; paintFace($("mini"), looks(beers), chaserKind()); }
  $("puShield").hidden = !shieldOn; $("puMagnet").hidden = magnetT <= 0; $("puBoost").hidden = boostT <= 0;
  $("puMagnet").style.setProperty("--p", clamp(magnetT / 8, 0, 1)); $("puBoost").style.setProperty("--p", clamp(boostT / 3, 0, 1));
  $("bestTag").hidden = !(best > 0 && score < best);
  if (best > 0) $("bestTag").textContent = "BEST " + best.toLocaleString("en-GB");
}
function ladder() { const el = $("ladder"); el.innerHTML = ""; LEVELS.forEach((Lv, i) => { const d = document.createElement("div"), c = document.createElement("canvas"); c.width = 50; c.height = 50; c.setAttribute("aria-hidden", "true"); d.appendChild(c); d.appendChild(document.createTextNode(Lv.name)); el.appendChild(d); paintFace(c, i, chaserKind()); }); }
function drawWho() { document.querySelectorAll(".who").forEach((b) => { const on = b.dataset.g === who; b.classList.toggle("on", on); b.setAttribute("aria-pressed", on ? "true" : "false"); }); ladder(); dressRunner(); chaserLook = -1; }
document.querySelectorAll(".who").forEach((b) => b.addEventListener("click", () => { who = b.dataset.g; store.set("bgWho", who); drawWho(); }));
$("go").addEventListener("click", begin);
$("again").addEventListener("click", () => { if (performance.now() - deadAt > 900) begin(); });
$("menu").addEventListener("click", () => { state = "menu"; reset(); drawWho(); show("start"); $("hud").hidden = true; });
$("yes").addEventListener("click", () => { store.set("lo18", "1"); show("start"); $("hud").hidden = true; });
$("no").addEventListener("click", () => { $("gateMsg").hidden = false; });
$("pauseBtn").addEventListener("click", (e) => { e.stopPropagation(); pause(); });
$("resumeBtn").addEventListener("click", resume);
$("restartBtn").addEventListener("click", () => { state = "menu"; begin(); });
$("quitBtn").addEventListener("click", () => { state = "menu"; music(false); reset(); show("start"); $("hud").hidden = true; });
$("setBtn").addEventListener("click", () => { syncSettings(); $("setPanel").hidden = !$("setPanel").hidden; });
$("share").addEventListener("click", () => { const n = LEVELS[levelOf(beers).i].name, txt = `I ran ${score.toLocaleString("en-GB")} on Beer Goggles and got caught by ${/^[AEIOU]/.test(n) ? "an" : "a"} ${n} after ${beers} beers 🍺😂 Beat that.`; if (window.PUB) PUB.share(txt, $("shareMsg")); });
// settings (in the pause menu and on the start screen)
function syncSettings() { for (const p of ["", "2"]) { $("volMusic" + p).value = set.music; $("volSfx" + p).value = set.sfx; $("qual" + p).value = set.quality; $("shake" + p).checked = set.shake; } }
for (const p of ["", "2"]) {
  $("volMusic" + p).addEventListener("input", (e) => { set.music = +e.target.value; saveSet(); if (MUSIC) MUSIC.gain.value = set.music * 0.55; syncSettings(); });
  $("volSfx" + p).addEventListener("input", (e) => { set.sfx = +e.target.value; saveSet(); if (SFX) SFX.gain.value = set.sfx; syncSettings(); });
  $("qual" + p).addEventListener("change", (e) => { set.quality = e.target.value; saveSet(); Q = set.quality === "auto" ? (MOBILE ? 1 : 2) : { high: 2, medium: 1, low: 0 }[set.quality]; applyQuality(); setWeather(weather); syncSettings(); });
  $("shake" + p).addEventListener("change", (e) => { set.shake = e.target.checked; saveSet(); syncSettings(); });
}

// ---------------------------------------------------------------- update
function stumble() {
  if (shieldOn) { shieldOn = false; sfx.pop(); burst(px, 1.2, pz, 30, 0x3da0ff, 3, 3); toast("SHIELD SAVED YOU!", 900, "good"); return; }
  shake = Math.max(shake, 0.16); sfx.stumble(); burst(px, 0.6, pz - 0.5, 14, 0xffd080, 2, 2);
  if (stumbleT > 0 || chase > 0.75) return caught();
  chase = Math.min(1, chase + 0.6); stumbleT = 5; toast("WHOA! IT'S GAINING ON YOU", 1100, "bad");
}
function hitSolid() { if (shieldOn) { shieldOn = false; sfx.pop(); burst(px, 1.2, pz, 40, 0x3da0ff, 3, 3); toast("SHIELD SAVED YOU!", 900, "good"); stumbleT = Math.max(stumbleT, 1.2); return; } caught(); }
function levelCheck() { const L = levelOf(beers).i; if (L > lvShown) { lvShown = L; toast("BEER GOGGLES: " + LEVELS[L].name.toUpperCase(), 1500, "gold"); sfx.level(); } }
let lampT = 0;
function moveWorld() {
  // treadmill strips snap to their texture period so the pattern never jumps
  const roadPeriod = 260 / 26, pavePeriod = 260 / 65, zr = Math.round(pz / roadPeriod) * roadPeriod - 90, zp = Math.round(pz / pavePeriod) * pavePeriod - 90;
  road.position.set(0, 0, zr); for (const p of paves) p.position.z = zp; for (const k of kerbs) k.position.z = zp;
  placeChunks(false);
  grass.position.z = pz; sky.position.set(camera.position.x, 0, camera.position.z); skyline.position.set(camera.position.x, 22, camera.position.z);
  // environment colours drift towards the street we're on
  const ch = chunks.find((c) => c.z0 >= pz - 10 && c.z0 - CH < pz - 10) || chunks[0]; const env = ENVS.find((e) => e.k === ch.t.env); envNow = env;
  if (state === "play" && env.name !== envShown && T > 2) { envShown = env.name; if (T > 3) toast(env.name, 1300, "env"); }
  scene.fog.color.lerp(_c.set(weather.sky === "fog" ? 0x4a4e58 : weather.sky === "dusk" ? 0x3a2c48 : env.fog), 0.02);
}
function update(dt) {
  T += dt;
  if (state === "menu") { pz -= 5 * dt; moveWorld(); animate(runner, T * 9, "run", 0.85); runner.root.position.set(0, 0, pz); runner.root.rotation.y = 0; chaser.root.visible = false; stepEffects(dt); return; }
  if (state === "paused") return;
  if (state === "dead") { shake = Math.max(0, shake - dt * 1.5); chase = Math.min(1.25, chase + dt * 1.5); placeChaser(dt); animate(runner, 0, "down"); runner.root.position.y = 0; stepEffects(dt); return; }
  // speed builds with time (as before), boosted by kebabs
  const target = Math.min(10 + T * 0.14, 23) * (boostT > 0 ? 1.35 : 1); speed += (target - speed) * Math.min(1, dt * 3);
  boostT = Math.max(0, boostT - dt); stumbleT = Math.max(0, stumbleT - dt); slideT = Math.max(0, slideT - dt); magnetT = Math.max(0, magnetT - dt); landT = Math.max(0, landT - dt);
  const d = speed * dt; pz -= d; travel += d; moveWorld();
  score = Math.floor(travel) + beers * 5 + coinsN;
  const tx = lane * LANE, dx = tx - px; px += clamp(dx, -12 * dt, 12 * dt); leanV += (clamp(dx * 0.25, -0.3, 0.3) - leanV) * Math.min(1, dt * 10);
  const wasAir = jy > 0.001;
  if (jy > 0 || jv > 0) { jv -= 26 * dt; jy = Math.max(0, jy + jv * dt); if (jy === 0) jv = 0; }
  if (wasAir && jy === 0) { sfx.land(); landT = 0.15; burst(px, 0.2, pz, 8, weather.wet > 0.5 ? 0x9fc0ff : 0xb0a090, 1.5, 1); }
  chase = Math.max(0, chase - dt * (boostT > 0 ? 0.35 : 0.12));
  // spawn ahead
  while (nextRow > pz - 95) { spawnRow(nextRow); nextRow -= Math.max(14, 24 - travel / 220) + Math.random() * 6; }
  // obstacles
  for (let i = live.length - 1; i >= 0; i--) {
    const o = live[i], S = SPEC[o.type];
    if (S.moving) { o.z += o.v * dt; o.g.position.z = o.z; const rel = o.z - pz; if (!o.honk && rel < -8 && rel > -30) { o.honk = true; if (chance(0.6)) sfx.horn(o.lane * 0.5); } if (!o.passed && rel > 0) { o.passed = true; sfx.whoosh(o.lane * 0.6, true); } }
    if (!o.passed && !S.moving && o.z > pz + 0.5) { o.passed = true; if (o.type === "bus" || o.type === "van") sfx.whoosh(o.lane * 0.6, o.type === "bus"); }
    if (o.z > pz + 12) { freeObs(o); live.splice(i, 1); continue; }
    if (o.hit) continue;
    if (Math.abs(o.lane * LANE - px) > S.w / 2 + 0.25) continue;
    if (Math.abs(o.z - pz) > S.len / 2 + 0.35) continue;
    if (S.h && jy > S.h - 0.25) continue;
    if (S.slide && slideT > 0) continue;
    o.hit = true;
    if (S.hit === "stumble") { o.g.rotation.z = 1.2 * (Math.random() < 0.5 ? -1 : 1); o.g.position.y = 0.2; stumble(); }
    else hitSolid();
  }
  // coins, beers and power-ups (with magnet pull)
  const mag = magnetT > 0;
  for (let i = 0; i < COINS; i++) { const c = coins[i]; if (!c.on) continue; if (c.z > pz + 6) { c.on = false; continue; }
    if (mag && c.z > pz - 14 && c.z < pz + 1) { c.x += (px - c.x) * Math.min(1, dt * 8); c.y += (jy + 1 - c.y) * Math.min(1, dt * 8); c.z += (pz - c.z) * Math.min(1, dt * 6); }
    if (Math.abs(c.x - px) < 0.85 && Math.abs(c.z - pz) < 0.9 && Math.abs(c.y - (jy + 1)) < 1.1) { c.on = false; coinsN++; sfx.coin(); burst(c.x, c.y, c.z, 5, 0xffd23a, 1, 1.5); } }
  for (let i = 0; i < BEERS; i++) { const b = beersA[i]; if (!b.on) continue; if (b.z > pz + 6) { b.on = false; continue; }
    if (mag && b.z > pz - 14 && b.z < pz + 1) { b.x += (px - b.x) * Math.min(1, dt * 8); b.z += (pz - b.z) * Math.min(1, dt * 6); }
    if (Math.abs(b.x - px) < 0.85 && Math.abs(b.z - pz) < 0.9 && jy < 1.6) { b.on = false; beers++; sfx.beer(); burst(b.x, 1.1, b.z, 10, 0xffa51f, 1.4, 2); levelCheck(); } }
  for (const p of PUPS) { if (!p.on) continue; if (p.z > pz + 6) { p.on = false; p.g.visible = false; continue; }
    if (Math.abs(p.x - px) < 0.9 && Math.abs(p.z - pz) < 1.0 && jy < 1.8) { p.on = false; p.g.visible = false; sfx.power(); burst(p.x, 1.1, p.z, 24, PU_COL[p.k], 2, 2.5);
      if (p.k === "shield") { shieldOn = true; sfx.shield(); toast("SHIELD!", 900, "good"); }
      if (p.k === "magnet") { magnetT = 8; toast("MAGNET!", 900, "good"); }
      if (p.k === "kebab") { boostT = 3; chase = Math.max(0, chase - 0.5); burp(); toast("KEBAB BOOST!", 900, "gold"); } } }
  // the runner
  const mode = jy > 0.05 ? "jump" : slideT > 0 ? "slide" : stumbleT > 4.4 ? "stumble" : "run";
  if (mode !== lastMode && mode === "run" && lastMode === "slide") burst(px, 0.2, pz, 6, 0xb0a090, 1, 0.8); lastMode = mode;
  const phRate = speed * 1.05; const prevPh = stepPh; stepPh += dt * phRate;
  if (mode === "run" && Math.floor(prevPh / Math.PI) !== Math.floor(stepPh / Math.PI)) sfx.step(weather.wet > 0.5, Math.floor(stepPh / Math.PI) % 2);
  runner.root.position.set(px, jy, pz); runner.root.rotation.y = -dx * 0.12;
  animate(runner, stepPh, mode, mode === "jump" ? clamp(jv / 8.2 * -0.5 + 0.5, 0, 1) * 0.6 + 0.4 : 1, -leanV);
  if (landT > 0) runner.hips.position.y -= landT * 0.6;
  runner.blob.position.y = 0.17 - jy; runner.blob.scale.setScalar(0.9 - Math.min(0.5, jy * 0.2));
  bubble.visible = shieldOn; if (shieldOn) { bubble.position.set(px, jy + 1, pz); bubble.material.opacity = 0.14 + Math.sin(T * 6) * 0.05; }
  placeChaser(dt);
  // danger: heartbeat and a red edge, never shaking the camera
  if (chase > 0.6) { heartT -= dt; if (heartT <= 0) { sfx.heart(); heartT = lerp(1.0, 0.45, (chase - 0.6) / 0.4); } }
  energy = clamp((speed - 10) / 13, 0, 1);
  if (!bestShown && best > 0 && score > best) { bestShown = true; toast("NEW BEST!", 1300, "gold"); sfx.level(); }
  stepEffects(dt);
  hudT += dt; if (hudT > 0.1) { hudT = 0; hud(); }
}
function stepEffects(dt) {
  // coins spin, beers bob; all instanced, so it's one loop and one upload each
  const t = T;
  for (let i = 0; i < COINS; i++) { const c = coins[i]; if (!c.on) { coinMesh.setMatrixAt(i, ZERO); continue; } _q.setFromEuler(_e.set(Math.PI / 2, 0, t * 4 + i)); _m.compose(_v.set(c.x, c.y + Math.sin(t * 3 + i) * 0.06, c.z), _q, _s.set(1, 1, 1)); coinMesh.setMatrixAt(i, _m); }
  coinMesh.instanceMatrix.needsUpdate = true;
  _q.setFromEuler(_e.set(0, 0, 0));
  for (let i = 0; i < BEERS; i++) { const b = beersA[i]; if (!b.on) { beerGlass.setMatrixAt(i, ZERO); beerFoam.setMatrixAt(i, ZERO); beerHalo.setMatrixAt(i, ZERO); continue; } const y = b.y + Math.sin(t * 4 + i) * 0.08;
    _q.setFromEuler(_e.set(0, t * 2.5 + i, 0)); _m.compose(_v.set(b.x, y, b.z), _q, _s.set(1, 1, 1)); beerGlass.setMatrixAt(i, _m); _m.compose(_v.set(b.x, y + 0.28, b.z), _q, _s.set(1, 0.6, 1)); beerFoam.setMatrixAt(i, _m);
    _q.copy(camera.quaternion); _m.compose(_v.set(b.x, y, b.z), _q, _s.set(1.5, 1.5, 1.5)); beerHalo.setMatrixAt(i, _m); }
  beerGlass.instanceMatrix.needsUpdate = beerFoam.instanceMatrix.needsUpdate = beerHalo.instanceMatrix.needsUpdate = true;
  for (const p of PUPS) if (p.on) { p.g.rotation.y += dt * 2.5; p.g.position.y = 1.1 + Math.sin(T * 4) * 0.1; }
  // lamp lights: the nearest lamps ahead get the real lights
  lampT += dt; if (lampT > 0.15) { lampT = 0; let n = 0; const want = [0, 2, 3][Q];
    for (const c of chunks) for (const [lx, lz] of c.t.lamps) { const z = c.z0 + lz; if (z < pz + 6 && z > pz - 34 && n < want) { LAMP_LIGHTS[n].position.set(lx, 6.4, z); LAMP_LIGHTS[n].intensity = weather.sky === "dusk" ? 30 : 45; n++; } }
    for (; n < 3; n++) LAMP_LIGHTS[n].intensity = 0; }
  if (rain.visible) { for (let i = 0; i < RAIN_N; i++) { const k = i * 6; rainPos[k + 1] -= 24 * dt; rainPos[k + 4] -= 24 * dt; if (rainPos[k + 4] < 0 || rainPos[k + 2] > pz + 8 || rainPos[k + 2] < pz - 40) seedDrop(i, pz, true); } rainGeo.attributes.position.needsUpdate = true; }
  stepSparks(dt);
  if (AMB) { const on = state === "play" && !muted, t0 = AC.currentTime; AMB.hum.gain.setTargetAtTime(on ? 0.05 : 0.0001, t0, 0.5); AMB.traffic.gain.setTargetAtTime(on ? 0.012 + (envNow.k === "city" || envNow.k === "high" ? 0.01 : 0) : 0.0001, t0, 0.5); AMB.rain.gain.setTargetAtTime(on ? weather.rain * 0.04 : 0.0001, t0, 0.5); }
}
function placeChaser(dt) {
  const lv = looks(beers); if (Math.abs(lv - chaserLook) > 0.01) { chaserLook = lv; dressChaser(lv); }
  const z = pz + lerp(9, 1.4, clamp(chase, 0, 1.25));   // far back it's behind the camera; it creeps up from the bottom of the screen
  chaser.root.visible = z < camPos.z - 0.6; chaser.root.position.set(lerp(chaser.root.position.x, px, Math.min(1, dt * 3)), 0, z);
  animate(chaser, T * 13 + 1, "reach");
}

// ---------------------------------------------------------------- camera (smooth, low, never shaky unless you hit something)
const camPos = new THREE.Vector3(0, 3.2, 6), look = new THREE.Vector3();
function frameCamera(dt) {
  const tx = px * 0.55, ty = 3.9 + jy * 0.3 - (slideT > 0 ? 0.35 : 0);
  camPos.x = lerp(camPos.x, tx, Math.min(1, dt * 6)); camPos.y = lerp(camPos.y, ty, Math.min(1, dt * 4)); camPos.z = pz + 7.4;
  camera.position.copy(camPos);
  if (shake > 0 && set.shake && !REDUCED) { camera.position.x += (Math.random() - 0.5) * shake; camera.position.y += (Math.random() - 0.5) * shake * 0.6; }
  shake = Math.max(0, shake - dt * 1.2);   // shakes fade out within a fraction of a second
  look.set(px * 0.75, 0.9, pz - 11); camera.lookAt(look);
  camera.rotation.z += -leanV * 0.08;
  const fov = baseFov + clamp((speed - 10) / 13, 0, 1) * 8 + (boostT > 0 ? 6 : 0); if (Math.abs(camera.fov - fov) > 0.05) { camera.fov += (fov - camera.fov) * Math.min(1, dt * 3); camera.updateProjectionMatrix(); }
  moon.position.set(px - 8, 18, pz + 6); moon.target.position.set(px, 0, pz - 6);
  if (grade) { grade.uniforms.uSpeed.value = state === "play" ? clamp((speed - 13) / 12, 0, 1) * 0.8 + (boostT > 0 ? 0.4 : 0) : 0; grade.uniforms.uDanger.value += ((state === "play" && chase > 0.55 ? (chase - 0.55) * 1.6 : 0) - grade.uniforms.uDanger.value) * Math.min(1, dt * 4); }
  $("danger").style.opacity = state === "play" && chase > 0.55 && !(composer && Q >= 2) ? Math.min(1, (chase - 0.4) * 1.6) : 0;
}

// ---------------------------------------------------------------- loop + automatic quality
let last = performance.now(), fpsN = 0, fpsT0 = 0;
function loop(now) {
  const dt = Math.min(0.033, (now - last) / 1000); last = now; watchFps(now);
  for (let i = 0; i < (window.__bgSteps || 1); i++) update(dt);
  frameCamera(dt);
  if (composer && Q >= 2) composer.render(); else renderer.render(scene, camera);
  requestAnimationFrame(loop);
}
function watchFps(now) {
  if (state !== "play" || set.quality !== "auto" || Q === 0) { fpsT0 = 0; fpsN = 0; return; }
  if (!fpsT0) fpsT0 = now; fpsN++; if (now - fpsT0 < 2500) return;
  const fps = fpsN / ((now - fpsT0) / 1000); fpsT0 = now; fpsN = 0;
  if (fps < 50) { Q--; applyQuality(); setWeather(weather); }
}
applyQuality(); setWeather(WEATHER[0]); reset(); drawWho(); syncSettings(); $("bestStart").textContent = best.toLocaleString("en-GB"); $("coinsStart").textContent = totalCoins.toLocaleString("en-GB");
show(store.get("lo18") === "1" ? "start" : "gate"); $("hud").hidden = true;
requestAnimationFrame((t) => { last = t; loop(t); $("loading").classList.add("done"); });
// test hook
window.__bg = { geoTotal: () => { const g = new Set(); scene.traverse((o) => { if (o.geometry) g.add(o.geometry.uuid); }); return g.size; }, skip: (m) => { pz -= m; travel += m; nextRow = pz - 28; for (const o of live) freeObs(o); live.length = 0; for (const c of coins) c.on = false; for (const b of beersA) b.on = false; }, get: () => ({ state, travel, speed, beers, coinsN, score, chase, lane, px, jy, live: live.length, Q, env: envNow.k, weather: weather.k, shake }), act, begin, pause, resume, setW: (k) => setWeather(WEATHER.find((w) => w.k === k)), info: () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles, geos: renderer.info.memory.geometries, tex: renderer.info.memory.textures }), set: (o) => { if ("chase" in o) chase = o.chase; if ("T" in o) T = o.T; if ("shield" in o) shieldOn = o.shield; }, renderer };
