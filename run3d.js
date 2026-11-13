// Beer Goggles 3D. Three.js r160, everything built from shapes in code (no model downloads).
import * as THREE from "/vendor/three.module.min.js";

const $ = (id) => document.getElementById(id);
const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };
const lerp = (a, b, t) => a + (b - a) * t, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const mix = (c1, c2, t) => { const a = parseInt(c1.slice(1), 16), b = parseInt(c2.slice(1), 16); const r = Math.round(lerp(a >> 16, b >> 16, t)), gg = Math.round(lerp((a >> 8) & 255, (b >> 8) & 255, t)), bb = Math.round(lerp(a & 255, b & 255, t)); return `rgb(${r},${gg},${bb})`; };
const hexMix = (c1, c2, t) => new THREE.Color(c1).lerp(new THREE.Color(c2), t);
const rnd = (a, b) => a + Math.random() * (b - a);
const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---------------- sound (same engine as Last Orders) ----------------
let AC = null, MASTER = null, MUSIC = null, muted = store.get("loMute") === "1";
function ctx() { if (!AC) { AC = new (window.AudioContext || window.webkitAudioContext)(); MASTER = AC.createGain(); MASTER.gain.value = muted ? 0 : 1; MASTER.connect(AC.destination); MUSIC = AC.createGain(); MUSIC.gain.value = 0.5; MUSIC.connect(MASTER); } if (AC.state === "suspended") AC.resume(); return AC; }
function beep(f1, f2, dur, type = "square", vol = 0.06, delay = 0) { try { const A = ctx(), o = A.createOscillator(), gn = A.createGain(), t0 = A.currentTime + delay; o.type = type; o.frequency.setValueAtTime(f1, t0); o.frequency.exponentialRampToValueAtTime(f2, t0 + dur); gn.gain.setValueAtTime(vol, t0); gn.gain.exponentialRampToValueAtTime(0.0001, t0 + dur); o.connect(gn).connect(MASTER); o.start(t0); o.stop(t0 + dur); } catch (e) {} }
function burp() {
  try {
    const A = ctx(), t0 = A.currentTime, len = 0.55 + Math.random() * 0.35;
    const o = A.createOscillator(), lfo = A.createOscillator(), lg = A.createGain(), am = A.createGain(), f = A.createBiquadFilter(), gn = A.createGain();
    o.type = "sawtooth"; o.frequency.setValueAtTime(95 + Math.random() * 25, t0); o.frequency.linearRampToValueAtTime(62, t0 + len);
    lfo.type = "square"; lfo.frequency.setValueAtTime(26 + Math.random() * 10, t0); lg.gain.value = 0.5; am.gain.value = 0.5; lfo.connect(lg).connect(am.gain);
    f.type = "lowpass"; f.frequency.setValueAtTime(900, t0); f.frequency.linearRampToValueAtTime(380, t0 + len); f.Q.value = 6;
    gn.gain.setValueAtTime(0.0001, t0); gn.gain.exponentialRampToValueAtTime(0.32, t0 + 0.05); gn.gain.setValueAtTime(0.28, t0 + len * 0.7); gn.gain.exponentialRampToValueAtTime(0.0001, t0 + len);
    o.connect(am).connect(f).connect(gn).connect(MASTER); o.start(t0); lfo.start(t0); o.stop(t0 + len + 0.05); lfo.stop(t0 + len + 0.05);
  } catch (e) {}
}
const NT = (n) => 440 * Math.pow(2, (n - 69) / 12);
const CHORDS = [[45, 48, 52], [41, 45, 48], [43, 47, 50], [40, 44, 47], [45, 48, 52], [41, 45, 48], [43, 47, 50], [44, 47, 52]];
const TUNE = [69, 0, 72, 76, 74, 72, 71, 0, 69, 0, 71, 72, 74, 0, 72, 71, 65, 0, 69, 72, 71, 69, 67, 0, 64, 0, 67, 71, 68, 0, 0, 0,
              69, 0, 72, 76, 77, 76, 74, 0, 72, 0, 74, 76, 74, 0, 71, 0, 72, 71, 69, 67, 65, 0, 69, 0, 71, 0, 68, 0, 64, 0, 0, 0];
let step = 0, nextAt = 0, musicOn = false;
function note(freq, at, dur, type, vol) { const o = AC.createOscillator(), gn = AC.createGain(); o.type = type; o.frequency.value = freq; gn.gain.setValueAtTime(0.0001, at); gn.gain.exponentialRampToValueAtTime(vol, at + 0.01); gn.gain.exponentialRampToValueAtTime(0.0001, at + dur); o.connect(gn).connect(MUSIC); o.start(at); o.stop(at + dur + 0.02); }
function schedule() {
  const STEP = 60 / 156 / 2;
  while (nextAt < AC.currentTime + 0.25) {
    const bar = Math.floor(step / 8) % 8, beat = step % 8, ch = CHORDS[bar];
    if (beat % 2 === 0) note(NT(ch[beat % 4 === 0 ? 0 : 2] - 12), nextAt, STEP * 0.9, "triangle", 0.11);
    if (beat % 2 === 1) for (const c of ch) note(NT(c + 12), nextAt, STEP * 0.5, "square", 0.01);
    if (beat % 4 === 2) note(90, nextAt, 0.05, "sawtooth", 0.03);
    const m = TUNE[step % 64]; if (m) note(NT(m), nextAt, STEP * 0.85, "square", 0.022);
    nextAt += STEP; step++;
  }
}
function startMusic() { try { ctx(); if (musicOn) return; musicOn = true; step = 0; nextAt = AC.currentTime + 0.05; schedule(); setInterval(schedule, 100); } catch (e) {} }
document.addEventListener("visibilitychange", () => { if (!AC) return; if (document.hidden) AC.suspend(); else AC.resume(); });
function setMute(m) { muted = m; store.set("loMute", m ? "1" : "0"); if (MASTER) MASTER.gain.value = m ? 0 : 1; $("wave").style.display = m ? "none" : ""; $("mute").setAttribute("aria-label", m ? "Turn sound on" : "Turn sound off"); }
$("mute").addEventListener("click", (e) => { e.stopPropagation(); setMute(!muted); }); setMute(muted);

