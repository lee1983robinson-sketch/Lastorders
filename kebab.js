// Kebab Run 2: open-world delivery. Robbo's Game Lab.
// A small British town built in code with three.js r160: ride anywhere, take Uber-style orders,
// collect from the takeaway, follow the sat-nav and land the kebab on the doormat.
//
// Town layout (metres): a 6 × 6 grid of blocks. Roads run along x = roadX(k) and z = roadX(l), k,l = 0..6.
// Each block is 36 m square (pavement 3 m round the edge), roads are 10 m wide, so the pitch is 46 m.
// Heading h: 0 faces -z (north), +π/2 faces +x (east). forward = (sin h, -cos h). UK: traffic keeps left.
import * as THREE from "/vendor/three.module.min.js";
import { EffectComposer } from "/vendor/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "/vendor/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "/vendor/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "/vendor/jsm/postprocessing/OutputPass.js";
import { ShaderPass } from "/vendor/jsm/postprocessing/ShaderPass.js";
import { Reflector } from "/vendor/jsm/objects/Reflector.js";
import { RoundedBoxGeometry } from "/vendor/jsm/geometries/RoundedBoxGeometry.js";

// if the browser served an old copy of the page with this new script, reload once to get the matching page
if (!document.getElementById("lever")) { try { if (!sessionStorage.getItem("reloaded-lever")) { sessionStorage.setItem("reloaded-lever", "1"); location.replace(location.pathname + "?v=" + Date.now()); } } catch (e) {} throw new Error("stale page"); }
const PUB = window.PUB;
const $ = (id) => document.getElementById(id);
const store = PUB.store;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, t) => a + (b - a) * t;
const rnd = (a, b) => a + Math.random() * (b - a), pick = (a) => a[Math.floor(Math.random() * a.length)], chance = (p) => Math.random() < p;
const wrap = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
const J = (k, d) => { try { return JSON.parse(store.get(k) || "") ?? d; } catch (e) { return d; } };
const MOBILE = matchMedia("(pointer: coarse)").matches;
const REDUCED = PUB.REDUCED;
// the town is the same every time (seeded), so players learn the streets
let seed = 20261118; const SR = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const srnd = (a, b) => a + SR() * (b - a), spick = (a) => a[Math.floor(SR() * a.length)], schance = (p) => SR() < p;

// ---------------------------------------------------------------- game data
const N = 6, PITCH = 46, RW = 10, BS = PITCH - RW, PV = 3, FR = BS / 2 - PV, LANE = 2.0, EDGE = N * PITCH / 2 + RW / 2 - 0.6;
const roadX = (k) => (k - N / 2) * PITCH;                 // centre line of road k
const blockC = (i) => (i - (N - 1) / 2) * PITCH;          // centre of block i
const SHIFT = 300;                                        // seconds in a shift
const GOALS = [15, 30, 45];                               // £ for one, two, three stars
const COLS = ["Mill Lane", "Albert Road", "Victoria Street", "High Street", "Station Road", "Church Lane", "Park Road"];
const ROWS = ["Nelson Road", "Canal Street", "King Street", "Market Street", "Queen Street", "Wellington Road", "Princes Avenue"];
const WEATHERS = [
  { k: "clear", n: "Clear night", icon: "🌙", w: 3, rain: 0, wet: 0, fog: 0.0055, sky: "night" },
  { k: "dusk", n: "Evening", icon: "🌆", w: 3, rain: 0, wet: 0, fog: 0.0048, sky: "dusk" },
  { k: "cloudy", n: "Cloudy", icon: "☁️", w: 2, rain: 0, wet: 0.15, fog: 0.0075, sky: "cloud" },
  { k: "fog", n: "Foggy", icon: "🌫️", w: 1, rain: 0, wet: 0.35, fog: 0.026, sky: "fog" },
  { k: "drizzle", n: "Drizzle", icon: "🌦️", w: 1.4, rain: 0.35, wet: 0.75, fog: 0.009, sky: "cloud" },
  { k: "rain", n: "Downpour", icon: "🌧️", w: 0.9, rain: 1, wet: 1, fog: 0.013, sky: "storm" },
];
const UPG = [
  { k: "engine", n: "Engine", d: "Higher top speed and quicker pick-up" },
  { k: "handling", n: "Handling", d: "Sharper steering round corners" },
  { k: "box", n: "Insulated box", d: "Food stays hot for longer" },
  { k: "arm", n: "Throwing arm", d: "Bigger doormat sweet spot, slower power swing" },
  { k: "tyres", n: "Tyres", d: "Better grip in the wet and fewer dents" },
];
const UCOST = [80, 170, 320, 520];
const HELMETS = [{ k: "red", n: "Red", c: "#D3262E", cost: 0 }, { k: "blue", n: "Blue", c: "#2E6BD3", cost: 60 }, { k: "black", n: "Stealth", c: "#1E222C", cost: 90 }, { k: "green", n: "Green", c: "#2EA95A", cost: 120 }, { k: "gold", n: "Gold", c: "#E8B42A", cost: 400 }];
const SAY = {
  perfect: ["Get in! Perfect!", "Absolute legend!", "Cheers pal!", "On the mat! Lovely!"],
  good: ["Ta very much!", "Nice one!", "Lovely, cheers!"],
  ok: ["In the hedge? Really?", "Bit rough, but ta.", "Next time knock, eh?"],
  cold: ["It's stone cold!", "Took your time!"],
  window: ["MY WINDOW!", "Oi! That's double glazing!"],
  wrong: ["I didn't order this!", "Wrong house, mate!"],
};
const MENU = [["Large doner, chips", "2 × cans"], ["Mixed kebab", "garlic mayo"], ["Chicken shish", "salad, chilli sauce"], ["Doner meat & chips", "cheese on top"], ["Fish & chips", "mushy peas"], ["Large pepperoni", "garlic bread"], ["Chicken tikka", "pilau rice, naan"], ["Kebab meal deal", "bottle of pop"]];

let save = {
  best: +(store.get("kbBest") || 0), tips: +(store.get("kbTips") || 0), up: J("kbUp", {}), stars: J("kbStars", {}),
  helmet: store.get("kbHelmet") || "red", owned: J("kbOwned", ["red"]),
  set: Object.assign({ music: true, shake: !REDUCED, hi: !MOBILE, fx: true, weather: "random" }, J("kbSet", {})),
};
const lvl = (k) => save.up[k] || 0;
function persist() {
  store.set("kbBest", String(save.best)); store.set("kbTips", String(save.tips)); store.set("kbUp", JSON.stringify(save.up)); store.set("kbStars", JSON.stringify(save.stars));
  store.set("kbHelmet", save.helmet); store.set("kbOwned", JSON.stringify(save.owned)); store.set("kbSet", JSON.stringify(save.set));
}

