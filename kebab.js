// Kebab Run: The Last Delivery. Robbo's Game Lab.
// A 3D night delivery game built with three.js r160. Everything in the world is made from shapes and
// textures drawn in code, so there's nothing to download beyond the engine itself.
//
// Layout of the street (metres, the rider travels towards -z):
//   x: -6..6 road (4 lanes: two our way on the left, two oncoming), 6..8.6 pavement, 8.6..10.8 front gardens,
//   10.8+ house fronts. Left side = negative x. UK roads, so we keep left and oncoming traffic is on the right.
import * as THREE from "/vendor/three.module.min.js";

const PUB = window.PUB;
const $ = (id) => document.getElementById(id);
const store = PUB.store;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, t) => a + (b - a) * t;
const rnd = (a, b) => a + Math.random() * (b - a), pick = (a) => a[Math.floor(Math.random() * a.length)], chance = (p) => Math.random() < p;
const J = (k, d) => { try { return JSON.parse(store.get(k) || "") ?? d; } catch (e) { return d; } };
const MOBILE = matchMedia("(pointer: coarse)").matches;
const REDUCED = PUB.REDUCED;

// ---------------------------------------------------------------- game data
const LANES = [-4.5, -1.5, 1.5, 4.5];
const ROAD = 6, PAVE = 8.6, FRONT = 10.8, CHUNK = 50, NCHUNK = 5, FLIGHT = 0.9;
const MAT_X = FRONT - 0.55;                          // where the doormat sits, measured from the centre of the road
const ROUTES = [
  { id: "estate", name: "The Estate", blurb: "Terraces, wheelie bins and the odd maniac.", orders: 5, decay: 1.8, vmax: 15, traffic: 0.55, bus: 0.08, cab: 0, cyc: 0.3, zebra: 0.28, shops: 0.08, parked: 0.5, works: 0.12, styles: ["brick", "brick2", "pebble", "render"], lamp: 0xffa040, goal: 2600, tall: false },
  { id: "high", name: "The High Street", blurb: "Takeaway neon, buses and late-night chaos.", orders: 6, decay: 2.2, vmax: 16, traffic: 0.85, bus: 0.32, cab: 0.08, cyc: 0.22, zebra: 0.35, shops: 0.78, parked: 0.35, works: 0.18, styles: ["brick", "brick2", "render"], lamp: 0xe8eeff, goal: 4200, tall: false },
  { id: "city", name: "City Rush", blurb: "Black cabs, tower blocks and no mercy.", orders: 7, decay: 2.6, vmax: 18, traffic: 1.15, bus: 0.2, cab: 0.45, cyc: 0.15, zebra: 0.18, shops: 0.25, parked: 0.2, works: 0.22, styles: ["tower"], lamp: 0xf2f6ff, goal: 6000, tall: true },
  { id: "seaside", name: "Seaside Madness", blurb: "Arcades, B&Bs and the prom at midnight.", orders: 6, decay: 2.3, vmax: 17, traffic: 0.8, bus: 0.12, cab: 0.05, cyc: 0.25, zebra: 0.25, shops: 0.35, parked: 0.3, works: 0.1, styles: ["pastel"], lamp: 0xffd08a, goal: 5000, tall: false, sea: true },
];
const UPG = [
  { k: "engine", n: "Engine", d: "Higher top speed and quicker pick-up" },
  { k: "handling", n: "Handling", d: "Sharper steering through traffic" },
  { k: "box", n: "Insulated box", d: "Food stays hot for longer" },
  { k: "arm", n: "Throwing arm", d: "Bigger doormat sweet spot, slower power swing" },
  { k: "tyres", n: "Tyres", d: "Grip in puddles, shrug off potholes and crashes" },
];
const UCOST = [80, 170, 320, 520];
const HELMETS = [{ k: "red", n: "Red", c: "#D3262E", cost: 0 }, { k: "blue", n: "Blue", c: "#2E6BD3", cost: 60 }, { k: "black", n: "Stealth", c: "#1E222C", cost: 90 }, { k: "green", n: "Green", c: "#2EA95A", cost: 120 }, { k: "gold", n: "Gold", c: "#E8B42A", cost: 400 }];
const SAY = {
  perfect: ["Get in! Perfect!", "Absolute legend!", "Cheers pal!", "On the mat! Lovely!"],
  good: ["Ta very much!", "Nice one!", "Lovely, cheers!"],
  ok: ["In the hedge? Really?", "Bit rough, but ta.", "Next time knock, eh?"],
  cold: ["It's stone cold!", "Took your time!"],
  wrong: ["I didn't order this!", "Wrong house, mate!"],
  window: ["Oi! My window!", "You've cracked the glass!"],
};

// saved progress
let save = {
  best: +(store.get("kbBest") || 0), tips: +(store.get("kbTips") || 0), up: J("kbUp", {}), stars: J("kbStars", {}),
  helmet: store.get("kbHelmet") || "red", owned: J("kbOwned", ["red"]),
  set: Object.assign({ music: true, rain: true, shake: !REDUCED, hi: !MOBILE }, J("kbSet", {})),
};
const lvl = (k) => save.up[k] || 0;
function persist() {
  store.set("kbBest", String(save.best)); store.set("kbTips", String(save.tips)); store.set("kbUp", JSON.stringify(save.up));
  store.set("kbStars", JSON.stringify(save.stars)); store.set("kbHelmet", save.helmet); store.set("kbOwned", JSON.stringify(save.owned)); store.set("kbSet", JSON.stringify(save.set));
}
const unlocked = (i) => i === 0 || (save.stars[ROUTES[i - 1].id] || 0) >= 1;

// ---------------------------------------------------------------- renderer, scene, camera
const cv = $("game");
const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: (devicePixelRatio || 1) < 2, powerPreference: "high-performance" });
const setPR = () => renderer.setPixelRatio(Math.min(devicePixelRatio || 1, save.set.hi ? (MOBILE ? 1.6 : 1.75) : 1));
setPR();
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.38;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x060914);
scene.fog = new THREE.FogExp2(0x0c1230, 0.0088);
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 600);
let portrait = true;
function fit() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; portrait = w / h < 0.9; camera.updateProjectionMatrix(); }
addEventListener("resize", fit); fit();

const hemi = new THREE.HemisphereLight(0x6a7ac0, 0x22180e, 1.05); scene.add(hemi);
const moon = new THREE.DirectionalLight(0x9fb0ff, 0.45); moon.position.set(-30, 50, 20); scene.add(moon);
const lampLight = new THREE.PointLight(0xffa040, 0, 22, 1.6); scene.add(lampLight);          // follows the rider: the glow of whichever street lamp we pass
const glowLight = new THREE.PointLight(0xff6a40, 0, 16, 1.8); scene.add(glowLight);          // takeaway sign colour washing over the rider
const head = new THREE.SpotLight(0xfff0d0, 42, 46, 0.42, 0.55, 1.3); scene.add(head); scene.add(head.target);