// ---------------- chaser levels + 2D portrait ----------------
const LEVELS = [
  { at: 0, name: "Swamp Monster", line: "The Swamp Monster got you. Absolutely grim." },
  { at: 10, name: "Bit Rough", line: "Caught by a Bit Rough. Could've been worse." },
  { at: 20, name: "Not Bad", line: "Not Bad caught you. Were you even running?" },
  { at: 35, name: "Fit", line: "Caught by a Fit one. You slowed down on purpose." },
  { at: 50, name: "Absolute Stunner", line: "An Absolute Stunner caught you. Sober you will have questions." },
];
const levelOf = (b) => { let i = 0; for (let k = 0; k < LEVELS.length; k++) if (b >= LEVELS[k].at) i = k; const nx = LEVELS[i + 1]; return { i, f: nx ? (b - LEVELS[i].at) / (nx.at - LEVELS[i].at) : 1 }; };
const looks = (b) => { const L = levelOf(b); return L.i === 4 ? 4 : L.i + L.f * 0.35; };
  // face portrait, lv 0..4 (continuous). who = "princess" | "prince"
  function face(c, x, y, r, lv, who) {
    const t = clamp(lv / 4, 0, 1), skin = mix("#6FA34A", who === "princess" ? "#F4C9A8" : "#E8B48A", clamp(t * 1.4, 0, 1));
    c.save(); c.translate(x, y); c.scale(r / 50, r / 50);
    // back hair
    if (lv >= 2.5) { c.fillStyle = who === "princess" ? mix("#7A4A22", "#F2C14E", clamp((lv - 2.5) / 1.5, 0, 1)) : "#3A2416"; if (who === "princess") { c.beginPath(); c.ellipse(0, 6, 40, 46, 0, 0, 7); c.fill(); } }
    // head (lumpy when monstrous)
    c.fillStyle = skin; c.beginPath(); c.ellipse(0, 0, 32 + (1 - t) * 4, 38 - (1 - t) * 2, 0, 0, 7); c.fill();
    if (lv < 1.5) { c.beginPath(); c.arc(-26, -18, 9, 0, 7); c.arc(24, 10, 8, 0, 7); c.arc(10, -34, 7, 0, 7); c.fill(); }
    // ears
    c.beginPath(); c.ellipse(-31, 2, 6 + (1 - t) * 6, 9, -0.3, 0, 7); c.ellipse(31, 2, 6 + (1 - t) * 6, 9, 0.3, 0, 7); c.fill();
    // warts
    c.fillStyle = "#4A6B2A"; const warts = Math.round((1 - t) * 6); const WP = [[-14, -20], [18, -8], [-20, 14], [8, 22], [22, -24], [-6, 4]];
    for (let i = 0; i < warts; i++) { c.beginPath(); c.arc(WP[i][0], WP[i][1], 3.2, 0, 7); c.fill(); }
    // eyes
    const eyeW = lv < 1 ? [9, 5] : [7, 7];
    for (const [k, ex] of [[0, -12], [1, 12]]) {
      c.fillStyle = lv < 1 ? "#F4F09A" : "#FFFFFF"; c.beginPath(); c.ellipse(ex, -6 + (lv < 1 && k ? 3 : 0), eyeW[k], eyeW[k] * 0.9, 0, 0, 7); c.fill();
      c.fillStyle = lv < 1 ? "#B5322A" : lv > 3.5 ? "#2B6CB0" : "#2A1A12"; c.beginPath(); c.arc(ex + (lv < 1 ? (k ? -2 : 2) : 0), -5 + (lv < 1 && k ? 3 : 0), eyeW[k] * 0.48, 0, 7); c.fill();
      c.fillStyle = "#FFFFFF"; c.beginPath(); c.arc(ex + 2, -8, 1.6, 0, 7); c.fill();
      if (who === "princess" && lv >= 2.5) { c.strokeStyle = "#1A1020"; c.lineWidth = 1.6; for (const d of [-5, 0, 5]) { c.beginPath(); c.moveTo(ex + d, -12); c.lineTo(ex + d * 1.3, -16); c.stroke(); } }
    }
    // brows
    c.strokeStyle = lv < 1.5 ? "#2A3A14" : who === "princess" ? "#5A3A22" : "#2A1A12"; c.lineCap = "round";
    if (lv < 1.5) { c.lineWidth = 6; c.beginPath(); c.moveTo(-22, -18); c.quadraticCurveTo(0, -12, 22, -19); c.stroke(); }
    else { c.lineWidth = who === "prince" ? 4 : 2.5; c.beginPath(); c.moveTo(-19, -17); c.quadraticCurveTo(-12, -21, -5, -17); c.moveTo(5, -17); c.quadraticCurveTo(12, -21, 19, -17); c.stroke(); }
    // nose
    c.fillStyle = mix("#4F7A30", "#D9967A", t); c.beginPath(); c.ellipse(0, 6, lv < 1 ? 7 : 3.5, lv < 1 ? 8 : 4, 0, 0, 7); c.fill();
    // mouth
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
    // hair on top
    if (lv < 1.5) { c.strokeStyle = "#3F5A1E"; c.lineWidth = 3; for (let i = -3; i <= 3; i++) { c.beginPath(); c.moveTo(i * 7, -34); c.quadraticCurveTo(i * 9 + 6, -48, i * 11, -44 + (i % 2) * 6); c.stroke(); } }
    else if (lv < 2.5) { c.fillStyle = "#5A3A22"; c.beginPath(); c.ellipse(0, -30, 30, 14, 0, Math.PI, 0); c.fill(); for (let i = -2; i <= 2; i++) { c.beginPath(); c.arc(i * 11, -32 + (i % 2) * 3, 8, 0, 7); c.fill(); } }
    else if (who === "princess") { c.fillStyle = mix("#7A4A22", "#F2C14E", clamp((lv - 2.5) / 1.5, 0, 1)); c.beginPath(); c.ellipse(0, -26, 34, 18, 0, Math.PI, 0); c.fill(); c.beginPath(); c.ellipse(-22, -18, 14, 10, -0.6, 0, 7); c.fill(); }
    else { c.fillStyle = "#3A2416"; c.beginPath(); c.moveTo(-30, -18); c.quadraticCurveTo(-28, -46, 4, -44); c.quadraticCurveTo(30, -44, 30, -18); c.quadraticCurveTo(18, -34, -4, -30); c.quadraticCurveTo(-18, -30, -30, -18); c.fill(); }
    // crown / tiara at stunner
    if (lv >= 3.9) {
      c.fillStyle = "#FFD24A";
      if (who === "princess") { c.beginPath(); c.moveTo(-18, -38); c.lineTo(-12, -50); c.lineTo(-6, -42); c.lineTo(0, -56); c.lineTo(6, -42); c.lineTo(12, -50); c.lineTo(18, -38); c.closePath(); c.fill(); c.fillStyle = "#FF5C8A"; c.beginPath(); c.arc(0, -46, 3, 0, 7); c.fill(); }
      else { c.fillRect(-20, -52, 40, 10); c.beginPath(); c.moveTo(-20, -52); c.lineTo(-14, -64); c.lineTo(-8, -52); c.lineTo(0, -66); c.lineTo(8, -52); c.lineTo(14, -64); c.lineTo(20, -52); c.fill(); }
      c.fillStyle = "#FFFFFFCC"; for (const [sx, sy] of [[-40, -30], [38, -36], [40, 20]]) { c.beginPath(); c.moveTo(sx, sy - 6); c.lineTo(sx + 2, sy - 2); c.lineTo(sx + 6, sy); c.lineTo(sx + 2, sy + 2); c.lineTo(sx, sy + 6); c.lineTo(sx - 2, sy + 2); c.lineTo(sx - 6, sy); c.lineTo(sx - 2, sy - 2); c.fill(); }
    }
    c.restore();
  }
  function paintFace(canvas, lv, who) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5), s = canvas.width && canvas.dataset.s ? +canvas.dataset.s : (canvas.dataset.s = canvas.width);
    canvas.width = s * dpr; canvas.height = s * dpr; const c = canvas.getContext("2d"); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, s, s);
    face(c, s / 2, s / 2 + s * 0.06, s * 0.36, lv, who);
  }



