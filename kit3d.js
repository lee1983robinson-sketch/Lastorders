// Shared 3D kit for the newer Last Orders games (Pub Golf, Bottle Flip, Jukebox Hero, Shuffleboard, Roulette).
// One renderer setup, one pub-at-night backdrop, one set of materials and sounds, so every game looks and
// performs the same way. three.js r160, everything drawn in code.
import * as THREE from "/vendor/three.module.min.js";
import { EffectComposer } from "/vendor/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "/vendor/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "/vendor/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "/vendor/jsm/postprocessing/OutputPass.js";
import { RoundedBoxGeometry } from "/vendor/jsm/geometries/RoundedBoxGeometry.js";
export { THREE, RoundedBoxGeometry };

export const PUB = window.PUB;
export const $ = (id) => document.getElementById(id);
export const store = PUB.store;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, t) => a + (b - a) * t;
export const rnd = (a, b) => a + Math.random() * (b - a), pick = (a) => a[Math.floor(Math.random() * a.length)], chance = (p) => Math.random() < p;
export const MOBILE = matchMedia("(pointer: coarse)").matches;
export const REDUCED = PUB.REDUCED;
export const J = (k, d) => { try { return Object.assign(d, JSON.parse(store.get(k) || "{}")); } catch (e) { return d; } };

// ---------------------------------------------------------------- stage: renderer, camera, glow, auto quality
export function makeStage(canvas, opt = {}) {
  const set = J(opt.key || "k3Set", { quality: "auto", music: 0.6, sfx: 0.9 });
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: (devicePixelRatio || 1) < 2, powerPreference: "high-performance" });
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = opt.exposure || 1.15;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(opt.bg || 0x0a0810);
  if (opt.fog !== false) scene.fog = new THREE.Fog(opt.fogColor || 0x120c10, opt.fogNear || 18, opt.fogFar || 60);
  const camera = new THREE.PerspectiveCamera(opt.fov || 50, 1, 0.05, 200);
  let composer = null, bloom = null;
  try { composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType })); composer.addPass(new RenderPass(scene, camera)); bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), opt.bloom ?? 0.6, 0.45, opt.bloomThreshold ?? 0.9); composer.addPass(bloom); composer.addPass(new OutputPass()); } catch (e) { composer = null; }
  const S = { renderer, scene, camera, composer, bloom, set, Q: 1, onResize: null, lights: [] };
  S.saveSet = () => store.set(opt.key || "k3Set", JSON.stringify(set));
  S.pickQ = () => (S.Q = set.quality === "auto" ? (MOBILE ? 1 : 2) : { high: 2, medium: 1, low: 0 }[set.quality] ?? 1);
  S.resize = () => {
    const w = innerWidth, h = innerHeight; renderer.setPixelRatio(Math.min(devicePixelRatio || 1, [1, MOBILE ? 1.4 : 1.5, MOBILE ? 1.8 : 2][S.Q]));
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    if (composer) { const pr = renderer.getPixelRatio(); composer.setPixelRatio(pr); composer.setSize(w, h); const k = S.Q >= 2 ? 0.5 : 0.33; bloom.setSize(Math.round(w * pr * k), Math.round(h * pr * k)); }
    renderer.shadowMap.enabled = S.Q >= 1; scene.traverse((o) => { if (o.isLight && o.castShadow !== undefined && o.userData.shadow) o.castShadow = S.Q >= 1; });
    if (S.onResize) S.onResize(w, h);
  };
  S.render = () => { if (composer && S.Q >= 1) composer.render(); else renderer.render(scene, camera); };
  addEventListener("resize", () => S.resize());
  S.pickQ(); S.resize();
  // step quality down by itself if the phone struggles
  let n = 0, t0 = 0; S.watch = (now, playing) => { if (!playing || set.quality !== "auto" || S.Q === 0) { t0 = 0; n = 0; return; } if (!t0) t0 = now; n++; if (now - t0 < 2500) return; const fps = n / ((now - t0) / 1000); t0 = now; n = 0; if (fps < 48) { S.Q--; S.resize(); } };
  scene.environment = pubEnv(renderer);
  return S;
}
// warm "pub" reflections baked once: amber lamps, a neon sign or two, a dark room
export function pubEnv(renderer, cols) {
  const env = new THREE.Scene();
  env.add(new THREE.Mesh(new THREE.SphereGeometry(20, 16, 8), new THREE.MeshBasicMaterial({ color: 0x140c0a, side: THREE.BackSide })));
  const L = cols || [0xffb060, 0xffd8a0, 0xffb060, 0xff3d7f, 0x3de0ff, 0xffc070, 0xffe0b0, 0xff9a40];
  L.forEach((c, i) => { const m = new THREE.Mesh(new THREE.SphereGeometry(i % 3 ? 0.8 : 1.4, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(i % 3 ? 5 : 3) })); const a = (i / L.length) * Math.PI * 2; m.position.set(Math.cos(a) * 11, rnd(2, 8), Math.sin(a) * 11); env.add(m); });
  const top = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffd8a0).multiplyScalar(0.6), side: THREE.DoubleSide })); top.position.y = 12; top.rotation.x = Math.PI / 2; env.add(top);
  const pm = new THREE.PMREMGenerator(renderer), t = pm.fromScene(env, 0.03).texture; pm.dispose(); return t;
}