// ---------------------------------------------------------------- canvas textures
function ctex(w, h, draw, opt = {}) {
  const c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d"); draw(g, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = opt.linear ? THREE.NoColorSpace : THREE.SRGBColorSpace; t.anisotropy = 4;
  if (opt.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; } return t;
}
const noise = (g, w, h, n, a, cols) => { for (let i = 0; i < n; i++) { g.fillStyle = pick(cols); g.globalAlpha = Math.random() * a; g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1 + Math.random() * 2); } g.globalAlpha = 1; };
const radial = ctex(128, 128, (g, w) => { const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.25, "rgba(255,255,255,.55)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, w, w); });
const streakTex = ctex(64, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, "rgba(255,255,255,0)"); gr.addColorStop(0.75, "rgba(255,255,255,.55)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, w, h); const gx = g.createLinearGradient(0, 0, w, 0); gx.addColorStop(0, "rgba(0,0,0,1)"); gx.addColorStop(.5, "rgba(0,0,0,0)"); gx.addColorStop(1, "rgba(0,0,0,1)"); g.globalCompositeOperation = "destination-out"; g.fillStyle = gx; g.fillRect(0, 0, w, h); });
const shadowTex = ctex(128, 128, (g, w) => { const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); gr.addColorStop(0, "rgba(0,0,0,.75)"); gr.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = gr; g.fillRect(0, 0, w, w); });
const beamTex = ctex(32, 256, (g, w, h) => { const gr = g.createLinearGradient(0, h, 0, 0); gr.addColorStop(0, "rgba(255,255,255,.9)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, w, h); });

const roadTex = ctex(512, 1024, (g, w, h) => {
  g.fillStyle = "#2a2c31"; g.fillRect(0, 0, w, h);
  noise(g, w, h, 9000, 0.5, ["#3a3c42", "#1e2024", "#46484e"]);
  for (let i = 0; i < 14; i++) { g.fillStyle = `rgba(10,12,16,${rnd(0.08, 0.18)})`; g.beginPath(); g.ellipse(rnd(0, w), rnd(0, h), rnd(20, 70), rnd(40, 160), 0, 0, 7); g.fill(); } // wet patches
  g.strokeStyle = "rgba(15,16,20,.6)"; g.lineWidth = 1.5; for (let i = 0; i < 10; i++) { g.beginPath(); let x = rnd(0, w), y = rnd(0, h); g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += rnd(-14, 14); y += rnd(6, 24); g.lineTo(x, y); } g.stroke(); }
  const X = (m) => ((m + ROAD) / (ROAD * 2)) * w, M = h / CHUNK;
  g.fillStyle = "rgba(235,235,225,.92)";
  for (const s of [-1, 1]) g.fillRect(X(s * 5.75) - 4, 0, 8, h);                                        // edge lines
  for (let z = 0; z < CHUNK; z += 9) { g.fillRect(X(-3) - 3, z * M, 6, 3 * M); g.fillRect(X(3) - 3, z * M, 6, 3 * M); } // lane lines
  for (let z = 0; z < CHUNK; z += 12.5) g.fillRect(X(0) - 4, z * M, 8, 6.5 * M);                               // centre line
}, { repeat: true });
const paveTex = ctex(256, 256, (g, w, h) => { g.fillStyle = "#5a5c62"; g.fillRect(0, 0, w, h); noise(g, w, h, 3000, 0.4, ["#6a6c72", "#4a4c52"]); g.strokeStyle = "#3e4046"; g.lineWidth = 3; for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64, h); g.stroke(); g.beginPath(); g.moveTo(0, i * 64); g.lineTo(w, i * 64); g.stroke(); } }, { repeat: true });
const grassTex = ctex(256, 256, (g, w, h) => { g.fillStyle = "#1d2a1a"; g.fillRect(0, 0, w, h); noise(g, w, h, 6000, 0.6, ["#2a3a22", "#141e12", "#33452a"]); }, { repeat: true });
const sandTex = ctex(256, 256, (g, w, h) => { g.fillStyle = "#4a4436"; g.fillRect(0, 0, w, h); noise(g, w, h, 6000, 0.5, ["#5a5444", "#3a3428", "#635c4a"]); }, { repeat: true });
const zebraTex = ctex(256, 64, (g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = "rgba(240,240,232,.95)"; for (let i = 0; i < 8; i++) g.fillRect(i * 32 + 4, 0, 16, h); }, { repeat: true });
const potTex = ctex(128, 128, (g, w) => { g.clearRect(0, 0, w, w); g.fillStyle = "#121315"; g.beginPath(); for (let a = 0; a < 6.3; a += 0.4) { const r = 40 + rnd(-10, 10); g.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r * 0.75); } g.fill(); g.strokeStyle = "#45474d"; g.lineWidth = 5; g.stroke(); noise(g, w, w, 300, 0.6, ["#2e3034"]); });
const puddleTex = ctex(256, 128, (g, w, h) => { g.clearRect(0, 0, w, h); const gr = g.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, w / 2); gr.addColorStop(0, "rgba(140,170,255,.38)"); gr.addColorStop(0.7, "rgba(90,120,200,.22)"); gr.addColorStop(1, "rgba(90,120,200,0)"); g.fillStyle = gr; g.beginPath(); g.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, 7); g.fill(); g.strokeStyle = "rgba(200,220,255,.25)"; for (let i = 1; i < 4; i++) { g.beginPath(); g.ellipse(w / 2 + rnd(-30, 30), h / 2, i * 18, i * 8, 0, 0, 7); g.stroke(); } });
const barrierTex = ctex(128, 32, (g, w, h) => { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? "#F2F2F2" : "#D8261E"; g.beginPath(); g.moveTo(i * 20 - 10, h); g.lineTo(i * 20 + 6, 0); g.lineTo(i * 20 + 22, 0); g.lineTo(i * 20 + 6, h); g.fill(); } });
const worksSignTex = ctex(128, 128, (g) => { g.fillStyle = "#fff"; g.beginPath(); g.moveTo(64, 6); g.lineTo(122, 112); g.lineTo(6, 112); g.closePath(); g.fill(); g.strokeStyle = "#D8261E"; g.lineWidth = 12; g.stroke(); g.fillStyle = "#111"; g.beginPath(); g.arc(58, 48, 7, 0, 7); g.fill(); g.lineWidth = 6; g.strokeStyle = "#111"; g.beginPath(); g.moveTo(58, 58); g.lineTo(52, 78); g.lineTo(44, 92); g.moveTo(52, 78); g.lineTo(64, 92); g.moveTo(56, 64); g.lineTo(72, 70); g.stroke(); g.fillRect(70, 84, 22, 8); });
const drawBox = (g, w, h) => {
  g.fillStyle = "#C81E28"; g.fillRect(0, 0, w, h); const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, "rgba(255,255,255,.12)"); gr.addColorStop(1, "rgba(0,0,0,.25)"); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  g.fillStyle = "#F4F0E6"; g.fillRect(0, h * 0.72, w, 14); g.fillStyle = "#FFD23A"; g.fillRect(0, h * 0.72 + 14, w, 5);
  g.fillStyle = "#fff"; g.textAlign = "center"; g.font = "bold 66px Bungee, Impact, sans-serif"; g.fillText("KEBAB", w / 2, 92); g.fillText("RUN", w / 2, 160);
  g.strokeStyle = "rgba(0,0,0,.35)"; g.lineWidth = 6; g.strokeRect(3, 3, w - 6, h - 6);
};
const boxTex = ctex(256, 256, drawBox);
document.fonts && document.fonts.load("400 66px Bungee").then(() => { const c = boxTex.image; drawBox(c.getContext("2d"), c.width, c.height); boxTex.needsUpdate = true; }).catch(() => {});
const plateTex = (yellow, text) => ctex(128, 32, (g, w, h) => { g.fillStyle = yellow ? "#F3C928" : "#F2F2F0"; g.fillRect(0, 0, w, h); g.fillStyle = "#111"; g.font = "bold 22px Arial, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(text, w / 2 + 6, h / 2 + 1); g.fillStyle = "#1E4FB0"; g.fillRect(0, 0, 12, h); });
const PLATES = ["KB24 RUN", "LO19 PUB", "RB23 LAB", "YO24 EAT", "LS12 FRY"].map((t) => ctex(128, 64, (g, w, h) => { for (const [yy, yel] of [[0, false], [32, true]]) { g.fillStyle = yel ? "#F3C928" : "#F2F2F0"; g.fillRect(0, yy, w, 32); g.fillStyle = "#111"; g.font = "bold 22px Arial, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(t, w / 2 + 6, yy + 17); g.fillStyle = "#1E4FB0"; g.fillRect(0, yy, 12, 32); } }));
const kebabTex = ctex(128, 64, (g, w, h) => { g.fillStyle = "#D9D3C4"; g.fillRect(0, 0, w, h); noise(g, w, h, 500, 0.5, ["#bfb7a6", "#efe9dc"]); g.fillStyle = "#C81E28"; g.fillRect(0, h * 0.42, w, h * 0.22); g.fillStyle = "#fff"; g.font = "bold 13px Arial"; g.fillText("KEBAB RUN", 26, h * 0.58); });

// ---------------------------------------------------------------- building fronts
const BRICKS = { brick: ["#7A3B2A", "#6A3224", "#843F2C"], brick2: ["#9C8253", "#8A7246", "#A88D5C"], pebble: ["#8E8C84", "#7E7C74"], render: ["#D9D2C0", "#CFC6B0"], pastel: ["#E9A9B9", "#9FC7E6", "#A9DCC0", "#EBD9A0", "#C9B3E6"], tower: ["#3A3E48", "#2E323C", "#4A4E58"] };
const DOORS = ["#8A1A1E", "#1B2B5A", "#1F4A2C", "#14161C", "#C8A21E", "#3A6A8A"];
const SHOPS = [["KEBAB HOUSE", "#E8262E", "#FFE45A"], ["CHIPPY", "#1E58C8", "#FFFFFF"], ["OFF LICENCE", "#1E8A3A", "#FFFFFF"], ["LAUNDERETTE", "#2BA8C8", "#FFFFFF"], ["BARBERS", "#B01E1E", "#FFFFFF"], ["CORNER SHOP", "#E8762E", "#FFFFFF"], ["PIZZA", "#D8262E", "#FFFFFF"], ["NAILS", "#D83A9A", "#FFFFFF"], ["CHINESE", "#C81E1E", "#FFD23A"], ["CURRY HOUSE", "#7A2AA8", "#FFD23A"]];
const ARCADES = [["AMUSEMENTS", "#FF3D9A"], ["FUNLAND", "#3DE0FF"], ["2p FALLS", "#FFD23A"], ["ROCK SHOP", "#FF6A3D"]];
// Each facade is a pair of canvases: colour, and glow (what lights up at night).
function facade(style, kind) {
  const W = 512, H = style === "tower" ? 1024 : 576, c = document.createElement("canvas"), e = document.createElement("canvas");
  c.width = e.width = W; c.height = e.height = H; const g = c.getContext("2d"), q = e.getContext("2d");
  q.fillStyle = "#000"; q.fillRect(0, 0, W, H);
  const base = pick(BRICKS[style]); g.fillStyle = base; g.fillRect(0, 0, W, H);
  if (style === "brick" || style === "brick2") { g.fillStyle = "rgba(0,0,0,.14)"; for (let y = 0; y < H; y += 10) { g.fillRect(0, y, W, 1.5); for (let x = (y / 10) % 2 ? 0 : 14; x < W; x += 28) g.fillRect(x, y, 1.5, 10); } noise(g, W, H, 4000, 0.25, ["#000", "#fff"]); }
  else noise(g, W, H, 5000, 0.18, ["#000", "#fff"]);
  const lit = (x, y, w, h, warm = true) => { const col = warm ? pick(["#FFC878", "#FFD9A0", "#FFB45A", "#9CC8FF"]) : "#203040"; g.fillStyle = col; g.fillRect(x, y, w, h); q.fillStyle = col; q.globalAlpha = warm ? rnd(0.55, 0.95) : 0; q.fillRect(x, y, w, h); q.globalAlpha = 1; if (warm && chance(0.5)) { g.fillStyle = "rgba(60,30,20,.55)"; g.fillRect(x, y, w * 0.28, h); g.fillRect(x + w * 0.72, y, w * 0.28, h); q.fillStyle = "rgba(0,0,0,.55)"; q.fillRect(x, y, w * 0.28, h); q.fillRect(x + w * 0.72, y, w * 0.28, h); } };
  const win = (x, y, w, h, on) => { g.fillStyle = "#EEE9DE"; g.fillRect(x - 6, y - 6, w + 12, h + 12); if (on) lit(x, y, w, h, true); else { g.fillStyle = "#151a26"; g.fillRect(x, y, w, h); g.fillStyle = "rgba(120,140,190,.25)"; g.fillRect(x, y, w, h * 0.4); } g.fillStyle = "#EEE9DE"; g.fillRect(x + w / 2 - 3, y, 6, h); g.fillRect(x, y + h / 2 - 3, w, 6); g.fillStyle = "rgba(0,0,0,.25)"; g.fillRect(x - 8, y + h + 6, w + 16, 8); };
  let doorU = 0.5;
  if (style === "tower") {
    for (let y = 40; y < H - 170; y += 64) for (let x = 24; x < W - 30; x += 60) { if (chance(0.36)) lit(x, y, 44, 44, true); else { g.fillStyle = "#121722"; g.fillRect(x, y, 44, 44); g.fillStyle = "rgba(140,170,230,.12)"; g.fillRect(x, y, 44, 20); } }
    // lobby: glass front, lit reception, plants and a revolving-door frame
    g.fillStyle = "#1a2030"; g.fillRect(0, H - 150, W, 150);
    for (const c of [g, q]) { const gr = c.createLinearGradient(0, H - 130, 0, H - 20); gr.addColorStop(0, "#D8E0EA"); gr.addColorStop(1, "#3a3a40"); c.fillStyle = gr; c.globalAlpha = c === q ? 0.45 : 1; c.fillRect(30, H - 130, W - 60, 110); c.globalAlpha = 1; }
    g.fillStyle = "#2a2a30"; g.fillRect(70, H - 62, 150, 30); g.fillStyle = "#6a5a4a"; g.fillRect(70, H - 66, 150, 6);
    for (const x of [60, W - 80]) { g.fillStyle = "#1e3a22"; g.beginPath(); g.arc(x, H - 70, 18, 0, 7); g.fill(); g.fillStyle = "#3a2a20"; g.fillRect(x - 8, H - 54, 16, 30); }
    g.strokeStyle = "rgba(20,24,34,.9)"; g.lineWidth = 6; for (let x = 30; x <= W - 30; x += 74) { g.beginPath(); g.moveTo(x, H - 130); g.lineTo(x, H - 20); g.stroke(); }
    g.fillStyle = "#0e1220"; g.fillRect(W / 2 - 50, H - 130, 100, 130); g.fillStyle = "#8a96a8"; g.fillRect(W / 2 - 46, H - 126, 92, 126); q.fillStyle = "#fff8e0"; q.globalAlpha = .35; q.fillRect(W / 2 - 46, H - 126, 92, 126); q.globalAlpha = 1;
    g.fillStyle = "#fff"; g.font = "bold 22px Inter, Arial"; g.textAlign = "center"; g.fillText(pick(["MERIDIAN HOUSE", "THE EXCHANGE", "CANAL WHARF", "No. " + Math.floor(rnd(10, 200))]), W / 2, H - 160); q.fillStyle = "#fff"; q.font = "bold 22px Inter, Arial"; q.textAlign = "center"; q.fillText("", 0, 0);
    doorU = 0.5;
  } else if (kind === "shop" || kind === "arcade") {
    // upper floor
    win(70, 70, 120, 140, chance(0.45)); win(W - 190, 70, 120, 140, chance(0.45));
    const [name, col, txt] = kind === "arcade" ? [...pick(ARCADES), "#fff"] : pick(SHOPS);
    g.fillStyle = col; g.fillRect(0, 262, W, 70); q.fillStyle = col; q.globalAlpha = 0.85; q.fillRect(0, 262, W, 70); q.globalAlpha = 1;
    g.fillStyle = txt; q.fillStyle = "#fff"; g.textAlign = q.textAlign = "center"; g.textBaseline = q.textBaseline = "middle"; g.font = q.font = `400 ${name.length > 10 ? 40 : 50}px Bungee, Impact, sans-serif`; g.fillText(name, W / 2, 299); q.fillText(name, W / 2, 299);
    if (kind === "arcade") for (let x = 12; x < W; x += 26) { const bc = pick(["#FFE45A", "#FF3D9A", "#3DE0FF"]); g.fillStyle = q.fillStyle = bc; g.beginPath(); g.arc(x, 256, 5, 0, 7); g.fill(); q.beginPath(); q.arc(x, 256, 6, 0, 7); q.fill(); q.beginPath(); q.arc(x, 338, 6, 0, 7); q.fill(); }
    // the shop window: a lit interior with shelves, a counter and someone serving
    const inside = kind === "arcade" ? pick(["#C84AA8", "#3AA0C8", "#C8A03A"]) : pick(["#E8D2A0", "#E8C890", "#C8D8E8"]);
    const ix = 40, iy = 350, iw = W - 170, ih = 200;
    for (const c of [g, q]) { const gr = c.createLinearGradient(0, iy, 0, iy + ih); gr.addColorStop(0, inside); gr.addColorStop(1, "#2a2018"); c.fillStyle = gr; c.globalAlpha = c === q ? 0.55 : 1; c.fillRect(ix, iy, iw, ih); c.globalAlpha = 1; }
    for (let y = iy + 22; y < iy + 110; y += 30) { g.fillStyle = "rgba(60,40,30,.7)"; g.fillRect(ix + 8, y, iw - 16, 4); for (let x = ix + 12; x < ix + iw - 14; x += 11) { g.fillStyle = pick(["#C83A3A", "#3A7AC8", "#E8C83A", "#3AA85A", "#E8E8E8"]); g.fillRect(x, y - 12, 8, 12); } }
    g.fillStyle = "#3a2a22"; g.fillRect(ix, iy + 140, iw, 60); g.fillStyle = "#8a6a4a"; g.fillRect(ix, iy + 138, iw, 6);
    g.fillStyle = "rgba(20,14,12,.85)"; g.beginPath(); g.arc(ix + iw * 0.62, iy + 92, 15, 0, 7); g.fill(); g.fillRect(ix + iw * 0.62 - 20, iy + 106, 40, 36);
    if (name === "KEBAB HOUSE" || name === "CURRY HOUSE") { g.fillStyle = "#B8642A"; g.beginPath(); g.moveTo(ix + 40, iy + 30); g.lineTo(ix + 70, iy + 30); g.lineTo(ix + 62, iy + 135); g.lineTo(ix + 48, iy + 135); g.fill(); g.fillStyle = "#E8823A"; g.fillRect(ix + 36, iy + 26, 38, 6); q.fillStyle = "#ff8a3a"; q.globalAlpha = 0.5; q.fillRect(ix + 30, iy + 30, 50, 105); q.globalAlpha = 1; }
    g.fillStyle = "rgba(255,255,255,.08)"; g.beginPath(); g.moveTo(ix, iy); g.lineTo(ix + iw * 0.4, iy); g.lineTo(ix + iw * 0.15, iy + ih); g.lineTo(ix, iy + ih); g.fill();
    g.fillStyle = "#2a2a30"; g.fillRect(W - 112, 350, 84, 226); g.fillStyle = "#bfc6d6"; g.fillRect(W - 104, 360, 68, 120); q.fillStyle = "#fff5d8"; q.globalAlpha = .6; q.fillRect(W - 104, 360, 68, 120); q.globalAlpha = 1;
    doorU = (W - 70) / W;
  } else {
    const twoBay = chance(0.5);
    win(64, 70, 110, 150, chance(0.42)); win(W - 174, 70, 110, 150, chance(0.42));
    const doorLeft = chance(0.5), dx = doorLeft ? 50 : W - 150;
    // bay / downstairs window
    const bx = doorLeft ? 230 : 70; win(bx, 330, 200, 170, chance(0.55));
    if (style === "pastel" && chance(0.5)) { g.fillStyle = "#fff"; g.fillRect(bx + 10, 300, 180, 26); g.fillStyle = "#C81E28"; g.font = "bold 18px Inter, Arial"; g.textAlign = "center"; g.fillText(pick(["VACANCIES", "B & B", "NO VACANCIES"]), bx + 100, 319); q.fillStyle = "#FF5060"; q.globalAlpha = .7; q.fillRect(bx + 10, 300, 180, 26); q.globalAlpha = 1; }
    // door with fanlight, number and porch light
    const dc = pick(DOORS); g.fillStyle = "#EEE9DE"; g.fillRect(dx - 8, 330, 116, 246); g.fillStyle = dc; g.fillRect(dx, 372, 100, 204);
    g.fillStyle = "rgba(255,255,255,.12)"; g.fillRect(dx + 12, 386, 32, 70); g.fillRect(dx + 56, 386, 32, 70); g.fillRect(dx + 12, 470, 32, 90); g.fillRect(dx + 56, 470, 32, 90);
    lit(dx + 6, 338, 88, 28, true); g.fillStyle = "#D8B44A"; g.fillRect(dx + 82, 470, 8, 8);
    g.fillStyle = "#fff"; g.font = "bold 26px Arial"; g.textAlign = "center"; g.fillText(String(Math.floor(rnd(2, 180))), dx + 50, 362);
    q.fillStyle = "#FFD9A0"; q.beginPath(); q.arc(dx + 120, 360, 9, 0, 7); q.fill(); g.fillStyle = "#FFE7B0"; g.beginPath(); g.arc(dx + 120, 360, 9, 0, 7); g.fill();
    doorU = (dx + 50) / W;
    void twoBay;
  }
  // sills and a dark band at the bottom so the base sits on the ground
  const grd = g.createLinearGradient(0, H - 40, 0, H); grd.addColorStop(0, "rgba(0,0,0,0)"); grd.addColorStop(1, "rgba(0,0,0,.45)"); g.fillStyle = grd; g.fillRect(0, H - 40, W, 40);
  return { c, e, doorU, kind, sign: kind === "shop" || kind === "arcade", side: "#" + new THREE.Color(base).multiplyScalar(0.7).getHexString() };
}

// ---------------------------------------------------------------- shared geometry + materials
const BOX = new THREE.BoxGeometry(1, 1, 1), PLANE = new THREE.PlaneGeometry(1, 1), CYL = new THREE.CylinderGeometry(0.5, 0.5, 1, 10), SPH = new THREE.SphereGeometry(0.5, 16, 12);
const ROOF = (() => { // a unit pitched roof: ridge along z, base 1×1, height 1
  const g = new THREE.BufferGeometry(), p = [-.5, 0, .5, .5, 0, .5, 0, 1, .5, -.5, 0, -.5, 0, 1, -.5, .5, 0, -.5];
  const idx = [0, 1, 2, 3, 4, 5, 0, 2, 4, 0, 4, 3, 1, 5, 4, 1, 4, 2]; g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3)); g.setIndex(idx);
  g.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, 1, 0, .5, 1, 1, 0, .5, 1, 0, 0], 2)); g.computeVertexNormals(); return g; })();
const M = {
  plain: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0.05 }),
  lights: new THREE.MeshBasicMaterial({ vertexColors: true }),
  front: new THREE.MeshStandardMaterial({ emissive: 0xffffff, emissiveIntensity: 1.6, roughness: 0.85, metalness: 0 }),
  road: new THREE.MeshStandardMaterial({ map: roadTex, roughness: 0.3, metalness: 0.08 }),
  pave: new THREE.MeshStandardMaterial({ map: paveTex, roughness: 0.55, metalness: 0.02 }),
  kerb: new THREE.MeshStandardMaterial({ color: 0x8a8c92, roughness: 0.6 }),
  grass: new THREE.MeshStandardMaterial({ map: grassTex, roughness: 0.95 }),
  sand: new THREE.MeshStandardMaterial({ map: sandTex, roughness: 1 }),
  wall: new THREE.MeshStandardMaterial({ color: 0x5a3326, roughness: 0.9 }),
  hedge: new THREE.MeshStandardMaterial({ color: 0x1c3018, roughness: 1 }),
  path: new THREE.MeshStandardMaterial({ color: 0x7a7468, roughness: 0.8 }),
  mat: new THREE.MeshStandardMaterial({ color: 0x5a2a1a, roughness: 1 }),
  roof: new THREE.MeshStandardMaterial({ color: 0x2a2e36, roughness: 0.7, metalness: 0.1 }),
  chimney: new THREE.MeshStandardMaterial({ color: 0x5a3326, roughness: 0.9 }),
  pole: new THREE.MeshStandardMaterial({ color: 0x3a3e46, roughness: 0.5, metalness: 0.5 }),
  lamp: new THREE.MeshBasicMaterial({ color: 0xffe0b0 }),
  rail: new THREE.MeshStandardMaterial({ color: 0x8fa6b8, roughness: 0.4, metalness: 0.6 }),
  sea: new THREE.MeshStandardMaterial({ color: 0x0a1a30, roughness: 0.12, metalness: 0.6 }),
  zebra: new THREE.MeshStandardMaterial({ map: zebraTex, transparent: true, roughness: 0.4, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
  pothole: new THREE.MeshStandardMaterial({ map: potTex, transparent: true, roughness: 0.9, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
  puddle: new THREE.MeshBasicMaterial({ map: puddleTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -2 }),
  pool: new THREE.MeshBasicMaterial({ map: radial, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true, polygonOffset: true, polygonOffsetFactor: -3, fog: true }),
  streak: new THREE.MeshBasicMaterial({ map: streakTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true, polygonOffset: true, polygonOffsetFactor: -4 }),
  bin: [0x1E5A2A, 0x1C1E24, 0x1E3A7A, 0x6A4A1E].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6 })),
  cone: new THREE.MeshStandardMaterial({ color: 0xff5a1a, roughness: 0.6, emissive: 0x401000 }),
  barrier: new THREE.MeshStandardMaterial({ map: barrierTex, roughness: 0.6 }),
  sign: new THREE.MeshStandardMaterial({ map: worksSignTex, roughness: 0.6, side: THREE.DoubleSide }),
  amber: new THREE.MeshBasicMaterial({ color: 0xffa020 }),
  black: new THREE.MeshStandardMaterial({ color: 0x0c0d10, roughness: 0.7 }),
  tyre: new THREE.MeshStandardMaterial({ color: 0x111214, roughness: 0.85 }),
  chrome: new THREE.MeshStandardMaterial({ color: 0xc8ccd4, roughness: 0.25, metalness: 0.9 }),
  glass: new THREE.MeshStandardMaterial({ color: 0x0c1220, roughness: 0.08, metalness: 0.7 }),
  head: new THREE.MeshBasicMaterial({ color: 0xfff6dc }),
  tail: new THREE.MeshBasicMaterial({ color: 0xff2030 }),
  ind: new THREE.MeshBasicMaterial({ color: 0x3a2a10 }), indOn: new THREE.MeshBasicMaterial({ color: 0xffb020 }),
  shelter: new THREE.MeshStandardMaterial({ color: 0x9ab8d0, roughness: 0.1, metalness: 0.3, transparent: true, opacity: 0.35 }),
  belisha: new THREE.MeshBasicMaterial({ color: 0xffa020 }),
  stripe: new THREE.MeshStandardMaterial({ map: ctex(32, 128, (g, w, h) => { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? "#fff" : "#111"; g.fillRect(0, i * 16, w, 16); } }), roughness: 0.5 }),
  coin: new THREE.MeshStandardMaterial({ color: 0xffc23a, roughness: 0.25, metalness: 1, emissive: 0x5a3a00 }),
  box: new THREE.MeshStandardMaterial({ map: boxTex, roughness: 0.45 }),
  kebab: new THREE.MeshStandardMaterial({ map: kebabTex, roughness: 0.5 }),
};
const paints = {};
const paint = (hex) => paints[hex] || (paints[hex] = new THREE.MeshStandardMaterial({ color: hex, roughness: 0.3, metalness: 0.55 }));
const BINS = ["#1E5A2A", "#1C1E24", "#1E3A7A", "#6A4A1E"];
const PAINTS = [0xB8262E, 0x2A4A8A, 0xD8D8DC, 0x1A1C22, 0x6A6E78, 0x2E6A4A, 0x8A2A6A, 0xC8A22A, 0x3A8AC8, 0xE8E2D2];