// ---------------- renderer, scene, camera ----------------
const cv = $("game");
const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0c22);
scene.fog = new THREE.Fog(0x171232, 22, 88);
const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 400);
function fit() { const r = $("stage").getBoundingClientRect(); renderer.setSize(r.width, r.height, false); cv.style.width = r.width + "px"; cv.style.height = r.height + "px"; camera.aspect = r.width / r.height; camera.fov = camera.aspect < 0.7 ? 68 : 58; camera.updateProjectionMatrix(); }
addEventListener("resize", fit);

// lights
scene.add(new THREE.HemisphereLight(0x7a7cff, 0x2a1418, 0.7));
const moon = new THREE.DirectionalLight(0xa9b8ff, 1.1);
moon.castShadow = true; moon.shadow.mapSize.set(1024, 1024);
Object.assign(moon.shadow.camera, { left: -9, right: 9, top: 14, bottom: -14, near: 1, far: 70 }); moon.shadow.bias = -0.0008;
scene.add(moon, moon.target);
const LAMP_LIGHTS = []; for (let i = 0; i < 4; i++) { const l = new THREE.PointLight(0xffc477, 30, 16, 1.8); scene.add(l); LAMP_LIGHTS.push(l); }

// ---------------- textures made in code ----------------
function canvasTex(w, h, draw, srgb = true) { const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d"), w, h); const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }
const glowTex = canvasTex(64, 64, (c, w) => { const g = c.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.35, "rgba(255,255,255,.35)"); g.addColorStop(1, "rgba(255,255,255,0)"); c.fillStyle = g; c.fillRect(0, 0, w, w); });
function glow(color, size, opacity = 0.8) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false })); s.scale.set(size, size, 1); return s; }
const ROAD_W = 6.4, LANE = 1.7;
const roadTex = canvasTex(512, 1024, (c, w, h) => {
  c.fillStyle = "#2a2938"; c.fillRect(0, 0, w, h);
  for (let i = 0; i < 9000; i++) { const v = 30 + Math.random() * 40; c.fillStyle = `rgba(${v},${v},${v + 10},${Math.random() * 0.5})`; c.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
  for (let i = 0; i < 6; i++) { c.fillStyle = "rgba(10,10,20,.35)"; c.beginPath(); c.ellipse(Math.random() * w, Math.random() * h, 20 + Math.random() * 50, 30 + Math.random() * 90, 0, 0, 7); c.fill(); } // puddles
  c.fillStyle = "#e9e4d0"; for (const u of [0.5 - LANE / 2 / ROAD_W, 0.5 + LANE / 2 / ROAD_W]) for (let y = 0; y < h; y += h / 2) c.fillRect(u * w - 5, y + 40, 10, h * 0.22);
  c.fillStyle = "#f2c230"; for (const u of [0.035, 0.055, 0.945, 0.965]) c.fillRect(u * w - 3, 0, 6, h); // double yellow lines
});
roadTex.wrapS = roadTex.wrapT = THREE.RepeatWrapping; roadTex.repeat.set(1, 20);
const paveTex = canvasTex(256, 256, (c, w, h) => { c.fillStyle = "#4a4660"; c.fillRect(0, 0, w, h); c.strokeStyle = "#35324a"; c.lineWidth = 4; for (let i = 0; i <= 4; i++) { c.beginPath(); c.moveTo(i * w / 4, 0); c.lineTo(i * w / 4, h); c.moveTo(0, i * h / 4); c.lineTo(w, i * h / 4); c.stroke(); } for (let i = 0; i < 1500; i++) { c.fillStyle = `rgba(255,255,255,${Math.random() * 0.06})`; c.fillRect(Math.random() * w, Math.random() * h, 2, 2); } });
paveTex.wrapS = paveTex.wrapT = THREE.RepeatWrapping; paveTex.repeat.set(1, 66);
const WALLS = ["#5a3340", "#3e3352", "#2f3c5a", "#5a4632", "#46304a", "#3a4a46"];
function windowTextures(wall) {
  const lit = []; for (let i = 0; i < 24; i++) lit.push(Math.random() < 0.42 ? (Math.random() < 0.8 ? "#ffd58a" : "#9fd0ff") : null);
  const draw = (emissive) => (c, w, h) => {
    c.fillStyle = emissive ? "#000" : wall; c.fillRect(0, 0, w, h);
    if (!emissive) { for (let y = 0; y < h; y += 16) { c.fillStyle = "rgba(0,0,0,.12)"; c.fillRect(0, y, w, 2); } }
    let k = 0; for (let r = 0; r < 6; r++) for (let q = 0; q < 4; q++) { const x = 14 + q * 60, y = 12 + r * 41, col = lit[k++]; if (emissive) { if (col) { c.fillStyle = col; c.fillRect(x, y, 34, 26); } } else { c.fillStyle = "#1a1828"; c.fillRect(x - 3, y - 3, 40, 32); c.fillStyle = col ? col : "#232036"; c.fillRect(x, y, 34, 26); if (col) { c.fillStyle = "rgba(0,0,0,.25)"; c.fillRect(x + 16, y, 2, 26); } } }
  };
  const map = canvasTex(256, 256, draw(false)), em = canvasTex(256, 256, draw(true));
  for (const t of [map, em]) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return { map, em };
}
const WINDOW_SETS = WALLS.map(windowTextures);
const PUBS = ["THE RED LION", "KEBAB KING", "THE LOCK-IN", "OFFIE 24/7", "THE DRUNKEN DUCK", "CHIPPY", "ROSE & CROWN", "THE WOBBLY GOOSE", "THE BLACK BULL", "LAST ORDERS"];
const SIGN_MATS = PUBS.map((name, i) => {
  const col = ["#ff3d7f", "#3de0ff", "#ffb627", "#7bff8a"][i % 4];
  const t = canvasTex(512, 128, (c, w, h) => { c.fillStyle = "#12091a"; c.fillRect(0, 0, w, h); c.shadowColor = col; c.shadowBlur = 18; c.strokeStyle = col; c.lineWidth = 8; c.strokeRect(10, 10, w - 20, h - 20); c.fillStyle = "#fff6e0"; c.font = "bold 54px Bungee, Impact, Arial Black, sans-serif"; c.textAlign = "center"; c.textBaseline = "middle"; let fs = 54; while (c.measureText(name).width > w - 60 && fs > 20) { fs -= 2; c.font = `bold ${fs}px Bungee, Impact, Arial Black, sans-serif`; } c.fillText(name, w / 2, h / 2 + 3); });
  return { mat: new THREE.MeshBasicMaterial({ map: t, toneMapped: false }), col };
});

// ---------------- the street ----------------
const road = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_W, 200), new THREE.MeshStandardMaterial({ map: roadTex, roughness: 0.38, metalness: 0.25 }));
road.rotation.x = -Math.PI / 2; road.position.set(0, 0, -90); road.receiveShadow = true; scene.add(road);
const paveMat = new THREE.MeshStandardMaterial({ map: paveTex, roughness: 0.75 });
const kerbMat = new THREE.MeshStandardMaterial({ color: 0x6a6684, roughness: 0.8 });
for (const s of [-1, 1]) {
  const pave = new THREE.Mesh(new THREE.BoxGeometry(3, 0.15, 200), paveMat); pave.position.set(s * (ROAD_W / 2 + 1.5), 0.075, -90); pave.receiveShadow = true; scene.add(pave);
  const kerb = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.17, 200), kerbMat); kerb.position.set(s * (ROAD_W / 2 + 0.05), 0.085, -90); scene.add(kerb);
}
// sky: stars and moon
{
  const g = new THREE.BufferGeometry(), pts = [];
  for (let i = 0; i < 500; i++) { const a = Math.random() * Math.PI * 2, e = Math.random() * 1.2 + 0.08, r = 180; pts.push(Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r - 60); }
  g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
  scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 0.9, fog: false, transparent: true, opacity: 0.85 })));
  const m = new THREE.Mesh(new THREE.CircleGeometry(7, 40), new THREE.MeshBasicMaterial({ color: 0xffe7a8, fog: false, toneMapped: false })); m.position.set(-28, 48, -170); scene.add(m);
  const mg = glow(0xffe7a8, 40, 0.35); mg.material.fog = false; mg.position.copy(m.position); scene.add(mg);
}
// buildings: two rows that recycle as you run
const BUILD_X = ROAD_W / 2 + 3 + 3.2;
const buildings = [];
function dressBuilding(b) {
  const len = rnd(7, 12), h = rnd(7, 19), set = WINDOW_SETS[Math.floor(Math.random() * WINDOW_SETS.length)];
  b.len = len; b.mesh.scale.set(6.4, h, len); b.mesh.position.y = h / 2;
  const map = set.map.clone(), em = set.em.clone(); map.needsUpdate = em.needsUpdate = true;
  map.repeat.set(len / 7, h / 9); em.repeat.copy(map.repeat);
  b.mesh.material.map = map; b.mesh.material.emissiveMap = em; b.mesh.material.needsUpdate = true;
  b.sign.visible = Math.random() < 0.45;
  if (b.sign.visible) { const s = SIGN_MATS[Math.floor(Math.random() * SIGN_MATS.length)]; b.sign.material = s.mat; b.light.color.set(s.col); b.door.visible = true; } else b.door.visible = false;
  b.light.visible = b.sign.visible;
}
for (const side of [-1, 1]) {
  let z = 12;
  while (z > -140) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 0.9, emissive: 0xffffff, emissiveIntensity: 1.1 }));
    mesh.receiveShadow = true;
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.85), SIGN_MATS[0].mat); sign.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
    const door = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 2.3), new THREE.MeshBasicMaterial({ color: 0xffb35a, toneMapped: false })); door.rotation.y = sign.rotation.y;
    const light = new THREE.PointLight(0xff3d7f, 8, 7, 2);
    const b = { side, mesh, sign, door, light, len: 8 };
    scene.add(mesh, sign, door, light);
    dressBuilding(b);
    b.z = z - b.len / 2; place(b); buildings.push(b);
    z -= b.len + 0.4;
  }
}
function place(b) {
  b.mesh.position.set(b.side * BUILD_X, b.mesh.position.y, b.z);
  const face = b.side * (BUILD_X - 3.22);
  b.sign.position.set(face, 3.4, b.z); b.door.position.set(face, 1.15, b.z + Math.min(2, b.len / 3)); b.light.position.set(face - b.side * 0.8, 3.2, b.z);
}
// street lamps
const lamps = [];
{
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x23232e, roughness: 0.5, metalness: 0.6 });
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffd28a, toneMapped: false });
  for (let i = 0; i < 14; i++) {
    const side = i % 2 ? 1 : -1, g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 5.2, 8), poleMat); pole.position.y = 2.6; pole.castShadow = true;
    const arm = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.08, 0.08), poleMat); arm.position.set(-side * 0.55, 5.1, 0);
    const bulb = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.3), bulbMat); bulb.position.set(-side * 1.05, 5.0, 0);
    const gl = glow(0xffc477, 3.2, 0.7); gl.position.copy(bulb.position);
    g.add(pole, arm, bulb, gl); g.position.set(side * (ROAD_W / 2 + 0.6), 0, -i * 8); scene.add(g); lamps.push(g);
  }
}