// ---------------------------------------------------------------- textures drawn in code
export function ctex(w, h, draw, opt = {}) { const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d"), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = opt.linear ? THREE.NoColorSpace : THREE.SRGBColorSpace; t.anisotropy = 8; if (opt.repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; }
export const speck = (g, w, h, n, cols, a = 0.5, s = 2) => { for (let i = 0; i < n; i++) { g.globalAlpha = Math.random() * a; g.fillStyle = pick(cols); g.fillRect(Math.random() * w, Math.random() * h, Math.random() * s + 0.5, Math.random() * s + 0.5); } g.globalAlpha = 1; };
// colour + height in one go, normal map worked out from the height
export function ptex(w, h, draw, strength = 2.5) {
  const c = document.createElement("canvas"), hc = document.createElement("canvas"); c.width = hc.width = w; c.height = hc.height = h;
  const g = c.getContext("2d"), hg = hc.getContext("2d"); hg.fillStyle = "#808080"; hg.fillRect(0, 0, w, h); draw(g, hg, w, h);
  const src = hg.getImageData(0, 0, w, h).data, out = g.createImageData(w, h), H = (x, y) => src[(((y + h) % h) * w + ((x + w) % w)) * 4] / 255;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const dx = (H(x + 1, y) - H(x - 1, y)) * strength, dy = (H(x, y + 1) - H(x, y - 1)) * strength, l = Math.hypot(dx, dy, 1), i = (y * w + x) * 4; out.data[i] = (-dx / l * 0.5 + 0.5) * 255; out.data[i + 1] = (dy / l * 0.5 + 0.5) * 255; out.data[i + 2] = (1 / l * 0.5 + 0.5) * 255; out.data[i + 3] = 255; }
  const nc = document.createElement("canvas"); nc.width = w; nc.height = h; nc.getContext("2d").putImageData(out, 0, 0);
  const map = new THREE.CanvasTexture(c), nm = new THREE.CanvasTexture(nc); map.colorSpace = THREE.SRGBColorSpace; nm.colorSpace = THREE.NoColorSpace;
  for (const t of [map, nm]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; } return { map, nm };
}
export const radial = ctex(64, 64, (g, w) => { const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.25, "rgba(255,255,255,.45)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, w, w); });
export const shadowTex = ctex(64, 64, (g, w) => { const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); gr.addColorStop(0, "rgba(0,0,0,.7)"); gr.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = gr; g.fillRect(0, 0, w, w); });
let _wood = null, _floor = null, _brick = null, _felt = null;
export const woodT = () => _wood || (_wood = ptex(512, 512, (g, hg, w, h) => { // varnished bar-top wood, grain along x
  const base = ["#5a3018", "#6a3a1c", "#4e2a14"]; for (let y = 0; y < h; y += 64) { g.fillStyle = pick(base); g.fillRect(0, y, w, 64); hg.fillStyle = "#909090"; hg.fillRect(0, y, w, 63); hg.fillStyle = "#303030"; hg.fillRect(0, y + 62, w, 2); }
  for (let i = 0; i < 900; i++) { const y = Math.random() * h, x = Math.random() * w, l = rnd(40, 260); g.strokeStyle = `rgba(${Math.random() < 0.5 ? "20,8,2" : "150,90,40"},${rnd(0.05, 0.22)})`; g.lineWidth = rnd(0.5, 2); g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x + l * 0.3, y + rnd(-3, 3), x + l * 0.6, y + rnd(-3, 3), x + l, y + rnd(-2, 2)); g.stroke(); }
  for (let i = 0; i < 6; i++) { const x = Math.random() * w, y = Math.random() * h; g.fillStyle = "rgba(30,12,4,.35)"; g.beginPath(); g.ellipse(x, y, rnd(6, 14), rnd(3, 6), 0, 0, 7); g.fill(); }
}, 1.5));
export const floorT = () => _floor || (_floor = ptex(512, 512, (g, hg, w, h) => { // floorboards, grain along y
  for (let x = 0; x < w; x += 64) { g.fillStyle = pick(["#3a2214", "#442818", "#352010", "#4a2c1a"]); g.fillRect(x, 0, 64, h); hg.fillStyle = "#909090"; hg.fillRect(x, 0, 62, h); hg.fillStyle = "#202020"; hg.fillRect(x + 62, 0, 2, h); const cut = Math.random() * h; hg.fillRect(x, cut, 64, 2); g.fillStyle = "rgba(0,0,0,.5)"; g.fillRect(x, cut, 64, 2); }
  for (let i = 0; i < 1200; i++) { const x = Math.random() * w, y = Math.random() * h; g.strokeStyle = `rgba(${Math.random() < 0.5 ? "15,6,2" : "120,70,30"},${rnd(0.05, 0.2)})`; g.lineWidth = rnd(0.5, 1.5); g.beginPath(); g.moveTo(x, y); g.lineTo(x + rnd(-2, 2), y + rnd(30, 120)); g.stroke(); }
}, 1.5));
export const brickT = () => _brick || (_brick = ptex(512, 512, (g, hg, w, h) => { g.fillStyle = "#3a2a24"; g.fillRect(0, 0, w, h); hg.fillStyle = "#303030"; hg.fillRect(0, 0, w, h); const bw = 64, bh = 22;
  for (let r = 0; r * bh < h; r++) for (let x = -(r % 2) * bw / 2; x < w; x += bw) { const v = Math.random(); g.fillStyle = `rgb(${120 + v * 50 | 0},${52 + v * 24 | 0},${36 + v * 16 | 0})`; g.fillRect(x + 2, r * bh + 2, bw - 4, bh - 4); hg.fillStyle = "#d0d0d0"; hg.fillRect(x + 3, r * bh + 3, bw - 6, bh - 6); }
  speck(g, w, h, 14000, ["#000", "#fff", "#5a3020"], 0.2); speck(hg, w, h, 8000, ["#000", "#fff"], 0.3); }));