// ---------------------------------------------------------------- merging static parts (keeps draw calls low on phones)
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _n = new THREE.Matrix3();
function part(list, geo, mat, x, y, z, sx, sy, sz, ry = 0, rx = 0, rz = 0, opt) {
  if (rz && typeof rz === "object") { opt = rz; rz = 0; }   // options can come straight after rx
  _e.set(rx, ry, rz); _q.setFromEuler(_e); _m.compose(_v.set(x, y, z), _q, _s.set(sx, sy, sz));
  list.push({ geo, mat, m: _m.clone(), uv: opt && opt.uv, col: opt && opt.col });
}
const colCache = {};
const pc = (hex) => colCache[hex] || (colCache[hex] = new THREE.Color(hex));
function plain(list, geo, hex, x, y, z, sx, sy, sz, ry = 0, rx = 0, rz = 0) { part(list, geo, M.plain, x, y, z, sx, sy, sz, ry, rx, rz, { col: pc(hex) }); }
function lit(list, geo, hex, x, y, z, sx, sy, sz, ry = 0, rx = 0, rz = 0) { part(list, geo, M.lights, x, y, z, sx, sy, sz, ry, rx, rz, { col: pc(hex) }); }
function disposeBaked(o) { o.traverse((m) => { if (m.userData && m.userData.baked) m.geometry.dispose(); }); }
function bake(list) {
  const groups = new Map(); for (const p of list) { if (!groups.has(p.mat)) groups.set(p.mat, []); groups.get(p.mat).push(p); }
  const out = [];
  for (const [mat, ps] of groups) {
    let nv = 0, ni = 0; for (const p of ps) { nv += p.geo.attributes.position.count; ni += p.geo.index ? p.geo.index.count : p.geo.attributes.position.count; }
    const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = new Float32Array(nv * 2), col = new Float32Array(nv * 3), idx = new Uint32Array(ni);
    let ov = 0, oi = 0;
    for (const p of ps) {
      const g = p.geo, P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv; _n.getNormalMatrix(p.m);
      const cr = p.col ? p.col.r : 1, cg = p.col ? p.col.g : 1, cb = p.col ? p.col.b : 1, su = p.uv ? p.uv[0] : 1, sv = p.uv ? p.uv[1] : 1, ou = p.uv && p.uv.length > 2 ? p.uv[2] : 0, ovv = p.uv && p.uv.length > 2 ? p.uv[3] : 0;
      for (let i = 0; i < P.count; i++) {
        _v.fromBufferAttribute(P, i).applyMatrix4(p.m); pos.set([_v.x, _v.y, _v.z], (ov + i) * 3);
        if (N) { _v.fromBufferAttribute(N, i).applyMatrix3(_n).normalize(); nor.set([_v.x, _v.y, _v.z], (ov + i) * 3); }
        if (U) { uv[(ov + i) * 2] = U.getX(i) * su + ou; uv[(ov + i) * 2 + 1] = U.getY(i) * sv + ovv; }
        col[(ov + i) * 3] = cr; col[(ov + i) * 3 + 1] = cg; col[(ov + i) * 3 + 2] = cb;
      }
      if (g.index) for (let i = 0; i < g.index.count; i++) idx[oi + i] = g.index.getX(i) + ov; else for (let i = 0; i < P.count; i++) idx[oi + i] = i + ov;
      ov += P.count; oi += g.index ? g.index.count : P.count;
    }
    const bg = new THREE.BufferGeometry(); bg.setAttribute("position", new THREE.BufferAttribute(pos, 3)); bg.setAttribute("normal", new THREE.BufferAttribute(nor, 3)); bg.setAttribute("uv", new THREE.BufferAttribute(uv, 2)); bg.setAttribute("color", new THREE.BufferAttribute(col, 3)); bg.setIndex(new THREE.BufferAttribute(idx, 1));
    bg.computeBoundingSphere(); const mesh = new THREE.Mesh(bg, mat); mesh.userData.baked = true; out.push(mesh);
  }
  return out;
}

// ---------------------------------------------------------------- the world: chunks of street that recycle ahead of the rider
let route = ROUTES[0], fronts = [], skyline = null;
const chunks = [];
const statics = [];            // hazards on the road: {kind, x, z, w, l, mesh, hit}
const houses = [];             // deliverable doors: {x, z, side, used}
const lamps = [];              // street lamp positions, for the moving light on the rider
const signsGlow = [];          // shop signs, for coloured light on the rider
const zebras = [];
const coins = [];
function buildRoute(r) {
  route = r;
  if (M.front.map) { M.front.map.dispose(); M.front.emissiveMap.dispose(); }
  // every building front for this route is drawn into one shared texture (an atlas): far fewer draw calls on phones
  const list = [], cols = 4, rows = r.tall ? 2 : 4, sw = 384, sh = r.tall ? 768 : 432;
  const nHouse = r.tall ? 6 : (r.shops > 0.5 ? 8 : 11);
  for (let i = 0; i < nHouse; i++) list.push(facade(pick(r.styles), "house"));
  while (list.length < cols * rows) list.push(facade(r.tall ? "brick" : pick(r.styles), r.tall ? "shop" : r.sea && chance(0.5) ? "arcade" : r.shops > 0.05 ? "shop" : "house"));
  const A = document.createElement("canvas"), B = document.createElement("canvas"); A.width = B.width = cols * sw; A.height = B.height = rows * sh;
  const ga = A.getContext("2d"), gb = B.getContext("2d");
  fronts = list.map((f, i) => { const c = i % cols, rr = Math.floor(i / cols); ga.drawImage(f.c, c * sw, rr * sh, sw, sh); gb.drawImage(f.e, c * sw, rr * sh, sw, sh); return { uv: [1 / cols, 1 / rows, c / cols, 1 - (rr + 1) / rows], doorU: f.doorU, sign: f.sign, side: f.side }; });
  const ta = new THREE.CanvasTexture(A), tb = new THREE.CanvasTexture(B); ta.colorSpace = tb.colorSpace = THREE.SRGBColorSpace; ta.anisotropy = tb.anisotropy = 4;
  M.front.map = ta; M.front.emissiveMap = tb; M.front.needsUpdate = true;
  lampLight.color.set(r.lamp); M.lamp.color.set(r.lamp).lerp(new THREE.Color(0xffffff), 0.5);
  if (skyline) { scene.remove(skyline); skyline.material.map.dispose(); skyline.material.dispose(); }
  skyline = makeSkyline(r); scene.add(skyline);
  sea.visible = !!r.sea; wheel.visible = !!r.sea;
}
function makeSkyline(r) {
  const tex = ctex(2048, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, "rgba(10,14,40,0)"); gr.addColorStop(1, "rgba(30,24,60,.9)"); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w;) {
      const bw = r.tall ? rnd(30, 90) : rnd(20, 60), bh = r.tall ? rnd(60, 230) : rnd(18, 70); g.fillStyle = "#0d1022"; g.fillRect(x, h - bh, bw, bh);
      if (!r.tall && chance(0.4)) { g.beginPath(); g.moveTo(x, h - bh); g.lineTo(x + bw / 2, h - bh - 16); g.lineTo(x + bw, h - bh); g.fill(); }
      if (!r.tall && chance(0.04)) { g.fillRect(x + bw / 2 - 4, h - bh - 70, 8, 70); g.beginPath(); g.moveTo(x + bw / 2 - 8, h - bh - 70); g.lineTo(x + bw / 2, h - bh - 110); g.lineTo(x + bw / 2 + 8, h - bh - 70); g.fill(); }
      for (let k = 0; k < bw * bh / 260; k++) { g.fillStyle = pick(["#FFC878", "#FFE0A8", "#9CC8FF"]); g.globalAlpha = rnd(0.3, 0.9); g.fillRect(x + rnd(2, bw - 4), h - bh + rnd(4, bh - 4), 2, 3); } g.globalAlpha = 1;
      if (r.tall && chance(0.3)) { g.fillStyle = "#ff3030"; g.fillRect(x + bw / 2 - 2, h - bh - 4, 4, 4); }
      x += bw + rnd(0, 10);
    }
  }, { repeat: true });
  tex.wrapT = THREE.ClampToEdgeWrapping; tex.repeat.set(3, 1);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(330, 330, r.tall ? 120 : 70, 48, 1, true), new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  m.position.y = r.tall ? 40 : 20; return m;
}
// sky dome
const sky = new THREE.Mesh(new THREE.SphereGeometry(450, 24, 16), new THREE.MeshBasicMaterial({ side: THREE.BackSide, fog: false, depthWrite: false, map: ctex(16, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, "#03040c"); gr.addColorStop(0.45, "#0a1030"); gr.addColorStop(0.52, "#20184a"); gr.addColorStop(0.6, "#0a0d1c"); gr.addColorStop(1, "#05060c"); g.fillStyle = gr; g.fillRect(0, 0, w, h); }) }));
sky.renderOrder = -10; scene.add(sky);
// the sea and a lit-up big wheel for the seaside route
const sea = new THREE.Mesh(new THREE.PlaneGeometry(400, 600), M.sea); sea.rotation.x = -Math.PI / 2; sea.position.set(220, -1.6, 0); sea.visible = false; scene.add(sea);
const wheel = new THREE.Group(); {
  const ring = new THREE.Mesh(new THREE.TorusGeometry(26, 0.5, 6, 48), M.pole); wheel.add(ring);
  const pts = []; for (let i = 0; i < 64; i++) { const a = (i / 64) * Math.PI * 2; pts.push(Math.cos(a) * 26, Math.sin(a) * 26, 0); for (let k = 0; k < 3; k++) pts.push(Math.cos(a) * 26 * (k + 1) / 4, Math.sin(a) * 26 * (k + 1) / 4, 0); }
  const pg = new THREE.BufferGeometry(); pg.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
  wheel.add(new THREE.Points(pg, new THREE.PointsMaterial({ size: 2.6, map: radial, color: 0xff7ad0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })));
  wheel.visible = false; scene.add(wheel);
}