// ---------------- props ----------------
const M = {
  binG: new THREE.MeshStandardMaterial({ color: 0x2f6b3a, roughness: 0.55 }), binL: new THREE.MeshStandardMaterial({ color: 0x3f8a4c, roughness: 0.5 }), black: new THREE.MeshStandardMaterial({ color: 0x121212, roughness: 0.7 }),
  cone: new THREE.MeshStandardMaterial({ color: 0xff6a12, roughness: 0.5 }), white: new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.4 }),
  steel: new THREE.MeshStandardMaterial({ color: 0x9aa2b8, roughness: 0.35, metalness: 0.8 }), van: new THREE.MeshStandardMaterial({ color: 0xe9edf5, roughness: 0.35, metalness: 0.3 }),
  glass: new THREE.MeshStandardMaterial({ color: 0x1a2236, roughness: 0.1, metalness: 0.6 }), tail: new THREE.MeshBasicMaterial({ color: 0xff2a3a, toneMapped: false }),
  beer: new THREE.MeshStandardMaterial({ color: 0xffa51f, emissive: 0xff8a00, emissiveIntensity: 0.55, roughness: 0.15, transparent: true, opacity: 0.92 }), foam: new THREE.MeshStandardMaterial({ color: 0xfff6e0, roughness: 0.9, emissive: 0x332a1a }),
  pitta: new THREE.MeshStandardMaterial({ color: 0xe8c38a, roughness: 0.8, emissive: 0x3a2a10 }), meat: new THREE.MeshStandardMaterial({ color: 0x8a4a26, roughness: 0.8 }), lettuce: new THREE.MeshStandardMaterial({ color: 0x5fbf5a }), tom: new THREE.MeshStandardMaterial({ color: 0xe4473a }),
};
const stripeTex = canvasTex(256, 32, (c, w, h) => { for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? "#151515" : "#ffd24a"; c.beginPath(); c.moveTo(i * 32, 0); c.lineTo(i * 32 + 32, 0); c.lineTo(i * 32 + 16, h); c.lineTo(i * 32 - 16, h); c.fill(); } });
const vanLabel = canvasTex(256, 64, (c, w, h) => { c.fillStyle = "#ffd24a"; c.fillRect(0, 0, w, h); c.fillStyle = "#1a1a1a"; c.font = "bold 34px Arial Black, Impact, sans-serif"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("KEBAB XPRS", w / 2, h / 2 + 2); });
function shadowAll(g) { g.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); return g; }
const PROTO = {
  bin() { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.BoxGeometry(0.72, 1.0, 0.78), M.binG); b.position.y = 0.58; const l = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.08, 0.86), M.binL); l.position.y = 1.12; for (const x of [-0.28, 0.28]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.06, 12), M.black); w.rotation.z = Math.PI / 2; w.position.set(x, 0.1, 0.36); g.add(w); } g.add(b, l); return shadowAll(g); },
  cone() { const g = new THREE.Group(); const c = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.72, 20), M.cone); c.position.y = 0.42; const band = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.19, 0.12, 20), M.white); band.position.y = 0.48; const base = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.06, 0.62), M.cone); base.position.y = 0.03; g.add(c, band, base); return shadowAll(g); },
  scaffold() { const g = new THREE.Group(); for (const x of [-0.82, 0.82]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.7, 8), M.steel); p.position.set(x, 1.35, 0); g.add(p); } const top = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.8, 8), M.steel); top.rotation.z = Math.PI / 2; top.position.y = 2.65; const plank = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.32, 0.3), new THREE.MeshStandardMaterial({ map: stripeTex, roughness: 0.6 })); plank.position.y = 1.25; g.add(top, plank); return shadowAll(g); },
  van() {
    const g = new THREE.Group(); const body = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.9, 4.3), M.van); body.position.y = 1.25;
    const back = 2.16; for (const x of [-0.4, 0.4]) { const w = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 0.04), M.glass); w.position.set(x, 1.75, back); g.add(w); }
    for (const x of [-0.72, 0.72]) { const t = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.35, 0.04), M.tail); t.position.set(x, 0.9, back); g.add(t); const tg = glow(0xff2a3a, 0.9, 0.6); tg.position.set(x, 0.9, back + 0.05); g.add(tg); }
    const lab = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.3), new THREE.MeshBasicMaterial({ map: vanLabel })); lab.position.set(0, 1.25, back + 0.01); g.add(lab);
    for (const x of [-0.78, 0.78]) for (const z of [-1.4, 1.4]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.24, 16), M.black); w.rotation.z = Math.PI / 2; w.position.set(x, 0.34, z); g.add(w); }
    g.add(body); return shadowAll(g);
  },
  beer() { const g = new THREE.Group(); const gl = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.16, 0.5, 18), M.beer); const f1 = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), M.foam); f1.position.set(-0.08, 0.27, 0); const f2 = f1.clone(); f2.position.set(0.08, 0.28, 0.03); const f3 = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 10), M.foam); f3.position.set(0, 0.31, -0.02); const h = glow(0xffa51f, 1.6, 0.55); g.add(gl, f1, f2, f3, h); g.position.y = 1.0; return g; },
  kebab() { const g = new THREE.Group(); const p = new THREE.Mesh(new THREE.SphereGeometry(0.3, 18, 14), M.pitta); p.scale.set(1, 0.75, 0.55); const m = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.2), M.meat); m.position.y = 0.16; const l = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.06, 0.18), M.lettuce); l.position.set(-0.1, 0.27, 0); const t = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.16), M.tom); t.position.set(0.1, 0.27, 0); const h = glow(0xff3d7f, 1.8, 0.6); g.add(p, m, l, t, h); g.position.y = 1.0; return g; },
};
const PROTOS = {}; for (const k in PROTO) PROTOS[k] = PROTO[k]();