export const feltT = (col = "#1f6a3a") => ptex(256, 256, (g, hg, w, h) => { g.fillStyle = col; g.fillRect(0, 0, w, h); speck(g, w, h, 30000, ["#000", "#fff"], 0.08, 1.2); speck(hg, w, h, 30000, ["#000", "#fff"], 0.4, 1.2); }, 1.2);

// ---------------------------------------------------------------- merging static parts
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _n = new THREE.Matrix3();
const colCache = {}; const pc = (c) => (c == null ? null : typeof c === "object" ? c : colCache[c] || (colCache[c] = new THREE.Color(c)));
export function P(list, geo, mat, col, x, y, z, sx, sy, sz, ry = 0, rx = 0, rz = 0, uv) { _e.set(rx, ry, rz); _q.setFromEuler(_e); _m.compose(_v.set(x, y, z), _q, _s.set(sx, sy, sz)); list.push({ geo, mat, m: _m.clone(), col: pc(col), uv }); }
export function bake(list) {
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
export const G = { box: new THREE.BoxGeometry(1, 1, 1), rbox: new RoundedBoxGeometry(1, 1, 1, 3, 0.12), plane: new THREE.PlaneGeometry(1, 1), cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 24), cyl8: new THREE.CylinderGeometry(0.5, 0.5, 1, 10), sph: new THREE.SphereGeometry(0.5, 20, 14), cone: new THREE.ConeGeometry(0.5, 1, 16), torus: new THREE.TorusGeometry(0.5, 0.08, 10, 28) };
// common materials (vertex colours let one material cover lots of differently coloured parts)
export const MAT = {
  plain: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 }),
  shiny: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.25, metalness: 0.7 }),
  brass: new THREE.MeshStandardMaterial({ color: 0xd8a848, roughness: 0.22, metalness: 1 }),
  chrome: new THREE.MeshStandardMaterial({ color: 0xe0e4ea, roughness: 0.12, metalness: 1 }),
  lights: new THREE.MeshBasicMaterial({ vertexColors: true }),
  glow: new THREE.MeshBasicMaterial({ map: radial, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
  glass: new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.05, metalness: 0, transmission: 0, transparent: true, opacity: 0.28, envMapIntensity: 1.6, depthWrite: false }),
  bottleGlass: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.08, metalness: 0.2, transparent: true, opacity: 0.85, envMapIntensity: 1.5 }),
};