function buildChunk(ch, z0) {
  // remove the old contents
  for (const m of ch.meshes) { ch.group.remove(m); m.geometry.dispose(); } ch.meshes = [];
  for (const d of ch.dyn) { ch.group.remove(d); if (d.isPoints || d.isInstancedMesh) d.geometry !== coinGeo && d.geometry.dispose(); if (d.isInstancedMesh) d.dispose(); disposeBaked(d); } ch.dyn = [];
  ch.z0 = z0; const z1 = z0 - CHUNK, zc = z0 - CHUNK / 2, P = [];
  // road, kerbs, pavements
  part(P, PLANE, M.road, 0, 0, zc, ROAD * 2, CHUNK, 1, 0, -Math.PI / 2);
  for (const s of [-1, 1]) {
    plain(P, BOX, "#8a8c92", s * (ROAD + 0.1), 0.07, zc, 0.22, 0.16, CHUNK);
    if (route.sea && s > 0) { // the prom: pavement, railings, steps down to the beach
      part(P, PLANE, M.pave, s * 9.5, 0.15, zc, 7, CHUNK, 1, 0, -Math.PI / 2, { uv: [3.5, 25] });
      for (let z = z0 - 1; z > z1; z -= 2.5) plain(P, BOX, "#8fa6b8", 13, 0.7, z, 0.06, 1.1, 0.06);
      plain(P, BOX, "#8fa6b8", 13, 1.25, zc, 0.08, 0.08, CHUNK); plain(P, BOX, "#8fa6b8", 13, 0.75, zc, 0.05, 0.05, CHUNK);
      part(P, PLANE, M.sand, 30, -1.4, zc, 34, CHUNK, 1, 0, -Math.PI / 2, { uv: [8, 12] });
      continue;
    }
    part(P, PLANE, M.pave, s * (ROAD + PAVE) / 2 + s * 0.11, 0.15, zc, PAVE - ROAD, CHUNK, 1, 0, -Math.PI / 2, { uv: [1.3, 25] });
  }
  // houses and shops
  const sides = route.sea ? [-1] : [-1, 1];
  for (const s of sides) {
    let z = z0 - rnd(0, 4);
    while (z > z1 + 3) {
      const shop = chance(route.shops), f = shop ? pick(fronts.filter((x) => x.sign)) || pick(fronts) : pick(fronts.filter((x) => !x.sign)) || pick(fronts);
      const w = route.tall ? rnd(13, 17) : f.sign ? rnd(7, 8.5) : rnd(6, 7.2), H = route.tall ? rnd(22, 46) : f.sign ? rnd(7, 8.5) : rnd(6.6, 7.6);
      if (z - w < z1 - 2) break;
      const hz = z - w / 2, ry = s < 0 ? Math.PI / 2 : -Math.PI / 2;
      part(P, PLANE, M.front, s * FRONT, H / 2, hz, w, H, 1, ry, 0, 0, { uv: f.uv });
      plain(P, BOX, f.side, s * (FRONT + 4.02), H / 2, hz, 8, H, w - 0.04);
      if (!route.tall) { plain(P, ROOF, "#2a2e36", s * (FRONT + 4), H, hz, 8.6, 2.4, w + 0.1); if (chance(0.6)) plain(P, BOX, "#5a3326", s * (FRONT + 2.5), H + 2.2, z - 0.2, 0.9, 1.6, 0.6); }
      else if (chance(0.5)) plain(P, BOX, "#2a2e36", s * (FRONT + 4), H + 1, hz, 4, 2, 4);
      const doorZ = hz + (s < 0 ? -1 : 1) * (f.doorU - 0.5) * w;
      if (!f.sign && !route.tall) { // front garden: wall, hedge, path and doormat
        part(P, PLANE, M.grass, s * (PAVE + FRONT) / 2, 0.16, hz, FRONT - PAVE, w, 1, 0, -Math.PI / 2, { uv: [1, 2] });
        const gate = doorZ; const segs = [[hz + w / 2, gate + 0.8], [gate - 0.8, hz - w / 2]];
        const hedge = chance(0.5);
        for (const [a, b] of segs) if (a - b > 0.3) plain(P, BOX, hedge ? "#1c3018" : "#5a3326", s * (PAVE + 0.2), hedge ? 0.55 : 0.4, (a + b) / 2, 0.35, hedge ? 1.1 : 0.8, a - b);
        plain(P, BOX, "#7a7468", s * (PAVE + FRONT) / 2, 0.18, doorZ, FRONT - PAVE, 0.06, 1.3);
        if (chance(0.35)) plain(P, BOX, pick(BINS), s * (FRONT - 0.8), 0.55, doorZ + (s < 0 ? 1 : -1) * rnd(1.6, 2.4), 0.6, 1.05, 0.7);
      } else { part(P, PLANE, M.pave, s * (PAVE + FRONT) / 2, 0.155, hz, FRONT - PAVE, w, 1, 0, -Math.PI / 2, { uv: [1.3, 3] }); }
      plain(P, BOX, "#5a2a1a", s * MAT_X, 0.2, doorZ, 0.6, 0.04, 1.0);
      houses.push({ x: s * MAT_X, z: doorZ, side: s, used: false, ch });
      if (f.sign) signsGlow.push({ z: hz, x: s * FRONT, col: new THREE.Color().setHSL(Math.random(), 0.8, 0.55) });
      z -= w + (chance(0.15) && !route.tall ? rnd(1, 3) : 0.02);
    }
  }
  // street lamps every 25 m, alternating sides, with light pools and wet-road reflections
  const halo = [], hcol = [];
  for (let k = 0; k < 2; k++) {
    const lz = z0 - 12 - k * 25, s = (Math.round(-lz / 25) % 2) ? 1 : -1, lx = s * (ROAD + 0.9);
    if (route.sea && s > 0) { /* prom lamps sit on the railing side */ }
    plain(P, CYL, "#3a3e46", lx, 3.8, lz, 0.16, 7.6, 0.16);
    plain(P, BOX, "#3a3e46", lx - s * 0.8, 7.5, lz, 1.7, 0.12, 0.14);
    part(P, BOX, M.lamp, lx - s * 1.5, 7.38, lz, 0.55, 0.12, 0.35);
    const c = new THREE.Color(route.lamp);
    part(P, PLANE, M.pool, lx - s * 2.2, 0.2, lz, 10, 10, 1, 0, -Math.PI / 2, { col: c.clone().multiplyScalar(0.55) });
    part(P, PLANE, M.streak, lx - s * 1.6, 0.21, lz + 6, 1.2, 14, 1, 0, -Math.PI / 2, { col: c.clone().multiplyScalar(0.8) });
    halo.push(lx - s * 1.5, 7.3, lz); hcol.push(c.r, c.g, c.b);
    lamps.push({ x: lx - s * 1.5, z: lz });
  }
  for (const sg of signsGlow.filter((g) => g.z <= z0 && g.z > z1)) { part(P, PLANE, M.streak, sg.x * 0.62, 0.21, sg.z + 4, 2.4, 11, 1, 0, -Math.PI / 2, { col: sg.col.clone().multiplyScalar(0.6) }); }
  const hg = new THREE.BufferGeometry(); hg.setAttribute("position", new THREE.Float32BufferAttribute(halo, 3)); hg.setAttribute("color", new THREE.Float32BufferAttribute(hcol, 3));
  const hp = new THREE.Points(hg, haloMat); ch.group.add(hp); ch.dyn.push(hp);
  // hazards (never block the two middle lanes with something solid)
  if (ch.allowHazards) addHazards(P, ch, z0, z1);
  ch.meshes = bake(P); for (const m of ch.meshes) ch.group.add(m);
}
function addStatic(ch, kind, x, z, w, l, mesh) { statics.push({ kind, x, z, w, l, mesh, ch, hit: false }); if (mesh) { ch.group.add(mesh); ch.dyn.push(mesh); } }
function addHazards(P, ch, z0, z1) {
  const r = route;
  // parked cars along the kerbs
  for (const s of [-1, 1]) { if (r.sea && s > 0 && chance(0.6)) continue; if (chance(r.parked)) { const z = rnd(z1 + 6, z0 - 6); const car = makeCar(pick(PAINTS)); car.g.position.set(s * 5.15, 0, z); if (s > 0) car.g.rotation.y = Math.PI; addStatic(ch, "car", s * 5.15, z, 1.9, 4.4, car.g); } }
  // wheelie bins left out on the road edge
  if (chance(0.45)) { const s = pick([-1, 1]), z = rnd(z1 + 3, z0 - 3); plain(P, BOX, pick(BINS), s * 5.5, 0.55, z, 0.62, 1.05, 0.72); plain(P, BOX, "#111214", s * 5.5, 1.1, z + 0.02, 0.66, 0.06, 0.78); statics.push({ kind: "bin", x: s * 5.5, z, w: 0.7, l: 0.8, ch, hit: false }); }
  // potholes and puddles anywhere
  for (let i = 0; i < 2; i++) if (chance(0.5)) { const x = pick(LANES) + rnd(-0.6, 0.6), z = rnd(z1 + 3, z0 - 3); part(P, PLANE, M.pothole, x, 0.012, z, 1.3, 1.1, 1, 0, -Math.PI / 2, rnd(0, 3)); statics.push({ kind: "pothole", x, z, w: 1.0, l: 0.9, ch, hit: false }); }
  if (chance(0.55)) { const x = pick(LANES) + rnd(-0.8, 0.8), z = rnd(z1 + 4, z0 - 4); part(P, PLANE, M.puddle, x, 0.014, z, 2.8, 4.2, 1, 0, -Math.PI / 2); statics.push({ kind: "puddle", x, z, w: 2.4, l: 3.6, ch, hit: false }); }
  // roadworks closing an outside lane
  if (chance(r.works)) {
    const s = pick([-1, 1]), lx = s * 4.5, zs = rnd(z1 + 18, z0 - 4), len = 14;
    for (let z = zs; z > zs - len; z -= 2.3) { plain(P, CYL, "#ff5a1a", lx - s * 1.3, 0.36, z, 0.32, 0.72, 0.32); }
    part(P, BOX, M.barrier, lx, 0.7, zs + 0.3, 2.6, 0.32, 0.12); part(P, BOX, M.barrier, lx, 0.7, zs - len, 2.6, 0.32, 0.12);
    part(P, PLANE, M.sign, lx, 1.5, zs + 4, 1.1, 1.1, 1); plain(P, BOX, "#3a3e46", lx, 0.6, zs + 4, 0.06, 1.2, 0.06);
    const lampA = new THREE.Mesh(SPH, M.amber); lampA.scale.setScalar(0.18); lampA.position.set(lx, 1.0, zs + 0.3); ch.group.add(lampA); ch.dyn.push(lampA); ch.blink.push(lampA);
    statics.push({ kind: "works", x: lx, z: zs - len / 2 + 0.3, w: 2.8, l: len + 0.8, ch, hit: false });
  }
  // a zebra crossing with flashing Belisha beacons
  if (chance(r.zebra) && !r.tall) {
    const z = rnd(z1 + 8, z0 - 8); part(P, PLANE, M.zebra, 0, 0.013, z, ROAD * 2, 3.2, 1, 0, -Math.PI / 2, { uv: [3, 1] });
    for (const s of [-1, 1]) { part(P, CYL, M.stripe, s * 6.6, 1.3, z - 1.9, 0.12, 2.6, 0.12); const gl = new THREE.Mesh(SPH, M.belisha); gl.scale.setScalar(0.42); gl.position.set(s * 6.6, 2.75, z - 1.9); ch.group.add(gl); ch.dyn.push(gl); ch.blink.push(gl); }
    zebras.push({ z, ch, state: 0, ped: null });
  }
  // a bus stop with a bus pulled in
  if (chance(r.bus * 0.6) && !r.sea) {
    const z = rnd(z1 + 10, z0 - 10); part(P, BOX, M.shelter, -7.6, 1.3, z, 1.2, 2.4, 3.6); plain(P, BOX, "#3a3e46", -7.0, 1.3, z - 2.4, 0.08, 2.6, 0.08);
    if (chance(0.6)) { const b = makeBus(); b.g.position.set(-4.6, 0, z); addStatic(ch, "bus", -4.6, z, 2.6, 11.2, b.g); }
  }
  // a line of coins (tips)
  if (chance(0.7)) { const x = pick(LANES), z = rnd(z1 + 14, z0 - 4), inst = new THREE.InstancedMesh(coinGeo, M.coin, 6); inst.frustumCulled = false; ch.group.add(inst); ch.dyn.push(inst); for (let i = 0; i < 6; i++) coins.push({ inst, i, x, z: z - i * 2.4, ch, got: false }); }
}
const coinGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.07, 18);
const haloMat = new THREE.PointsMaterial({ size: 4.2, map: radial, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
function initChunks() {
  for (const c of chunks) { scene.remove(c.group); for (const m of c.meshes) m.geometry.dispose(); }
  chunks.length = 0; statics.length = 0; houses.length = 0; lamps.length = 0; signsGlow.length = 0; zebras.length = 0; coins.length = 0;
  for (let i = 0; i < NCHUNK; i++) { const ch = { group: new THREE.Group(), meshes: [], dyn: [], blink: [], z0: 0, allowHazards: i > 0 }; scene.add(ch.group); buildChunk(ch, 30 - i * CHUNK); chunks.push(ch); }
}
function recycle() {
  for (const ch of chunks) {
    if (ch.z0 - CHUNK > pz + 25) {
      const minZ = Math.min(...chunks.map((c) => c.z0));
      // forget everything that belonged to this chunk
      for (const arr of [statics, houses, zebras, coins]) for (let i = arr.length - 1; i >= 0; i--) if (arr[i].ch === ch) arr.splice(i, 1);
      for (let i = lamps.length - 1; i >= 0; i--) if (lamps[i].z > ch.z0 - CHUNK - 1 && lamps[i].z <= ch.z0 + 1) lamps.splice(i, 1);
      for (let i = signsGlow.length - 1; i >= 0; i--) if (signsGlow[i].z > pz + 30) signsGlow.splice(i, 1);
      ch.blink = []; ch.allowHazards = true;
      buildChunk(ch, minZ - CHUNK);
    }
  }
}

// ---------------------------------------------------------------- vehicles
const streakMats = {};
const streakMat = (col) => streakMats[col] || (streakMats[col] = new THREE.MeshBasicMaterial({ map: streakTex, color: col, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.8 }));
const plateMats = PLATES.map((t) => new THREE.MeshBasicMaterial({ map: t }));
const shadowMat = new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false });
const TORUS = new THREE.TorusGeometry(0.33, 0.035, 6, 16), CAP_B = new THREE.CapsuleGeometry(0.2, 0.42, 4, 8), CAP_P = new THREE.CapsuleGeometry(0.24, 0.8, 4, 8);
const hiVis = new THREE.MeshStandardMaterial({ color: 0xD8E21E, emissive: 0x3a4000, roughness: 0.6 });
const COATS = [0x8A2A2A, 0x2A3A6A, 0x3A5A3A, 0x6A5A3A, 0x222222].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 }));
const SKINS = [0xE8C0A0, 0xC89070, 0x8A5A3A, 0x5A3A2A].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7 }));
function wheels(P, pairs, y, r, w) { for (const [x, z] of pairs) part(P, CYL, M.tyre, x, y, z, r * 2, w, r * 2, 0, 0, Math.PI / 2); }
function indicators(g, ind, xs, zs, y, size) { for (const [side, x] of xs) { const Q = []; for (const z of zs) part(Q, BOX, M.ind, x, y, z, size[0], size[1], size[2]); const [m] = bake(Q); g.add(m); ind[side].push(m); } }
function glowStreak(g, col, x, z, len, w = 0.5) { const s = new THREE.Mesh(PLANE, streakMat(col)); s.rotation.x = -Math.PI / 2; s.scale.set(w, len, 1); s.position.set(x, 0.03, z + len / 2); g.add(s); return s; }
function makeCar(col, cab) {
  const g = new THREE.Group(), body = paint(col), L = cab ? 4.6 : rnd(3.9, 4.5), W = 1.8, P = [];
  part(P, BOX, body, 0, 0.62, 0, W, 0.62, L);
  part(P, BOX, M.tyre, 0, 0.36, 0, W + 0.02, 0.18, L + 0.02);
  part(P, BOX, M.glass, 0, cab ? 1.28 : 1.2, 0.2, W - 0.16, cab ? 0.72 : 0.55, L * 0.5);
  part(P, BOX, body, 0, cab ? 1.66 : 1.49, 0.2, W - 0.2, 0.06, L * 0.46);
  wheels(P, [[-0.78, -L * 0.33], [0.78, -L * 0.33], [-0.78, L * 0.33], [0.78, L * 0.33]], 0.34, 0.34, 0.26);
  for (const x of [-0.6, 0.6]) { lit(P, BOX, 0xfff6dc, x, 0.72, -L / 2 - 0.01, 0.42, 0.14, 0.05); lit(P, BOX, 0xff2030, x, 0.74, L / 2 + 0.01, 0.4, 0.14, 0.05); }
  if (cab) lit(P, BOX, 0xffb020, 0, 1.78, 0.2, 0.5, 0.16, 0.22);
  const pm = pick(plateMats);
  part(P, PLANE, pm, 0, 0.5, -L / 2 - 0.03, 0.52, 0.12, 1, Math.PI, 0, 0, { uv: [1, 0.5, 0, 0.5] });
  part(P, PLANE, pm, 0, 0.5, L / 2 + 0.03, 0.52, 0.12, 1, 0, 0, 0, { uv: [1, 0.5, 0, 0] });
  for (const x of [-0.6, 0.6]) part(P, PLANE, streakMat(0xff2030), x, 0.03, L / 2 + 1.6, 0.45, 3.2, 1, 0, -Math.PI / 2);
  part(P, PLANE, shadowMat, 0, 0.02, 0, W + 0.8, L + 0.8, 1, 0, -Math.PI / 2);
  for (const m of bake(P)) g.add(m);
  const ind = { l: [], r: [] }; indicators(g, ind, [["l", -0.86], ["r", 0.86]], [-L / 2, L / 2], 0.74, [0.1, 0.1, 0.08]);
  return { g, len: L, wid: W, ind, kind: cab ? "cab" : "car" };
}
const busSide = ctex(512, 256, (g, w, h) => { g.fillStyle = "#C21E1E"; g.fillRect(0, 0, w, h); for (const y of [30, 140]) for (let x = 14; x < w - 20; x += 62) { g.fillStyle = "#FFE2A8"; g.fillRect(x, y, 52, 62); } g.fillStyle = "#E8E2D2"; g.fillRect(0, 112, w, 10); g.fillStyle = "#111"; g.fillRect(0, h - 26, w, 26); });
const busGlow = ctex(512, 256, (g, w, h) => { g.fillStyle = "#000"; g.fillRect(0, 0, w, h); for (const y of [30, 140]) for (let x = 14; x < w - 20; x += 62) { g.fillStyle = "#FFD9A0"; g.globalAlpha = rnd(0.5, 0.9); g.fillRect(x, y, 52, 62); } g.globalAlpha = 1; });
const busMat = new THREE.MeshStandardMaterial({ map: busSide, emissiveMap: busGlow, emissive: 0xffffff, emissiveIntensity: 0.9, roughness: 0.45, metalness: 0.2 });
const busBack = new THREE.MeshStandardMaterial({ map: ctex(256, 256, (g, w, h) => { g.fillStyle = "#C21E1E"; g.fillRect(0, 0, w, h); g.fillStyle = "#111"; g.fillRect(30, 20, w - 60, 40); g.fillStyle = "#FFB020"; g.font = "bold 30px Arial"; g.textAlign = "center"; g.fillText("24  LATE NIGHT", w / 2, 50); g.fillStyle = "#2a3040"; g.fillRect(30, 80, w - 60, 70); }), roughness: 0.45 });
function makeBus() {
  const g = new THREE.Group(), L = 11, W = 2.55, H = 4.3, P = [];
  part(P, BOX, busMat, 0, H / 2 + 0.2, 0, W, H - 0.4, L);
  part(P, PLANE, busBack, 0, H / 2 + 0.2, L / 2 + 0.01, W, H - 0.4, 1);
  wheels(P, [[-1.15, -L * 0.36], [1.15, -L * 0.36], [-1.15, L * 0.3], [1.15, L * 0.3]], 0.5, 0.5, 0.32);
  for (const x of [-0.95, 0.95]) { lit(P, BOX, 0xff2030, x, 0.9, L / 2 + 0.03, 0.3, 0.3, 0.05); lit(P, BOX, 0xfff6dc, x, 0.9, -L / 2 - 0.03, 0.35, 0.2, 0.05); part(P, PLANE, streakMat(0xff2030), x, 0.03, L / 2 + 2, 0.5, 4, 1, 0, -Math.PI / 2); }
  part(P, PLANE, shadowMat, 0, 0.02, 0, W + 0.9, L + 1, 1, 0, -Math.PI / 2);
  for (const m of bake(P)) g.add(m);
  const ind = { l: [], r: [] }; indicators(g, ind, [["l", -1.3], ["r", 1.3]], [L / 2], 0.9, [0.1, 0.14, 0.1]);
  return { g, len: L, wid: W, ind, kind: "bus" };
}
function makeBike() {
  const g = new THREE.Group(), P = [];
  for (const z of [-0.55, 0.55]) part(P, TORUS, M.tyre, 0, 0.36, z, 1, 1, 1, Math.PI / 2);
  part(P, BOX, M.chrome, 0, 0.62, 0, 0.05, 0.05, 1.1, 0, 0.15);
  part(P, CAP_B, hiVis, 0, 1.25, 0.1, 1, 1, 1, 0, -0.6);
  part(P, SPH, paint(0x1E62C8), 0, 1.62, -0.25, 0.3, 0.3, 0.3);
  part(P, BOX, M.black, 0, 0.8, 0.1, 0.24, 0.6, 0.24);
  for (const m of bake(P)) g.add(m);
  const tl = new THREE.Mesh(BOX, M.tail); tl.scale.set(0.12, 0.08, 0.04); tl.position.set(0, 0.85, 0.75); g.add(tl);
  return { g, len: 1.8, wid: 0.7, ind: { l: [], r: [] }, kind: "bike", light: tl };
}
function makePed() {
  const g = new THREE.Group(), coat = pick(COATS);
  const b = new THREE.Mesh(CAP_P, coat); b.position.y = 1.0; g.add(b);
  const hd = new THREE.Mesh(SPH, pick(SKINS)); hd.scale.setScalar(0.32); hd.position.y = 1.72; g.add(hd);
  const legs = new THREE.Mesh(BOX, M.black); legs.scale.set(0.3, 0.6, 0.2); legs.position.y = 0.3; g.add(legs);
  return g;
}