// ---------------- people ----------------
const capsule = (r, len, mat) => new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 4, 10), mat);
function makePerson(o) {
  const skin = new THREE.MeshStandardMaterial({ color: o.skin, roughness: 0.6 }), top = new THREE.MeshStandardMaterial({ color: o.top, roughness: 0.7 }), legsM = new THREE.MeshStandardMaterial({ color: o.legs, roughness: 0.8 }), shoe = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.5 }), hairM = new THREE.MeshStandardMaterial({ color: o.hair, roughness: 0.8 });
  const root = new THREE.Group(), hips = new THREE.Group(); hips.position.y = 0.92; root.add(hips);
  const torso = capsule(0.2, 0.42, top); torso.position.y = 0.36; torso.scale.set(1.15, 1, 0.8); hips.add(torso);
  const pelvis = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), legsM); pelvis.scale.set(1.1, 0.6, 0.8); pelvis.position.y = 0.04; hips.add(pelvis);
  const neck = new THREE.Group(); neck.position.y = 0.7; hips.add(neck);
  const head = new THREE.Group(); head.position.y = 0.17; neck.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.17, 20, 16), skin); skull.scale.set(1, 1.12, 1); head.add(skull);
  const ears = []; for (const x of [-0.17, 0.17]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), skin); e.position.set(x, 0, 0); e.scale.set(0.6, 1, 0.8); head.add(e); ears.push(e); }
  const limbs = {};
  for (const [name, x] of [["L", -0.11], ["R", 0.11]]) {
    const thigh = new THREE.Group(); thigh.position.set(x, 0, 0); hips.add(thigh);
    const ul = capsule(0.08, 0.32, legsM); ul.position.y = -0.22; thigh.add(ul);
    const knee = new THREE.Group(); knee.position.y = -0.44; thigh.add(knee);
    const ll = capsule(0.07, 0.32, legsM); ll.position.y = -0.2; knee.add(ll);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.26), shoe); foot.position.set(0, -0.42, -0.06); knee.add(foot);
    const sh = new THREE.Group(); sh.position.set(x * 2.55, 0.58, 0); hips.add(sh);
    const ua = capsule(0.06, 0.24, top); ua.position.y = -0.16; sh.add(ua);
    const el = new THREE.Group(); el.position.y = -0.32; sh.add(el);
    const la = capsule(0.05, 0.22, skin); la.position.y = -0.15; el.add(la);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), skin); hand.position.y = -0.3; el.add(hand);
    limbs[name] = { thigh, knee, sh, el };
  }
  // hair pieces (toggled by style)
  const H = {};
  H.short = new THREE.Mesh(new THREE.SphereGeometry(0.18, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), hairM); H.short.position.y = 0.02; H.short.scale.set(1.04, 1.15, 1.06);
  H.pony = new THREE.Group(); { const cap = H.short.clone(); const tail = capsule(0.06, 0.22, hairM); tail.position.set(0, -0.06, 0.2); tail.rotation.x = 0.5; H.pony.add(cap, tail); H.pony.userData.tail = tail; }
  H.long = new THREE.Group(); { const cap = H.short.clone(); const back = capsule(0.15, 0.3, hairM); back.scale.set(1.15, 1, 0.55); back.position.set(0, -0.16, 0.1); H.long.add(cap, back); }
  H.quiff = new THREE.Group(); { const cap = H.short.clone(); const q = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), hairM); q.position.set(0, 0.17, -0.1); q.scale.set(1.3, 0.7, 1); H.quiff.add(cap, q); }
  H.mop = new THREE.Group(); for (let i = 0; i < 9; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), hairM); const a = (i / 9) * Math.PI * 2; b.position.set(Math.cos(a) * 0.13, 0.12 + Math.sin(i * 3) * 0.03, Math.sin(a) * 0.13); H.mop.add(b); }
  H.weed = new THREE.Group(); for (let i = 0; i < 9; i++) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.24, 5), hairM); const a = (i / 9) * Math.PI * 2; c.position.set(Math.cos(a) * 0.09, 0.2, Math.sin(a) * 0.09); c.rotation.set(Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6); H.weed.add(c); }
  const gold = new THREE.MeshStandardMaterial({ color: 0xffd24a, metalness: 0.9, roughness: 0.25, emissive: 0x6a4a00 });
  H.crown = new THREE.Group(); { const band = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.07, 20, 1, true), gold); band.position.y = 0.2; H.crown.add(band); for (let i = 0; i < 6; i++) { const s = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.1, 6), gold); const a = (i / 6) * Math.PI * 2; s.position.set(Math.cos(a) * 0.15, 0.27, Math.sin(a) * 0.15); H.crown.add(s); } }
  H.tiara = new THREE.Group(); { const t = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.012, 6, 24, Math.PI), gold); t.rotation.x = -Math.PI / 2; t.position.set(0, 0.17, 0); const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.035), new THREE.MeshStandardMaterial({ color: 0xff5c8a, emissive: 0x8a1030 })); gem.position.set(0, 0.22, -0.15); H.tiara.add(t, gem); }
  for (const k in H) { head.add(H[k]); H[k].visible = false; }
  // warts for the monster
  const wartM = new THREE.MeshStandardMaterial({ color: 0x3f5a22, roughness: 0.9 }); const warts = new THREE.Group();
  for (const [x, y, z] of [[0.1, 0.05, 0.12], [-0.12, -0.04, 0.1], [0.05, -0.1, 0.14], [-0.04, 0.12, 0.12], [0.14, -0.06, -0.04], [-0.15, 0.06, -0.02]]) { const w = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 6), wartM); w.position.set(x, y, z); warts.add(w); }
  head.add(warts);
  shadowAll(root);
  const P = { root, hips, neck, head, torso, limbs, H, warts, ears, mats: { skin, top, legs: legsM, hair: hairM }, style: null };
  P.setStyle = (st, extra) => { for (const k in H) H[k].visible = false; if (H[st]) H[st].visible = true; if (extra && H[extra]) H[extra].visible = true; P.style = st; };
  return P;
}
function animate(P, ph, mode, amt = 1) {
  const L = P.limbs.L, R = P.limbs.R, s = Math.sin(ph), c = Math.cos(ph);
  P.root.rotation.x = 0; P.hips.position.y = 0.92; P.hips.rotation.x = 0;
  if (mode === "run") {
    L.thigh.rotation.x = s * 0.9 * amt; R.thigh.rotation.x = -s * 0.9 * amt;
    L.knee.rotation.x = Math.max(0, -c) * 1.4 * amt; R.knee.rotation.x = Math.max(0, c) * 1.4 * amt;
    L.sh.rotation.x = -s * 0.9 * amt; R.sh.rotation.x = s * 0.9 * amt; L.el.rotation.x = -1.0; R.el.rotation.x = -1.0;
    P.hips.position.y = 0.92 + Math.abs(c) * 0.06; P.hips.rotation.x = -0.12;
  } else if (mode === "jump") {
    L.thigh.rotation.x = -1.1; R.thigh.rotation.x = -0.4; L.knee.rotation.x = 1.6; R.knee.rotation.x = 1.0;
    L.sh.rotation.x = -2.4; R.sh.rotation.x = -2.2; L.el.rotation.x = -0.3; R.el.rotation.x = -0.3;
  } else if (mode === "slide") {
    P.hips.position.y = 0.38; P.hips.rotation.x = 1.1;
    L.thigh.rotation.x = -1.3; R.thigh.rotation.x = -1.1; L.knee.rotation.x = 0.2; R.knee.rotation.x = 0.5;
    L.sh.rotation.x = 0.4; R.sh.rotation.x = 0.6; L.el.rotation.x = 0; R.el.rotation.x = 0;
  } else if (mode === "reach") {
    L.thigh.rotation.x = s * 0.9; R.thigh.rotation.x = -s * 0.9; L.knee.rotation.x = Math.max(0, -c) * 1.4; R.knee.rotation.x = Math.max(0, c) * 1.4;
    L.sh.rotation.x = -2.6 + s * 0.15; R.sh.rotation.x = -2.6 - s * 0.15; L.el.rotation.x = -0.2; R.el.rotation.x = -0.2;
    P.hips.position.y = 0.92 + Math.abs(c) * 0.06; P.hips.rotation.x = -0.25;
  }
  if (P.H.pony.visible) P.H.pony.userData.tail.rotation.z = Math.sin(ph) * 0.4;
}