// ---------------------------------------------------------------- renderer, scene, camera, post
const cv = $("game");
const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: (devicePixelRatio || 1) < 2, powerPreference: "high-performance" });
const setPR = () => renderer.setPixelRatio(Math.min(devicePixelRatio || 1, save.set.hi ? (MOBILE ? 1.75 : 2) : (MOBILE ? 1.15 : 1)));
setPR();
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.4;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x1a2030, 0.006);
const camera = new THREE.PerspectiveCamera(56, 1, 0.1, 420);
let portrait = true;
const GradeShader = {
  uniforms: { tDiffuse: { value: null }, uSpeed: { value: 0 }, uVig: { value: 0.5 } },
  vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uSpeed, uVig; varying vec2 vUv;
  void main(){ vec2 c = vUv - 0.5; float r = length(c); vec3 col = texture2D(tDiffuse, vUv).rgb;
    if (uSpeed > 0.02) { float k = uSpeed * 0.03 * smoothstep(0.2, 0.75, r); vec3 acc = col; for (int i = 1; i < 5; i++) acc += texture2D(tDiffuse, vUv - c * k * float(i)).rgb; col = acc / 5.0; }
    col *= 1.0 - uVig * smoothstep(0.35, 0.95, r); gl_FragColor = vec4(col, 1.0); }`,
};
let composer = null, bloom = null, grade = null;
try {
  composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType }));
  composer.addPass(new RenderPass(scene, camera));
  bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.42, 0.4, 1.0); composer.addPass(bloom);
  grade = new ShaderPass(GradeShader); composer.addPass(grade); composer.addPass(new OutputPass());
} catch (e) { composer = null; }
function fit() {
  const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; portrait = w / h < 0.9; camera.updateProjectionMatrix();
  if (composer) { const pr = renderer.getPixelRatio(); composer.setPixelRatio(pr); composer.setSize(w, h); bloom.setSize(Math.round(w * pr * 0.5), Math.round(h * pr * 0.5)); }
  if (mirror) mirror.getRenderTarget().setSize(Math.round(w * renderer.getPixelRatio() * 0.4), Math.round(h * renderer.getPixelRatio() * 0.4));
}
addEventListener("resize", () => fit());

const hemi = new THREE.HemisphereLight(0x5a6a96, 0x2a2018, 1.1); scene.add(hemi);
const moon = new THREE.DirectionalLight(0x9ab0e0, 0.6); moon.position.set(30, 40, 20); scene.add(moon); scene.add(moon.target);
moon.castShadow = true; moon.shadow.mapSize.set(1024, 1024); moon.shadow.bias = -0.0006; moon.shadow.normalBias = 0.04;
Object.assign(moon.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22, near: 1, far: 120 });
const LAMPS_LIVE = []; for (let i = 0; i < 6; i++) { const l = new THREE.PointLight(0xffc890, 0, 24, 2); scene.add(l); LAMPS_LIVE.push(l); }

// ---------------------------------------------------------------- textures drawn in code
function ctex(w, h, draw, opt = {}) {
  const c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d"); draw(g, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = opt.linear ? THREE.NoColorSpace : THREE.SRGBColorSpace; t.anisotropy = 8;
  if (opt.repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
// draw colour and height together; the normal map (fake bumps for lighting) comes from the height
function ptex(w, h, draw) {
  const c = document.createElement("canvas"), hc = document.createElement("canvas"); c.width = hc.width = w; c.height = hc.height = h;
  const g = c.getContext("2d"), hg = hc.getContext("2d"); hg.fillStyle = "#808080"; hg.fillRect(0, 0, w, h); draw(g, hg, w, h);
  const src = hg.getImageData(0, 0, w, h).data, out = g.createImageData(w, h), H = (x, y) => src[(((y + h) % h) * w + ((x + w) % w)) * 4] / 255;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const dx = (H(x + 1, y) - H(x - 1, y)) * 2.5, dy = (H(x, y + 1) - H(x, y - 1)) * 2.5, l = Math.hypot(dx, dy, 1), i = (y * w + x) * 4; out.data[i] = (-dx / l * 0.5 + 0.5) * 255; out.data[i + 1] = (dy / l * 0.5 + 0.5) * 255; out.data[i + 2] = (1 / l * 0.5 + 0.5) * 255; out.data[i + 3] = 255; }
  const nc = document.createElement("canvas"); nc.width = w; nc.height = h; nc.getContext("2d").putImageData(out, 0, 0);
  const map = new THREE.CanvasTexture(c), nm = new THREE.CanvasTexture(nc); map.colorSpace = THREE.SRGBColorSpace; nm.colorSpace = THREE.NoColorSpace;
  for (const t of [map, nm]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; } return { map, nm };
}
const speck = (g, w, h, n, cols, a = 0.5, s = 2) => { for (let i = 0; i < n; i++) { g.globalAlpha = Math.random() * a; g.fillStyle = pick(cols); g.fillRect(Math.random() * w, Math.random() * h, Math.random() * s + 0.5, Math.random() * s + 0.5); } g.globalAlpha = 1; };
const brickT = ptex(256, 256, (g, hg, w, h) => { g.fillStyle = "#8a8580"; g.fillRect(0, 0, w, h); hg.fillStyle = "#303030"; hg.fillRect(0, 0, w, h); const bw = 32, bh = 11;
  for (let r = 0; r * bh < h; r++) for (let x = -(r % 2) * bw / 2; x < w; x += bw) { const v = 200 + Math.random() * 55 | 0; g.fillStyle = `rgb(${v},${v - 6},${v - 10})`; g.fillRect(x + 1, r * bh + 1, bw - 2, bh - 2); hg.fillStyle = "#d8d8d8"; hg.fillRect(x + 1.5, r * bh + 1.5, bw - 3, bh - 3); }
  speck(g, w, h, 6000, ["#000", "#fff", "#6a5a50"], 0.25); speck(hg, w, h, 3000, ["#000", "#fff"], 0.3); });
const slateT = ptex(256, 256, (g, hg, w, h) => { g.fillStyle = "#262830"; g.fillRect(0, 0, w, h); for (let r = 0; r * 16 < h; r++) for (let x = -(r % 2) * 13; x < w; x += 26) { const v = 40 + Math.random() * 22 | 0; g.fillStyle = `rgb(${v},${v + 2},${v + 9})`; g.fillRect(x + 1, r * 16 + 1, 24, 14); const gr = hg.createLinearGradient(0, r * 16, 0, r * 16 + 16); gr.addColorStop(0, "#505050"); gr.addColorStop(1, "#d0d0d0"); hg.fillStyle = gr; hg.fillRect(x + 1, r * 16, 24, 16); } });
const paveT = ptex(256, 256, (g, hg, w, h) => { g.fillStyle = "#3a3a40"; g.fillRect(0, 0, w, h); hg.fillStyle = "#202020"; hg.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 64) for (let x = 0; x < w; x += 64) { const v = 86 + Math.random() * 26 | 0; g.fillStyle = `rgb(${v},${v},${v + 5})`; g.fillRect(x + 1, y + 1, 62, 62); hg.fillStyle = "#c8c8c8"; hg.fillRect(x + 1.5, y + 1.5, 61, 61); } speck(g, w, h, 9000, ["#000", "#999", "#222"], 0.3); speck(hg, w, h, 3000, ["#000", "#fff"], 0.3); });
const asphT = ptex(512, 512, (g, hg, w, h) => { g.fillStyle = "#2a2b2f"; g.fillRect(0, 0, w, h); speck(g, w, h, 40000, ["#383a3e", "#1c1d20", "#46474c", "#141416"], 0.8, 2.2); speck(hg, w, h, 26000, ["#fff", "#000"], 0.5, 2.2);
  for (let i = 0; i < 5; i++) { g.fillStyle = "rgba(14,14,16,.28)"; g.beginPath(); g.ellipse(Math.random() * w, Math.random() * h, rnd(30, 90), rnd(10, 40), Math.random() * 3, 0, 7); g.fill(); } });
const puddleT = ctex(256, 256, (g, w, h) => { g.fillStyle = "#dcdcdc"; g.fillRect(0, 0, w, h); for (let i = 0; i < 26; i++) { const x = Math.random() * w, y = Math.random() * h, r = rnd(8, 40); const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, "rgba(30,30,30,1)"); gr.addColorStop(0.7, "rgba(50,50,50,.9)"); gr.addColorStop(1, "rgba(220,220,220,0)"); g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, r, r * rnd(0.35, 0.8), Math.random() * 3, 0, 7); g.fill(); } }, { repeat: true, linear: true });
const grassT = ctex(256, 256, (g, w, h) => { g.fillStyle = "#1c2a18"; g.fillRect(0, 0, w, h); speck(g, w, h, 12000, ["#2a3a22", "#141e12", "#34482a"], 0.7, 2); }, { repeat: true });
const radial = ctex(128, 128, (g, w) => { const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.22, "rgba(255,255,255,.45)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, w, w); });
const shadowTex = ctex(128, 128, (g, w) => { const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); gr.addColorStop(0, "rgba(0,0,0,.7)"); gr.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = gr; g.fillRect(0, 0, w, w); });
const beamTex = ctex(16, 128, (g, w, h) => { const gr = g.createLinearGradient(0, h, 0, 0); gr.addColorStop(0, "rgba(255,255,255,.7)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
const plateTex = (t) => ctex(256, 56, (g) => { g.fillStyle = "#f2c418"; g.fillRect(0, 0, 256, 56); g.fillStyle = "#1a3a9a"; g.fillRect(0, 0, 26, 56); g.fillStyle = "#111"; g.font = "bold 38px Arial, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(t, 140, 30); });
const boxTex = ctex(256, 200, (g, w, h) => { g.fillStyle = "#c8101a"; g.fillRect(0, 0, w, h); g.fillStyle = "#fff"; g.font = "800 66px 'Barlow Condensed', Impact, sans-serif"; g.textAlign = "center"; g.fillText("KEBAB", w / 2, 92); g.fillText("RUN", w / 2, 156); g.fillStyle = "#FFC64D"; g.fillRect(0, h - 12, w, 6); });
const kebabTex = ctex(128, 64, (g, w, h) => { g.fillStyle = "#D9D3C4"; g.fillRect(0, 0, w, h); speck(g, w, h, 500, ["#bfb7a6", "#efe9dc"], 0.5); g.fillStyle = "#C81E28"; g.fillRect(0, h * 0.42, w, h * 0.22); });

// one shared atlas for every shop sign, interior and street sign (one material, one draw call per area)
const SIGNS = [["KEBAB HOUSE", "#b8101a", "#fff", "BURGERS · PIZZAS · KEBABS"], ["THE CHIPPY", "#1446a8", "#fff", "FISH & CHIPS"], ["PIZZA PALACE", "#1a6a2a", "#fff", "OPEN TILL LATE"], ["CURRY HOUSE", "#5a1a7a", "#ffd23a", "INDIAN TAKEAWAY"],
  ["THE RED LION", "#0f3a24", "#e8c36a", "FREE HOUSE"], ["THE CROWN", "#4a0e14", "#e8c36a", "REAL ALES"], ["OFF LICENCE", "#1e8a3a", "#fff", "BEERS · WINES · SPIRITS"], ["BARBERS", "#1a1a1a", "#fff", "WALK-INS WELCOME"],
  ["LAUNDERETTE", "#2ba8c8", "#fff", "SERVICE WASH"], ["CORNER SHOP", "#e8762e", "#fff", "NEWS · GROCERIES"], ["BOOKIES", "#0a2a6a", "#ffd23a", "BET HERE"], ["NAILS", "#d83a9a", "#fff", "BEAUTY BAR"],
  ["CAFE", "#6a4a2a", "#fff", "ALL DAY BREAKFAST"], ["CHEMIST", "#1a7a5a", "#fff", "PHARMACY"], ["CHARITY SHOP", "#5a6a7a", "#fff", "DONATIONS WELCOME"], ["VAPE SHOP", "#2a2a5a", "#7ae8ff", "E-LIQUIDS"]];
const atlasCanvas = document.createElement("canvas"); atlasCanvas.width = 1024; atlasCanvas.height = 1024;
{
  const g = atlasCanvas.getContext("2d"); g.fillStyle = "#000"; g.fillRect(0, 0, 1024, 1024);
  SIGNS.forEach(([n, bg, fg, sub], i) => { const x = (i % 2) * 512, y = Math.floor(i / 2) * 80; g.fillStyle = bg; g.fillRect(x, y, 512, 80); g.fillStyle = "rgba(255,255,255,.08)"; g.fillRect(x, y, 512, 6);
    g.fillStyle = fg; g.textAlign = "center"; g.textBaseline = "middle"; g.font = `800 ${n.length > 11 ? 44 : 50}px 'Barlow Condensed', Impact, sans-serif`; g.fillText(n, x + 256, y + 34); g.font = "700 15px Inter, Arial, sans-serif"; g.globalAlpha = 0.85; g.fillText(sub, x + 256, y + 66); g.globalAlpha = 1; });
  const inter = [["#fff0d0", "#c8803a", "counter"], ["#ffd8a0", "#7a3a1a", "bar"], ["#f0f4ff", "#8090a0", "shelves"], ["#e8f8ff", "#6aa0c0", "machines"]];
  inter.forEach(([a, b, kind], i) => { const x = i * 256, y = 640; const gr = g.createLinearGradient(0, y, 0, y + 256); gr.addColorStop(0, a); gr.addColorStop(1, b); g.fillStyle = gr; g.fillRect(x, y, 256, 256);
    g.fillStyle = "rgba(30,20,10,.7)";
    if (kind === "counter") { g.fillRect(x, y + 170, 256, 86); for (let k = 0; k < 4; k++) { g.fillStyle = "#1a1a1a"; g.fillRect(x + 10 + k * 62, y + 18, 54, 36); g.fillStyle = "#ffd060"; g.fillRect(x + 14 + k * 62, y + 24, 30, 5); g.fillRect(x + 14 + k * 62, y + 36, 40, 4); } g.fillStyle = "#b8642a"; g.fillRect(x + 196, y + 70, 22, 90); g.fillStyle = "rgba(20,10,5,.85)"; g.beginPath(); g.arc(x + 110, y + 118, 15, 0, 7); g.fill(); g.fillRect(x + 92, y + 132, 36, 40); }
    if (kind === "bar") { g.fillRect(x, y + 160, 256, 96); for (let k = 0; k < 12; k++) { g.fillStyle = pick(["#3a7a3a", "#8a2a2a", "#c8a03a", "#e8e8e8"]); g.fillRect(x + 12 + k * 20, y + 50, 10, 34); } for (let k = 0; k < 3; k++) { g.fillStyle = "rgba(20,10,5,.85)"; g.beginPath(); g.arc(x + 50 + k * 70, y + 130, 13, 0, 7); g.fill(); g.fillRect(x + 36 + k * 70, y + 142, 28, 30); } }
    if (kind === "shelves") for (let r = 0; r < 4; r++) { g.fillStyle = "rgba(60,50,40,.6)"; g.fillRect(x + 8, y + 40 + r * 50, 240, 5); for (let k = 0; k < 20; k++) { g.fillStyle = pick(["#c83a3a", "#3a7ac8", "#e8c83a", "#3aa85a", "#e8e8e8"]); g.fillRect(x + 10 + k * 12, y + 22 + r * 50, 9, 18); } }
    if (kind === "machines") for (let k = 0; k < 4; k++) { g.fillStyle = "#f0f0f0"; g.fillRect(x + 8 + k * 62, y + 120, 56, 110); g.fillStyle = "#203040"; g.beginPath(); g.arc(x + 36 + k * 62, y + 170, 20, 0, 7); g.fill(); }
  });
  // 20 zone sign, TELEPHONE strip, bus stop flag, street name plate blank
  g.fillStyle = "#fff"; g.fillRect(0, 896, 128, 128); g.strokeStyle = "#d01822"; g.lineWidth = 14; g.beginPath(); g.arc(64, 950, 42, 0, 7); g.stroke(); g.fillStyle = "#111"; g.font = "800 44px Arial"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("20", 64, 952); g.font = "800 18px Arial"; g.fillText("ZONE", 64, 1010);
  g.fillStyle = "#f4f4ea"; g.fillRect(128, 896, 256, 56); g.fillStyle = "#111"; g.font = "800 34px Arial"; g.fillText("TELEPHONE", 256, 926);
  g.fillStyle = "#d01822"; g.fillRect(128, 960, 128, 64); g.fillStyle = "#fff"; g.beginPath(); g.arc(192, 992, 22, 0, 7); g.fill(); g.fillStyle = "#111"; g.font = "800 18px Arial"; g.fillText("BUS", 192, 993);
}
const atlasTex = new THREE.CanvasTexture(atlasCanvas); atlasTex.colorSpace = THREE.SRGBColorSpace; atlasTex.anisotropy = 8;
const AT = (x, y, w, h) => [w / 1024, h / 1024, x / 1024, 1 - (y + h) / 1024];
const signUV = (i) => AT((i % 2) * 512, Math.floor(i / 2) * 80, 512, 80), interUV = (i) => AT(i * 256 + 8, 648, 240, 240);

// ---------------------------------------------------------------- materials
const BOX = new THREE.BoxGeometry(1, 1, 1), PLANE = new THREE.PlaneGeometry(1, 1), CYL = new THREE.CylinderGeometry(0.5, 0.5, 1, 12), SPH = new THREE.SphereGeometry(0.5, 16, 12), CONE = new THREE.ConeGeometry(0.5, 1, 12);
const RBOX = new RoundedBoxGeometry(1, 1, 1, 3, 0.18);
const ROOF = (() => { // unit pitched roof, ridge along x, base 1 × 1, height 1, front slope faces +z
  const g = new THREE.BufferGeometry(), p = [], u = [], q = (a, b, c, ua, ub, uc) => { p.push(...a, ...b, ...c); u.push(...ua, ...ub, ...uc); };
  const A = [-.5, 0, .5], B = [.5, 0, .5], C = [.5, 1, 0], D = [-.5, 1, 0], E = [-.5, 0, -.5], F = [.5, 0, -.5];
  q(A, B, C, [0, 0], [1, 0], [1, 1]); q(A, C, D, [0, 0], [1, 1], [0, 1]); q(F, E, D, [0, 0], [1, 0], [1, 1]); q(F, D, C, [0, 0], [1, 1], [0, 1]); q(E, A, D, [0, 0], [1, 0], [.5, 1]); q(B, F, C, [0, 0], [1, 0], [.5, 1]);
  g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(u, 2)); g.computeVertexNormals(); return g; })();
const M = {
  brick: new THREE.MeshStandardMaterial({ map: brickT.map, normalMap: brickT.nm, vertexColors: true, roughness: 0.88, envMapIntensity: 0.3 }),
  slate: new THREE.MeshStandardMaterial({ map: slateT.map, normalMap: slateT.nm, vertexColors: true, roughness: 0.55, metalness: 0.1, envMapIntensity: 0.6 }),
  pave: new THREE.MeshStandardMaterial({ map: paveT.map, normalMap: paveT.nm, vertexColors: true, roughness: 0.6, envMapIntensity: 0.5 }),
  plain: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.65, envMapIntensity: 0.5 }),
  shiny: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.25, metalness: 0.6, envMapIntensity: 1.1 }),
  glass: new THREE.MeshStandardMaterial({ color: 0x0a0e16, roughness: 0.04, metalness: 0.9, envMapIntensity: 1.6 }),
  lights: new THREE.MeshBasicMaterial({ vertexColors: true }),
  signs: new THREE.MeshBasicMaterial({ map: atlasTex, vertexColors: true }),
  paint: new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.28, metalness: 0.55, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 1.3 }),
  tyre: new THREE.MeshStandardMaterial({ color: 0x0c0c0e, roughness: 0.9 }),
  grass: new THREE.MeshStandardMaterial({ map: grassT, vertexColors: true, roughness: 1 }),
  glow: new THREE.MeshBasicMaterial({ map: radial, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -4 }),
  beam: new THREE.MeshBasicMaterial({ map: beamTex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }),
  road: new THREE.MeshStandardMaterial({ map: asphT.map, normalMap: asphT.nm, normalScale: new THREE.Vector2(0.6, 0.6), roughness: 0.62, metalness: 0.05, envMapIntensity: 0.7 }),
  box: new THREE.MeshStandardMaterial({ map: boxTex, roughness: 0.35 }),
  kebab: new THREE.MeshStandardMaterial({ map: kebabTex, roughness: 0.5 }),
};
asphT.map.repeat.set(N * 4, N * 4); asphT.nm.repeat.set(N * 4, N * 4); puddleT.repeat.set(N * 3, N * 3);

// ---------------------------------------------------------------- merging static parts (keeps draw calls low on phones)
const _m = new THREE.Matrix4(), _l = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _n = new THREE.Matrix3();
const colCache = {}; const pc = (hex) => (typeof hex === "object" ? hex : colCache[hex] || (colCache[hex] = new THREE.Color(hex)));
let BASE = new THREE.Matrix4();   // the current lot's transform; parts are given in lot-local metres
function part(list, geo, mat, x, y, z, sx, sy, sz, ry = 0, rx = 0, rz = 0, opt) {
  _e.set(rx, ry, rz); _q.setFromEuler(_e); _l.compose(_v.set(x, y, z), _q, _s.set(sx, sy, sz));
  list.push({ geo, mat, m: BASE.clone().multiply(_l), uv: opt && opt.uv, col: opt && opt.col ? pc(opt.col) : null });
}
const P_ = (list, geo, mat, col, x, y, z, sx, sy, sz, ry, rx, rz, uv) => part(list, geo, mat, x, y, z, sx, sy, sz, ry || 0, rx || 0, rz || 0, { col, uv });
function bake(list) {
  const groups = new Map(); for (const p of list) { if (!groups.has(p.mat)) groups.set(p.mat, []); groups.get(p.mat).push(p); }
  const out = [];
  for (const [mat, ps] of groups) {
    let nv = 0, ni = 0; for (const p of ps) { nv += p.geo.attributes.position.count; ni += p.geo.index ? p.geo.index.count : p.geo.attributes.position.count; }
    const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = new Float32Array(nv * 2), col = new Float32Array(nv * 3), idx = new Uint32Array(ni);
    let ov = 0, oi = 0;
    for (const p of ps) {
      const g = p.geo, P = g.attributes.position, Nn = g.attributes.normal, U = g.attributes.uv; _n.getNormalMatrix(p.m);
      const cr = p.col ? p.col.r : 1, cg = p.col ? p.col.g : 1, cb = p.col ? p.col.b : 1, su = p.uv ? p.uv[0] : 1, sv = p.uv ? p.uv[1] : 1, ou = p.uv && p.uv.length > 2 ? p.uv[2] : 0, ovv = p.uv && p.uv.length > 2 ? p.uv[3] : 0;
      for (let i = 0; i < P.count; i++) {
        _v.fromBufferAttribute(P, i).applyMatrix4(p.m); pos[(ov + i) * 3] = _v.x; pos[(ov + i) * 3 + 1] = _v.y; pos[(ov + i) * 3 + 2] = _v.z;
        if (Nn) { _v.fromBufferAttribute(Nn, i).applyMatrix3(_n).normalize(); nor[(ov + i) * 3] = _v.x; nor[(ov + i) * 3 + 1] = _v.y; nor[(ov + i) * 3 + 2] = _v.z; }
        if (U) { uv[(ov + i) * 2] = U.getX(i) * su + ou; uv[(ov + i) * 2 + 1] = U.getY(i) * sv + ovv; }
        col[(ov + i) * 3] = cr; col[(ov + i) * 3 + 1] = cg; col[(ov + i) * 3 + 2] = cb;
      }
      if (g.index) for (let i = 0; i < g.index.count; i++) idx[oi + i] = g.index.getX(i) + ov; else for (let i = 0; i < P.count; i++) idx[oi + i] = i + ov;
      ov += P.count; oi += g.index ? g.index.count : P.count;
    }
    const bg = new THREE.BufferGeometry(); bg.setAttribute("position", new THREE.BufferAttribute(pos, 3)); bg.setAttribute("normal", new THREE.BufferAttribute(nor, 3)); bg.setAttribute("uv", new THREE.BufferAttribute(uv, 2)); bg.setAttribute("color", new THREE.BufferAttribute(col, 3)); bg.setIndex(new THREE.BufferAttribute(idx, 1));
    bg.computeBoundingSphere(); const mesh = new THREE.Mesh(bg, mat); out.push(mesh);
  }
  return out;
}
const setBase = (x, z, ry) => { BASE.compose(_v.set(x, 0, z), _q.setFromEuler(_e.set(0, ry, 0)), _s.set(1, 1, 1)); };
const resetBase = () => BASE.identity();

// ---------------------------------------------------------------- building the town
const lots = [];        // every building plot: {x,z,n:[nx,nz],ry,w,kind,door:{x,z},addr,road}
const houses = [];      // deliverable addresses
const takeaways = [];   // pickups
const lamps = [];       // street lamp heads
const blocks = [];      // {i,j,cx,cz,park}
const parked = [];      // parked car rectangles {x,z,hw,hl}
const roadNums = {};
const BRICKS = ["#a8543a", "#9a4a34", "#b4603e", "#8e4632", "#b88a5a", "#a87a4e", "#c4c0b4", "#b0aca0", "#e8e0cc", "#d8c8b0"];
const RENDERS = ["#e8e0cc", "#cfe0d4", "#ead0cc", "#cad6ea", "#f0e2b4", "#dcd0e6", "#f2f0ea"];
const DOORS = [0x1b2b5a, 0x8a1a1e, 0x1f4a2c, 0x14161c, 0xc8a21e, 0x3a6a8a, 0xf0f0ea, 0x5a2a6a];
const LIT = [new THREE.Color(0.95, 0.62, 0.3), new THREE.Color(1.0, 0.72, 0.42), new THREE.Color(0.85, 0.5, 0.24), new THREE.Color(0.5, 0.62, 0.95), new THREE.Color(0.9, 0.7, 0.5)];
const sideInfo = (i, j, side) => { // which road a block side faces, and its outward normal
  if (side === 0) return { n: [0, -1], ry: Math.PI, road: ROWS[j], roadKey: "r" + j };   // north face → road l = j
  if (side === 1) return { n: [1, 0], ry: Math.PI / 2, road: COLS[i + 1], roadKey: "c" + (i + 1) };
  if (side === 2) return { n: [0, 1], ry: 0, road: ROWS[j + 1], roadKey: "r" + (j + 1) };
  return { n: [-1, 0], ry: -Math.PI / 2, road: COLS[i], roadKey: "c" + i };
};
function windowFrame(P, x, y, w, h, on) {
  if (on) P_(P, BOX, M.lights, pick(LIT), x, y, 0.02, w, h, 0.02); else P_(P, BOX, M.glass, null, x, y, 0.02, w, h, 0.02);
  P_(P, BOX, M.plain, "#eeece6", x - w / 2, y, 0.06, 0.09, h + 0.08, 0.12); P_(P, BOX, M.plain, "#eeece6", x + w / 2, y, 0.06, 0.09, h + 0.08, 0.12);
  P_(P, BOX, M.plain, "#eeece6", x, y + h * 0.1, 0.05, w, 0.06, 0.06); P_(P, BOX, M.plain, "#eeece6", x, y, 0.05, 0.06, h, 0.06);
  P_(P, BOX, M.plain, "#d8d0bc", x, y - h / 2 - 0.06, 0.14, w + 0.3, 0.12, 0.28); P_(P, BOX, M.plain, "#d8d0bc", x, y + h / 2 + 0.1, 0.07, w + 0.3, 0.18, 0.14);
}
function house(P, w, style) {
  const H = srnd(6.4, 7.4), wall = style === "render" ? spick(RENDERS) : spick(BRICKS), bm = style === "render" ? M.plain : M.brick;
  P_(P, BOX, bm, wall, 0, H / 2, -4.5, w, H, 9, 0, 0, 0, [w / 2.6, H / 2.6, 0, 0]);
  P_(P, ROOF, M.slate, schance(0.25) ? "#8a5a4a" : "#ffffff", 0, H, -4.5, w + 0.02, 2.5, 9.6, 0, 0, 0, [w / 3, 2]);
  P_(P, BOX, M.plain, "#1c1c22", 0, H - 0.05, 0.12, w + 0.04, 0.22, 0.3);
  if (schance(0.55)) { P_(P, BOX, bm, wall, w / 2 - 0.1, H + 1.6, -4.5, 0.8, 1.9, 1.2, 0, 0, 0, [0.4, 0.8, 0, 0]); for (const dz of [-0.28, 0.28]) P_(P, CYL, M.plain, "#a0583a", w / 2 - 0.1, H + 2.75, -4.5 + dz, 0.22, 0.45, 0.22); }
  windowFrame(P, -w * 0.24, H - 2.35, 1.25, 1.45, schance(0.4)); windowFrame(P, w * 0.24, H - 2.35, 1.15, 1.45, schance(0.3));
  if (schance(0.6)) { P_(P, BOX, M.plain, "#eeece6", -w * 0.2, 1.4, 0.4, 2.6, 2.8, 0.8); P_(P, BOX, M.slate, "#ffffff", -w * 0.2, 2.86, 0.42, 2.8, 0.16, 1, 0, 0, 0, [1, 0.2]); const on = schance(0.6); P_(P, BOX, on ? M.lights : M.glass, on ? pick(LIT) : null, -w * 0.2, 1.6, 0.81, 2.2, 1.4, 0.04); }
  else windowFrame(P, -w * 0.2, 1.65, 1.7, 1.5, schance(0.5));
  const dx = w * 0.28; P_(P, BOX, M.shiny, spick(DOORS), dx, 1.1, 0.03, 1.0, 2.2, 0.06); P_(P, BOX, M.plain, "#d8d0bc", dx - 0.6, 1.25, 0.02, 0.18, 2.5, 0.16); P_(P, BOX, M.plain, "#d8d0bc", dx + 0.6, 1.25, 0.02, 0.18, 2.5, 0.16); P_(P, BOX, M.plain, "#d8d0bc", dx, 2.55, 0.02, 1.4, 0.18, 0.16);
  P_(P, BOX, M.lights, schance(0.7) ? LIT[0] : "#202430", dx, 2.36, 0.03, 0.9, 0.22, 0.04); P_(P, BOX, M.plain, "#8a8478", dx, 0.06, 0.3, 1.3, 0.12, 0.5); P_(P, BOX, M.shiny, "#c8a050", dx + 0.32, 1.05, 0.08, 0.06, 0.06, 0.05);
  if (schance(0.35)) P_(P, SPH, M.lights, new THREE.Color(1.6, 1.3, 0.8), dx + 0.85, 2.3, 0.2, 0.18, 0.18, 0.18);
  return { dx, H };
}
function shop(P, w, sign, interior, pub) {
  const H = srnd(7.2, 8.2), wall = spick(BRICKS);
  P_(P, BOX, M.brick, wall, 0, H / 2, -4.5, w, H, 9, 0, 0, 0, [w / 2.6, H / 2.6, 0, 0]);
  P_(P, ROOF, M.slate, "#ffffff", 0, H, -4.5, w + 0.02, 2.4, 9.6, 0, 0, 0, [w / 3, 2]);
  P_(P, BOX, M.plain, "#1c1c22", 0, H - 0.05, 0.12, w + 0.04, 0.22, 0.3);
  windowFrame(P, -w * 0.25, H - 2.4, 1.3, 1.5, schance(0.5)); windowFrame(P, w * 0.25, H - 2.4, 1.3, 1.5, schance(0.5));
  if (pub) P_(P, BOX, M.shiny, SIGNS[sign][1], 0, 1.75, 0.08, w, 3.5, 0.16);
  P_(P, PLANE, M.signs, new THREE.Color(0.9, 0.9, 0.9), -0.5, 1.55, 0.02, w - 2.2, 2.4, 1, 0, 0, 0, interUV(interior));
  for (const x of [-w / 2 + 0.6, -0.5, w / 2 - 1.6]) P_(P, BOX, M.shiny, "#30343c", x, 1.55, 0.06, 0.1, 2.6, 0.12);
  P_(P, BOX, M.plain, "#1e2024", -0.5, 0.2, 0.06, w - 2.1, 0.4, 0.14);
  P_(P, BOX, M.shiny, "#2a2d34", w / 2 - 0.9, 1.15, 0.03, 1.0, 2.3, 0.06); P_(P, BOX, M.lights, LIT[1], w / 2 - 0.9, 1.4, 0.07, 0.7, 1.4, 0.02);
  P_(P, BOX, M.plain, "#18181c", 0, 3.5, 0.15, w + 0.1, 1.2, 0.3);
  P_(P, PLANE, M.signs, new THREE.Color(1.45, 1.45, 1.45), 0, 3.5, 0.31, w - 0.2, 1.05, 1, 0, 0, 0, signUV(sign));
  if (!pub && schance(0.55)) { const c = SIGNS[sign][1]; P_(P, BOX, M.plain, c, 0, 2.95, 0.75, w - 0.4, 0.08, 1.3, 0, 0.32); P_(P, BOX, M.plain, c, 0, 2.7, 1.38, w - 0.4, 0.4, 0.05); }
  if (pub) { P_(P, BOX, M.plain, "#1a1a1a", -w / 2 + 0.4, 4.6, 0.75, 0.08, 0.08, 1.4); P_(P, BOX, M.plain, "#2a1a10", -w / 2 + 0.4, 4.05, 1.25, 0.08, 1.0, 0.8); P_(P, PLANE, M.signs, new THREE.Color(1.1, 1.1, 1.1), -w / 2 + 0.45, 4.05, 1.25, 0.78, 0.95, 1, Math.PI / 2, 0, 0, AT((sign % 2) * 512 + 180, Math.floor(sign / 2) * 80, 150, 80));
    for (const x of [-w * 0.3, w * 0.1]) { P_(P, SPH, M.plain, "#2a5a22", x, 3.0, 0.55, 0.6, 0.5, 0.6); P_(P, SPH, M.plain, "#e85a8a", x + 0.15, 3.1, 0.75, 0.2, 0.16, 0.2); P_(P, SPH, M.plain, "#f0e04a", x - 0.18, 3.0, 0.72, 0.18, 0.15, 0.18); } }
  return { dx: w / 2 - 0.9, H };
}
function church(P) {
  const s = "#8a8678";
  P_(P, BOX, M.brick, s, 0, 6, -2, 12, 12, 26, 0, 0, 0, [5, 5, 0, 0]); P_(P, ROOF, M.slate, "#ffffff", 0, 12, -2, 12.4, 5, 26.4, Math.PI / 2, 0, 0, [8, 2]);
  P_(P, BOX, M.brick, s, 0, 11, 13, 6, 22, 6, 0, 0, 0, [2.5, 9, 0, 0]); P_(P, CONE, M.slate, "#ffffff", 0, 30, 13, 6.4, 16, 6.4, Math.PI / 4);
  for (let k = 0; k < 4; k++) { P_(P, BOX, M.lights, pick([new THREE.Color(1.4, 0.5, 0.4), new THREE.Color(0.5, 0.7, 1.5), new THREE.Color(1.4, 1.2, 0.5)]), 6.02, 6, -10 + k * 5.5, 0.05, 4, 1.4); P_(P, BOX, M.lights, pick([new THREE.Color(1.4, 0.5, 0.4), new THREE.Color(0.5, 0.7, 1.5)]), -6.02, 6, -10 + k * 5.5, 0.05, 4, 1.4); }
  P_(P, CYL, M.lights, new THREE.Color(1.6, 1.4, 1.0), 0, 18, 16.02, 2.4, 0.06, 2.4, 0, Math.PI / 2); P_(P, BOX, M.shiny, "#3a2418", 0, 1.8, 16.03, 2, 3.6, 0.1);
}
function buildTown() {
  // block types: shops on High Street (col 3) and Market Street (row 3), one park, one church
  const PARK = "4,1", CHURCH = "1,4";
  const signDeck = [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]; let signI = 0;
  const takeSpots = new Set(["2,1,1", "3,4,3", "1,2,2", "4,3,0"]); const takeNames = [0, 1, 2, 3]; let takeI = 0;
  const cells = []; for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) cells.push([]);
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const cx = blockC(i), cz = blockC(j), P = cells[Math.floor(i / 2) * 3 + Math.floor(j / 2)], park = PARK === `${i},${j}`, isChurch = CHURCH === `${i},${j}`;
    blocks.push({ i, j, cx, cz, park });
    resetBase();
    P_(P, BOX, M.pave, "#ffffff", cx, 0.08, cz, BS - 0.3, 0.16, BS - 0.3, 0, 0, 0, [BS / 4, BS / 4, 0, 0]);
    for (const s of [-1, 1]) { P_(P, BOX, M.plain, "#9a9aa0", cx + s * (BS / 2 - 0.1), 0.085, cz, 0.25, 0.17, BS); P_(P, BOX, M.plain, "#9a9aa0", cx, 0.085, cz + s * (BS / 2 - 0.1), BS, 0.17, 0.25); }
    if (park) {
      P_(P, BOX, M.grass, "#ffffff", cx, 0.2, cz, BS - 6, 0.1, BS - 6, 0, 0, 0, [6, 6, 0, 0]);
      for (let k = 0; k < 14; k++) { const tx = cx + srnd(-13, 13), tz = cz + srnd(-13, 13); P_(P, CYL, M.plain, "#4a3020", tx, 1.5, tz, 0.35, 3, 0.35); const r = srnd(1.8, 2.8); P_(P, SPH, M.plain, spick(["#2e5a2a", "#3a6a32", "#264e24"]), tx, 3 + r * 0.7, tz, r * 2, r * 1.8, r * 2); }
      for (const s of [-1, 1]) { P_(P, BOX, M.shiny, "#1a1c20", cx + s * (BS / 2 - 3.2), 0.6, cz, 0.06, 1.0, BS - 6); P_(P, BOX, M.shiny, "#1a1c20", cx, 0.6, cz + s * (BS / 2 - 3.2), BS - 6, 1.0, 0.06); }
      P_(P, BOX, M.plain, "#6a5a48", cx, 0.22, cz, 2.2, 0.06, BS - 6); P_(P, BOX, M.plain, "#6a5a48", cx, 0.22, cz, BS - 6, 0.06, 2.2);
      continue;
    }
    if (isChurch) { P_(P, BOX, M.grass, "#ffffff", cx, 0.2, cz, BS - 6, 0.08, BS - 6, 0, 0, 0, [6, 6, 0, 0]); setBase(cx, cz - 3, 0); church(P); resetBase(); continue; }
    P_(P, BOX, M.plain, "#1e1e24", cx, 6, cz, 12.5, 12, 12.5);   // back yards hidden behind the terraces
    for (let side = 0; side < 4; side++) {
      const info = sideInfo(i, j, side), along = [-info.n[1], info.n[0]];
      const fx = cx + info.n[0] * FR, fz = cz + info.n[1] * FR;
      const shopsHere = (info.roadKey === "c3" || info.roadKey === "r3");
      const style = schance(0.35) ? "render" : "brick";
      let t = -FR;
      while (t < FR - 3) {
        const take = shopsHere && takeSpots.has(`${i},${j},${side}`) && takeI < 4 && t > -6;
        const isShop = shopsHere && (take || schance(0.85));
        const w = isShop ? Math.min(srnd(7, 8.5), FR - t) : Math.min(srnd(5, 5.8), FR - t);
        if (w < 3) break;
        const lx = fx + along[0] * (t + w / 2), lz = fz + along[1] * (t + w / 2);
        setBase(lx, lz, info.ry);
        let res, kind;
        if (take) { const sg = takeNames[takeI++]; res = shop(P, w, sg, 0, false); kind = "take"; const door = local(lx, lz, info.ry, res.dx, 0.8); takeaways.push({ name: SIGNS[sg][0], x: lx + info.n[0] * (PV + 1.6), z: lz + info.n[1] * (PV + 1.6), door, n: info.n, ry: info.ry, road: info.road }); }
        else if (isShop) { const sg = signDeck[signI++ % signDeck.length]; res = shop(P, w, sg, sg === 4 || sg === 5 ? 1 : sg === 8 ? 3 : 2, sg === 4 || sg === 5); kind = "shop"; }
        else { res = house(P, w, style); kind = "house"; }
        const door = local(lx, lz, info.ry, res.dx, 0.75);
        const num = (roadNums[info.roadKey] = (roadNums[info.roadKey] || 0) + 1);
        const lot = { x: lx, z: lz, n: info.n, ry: info.ry, w, kind, door, road: info.road, roadKey: info.roadKey, addr: `${num * 2 - (side < 2 ? 1 : 0)} ${info.road}` };
        lots.push(lot); if (kind === "house") houses.push(lot);
        // doormat
        P_(P, BOX, M.plain, "#3a2a20", res.dx, 0.17, 0.75, 0.9, 0.03, 0.6);
        t += w;
      }
      resetBase();
      // street furniture along this side (on the pavement, kerb side)
      const kx = cx + info.n[0] * (BS / 2 - 0.7), kz = cz + info.n[1] * (BS / 2 - 0.7);
      for (const tt of [-9, 9]) { // lamp posts
        const x = kx + along[0] * tt, z = kz + along[1] * tt;
        P_(P, CYL, M.shiny, "#3c4048", x, 3.6, z, 0.16, 7.2, 0.16); P_(P, BOX, M.shiny, "#3c4048", x + info.n[0] * 0.55, 7.15, z + info.n[1] * 0.55, Math.abs(info.n[0]) * 1.1 + 0.1, 0.1, Math.abs(info.n[1]) * 1.1 + 0.1);
        const hx = x + info.n[0] * 1.1, hz = z + info.n[1] * 1.1; P_(P, BOX, M.lights, new THREE.Color(2.2, 1.8, 1.3), hx, 7.05, hz, 0.5, 0.1, 0.5);
        lamps.push({ x: hx, z: hz }); P_(P, PLANE, M.glow, new THREE.Color(0.55, 0.42, 0.28), hx + info.n[0] * 1.5, 0.03, hz + info.n[1] * 1.5, 12, 12, 1, 0, -Math.PI / 2);
      }
      const extra = SR();
      const ex = kx + along[0] * srnd(-4, 4), ez = kz + along[1] * srnd(-4, 4);
      if (extra < 0.12) { setBase(ex - info.n[0] * 0.3, ez - info.n[1] * 0.3, info.ry); P_(P, RBOX, M.shiny, "#c8101a", 0, 1.3, 0, 1, 2.5, 1); P_(P, BOX, M.shiny, "#c8101a", 0, 2.65, 0, 1.12, 0.25, 1.12); P_(P, BOX, M.lights, new THREE.Color(1.3, 1.2, 0.95), 0, 1.4, 0, 1.03, 1.5, 0.8); P_(P, PLANE, M.signs, new THREE.Color(1.6, 1.6, 1.6), 0, 2.38, 0.51, 0.9, 0.2, 1, 0, 0, 0, AT(128, 896, 256, 56)); resetBase(); }
      else if (extra < 0.3) { P_(P, CYL, M.shiny, "#c8101a", ex, 0.8, ez, 0.56, 1.3, 0.56); P_(P, SPH, M.shiny, "#c8101a", ex, 1.45, ez, 0.58, 0.4, 0.58); P_(P, CYL, M.plain, "#111111", ex, 0.18, ez, 0.62, 0.06, 0.62); }
      else if (extra < 0.5) { P_(P, CYL, M.plain, "#1a1a1e", ex, 0.6, ez, 0.6, 0.95, 0.6); P_(P, CYL, M.shiny, "#c8a040", ex, 0.95, ez, 0.62, 0.08, 0.62); }
      else if (extra < 0.62) { setBase(ex - info.n[0] * 1.6, ez - info.n[1] * 1.6, info.ry); P_(P, BOX, M.plain, "#4a3424", 0, 0.5, 0, 1.8, 0.08, 0.5); P_(P, BOX, M.plain, "#4a3424", 0, 0.8, -0.22, 1.8, 0.45, 0.06); for (const s of [-0.8, 0.8]) P_(P, BOX, M.shiny, "#1a1a1a", s, 0.4, 0, 0.06, 0.8, 0.5); resetBase(); }
      else if (extra < 0.8) { const tx = kx + along[0] * srnd(-12, 12), tz = kz + along[1] * srnd(-12, 12); P_(P, CYL, M.plain, "#4a3020", tx, 1.6, tz, 0.28, 3.2, 0.28); P_(P, SPH, M.plain, spick(["#2e5a2a", "#3a6a32"]), tx, 4.2, tz, 3, 2.8, 3); }
      if (info.roadKey === "c3" || info.roadKey === "r3") for (let k = -1; k <= 1; k++) { const bx = cx + info.n[0] * (BS / 2 - 0.35), bz = cz + info.n[1] * (BS / 2 - 0.35); P_(P, CYL, M.shiny, "#0c0c0e", bx + along[0] * (k * 1.4 - 14), 0.55, bz + along[1] * (k * 1.4 - 14), 0.2, 0.9, 0.2); }
      // parked cars along some kerbs (solid)
      if (schance(0.4)) { const tt = srnd(-12, 12), x = cx + info.n[0] * (BS / 2 + 1.05), z = cz + info.n[1] * (BS / 2 + 1.05); const px_ = x + along[0] * tt, pz_ = z + along[1] * tt; setBase(px_, pz_, info.ry + Math.PI / 2 + (schance(0.5) ? Math.PI : 0)); carParts(P, spick(CAR_COLS), false, false); resetBase(); parked.push({ x: px_, z: pz_, hw: info.n[0] ? 1.0 : 2.3, hl: info.n[0] ? 2.3 : 1.0 }); }
    }
  }
  resetBase();
  // road markings: centre dashes, give-way lines, double yellows on the shopping streets, zebras on High Street
  const RM = cells[4];
  const paintC = new THREE.Color(0.85, 0.85, 0.82), yel = new THREE.Color(0.95, 0.72, 0.1);
  for (let k = 0; k <= N; k++) for (let l = 0; l < N; l++) {
    const x = roadX(k), z0 = roadX(l) + RW / 2 + 2, z1 = roadX(l + 1) - RW / 2 - 2;
    for (let z = z0; z < z1; z += 6) { P_(RM, BOX, M.plain, paintC, x, 0.02, z + 1.5, 0.15, 0.02, 3); P_(RM, BOX, M.plain, paintC, z + 1.5, 0.02, x, 3, 0.02, 0.15); }
    for (const [a, b] of [[x - 2.5, roadX(l) + RW / 2 + 0.3], [x + 2.5, roadX(l + 1) - RW / 2 - 0.3]]) { P_(RM, BOX, M.plain, paintC, a, 0.02, b, 4.6, 0.02, 0.2); P_(RM, BOX, M.plain, paintC, b, 0.02, a, 0.2, 0.02, 4.6); }
    if (k === 3) for (const s of [-1, 1]) for (const o of [0, 0.2]) P_(RM, BOX, M.plain, yel, x + s * (RW / 2 - 0.25 - o), 0.02, (z0 + z1) / 2, 0.08, 0.02, z1 - z0 + 4);
    if (k === 3) for (const s of [-1, 1]) for (const o of [0, 0.2]) P_(RM, BOX, M.plain, yel, (z0 + z1) / 2, 0.02, x + s * (RW / 2 - 0.25 - o), z1 - z0 + 4, 0.02, 0.08);
    if (k === 3 && l % 2 === 0) for (let s = 0; s < 6; s++) P_(RM, BOX, M.plain, paintC, x - RW / 2 + 0.8 + s * 1.7, 0.02, (z0 + z1) / 2, 0.9, 0.02, 3);
  }
  for (const P of cells) { if (!P.length) continue; const ms = bake(P); for (const m of ms) { m.receiveShadow = m.material !== M.glow; scene.add(m); } }
  // the road surface and the outskirts
  const S = N * PITCH + RW + 2;
  road = new THREE.Mesh(new THREE.PlaneGeometry(S, S), M.road); road.rotation.x = -Math.PI / 2; road.receiveShadow = true; scene.add(road);
  const g2 = grassT.clone(); g2.needsUpdate = true; g2.repeat.set(120, 120); const out = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), new THREE.MeshStandardMaterial({ map: g2, color: 0x6a7a60, roughness: 1 })); out.rotation.x = -Math.PI / 2; out.position.y = -0.05; scene.add(out);
  const W2 = [], hedge = []; resetBase();
  for (const s of [-1, 1]) { P_(W2, BOX, M.pave, "#ffffff", s * (S / 2 + 1.5), 0.08, 0, 3, 0.16, S + 6, 0, 0, 0, [1, S / 4, 0, 0]); P_(W2, BOX, M.pave, "#ffffff", 0, 0.08, s * (S / 2 + 1.5), S + 6, 0.16, 3, 0, 0, 0, [S / 4, 1, 0, 0]);
    P_(W2, BOX, M.brick, "#8a5a44", s * (S / 2 + 3.2), 0.7, 0, 0.5, 1.4, S + 10, 0, 0, 0, [S / 2.6, 0.5, 0, 0]); P_(W2, BOX, M.brick, "#8a5a44", 0, 0.7, s * (S / 2 + 3.2), S + 10, 1.4, 0.5, 0, 0, 0, [S / 2.6, 0.5, 0, 0]);
    for (let t = -S / 2; t < S / 2; t += 9) { for (const [x, z] of [[s * (S / 2 + 7), t], [t, s * (S / 2 + 7)]]) { P_(hedge, CYL, M.plain, "#3a2a1a", x, 2, z, 0.4, 4, 0.4); P_(hedge, SPH, M.plain, spick(["#1e3a1c", "#264a22", "#183016"]), x, 5.5, z, 6, 6, 6); } } }
  for (const m of bake(W2)) { m.receiveShadow = true; scene.add(m); } for (const m of bake(hedge)) scene.add(m);
}
function local(x, z, ry, lx, lz) { return { x: x + Math.cos(ry) * lx + Math.sin(ry) * lz, z: z - Math.sin(ry) * lx + Math.cos(ry) * lz }; }

// ---------------------------------------------------------------- vehicles (shared by parked and moving cars)
const CAR_COLS = ["#0c0c10", "#e8e8ec", "#8a8e96", "#2a4a8a", "#7a1418", "#1a3a2a", "#c8c8d0", "#3a3a40", "#5a6a8a", "#a8341e"];
function carParts(P, col, lights, cab, kind) {
  const L = kind === "van" ? 4.9 : 4.3, Wd = 1.84;
  if (kind === "van") { P_(P, RBOX, M.paint, col, 0, 1.15, 0.1, Wd, 1.75, L - 0.2); P_(P, BOX, M.glass, null, 0, 1.55, -L / 2 + 0.12, Wd - 0.2, 0.6, 0.05); }
  else { P_(P, RBOX, M.paint, col, 0, 0.62, 0, Wd, 0.66, L); P_(P, RBOX, M.paint, col, 0, 1.12, 0.25, Wd - 0.16, 0.58, L * 0.52); P_(P, RBOX, M.glass, null, 0, 1.13, 0.25, Wd - 0.1, 0.46, L * 0.49); }
  for (const [wx, wz] of [[-0.86, -L * 0.32], [0.86, -L * 0.32], [-0.86, L * 0.32], [0.86, L * 0.32]]) { P_(P, CYL, M.tyre, null, wx, 0.34, wz, 0.68, 0.26, 0.68, 0, 0, Math.PI / 2); P_(P, CYL, M.shiny, "#b8bcc4", wx, 0.34, wz, 0.42, 0.27, 0.42, 0, 0, Math.PI / 2); }
  const hl = lights ? new THREE.Color(4, 3.8, 3.4) : new THREE.Color(0.9, 0.9, 0.85), tl = lights ? new THREE.Color(3.5, 0.15, 0.2) : new THREE.Color(0.6, 0.05, 0.05);
  for (const s of [-0.62, 0.62]) { P_(P, BOX, M.lights, hl, s, 0.74, -L / 2 + 0.02, 0.42, 0.14, 0.06); P_(P, BOX, M.lights, tl, s, 0.8, L / 2 - 0.02, 0.4, 0.13, 0.06); }
  P_(P, BOX, M.lights, new THREE.Color(0.95, 0.75, 0.1), 0, 0.48, L / 2 + 0.01, 0.52, 0.12, 0.02);
  if (cab) P_(P, BOX, M.lights, new THREE.Color(3, 2, 0.3), 0, 1.47, 0.3, 0.5, 0.16, 0.22);
  if (lights) { // glare and the pools of light the headlights throw on the road
    for (const s of [-0.62, 0.62]) { P_(P, PLANE, M.glow, new THREE.Color(1, 0.95, 0.85), s, 0.74, -L / 2 - 0.08, 1.1, 1.1, 1, Math.PI); P_(P, PLANE, M.glow, new THREE.Color(0.7, 0.05, 0.05), s, 0.8, L / 2 + 0.08, 0.8, 0.8, 1); }
    P_(P, PLANE, M.glow, new THREE.Color(0.38, 0.35, 0.3), 0, 0.04, -L / 2 - 5, 4.2, 10, 1, 0, -Math.PI / 2); P_(P, PLANE, M.glow, new THREE.Color(0.35, 0.02, 0.03), 0, 0.04, L / 2 + 1.6, 2.6, 3.2, 1, 0, -Math.PI / 2);
  }
  return L;
}
const busSide = ctex(512, 256, (g, w, h) => { g.fillStyle = "#c21e1e"; g.fillRect(0, 0, w, h); for (const y of [30, 140]) for (let x = 14; x < w - 20; x += 62) { g.fillStyle = "#ffe2a8"; g.fillRect(x, y, 52, 62); } g.fillStyle = "#e8e2d2"; g.fillRect(0, 112, w, 10); g.fillStyle = "#111"; g.fillRect(0, h - 26, w, 26); });
const busMat = new THREE.MeshStandardMaterial({ map: busSide, emissiveMap: busSide, emissive: 0x7a6040, roughness: 0.4, metalness: 0.2 });
function makeVehicle(kind) {
  const g = new THREE.Group(), P = []; resetBase(); let L, Wd = 1.84, extra = null;
  if (kind === "bus") {
    L = 10.5; Wd = 2.55; P_(P, BOX, busMat, null, 0, 2.35, 0, Wd, 4.1, L); P_(P, BOX, M.paint, "#b01818", 0, 4.45, 0, Wd - 0.05, 0.12, L - 0.1);
    for (const [x, z] of [[-1.15, -L * 0.36], [1.15, -L * 0.36], [-1.15, L * 0.3], [1.15, L * 0.3]]) P_(P, CYL, M.tyre, null, x, 0.5, z, 1, 0.32, 1, 0, 0, Math.PI / 2);
    for (const s of [-0.95, 0.95]) { P_(P, BOX, M.lights, new THREE.Color(4, 3.8, 3.4), s, 0.9, -L / 2 - 0.02, 0.35, 0.2, 0.05); P_(P, BOX, M.lights, new THREE.Color(3.5, 0.15, 0.2), s, 0.9, L / 2 + 0.02, 0.3, 0.3, 0.05); P_(P, PLANE, M.glow, new THREE.Color(1, 0.95, 0.85), s, 0.9, -L / 2 - 0.1, 1.3, 1.3, 1, Math.PI); }
    P_(P, BOX, M.lights, new THREE.Color(2.4, 1.6, 0.2), 0, 4.0, -L / 2 - 0.02, 1.6, 0.35, 0.05);
    P_(P, PLANE, M.glow, new THREE.Color(0.38, 0.35, 0.3), 0, 0.04, -L / 2 - 6, 5, 12, 1, 0, -Math.PI / 2);
  } else {
    const col = kind === "cab" ? "#0a0a0c" : kind === "police" ? "#f2f2f4" : kind === "van" ? spick(["#f2f2f4", "#e8e8ec", "#2a4a8a"]) : pick(CAR_COLS);
    L = carParts(P, col, true, kind === "cab", kind);
    if (kind === "police") { P_(P, BOX, M.lights, new THREE.Color(0.2, 0.6, 1.6), 0, 0.68, 0, 1.86, 0.16, L - 0.4); }
  }
  for (const m of bake(P)) { if (m.material !== M.glow && m.material !== M.lights) m.castShadow = true; g.add(m); }
  if (kind === "police") { const b = new THREE.Mesh(BOX, new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 0.5, 4) })); b.scale.set(0.6, 0.14, 0.25); b.position.set(-0.32, 1.5, 0.3); const r = new THREE.Mesh(BOX, new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 0.3, 0.3) })); r.scale.set(0.6, 0.14, 0.25); r.position.set(0.32, 1.5, 0.3); g.add(b, r); extra = [b, r]; }
  return { g, L, W: Wd, kind, extra };
}

// ---------------------------------------------------------------- the rider
const bike = new THREE.Group(); scene.add(bike);
const lean = new THREE.Group(); bike.add(lean);
const redPaint = new THREE.MeshPhysicalMaterial({ color: 0xc8101a, roughness: 0.25, metalness: 0.35, clearcoat: 1, envMapIntensity: 1.2 });
const helmetMat = new THREE.MeshPhysicalMaterial({ color: 0xd3262e, roughness: 0.15, metalness: 0.3, clearcoat: 1 });
const jacket = new THREE.MeshStandardMaterial({ color: 0x16181e, roughness: 0.75 }), jeans = new THREE.MeshStandardMaterial({ color: 0x1e2a44, roughness: 0.9 });
const chrome = new THREE.MeshStandardMaterial({ color: 0xc8ccd4, roughness: 0.2, metalness: 1 }), blackM = new THREE.MeshStandardMaterial({ color: 0x0c0d10, roughness: 0.6 });
const hiVis = new THREE.MeshStandardMaterial({ color: 0xd8e020, emissive: 0x2a2c00, roughness: 0.6 });
const RP = []; const rp = (geo, mat, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) => part(RP, geo, mat, x, y, z, sx, sy, sz, ry, rx, rz);
resetBase();
const WHEEL = new THREE.TorusGeometry(0.26, 0.1, 12, 24), CAPS = new THREE.CapsuleGeometry(0.5, 1, 6, 12);
rp(WHEEL, M.tyre, 0, 0.36, -0.78, 1, 1, 1, 0, Math.PI / 2); rp(WHEEL, M.tyre, 0, 0.36, 0.62, 1, 1, 1, 0, Math.PI / 2);
rp(CYL, chrome, 0, 0.36, -0.78, 0.26, 0.16, 0.26, 0, 0, Math.PI / 2); rp(CYL, chrome, 0, 0.36, 0.62, 0.26, 0.16, 0.26, 0, 0, Math.PI / 2);
rp(RBOX, redPaint, 0, 0.66, 0.38, 0.58, 0.48, 1.0); rp(BOX, blackM, 0, 0.38, -0.12, 0.44, 0.08, 0.86); rp(RBOX, redPaint, 0, 0.8, -0.6, 0.52, 0.86, 0.16);
rp(SPH, redPaint, 0, 0.6, -0.8, 0.36, 0.2, 0.5); rp(CYL, chrome, 0, 0.92, -0.72, 0.06, 0.62, 0.06, -0.3); rp(CYL, blackM, 0, 1.2, -0.62, 0.05, 0.74, 0.05, 0, 0, Math.PI / 2);
rp(RBOX, blackM, 0, 0.98, 0.22, 0.38, 0.12, 0.68); rp(CYL, M.lights, 0, 1.08, -0.79, 0.2, 0.06, 0.2, Math.PI / 2);
rp(RBOX, redPaint, 0, 1.45, 0.62, 0.7, 0.6, 0.6); rp(PLANE, M.box, 0, 1.45, 0.925, 0.6, 0.47, 1); rp(BOX, chrome, 0, 1.13, 0.62, 0.72, 0.04, 0.62);
rp(CAPS, jeans, -0.17, 0.82, -0.06, 0.22, 0.42, 0.22, Math.PI / 2 - 0.3); rp(CAPS, jeans, 0.17, 0.82, -0.06, 0.22, 0.42, 0.22, Math.PI / 2 - 0.3);
rp(CAPS, jeans, -0.18, 0.58, -0.32, 0.2, 0.36, 0.2, 0.25); rp(CAPS, jeans, 0.18, 0.58, -0.32, 0.2, 0.36, 0.2, 0.25);
rp(CAPS, jacket, 0, 1.38, 0.06, 0.48, 0.42, 0.42, -0.36); rp(new THREE.TorusGeometry(0.235, 0.025, 8, 24), hiVis, 0, 1.36, 0.08, 1, 0.8, 0.9, Math.PI / 2 - 0.36);
rp(SPH, helmetMat, 0, 1.88, -0.12, 0.44, 0.44, 0.48); rp(SPH, M.glass, 0, 1.86, -0.3, 0.36, 0.2, 0.2);
rp(BOX, M.lights, 0, 0.74, 0.97, 0.2, 0.08, 0.04, 0, 0, 0); rp(PLANE, new THREE.MeshBasicMaterial({ map: plateTex("KR24 RUN") }), 0, 0.58, 0.9, 0.34, 0.08, 1);
for (const m of bake(RP)) { m.castShadow = true; lean.add(m); }
const arms = []; for (const s of [-1, 1]) { const a = new THREE.Mesh(CAPS, jacket); a.scale.set(0.15, 0.48, 0.15); a.position.set(s * 0.3, 1.38, -0.3); a.rotation.set(-1.05, 0, s * 0.2); a.castShadow = true; lean.add(a); arms.push(a); }
const headSpot = new THREE.SpotLight(0xfff0d8, 60, 40, 0.5, 0.55, 1.5); headSpot.position.set(0, 1.1, -0.9); headSpot.target.position.set(0, 0, -14); bike.add(headSpot, headSpot.target);
const bikeShadow = new THREE.Mesh(PLANE, new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false })); bikeShadow.rotation.x = -Math.PI / 2; bikeShadow.scale.set(1.3, 2.6, 1); bikeShadow.position.y = 0.03; bike.add(bikeShadow);
const tailGlow = new THREE.Mesh(PLANE, new THREE.MeshBasicMaterial({ map: radial, color: 0x701010, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); tailGlow.rotation.x = -Math.PI / 2; tailGlow.scale.set(1.6, 3, 1); tailGlow.position.set(0, 0.04, 2.1); bike.add(tailGlow);
function setHelmet() { const h = HELMETS.find((x) => x.k === save.helmet) || HELMETS[0]; helmetMat.color.set(h.c); }
setHelmet();

// ---------------------------------------------------------------- sky, weather, reflections
const skyMat = new THREE.MeshBasicMaterial({ side: THREE.BackSide, fog: false, depthWrite: false });
const sky = new THREE.Mesh(new THREE.SphereGeometry(400, 24, 16), skyMat); sky.renderOrder = -10; scene.add(sky);
const SKIES = {
  night: ["#03050c", "#0a1024", "#1a2240", "#3a2e40"], dusk: ["#0c1030", "#3a2a6a", "#c85a6a", "#ffa060"], cloud: ["#14161c", "#20242e", "#2e323c", "#3c3a3e"],
  fog: ["#3a3e48", "#4a4e58", "#5a5c64", "#646468"], storm: ["#0a0c10", "#141820", "#1e222a", "#2a2a30"],
};
const skyTex = {}; for (const [k, c] of Object.entries(SKIES)) skyTex[k] = ctex(8, 256, (g) => { const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, c[0]); gr.addColorStop(0.42, c[1]); gr.addColorStop(0.5, c[2]); gr.addColorStop(0.53, c[3]); gr.addColorStop(1, c[2]); g.fillStyle = gr; g.fillRect(0, 0, 8, 256); });
const stars = (() => { const st = []; for (let i = 0; i < 400; i++) { const a = Math.random() * Math.PI * 2, e = rnd(0.12, 1.4); st.push(Math.cos(a) * Math.cos(e) * 380, Math.sin(e) * 380, Math.sin(a) * Math.cos(e) * 380); } const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(st, 3)); return new THREE.Points(g, new THREE.PointsMaterial({ size: 1.5, color: 0xffffff, transparent: true, opacity: 0.8, fog: false, sizeAttenuation: false, depthWrite: false })); })(); sky.add(stars);
const moonDisc = new THREE.Mesh(new THREE.CircleGeometry(9, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.55, 1.4), fog: false })); moonDisc.position.set(150, 160, -280); moonDisc.lookAt(0, 0, 0); sky.add(moonDisc);
const sunGlow = new THREE.Mesh(new THREE.PlaneGeometry(320, 140), new THREE.MeshBasicMaterial({ map: radial, color: 0xff7a40, transparent: true, blending: THREE.AdditiveBlending, fog: false, depthWrite: false })); sunGlow.position.set(-60, 8, -380); sky.add(sunGlow);
// distant skyline all round, with a clock tower and a big wheel
const skyline = (() => { const tex = ctex(2048, 256, (g, w, h) => { for (let x = 0; x < w;) { const bw = rnd(20, 70), bh = rnd(16, 80); g.fillStyle = "#0a0c16"; g.fillRect(x, h - bh, bw, bh); if (chance(0.4)) { g.beginPath(); g.moveTo(x, h - bh); g.lineTo(x + bw / 2, h - bh - 14); g.lineTo(x + bw, h - bh); g.fill(); } for (let k = 0; k < bw * bh / 300; k++) { g.fillStyle = pick(["#ffc878", "#ffe0a8", "#9cc8ff"]); g.globalAlpha = rnd(0.3, 0.9); g.fillRect(x + rnd(2, bw - 4), h - bh + rnd(4, bh - 4), 2, 3); } g.globalAlpha = 1; x += bw + rnd(0, 8); }
  g.fillStyle = "#0a0c16"; g.fillRect(600, 60, 26, 196); g.beginPath(); g.moveTo(596, 60); g.lineTo(613, 10); g.lineTo(630, 60); g.fill(); g.fillStyle = "#ffe8b0"; g.beginPath(); g.arc(613, 80, 8, 0, 7); g.fill();
  g.strokeStyle = "rgba(200,120,255,.85)"; g.lineWidth = 3; g.beginPath(); g.arc(1500, 150, 70, 0, 7); g.stroke(); for (let a = 0; a < 6.28; a += 0.4) { g.beginPath(); g.moveTo(1500, 150); g.lineTo(1500 + Math.cos(a) * 70, 150 + Math.sin(a) * 70); g.stroke(); } }, {});
  tex.wrapS = THREE.RepeatWrapping; tex.repeat.set(2, 1);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(330, 330, 70, 48, 1, true), new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.BackSide, fog: false, depthWrite: false })); m.position.y = 22; scene.add(m); return m; })();
// reflections: tiny made-up world baked once into an environment map (glossy cars, wet roads)
function makeEnv(skyKey) {
  const env = new THREE.Scene(); env.add(new THREE.Mesh(new THREE.SphereGeometry(20, 16, 8), new THREE.MeshBasicMaterial({ map: skyTex[skyKey], side: THREE.BackSide })));
  for (let i = 0; i < 12; i++) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.5), new THREE.MeshBasicMaterial({ color: new THREE.Color(pick([0xffb060, 0xffe0b0, 0xff3040, 0x80c0ff])).multiplyScalar(6) })); const a = (i / 12) * 6.28; m.position.set(Math.cos(a) * 12, rnd(1, 5), Math.sin(a) * 12); env.add(m); }
  const pm = new THREE.PMREMGenerator(renderer), t = pm.fromScene(env, 0.02).texture; pm.dispose(); return t;
}
let road = null, mirror = null, weather = WEATHERS[0];
function setWeather(w) {
  weather = w;
  skyMat.map = skyTex[w.sky]; skyMat.needsUpdate = true;
  stars.visible = w.sky === "night" || w.sky === "dusk"; moonDisc.visible = w.sky === "night"; sunGlow.visible = w.sky === "dusk";
  const fogC = { night: 0x141a2c, dusk: 0x3a2c48, cloud: 0x1e222a, fog: 0x4a4e58, storm: 0x161a22 }[w.sky];
  scene.fog.color.set(fogC); scene.fog.density = w.fog;
  hemi.intensity = { night: 1.0, dusk: 1.35, cloud: 0.9, fog: 1.1, storm: 0.75 }[w.sky]; hemi.color.set(w.sky === "dusk" ? 0x9a7ac8 : 0x5a6a96);
  moon.intensity = { night: 0.7, dusk: 1.1, cloud: 0.25, fog: 0.15, storm: 0.1 }[w.sky]; moon.color.set(w.sky === "dusk" ? 0xffa07a : 0x9ab0e0);
  if (w.sky === "dusk") moon.position.set(-40, 25, -60);
  if (scene.environment) scene.environment.dispose(); scene.environment = makeEnv(w.sky);
  // wet roads: the asphalt thins out where it's wet so the mirror underneath shows through
  const wet = w.wet;
  M.road.roughness = lerp(0.7, 0.28, wet); M.road.envMapIntensity = lerp(0.6, 1.2, wet); M.pave.roughness = lerp(0.7, 0.35, wet);
  const useMirror = wet > 0.5 && save.set.hi;
  if (useMirror && !mirror) { const S = N * PITCH + RW + 2; mirror = new Reflector(new THREE.PlaneGeometry(S, S), { textureWidth: 512, textureHeight: 512, color: 0x7a7a80 }); mirror.rotation.x = -Math.PI / 2; mirror.position.y = -0.02; scene.add(mirror); fit(); }
  if (mirror) mirror.visible = useMirror;
  M.road.transparent = useMirror; M.road.alphaMap = useMirror ? puddleT : null; M.road.opacity = useMirror ? lerp(1, 0.86, wet) : 1; M.road.needsUpdate = true;
  rain.visible = w.rain > 0; rainGeo.setDrawRange(0, Math.floor(RAIN_N * w.rain * (save.set.hi ? 1 : 0.5)) * 2);
  for (const l of LAMPS_LIVE) l.color.set(w.sky === "fog" ? 0xffd8a8 : 0xffc890);
  $("hWeather").textContent = w.icon;
}
const RAIN_N = 1600, rainPos = new Float32Array(RAIN_N * 6);
const rainGeo = new THREE.BufferGeometry(); rainGeo.setAttribute("position", new THREE.BufferAttribute(rainPos, 3));
const rain = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: 0x9fb4e0, transparent: true, opacity: 0.32, depthWrite: false })); rain.frustumCulled = false; scene.add(rain);
function seedDrop(i, cx, cz, top) { const x = cx + rnd(-22, 22), y = top ? rnd(12, 18) : rnd(0, 18), z = cz + rnd(-22, 22); rainPos.set([x, y, z, x + 0.03, y - 0.6, z + 0.05], i * 6); }
for (let i = 0; i < RAIN_N; i++) seedDrop(i, 0, 0, false);
function stepRain(dt, cx, cz) { if (!rain.visible) return; for (let i = 0; i < RAIN_N; i++) { const k = i * 6; rainPos[k + 1] -= 26 * dt; rainPos[k + 4] -= 26 * dt; if (rainPos[k + 4] < 0 || Math.abs(rainPos[k] - cx) > 24 || Math.abs(rainPos[k + 2] - cz) > 24) seedDrop(i, cx, cz, true); } rainGeo.attributes.position.needsUpdate = true; }

// ---------------------------------------------------------------- pedestrians: instanced, walking round the blocks
const PEDS = 90;
const pedBody = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.2, 0.62, 4, 10), new THREE.MeshStandardMaterial({ roughness: 0.85 }), PEDS);
const pedHead = new THREE.InstancedMesh(new THREE.SphereGeometry(0.13, 12, 10), new THREE.MeshStandardMaterial({ roughness: 0.7 }), PEDS);
const legGeo = new THREE.CapsuleGeometry(0.075, 0.62, 4, 8); legGeo.translate(0, -0.38, 0);
const pedLegs = new THREE.InstancedMesh(legGeo, new THREE.MeshStandardMaterial({ color: 0x1a1e2a, roughness: 0.9 }), PEDS * 2);
const pedUmb = new THREE.InstancedMesh(new THREE.ConeGeometry(0.62, 0.28, 14, 1, true), new THREE.MeshStandardMaterial({ roughness: 0.4, side: THREE.DoubleSide }), PEDS);
for (const m of [pedBody, pedHead, pedLegs, pedUmb]) { m.castShadow = true; m.frustumCulled = false; scene.add(m); }
const peds = [];
const COATS = [0x1a1c22, 0x2a2e3a, 0x3a2a22, 0x4a1a1a, 0x2a3a2a, 0x6a5a3a, 0x8a2a3a, 0x2a4a6a, 0xc8a050], SKIN = [0xe8c0a0, 0xc89070, 0x8a5a3a, 0x5a3a2a];
for (let i = 0; i < PEDS; i++) {
  peds.push({ b: null, s: Math.random() * 4, d: chance(0.5) ? 1 : -1, v: rnd(1.1, 1.6), ph: Math.random() * 6, off: rnd(-0.6, 0.6), umb: chance(0.6) });
  pedBody.setColorAt(i, new THREE.Color(pick(COATS))); pedHead.setColorAt(i, new THREE.Color(pick(SKIN))); pedUmb.setColorAt(i, new THREE.Color(pick([0x111111, 0x1a2a4a, 0x7a1a1a, 0x2a5a3a])));
}
function placePeds(x, z) {
  const near = blocks.filter((b) => Math.hypot(b.cx - x, b.cz - z) < 140);
  for (const p of peds) { p.b = pick(near); p.s = Math.random() * 4; }
}
function pedPos(p) { // walking round the block on the middle of the pavement
  const R = BS / 2 - 1.5 + p.off, s = ((p.s % 4) + 4) % 4, side = Math.floor(s), f = s - side, t = -R + f * 2 * R;
  const pts = [[t, -R, Math.PI / 2], [R, t, Math.PI], [-t, R, -Math.PI / 2], [-R, -t, 0]][side];
  return [p.b.cx + pts[0], p.b.cz + pts[1], pts[2] + (p.d < 0 ? Math.PI : 0)];
}
const _pm = new THREE.Matrix4();
function stepPeds(dt) {
  for (let i = 0; i < PEDS; i++) {
    const p = peds[i]; if (!p.b) continue;
    p.s += (p.d * p.v * dt) / (BS - 3); p.ph += p.v * dt * 5.5;
    if (Math.hypot(p.b.cx - px, p.b.cz - pz) > 170) { const near = blocks.filter((b) => Math.hypot(b.cx - px, b.cz - pz) < 120); if (near.length) { p.b = pick(near); p.s = Math.random() * 4; } }
    const [x, z, yaw] = pedPos(p), bob = Math.abs(Math.sin(p.ph)) * 0.04;
    _q.setFromEuler(_e.set(0, yaw, 0)); _pm.compose(_v.set(x, 0.16 + 1.18 + bob, z), _q, _s.set(1, 1, 1)); pedBody.setMatrixAt(i, _pm);
    _pm.compose(_v.set(x, 0.16 + 1.76 + bob, z), _q, _s.set(1, 1, 1)); pedHead.setMatrixAt(i, _pm);
    const u = p.umb && weather.rain > 0; _pm.compose(_v.set(x, 2.2, z), _q, u ? _s.set(1, 1, 1) : _s.set(0, 0, 0)); pedUmb.setMatrixAt(i, _pm);
    for (let k = 0; k < 2; k++) { const sw = Math.sin(p.ph + k * Math.PI) * 0.45, sx = (k ? 0.09 : -0.09); _q.setFromEuler(_e.set(sw, yaw, 0)); _pm.compose(_v.set(x + Math.cos(yaw) * sx, 0.16 + 0.86 + bob, z - Math.sin(yaw) * sx), _q, _s.set(1, 1, 1)); pedLegs.setMatrixAt(i * 2 + k, _pm); }
  }
  for (const m of [pedBody, pedHead, pedLegs, pedUmb]) m.instanceMatrix.needsUpdate = true;
}

// ---------------------------------------------------------------- road network + sat-nav
const nodeP = (k, l) => [roadX(k), roadX(l)];
const nbrs = (k, l) => [[k + 1, l], [k - 1, l], [k, l + 1], [k, l - 1]].filter(([a, b]) => a >= 0 && b >= 0 && a <= N && b <= N);
function roadOf(x, z) { // which road (and edge) a point is on
  const k = Math.round(x / PITCH + N / 2), l = Math.round(z / PITCH + N / 2);
  const dxk = Math.abs(x - roadX(k)), dzl = Math.abs(z - roadX(l));
  if (dxk <= dzl) { const l0 = clamp(Math.floor(z / PITCH + N / 2), 0, N - 1); return { vert: true, a: [k, l0], b: [k, l0 + 1] }; }
  const k0 = clamp(Math.floor(x / PITCH + N / 2), 0, N - 1); return { vert: false, a: [k0, l], b: [k0 + 1, l] };
}
function shortest(from, to) { // Dijkstra on the 7×7 junction grid
  const key = (a) => a[0] * 10 + a[1], dist = new Map([[key(from), 0]]), prev = new Map(), open = [from];
  while (open.length) {
    open.sort((a, b) => dist.get(key(a)) - dist.get(key(b))); const c = open.shift(); if (key(c) === key(to)) break;
    for (const nb of nbrs(...c)) { const d = dist.get(key(c)) + PITCH; if (d < (dist.get(key(nb)) ?? 1e9)) { dist.set(key(nb), d); prev.set(key(nb), c); open.push(nb); } }
  }
  const path = [to]; let c = to; while (key(c) !== key(from)) { c = prev.get(key(c)); if (!c) return null; path.unshift(c); } return { path, d: dist.get(key(to)) };
}
function routeTo(tx, tz) { // returns a polyline [[x,z],...] from the rider to the target point on its road
  const me = roadOf(px, pz), tg = roadOf(tx, tz);
  const f = fwd(heading); let best = null;
  for (const s of [me.a, me.b]) for (const e of [tg.a, tg.b]) {
    const sp = nodeP(...s), ep = nodeP(...e), r = shortest(s, e); if (!r) continue;
    const toS = Math.hypot(sp[0] - px, sp[1] - pz), behind = ((sp[0] - px) * f[0] + (sp[1] - pz) * f[1]) < -2 ? 40 : 0;
    const total = toS + r.d + Math.hypot(ep[0] - tx, ep[1] - tz) + behind;
    if (!best || total < best.total) best = { total, nodes: r.path };
  }
  // same edge and ahead of us: go straight there
  const sameEdge = me.vert === tg.vert && me.a[0] === tg.a[0] && me.a[1] === tg.a[1];
  if (sameEdge && ((tx - px) * f[0] + (tz - pz) * f[1]) > -3) return { pts: [[px, pz], [tx, tz]], d: Math.hypot(tx - px, tz - pz) };
  if (!best) return { pts: [[px, pz], [tx, tz]], d: Math.hypot(tx - px, tz - pz) };
  const pts = [[px, pz], ...best.nodes.map((n) => nodeP(...n)), [tx, tz]];
  // drop the last junction if the target sits back along the edge we've just come down
  if (pts.length > 3) { const a = pts[pts.length - 3], b = pts[pts.length - 2], c = pts[pts.length - 1]; if ((b[0] - a[0]) * (c[0] - b[0]) + (b[1] - a[1]) * (c[1] - b[1]) < 0) pts.splice(pts.length - 2, 1); }
  let d = 0; for (let i = 1; i < pts.length; i++) d += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return { pts, d };
}
const navMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 1.6, 1.0), transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
let navMesh = null, route = null;
function drawRoute(pts) {
  if (navMesh) { scene.remove(navMesh); navMesh.geometry.dispose(); navMesh = null; }
  if (!pts || pts.length < 2) return;
  const pos = [], idx = []; let v = 0;
  for (let i = 1; i < pts.length; i++) {
    const [ax, az] = pts[i - 1], [bx, bz] = pts[i], L = Math.hypot(bx - ax, bz - az); if (L < 0.1) continue; const nx = -(bz - az) / L * 0.3, nz = (bx - ax) / L * 0.3;
    // little chevrons rather than one long stripe: reads as sat-nav and hides the joins
    for (let t = (i === 1 ? 4 : 0); t < L - 0.8; t += 2.2) { const cx = ax + (bx - ax) * t / L, cz = az + (bz - az) * t / L, fx = (bx - ax) / L * 0.7, fz = (bz - az) / L * 0.7;
      pos.push(cx + nx * 2, 0.05, cz + nz * 2, cx + fx, 0.05, cz + fz, cx - nx * 2, 0.05, cz - nz * 2, cx + nx * 2 - fx * 0.6, 0.05, cz + nz * 2 - fz * 0.6, cx - fx * 0.0, 0.05, cz - fz * 0.0, cx - nx * 2 - fx * 0.6, 0.05, cz - nz * 2 - fz * 0.6);
      idx.push(v, v + 1, v + 4, v, v + 4, v + 3, v + 1, v + 2, v + 5, v + 1, v + 5, v + 4); v += 6; }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
  navMesh = new THREE.Mesh(g, navMat); navMesh.frustumCulled = false; scene.add(navMesh);
}
function turnInfo() { // next instruction for the HUD
  if (!route || route.pts.length < 2) return null;
  const pts = route.pts; let d = Math.hypot(pts[1][0] - px, pts[1][1] - pz);
  for (let i = 1; i < pts.length - 1; i++) {
    const a = pts[i - 1], b = pts[i], c = pts[i + 1], ax = b[0] - a[0], az = b[1] - a[1], bx = c[0] - b[0], bz = c[1] - b[1];
    const cross = ax * bz - az * bx, la = Math.hypot(ax, az), lb = Math.hypot(bx, bz);
    if (la > 0.1 && lb > 0.1 && Math.abs(cross / (la * lb)) > 0.5) { const onto = roadOf((b[0] + c[0]) / 2, (b[1] + c[1]) / 2); const name = onto.vert ? COLS[onto.a[0]] : ROWS[onto.a[1]]; return { dir: cross > 0 ? "right" : "left", d, name }; }
    d += Math.hypot(c[0] - b[0], c[1] - b[1]);
  }
  return { dir: "dest", d: route.d };
}

// ---------------------------------------------------------------- traffic: cars drive the grid, keep left, wait at junctions
const traffic = [];
const leftOf = (d) => [d[1], -d[0]];
function spawnCar() {
  const want = save.set.hi ? 16 : 11; if (traffic.length >= want) return;
  for (let tries = 0; tries < 8; tries++) {
    const k = Math.floor(Math.random() * (N + 1)), l = Math.floor(Math.random() * (N + 1)), nb = pick(nbrs(k, l));
    const a = [k, l], b = nb, A = nodeP(...a), B = nodeP(...b), d = [(B[0] - A[0]) / PITCH, (B[1] - A[1]) / PITCH], t = rnd(8, PITCH - 10), lf = leftOf(d);
    const x = A[0] + d[0] * t + lf[0] * LANE, z = A[1] + d[1] * t + lf[1] * LANE, dist = Math.hypot(x - px, z - pz);
    if (dist < 55 || dist > 150) continue;
    if (traffic.some((c) => Math.hypot(c.x - x, c.z - z) < 14)) continue;
    const r = Math.random(), kind = r < 0.1 ? "bus" : r < 0.24 ? "cab" : r < 0.3 ? "police" : r < 0.4 ? "van" : "car";
    const v = makeVehicle(kind); scene.add(v.g);
    traffic.push({ ...v, a, b, d, t, mode: "edge", x, z, h: Math.atan2(d[0], -d[1]), v: 0, vmax: kind === "bus" ? 7 : kind === "police" ? 13 : rnd(8.5, 11.5), wait: 0, nm: false });
    return;
  }
}
function stepTraffic(dt) {
  if (Math.random() < dt * 3) spawnCar();
  for (let i = traffic.length - 1; i >= 0; i--) {
    const c = traffic[i], f = [Math.sin(c.h), -Math.cos(c.h)];
    let want = c.vmax;
    // keep a gap behind whatever's ahead in our lane (cars and the rider)
    for (const o of traffic) { if (o === c) continue; const dx = o.x - c.x, dz = o.z - c.z, ahead = dx * f[0] + dz * f[1], lat = Math.abs(dx * f[1] - dz * f[0]); if (ahead > 0 && ahead < c.L / 2 + o.L / 2 + 7 && lat < 1.9) want = Math.min(want, ahead < c.L / 2 + o.L / 2 + 2.5 ? 0 : o.v * 0.9); }
    { const dx = px - c.x, dz = pz - c.z, ahead = dx * f[0] + dz * f[1], lat = Math.abs(dx * f[1] - dz * f[0]); if (ahead > 0 && ahead < c.L / 2 + 6 && lat < 1.8) want = Math.min(want, ahead < c.L / 2 + 2 ? 0 : speed * 0.8); }
    for (const p of parked) { const dx = p.x - c.x, dz = p.z - c.z, ahead = dx * f[0] + dz * f[1], lat = Math.abs(dx * f[1] - dz * f[0]); if (ahead > 0 && ahead < 9 && lat < 1.4) want = 0; }
    if (c.mode === "edge" && c.t > PITCH - 13) { // approaching a junction: give way if it's busy
      const B = nodeP(...c.b), busy = traffic.some((o) => o !== c && o.mode === "turn" && Math.hypot(o.x - B[0], o.z - B[1]) < 9);
      if (busy && c.wait < 3) { want = Math.min(want, Math.max(0, (PITCH - 7 - c.t) * 1.2)); c.wait += dt; } else want = Math.min(want, 6.5);
    }
    c.v += clamp(want - c.v, -9 * dt, 3.5 * dt); if (c.v < 0) c.v = 0;
    if (c.mode === "edge") {
      c.t += c.v * dt;
      const A = nodeP(...c.a), lf = leftOf(c.d); c.x = A[0] + c.d[0] * c.t + lf[0] * LANE; c.z = A[1] + c.d[1] * c.t + lf[1] * LANE; c.h = Math.atan2(c.d[0], -c.d[1]);
      if (c.t >= PITCH - 6) { // pick where to go next and build the curve through the junction
        const opts = nbrs(...c.b).filter((n) => n[0] !== c.a[0] || n[1] !== c.a[1]); const straight = opts.find((n) => n[0] - c.b[0] === c.d[0] && n[1] - c.b[1] === c.d[1]);
        const nx = straight && Math.random() < 0.55 ? straight : pick(opts); const B = nodeP(...c.b), d2 = [(nx[0] - c.b[0]), (nx[1] - c.b[1])], l2 = leftOf(d2);
        const p0 = [c.x, c.z], p2 = [B[0] + d2[0] * 6 + l2[0] * LANE, B[1] + d2[1] * 6 + l2[1] * LANE];
        const p1 = (d2[0] === c.d[0] && d2[1] === c.d[1]) ? [(p0[0] + p2[0]) / 2, (p0[1] + p2[1]) / 2] : [B[0] + lf[0] * LANE + l2[0] * LANE, B[1] + lf[1] * LANE + l2[1] * LANE];
        const len = (Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) + Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) + Math.hypot(p2[0] - p0[0], p2[1] - p0[1])) / 2;
        c.mode = "turn"; c.bez = { p0, p1, p2, len, u: 0, next: nx, d2 }; c.wait = 0;
      }
    } else {
      const bz = c.bez; bz.u += (c.v * dt) / bz.len;
      const u = Math.min(1, bz.u), iu = 1 - u;
      c.x = iu * iu * bz.p0[0] + 2 * iu * u * bz.p1[0] + u * u * bz.p2[0]; c.z = iu * iu * bz.p0[1] + 2 * iu * u * bz.p1[1] + u * u * bz.p2[1];
      const tx = 2 * iu * (bz.p1[0] - bz.p0[0]) + 2 * u * (bz.p2[0] - bz.p1[0]), tz = 2 * iu * (bz.p1[1] - bz.p0[1]) + 2 * u * (bz.p2[1] - bz.p1[1]); c.h = Math.atan2(tx, -tz);
      if (bz.u >= 1) { c.a = c.b; c.b = bz.next; c.d = bz.d2; c.t = 6; c.mode = "edge"; }
    }
    c.g.position.set(c.x, 0, c.z); c.g.rotation.y = -c.h;
    if (c.extra) { const on = Math.floor(performance.now() / 160) % 2 === 0; c.extra[0].visible = on; c.extra[1].visible = !on; }
    const dist = Math.hypot(c.x - px, c.z - pz);
    if (dist > 175) { scene.remove(c.g); c.g.traverse((m) => m.geometry && m.geometry.dispose()); traffic.splice(i, 1); continue; }
    // hits and near misses
    if (state === "play") {
      const dx = px - c.x, dz = pz - c.z, fl = dx * f[0] + dz * f[1], la = Math.abs(dx * f[1] - dz * f[0]);
      if (Math.abs(fl) < c.L / 2 + 0.55 && la < c.W / 2 + 0.38) crash(c);
      else if (!c.nm && speed > 9 && Math.abs(fl) < c.L / 2 + 0.6 && la < c.W / 2 + 1.25 && invul <= 0) { c.nm = true; nearMiss(); }
      if (dist > 20) c.nm = false;
    }
  }
}

// ---------------------------------------------------------------- game state
let state = "attract";              // attract, play, paused, over
let px = 0, pz = 0, heading = 0, speed = 0, throttle = 0.45, steerV = 0, invul = 0, shake = 0, bounce = 0, camYaw = 0;
let tLeft = SHIFT, cash = 0, tipsShift = 0, delivered = 0, perfects = 0, nearMisses = 0, crashes = 0, dents = 0, declines = 0, ratings = [], combo = 0, comboT = 0, endTimer = 0, endWhy = "";
let order = null, offerIn = 2, temp = 100, charging = false, power = 0, chargeT = 0, cooldown = 0, armSwing = 0;
const flying = [];
const input = { l: false, r: false, up: false, down: false };
const fwd = (h) => [Math.sin(h), -Math.cos(h)];
const upg = () => ({ vmax: 15 + lvl("engine") * 1.6, acc: 6 + lvl("engine") * 0.8, turn: 1.9 + lvl("handling") * 0.18, decay: 0.55 - lvl("box") * 0.08, perfectR: 0.9 + lvl("arm") * 0.15, swing: 1.0 + lvl("arm") * 0.12, grip: 1 - lvl("tyres") * 0.12 });
let U = upg();
const start0 = { x: 0, z: 0, h: 0 };
function resetRun() {
  const t = takeaways[0];   // start outside the kebab shop, facing along the kerb
  const along = [-t.n[1], t.n[0]]; heading = Math.atan2(along[0], -along[1]); px = t.x + t.n[0] * 0.6 - along[0] * 6; pz = t.z + t.n[1] * 0.6 - along[1] * 6;
  start0.x = px; start0.z = pz; start0.h = heading; camYaw = heading;
  speed = 0; throttle = 0.45; steerV = 0; invul = 0; dents = 0; tLeft = SHIFT; cash = 0; tipsShift = 0; delivered = 0; perfects = 0; nearMisses = 0; crashes = 0; declines = 0; ratings = []; combo = 0; comboT = 0; endTimer = 0;
  order = null; offerIn = 2.2; temp = 100; charging = false; cooldown = 0; route = null; drawRoute(null); marker.visible = false; pickupMk.visible = false;
  for (const f of flying) scene.remove(f.m); flying.length = 0;
  for (const c of traffic) scene.remove(c.g); traffic.length = 0;
  placePeds(px, pz); setLever(throttle);
}

// ---------------------------------------------------------------- markers
const marker = new THREE.Group(); scene.add(marker); marker.visible = false;
{ const b = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 22, 20, 1, true), new THREE.MeshBasicMaterial({ map: beamTex, color: 0x2ee59d, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false })); b.position.y = 11; marker.add(b);
  const r = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.75, 40), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 2.2, 1.4), transparent: true, depthWrite: false, side: THREE.DoubleSide })); r.rotation.x = -Math.PI / 2; r.position.y = 0.2; marker.add(r); marker.userData.ring = r; }
const pickupMk = new THREE.Group(); scene.add(pickupMk); pickupMk.visible = false;
{ const r = new THREE.Mesh(new THREE.RingGeometry(2.6, 3.0, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.4, 0.3), transparent: true, depthWrite: false, side: THREE.DoubleSide })); r.rotation.x = -Math.PI / 2; r.position.y = 0.06; pickupMk.add(r);
  const b = new THREE.Mesh(new THREE.CylinderGeometry(2.8, 2.8, 3, 32, 1, true), new THREE.MeshBasicMaterial({ map: beamTex, color: 0xffb030, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); b.position.y = 1.5; pickupMk.add(b); }
const aimPts = new Float32Array(28 * 3), aimGeo = new THREE.BufferGeometry(); aimGeo.setAttribute("position", new THREE.BufferAttribute(aimPts, 3));
const aimLine = new THREE.Points(aimGeo, new THREE.PointsMaterial({ size: 0.28, map: radial, color: 0xffffff, transparent: true, depthWrite: false, depthTest: false })); aimLine.visible = false; aimLine.frustumCulled = false; aimLine.renderOrder = 5; scene.add(aimLine);
const aimRing = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.68, 32), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthTest: false, side: THREE.DoubleSide })); aimRing.rotation.x = -Math.PI / 2; aimRing.visible = false; aimRing.renderOrder = 6; scene.add(aimRing);
const kebabGeo = new THREE.CylinderGeometry(0.11, 0.08, 0.34, 10);
const NP = 220, pPos = new Float32Array(NP * 3), pCol = new Float32Array(NP * 3), pVel = new Float32Array(NP * 3), pLife = new Float32Array(NP);
const pGeo = new THREE.BufferGeometry(); pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3)); pGeo.setAttribute("color", new THREE.BufferAttribute(pCol, 3));
const sparks = new THREE.Points(pGeo, new THREE.PointsMaterial({ size: 0.28, map: radial, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); sparks.frustumCulled = false; scene.add(sparks);
let pNext = 0;
function burst(x, y, z, n, col, spd, up = 3) { const c = new THREE.Color(col); for (let i = 0; i < n; i++) { const k = pNext++ % NP; pPos.set([x, y, z], k * 3); pVel.set([rnd(-1, 1) * spd, rnd(0.3, 1) * up, rnd(-1, 1) * spd], k * 3); pCol.set([c.r, c.g, c.b], k * 3); pLife[k] = rnd(0.5, 1.1); } }
function stepSparks(dt) { for (let k = 0; k < NP; k++) { if (pLife[k] <= 0) { pPos[k * 3 + 1] = -50; continue; } pLife[k] -= dt; pVel[k * 3 + 1] -= 9 * dt; for (let a = 0; a < 3; a++) pPos[k * 3 + a] += pVel[k * 3 + a] * dt; } pGeo.attributes.position.needsUpdate = true; }

// ---------------------------------------------------------------- sound
let AC = null, eng = null, rainG = null, crowdG = null, musicBus = null;
function audioOn() {
  try {
    AC = PUB.ctx(); if (AC.state === "suspended") AC.resume(); if (eng) return;
    const master = AC.createGain(); master.gain.value = 0.0001; master.connect(AC.destination);
    const motor = AC.createGain(); motor.gain.value = 0.0001; const ex = AC.createBiquadFilter(); ex.type = "lowpass"; ex.frequency.value = 620; ex.Q.value = 1.1; ex.connect(motor); motor.connect(master);
    const o1 = AC.createOscillator(), o2 = AC.createOscillator(), o3 = AC.createOscillator(), sub = AC.createOscillator(); o1.type = o2.type = "sawtooth"; o3.type = "square"; sub.type = "triangle";
    const gs = [0.28, 0.12, 0.025, 0.25].map((v) => { const g = AC.createGain(); g.gain.value = v; return g; });
    [o1, o2, o3, sub].forEach((o, i) => o.connect(gs[i]).connect(ex));
    const lfo = AC.createOscillator(), lg = AC.createGain(); lfo.frequency.value = 22; lg.gain.value = 8; lfo.connect(lg); lg.connect(o1.frequency); lg.connect(o2.frequency);
    [o1, o2, o3, sub, lfo].forEach((o) => o.start());
    const buf = AC.createBuffer(1, AC.sampleRate * 3, AC.sampleRate), d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.55;
    const src = AC.createBufferSource(); src.buffer = buf; src.loop = true; src.start();
    const chain = (type, f, q) => { const fl = AC.createBiquadFilter(); fl.type = type; fl.frequency.value = f; if (q) fl.Q.value = q; const g = AC.createGain(); g.gain.value = 0.0001; src.connect(fl).connect(g).connect(master); return g; };
    const wind = chain("lowpass", 900), roadN = chain("bandpass", 280, 0.55); rainG = chain("highpass", 1400); crowdG = chain("bandpass", 700, 0.9);
    eng = { master, motor, ex, o1, o2, o3, sub, wind, roadN };
    musicBus = AC.createGain(); musicBus.gain.value = 0.0001; musicBus.connect(AC.destination);
  } catch (e) { /* sound is optional */ }
}
function stepAudio() {
  if (!AC || !eng) return; const t = AC.currentTime, muted = store.get("loMute") === "1";
  const on = !muted && (state === "play" || state === "attract") && !document.hidden, play = state === "play";
  const gear = Math.min(4, Math.floor(speed / 5.2)), inGear = (speed - gear * 5.2) / 5.2, rpm = 46 + inGear * 70 + gear * 8 + Math.abs(steerV) * 3;
  eng.o1.frequency.setTargetAtTime(rpm, t, 0.05); eng.o2.frequency.setTargetAtTime(rpm * 1.505, t, 0.06); eng.o3.frequency.setTargetAtTime(rpm * 2.01, t, 0.06); eng.sub.frequency.setTargetAtTime(rpm * 0.5, t, 0.08);
  eng.ex.frequency.setTargetAtTime(380 + speed * 70 + throttle * 300, t, 0.1);
  eng.motor.gain.setTargetAtTime(on ? (play ? 0.08 + throttle * 0.06 : 0.03) : 0.0001, t, 0.12);
  eng.wind.gain.setTargetAtTime(on && play ? 0.004 + speed * 0.0016 : 0.0001, t, 0.25); eng.roadN.gain.setTargetAtTime(on && play ? 0.01 + speed * 0.0008 : 0.0001, t, 0.2);
  rainG.gain.setTargetAtTime(on ? 0.03 * weather.rain : 0.0001, t, 0.4);
  // town chatter when near the busy streets
  const busy = Math.abs(px) < 18 || Math.abs(pz) < 18 ? 1 : 0.3; crowdG.gain.setTargetAtTime(on ? 0.004 * busy : 0.0001, t, 0.5);
  eng.master.gain.setTargetAtTime(on ? 0.8 : 0.0001, t, 0.15);
  if (gear !== stepAudio.g) { if (play && gear > (stepAudio.g ?? 0)) PUB.noise(0.08, 0.05, 900, 0, 0.4); stepAudio.g = gear; }
}
const sfx = {
  ping: () => { PUB.beep(1320, 1320, 0.12, "sine", 0.07); PUB.beep(1760, 1760, 0.18, "sine", 0.07, 0.12); },
  accept: () => { PUB.beep(880, 1320, 0.12, "triangle", 0.06); },
  decline: () => PUB.beep(500, 300, 0.15, "triangle", 0.05),
  collect: () => { [0, 0.08, 0.16].forEach((d, i) => PUB.beep([660, 880, 1100][i], [660, 880, 1100][i], 0.16, "triangle", 0.06, d)); },
  whoosh: () => PUB.noise(0.32, 0.12, 1400, 0, 0.7), thud: () => PUB.thud(),
  crash: () => { PUB.smash(); PUB.thud(); PUB.noise(0.5, 0.2, 400, 0.05); }, bump: () => { PUB.thud(); PUB.noise(0.12, 0.1, 300); },
  bell: () => { PUB.beep(659, 659, 0.45, "sine", 0.08); PUB.beep(523, 523, 0.7, "sine", 0.08, 0.32); },
  perfect: () => { [0, 0.08, 0.16, 0.24].forEach((d, i) => PUB.beep([784, 988, 1175, 1568][i], [784, 988, 1175, 1568][i], 0.22, "triangle", 0.06, d)); },
  miss: () => PUB.beep(300, 160, 0.3, "triangle", 0.06), glass: () => PUB.smash(),
  horn: () => { PUB.beep(392, 392, 0.32, "square", 0.04); PUB.beep(466, 466, 0.32, "square", 0.03); },
  near: (c) => { PUB.noise(0.25, 0.14, 2500, 0, 0.6); PUB.beep(700 + c * 120, 900 + c * 140, 0.1, "sine", 0.04); },
  tick: () => PUB.beep(900, 900, 0.03, "square", 0.02), cash: () => { PUB.beep(1500, 2300, 0.08, "sine", 0.05); PUB.beep(2000, 2600, 0.1, "sine", 0.04, 0.07); },
};
// background music: a little lo-fi beat (drums, bass, chords) scheduled on the audio clock
const music = { on: false, step: 0, next: 0, timer: null };
const CHORDS = [[57, 60, 64, 67], [53, 57, 60, 64], [48, 52, 55, 59], [55, 59, 62, 65]];
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
function note(type, f, t, dur, vol, cut = 2000, glideTo) {
  const o = AC.createOscillator(), g = AC.createGain(), fl = AC.createBiquadFilter(); o.type = type; o.frequency.setValueAtTime(f, t); if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t + dur);
  fl.type = "lowpass"; fl.frequency.value = cut; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(fl).connect(g).connect(musicBus); o.start(t); o.stop(t + dur + 0.05);
}
let noiseBuf = null;
function hit(t, dur, vol, type, f) { if (!noiseBuf) { noiseBuf = AC.createBuffer(1, AC.sampleRate, AC.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; } const s = AC.createBufferSource(), fl = AC.createBiquadFilter(), g = AC.createGain(); s.buffer = noiseBuf; fl.type = type; fl.frequency.value = f; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); s.connect(fl).connect(g).connect(musicBus); s.start(t); s.stop(t + dur + 0.02); }
function musicTick() {
  if (!music.on || !AC) return; const spb = 60 / 94 / 4;
  while (music.next < AC.currentTime + 0.25) {
    const t = music.next, s = music.step % 64, bar = Math.floor(s / 16) % 4, beat = s % 16, ch = CHORDS[bar], energy = Math.min(1, combo / 4);
    if (beat % 4 === 0 && (beat !== 12 || bar % 2)) note("sine", 120, t, 0.32, 0.5, 400, 42);
    if (beat === 4 || beat === 12) hit(t, 0.18, 0.22, "bandpass", 1800);
    if (beat % 2 === 0) hit(t, 0.05, 0.06 + energy * 0.04, "highpass", 7000);
    if ([0, 3, 6, 10, 11, 14].includes(beat)) note("sawtooth", hz(ch[0] - 24 + (beat === 11 ? 7 : 0)), t, 0.22, 0.14, 500);
    if (beat === 0) for (const n of ch) note("triangle", hz(n), t, spb * 15, 0.035, 1600);
    if (energy > 0.3 && beat % 3 === 0) note("square", hz(ch[(beat / 3) % 4 | 0] + 12), t, 0.12, 0.025, 2500);
    music.next += spb; music.step++;
  }
}
function setMusic(on) {
  if (!AC || !musicBus) { if (on) audioOn(); if (!AC || !musicBus) return; }
  const want = on && save.set.music && store.get("loMute") !== "1";
  musicBus.gain.setTargetAtTime(want ? 0.5 : 0.0001, AC.currentTime, 0.3);
  if (want && !music.on) { music.on = true; music.next = AC.currentTime + 0.1; clearInterval(music.timer); music.timer = setInterval(musicTick, 90); }
  if (!want && music.on) { music.on = false; clearInterval(music.timer); }
}

// ---------------------------------------------------------------- orders (Uber-style)
const money = (v) => "£" + v.toFixed(2);
function makeOffer() {
  const t = pick(takeaways), cands = houses.filter((h) => { const d = Math.hypot(h.door.x - t.x, h.door.z - t.z); return d > 90 && d < 330; });
  const h = pick(cands), dist = Math.hypot(t.x - px, t.z - pz) + Math.hypot(h.door.x - t.x, h.door.z - t.z) * 1.25;
  const pay = Math.round((2.6 + dist * 0.009) * 10) / 10, items = pick(MENU);
  order = { phase: "offer", from: t, to: h, pay, items, timer: 12, eta: Math.round(dist / 9 + 20), dist };
  $("pFrom").textContent = t.name.replace("THE ", "").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()); $("pTo").textContent = h.addr;
  $("pItems").textContent = items.join(", "); $("pPay").textContent = money(pay) + " + tip"; $("pDist").textContent = (dist / 1609).toFixed(1) + " mi"; $("pEta").textContent = Math.max(1, Math.round(order.eta / 60)) + " min";
  $("phone").classList.add("on"); sfx.ping(); if (navigator.vibrate) try { navigator.vibrate([40, 60, 40]); } catch (e) {}
}
function acceptOrder() {
  if (!order || order.phase !== "offer") return; sfx.accept(); $("phone").classList.remove("on"); declines = 0;
  order.phase = "pickup"; order.timeAllowed = order.eta + 25; order.clock = 0;
  pickupMk.position.set(order.from.x, 0, order.from.z); pickupMk.visible = true; reroute(); toast(`Head to ${order.from.name.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}`, "Follow the sat-nav");
}
function declineOrder(auto) {
  if (!order || order.phase !== "offer") return; $("phone").classList.remove("on"); order = null; offerIn = rnd(2.5, 4.5); declines++;
  if (!auto) sfx.decline(); if (declines >= 3) { ratings.push(3); toast("Rating dropped", "Too many orders declined", "bad"); declines = 0; }
}
function reroute() {
  if (!order) { route = null; drawRoute(null); return; }
  const tgt = order.phase === "pickup" ? order.from : order.to;
  const tx = order.phase === "pickup" ? tgt.x : tgt.door.x + tgt.n[0] * (PV + 2.2), tz = order.phase === "pickup" ? tgt.z : tgt.door.z + tgt.n[1] * (PV + 2.2);
  route = routeTo(tx, tz); drawRoute(route.pts);
}
function rating() { if (!ratings.length) return 5; return ratings.slice(-10).reduce((a, b) => a + b, 0) / Math.min(10, ratings.length); }

// ---------------------------------------------------------------- crashes, near misses, combos
function crash(what) {
  if (invul > 0) return;
  const hard = speed > 5 || (what && what.v > 4);
  invul = 1.6; shake = 0.8; flashHit(); sfx.crash(); if (what && what.kind) setTimeout(sfx.horn, 220);
  burst(px, 1, pz, 24, 0xffc060, 4, 4); speed *= 0.2; combo = 0;
  if (what && what.x != null) { const dx = px - what.x, dz = pz - what.z, l = Math.hypot(dx, dz) || 1; px += dx / l * 1.2; pz += dz / l * 1.2; }
  if (!hard) return;
  dents++; crashes++; temp = Math.max(0, temp - 8);
  if (dents >= 3) { showPop("KNACKERED!", "Three crashes and the scooter's had it", "bad"); endShift("knackered"); } else showPop("OOF!", `Dent ${dents} of 3`, "bad");
}
function nearMiss() { nearMisses++; combo++; comboT = 4; const b = 0.25 * Math.min(combo, 6); cash += b; sfx.near(combo); showPop("NEAR MISS", `+${money(b)}${combo > 1 ? ` · combo ×${combo}` : ""}`, "good", 0.9); }
function flashHit() { const v = $("vignette"); v.classList.add("hit"); setTimeout(() => v.classList.remove("hit"), 140); if (navigator.vibrate) try { navigator.vibrate(120); } catch (e) {} }

// ---------------------------------------------------------------- throwing
function inRange() { return order && order.phase === "deliver" && Math.hypot(order.to.door.x - px, order.to.door.z - pz) < 24; }
function aimSolve() { // where the kebab lands for the current power
  const T = 0.85, tg = order.to.door, dx = tg.x - px, dz = tg.z - pz, l = Math.hypot(dx, dz) || 1, range = 2 + power * 22, f = fwd(heading);
  return { T, lx: px + dx / l * range + f[0] * speed * T, lz: pz + dz / l * range + f[1] * speed * T, dir: [dx / l, dz / l], range };
}
function drawAim() {
  const a = aimSolve(), y0 = 1.5, vy = (0.2 - y0 + 4.9 * a.T * a.T) / a.T, f = fwd(heading);
  for (let i = 0; i < 28; i++) { const t = (i / 27) * a.T; aimPts.set([px + (a.lx - px) * (t / a.T), y0 + vy * t - 4.9 * t * t, pz + (a.lz - pz) * (t / a.T)], i * 3); }
  aimGeo.attributes.position.needsUpdate = true; aimLine.visible = true; aimRing.position.set(a.lx, 0.3, a.lz); aimRing.visible = true;
  const d = Math.hypot(a.lx - order.to.door.x, a.lz - order.to.door.z); aimRing.material.color.set(d <= U.perfectR ? 0x2ee59d : d <= 1.8 ? 0xffd23a : d <= 3.2 ? 0xff9a3a : 0xffffff); void f;
}
function throwKebab() {
  if (cooldown > 0 || !inRange()) return; const a = aimSolve();
  const m = new THREE.Group(); const k = new THREE.Mesh(kebabGeo, M.kebab); k.rotation.z = Math.PI / 2; m.add(k); m.position.set(px, 1.5, pz); scene.add(m);
  flying.push({ m, x0: px, z0: pz, lx: a.lx, lz: a.lz, T: a.T, t: 0, vy: (0.2 - 1.5 + 4.9 * a.T * a.T) / a.T });
  cooldown = 0.5; sfx.whoosh(); armSwing = 0.4;
}
function landed(f) {
  f.done = true; setTimeout(() => scene.remove(f.m), 2500); if (!order || order.phase !== "deliver") { sfx.thud(); return; }
  const h = order.to, d = Math.hypot(f.lx - h.door.x, f.lz - h.door.z);
  const into = (f.lx - h.x) * -h.n[0] + (f.lz - h.z) * -h.n[1]; // how far behind the front wall
  if (into > 0.6 && Math.abs((f.lx - h.x) * -h.n[1] + (f.lz - h.z) * h.n[0]) < h.w / 2 + 2) { sfx.glass(); burst(f.lx, 1.5, f.lz, 18, 0xbfe0ff, 2.5, 2); showPop("SMASH!", "That's a window, not a doormat", "bad", 1); say(pick(SAY.window), f.lx, f.lz); cash = Math.max(0, cash - 1); return; }
  const grade = d <= U.perfectR ? "perfect" : d <= 1.8 ? "good" : d <= 3.2 ? "ok" : null;
  if (!grade) { const other = houses.find((o) => o !== h && Math.hypot(f.lx - o.door.x, f.lz - o.door.z) < 1.6); sfx.miss(); if (other) { showPop("WRONG HOUSE!", "Have another go", "bad", 1); say(pick(SAY.wrong), other.door.x, other.door.z); } else showPop("MISSED!", "Have another go", "bad", 0.9); return; }
  // paid!
  const late = order.clock > order.timeAllowed, base = late ? order.pay * 0.7 : order.pay;
  const tip = Math.round(({ perfect: 1.6, good: 0.9, ok: 0.3 }[grade] + temp / 100 * 1.4 + (speed > 8 ? 0.5 : 0) + (late ? -0.4 : 0.3)) * 10) / 10;
  const total = Math.max(0, base + Math.max(0, tip)); cash += total; tipsShift += Math.max(0, tip); delivered++; if (grade === "perfect") perfects++;
  const stars = clamp(Math.round((grade === "perfect" ? 5 : grade === "good" ? 4.5 : 3.6) - (late ? 1 : 0) - (temp < 30 ? 1 : 0)), 1, 5); ratings.push(stars);
  combo++; comboT = 4;
  sfx.thud(); setTimeout(sfx.bell, 200); setTimeout(sfx.cash, 450); if (grade === "perfect") { sfx.perfect(); burst(h.door.x, 0.6, h.door.z, 40, 0xffd23a, 2.5, 5); } else burst(h.door.x, 0.5, h.door.z, 18, 0x2ee59d, 1.8, 3);
  say(temp < 25 ? pick(SAY.cold) : pick(SAY[grade]), h.door.x, h.door.z);
  delivery({ grade, base, tip: Math.max(0, tip), total, stars, late, driveBy: speed > 8 });
  order = null; route = null; drawRoute(null); marker.visible = false; offerIn = rnd(2, 3.5); temp = 100;
}
function delivery(r) {
  const el = $("dsuc"); $("dTitle").textContent = { perfect: "PERFECT DELIVERY!", good: "DELIVERED!", ok: "DELIVERED" }[r.grade];
  $("dStars").innerHTML = [0, 1, 2, 3, 4].map((i) => `<i class="${i < r.stars ? "on" : ""}">★</i>`).join("");
  $("dPay").textContent = "+" + money(r.total);
  $("dRows").innerHTML = [["Fare", money(r.base)], ["Tip", money(r.tip)], r.driveBy ? ["Drive-by bonus", "✓"] : null, r.late ? ["Late", "−30%"] : null].filter(Boolean).map(([a, b]) => `<span>${a} <b>${b}</b></span>`).join("");
  el.classList.remove("on"); void el.offsetWidth; el.classList.add("on"); clearTimeout(delivery.t); delivery.t = setTimeout(() => el.classList.remove("on"), 2600);
}

// ---------------------------------------------------------------- HUD
let popT = null, sayT = null, sayAt = null, toastT = null;
function showPop(big, small, cls = "", dur = 1.2) { const el = $("pop"); el.className = "pop " + cls; el.innerHTML = `${big}${small ? `<small>${small}</small>` : ""}`; void el.offsetWidth; el.classList.add("on"); clearTimeout(popT); popT = setTimeout(() => el.classList.remove("on"), dur * 1100); }
function say(text, x, z) { const el = $("say"); el.textContent = text; sayAt = new THREE.Vector3(x, 2.8, z); el.classList.add("on"); clearTimeout(sayT); sayT = setTimeout(() => { el.classList.remove("on"); sayAt = null; }, 1900); }
function toast(a, b, cls = "") { const el = $("toast"); el.className = "toast " + cls; el.innerHTML = `<b>${a}</b>${b ? `<small>${b}</small>` : ""}`; void el.offsetWidth; el.classList.add("on"); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove("on"), 2400); }
const mapCtx = $("map").getContext("2d");
function drawMap() {
  const g = mapCtx, W = 208, S = 0.62; g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = "#2a2e38"; g.fillRect(0, 0, W, W);
  g.save(); g.translate(W / 2, W * 0.6); g.rotate(-camYaw); g.scale(S, S); g.translate(-px, -pz);
  g.fillStyle = "#14161c"; g.fillRect(-EDGE - 40, -EDGE - 40, 2 * EDGE + 80, 2 * EDGE + 80);
  g.fillStyle = "#2c303a"; g.fillRect(-EDGE, -EDGE, 2 * EDGE, 2 * EDGE);
  for (const b of blocks) { g.fillStyle = b.park ? "#1e3a22" : "#171a22"; g.fillRect(b.cx - BS / 2, b.cz - BS / 2, BS, BS); }
  for (const t of takeaways) { g.fillStyle = "#ffb030"; g.beginPath(); g.arc(t.x, t.z, 4, 0, 7); g.fill(); }
  g.fillStyle = "rgba(255,255,255,.5)"; for (const c of traffic) g.fillRect(c.x - 1.2, c.z - 1.2, 2.4, 2.4);
  if (route) { g.strokeStyle = "#2ee59d"; g.lineWidth = 5; g.lineCap = g.lineJoin = "round"; g.beginPath(); route.pts.forEach(([x, z], i) => (i ? g.lineTo(x, z) : g.moveTo(x, z))); g.stroke(); }
  if (order && order.phase !== "offer") { const t = order.phase === "pickup" ? order.from : order.to.door; g.fillStyle = order.phase === "pickup" ? "#ffb030" : "#ff3b5a"; g.beginPath(); g.arc(t.x, t.z, 7, 0, 7); g.fill(); g.fillStyle = "#fff"; g.beginPath(); g.arc(t.x, t.z, 2.6, 0, 7); g.fill(); }
  g.restore();
  g.fillStyle = "#fff"; g.beginPath(); g.moveTo(W / 2, W * 0.6 - 11); g.lineTo(W / 2 + 8, W * 0.6 + 8); g.lineTo(W / 2, W * 0.6 + 3); g.lineTo(W / 2 - 8, W * 0.6 + 8); g.closePath(); g.fill();
}
const NAV_SVG = { left: "M16 20v-8a3 3 0 0 0-3-3H6M9 5 5 9l4 4", right: "M8 20v-8a3 3 0 0 1 3-3h7M15 5l4 4-4 4", dest: "M12 21s-6-5.5-6-10a6 6 0 1 1 12 0c0 4.5-6 10-6 10zM12 9.5a1.5 1.5 0 1 0 0 .1", straight: "M12 20V5M7 10l5-5 5 5" };
function hud() {
  $("hCash").textContent = money(cash); $("hRating").textContent = rating().toFixed(1);
  const m = Math.max(0, Math.ceil(tLeft)); $("hTime").textContent = `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`; $("hTimeBox").classList.toggle("low", tLeft < 30);
  $("hDents").innerHTML = [0, 1, 2].map((i) => `<i class="${i < 3 - dents ? "" : "gone"}"></i>`).join("");
  const mph = Math.round(speed * 2.237); $("spdTxt").textContent = mph; $("needle").setAttribute("transform", `rotate(${-130 + clamp(mph / 50, 0, 1) * 260} 60 60)`); $("gearTxt").textContent = speed < 0.5 ? "N" : "GEAR " + (Math.min(4, Math.floor(speed / 5.2)) + 1);
  // job status and sat-nav
  const job = $("job");
  if (order && order.phase !== "offer") {
    job.hidden = false; const tgt = order.phase === "pickup" ? order.from : order.to;
    $("jobTitle").textContent = order.phase === "pickup" ? "Collect from " + order.from.name.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) : "Deliver to " + order.to.addr;
    const left = Math.max(0, order.timeAllowed - order.clock); $("jobSub").textContent = order.phase === "pickup" ? `${Math.round(route ? route.d : 0)} m · stop in the yellow ring` : `${Math.round(route ? route.d : 0)} m · ${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, "0")} left`;
    $("jobTemp").style.width = (order.phase === "deliver" ? temp : 100) + "%"; $("jobTemp").parentElement.hidden = order.phase !== "deliver"; void tgt;
    const ti = turnInfo(); const nav = $("nav");
    if (ti) { nav.hidden = false; $("navD").textContent = ti.d < 1000 ? Math.round(ti.d / 5) * 5 + " m" : (ti.d / 1609).toFixed(1) + " mi"; $("navS").textContent = ti.dir === "dest" ? (order.phase === "pickup" ? "Takeaway ahead" : "Destination ahead") : `Turn ${ti.dir} onto ${ti.name}`; $("navP").setAttribute("d", NAV_SVG[ti.dir]); } else nav.hidden = true;
  } else { job.hidden = true; $("nav").hidden = true; }
  $("throwBtn").classList.toggle("ready", !!inRange()); $("throwBtn").classList.toggle("off", !inRange());
  $("combo").textContent = combo > 1 ? `COMBO ×${combo}` : ""; $("combo").classList.toggle("on", combo > 1);
}

// ---------------------------------------------------------------- main update
let tHud = 0, tMap = 0, tRoute = 0, tLamp = 0;
function collide() {
  // stay off the pavements (blocks are solid from the kerb in) and inside the town
  for (const b of blocks) {
    const dx = px - b.cx, dz = pz - b.cz, hx = BS / 2 + 0.45, ox = hx - Math.abs(dx), oz = hx - Math.abs(dz);
    if (ox > 0 && oz > 0) {
      const n = ox < oz ? [Math.sign(dx), 0] : [0, Math.sign(dz)]; if (ox < oz) px = b.cx + Math.sign(dx) * hx; else pz = b.cz + Math.sign(dz) * hx;
      const f = fwd(heading), into = -(f[0] * n[0] + f[1] * n[1]);
      if (into > 0.2 && speed > 3) { // glance off the kerb
        const t = [f[0] + n[0] * into, f[1] + n[1] * into]; heading = Math.atan2(t[0], -t[1]); speed *= 1 - into * 0.6; bounce = 0.3; shake = Math.max(shake, into * 0.4);
        if (into > 0.75 && speed > 9 / U.grip) crash({ x: px - n[0], z: pz - n[1] }); else if (into > 0.3) sfx.bump();
      }
    }
  }
  if (Math.abs(px) > EDGE) { px = Math.sign(px) * EDGE; speed *= 0.7; } if (Math.abs(pz) > EDGE) { pz = Math.sign(pz) * EDGE; speed *= 0.7; }
  for (const p of parked) { const dx = px - p.x, dz = pz - p.z; if (Math.abs(dx) < p.hw + 0.4 && Math.abs(dz) < p.hl + 0.4) { if (speed > 5) crash({ x: p.x, z: p.z }); const ox = p.hw + 0.4 - Math.abs(dx), oz = p.hl + 0.4 - Math.abs(dz); if (ox < oz) px = p.x + Math.sign(dx) * (p.hw + 0.4); else pz = p.z + Math.sign(dz) * (p.hl + 0.4); speed *= 0.6; } }
}
function update(dt) {
  const play = state === "play", attract = state === "attract";
  if (state === "paused") return;
  if (play) {
    const steer = (input.l ? -1 : 0) + (input.r ? 1 : 0);
    if (input.up) setLever(Math.min(1, throttle + dt * 0.6)); if (input.down) setLever(Math.max(0, throttle - dt * 0.9));
    const target = throttle * U.vmax, wetGrip = 1 - weather.wet * 0.12 * U.grip;
    speed += clamp(target - speed, -12 * dt, U.acc * (1 - speed / (U.vmax * 1.25)) * dt);
    steerV += (steer - steerV) * Math.min(1, dt * 8);
    const turn = U.turn * wetGrip * (speed < 0.3 ? 0.4 : clamp(0.55 + speed / 14, 0.55, 1.15)) * (1 - clamp((speed - 12) / 20, 0, 0.3));
    heading = wrap(heading + steerV * turn * dt);
    if (Math.abs(steer) < 0.1 && speed > 2) { const ax = Math.round(heading / (Math.PI / 2)) * (Math.PI / 2), dd = wrap(ax - heading); if (Math.abs(dd) < 0.3) heading = wrap(heading + dd * Math.min(1, dt * 2.4)); }
    const f = fwd(heading); px += f[0] * speed * dt; pz += f[1] * speed * dt;
    collide();
    tLeft -= dt; if (invul > 0) invul -= dt; if (cooldown > 0) cooldown -= dt;
    if (comboT > 0) { comboT -= dt; if (comboT <= 0) combo = 0; }
    // orders
    if (!order) { offerIn -= dt; if (offerIn <= 0) makeOffer(); }
    else if (order.phase === "offer") { order.timer -= dt; $("pBar").style.width = (order.timer / 12 * 100) + "%"; if (order.timer <= 0) declineOrder(true); }
    else {
      order.clock += dt;
      if (order.phase === "pickup" && Math.hypot(px - order.from.x, pz - order.from.z) < 3.4 && speed < 4) {
        order.phase = "deliver"; temp = 100; sfx.collect(); pickupMk.visible = false; marker.visible = true; marker.position.set(order.to.door.x, 0, order.to.door.z); reroute();
        toast("Order collected!", `Deliver to ${order.to.addr}`, "good"); burst(px, 1.4, pz, 20, 0xffb030, 2, 3);
      }
      if (order.phase === "deliver") temp = Math.max(0, temp - U.decay * (1 + weather.rain * 0.3) * dt);
      tRoute += dt; if (tRoute > 0.5) { tRoute = 0; reroute(); }
    }
    if (charging) { if (!inRange()) cancelCharge(); else { chargeT += dt; const ph = (chargeT / U.swing) % 2; power = ph < 1 ? ph : 2 - ph; drawAim(); $("powerArc").style.strokeDashoffset = String(283 * (1 - power)); } }
    if (tLeft <= 0 && endTimer <= 0) endShift("time");
    if (endTimer > 0) { endTimer -= dt; if (endTimer <= 0) finish(); }
  } else if (attract) { speed = 0; }
  // traffic, people, weather
  stepTraffic(dt); stepPeds(dt);
  for (const f of flying) { if (f.done) continue; f.t += dt; const t = Math.min(f.t, f.T), u = t / f.T; f.m.position.set(f.x0 + (f.lx - f.x0) * u, 1.5 + f.vy * t - 4.9 * t * t, f.z0 + (f.lz - f.z0) * u); f.m.rotation.x += dt * 9; f.m.rotation.y += dt * 5; if (f.t >= f.T) landed(f); }
  // rider pose
  bounce = Math.max(0, bounce - dt * 1.8);
  bike.position.set(px, Math.sin(bounce * 14) * bounce * 0.3, pz); bike.rotation.y = -heading;
  lean.rotation.z = -steerV * clamp(speed / 10, 0, 1) * 0.32; lean.rotation.x = speed < 1 ? 0 : -0.01;
  armSwing *= Math.pow(0.03, dt); arms[1].rotation.set(-1.05 - armSwing * 3, 0, 0.2 + armSwing * 2);
  bike.visible = !(invul > 0 && Math.floor(invul * 12) % 2 === 0 && play);
  // the nearest street lamps get real lights (the rest are glow decals)
  tLamp += dt; if (tLamp > 0.25) { tLamp = 0; const near = lamps.map((l) => [Math.hypot(l.x - px, l.z - pz), l]).sort((a, b) => a[0] - b[0]); LAMPS_LIVE.forEach((L, i) => { const n = near[i]; if (!n || i >= (save.set.hi ? 6 : 3)) { L.intensity = 0; return; } L.position.set(n[1].x, 6.8, n[1].z); L.intensity = weather.sky === "dusk" ? 45 : 70; }); }
  moon.position.set(px + 30, 40, pz + 20); moon.target.position.set(px, 0, pz);
  if (weather.sky === "dusk") moon.position.set(px - 40, 25, pz - 60);
  if (marker.visible) { const s = 1 + Math.sin(performance.now() / 180) * 0.12; marker.userData.ring.scale.set(s, s, 1); }
  if (pickupMk.visible) pickupMk.rotation.y += dt * 0.5;
  skyline.position.set(camera.position.x, 22, camera.position.z); sky.position.copy(camera.position);
  stepSparks(dt); stepRain(dt, px, pz); stepAudio();
  if (grade) grade.uniforms.uSpeed.value += (clamp((speed - 9) / 12, 0, 1) * 0.8 - grade.uniforms.uSpeed.value) * Math.min(1, dt * 3);
  tHud += dt; if (play && tHud > 0.1) { tHud = 0; hud(); }
  tMap += dt; if (play && tMap > 0.08) { tMap = 0; drawMap(); }
  if (sayAt) { const p = sayAt.clone().project(camera), el = $("say"); el.style.left = ((p.x + 1) / 2 * innerWidth) + "px"; el.style.top = ((1 - p.y) / 2 * innerHeight) + "px"; el.style.visibility = p.z < 1 ? "visible" : "hidden"; }
}

// ---------------------------------------------------------------- camera: always behind the rider
const camPos = new THREE.Vector3(0, 6, 10), camLook = new THREE.Vector3();
function insideBlock(x, z, pad = 0) { for (const b of blocks) if (Math.abs(x - b.cx) < BS / 2 - 3 + pad && Math.abs(z - b.cz) < BS / 2 - 3 + pad) return true; return false; }
function frameCamera(dt, now) {
  if (state === "attract") {
    const a = now / 9000, r = 9; camPos.set(px + Math.sin(a) * r, 3.4, pz + Math.cos(a) * r); camera.position.copy(camPos); camera.lookAt(px, 1.1, pz); camera.fov = 50; camera.updateProjectionMatrix(); return;
  }
  // the camera's direction trails the rider's heading but never more than ~45°, so it can't swing round in front
  const diff = wrap(heading - camYaw); camYaw = wrap(camYaw + diff * Math.min(1, dt * 3.2)); const lag = wrap(heading - camYaw); if (Math.abs(lag) > 0.8) camYaw = wrap(heading - Math.sign(lag) * 0.8);
  const P = portrait, back = (P ? 7.4 : 6.4) + speed * 0.08, h = (P ? 3.7 : 2.9) + speed * 0.03, ahead = P ? 16 : 14, f = fwd(camYaw);
  let bx = px - f[0] * back, bz = pz - f[1] * back;
  for (let k = 0; k < 6 && insideBlock(bx, bz); k++) { bx = px - f[0] * back * (1 - (k + 1) * 0.14); bz = pz - f[1] * back * (1 - (k + 1) * 0.14); }  // don't end up inside a building
  camPos.lerp(_v.set(bx, h + bounce * 0.3, bz), Math.min(1, dt * 7));
  camLook.set(px + f[0] * ahead, 1.2, pz + f[1] * ahead);
  camera.position.copy(camPos);
  if (shake > 0 && save.set.shake) { camera.position.x += rnd(-1, 1) * shake * 0.3; camera.position.y += rnd(-1, 1) * shake * 0.2; } shake = Math.max(0, shake - dt * 2.2);
  camera.lookAt(camLook);
  if (save.set.shake) camera.rotateZ(-steerV * clamp(speed / 14, 0, 1) * 0.035);
  const fovBase = P ? 62 : 52; camera.fov += (fovBase + clamp(speed / 20, 0, 1) * 8 - camera.fov) * Math.min(1, dt * 3); camera.updateProjectionMatrix();
}

// ---------------------------------------------------------------- shift flow
function pickWeather() {
  if (save.set.weather !== "random") return WEATHERS.find((w) => w.k === save.set.weather) || WEATHERS[0];
  const tot = WEATHERS.reduce((a, w) => a + w.w, 0); let r = Math.random() * tot; for (const w of WEATHERS) { r -= w.w; if (r <= 0) return w; } return WEATHERS[0];
}
function startShift() {
  U = upg(); setWeather(pickWeather()); resetRun(); state = "play";
  PUB.show(null, IDS); $("hud").hidden = false; $("controls").hidden = false; $("keys").hidden = MOBILE; hud(); drawMap();
  audioOn(); setMusic(true);
  setTimeout(() => { if (state === "play") toast(`${weather.icon} ${weather.n}`, weather.rain > 0 ? "Roads are slippy, take corners easy" : weather.k === "fog" ? "Can't see far, follow the sat-nav" : "Shift's started. Orders incoming!"); }, 400);
}
function endShift(why) { if (state !== "play" || endTimer > 0) return; endTimer = why === "knackered" ? 1.3 : 0.6; endWhy = why; cancelCharge(); }
function finish() {
  state = "over"; setMusic(false); $("phone").classList.remove("on");
  const score = Math.round(cash * 100), stars = GOALS.filter((g) => cash >= g).length;
  const prevStars = save.stars.town || 0; if (stars > prevStars) save.stars.town = stars;
  if (stars >= 3) save.stars.seaside = Math.max(save.stars.seaside || 0, 1);   // keeps the hub's "Kebab King" badge working
  const coins = Math.round(tipsShift * 10) + delivered * 5; save.tips += coins;
  const prev = save.best; if (score > save.best) { save.best = score; if (prev > 0) PUB.record(prev, score); }
  store.set("kbDeliv", String(+(store.get("kbDeliv") || 0) + delivered)); store.set("kbPerfect", String(+(store.get("kbPerfect") || 0) + perfects));
  persist(); PUB.submit("kebab", score);
  $("oTitle").textContent = endWhy === "knackered" ? "SCOOTER'S KNACKERED" : "SHIFT OVER";
  $("oSub").textContent = `${delivered} deliver${delivered === 1 ? "y" : "ies"} · ${rating().toFixed(1)}★ rating · ${weather.n.toLowerCase()}`;
  $("oScore").textContent = money(cash); $("oBest").textContent = money(save.best / 100);
  $("oSum").innerHTML = [[`${stars >= 1 ? "★" : "☆"} Earn ${money(GOALS[0])}`, stars >= 1], [`${stars >= 2 ? "★" : "☆"} Earn ${money(GOALS[1])}`, stars >= 2], [`${stars >= 3 ? "★" : "☆"} Earn ${money(GOALS[2])}`, stars >= 3]].map(([a, ok]) => `<div><span>${a}</span><b class="${ok ? "g" : "x"}">${ok ? "Done" : "Not yet"}</b></div>`).join("")
    + [["Doormat perfects", perfects], ["Near misses", nearMisses], ["Crashes", crashes], ["Garage coins", "+" + coins]].map(([a, b]) => `<div><span>${a}</span><b>${b}</b></div>`).join("");
  [...$("oStars").children].forEach((el, i) => { el.classList.remove("on"); setTimeout(() => { el.classList.toggle("on", i < stars); if (i < stars) PUB.beep(880 + i * 220, 880 + i * 220, 0.15, "triangle", 0.06); }, 300 + i * 260); });
  $("hud").hidden = true; $("controls").hidden = true; $("keys").hidden = true;
  if (stars === 3) PUB.fanfare(); else if (stars === 0) PUB.sad();
  order = null; route = null; drawRoute(null); marker.visible = false; pickupMk.visible = false;
  setTimeout(() => PUB.show("over", IDS), 250);
  setTimeout(() => { state = state === "over" ? "attract" : state; }, 400);
}

// ---------------------------------------------------------------- menus
const IDS = ["gate", "start", "garage", "how", "pause", "over"];
function wLabel() { const w = WEATHERS.find((x) => x.k === save.set.weather); return w ? `${w.icon} ${w.n}` : "🎲 Random weather"; }
function openTitle() {
  state = "attract"; $("bestTxt").textContent = money(save.best / 100); $("tipsTxt").textContent = save.tips; $("starsTxt").textContent = (save.stars.town || 0) + " / 3";
  $("weatherBtn").textContent = wLabel(); PUB.show("start", IDS); setMusic(false);
}
function openGarage() {
  $("gTips").textContent = save.tips;
  $("ulist").innerHTML = UPG.map((u) => { const l = lvl(u.k), cost = UCOST[l]; return `<div class="urow"><b>${u.n}</b><small>${u.d}</small><span class="pips">${[0, 1, 2, 3].map((i) => `<i class="${i < l ? "on" : ""}"></i>`).join("")}</span><button type="button" data-u="${u.k}" ${l >= 4 || save.tips < cost ? "disabled" : ""}>${l >= 4 ? "MAX" : `<span class="coin"></span>${cost}`}</button></div>`; }).join("");
  $("helmets").innerHTML = HELMETS.map((h) => { const own = save.owned.includes(h.k); return `<button type="button" data-h="${h.k}" class="${save.helmet === h.k ? "on" : ""}${own ? "" : " locked"}" style="--hc:${h.c}"><i></i>${own ? h.n : h.cost + " coins"}</button>`; }).join("");
  PUB.show("garage", IDS);
}
$("ulist").addEventListener("click", (e) => { const b = e.target.closest("[data-u]"); if (!b || b.disabled) return; const k = b.dataset.u, l = lvl(k), c = UCOST[l]; if (l >= 4 || save.tips < c) return; save.tips -= c; save.up[k] = l + 1; persist(); PUB.beep(1200, 1800, 0.12, "triangle", 0.06); PUB.beep(1800, 2400, 0.15, "triangle", 0.05, 0.1); openGarage(); });
$("helmets").addEventListener("click", (e) => { const b = e.target.closest("[data-h]"); if (!b) return; const h = HELMETS.find((x) => x.k === b.dataset.h); if (!save.owned.includes(h.k)) { if (save.tips < h.cost) { PUB.beep(200, 150, 0.15, "square", 0.04); return; } save.tips -= h.cost; save.owned.push(h.k); } save.helmet = h.k; setHelmet(); persist(); PUB.pop(); openGarage(); });
let garageReturn = "start", howReturn = "start";
$("playBtn").addEventListener("click", () => { audioOn(); PUB.pop(); if (!store.get("kbHow2")) { store.set("kbHow2", "1"); howReturn = "play"; PUB.show("how", IDS); } else startShift(); });
$("weatherBtn").addEventListener("click", () => { const keys = ["random", ...WEATHERS.map((w) => w.k)]; save.set.weather = keys[(keys.indexOf(save.set.weather) + 1) % keys.length]; persist(); $("weatherBtn").textContent = wLabel(); PUB.pop(); if (save.set.weather !== "random") setWeather(WEATHERS.find((w) => w.k === save.set.weather)); });
$("garageBtn").addEventListener("click", () => { garageReturn = "start"; openGarage(); });
$("garageBack").addEventListener("click", () => (garageReturn === "over" ? PUB.show("over", IDS) : openTitle()));
$("howBtn").addEventListener("click", () => { howReturn = "start"; PUB.show("how", IDS); });
$("howOk").addEventListener("click", () => (howReturn === "play" ? startShift() : openTitle()));
$("again").addEventListener("click", () => startShift());
$("toGarage").addEventListener("click", () => { garageReturn = "over"; openGarage(); });
$("share").addEventListener("click", () => PUB.share(`I earned ${money(cash)} in one shift on Kebab Run 🥙🛵 Think you can beat it?`, $("shareMsg")));
$("accBtn").addEventListener("click", acceptOrder); $("decBtn").addEventListener("click", () => declineOrder(false));
function pause() { if (state !== "play" || endTimer > 0) return; state = "paused"; cancelCharge(); syncSettings(); PUB.show("pause", IDS); setMusic(false); }
function resume() { if (state !== "paused") return; state = "play"; PUB.show(null, IDS); setMusic(true); }
$("pauseBtn").addEventListener("click", pause); $("resumeBtn").addEventListener("click", resume);
$("restartBtn").addEventListener("click", () => { state = "attract"; startShift(); });
$("quitBtn").addEventListener("click", () => { state = "attract"; $("hud").hidden = $("controls").hidden = $("keys").hidden = true; $("phone").classList.remove("on"); order = null; route = null; drawRoute(null); marker.visible = pickupMk.visible = false; openTitle(); });
function syncSettings() { $("setMusic").checked = save.set.music; $("setShake").checked = save.set.shake; $("setHi").checked = save.set.hi; }
for (const [id, k] of [["setMusic", "music"], ["setShake", "shake"], ["setHi", "hi"]]) $(id).addEventListener("change", (e) => { save.set[k] = e.target.checked; if (k === "hi" && save.set.hi) save.set.fx = true; persist(); if (k === "hi") { setPR(); fit(); applyQuality(); setWeather(weather); } });
PUB.wireMute($("mute"));
document.addEventListener("visibilitychange", () => { if (document.hidden) pause(); });
function applyQuality() { moon.castShadow = !!save.set.hi; }

// ---------------------------------------------------------------- input: steering, the speed lever, throwing
const hold = (el, key) => {
  const on = (e) => { e.preventDefault(); input[key] = true; el.classList.add("on"); }, off = (e) => { e && e.preventDefault(); input[key] = false; el.classList.remove("on"); };
  el.addEventListener("pointerdown", (e) => { try { el.setPointerCapture(e.pointerId); } catch (x) {} on(e); }); el.addEventListener("pointerup", off); el.addEventListener("pointercancel", off); el.addEventListener("lostpointercapture", () => off());
};
hold($("leftBtn"), "l"); hold($("rightBtn"), "r");
const lever = $("lever");
function setLever(v) { throttle = clamp(v, 0, 1); lever.style.setProperty("--v", throttle); $("leverTxt").textContent = throttle < 0.04 ? "STOP" : Math.round(throttle * U.vmax * 2.237) + ""; }
{ let drag = false; const at = (e) => { const r = lever.getBoundingClientRect(); setLever(1 - (e.clientY - r.top - 22) / (r.height - 44)); };
  lever.addEventListener("pointerdown", (e) => { e.preventDefault(); drag = true; try { lever.setPointerCapture(e.pointerId); } catch (x) {} at(e); lever.classList.add("on"); });
  lever.addEventListener("pointermove", (e) => { if (drag) at(e); });
  const up = () => { drag = false; lever.classList.remove("on"); }; lever.addEventListener("pointerup", up); lever.addEventListener("pointercancel", up); }
const tb = $("throwBtn");
function startCharge() { if (state !== "play" || cooldown > 0 || charging || !inRange()) { if (state === "play" && order && order.phase === "deliver" && !inRange()) toast("Get closer to the house", "The throw button lights up when you're in range"); return; } charging = true; chargeT = 0; power = 0; tb.classList.add("on"); sfx.tick(); }
function cancelCharge() { charging = false; tb.classList.remove("on"); $("powerArc").style.strokeDashoffset = "283"; aimLine.visible = aimRing.visible = false; }
function release() { if (!charging) return; cancelCharge(); throwKebab(); }
tb.addEventListener("pointerdown", (e) => { e.preventDefault(); try { tb.setPointerCapture(e.pointerId); } catch (x) {} startCharge(); });
tb.addEventListener("pointerup", (e) => { e.preventDefault(); release(); }); tb.addEventListener("pointercancel", release);
addEventListener("keydown", (e) => {
  if (e.repeat) return; const k = e.key.toLowerCase();
  if (k === "arrowleft" || k === "a") input.l = true; else if (k === "arrowright" || k === "d") input.r = true;
  else if (k === "arrowup" || k === "w") input.up = true; else if (k === "arrowdown" || k === "s") input.down = true;
  else if (k === " ") { e.preventDefault(); startCharge(); } else if (k === "y" || k === "enter") acceptOrder(); else if (k === "n") declineOrder(false);
  else if (k === "p" || k === "escape") { if (state === "play") pause(); else if (state === "paused") resume(); }
});
addEventListener("keyup", (e) => { const k = e.key.toLowerCase(); if (k === "arrowleft" || k === "a") input.l = false; else if (k === "arrowright" || k === "d") input.r = false; else if (k === "arrowup" || k === "w") input.up = false; else if (k === "arrowdown" || k === "s") input.down = false; else if (k === " ") release(); });

// ---------------------------------------------------------------- loop
let last = performance.now(), fpsT = 0, frames = 0, slowFor = 0;
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  for (let i = 0; i < (window.__krSteps || 1); i++) update(dt);   // __krSteps: test-only fast-forward
  frameCamera(dt, now);
  if (composer && save.set.fx) composer.render(); else renderer.render(scene, camera);
  frames++; fpsT += dt; if (fpsT > 1) { const fps = frames / fpsT; frames = 0; fpsT = 0; slowFor = fps < 36 ? slowFor + 1 : 0;
    if (slowFor >= 3 && save.set.hi) { save.set.hi = false; slowFor = 0; persist(); setPR(); fit(); applyQuality(); setWeather(weather); }
    else if (slowFor >= 4 && save.set.fx) { save.set.fx = false; slowFor = 0; persist(); } }
  requestAnimationFrame(loop);
}
const tB = performance.now(); buildTown(); window.__kbBuild = Math.round(performance.now() - tB); applyQuality(); fit(); setWeather(pickWeather()); resetRun();
requestAnimationFrame((t) => { last = t; loop(t); setTimeout(() => $("loading").classList.add("done"), 300); });
PUB.gate(openTitle);
// a tiny hook for automated checks
window.__kr = { info: () => ({ build: window.__kbBuild, calls: renderer.info.render.calls, tris: renderer.info.render.triangles }), get: () => ({ state, px, pz, heading, speed, throttle, cash, delivered, dents, order: order && { phase: order.phase, to: order.to.addr, from: order.from.name, door: order.to.door, pickup: [order.from.x, order.from.z] }, traffic: traffic.length, weather: weather.k, route: route && route.d, inRange: !!inRange() }),
  set: (o) => { if ("px" in o) px = o.px; if ("pz" in o) pz = o.pz; if ("heading" in o) heading = o.heading; if ("speed" in o) speed = o.speed; if ("invul" in o) invul = o.invul; if ("throttle" in o) setLever(o.throttle); if ("offerIn" in o) offerIn = o.offerIn; if ("tLeft" in o) tLeft = o.tLeft; },
  accept: acceptOrder, weather: (k) => setWeather(WEATHERS.find((w) => w.k === k)), throwAt: (p) => { power = p; throwKebab(); }, aim: () => order && order.phase === "deliver" ? aimSolve() : null,
  scene, camera, renderer, pause, resume, input, start: startShift, lots: () => lots.length, houses: () => houses.length, takeaways: () => takeaways.map((t) => t.name) };