// ---------------------------------------------------------------- the rider
const bike = new THREE.Group(); scene.add(bike);
const lean = new THREE.Group(); bike.add(lean);
const redPaint = new THREE.MeshStandardMaterial({ color: 0xC81E28, roughness: 0.28, metalness: 0.45 });
const helmetMat = new THREE.MeshStandardMaterial({ color: 0xD3262E, roughness: 0.2, metalness: 0.3 });
const hoodie = new THREE.MeshStandardMaterial({ color: 0xA81E24, roughness: 0.85 });
const jeans = new THREE.MeshStandardMaterial({ color: 0x1E2A44, roughness: 0.9 });
const add = (geo, mat, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0, parent = lean) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.rotation.set(rx, ry, rz); parent.add(m); return m; };
const RP = [], rp = (geo, mat, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) => part(RP, geo, mat, x, y, z, sx, sy, sz, ry, rx, rz);
const WHEEL = new THREE.TorusGeometry(0.26, 0.1, 10, 20), THIGH = new THREE.CapsuleGeometry(0.11, 0.42, 4, 8), SHIN = new THREE.CapsuleGeometry(0.1, 0.36, 4, 8), TORSO = new THREE.CapsuleGeometry(0.24, 0.42, 6, 10), ARM = new THREE.CapsuleGeometry(0.075, 0.5, 4, 8);
rp(WHEEL, M.tyre, 0, 0.36, -0.78, 1, 1, 1, 0, Math.PI / 2); rp(WHEEL, M.tyre, 0, 0.36, 0.62, 1, 1, 1, 0, Math.PI / 2);
rp(CYL, M.chrome, 0, 0.36, -0.78, 0.26, 0.16, 0.26, 0, 0, Math.PI / 2); rp(CYL, M.chrome, 0, 0.36, 0.62, 0.26, 0.16, 0.26, 0, 0, Math.PI / 2);
rp(SPH, redPaint, 0, 0.66, 0.42, 0.62, 0.52, 1.05);                           // rear cowl
rp(BOX, M.black, 0, 0.38, -0.12, 0.44, 0.08, 0.86);                            // floorboard
rp(BOX, redPaint, 0, 0.78, -0.6, 0.52, 0.8, 0.12, 0.18);                       // leg shield
rp(SPH, redPaint, 0, 0.6, -0.8, 0.36, 0.2, 0.5);                               // front mudguard
rp(CYL, M.chrome, 0, 0.92, -0.72, 0.06, 0.62, 0.06, -0.3);                     // steering column
rp(CYL, M.black, 0, 1.2, -0.62, 0.05, 0.74, 0.05, 0, 0, Math.PI / 2);          // handlebar
rp(BOX, M.black, 0, 0.98, 0.22, 0.38, 0.12, 0.68);                             // seat
rp(CYL, M.head, 0, 1.08, -0.78, 0.2, 0.06, 0.2, Math.PI / 2);                  // headlight
rp(BOX, M.tail, 0, 0.72, 0.98, 0.18, 0.08, 0.05);
rp(BOX, M.box, 0, 1.42, 0.62, 0.66, 0.58, 0.58);                                // the kebab box
rp(BOX, M.chrome, 0, 1.12, 0.62, 0.7, 0.04, 0.62);
rp(THIGH, jeans, -0.17, 0.82, -0.06, 1, 1, 1, Math.PI / 2 - 0.3); rp(THIGH, jeans, 0.17, 0.82, -0.06, 1, 1, 1, Math.PI / 2 - 0.3);
rp(SHIN, jeans, -0.18, 0.58, -0.32, 1, 1, 1, 0.25); rp(SHIN, jeans, 0.18, 0.58, -0.32, 1, 1, 1, 0.25);
rp(TORSO, hoodie, 0, 1.36, 0.08, 1, 1, 0.85, -0.38);
rp(SPH, helmetMat, 0, 1.86, -0.12, 0.42, 0.42, 0.46);
rp(SPH, M.glass, 0, 1.84, -0.28, 0.34, 0.2, 0.2);
for (const m of bake(RP)) lean.add(m);
const armL = add(ARM, hoodie, -0.3, 1.36, -0.3, 1, 1, 1, -1.05, 0, -0.2);
const armR = add(ARM, hoodie, 0.3, 1.36, -0.3, 1, 1, 1, -1.05, 0, 0.2);
const bikeShadow = new THREE.Mesh(PLANE, new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false })); bikeShadow.rotation.x = -Math.PI / 2; bikeShadow.scale.set(1.4, 2.6, 1); bikeShadow.position.y = 0.03; bike.add(bikeShadow);
const tailStreak = glowStreak(bike, 0xff2030, 0, 1.0, 2.2, 0.35);
const headStreak = new THREE.Mesh(PLANE, new THREE.MeshBasicMaterial({ map: streakTex, color: 0xfff0c8, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.35 })); headStreak.rotation.x = -Math.PI / 2; headStreak.scale.set(2.2, 9, 1); headStreak.position.set(0, 0.03, -5.5); bike.add(headStreak);
function setHelmet() { const h = HELMETS.find((x) => x.k === save.helmet) || HELMETS[0]; helmetMat.color.set(h.c); }
setHelmet();

// ---------------------------------------------------------------- delivery marker, aim preview, projectiles, particles
const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 40, 20, 1, true), new THREE.MeshBasicMaterial({ map: beamTex, color: 0x18e070, opacity: 0.6, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false })); beam.position.y = 20; beam.visible = false; scene.add(beam);
const matRing = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.86, 40), new THREE.MeshBasicMaterial({ color: 0x5fe3b0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); matRing.rotation.x = -Math.PI / 2; matRing.visible = false; scene.add(matRing);
const matGlow = new THREE.Mesh(PLANE, new THREE.MeshBasicMaterial({ map: radial, color: 0x5fe3b0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); matGlow.rotation.x = -Math.PI / 2; matGlow.scale.set(4, 4, 1); matGlow.visible = false; scene.add(matGlow);
const aimPts = new Float32Array(32 * 3); const aimGeo = new THREE.BufferGeometry(); aimGeo.setAttribute("position", new THREE.BufferAttribute(aimPts, 3));
const aimLine = new THREE.Points(aimGeo, new THREE.PointsMaterial({ size: 0.3, map: radial, color: 0xffffff, transparent: true, depthTest: false, depthWrite: false })); aimLine.visible = false; aimLine.renderOrder = 5; aimLine.frustumCulled = false; scene.add(aimLine);
const aimRing = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.68, 32), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthTest: false, side: THREE.DoubleSide })); aimRing.rotation.x = -Math.PI / 2; aimRing.renderOrder = 6; aimRing.visible = false; scene.add(aimRing);
const kebabGeo = new THREE.CylinderGeometry(0.11, 0.08, 0.34, 10);
const flying = [];
// one shared particle system for splashes, sparks and celebrations
const NP = 260, pPos = new Float32Array(NP * 3), pCol = new Float32Array(NP * 3), pVel = new Float32Array(NP * 3), pLife = new Float32Array(NP);
const pGeo = new THREE.BufferGeometry(); pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3)); pGeo.setAttribute("color", new THREE.BufferAttribute(pCol, 3));
const parts = new THREE.Points(pGeo, new THREE.PointsMaterial({ size: 0.28, map: radial, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); parts.frustumCulled = false; scene.add(parts);
let pNext = 0;
function burst(x, y, z, n, col, spd, up = 3) { const c = new THREE.Color(col); for (let i = 0; i < n; i++) { const k = pNext++ % NP; pPos.set([x, y, z], k * 3); pVel.set([rnd(-spd, spd), rnd(0.5, up), rnd(-spd, spd)], k * 3); pCol.set([c.r, c.g, c.b], k * 3); pLife[k] = rnd(0.5, 1.1); } }
function stepParticles(dt) { for (let k = 0; k < NP; k++) { if (pLife[k] <= 0) { pPos[k * 3 + 1] = -50; continue; } pLife[k] -= dt; pVel[k * 3 + 1] -= 9 * dt; for (let a = 0; a < 3; a++) pPos[k * 3 + a] += pVel[k * 3 + a] * dt; if (pPos[k * 3 + 1] < 0.05) { pPos[k * 3 + 1] = 0.05; pVel[k * 3 + 1] *= -0.3; } const f = Math.max(0, pLife[k]); pCol[k * 3] *= 0.985; pCol[k * 3 + 1] *= 0.985; pCol[k * 3 + 2] *= 0.985; void f; } pGeo.attributes.position.needsUpdate = true; pGeo.attributes.color.needsUpdate = true; }

// rain: streaks around the camera
const RAIN_N = 900, rainPos = new Float32Array(RAIN_N * 6);
const rainGeo = new THREE.BufferGeometry(); rainGeo.setAttribute("position", new THREE.BufferAttribute(rainPos, 3));
const rain = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: 0x9fb4ff, transparent: true, opacity: 0.32, depthWrite: false })); rain.frustumCulled = false; scene.add(rain);
function seedDrop(i, cx, cz, top) { const x = cx + rnd(-16, 16), y = top ? rnd(10, 16) : rnd(0, 16), z = cz + rnd(-40, 6); rainPos.set([x, y, z, x + 0.06, y - 0.7, z + 0.15], i * 6); }
for (let i = 0; i < RAIN_N; i++) seedDrop(i, 0, 0, false);
function stepRain(dt, cx, cz) {
  const n = save.set.hi ? RAIN_N : Math.floor(RAIN_N * 0.45); rainGeo.setDrawRange(0, n * 2); rain.visible = save.set.rain;
  if (!save.set.rain) return;
  for (let i = 0; i < n; i++) { const o = i * 6; const dy = -24 * dt; rainPos[o + 1] += dy; rainPos[o + 4] += dy; rainPos[o] += 1.2 * dt; rainPos[o + 3] += 1.2 * dt; if (rainPos[o + 1] < 0 || rainPos[o + 2] > cz + 8 || rainPos[o + 2] < cz - 46) seedDrop(i, cx, cz, true); }
  rainGeo.attributes.position.needsUpdate = true;
}