// ---------------- game state ----------------
let who = store.get("bgWho") === "lass" ? "lass" : "lad";
const chaserKind = () => (who === "lad" ? "princess" : "prince");
const runner = makePerson({ skin: 0xe8b48a, top: 0xffb627, legs: 0x2a3a6a, hair: 0x3a2416 });
scene.add(runner.root);
function dressRunner() { runner.mats.top.color.set(who === "lad" ? 0xffb627 : 0xff3d7f); runner.mats.hair.color.set(who === "lad" ? 0x3a2416 : 0x8a4a22); runner.setStyle(who === "lad" ? "short" : "pony"); }
dressRunner();
const chaser = makePerson({ skin: 0x6fa34a, top: 0x6b5a3a, legs: 0x4a3a22, hair: 0x3f5a1e });
chaser.root.scale.setScalar(1.05); scene.add(chaser.root);
let chaserLook = -1;
function dressChaser(lv) {
  const kind = chaserKind(), t = clamp(lv / 4, 0, 1);
  chaser.mats.skin.color.copy(hexMix("#6fa34a", kind === "princess" ? "#f4c9a8" : "#e8b48a", clamp(t * 1.4, 0, 1)));
  chaser.mats.top.color.set(lv < 1.5 ? 0x6b5a3a : lv < 2.5 ? 0x4a5a7a : kind === "princess" ? 0xe05a9a : 0x2a4a9a);
  chaser.mats.legs.color.set(lv < 1.5 ? 0x4a3a22 : kind === "princess" && lv >= 2.5 ? 0xc04a86 : 0x222a44);
  chaser.mats.hair.color.copy(lv < 1.5 ? new THREE.Color(0x3f5a1e) : lv < 2.5 ? new THREE.Color(0x5a3a22) : kind === "princess" ? hexMix("#7a4a22", "#f2c14e", clamp((lv - 2.5) / 1.5, 0, 1)) : new THREE.Color(0x3a2416));
  const style = lv < 1.5 ? "weed" : lv < 2.5 ? "mop" : kind === "princess" ? "long" : "quiff";
  chaser.setStyle(style, lv >= 3.9 ? (kind === "princess" ? "tiara" : "crown") : null);
  chaser.warts.visible = lv < 1.5; for (const e of chaser.ears) e.scale.set(0.6 + (1 - t) * 0.8, 1 + (1 - t) * 0.6, 0.8);
}