// ---------------------------------------------------------------- the pub backdrop
// A cosy room: floorboards, brick and wood-panelled walls, a bar with pumps and lit bottle shelves, neon signs,
// hanging lamps. Baked into a handful of meshes. opt.center/size place it; opt.neon gives the signs.
function neonTex(text, col) { return ctex(512, 128, (g, w, h) => { g.clearRect(0, 0, w, h); g.font = "800 64px 'Bungee', 'Arial Black', sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.shadowColor = col; g.shadowBlur = 24; g.fillStyle = col; g.fillText(text, w / 2, h / 2 + 4); g.shadowBlur = 0; g.fillStyle = "#fff"; g.globalAlpha = 0.8; g.fillText(text, w / 2, h / 2 + 4); }); }
export function pubRoom(scene0, opt = {}) {
  const scene = opt.parent || scene0;
  const W = opt.w || 22, D = opt.d || 22, H = opt.h || 6.5, cx = opt.x || 0, cz = opt.z || 0, L = [];
  const fl = floorT(), br = brickT(), wd = woodT();
  const floorM = new THREE.MeshStandardMaterial({ map: fl.map, normalMap: fl.nm, roughness: 0.55, metalness: 0.05, envMapIntensity: 0.7 }); fl.map.repeat.set(W / 4, D / 4); fl.nm.repeat.copy(fl.map.repeat);
  const brickM = new THREE.MeshStandardMaterial({ map: br.map, normalMap: br.nm, roughness: 0.9, envMapIntensity: 0.25 }); br.map.repeat.set(W / 4, H / 4); br.nm.repeat.copy(br.map.repeat);
  const panelM = new THREE.MeshStandardMaterial({ map: wd.map, normalMap: wd.nm, roughness: 0.4, metalness: 0.05, envMapIntensity: 0.8 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), floorM); floor.rotation.x = -Math.PI / 2; floor.position.set(cx, 0, cz); floor.receiveShadow = true; scene.add(floor);
  for (const [x, z, ry, len] of [[cx, cz - D / 2, 0, W], [cx - W / 2, cz, Math.PI / 2, D], [cx + W / 2, cz, -Math.PI / 2, D]]) {
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(len, H), brickM); wall.position.set(x, H / 2, z); wall.rotation.y = ry; scene.add(wall);
    // wood panelling and a dado rail on the lower wall
    const ax = Math.cos(ry), az = -Math.sin(ry), nx = Math.sin(ry), nz = Math.cos(ry);
    P(L, G.box, panelM, null, x + nx * 0.05, 0.6, z + nz * 0.05, len, 1.2, 0.1, ry, 0, 0, [len / 3, 0.4]);
    P(L, G.box, MAT.plain, "#2a160c", x + nx * 0.12, 1.24, z + nz * 0.12, len, 0.08, 0.1, ry);
    P(L, G.box, MAT.plain, "#1c0e08", x + nx * 0.1, 0.05, z + nz * 0.1, len, 0.1, 0.06, ry);
    // framed pictures with a little lamp over each
    for (let k = -1; k <= 1; k += 2) { const t = len * 0.28 * k; P(L, G.box, MAT.plain, "#2a1a10", x + ax * t + nx * 0.04, 3.2, z + az * t + nz * 0.04, 1.3, 0.95, 0.05, ry); P(L, G.box, MAT.plain, pick(["#5a6a4a", "#6a4a3a", "#3a4a6a", "#7a6a4a"]), x + ax * t + nx * 0.07, 3.2, z + az * t + nz * 0.07, 1.1, 0.75, 0.02, ry); P(L, G.box, MAT.lights, new THREE.Color(2, 1.5, 0.9), x + ax * t + nx * 0.18, 3.78, z + az * t + nz * 0.18, 0.5, 0.06, 0.12, ry); P(L, G.plane, MAT.glow, new THREE.Color(0.5, 0.36, 0.2), x + ax * t + nx * 0.06, 3.3, z + az * t + nz * 0.06, 2.4, 2.2, 1, ry); }
  }
  // the bar along the back wall
  if (opt.bar !== false) {
    const bz = cz - D / 2 + 1.6;
    P(L, G.box, panelM, null, cx, 0.55, bz, W * 0.62, 1.1, 0.8, 0, 0, 0, [4, 0.5]); P(L, G.box, panelM, null, cx, 1.14, bz + 0.05, W * 0.64, 0.08, 1.0, 0, 0, 0, [4, 0.3]);
    P(L, G.box, MAT.brass, null, cx, 0.18, bz + 0.45, W * 0.62, 0.05, 0.05);   // foot rail
    for (let i = 0; i < 5; i++) { const x = cx - 3 + i * 1.5; P(L, G.cyl, MAT.chrome, null, x, 1.45, bz - 0.05, 0.08, 0.55, 0.08); P(L, G.cyl, MAT.plain, pick(["#1a1a1a", "#7a1a1a", "#1a3a6a"]), x, 1.85, bz - 0.05, 0.12, 0.35, 0.12); P(L, G.box, MAT.lights, pick([new THREE.Color(1.4, 0.9, 0.2), new THREE.Color(1.2, 1.2, 1.3), new THREE.Color(1.4, 0.3, 0.3)]), x, 1.9, bz + 0.03, 0.14, 0.16, 0.02); }
    // back shelves of bottles, lit from below
    for (let s = 0; s < 3; s++) { const y = 2.1 + s * 0.75, z = cz - D / 2 + 0.25; P(L, G.box, panelM, null, cx, y, z, W * 0.58, 0.06, 0.4); P(L, G.box, MAT.lights, new THREE.Color(1.4, 0.9, 0.5), cx, y - 0.04, z + 0.18, W * 0.56, 0.02, 0.02);
      for (let i = 0; i < 26; i++) { const x = cx - W * 0.28 + i * (W * 0.56 / 26) + rnd(-0.05, 0.05), c = pick(["#3a6a2a", "#6a3a14", "#8a6a2a", "#2a4a6a", "#c8c0a0", "#5a1a1a", "#1a1a1a"]), hh = rnd(0.32, 0.5); P(L, G.cyl8, MAT.bottleGlass, c, x, y + 0.03 + hh / 2, z, 0.12, hh, 0.12); P(L, G.cyl8, MAT.bottleGlass, c, x, y + 0.03 + hh + 0.07, z, 0.04, 0.14, 0.04); } }
    P(L, G.plane, MAT.glow, new THREE.Color(0.6, 0.38, 0.2), cx, 3.0, cz - D / 2 + 0.06, W * 0.7, 3.2, 1);
  }
  // hanging lamps: real light from a couple, glow from all
  const lamps = opt.lamps || [[-4, -3], [4, -3], [-4, 4], [4, 4]];
  for (const [x, z] of lamps) { P(L, G.cyl8, MAT.plain, "#111", cx + x, H - 0.6, cz + z, 0.02, 1.2, 0.02); P(L, G.cone, MAT.shiny, "#1a3a2a", cx + x, H - 1.25, cz + z, 0.7, 0.4, 0.7); P(L, G.sph, MAT.lights, new THREE.Color(3, 2.3, 1.4), cx + x, H - 1.42, cz + z, 0.22, 0.16, 0.22); }
  for (const m of bake(L)) { m.receiveShadow = true; scene.add(m); }
  // neon signs on the walls
  for (const [text, col, x, y, z, ry] of opt.neon || [["LAST ORDERS", "#ff3d7f", cx, 4.9, cz - D / 2 + 0.08, 0], ["OPEN", "#3de0ff", cx - W / 2 + 0.08, 4.4, cz, Math.PI / 2]]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(4, 1), new THREE.MeshBasicMaterial({ map: neonTex(text, col), transparent: true, depthWrite: false, color: new THREE.Color(1.8, 1.8, 1.8) })); m.position.set(x, y, z); m.rotation.y = ry; scene.add(m);
  }
  // lighting: warm ambience, a key light with soft shadows, two lamp point lights
  const hemi = new THREE.HemisphereLight(0xffd0a0, 0x2a1408, 0.55); scene.add(hemi);
  const key = new THREE.SpotLight(0xffd2a0, opt.keyPower || 220, 40, 0.75, 0.6, 1.6); key.position.set(cx + 2, H - 0.3, cz + 3); key.target.position.set(cx, 0, cz); key.castShadow = true; key.userData.shadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.bias = -0.0004; scene.add(key, key.target);
  const pts = lamps.slice(0, 2).map(([x, z]) => { const l = new THREE.PointLight(0xffb878, 18, 12, 2); l.position.set(cx + x, H - 1.6, cz + z); scene.add(l); return l; });
  return { hemi, key, pts, floorM, panelM };
}

// ---------------------------------------------------------------- sound helpers (on the shared Last Orders audio)
export const snd = {
  ctx: () => PUB.ctx(),
  thock: (f = 180, v = 0.25) => { if (store.get("loMute") === "1") return; try { const A = PUB.ctx(), t = A.currentTime, o = A.createOscillator(), g = A.createGain(); o.type = "sine"; o.frequency.setValueAtTime(f * 2.2, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.06); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12); o.connect(g).connect(A.destination); o.start(t); o.stop(t + 0.14); PUB.noise(0.04, v * 0.3, 2500); } catch (e) {} },
  clink: (f = 2400) => { PUB.beep(f, f * 1.01, 0.18, "sine", 0.05); PUB.beep(f * 1.5, f * 1.5, 0.12, "sine", 0.03, 0.01); },
  whoosh: (v = 0.1) => PUB.noise(0.35, v, 1200, 0, 0.6),
  pop: () => PUB.pop(), cheer: () => PUB.cheer && PUB.cheer(), fanfare: () => PUB.fanfare(), sad: () => PUB.sad(),
  coin: () => { PUB.beep(1568, 2093, 0.07, "triangle", 0.05); PUB.beep(2093, 2637, 0.09, "triangle", 0.035, 0.05); },
  combo: (n) => { const f = 523 * Math.pow(1.06, Math.min(n, 20)); PUB.beep(f, f * 1.5, 0.12, "triangle", 0.05); },
  tick: () => PUB.beep(1100, 1100, 0.02, "square", 0.02),
};
// a looped rolling sound (balls, pucks, roulette ball): call set(volume, pitch) every frame
export function rollSound() {
  let src = null, g = null, f = null;
  return { set(vol, rate = 1) { try { const A = PUB.ctx(); if (!src) { const buf = A.createBuffer(1, A.sampleRate * 2, A.sampleRate), d = buf.getChannelData(0); let last = 0; for (let i = 0; i < d.length; i++) { last = last * 0.96 + (Math.random() * 2 - 1) * 0.04; d[i] = last * 6; } src = A.createBufferSource(); src.buffer = buf; src.loop = true; f = A.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 900; g = A.createGain(); g.gain.value = 0; src.connect(f).connect(g).connect(A.destination); src.start(); }
    const muted = store.get("loMute") === "1"; g.gain.setTargetAtTime(muted ? 0 : vol, A.currentTime, 0.05); src.playbackRate.setTargetAtTime(rate, A.currentTime, 0.05); f.frequency.setTargetAtTime(500 + rate * 900, A.currentTime, 0.05); } catch (e) {} } };
}
// pub background music: mellow chords and a soft beat, scheduled on the audio clock
export function pubMusic(opt = {}) {
  let on = false, timer = null, next = 0, step = 0, bus = null; const bpm = opt.bpm || 92, CH = opt.chords || [[57, 60, 64, 67], [53, 57, 60, 64], [48, 52, 55, 59], [55, 59, 62, 65]];
  const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
  function nt(A, type, f, t, d, v, cut) { const o = A.createOscillator(), g = A.createGain(), fl = A.createBiquadFilter(); o.type = type; o.frequency.value = f; fl.type = "lowpass"; fl.frequency.value = cut; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + d); o.connect(fl).connect(g).connect(bus); o.start(t); o.stop(t + d + 0.05); }
  function tick() { const A = PUB.ctx(), S = 60 / bpm / 2; while (next < A.currentTime + 0.3) { const s = step % 32, bar = Math.floor(s / 8), b = s % 8, ch = CH[bar];
      if (b === 0) for (const n of ch) nt(A, "triangle", hz(n), next, S * 7.5, 0.03, 1400);
      if (b % 2 === 0) nt(A, "sine", hz(ch[0] - 24 + (b === 6 ? 7 : 0)), next, S * 1.8, 0.12, 400);
      if (b % 4 === 0) { const o = A.createOscillator(), g = A.createGain(); o.frequency.setValueAtTime(120, next); o.frequency.exponentialRampToValueAtTime(45, next + 0.2); g.gain.setValueAtTime(0.18, next); g.gain.exponentialRampToValueAtTime(0.0001, next + 0.25); o.connect(g).connect(bus); o.start(next); o.stop(next + 0.26); }
      if (Math.random() < 0.35) nt(A, "sine", hz(ch[(Math.random() * ch.length) | 0] + 12), next, S * 1.5, 0.018, 3000);
      next += S; step++; } }
  return { start(vol = 0.5) { try { const A = PUB.ctx(); if (!bus) { bus = A.createGain(); bus.connect(A.destination); } bus.gain.value = store.get("loMute") === "1" ? 0 : vol; if (on) return; on = true; next = A.currentTime + 0.1; this._v = vol; clearInterval(timer); timer = setInterval(tick, 100); } catch (e) {} },
    stop() { on = false; clearInterval(timer); }, vol(v) { if (bus) bus.gain.value = store.get("loMute") === "1" ? 0 : v; } };
}