// ---------------------------------------------------------------- sound
let AC = null, eng = null, rainSnd = null;
function audioOn() {
  try {
    AC = PUB.ctx(); if (eng) return;
    const g = AC.createGain(); g.gain.value = 0; g.connect(AC.destination);
    const f = AC.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 900; f.Q.value = 3; f.connect(g);
    const o1 = AC.createOscillator(), o2 = AC.createOscillator(), o3 = AC.createOscillator(); o1.type = "sawtooth"; o2.type = "sawtooth"; o3.type = "square";
    const g3 = AC.createGain(); g3.gain.value = 0.35; o1.connect(f); o2.connect(f); o3.connect(g3).connect(f);
    const lfo = AC.createOscillator(), lg = AC.createGain(); lfo.frequency.value = 18; lg.gain.value = 6; lfo.connect(lg); lg.connect(o1.frequency); lg.connect(o2.frequency);
    for (const o of [o1, o2, o3, lfo]) o.start();
    eng = { g, f, o1, o2, o3 };
    const buf = AC.createBuffer(1, AC.sampleRate * 2, AC.sampleRate), d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = AC.createBufferSource(); src.buffer = buf; src.loop = true; const hp = AC.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 1200; const lp = AC.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 7000; const rg = AC.createGain(); rg.gain.value = 0;
    src.connect(hp).connect(lp).connect(rg).connect(AC.destination); src.start(); rainSnd = rg;
  } catch (e) {}
}
function stepAudio() {
  if (!AC || !eng) return; const t = AC.currentTime, muted = store.get("loMute") === "1";
  const on = !muted && (state === "play" || state === "attract") && !document.hidden;
  const f = 48 + speed * 6.2 + Math.abs(vx) * 2;
  eng.o1.frequency.setTargetAtTime(f, t, 0.08); eng.o2.frequency.setTargetAtTime(f * 1.01, t, 0.08); eng.o3.frequency.setTargetAtTime(f / 2, t, 0.08); eng.f.frequency.setTargetAtTime(500 + speed * 70, t, 0.1);
  eng.g.gain.setTargetAtTime(on ? (state === "play" ? 0.05 : 0.02) : 0, t, 0.1);
  rainSnd.gain.setTargetAtTime(on && save.set.rain ? 0.05 : 0, t, 0.3);
}
const sfx = {
  coin: () => PUB.beep(1500, 2300, 0.08, "sine", 0.05),
  whoosh: () => PUB.noise(0.32, 0.12, 1400, 0, 0.7),
  thud: () => PUB.thud(),
  crash: () => { PUB.smash(); PUB.thud(); PUB.noise(0.5, 0.2, 400, 0.05); },
  bump: () => { PUB.thud(); PUB.noise(0.12, 0.1, 300); },
  splash: () => { PUB.noise(0.45, 0.16, 1800, 0, 0.5); PUB.noise(0.3, 0.1, 4000, 0.05); },
  bell: () => { PUB.beep(659, 659, 0.45, "sine", 0.08); PUB.beep(523, 523, 0.7, "sine", 0.08, 0.32); },
  perfect: () => { [0, 0.08, 0.16, 0.24].forEach((d, i) => PUB.beep([784, 988, 1175, 1568][i], [784, 988, 1175, 1568][i], 0.22, "triangle", 0.06, d)); },
  miss: () => { PUB.beep(300, 160, 0.3, "triangle", 0.06); },
  glass: () => { PUB.smash(); },
  horn: () => { PUB.beep(392, 392, 0.32, "square", 0.04); PUB.beep(466, 466, 0.32, "square", 0.03); },
  near: () => { PUB.noise(0.25, 0.14, 2500, 0, 0.6); },
  tick: () => PUB.beep(900, 900, 0.03, "square", 0.02),
};
const CH = [[57, 60, 64], [53, 57, 60], [55, 59, 62], [52, 55, 59], [57, 60, 64], [53, 57, 60], [50, 53, 57], [52, 56, 59]];
const TUNE = [69, 0, 72, 0, 76, 0, 74, 72, 0, 0, 71, 0, 72, 0, 69, 0, 65, 0, 69, 0, 72, 0, 71, 69, 0, 0, 67, 0, 64, 0, 0, 0,
  69, 0, 72, 0, 76, 0, 79, 77, 0, 0, 76, 0, 74, 0, 72, 0, 74, 0, 72, 0, 71, 0, 69, 0, 68, 0, 0, 0, 64, 0, 0, 0];
const music = (on) => { if (on && save.set.music) PUB.music(CH, TUNE, 128); else PUB.stopMusic(); };

// ---------------------------------------------------------------- game state
let state = "attract";             // attract (menus), play, paused, over
let px = -4.5, pz = 20, vx = 0, speed = 8, slide = 0, recover = 0, invul = 0, bounce = 0, shake = 0;
let temp = 100, score = 0, streak = 0, tipsRun = 0, dents = 0, delivered = 0, failed = 0, perfects = 0, nearMisses = 0, crashes = 0, distance = 0;
let target = null, nextTargetIn = 0, charging = false, power = 0, chargeT = 0, cooldown = 0, endTimer = 0;
const traffic = [];
const input = { l: false, r: false, brake: false };
const upg = () => ({
  vmax: route.vmax + lvl("engine") * 1.3, acc: 5.5 + lvl("engine") * 0.6, steer: 6.2 + lvl("handling") * 0.9,
  decay: route.decay * (1 - lvl("box") * 0.14), perfectR: 0.8 + lvl("arm") * 0.12, swing: 1.25 + lvl("arm") * 0.14,
  grip: 1 - lvl("tyres") * 0.2, recover: 1.3 - lvl("tyres") * 0.15,
});
let U = upg();

function resetRun() {
  U = upg(); px = LANES[0]; pz = 20; vx = 0; speed = 6; slide = 0; recover = 0; invul = 0; bounce = 0; shake = 0;
  temp = 100; score = 0; streak = 0; tipsRun = 0; dents = 0; delivered = 0; failed = 0; perfects = 0; nearMisses = 0; crashes = 0; distance = 0;
  target = null; nextTargetIn = 0.5; charging = false; power = 0; cooldown = 0; endTimer = 0;
  for (const t of traffic) { scene.remove(t.g); disposeBaked(t.g); } traffic.length = 0;
  for (const f of flying) scene.remove(f.m); flying.length = 0;
  initChunks(); beam.visible = matRing.visible = matGlow.visible = false;
}

// ---------------------------------------------------------------- traffic
function spawnTraffic() {
  const want = Math.round(5 + route.traffic * 7) * (state === "attract" ? 0.6 : 1);
  if (traffic.length >= want) return;
  const far = pz - rnd(170, 230), lane = Math.floor(Math.random() * 4), ours = lane < 2;
  // keep gaps: nothing within 22 m in that lane, and never three lanes busy at the same spot
  if (traffic.some((t) => t.lane === lane && Math.abs(t.z - far) < 22)) return;
  if (new Set(traffic.filter((t) => Math.abs(t.z - far) < 14).map((t) => t.lane)).size >= 2) return;
  if (statics.some((s) => (s.kind === "car" || s.kind === "bus" || s.kind === "works") && Math.abs(s.x - LANES[lane]) < 1.6 && Math.abs(s.z - far) < 16)) return;
  let v;
  const roll = Math.random();
  if (ours && lane === 0 && roll < route.cyc * 0.5) v = makeBike();
  else if (roll < route.bus * 0.5 && (lane === 0 || lane === 3)) v = makeBus();
  else v = makeCar(pick(PAINTS), Math.random() < route.cab);
  const t = { ...v, lane, x: LANES[lane] + (v.kind === "bike" ? (ours ? -0.9 : 0.9) : 0), z: far, v: ours ? -(v.kind === "bike" ? rnd(4.5, 6) : v.kind === "bus" ? rnd(6, 8) : rnd(7.5, 11.5)) : rnd(9, 13.5), passed: false, sig: 0, to: null, blinkT: 0 };
  if (!ours) t.g.rotation.y = Math.PI;
  t.g.position.set(t.x, 0, t.z); scene.add(t.g); traffic.push(t);
}
function stepTraffic(dt) {
  for (let i = traffic.length - 1; i >= 0; i--) {
    const t = traffic[i], ours = t.lane < 2;
    // follow the vehicle in front (in its travel direction)
    let vt = t.v;
    for (const o of traffic) if (o !== t && o.lane === t.lane) { const ahead = ours ? t.z - o.z : o.z - t.z; if (ahead > 0 && ahead < 14) vt = ours ? Math.max(vt, o.v) : Math.min(vt, o.v); }
    for (const s of statics) if ((s.kind === "car" || s.kind === "bus" || s.kind === "works") && Math.abs(s.x - t.x) < 1.6) { const ahead = ours ? t.z - s.z : s.z - t.z; if (ahead > 0 && ahead < 18) { if (!t.to) startLaneChange(t, true); if (!t.to && ahead < 9) vt = 0; } }
    t.z += vt * dt;
    // lane changes, signalled first
    if (!t.to && t.kind !== "bike" && t.kind !== "bus" && Math.abs(t.z - pz) > 30 && Math.abs(t.z - pz) < 150 && Math.random() < dt * 0.06) startLaneChange(t, false);
    if (t.to != null) {
      t.blinkT += dt; const on = Math.floor(t.blinkT * 3) % 2 === 0; for (const m of t.ind[t.to > t.x ? "r" : "l"]) m.material = on ? M.indOn : M.ind;
      if (t.blinkT > 1.4) { const d = t.to - t.x; t.x += Math.sign(d) * Math.min(Math.abs(d), dt * 1.8); if (Math.abs(d) < 0.02) { t.x = t.to; t.lane = LANES.indexOf(t.to); t.to = null; t.blinkT = 0; for (const m of [...t.ind.l, ...t.ind.r]) m.material = M.ind; } }
    }
    if (t.light) t.light.visible = Math.floor(performance.now() / 300) % 2 === 0;
    t.g.position.set(t.x, 0, t.z);
    if (t.z > pz + 30 || t.z < pz - 280) { scene.remove(t.g); disposeBaked(t.g); traffic.splice(i, 1); continue; }
    // near misses and crashes
    if (state === "play") {
      const dx = Math.abs(t.x - px) - t.wid / 2 - 0.36, dz = Math.abs(t.z - pz) - t.len / 2 - 0.95;
      if (dx < 0 && dz < 0) crash(t);
      if (!t.passed && ((ours && t.z > pz) || (!ours && t.z > pz))) { t.passed = true; if (dx > 0 && dx < 0.95 && speed > 8 && invul <= 0) nearMiss(t); }
    }
  }
}
function startLaneChange(t, forced) {
  const ours = t.lane < 2, opts = (ours ? [0, 1] : [2, 3]).filter((l) => l !== t.lane);
  const l = opts[0]; if (l == null) return;
  if (traffic.some((o) => o !== t && o.lane === l && Math.abs(o.z - t.z) < 16)) return;
  if (statics.some((s) => (s.kind === "car" || s.kind === "bus" || s.kind === "works") && Math.abs(s.x - LANES[l]) < 1.6 && Math.abs(s.z - t.z) < 22)) return;
  if (!forced && Math.abs(t.z - pz) < 34) return;
  t.to = LANES[l]; t.blinkT = 0;
}

// ---------------------------------------------------------------- hits, near misses, deliveries
function crash(what) {
  if (invul > 0) return;
  dents++; crashes++; streak = 0; invul = 1.8; recover = U.recover; speed *= 0.3; shake = 0.8; vx = -Math.sign(what.x - px || 1) * 4;
  temp = Math.max(0, temp - 6); sfx.crash(); if (what.kind === "car" || what.kind === "cab" || what.kind === "bus") setTimeout(sfx.horn, 250);
  burst(px, 1, pz - 0.8, 26, 0xffc060, 4, 4); flashHit();
  if (dents >= 3) { showPop("KNACKERED!", "Three crashes and the scooter's had it", "bad"); endShift("knackered"); }
  else showPop("OOF!", `Dent ${dents} of 3`, "bad");
  hud();
}
function nearMiss(t) { nearMisses++; const pts = Math.round(40 * mult()); score += pts; sfx.near(); if (Math.random() < 0.4) sfx.horn(); showPop("NEAR MISS", `+${pts}`, "good", 0.9); }
const mult = () => Math.min(1 + streak * 0.5, 4);
function flashHit() { const v = $("vignette"); v.classList.add("hit"); setTimeout(() => v.classList.remove("hit"), 140); if (navigator.vibrate) try { navigator.vibrate(120); } catch (e) {} }