let state = "menu", T = 0, travel = 0, speed = 10, beers = 0, score = 0, best = +(store.get("bgBest") || 0);
let lane = 0, px = 0, jy = 0, jv = 0, slideT = 0, chase = 0.6, stumbleT = 0, boostT = 0, objs = [], nextSpawn = 30, shake = 0, lvShown = 0, deadAt = 0, faceAt = -1;
const SPAWN_Z = -95;
function clearObjs() { for (const o of objs) scene.remove(o.mesh); objs = []; }
function reset() { T = 0; travel = 0; speed = 10; beers = 0; score = 0; lane = 0; px = 0; jy = 0; jv = 0; slideT = 0; chase = 0.45; stumbleT = 0; boostT = 0; clearObjs(); nextSpawn = 20; shake = 0; lvShown = 0; faceAt = -1; chaserLook = -1; hud(); }
function add(type, ln, z) { const mesh = PROTOS[type].clone(); mesh.position.set(ln * LANE, mesh.position.y, z); if (type === "van") mesh.position.z = z; scene.add(mesh); objs.push({ type, lane: ln, z, hit: false, mesh, spin: Math.random() * 6 }); }
function beerLine(ln, z, n) { for (let i = 0; i < n; i++) add("beer", ln, z - i * 2.6); }
function spawnRow(z) {
  const r = Math.random(), L = [-1, 0, 1], pickL = () => L[Math.floor(Math.random() * 3)], other = (a) => L.filter((x) => x !== a)[Math.floor(Math.random() * 2)];
  const hard = Math.min(1, travel / 1500);
  if (r < 0.22) { const a = pickL(); add(Math.random() < 0.5 ? "bin" : "cone", a, z); beerLine(other(a), z + 5, 4); }
  else if (r < 0.40) { const open = pickL(); for (const x of L) if (x !== open) add("van", x, z - 2); beerLine(open, z + 3, 3); }
  else if (r < 0.52 && travel > 200) { for (const x of L) add("scaffold", x, z); add("beer", pickL(), z - 4); }
  else if (r < 0.66) { const a = pickL(); for (const x of L) if (x !== a || Math.random() < hard * 0.5) add(Math.random() < 0.5 ? "bin" : "cone", x, z); add("beer", a, z); add("beer", a, z - 2.6); }
  else if (r < 0.74) { const a = pickL(); add("van", a, z - 2); add("kebab", other(a), z); }
  else { const a = pickL(); beerLine(a, z + 6, 5); if (Math.random() < 0.5 + hard * 0.4) add("bin", other(a), z); }
}