// ---------------------------------------------------------------- particles (one points system per game)
export function sparks(scene, N = 220) {
  const pos = new Float32Array(N * 3), col = new Float32Array(N * 3), vel = new Float32Array(N * 3), life = new Float32Array(N), geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3)); geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: opt_size(N), map: radial, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); pts.frustumCulled = false; scene.add(pts);
  let k = 0; const c = new THREE.Color();
  return { burst(x, y, z, n, hex, spd = 2, up = 2, g = 9) { c.set(hex); for (let i = 0; i < n; i++) { const j = k++ % N; pos[j * 3] = x; pos[j * 3 + 1] = y; pos[j * 3 + 2] = z; vel[j * 3] = rnd(-1, 1) * spd; vel[j * 3 + 1] = rnd(0.2, 1) * up; vel[j * 3 + 2] = rnd(-1, 1) * spd; col[j * 3] = c.r; col[j * 3 + 1] = c.g; col[j * 3 + 2] = c.b; life[j] = rnd(0.5, 1.1); } this.g = g; },
    step(dt) { const gr = this.g || 9; for (let j = 0; j < N; j++) { if (life[j] <= 0) { pos[j * 3 + 1] = -99; continue; } life[j] -= dt; vel[j * 3 + 1] -= gr * dt; pos[j * 3] += vel[j * 3] * dt; pos[j * 3 + 1] += vel[j * 3 + 1] * dt; pos[j * 3 + 2] += vel[j * 3 + 2] * dt; } geo.attributes.position.needsUpdate = true; }, pts };
}
function opt_size() { return 0.08; }

// ---------------------------------------------------------------- tiny UI helpers
export function toast(text, cls = "", ms = 1100) { const el = $("toast"); if (!el) return; el.className = "toast " + cls; el.innerHTML = text; void el.offsetWidth; el.classList.add("on"); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove("on"), ms); }
export function bumpEl(el) { el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump"); }
export function screens(ids) { return (id) => { for (const k of ids) { const el = $(k); if (el) el.hidden = k !== id; } const hud = $("hud"); if (hud) hud.hidden = id !== null; }; }
// wire the standard settings block: elements with ids volMusic, volSfx, qual (optional)
export function wireSettings(S, music) {
  const sync = () => { if ($("qual")) $("qual").value = S.set.quality; if ($("volMusic")) $("volMusic").value = S.set.music; };
  if ($("qual")) $("qual").addEventListener("change", (e) => { S.set.quality = e.target.value; S.saveSet(); S.pickQ(); S.resize(); });
  if ($("volMusic")) $("volMusic").addEventListener("input", (e) => { S.set.music = +e.target.value; S.saveSet(); if (music) music.vol(S.set.music); });
  sync(); return sync;
}