function chooseTarget() {
  const cands = houses.filter((h) => !h.used && h.z < pz - 130 && h.z > pz - 240 && (!route.sea || h.side < 0));
  if (!cands.length) return null;
  const left = cands.filter((h) => h.side < 0); const h = (left.length && Math.random() < 0.65) ? pick(left) : pick(cands);
  h.used = true; return h;
}
function placeMarker() {
  if (!target) { beam.visible = matRing.visible = matGlow.visible = false; return; }
  beam.visible = matRing.visible = matGlow.visible = true;
  beam.position.set(target.x, 20, target.z); matRing.position.set(target.x, 0.24, target.z); matGlow.position.set(target.x, 0.23, target.z);
}
function throwKebab() {
  if (cooldown > 0 || state !== "play") return;
  const side = target ? Math.sign(target.x) : -1, range = 3 + power * 16.5, T = FLIGHT, x0 = px + side * 0.5, y0 = 1.5;
  const vy = (0.22 - y0 + 0.5 * 9.8 * T * T) / T;
  const m = new THREE.Group(); const k = new THREE.Mesh(kebabGeo, M.kebab); k.rotation.z = Math.PI / 2; m.add(k); m.position.set(x0, y0, pz); scene.add(m);
  flying.push({ m, x0, y0, z0: pz, vx: (side * range - side * 0.5) / T, vy, vz: -speed, t: 0, T });
  cooldown = 0.45; sfx.whoosh(); armSwing = 0.35 * side;
}
let armSwing = 0;
function landed(f) {
  const x = f.m.position.x, z = f.m.position.z;
  f.done = true; setTimeout(() => scene.remove(f.m), 2500);
  if (Math.abs(x) > FRONT + 0.1) { sfx.glass(); burst(Math.sign(x) * FRONT, 1.5, z, 20, 0xbfe0ff, 2.5, 2); showPop("SMASH!", "That's a window, not a doormat", "bad", 1); say(pick(SAY.window), Math.sign(x) * FRONT, z); score = Math.max(0, score - 50); return; }
  if (!target) { sfx.thud(); return; }
  const d = Math.hypot(x - target.x, z - target.z);
  let grade = null;
  if (d <= U.perfectR) grade = "perfect"; else if (d <= 1.75) grade = "good"; else if (d <= 3.3 && Math.abs(x) > PAVE - 0.4) grade = "ok";
  if (!grade) {
    const other = houses.find((h) => h !== target && Math.hypot(x - h.x, z - h.z) < 2);
    sfx.miss(); score = Math.max(0, score - 25);
    if (other) { showPop("WRONG HOUSE!", "Have another go", "bad", 1); say(pick(SAY.wrong), other.x, other.z); } else showPop("MISSED!", "Have another go", "bad", 0.9);
    return;
  }
  // a delivery!
  const base = { perfect: 500, good: 300, ok: 150 }[grade], warmth = Math.round(temp * 3), pts = Math.round((base + warmth) * mult());
  const tip = { perfect: 12, good: 8, ok: 4 }[grade] + Math.round(temp / 10);
  score += pts; tipsRun += tip; delivered++; streak++; if (grade === "perfect") perfects++;
  sfx.thud(); setTimeout(sfx.bell, 220); if (grade === "perfect") { sfx.perfect(); burst(target.x, 0.6, target.z, 40, 0xffd23a, 2.5, 5); } else burst(target.x, 0.5, target.z, 18, 0x5fe3b0, 1.8, 3);
  const label = { perfect: "PERFECT!", good: "ON THE STEP!", ok: "IN THE GARDEN" }[grade];
  showPop(label, `+${pts} · ${tip} tips${streak > 1 ? ` · ×${mult()}` : ""}`, grade === "perfect" ? "" : "good", 1.3);
  say(temp < 15 ? pick(SAY.cold) : pick(SAY[grade]), target.x, target.z);
  target = null; placeMarker(); nextTargetIn = 1.2; temp = 100;
  if (delivered + failed >= route.orders) endShift("done");
  hud();
}

// ---------------------------------------------------------------- HUD
let popT = null, sayT = null, sayAt = null;
function showPop(big, small, cls = "", dur = 1.2) { const el = $("pop"); el.className = "pop " + cls; el.innerHTML = `${big}${small ? `<small>${small}</small>` : ""}`; void el.offsetWidth; el.classList.add("on"); clearTimeout(popT); popT = setTimeout(() => el.classList.remove("on"), dur * 1100); }
function say(text, x, z) { const el = $("say"); el.textContent = text; sayAt = new THREE.Vector3(x, 2.8, z); el.classList.add("on"); clearTimeout(sayT); sayT = setTimeout(() => { el.classList.remove("on"); sayAt = null; }, 1900); }
const _p = new THREE.Vector3();
function hud() {
  $("hScore").textContent = Math.floor(score).toLocaleString("en-GB");
  const m = mult(); $("hMult").textContent = "×" + (m % 1 ? m.toFixed(1) : m); $("hMult").classList.toggle("on", m > 1);
  $("hOrders").textContent = `${delivered} / ${route.orders}`;
  $("hTemp").style.width = temp + "%"; $("hTemp").style.backgroundPosition = `${temp}% 0`;
  $("hTempTxt").textContent = temp > 70 ? "HOT" : temp > 40 ? "WARM" : temp > 15 ? "LUKEWARM" : "COLD";
  $("hTempTxt").style.color = temp > 70 ? "#FFB08A" : temp > 40 ? "#FFD27A" : temp > 15 ? "#C8D6FF" : "#7AB8FF";
  const dist = target ? Math.max(0, Math.round(pz - target.z)) : null;
  $("hDrop").textContent = target ? dist + " m" : nextTargetIn > 0 ? "…" : "—";
  $("hArrow").style.transform = target ? `rotate(${target.side < 0 ? -90 : 90}deg)` : "rotate(0)";
  $("hDropBox").classList.toggle("close", !!target && dist < 45);
  $("hDents").innerHTML = [0, 1, 2].map((i) => `<i class="${i < 3 - dents ? "" : "gone"}"></i>`).join("");
  $("hTips").textContent = tipsRun;
}

// ---------------------------------------------------------------- main update
let tHud = 0, coinSpin = 0;
function update(dt) {
  const play = state === "play", attract = state === "attract";
  if (state === "paused") return;
  // steering and speed
  if (play) {
    const steer = (input.l ? -1 : 0) + (input.r ? 1 : 0);
    vx += (steer * U.steer - vx) * Math.min(1, dt * 7);
    if (recover > 0) recover -= dt;
    const top = recover > 0 ? U.vmax * 0.5 : U.vmax;
    if (input.brake) speed = Math.max(3, speed - 15 * dt); else if (speed < top) speed += U.acc * dt * (1 - (speed / top) * 0.55); else speed = Math.max(top, speed - 6 * dt);
  } else if (attract) { vx += (0 - vx) * dt * 2; speed += (9 - speed) * dt; }
  else { speed = Math.max(0, speed - 10 * dt); vx *= 0.9; }
  slide *= Math.pow(0.12, dt); px += (vx + slide) * dt;
  if (Math.abs(px) > ROAD - 0.45) { px = Math.sign(px) * (ROAD - 0.45); if (play && Math.abs(vx) > 1.5) { burst(px, 0.3, pz, 4, 0xffd080, 1.5, 1.5); speed *= 0.985; } vx *= 0.3; }
  pz -= speed * dt; distance += speed * dt;
  if (invul > 0) invul -= dt; if (cooldown > 0) cooldown -= dt;
  recycle(); spawnTraffic(); stepTraffic(dt);

  if (play) {
    score += speed * dt * 0.2;
    temp = Math.max(0, temp - U.decay * dt);
    // road hazards
    for (const s of statics) {
      if (s.hit) continue; const dx = Math.abs(s.x - px) - s.w / 2 - 0.3, dz = Math.abs(s.z - pz) - s.l / 2 - 0.9; if (dx > 0 || dz > 0) continue;
      if (s.kind === "pothole") { s.hit = true; bounce = 0.35; speed *= 1 - 0.28 * U.grip; temp = Math.max(0, temp - 3); sfx.bump(); shake = 0.35; showPop("POTHOLE!", "Mind the kebab", "bad", 0.8); }
      else if (s.kind === "puddle") { s.hit = true; slide = (Math.random() < 0.5 ? -1 : 1) * 3.2 * U.grip; sfx.splash(); burst(px, 0.3, pz, 30, 0x9fc0ff, 2.5, 3); }
      else { s.hit = true; crash(s); }
    }
    for (const c of coins) if (!c.got && Math.abs(c.x - px) < 1.1 && Math.abs(c.z - pz) < 1.2) { c.got = true; tipsRun++; score += 15; sfx.coin(); burst(c.x, 0.9, c.z, 6, 0xffd23a, 1.2, 2); }
    // zebra crossings: someone steps out as you approach
    for (const zb of zebras) {
      if (zb.state === 0 && zb.z < pz && pz - zb.z < 75) { zb.state = 1; const s = Math.random() < 0.5 ? -1 : 1; zb.ped = { g: makePed(), x: s * 7, dir: -s, z: zb.z, t: 0 }; zb.ped.g.position.set(zb.ped.x, 0, zb.z); zb.ped.g.rotation.y = s > 0 ? Math.PI / 2 : -Math.PI / 2; scene.add(zb.ped.g); zb.ch.dyn.push(zb.ped.g); }
      if (zb.ped) { const p = zb.ped; p.t += dt; p.x += p.dir * 1.55 * dt; p.g.position.set(p.x, Math.abs(Math.sin(p.t * 8)) * 0.06, p.z); if (!p.hit && Math.abs(p.x - px) < 0.75 && Math.abs(p.z - pz) < 1.1) { p.hit = true; crash({ x: p.x, kind: "ped" }); say("OI! Watch it!", p.x, p.z); } if (Math.abs(p.x) > 9) { scene.remove(p.g); zb.ped = null; zb.state = 2; } }
    }
    // the current order
    if (!target && nextTargetIn > 0) { nextTargetIn -= dt; if (nextTargetIn <= 0) { target = chooseTarget(); if (!target) nextTargetIn = 0.3; else { placeMarker(); showPop(`ORDER ${delivered + failed + 1}`, `${route.orders - delivered - failed} to go · follow the green beam`, "good", 1.2); } } }
    if (target && pz < target.z - 9) { failed++; streak = 0; sfx.miss(); showPop("MISSED THE DROP!", "Customer's not happy", "bad", 1.3); target = null; placeMarker(); temp = 100; nextTargetIn = 0.8; if (delivered + failed >= route.orders) endShift("done"); }
    // aiming
    if (charging) { chargeT += dt; const ph = (chargeT / U.swing) % 2; power = ph < 1 ? ph : 2 - ph; drawAim(); $("powerArc").style.strokeDashoffset = String(283 * (1 - power)); }
    if (endTimer > 0) { endTimer -= dt; if (endTimer <= 0) finish(); }
  }
  // flying kebabs
  for (const f of flying) {
    if (f.done) continue; f.t += dt; const t = Math.min(f.t, f.T);
    f.m.position.set(f.x0 + f.vx * t, f.y0 + f.vy * t - 4.9 * t * t, f.z0 + f.vz * t); f.m.rotation.x += dt * 9; f.m.rotation.y += dt * 5;
    if (f.t >= f.T) landed(f);
  }
  for (let i = flying.length - 1; i >= 0; i--) if (flying[i].done && flying[i].m.position.z > pz + 30) flying.splice(i, 1);
  // ride pose
  bounce = Math.max(0, bounce - dt * 1.8);
  bike.position.set(px, Math.sin(bounce * 14) * bounce * 0.4, pz); lean.rotation.z = clamp(-vx / U.steer, -1, 1) * 0.32 + (invul > 0 ? Math.sin(invul * 30) * 0.08 : 0); lean.rotation.x = input.brake ? 0.04 : -0.01;
  armSwing *= Math.pow(0.02, dt); armR.rotation.set(-1.05 - Math.max(0, armSwing) * 4, 0, 0.2 + Math.max(0, armSwing) * 3); armL.rotation.set(-1.05 - Math.max(0, -armSwing) * 4, 0, -0.2 + Math.min(0, armSwing) * 3);
  bike.visible = !(invul > 0 && Math.floor(invul * 12) % 2 === 0 && play);
  head.position.set(px, 1.1, pz - 0.9); head.target.position.set(px + vx * 0.3, 0, pz - 18);
  // nearest street lamp washes over the rider, plus shop sign colour
  let best = 1e9; for (const l of lamps) { const d = Math.hypot(l.x - px, l.z - pz); if (d < best) best = d; }
  lampLight.position.set(px, 4.5, pz - 1); lampLight.intensity = Math.max(0, 1 - best / 14) * 55;
  let sg = null, sd = 1e9; for (const s of signsGlow) { const d = Math.abs(s.z - pz); if (d < sd) { sd = d; sg = s; } }
  if (sg && sd < 10) { glowLight.color.copy(sg.col); glowLight.intensity = (1 - sd / 10) * 30; glowLight.position.set(Math.sign(sg.x) * 7, 2.5, sg.z); } else glowLight.intensity = 0;
  for (const ch of chunks) for (const b of ch.blink) b.visible = Math.floor(performance.now() / 450) % 2 === 0;
  coinSpin += dt * 4; const touched = new Set();
  for (const c of coins) { _e.set(Math.PI / 2, 0, coinSpin); _q.setFromEuler(_e); _m.compose(_v.set(c.x, 0.9, c.z), _q, c.got ? _s.set(0, 0, 0) : _s.set(1, 1, 1)); c.inst.setMatrixAt(c.i, _m); touched.add(c.inst); }
  for (const inst of touched) inst.instanceMatrix.needsUpdate = true;
  if (matRing.visible) { const s = 1 + Math.sin(performance.now() / 180) * 0.12; matRing.scale.set(s, s, 1); }
  if (route.sea) { wheel.position.set(160, 34, pz - 260); wheel.rotation.z += dt * 0.05; sea.position.z = pz; }
  if (skyline) skyline.position.set(camera.position.x, skyline.position.y, camera.position.z);
  sky.position.copy(camera.position);
  stepParticles(dt); stepRain(dt, px, pz); stepAudio();
  tHud += dt; if (play && tHud > 0.1) { tHud = 0; hud(); }
  if (sayAt) { _p.copy(sayAt).project(camera); const el = $("say"); el.style.left = ((_p.x + 1) / 2 * innerWidth) + "px"; el.style.top = ((1 - _p.y) / 2 * innerHeight) + "px"; el.style.visibility = _p.z < 1 ? "visible" : "hidden"; }
}
function drawAim() {
  const side = target ? Math.sign(target.x) : -1, range = 3 + power * 16.5, T = FLIGHT, x0 = px + side * 0.5, y0 = 1.5, vy = (0.22 - y0 + 0.5 * 9.8 * T * T) / T, vxx = (side * range - side * 0.5) / T;
  for (let i = 0; i < 32; i++) { const t = (i / 31) * T; aimPts.set([x0 + vxx * t, y0 + vy * t - 4.9 * t * t, pz - speed * t], i * 3); }
  aimGeo.attributes.position.needsUpdate = true; aimLine.visible = true;
  const lx = px + side * range, lz = pz - speed * T; aimRing.position.set(lx, 0.28, lz); aimRing.visible = true;
  const d = target ? Math.hypot(lx - target.x, lz - target.z) : 99;
  aimRing.material.color.set(d <= U.perfectR ? 0x5fe3b0 : d <= 1.75 ? 0xffd23a : d <= 3.3 ? 0xff9a3a : 0xffffff);
}