// ---------------- input ----------------
function act(dir) {
  if (state !== "play") return;
  if (dir === "left" && lane > -1) { lane--; beep(400, 520, 0.05, "triangle", 0.04); }
  if (dir === "right" && lane < 1) { lane++; beep(400, 520, 0.05, "triangle", 0.04); }
  if (dir === "up" && jy <= 0.001) { jv = 7.6; slideT = 0; beep(300, 700, 0.15, "square", 0.04); }
  if (dir === "down") { slideT = 0.75; if (jy > 0) jv = -14; beep(500, 200, 0.15, "triangle", 0.04); }
}
let sx0 = 0, sy0 = 0, swiping = false;
$("stage").addEventListener("pointerdown", (e) => { if (e.target.closest("button,a,.overlay")) return; sx0 = e.clientX; sy0 = e.clientY; swiping = true; });
$("stage").addEventListener("pointermove", (e) => { if (!swiping) return; const dx = e.clientX - sx0, dy = e.clientY - sy0; if (Math.max(Math.abs(dx), Math.abs(dy)) > 28) { swiping = false; act(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up")); } });
$("stage").addEventListener("pointerup", () => { if (swiping && state === "play") act("up"); swiping = false; });
addEventListener("keydown", (e) => {
  const k = { ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right", ArrowUp: "up", KeyW: "up", Space: "up", ArrowDown: "down", KeyS: "down" }[e.code];
  if (!k) return; e.preventDefault();
  if (state === "play") act(k); else if (state === "dead" && performance.now() - deadAt > 800 && e.code === "Space") begin();
});

// ---------------- screens ----------------
function show(id) { ["gate", "start", "over"].forEach((k) => ($(k).hidden = k !== id)); $("hud").hidden = id !== null; }
function begin() { startMusic(); reset(); for (let z = -30; z >= SPAWN_Z; z -= 20) spawnRow(z); nextSpawn = 14; state = "play"; show(null); }
function caught() {
  if (state !== "play") return;
  state = "dead"; deadAt = performance.now(); shake = 0.5; beep(260, 50, 0.6, "sawtooth", 0.09);
  const L = levelOf(beers);
  if (score > best) { best = score; store.set("bgBest", String(best)); }
  $("line").textContent = LEVELS[L.i].line; $("fScore").textContent = score; $("fBeers").textContent = beers; $("fBest").textContent = best; $("bestStart").textContent = best; $("shareMsg").hidden = true;
  paintFace($("caughtBy"), looks(beers), chaserKind());
  setTimeout(() => { if (state === "dead") { show("over"); $("hud").hidden = true; $("again").focus({ preventScroll: true }); } }, 1100);
}
function toast(msg, ms = 900) { const el = $("toast"); el.textContent = msg; el.classList.add("on"); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove("on"), ms); }
function hud() {
  $("score").textContent = score; $("beers").textContent = beers + (beers === 1 ? " beer" : " beers");
  const L = levelOf(beers); $("lvName").textContent = LEVELS[L.i].name; $("meter").style.width = Math.round((L.i === 4 ? 1 : L.f) * 100) + "%";
  if (faceAt !== beers) { faceAt = beers; paintFace($("mini"), looks(beers), chaserKind()); }
}
function ladder() { const el = $("ladder"); el.innerHTML = ""; LEVELS.forEach((L, i) => { const d = document.createElement("div"), c = document.createElement("canvas"); c.width = 50; c.height = 50; c.setAttribute("aria-hidden", "true"); d.appendChild(c); d.appendChild(document.createTextNode(L.name)); el.appendChild(d); paintFace(c, i, chaserKind()); }); }
function drawWho() { document.querySelectorAll(".who").forEach((b) => { const on = b.dataset.g === who; b.classList.toggle("on", on); b.setAttribute("aria-pressed", on ? "true" : "false"); }); ladder(); dressRunner(); chaserLook = -1; }
document.querySelectorAll(".who").forEach((b) => b.addEventListener("click", () => { who = b.dataset.g; store.set("bgWho", who); drawWho(); }));
$("go").addEventListener("click", begin);
$("again").addEventListener("click", () => { if (performance.now() - deadAt > 800) begin(); });
$("menu").addEventListener("click", () => { state = "menu"; reset(); drawWho(); show("start"); $("hud").hidden = true; });
$("yes").addEventListener("click", () => { store.set("lo18", "1"); show("start"); $("hud").hidden = true; });
$("no").addEventListener("click", () => { $("gateMsg").hidden = false; });
$("share").addEventListener("click", async () => {
  const n = LEVELS[levelOf(beers).i].name, txt = `I ran ${score} on Beer Goggles and got caught by ${/^[AEIOU]/.test(n) ? "an" : "a"} ${n} after ${beers} beers 🍺😂 Beat that.`;
  const m = $("shareMsg"); m.hidden = false; try { await navigator.clipboard.writeText(txt); m.textContent = "Copied. Paste it to a mate."; } catch (e) { m.textContent = txt; }
});

// ---------------- update ----------------
function stumble() { shake = 0.3; beep(150, 60, 0.25, "square", 0.08); if (stumbleT > 0 || chase > 0.75) return caught(); chase = Math.min(1, chase + 0.6); stumbleT = 5; toast("WHOA! IT'S GAINING ON YOU"); }
function levelCheck() { const L = levelOf(beers).i; if (L > lvShown) { lvShown = L; toast("BEER GOGGLES: " + LEVELS[L].name.toUpperCase(), 1500); [0, 0.1, 0.2, 0.32].forEach((dl, i) => beep([523, 659, 784, 1047][i], [523, 659, 784, 1047][i] * 1.01, 0.18, "square", 0.05, dl)); } }
function moveWorld(d) {
  travel += d;
  roadTex.offset.y += d / 10; paveTex.offset.y += d / 3;
  for (const b of buildings) { b.z += d; if (b.z - b.len / 2 > 14) { let minZ = Infinity; for (const o of buildings) if (o.side === b.side) minZ = Math.min(minZ, o.z - o.len / 2); dressBuilding(b); b.z = minZ - 0.4 - b.len / 2; } place(b); }
  for (const l of lamps) { l.position.z += d; if (l.position.z > 10) l.position.z -= 14 * 8; }
}
function update(dt) {
  T += dt;
  if (state === "menu") { moveWorld(6 * dt); animate(runner, T * 11, "run", 0.8); runner.root.position.set(0, 0, 0); chaser.root.visible = false; return; }
  if (state === "dead") { shake = Math.max(0, shake - dt); chase = Math.min(1.25, chase + dt * 1.5); placeChaser(dt); animate(runner, 0, "slide"); runner.root.position.y = 0; return; }
  speed = Math.min(10 + T * 0.14, 22) * (boostT > 0 ? 1.3 : 1);
  boostT = Math.max(0, boostT - dt); stumbleT = Math.max(0, stumbleT - dt); slideT = Math.max(0, slideT - dt);
  const d = speed * dt; moveWorld(d); score = Math.floor(travel) + beers * 5;
  px += clamp(lane * LANE - px, -11 * dt, 11 * dt);
  if (jy > 0 || jv > 0) { jv -= 24 * dt; jy = Math.max(0, jy + jv * dt); if (jy === 0) jv = 0; }
  chase = Math.max(0, chase - dt * (boostT > 0 ? 0.35 : 0.12));
  for (const o of objs) { o.z += d; o.mesh.position.z = o.z; if (o.type === "beer" || o.type === "kebab") { o.mesh.rotation.y += dt * 2.5; o.mesh.position.y = 1.0 + Math.sin(T * 4 + o.spin) * 0.08; } }
  nextSpawn -= d; if (nextSpawn <= 0) { spawnRow(SPAWN_Z); nextSpawn = Math.max(15, 24 - travel / 200) + Math.random() * 6; }
  const myLane = Math.round(px / LANE);
  for (const o of objs) {
    if (o.hit || o.lane !== myLane) continue;
    const reach = o.type === "van" ? 2.3 : 0.55;
    if (Math.abs(o.z) > reach) continue;
    if (o.type === "beer") { o.hit = true; beers++; beep(1320, 1760, 0.06, "triangle", 0.05); beep(1760, 2200, 0.08, "triangle", 0.04, 0.05); levelCheck(); }
    else if (o.type === "kebab") { o.hit = true; boostT = 2.5; chase = Math.max(0, chase - 0.5); burp(); toast("KEBAB BOOST!"); }
    else if (o.type === "bin" || o.type === "cone") { if (jy > (o.type === "bin" ? 0.75 : 0.5)) continue; o.hit = true; o.mesh.rotation.z = 1.3; o.mesh.position.y = 0.3; stumble(); }
    else if (o.type === "scaffold") { if (slideT > 0) continue; o.hit = true; caught(); }
    else if (o.type === "van") { o.hit = true; caught(); }
  }
  objs = objs.filter((o) => { const gone = o.z > 9 || (o.hit && (o.type === "beer" || o.type === "kebab")); if (gone) scene.remove(o.mesh); return !gone; });
  hud();
  $("danger").style.opacity = chase > 0.55 ? Math.min(1, (chase - 0.4) * 1.6) : 0;
  // runner
  runner.root.position.set(px, jy, 0); runner.root.rotation.z = (px - lane * LANE) * 0.12;
  animate(runner, T * (speed * 1.1), jy > 0.05 ? "jump" : slideT > 0 ? "slide" : "run");
  placeChaser(dt);
}
function placeChaser(dt) {
  const lv = looks(beers); if (Math.abs(lv - chaserLook) > 0.01) { chaserLook = lv; dressChaser(lv); }
  const z = lerp(5.2, 1.4, clamp(chase, 0, 1.25));
  chaser.root.visible = chase > 0.12; chaser.root.position.set(lerp(chaser.root.position.x, px, Math.min(1, dt * 3)), 0, z);
  animate(chaser, T * 13 + 1, "reach");
}

// ---------------- camera + lights follow ----------------
const camPos = new THREE.Vector3(0, 3.5, 6.6), look = new THREE.Vector3();
function frameCamera(dt) {
  const tx = px * 0.55, ty = 3.5 + jy * 0.35;
  camPos.x = lerp(camPos.x, tx, Math.min(1, dt * 6)); camPos.y = lerp(camPos.y, ty, Math.min(1, dt * 4));
  camera.position.copy(camPos);
  if (shake > 0 && !REDUCED) camera.position.add(new THREE.Vector3((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake, 0));
  look.set(px * 0.75, 0.9, -9); camera.lookAt(look);
  camera.rotation.z += (px - lane * LANE) * 0.05;
  moon.position.set(px - 8, 18, 6); moon.target.position.set(px, 0, -6);
  // put the 4 lamp lights on the nearest lamps ahead
  const near = lamps.filter((l) => l.position.z < 4 && l.position.z > -40).sort((a, b) => b.position.z - a.position.z).slice(0, 4);
  LAMP_LIGHTS.forEach((L, i) => { const l = near[i]; if (l) { const side = Math.sign(l.position.x); L.position.set(l.position.x - side * 1.05, 4.6, l.position.z); L.visible = true; } else L.visible = false; });
}

// ---------------- loop ----------------
let last = performance.now();
function loop(now) { const dt = Math.min(0.033, (now - last) / 1000); last = now; watchFps(now); update(dt); frameCamera(dt); renderer.render(scene, camera); requestAnimationFrame(loop); }
fit(); reset(); drawWho(); $("bestStart").textContent = best;
show(store.get("lo18") === "1" ? "start" : "gate"); $("hud").hidden = true;
requestAnimationFrame(loop);
// drop to a lighter mode on slow phones
let fpsN = 0, fpsT0 = 0, lowered = false;
function watchFps(now) { if (state !== "play" || lowered) return; if (!fpsT0) fpsT0 = now; fpsN++; if (now - fpsT0 > 3000) { if (fpsN / 3 < 28) { lowered = true; renderer.setPixelRatio(1); renderer.shadowMap.enabled = false; for (const L of LAMP_LIGHTS) L.intensity = 0; scene.traverse((m) => { if (m.material) m.material.needsUpdate = true; }); fit(); } fpsT0 = now; fpsN = 0; } }