// ---------------------------------------------------------------- camera
const camPos = new THREE.Vector3(0, 4, 30), camLook = new THREE.Vector3();
let camBias = 0;
function frameCamera(dt) {
  const P = portrait, h = P ? 4.8 : 3.0, back = P ? 7.6 : 6.2, ahead = P ? 15 : 12;
  // as the drop gets close (and while aiming) the camera turns towards the house so the doormat stays on screen
  let want_b = 0, side = 0;
  if (target && state === "play") { const d = pz - target.z; side = Math.sign(target.x); want_b = clamp(1 - (d - 12) / 55, 0, 1); }
  if (charging) want_b = Math.max(want_b, 1);
  camBias += (want_b * side - camBias) * Math.min(1, dt * 2.5);
  const want = new THREE.Vector3(px * (P ? 0.55 : 0.7) + camBias * (P ? 2.8 : 1.4), h + bounce * 0.3, pz + back);
  camPos.lerp(want, Math.min(1, dt * (state === "attract" ? 1.5 : 5)));
  camLook.set(px * (P ? 0.4 : 0.6) + camBias * (P ? 6.5 : 3.2), 1.2, pz - ahead);
  camera.position.copy(camPos);
  if (shake > 0 && save.set.shake) { camera.position.x += rnd(-1, 1) * shake * 0.35; camera.position.y += rnd(-1, 1) * shake * 0.25; }
  shake = Math.max(0, shake - dt * 2.2);
  camera.lookAt(camLook);
  const fovBase = P ? 70 : 58, kick = save.set.shake ? (speed / 20) * 7 : 0;
  camera.fov += (fovBase + kick - camera.fov) * Math.min(1, dt * 3); camera.updateProjectionMatrix();
  if (state !== "play") { aimLine.visible = aimRing.visible = false; }
}

// ---------------------------------------------------------------- shift flow
function startShift(r) {
  buildRoute(r); resetRun(); state = "play"; U = upg();
  PUB.show(null, IDS); $("hud").hidden = false; $("controls").hidden = false; $("keys").hidden = MOBILE; hud();
  audioOn(); music(true);
  setTimeout(() => { if (state === "play") showPop(r.name.toUpperCase(), `${r.orders} orders tonight · keep them hot`, "good", 1.6); }, 300);
}
function endShift(why) { if (state !== "play" || endTimer > 0) return; endTimer = why === "knackered" ? 1.3 : 1.6; endWhy = why; charging = false; aimLine.visible = aimRing.visible = false; }
let endWhy = "done";
function finish() {
  state = "over"; music(false);
  const full = delivered + failed >= route.orders && endWhy === "done";
  if (full && delivered === route.orders) score += 300;
  score = Math.floor(score);
  const s1 = endWhy === "done" && delivered >= route.orders - 1, s2 = score >= route.goal, s3 = perfects >= 3, stars = (s1 ? 1 : 0) + (s2 ? 1 : 0) + (s3 ? 1 : 0);
  const prevStars = save.stars[route.id] || 0; if (stars > prevStars) save.stars[route.id] = stars;
  save.tips += tipsRun;
  const prev = save.best; if (score > save.best) { save.best = score; if (prev > 0) PUB.record(prev, score); }
  store.set("kbDeliv", String(+(store.get("kbDeliv") || 0) + delivered)); store.set("kbPerfect", String(+(store.get("kbPerfect") || 0) + perfects));
  persist(); PUB.submit("kebab", score);
  $("oTitle").textContent = endWhy === "knackered" ? "SCOOTER'S KNACKERED" : delivered === route.orders ? "SHIFT COMPLETE!" : "SHIFT OVER";
  $("oSub").textContent = `${route.name}: ${delivered} of ${route.orders} delivered${perfects ? `, ${perfects} on the mat` : ""}.`;
  $("oScore").textContent = score.toLocaleString("en-GB"); $("oBest").textContent = save.best.toLocaleString("en-GB");
  const unlockNext = ROUTES.indexOf(route) < ROUTES.length - 1 && prevStars < 1 && stars >= 1;
  $("oSum").innerHTML = [
    [`${s1 ? "★" : "☆"} Finish the shift (deliver ${route.orders - 1}+)`, s1 ? "Done" : "Not yet", s1],
    [`${s2 ? "★" : "☆"} Score ${route.goal.toLocaleString("en-GB")}+`, s2 ? "Done" : score.toLocaleString("en-GB"), s2],
    [`${s3 ? "★" : "☆"} 3 doormat perfects`, `${perfects} of 3`, s3],
    ["Tips earned", `+${tipsRun}`, true], ["Near misses", nearMisses, true], ["Crashes", crashes, crashes === 0],
  ].map(([a, b, ok]) => `<div><span>${a}</span><b class="${ok ? "g" : "x"}">${b}</b></div>`).join("") + (unlockNext ? `<div><span>🔓 Unlocked</span><b class="g">${ROUTES[ROUTES.indexOf(route) + 1].name}</b></div>` : "");
  [...$("oStars").children].forEach((el, i) => { el.classList.remove("on"); setTimeout(() => { el.classList.toggle("on", i < stars); if (i < stars) PUB.beep(880 + i * 220, 880 + i * 220, 0.15, "triangle", 0.06); }, 300 + i * 260); });
  $("again").textContent = delivered === route.orders && unlockNext ? "NEXT ROUTE" : "GO AGAIN";
  $("again").dataset.next = delivered === route.orders && unlockNext ? "1" : "";
  $("hud").hidden = true; $("controls").hidden = true; $("keys").hidden = true;
  if (stars === 3) PUB.fanfare(); else if (stars === 0) PUB.sad();
  setTimeout(() => PUB.show("over", IDS), 250);
  setTimeout(() => { state = state === "over" ? "attract" : state; }, 400);
}

// ---------------------------------------------------------------- menus
const IDS = ["gate", "start", "routes", "garage", "how", "pause", "over"];
function openTitle() { state = "attract"; $("bestTxt").textContent = save.best.toLocaleString("en-GB"); $("tipsTxt").textContent = save.tips; $("starsTxt").textContent = Object.values(save.stars).reduce((a, b) => a + b, 0) + " / 12"; PUB.show("start", IDS); }
const THUMB = { estate: "/img/kebab/route-estate.webp", high: "/img/kebab/route-high.webp", city: "/img/kebab/route-city.webp", seaside: "/img/kebab/route-seaside.webp" };
function openRoutes() {
  $("rgrid").innerHTML = ROUTES.map((r, i) => { const st = save.stars[r.id] || 0, open = unlocked(i);
    return `<button type="button" class="rcard${open ? "" : " locked"}" data-r="${i}" ${open ? "" : "aria-disabled=\"true\""}><img src="${THUMB[r.id]}" alt="">${open ? "" : `<span class="lock">🔒 Get a star on<br>${ROUTES[i - 1].name}</span>`}<span class="rt"><b>${r.name}</b><small>${r.blurb}</small><span class="rs">${[0, 1, 2].map((k) => (k < st ? "<i>★</i>" : "★")).join("")}</span><small class="goals">${r.orders} orders · goal ${r.goal.toLocaleString("en-GB")}</small></span></button>`; }).join("");
  PUB.show("routes", IDS);
}
$("rgrid").addEventListener("click", (e) => { const b = e.target.closest("[data-r]"); if (!b) return; const i = +b.dataset.r; if (!unlocked(i)) { PUB.beep(200, 150, 0.15, "square", 0.04); return; } PUB.pop(); startShift(ROUTES[i]); });
function openGarage() {
  $("gTips").textContent = save.tips;
  $("ulist").innerHTML = UPG.map((u) => { const l = lvl(u.k), cost = UCOST[l]; return `<div class="urow"><b>${u.n}</b><small>${u.d}</small><span class="pips">${[0, 1, 2, 3].map((i) => `<i class="${i < l ? "on" : ""}"></i>`).join("")}</span><button type="button" data-u="${u.k}" ${l >= 4 || save.tips < cost ? "disabled" : ""}>${l >= 4 ? "MAX" : `<span class="coin"></span>${cost}`}</button></div>`; }).join("");
  $("helmets").innerHTML = HELMETS.map((h) => { const own = save.owned.includes(h.k); return `<button type="button" data-h="${h.k}" class="${save.helmet === h.k ? "on" : ""}${own ? "" : " locked"}" style="--hc:${h.c}"><i></i>${own ? h.n : h.cost + " tips"}</button>`; }).join("");
  PUB.show("garage", IDS);
}
$("ulist").addEventListener("click", (e) => { const b = e.target.closest("[data-u]"); if (!b || b.disabled) return; const k = b.dataset.u, l = lvl(k), c = UCOST[l]; if (l >= 4 || save.tips < c) return; save.tips -= c; save.up[k] = l + 1; persist(); PUB.beep(1200, 1800, 0.12, "triangle", 0.06); PUB.beep(1800, 2400, 0.15, "triangle", 0.05, 0.1); openGarage(); });
$("helmets").addEventListener("click", (e) => { const b = e.target.closest("[data-h]"); if (!b) return; const h = HELMETS.find((x) => x.k === b.dataset.h); if (!save.owned.includes(h.k)) { if (save.tips < h.cost) { PUB.beep(200, 150, 0.15, "square", 0.04); return; } save.tips -= h.cost; save.owned.push(h.k); } save.helmet = h.k; setHelmet(); persist(); PUB.pop(); openGarage(); });
let garageReturn = "start";
$("playBtn").addEventListener("click", () => { audioOn(); PUB.pop(); if (!store.get("kbHow")) { store.set("kbHow", "1"); howReturn = "routes"; PUB.show("how", IDS); } else openRoutes(); });
$("garageBtn").addEventListener("click", () => { garageReturn = "start"; openGarage(); });
$("garageBack").addEventListener("click", () => (garageReturn === "over" ? PUB.show("over", IDS) : openTitle()));
let howReturn = "start";
$("howBtn").addEventListener("click", () => { howReturn = "start"; PUB.show("how", IDS); });
$("howOk").addEventListener("click", () => (howReturn === "routes" ? openRoutes() : openTitle()));
$("routesBack").addEventListener("click", openTitle);
$("again").addEventListener("click", () => { const i = ROUTES.indexOf(route); startShift($("again").dataset.next ? ROUTES[i + 1] : route); });
$("toRoutes").addEventListener("click", openRoutes);
$("toGarage").addEventListener("click", () => { garageReturn = "over"; openGarage(); });
$("share").addEventListener("click", () => PUB.share(`I scored ${Math.floor(score).toLocaleString("en-GB")} on Kebab Run 🥙🛵 Think you can deliver better?`, $("shareMsg")));
// pause + settings
function pause() { if (state !== "play" || endTimer > 0) return; state = "paused"; charging = false; $("throwBtn").classList.remove("on"); syncSettings(); PUB.show("pause", IDS); music(false); }
function resume() { if (state !== "paused") return; state = "play"; PUB.show(null, IDS); music(true); }
$("pauseBtn").addEventListener("click", pause); $("resumeBtn").addEventListener("click", resume);
$("restartBtn").addEventListener("click", () => { state = "attract"; startShift(route); });
$("quitBtn").addEventListener("click", () => { state = "attract"; $("hud").hidden = $("controls").hidden = $("keys").hidden = true; music(false); resetRun(); openTitle(); });
function syncSettings() { $("setMusic").checked = save.set.music; $("setRain").checked = save.set.rain; $("setShake").checked = save.set.shake; $("setHi").checked = save.set.hi; }
for (const [id, k] of [["setMusic", "music"], ["setRain", "rain"], ["setShake", "shake"], ["setHi", "hi"]]) $(id).addEventListener("change", (e) => { save.set[k] = e.target.checked; persist(); if (k === "hi") { setPR(); fit(); } });
PUB.wireMute($("mute"));
document.addEventListener("visibilitychange", () => { if (document.hidden) pause(); });

// ---------------------------------------------------------------- input
const hold = (el, key) => {
  const on = (e) => { e.preventDefault(); input[key] = true; el.classList.add("on"); }, off = (e) => { e && e.preventDefault(); input[key] = false; el.classList.remove("on"); };
  el.addEventListener("pointerdown", (e) => { try { el.setPointerCapture(e.pointerId); } catch (x) {} on(e); }); el.addEventListener("pointerup", off); el.addEventListener("pointercancel", off); el.addEventListener("lostpointercapture", () => off());
};
hold($("leftBtn"), "l"); hold($("rightBtn"), "r"); hold($("brakeBtn"), "brake");
const tb = $("throwBtn");
function startCharge() { if (state !== "play" || cooldown > 0 || charging) return; charging = true; chargeT = 0; power = 0; tb.classList.add("on"); sfx.tick(); }
function release() { if (!charging) return; charging = false; tb.classList.remove("on"); $("powerArc").style.strokeDashoffset = "283"; aimLine.visible = aimRing.visible = false; throwKebab(); }
tb.addEventListener("pointerdown", (e) => { e.preventDefault(); try { tb.setPointerCapture(e.pointerId); } catch (x) {} startCharge(); });
tb.addEventListener("pointerup", (e) => { e.preventDefault(); release(); }); tb.addEventListener("pointercancel", release);
addEventListener("keydown", (e) => {
  if (e.repeat) return; const k = e.key.toLowerCase();
  if (k === "arrowleft" || k === "a") input.l = true; else if (k === "arrowright" || k === "d") input.r = true; else if (k === "arrowdown" || k === "s") input.brake = true;
  else if (k === " ") { e.preventDefault(); startCharge(); } else if (k === "p" || k === "escape") { if (state === "play") pause(); else if (state === "paused") resume(); }
});
addEventListener("keyup", (e) => { const k = e.key.toLowerCase(); if (k === "arrowleft" || k === "a") input.l = false; else if (k === "arrowright" || k === "d") input.r = false; else if (k === "arrowdown" || k === "s") input.brake = false; else if (k === " ") release(); });

// ---------------------------------------------------------------- loop
let last = performance.now(), fpsT = 0, frames = 0, slowFor = 0;
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  for (let i = 0; i < (window.__krSteps || 1); i++) update(dt); frameCamera(dt); renderer.render(scene, camera);   // __krSteps: test-only fast-forward
  frames++; fpsT += dt; if (fpsT > 1) { const fps = frames / fpsT; frames = 0; fpsT = 0; slowFor = fps < 38 ? slowFor + 1 : 0; if (slowFor >= 3 && save.set.hi) { save.set.hi = false; persist(); setPR(); fit(); } }
  requestAnimationFrame(loop);
}
buildRoute(ROUTES[0]); resetRun(); state = "attract"; speed = 8;
requestAnimationFrame((t) => { last = t; loop(t); setTimeout(() => $("loading").classList.add("done"), 300); });
PUB.gate(openTitle);
// a tiny hook for automated checks
window.__kr = { get: () => ({ state, px, pz, speed, temp, score, delivered, failed, dents, perfects, target, tips: tipsRun, traffic: traffic.length, statics: statics.length, houses: houses.length }), start: (i) => startShift(ROUTES[i]), set: (o) => { if ("px" in o) px = o.px; if ("speed" in o) speed = o.speed; if ("power" in o) power = o.power; if ("invul" in o) invul = o.invul; }, throwNow: (p) => { power = p; throwKebab(); }, ROUTES, scene, camera, renderer, pause, resume, input, preview: (i) => { buildRoute(ROUTES[i]); resetRun(); state = "attract"; speed = 9; } };
