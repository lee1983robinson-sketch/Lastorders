// Pub Golf: 18 holes of 3D crazy golf, each in its own pub setting. Robbo's Game Lab.
// Courses are tile maps (see golf-holes.js). Real ball physics: rolling friction, slopes and ramps, flight off
// kickers, bounces that depend on what you hit, moving and spinning obstacles, pipes and loops the ball actually
// travels through. Nothing teleports: drops into water or off an edge cost a stroke and the ball comes back to
// where you played from.
import { THREE, PUB, $, store, clamp, lerp, rnd, pick, MOBILE, makeStage, pubEnv, P, bake, G, sparks, shadowTex, radial, toast, bumpEl } from "/kit3d.js";
import { M, initMaterials, PR, FAR, neon, tvScreen, skyDome, TX } from "/golf-art.js";
import { sfx, roller, ambience, stopAmbience, playMusic, stopMusic, setVolumes } from "/golf-audio.js";
import { HOLES } from "/golf-holes.js";

if (!document.getElementById("modeFront")) { // an old cached golf.html with this new script: reload once to get the matching page
  if (!sessionStorage.getItem("golfReload")) { sessionStorage.setItem("golfReload", "1"); location.replace(location.pathname + "?v=" + Date.now()); }
  throw new Error("stale page");
}
sessionStorage.removeItem("golfReload");

const T = 0.8, R = 0.085, CUP = 0.165, Y0 = 0.12, LH = 0.3, GRAV = 9.8, G57 = GRAV * 5 / 7, RT = 0.13;
const C = (r, g, b) => new THREE.Color(r, g, b);

// ---------------------------------------------------------------- stage
const S = makeStage($("game"), { key: "golfSet", fov: 50, bloom: 0.32, bloomThreshold: 0.92, fogNear: 20, fogFar: 70, exposure: 1.1 });
const { scene, camera, renderer } = S;
if (S.set.sfx == null) S.set.sfx = 0.9;
initMaterials();
setVolumes(S.set.music, S.set.sfx);
const fx = sparks(scene, 300);
const hemi = new THREE.HemisphereLight(0xffd0a0, 0x2a1408, 0.5); scene.add(hemi);
const spot = new THREE.SpotLight(0xffd2a0, 200, 60, 0.7, 0.55, 1.4); spot.castShadow = true; spot.userData.shadow = true; spot.shadow.bias = -0.0003; spot.shadow.normalBias = 0.02; scene.add(spot, spot.target);
const sun = new THREE.DirectionalLight(0xffe0b0, 2.2); sun.castShadow = true; sun.userData.shadow = true; sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02; scene.add(sun, sun.target);
const fills = [0, 1, 2].map(() => { const l = new THREE.PointLight(0xffb878, 0, 14, 2); scene.add(l); return l; });
let envTex = null;

// ---------------------------------------------------------------- ball
const ballMat = new THREE.MeshPhysicalMaterial({ color: 0xe8e8e8, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.12, normalMap: TX.turf && (() => { const t = new THREE.CanvasTexture((() => { const c = document.createElement("canvas"); c.width = 256; c.height = 128; const g = c.getContext("2d"); g.fillStyle = "#8080ff"; g.fillRect(0, 0, 256, 128); for (let y = 6; y < 128; y += 11) for (let x = ((y / 11) | 0) % 2 ? 5 : 0; x < 256; x += 11) { const gr = g.createRadialGradient(x, y, 0, x, y, 5); gr.addColorStop(0, "#8080c0"); gr.addColorStop(0.6, "#a0a0ff"); gr.addColorStop(1, "#8080ff"); g.fillStyle = gr; g.beginPath(); g.arc(x, y, 5, 0, 7); g.fill(); } return c; })()); t.colorSpace = THREE.NoColorSpace; return t; })(), normalScale: new THREE.Vector2(0.6, 0.6) });
const ballMesh = new THREE.Mesh(new THREE.SphereGeometry(R, 32, 20), ballMat); ballMesh.castShadow = true;
const blob = new THREE.Mesh(G.plane, new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false })); blob.rotation.x = -Math.PI / 2; blob.scale.set(0.3, 0.3, 1);
const aimDots = new THREE.Points(new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(new Float32Array(30 * 3), 3)), new THREE.PointsMaterial({ size: 0.07, map: radial, color: 0xffe080, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
aimDots.frustumCulled = false;
const aimRing = new THREE.Mesh(new THREE.RingGeometry(0.16, 0.2, 40), new THREE.MeshBasicMaterial({ color: 0xffe080, transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide })); aimRing.rotation.x = -Math.PI / 2;
const aimHead = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.16, 12), new THREE.MeshBasicMaterial({ color: 0xffe080, transparent: true, opacity: 0.9 }));
const B = { x: 0, z: 0, y: Y0 + R, vx: 0, vz: 0, vy: 0, air: false, path: null, sink: 0, on: null };
const roll = roller();

// ---------------------------------------------------------------- course model
let H = null, hg = null; // current hole data and its scene group
const anims = [];
function tileAt(c, r) { return H.tiles[r] && H.tiles[r][c] || null; }
function tileH(t, u, v) { if (t.kind === "flat") return t.lv * LH; const f = t.ch === "^" ? 1 - v : t.ch === "v" ? v : t.ch === ">" ? u : 1 - u; return (t.lo + (t.hi - t.lo) * f) * LH; }
function edgeProf(t, side) { return side === "N" ? [tileH(t, 0, 0), tileH(t, 1, 0)] : side === "S" ? [tileH(t, 0, 1), tileH(t, 1, 1)] : side === "W" ? [tileH(t, 0, 0), tileH(t, 0, 1)] : [tileH(t, 1, 0), tileH(t, 1, 1)]; }
// surface under a point: supports (bridges, planks, seesaws) first, then the tiles; null means nothing (water, a gap, a pocket)
function surfAt(x, z) {
  for (const e of H.sups) { const h = e.sup(x, z); if (h != null) return { h, e }; }
  for (const p of H.pockets) if ((x - p.x) ** 2 + (z - p.z) ** 2 < (p.r - R * 0.4) ** 2) return null;
  const c = Math.round(x / T + (H.cols - 1) / 2), r = Math.round(z / T + (H.rows - 1) / 2), t = tileAt(c, r);
  if (!t || t.kind === "void") return null;
  const u = clamp((x - H.X(c)) / T + 0.5, 0, 1), v = clamp((z - H.Z(r)) / T + 0.5, 0, 1);
  return { h: Y0 + tileH(t, u, v), t };
}

// ---------------------------------------------------------------- collision helpers (o = a body with x, z, vx, vz)
let lastImpact = {};
function impact(mat, sp, o) { if (sp < 0.25) return; const now = performance.now(); if (now - (lastImpact[mat] || 0) < 45) return; lastImpact[mat] = now; sfx.hit(mat, sp); if (o === B && sp > 1.5 && navigator.vibrate && !PUB.REDUCED) navigator.vibrate(10); }
function segHit(o, x1, z1, x2, z2, e, mat, wvx = 0, wvz = 0, rad = R) {
  const dx = x2 - x1, dz = z2 - z1, L2 = dx * dx + dz * dz; let t = L2 ? ((o.x - x1) * dx + (o.z - z1) * dz) / L2 : 0; t = clamp(t, 0, 1);
  const px = x1 + dx * t, pz = z1 + dz * t, ex = o.x - px, ez = o.z - pz, d = Math.hypot(ex, ez); if (d >= rad || d < 1e-7) return false;
  const nx = ex / d, nz = ez / d; o.x = px + nx * rad; o.z = pz + nz * rad;
  const vn = (o.vx - wvx) * nx + (o.vz - wvz) * nz; if (vn < 0) { o.vx -= (1 + e) * vn * nx; o.vz -= (1 + e) * vn * nz; impact(mat, -vn, o); } return true;
}
function circHit(o, cx, cz, r, e, mat, rad = R) {
  const dx = o.x - cx, dz = o.z - cz, d = Math.hypot(dx, dz), m = r + rad; if (d >= m || d < 1e-7) return false;
  const nx = dx / d, nz = dz / d; o.x = cx + nx * m; o.z = cz + nz * m; const vn = o.vx * nx + o.vz * nz;
  if (vn < 0) { o.vx -= (1 + e) * vn * nx; o.vz -= (1 + e) * vn * nz; impact(mat, -vn, o); return -vn || 0.001; } return 0.0001;
}
function boxHit(o, cx, cz, hw, hd, e, mat, wvx = 0, wvz = 0, rad = R) {
  const px = clamp(o.x, cx - hw, cx + hw), pz = clamp(o.z, cz - hd, cz + hd); let dx = o.x - px, dz = o.z - pz, d = Math.hypot(dx, dz);
  let nx, nz;
  if (d < 1e-7) { const ox = hw - Math.abs(o.x - cx), oz = hd - Math.abs(o.z - cz); if (ox < oz) { nx = Math.sign(o.x - cx) || 1; nz = 0; o.x = cx + nx * (hw + rad); } else { nz = Math.sign(o.z - cz) || 1; nx = 0; o.z = cz + nz * (hd + rad); } }
  else { if (d >= rad) return false; nx = dx / d; nz = dz / d; o.x = px + nx * rad; o.z = pz + nz * rad; }
  const vn = (o.vx - wvx) * nx + (o.vz - wvz) * nz; if (vn < 0) { o.vx -= (1 + e) * vn * nx; o.vz -= (1 + e) * vn * nz; impact(mat, -vn, o); } return true;
}

// ---------------------------------------------------------------- obstacles
// Each returns an object with any of: hit(o) collisions, sup(x,z) support height, upd(dt,t) animation,
// trig() path entry, sub(dt) extra bodies, rest() when the ball stops on it.
function bakeInto(L, group, shadow = true) { for (const m of bake(L)) { m.castShadow = shadow && m.material !== M.glow && m.material !== M.lights && m.material !== M.turf && m.material !== M.felt; m.receiveShadow = true; group.add(m); } }
const CIRC = { // radius, bounce, sound, look
  pint: [0.075, 0.45, "glass", (L, x, z, e, y) => { P(L, G.cyl, M.paint, "#f2e8d0", x, y + 0.003, z, 0.24, 0.006, 0.24); P(L, G.cyl, M.paint, "#b8141e", x, y + 0.004, z, 0.2, 0.006, 0.2); PR.pint(L, x, z, y + 0.007, 1.5); }],
  stout: [0.075, 0.45, "glass", (L, x, z, e, y) => { P(L, G.cyl, M.paint, "#f2e8d0", x, y + 0.003, z, 0.24, 0.006, 0.24); PR.pint(L, x, z, y + 0.007, 1.5, true); }],
  bottle: [0.09, 0.55, "glass", (L, x, z, e, y) => PR.bottle(L, x, z, y, pick(["#2a5a22", "#5a3010", "#1a3a5a"]), 2.6)],
  bumper: [0.1, 1.18, "bumper", (L, x, z, e, y) => { PR.bottle(L, x, z, y, e.col || "#2a7a3a", 2.9); }, true],
  keg: [0.21, 1.1, "bumper", (L, x, z, e, y) => PR.keg(L, x, z, 1, y), true],
  barrel: [0.25, 0.45, "barrel", (L, x, z, e, y) => PR.barrel(L, x, z, 0.78, y)],
  chips: [0.08, 0.6, "chip", (L, x, z, e, y) => PR.chips(L, x, z, 7, e.col || "#c81e28", y)],
  post: [0.05, 0.5, "wood", (L, x, z, e, y) => P(L, G.cyl, M.wood, "#6a4020", x, y + 0.2, z, 0.1, 0.4, 0.1)],
  football: [0.17, 0.85, "rubber", null],
  birdbath: [0.15, 0.4, "stone", (L, x, z, e, y) => { P(L, G.cyl, M.stone, "#c8c0b0", x, y + 0.25, z, 0.16, 0.5, 0.16); P(L, G.cyl, M.stone, "#d8d0c0", x, y + 0.55, z, 0.5, 0.1, 0.5); P(L, G.cyl, M.water, null, x, y + 0.605, z, 0.42, 0.01, 0.42); }],
  cocktail: [0.1, 1.15, "bumper", (L, x, z, e, y) => { P(L, G.cyl, M.metal, "#e0e4ea", x, y + 0.02, z, 0.24, 0.04, 0.24); P(L, G.cyl8, M.metal, "#e0e4ea", x, y + 0.2, z, 0.03, 0.36, 0.03); P(L, G.cone, M.glass, null, x, y + 0.5, z, 0.42, 0.28, 0.42, 0, Math.PI); P(L, G.cone, M.lights, C(2.4, 0.4, 1.6), x, y + 0.46, z, 0.3, 0.18, 0.3, 0, Math.PI); }, true],
  candle: [0.06, 0.4, "glass", (L, x, z, e, y) => { P(L, G.cyl, M.glass, null, x, y + 0.1, z, 0.12, 0.2, 0.12); PR.candle(L, x, y, z); }],
};
const BOXES = { crate: [0.5, "wood"], hay: [0.25, "hay"], planter: [0.4, "wood"], block: [0.5, "wood"], chair: [0.4, "wood"] };
function makeEnt(e, k) {
  const X = H.X, Z = H.Z, L = k.L, g = k.g;
  if (CIRC[e.t]) { const [r, el, mat, draw, flash] = CIRC[e.t], x = X(e.c), z = Z(e.r), yb = Y0 + (e.lv || 0) * LH; if (draw) draw(L, x, z, e, yb); let glow = null, f = 0;
    if (e.t === "football") { const m = new THREE.Mesh(new THREE.SphereGeometry(0.17, 24, 16), new THREE.MeshStandardMaterial({ map: TX.football ? TX.football() : null, roughness: 0.5 })); m.material.map = footballTex(); m.position.set(x, yb + 0.17, z); m.castShadow = true; g.add(m); k.anims.push((dt) => { m.rotation.y += dt * 0.3; }); }
    if (flash) { glow = new THREE.Mesh(new THREE.TorusGeometry(r + 0.02, 0.018, 8, 28), new THREE.MeshBasicMaterial({ color: C(0.4, 1.4, 2) })); glow.rotation.x = Math.PI / 2; glow.position.set(x, yb + 0.03, z); g.add(glow); }
    return { hit(o) { const v = circHit(o, x, z, r, el, o === B ? mat : "ball"); if (v > 0.3 && glow) { f = 1; fx.burst(x, yb + 0.3, z, 10, 0x60e0ff, 1.5, 1.5); if (o === B) addBonus(5, null); } }, upd(dt) { if (glow) { f = Math.max(0, f - dt * 3); glow.material.color.setRGB(0.4 + f * 4, 1.4 + f * 2, 2 + f * 2); } } }; }
  if (BOXES[e.t]) { const [el, mat] = BOXES[e.t], x = X(e.c), z = Z(e.r), w = e.w || 0.5, d = e.d || 0.5, yb = Y0 + (e.lv || 0) * LH;
    if (e.t === "crate") PR.crate(L, x, z, 0, w / 0.6, yb); else if (e.t === "hay") PR.haybale(L, x, z, w > d ? 0 : Math.PI / 2, yb); else if (e.t === "planter") PR.planter(L, x, z, w, d, 0, yb); else P(L, G.box, M.wood, "#8a5a30", x, yb + 0.15, z, w, 0.3, d);
    const hw = (e.t === "hay" ? (w > d ? 0.45 : 0.25) : w / 2), hd = (e.t === "hay" ? (w > d ? 0.25 : 0.45) : d / 2);
    return { hit(o) { boxHit(o, x, z, hw, hd, el, o === B ? mat : "ball"); } }; }
  return (ENT[e.t] || (() => ({})))(e, k, X, Z, L, g);
}
let footTex = null; function footballTex() { return footTex || (footTex = (() => { const c = document.createElement("canvas"); c.width = 256; c.height = 128; const x = c.getContext("2d"); x.fillStyle = "#f4f4f4"; x.fillRect(0, 0, 256, 128); x.fillStyle = "#111"; for (let i = 0; i < 12; i++) { const px = (i % 6) * 44 + ((i / 6) | 0) * 22 + 10, py = ((i / 6) | 0) * 64 + 32; x.beginPath(); for (let k = 0; k < 5; k++) { const a = k / 5 * 6.283 - 1.57; x.lineTo(px + Math.cos(a) * 13, py + Math.sin(a) * 13); } x.fill(); } const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })()); }

const ENT = {
  // ---- windmill: putt through the tunnel in its base when the blades are clear
  mill(e, k, X, Z, L, g) {
    const x = X(e.c), z = Z(e.r), wd = (e.n || 1) * T, dep = 0.6, zf = z + dep / 2, zb = z - dep / 2, op = 0.17, hub = Y0 + 1.0, bl = 0.86;
    P(L, G.box, M.wood, e.col || "#e8dcc0", x - (wd / 2 + op) / 2, Y0 + 0.4, z, wd / 2 - op, 0.8, dep); P(L, G.box, M.wood, e.col || "#e8dcc0", x + (wd / 2 + op) / 2, Y0 + 0.4, z, wd / 2 - op, 0.8, dep);
    P(L, G.box, M.wood, e.col || "#e8dcc0", x, Y0 + 0.55, z, op * 2 + 0.02, 0.5, dep);
    P(L, G.box, M.deck, "#6a4a2a", x, Y0 + 0.82, z, wd + 0.06, 0.06, dep + 0.08);
    P(L, G.cyl, M.wood, e.col2 || "#c8b898", x, Y0 + 1.15, z, 0.64, 0.66, 0.64, Math.PI / 8); P(L, G.cone, M.paint, "#7a2a1a", x, Y0 + 1.68, z, 0.82, 0.42, 0.82, Math.PI / 8);
    for (const s of [-1, 1]) { P(L, G.box, M.plain, "#3a2410", x + s * 0.32, Y0 + 0.5, zf + 0.005, 0.14, 0.2, 0.01); P(L, G.box, M.lights, C(2.4, 1.6, 0.7), x + s * 0.32, Y0 + 0.5, zf + 0.008, 0.1, 0.15, 0.005); }
    P(L, G.box, M.plain, "#120a06", x, Y0 + 0.13, z, op * 2 - 0.01, 0.26, dep + 0.01); // dark tunnel mouth
    const rot = new THREE.Group(); rot.position.set(x, hub, zf + 0.09); g.add(rot); const Lr = [];
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2, c = Math.cos(a), s = Math.sin(a); P(Lr, G.box, M.wood, "#5a3a1a", c * bl / 2, s * bl / 2, 0, bl, 0.04, 0.04, 0, 0, a); P(Lr, G.plane, M.sails, null, c * bl * 0.58, s * bl * 0.58, 0.01, bl * 0.7, 0.2, 1, 0, 0, a); }
    P(Lr, G.cyl, M.metal, "#3a3a3a", 0, 0, 0, 0.12, 0.1, 0.12, 0, Math.PI / 2); bakeInto(Lr, rot);
    let a = rnd(0, 6.28), lastQ = -1; const w = e.w || 1.1;
    const segs = [[x - wd / 2, zf, x - op, zf], [x + op, zf, x + wd / 2, zf], [x - wd / 2, zb, x - op, zb], [x + op, zb, x + wd / 2, zb], [x - op, zb, x - op, zf], [x + op, zb, x + op, zf]];
    const down = () => { const m = ((a % (Math.PI / 2)) + Math.PI / 2) % (Math.PI / 2); return Math.min(m, Math.PI / 2 - m) < 0.24; };
    return { upd(dt) { a += w * dt; rot.rotation.z = a; const q = Math.floor(a / (Math.PI / 2)); if (q !== lastQ) { lastQ = q; const d = Math.hypot(B.x - x, B.z - z); if (d < 4) sfx.whump(1 - d / 4); if (Math.random() < 0.3 && d < 5) sfx.creak(1 - d / 5); } },
      hit(o) { for (const s of segs) segHit(o, s[0], s[1], s[2], s[3], 0.4, o === B ? "wood" : "ball"); if (down()) segHit(o, x - op - 0.02, zf + 0.07, x + op + 0.02, zf + 0.07, 0.5, o === B ? "wood" : "ball", w * (bl - 0.1), 0); } };
  },
  // ---- rotating gate: striped bars turning round a post
  gate(e, k, X, Z, L, g) {
    const x = X(e.c), z = Z(e.r), len = e.len || 1.1, arms = e.arms || 2, w = e.w || 1.2;
    P(L, G.cyl, M.metal, "#c8c8d0", x, Y0 + 0.2, z, 0.1, 0.4, 0.1); P(L, G.sph, M.metal, "#d8a848", x, Y0 + 0.42, z, 0.12, 0.12, 0.12);
    const rot = new THREE.Group(); rot.position.set(x, Y0 + 0.1, z); g.add(rot); const Lr = [], striped = new THREE.MeshStandardMaterial({ map: TX.stripes(e.c1 || "#d8202a", "#f4f4f4"), roughness: 0.4 });
    for (let i = 0; i < arms; i++) { const an = i * Math.PI * 2 / arms; P(Lr, G.box, striped, null, Math.cos(an) * len / 2, 0, -Math.sin(an) * len / 2, len, 0.09, 0.06, an, 0, 0, [len * 3, 1]); if (e.glow) P(Lr, G.box, M.lights, new THREE.Color(e.glow).multiplyScalar(2.5), Math.cos(an) * len / 2, 0.055, -Math.sin(an) * len / 2, len, 0.012, 0.03, an); }
    bakeInto(Lr, rot); let a = rnd(0, 6);
    return { upd(dt) { a += w * dt; rot.rotation.y = a; },
      hit(o) { for (let i = 0; i < arms; i++) { const an = a + i * Math.PI * 2 / arms, ex = x + Math.cos(an) * len, ez = z - Math.sin(an) * len; const px = clamp(o.x, Math.min(x, ex), Math.max(x, ex)); void px; // tangential velocity at the contact point
          const dx = ex - x, dz = ez - z, t = clamp(((o.x - x) * dx + (o.z - z) * dz) / (len * len), 0, 1), cx = x + dx * t, cz = z + dz * t; segHit(o, x, z, ex, ez, 0.55, o === B ? "metal" : "ball", w * (cz - z), -w * (cx - x), R + 0.03); }
        circHit(o, x, z, 0.05, 0.5, "metal"); } };
  },
  // ---- sliding barrier / goalkeeper / hay cart
  slider(e, k, X, Z, L, g) {
    const ax = X(e.a[0]), az = Z(e.a[1]), bx = X(e.b[0]), bz = Z(e.b[1]), w = e.w || 0.8, d = e.d || 0.25, per = e.period || 3, ph = rnd(0, 6);
    const obj = new THREE.Group(); g.add(obj); const Lo = [];
    if (e.look === "goalie") { P(Lo, G.rbox, M.paint, "#f4c020", 0, Y0 + 0.08, 0, w, 0.16, d); P(Lo, G.rbox, M.paint, "#2a2a2a", 0, Y0 + 0.5, 0, 0.3, 0.5, 0.18); P(Lo, G.sph, M.paint, "#e8b890", 0, Y0 + 0.86, 0, 0.2, 0.22, 0.2); P(Lo, G.box, M.paint, "#2a2a2a", 0, Y0 + 0.24, 0, 0.26, 0.2, 0.16); for (const s of [-1, 1]) { P(Lo, G.box, M.paint, "#2a2a2a", s * 0.22, Y0 + 0.62, 0, 0.18, 0.08, 0.08, 0, 0, s * 0.8); P(Lo, G.sph, M.paint, "#ffe040", s * 0.32, Y0 + 0.72, 0, 0.12, 0.12, 0.12); } }
    else if (e.look === "cart") { P(Lo, G.box, M.deck, "#8a5a30", 0, Y0 + 0.2, 0, w, 0.12, d, 0, 0, 0, [w, 0.3]); PR.haybale(Lo, 0, 0, 0, Y0 + 0.26); for (const s of [-1, 1]) P(Lo, G.cyl, M.wood, "#5a3a1a", s * w * 0.36, Y0 + 0.14, d / 2 + 0.03, 0.28, 0.04, 0.28, 0, Math.PI / 2); }
    else { const st = new THREE.MeshStandardMaterial({ map: TX.stripes("#d8202a", "#f4f4f4"), roughness: 0.4 }); P(Lo, G.rbox, st, null, 0, Y0 + 0.12, 0, w, 0.24, d, 0, 0, 0, [w * 3, 1]); P(Lo, G.box, M.lights, C(2.6, 0.6, 0.4), 0, Y0 + 0.25, 0, w * 0.9, 0.02, 0.04); }
    bakeInto(Lo, obj); let px = ax, pz = az, vx = 0, vz = 0, lastEnd = 0;
    return { upd(dt, t) { const f = (1 - Math.cos((t / per) * Math.PI * 2 + ph)) / 2, df = Math.sin((t / per) * Math.PI * 2 + ph) * Math.PI / per; px = lerp(ax, bx, f); pz = lerp(az, bz, f); vx = (bx - ax) * df; vz = (bz - az) * df; obj.position.set(px, 0, pz); const end = f > 0.98 ? 1 : f < 0.02 ? -1 : 0; if (end && end !== lastEnd && Math.hypot(B.x - px, B.z - pz) < 4) sfx.clunk(); lastEnd = end || lastEnd; },
      hit(o) { boxHit(o, px, pz, w / 2, d / 2, e.look === "cart" ? 0.3 : 0.5, o === B ? (e.look === "cart" ? "hay" : e.look === "goalie" ? "rubber" : "wood") : "ball", vx, vz); } };
  },
  // ---- spinning beer coaster: a turntable set into the green that drags the ball round
  spin(e, k, X, Z, L, g) {
    const x = X(e.c), z = Z(e.r), rad = e.rad || 0.9, w = e.w || 0.8;
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad, 0.012, 48), [new THREE.MeshStandardMaterial({ color: 0xb8141e, roughness: 0.6 }), M.coaster, M.coaster]); disc.position.set(x, Y0 + 0.004, z); disc.receiveShadow = true; g.add(disc);
    P(L, G.torus, M.metal, "#d8a848", x, Y0 + 0.006, z, rad * 2 + 0.02, rad * 2 + 0.02, 0.3, 0, Math.PI / 2);
    let a = 0;
    return { x, z, rad, w, upd(dt) { a += w * dt; disc.rotation.y = a; }, carry(o, dt) { const rx = o.x - x, rz = o.z - z; if (rx * rx + rz * rz > rad * rad) return false; const tx = w * rz, tz = -w * rx; return [tx, tz]; } };
  },
  // ---- bell on a frame: ring it for a bonus
  bell(e, k, X, Z, L, g) {
    const x = X(e.c), z = Z(e.r); P(L, G.cyl, M.wood, "#5a3a1a", x, Y0 + 0.6, z - 0.0, 0.08, 1.2, 0.08); P(L, G.box, M.wood, "#5a3a1a", x, Y0 + 1.18, z + 0.18, 0.08, 0.08, 0.44);
    const sw = new THREE.Group(); sw.position.set(x, Y0 + 1.15, z + 0.36); g.add(sw); const Lb = []; P(Lb, G.cone, M.metal, "#d8a848", 0, -0.18, 0, 0.3, 0.3, 0.3); P(Lb, G.sph, M.metal, "#d8a848", 0, -0.04, 0, 0.18, 0.14, 0.18); P(Lb, G.sph, M.metal, "#8a6a2a", 0, -0.36, 0, 0.06, 0.06, 0.06); P(Lb, G.cyl8, M.plain, "#c8a070", 0, -0.55, 0, 0.012, 0.4, 0.012); bakeInto(Lb, sw);
    let ang = 0, av = 0, rung = false;
    return { upd(dt) { av -= ang * 18 * dt; av *= 1 - dt * 1.2; ang += av * dt; sw.rotation.x = ang; },
      hit(o) { const v = circHit(o, x, z, 0.06, 0.5, o === B ? "wood" : "ball"); if (v > 0.2 && o === B) { av += Math.min(4, v * 2); sfx.bell(); if (!rung) { rung = true; addBonus(50, "DING DING! +50"); fx.burst(x, Y0 + 1, z + 0.36, 26, 0xffd23a, 1.5, 2); } } } };
  },
  // ---- dartboard set into the floor: stop on it for a bonus
  dart(e, k, X, Z, L, g) { const x = X(e.c), z = Z(e.r), rad = e.rad || 0.55; const m = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad, 0.012, 48), [new THREE.MeshStandardMaterial({ color: 0x111111 }), M.dart, M.dart]); m.position.set(x, Y0 + 0.003, z); m.rotation.y = rnd(0, 6); m.receiveShadow = true; g.add(m); let done = false;
    return { rest() { if (done) return; const d = Math.hypot(B.x - x, B.z - z) / rad; if (d > 1) return; done = true; const pts = d < 0.1 ? 150 : d < 0.55 ? 100 : 50; addBonus(pts, d < 0.1 ? "BULLSEYE! +150" : `ON THE BOARD +${pts}`); sfx.bonus(); fx.burst(B.x, B.y + 0.1, B.z, 30, 0x2ee59d, 1.5, 2); } }; },
  // ---- static plank / narrow bridge over a drop
  plank(e, k, X, Z, L, g) {
    const x = X(e.c), z0 = Z(e.r0) - T / 2 - 0.12, z1 = Z(e.r1) + T / 2 + 0.12, hw = (e.w || 0.32) / 2, h = Y0 + (e.lv || 0) * LH, zc = (z0 + z1) / 2, len = z1 - z0;
    P(L, G.box, M.deck, "#9a7a58", x, h - 0.025, zc, hw * 2, 0.05, len, 0, 0, 0, [0.4, len]); for (let i = 0; i < len / 0.16; i++) P(L, G.box, M.plain, "#2a1a0e", x, h + 0.001, z0 + i * 0.16, hw * 2, 0.002, 0.008);
    for (const zz of [z0 + 0.05, z1 - 0.05]) for (const s of [-1, 1]) P(L, G.cyl8, M.wood, "#5a3a1a", x + s * (hw + 0.04), h + 0.05, zz, 0.06, 0.2 + (k.elev || 0), 0.06);
    if (k.elev) for (const zz of [z0 + 0.4, zc, z1 - 0.4]) P(L, G.box, M.metal, "#3a3a40", x, h - 0.05 - k.elev / 2, zz, 0.06, k.elev, 0.06);
    return { sup(px, pz) { return Math.abs(px - x) <= hw && pz >= z0 && pz <= z1 ? h : null; } };
  },
  // ---- bridge that shuttles across the water
  mbridge(e, k, X, Z, L, g) {
    const ax = X(e.c0), bx = X(e.c1), z = Z(e.r), hl = T / 2 + 0.16, hw = (e.w || 0.9) * T / 2, per = e.period || 4.5, ph = rnd(0, 6);
    const obj = new THREE.Group(); g.add(obj); const Lb = [];
    for (let i = 0; i < 7; i++) P(Lb, G.box, M.deck, pick(["#9a7a58", "#8a6a48", "#a48462"]), -hw + (i + 0.5) * hw * 2 / 7, Y0 - 0.03, 0, hw * 2 / 7 - 0.01, 0.05, hl * 2, 0, 0, 0, [0.2, hl * 2]);
    for (const s of [-1, 1]) { P(Lb, G.box, M.deck, "#6a4a2a", s * (hw - 0.03), Y0 - 0.07, 0, 0.06, 0.06, hl * 2); for (const zz of [-hl + 0.06, hl - 0.06]) P(Lb, G.cyl8, M.wood, "#5a3a1a", s * (hw + 0.02), Y0 + 0.08, zz, 0.06, 0.26, 0.06); P(Lb, G.cyl8, M.plain, "#c8a070", s * (hw + 0.02), Y0 + 0.17, 0, 0.02, hl * 2 - 0.1, 0.02, 0, Math.PI / 2); }
    P(Lb, G.box, M.paint, "#2a2a2a", 0, Y0 - 0.12, 0, hw * 2 + 0.1, 0.05, 0.12); bakeInto(Lb, obj);
    let px = ax, vx = 0, lastEnd = 0;
    return { upd(dt, t) { const f = (1 - Math.cos((t / per) * Math.PI * 2 + ph)) / 2; vx = (bx - ax) * Math.sin((t / per) * Math.PI * 2 + ph) * Math.PI / per; px = lerp(ax, bx, f); obj.position.set(px, 0, z); const end = f > 0.985 ? 1 : f < 0.015 ? -1 : 0; if (end && end !== lastEnd) { if (Math.hypot(B.x - px, B.z - z) < 5) sfx.clunk(); lastEnd = end; } if (Math.abs(vx) > 0.4 && Math.random() < dt * 1.5 && Math.hypot(B.x - px, B.z - z) < 4) sfx.rumble(0.5); },
      sup(x, zz) { return Math.abs(x - px) <= hw && Math.abs(zz - z) <= hl ? Y0 : null; }, vel: () => [vx, 0] };
  },
  // ---- seesaw: tips towards the ball
  seesaw(e, k, X, Z, L, g) {
    const x = X(e.c), z0 = Z(e.r0) - T / 2 - 0.12, z1 = Z(e.r1) + T / 2 + 0.12, zc = (z0 + z1) / 2, hl = (z1 - z0) / 2, hw = (e.w || 0.5) / 2, amax = Math.atan(0.14 / hl), hp = Y0 + hl * Math.tan(amax);
    P(L, G.cone, M.wood, "#6a4020", x, (hp - 0.05) / 2, zc, 0.36, hp - 0.05, 0.36); P(L, G.cyl, M.metal, "#3a3a3a", x, hp - 0.04, zc, 0.07, hw * 2 + 0.16, 0.07, 0, 0, Math.PI / 2);
    const obj = new THREE.Group(); obj.position.set(x, hp, zc); g.add(obj); const Lp = [];
    P(Lp, G.box, M.deck, "#a07a50", 0, -0.025, 0, hw * 2, 0.05, hl * 2, 0, 0, 0, [0.5, hl * 2]); for (const s of [-1, 1]) P(Lp, G.box, M.paint, "#d8202a", s * (hw - 0.015), 0.005, 0, 0.03, 0.012, hl * 2); for (let i = 0; i < 10; i++) P(Lp, G.box, M.plain, "#3a2a1a", 0, 0.001, -hl + i * hl * 0.2, hw * 2, 0.002, 0.01);
    bakeInto(Lp, obj); let a = amax, onIt = false, lastA = a;
    const self = { sup(px, pz) { if (Math.abs(px - x) > hw || pz < z0 || pz > z1) return null; return hp - (pz - zc) * Math.tan(a); },
      upd(dt) { const tgt = onIt ? (B.z < zc ? -amax : amax) : a; a += clamp(tgt - a, -0.9 * dt, 0.9 * dt); obj.rotation.x = -a; if (Math.sign(a - lastA) !== 0 && Math.abs(a - lastA) > 0.0001 && Math.abs(a) >= amax * 0.999 && Math.abs(lastA) < amax * 0.999) sfx.clunk(); lastA = a; onIt = false; },
      mark() { onIt = true; } };
    return self;
  },
  // ---- barrel or pint-glass tunnel
  tunnel(e, k, X, Z, L, g) {
    const x = X(e.c), z = Z(e.r), len = e.len || 1.2, ro = 0.27, inr = 0.21, ax = e.axis === "x"; const segs = [], cw = (e.cw || 1) * T / 2;
    const add = (a1, b1, a2, b2) => segs.push(ax ? [x + b1, z + a1, x + b2, z + a2] : [x + a1, z + b1, x + a2, z + b2]);
    for (const s of [-1, 1]) { add(s * inr, -len / 2, s * inr, len / 2); add(s * inr, len / 2, s * cw, len / 2); add(s * inr, -len / 2, s * cw, -len / 2); }
    const cyl = (r, l, mat, op = true) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, l, 32, 1, op), mat); m.rotation.set(ax ? 0 : Math.PI / 2, 0, ax ? Math.PI / 2 : 0); m.position.set(x, Y0 + ro - 0.04, z); m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
    if (e.kind === "pint") { const glassT = new THREE.MeshPhysicalMaterial({ color: 0xf0f8ff, roughness: 0.03, transparent: true, opacity: 0.3, envMapIntensity: 2.4, side: THREE.DoubleSide, depthWrite: false }); cyl(ro, len, glassT); const rim = new THREE.Mesh(new THREE.TorusGeometry(ro, 0.015, 8, 32), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.1, transparent: true, opacity: 0.6 })); rim.position.set(x + (ax ? len / 2 : 0), Y0 + ro - 0.04, z + (ax ? 0 : len / 2)); rim.rotation.y = ax ? Math.PI / 2 : 0; g.add(rim); const lo = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.16), new THREE.MeshBasicMaterial({ map: logoTex(), transparent: true, depthWrite: false })); lo.position.set(x + (ax ? 0 : ro + 0.005), Y0 + ro + 0.02, z + (ax ? ro + 0.005 : 0)); lo.rotation.y = ax ? 0 : Math.PI / 2; g.add(lo); P(L, G.box, M.beer, null, x, Y0 + 0.006, z, ax ? len : inr * 1.6, 0.008, ax ? inr * 1.6 : len); }
    else { const woodIn = M.wood.clone(); woodIn.side = THREE.DoubleSide; woodIn.vertexColors = false; woodIn.color = new THREE.Color("#a87040"); cyl(ro, len, woodIn); for (const f of [-0.42, -0.2, 0.2, 0.42]) { const h = new THREE.Mesh(new THREE.TorusGeometry(ro + 0.012, 0.018, 8, 32), new THREE.MeshStandardMaterial({ color: 0x3a3632, roughness: 0.4, metalness: 0.9 })); h.position.set(x + (ax ? f * len : 0), Y0 + ro - 0.04, z + (ax ? 0 : f * len)); h.rotation.y = ax ? Math.PI / 2 : 0; g.add(h); } }
    for (const s of [-1, 1]) for (const f of [-1, 1]) P(L, G.box, M.wood, "#5a3a1a", x + (ax ? f * len / 2 : s * (inr + cw) / 2), Y0 + 0.08, z + (ax ? s * (inr + cw) / 2 : f * len / 2), ax ? 0.05 : cw - inr + 0.02, 0.16, ax ? cw - inr + 0.02 : 0.05);
    return { hit(o) { for (const s of segs) segHit(o, s[0], s[1], s[2], s[3], 0.4, o === B ? (e.kind === "pint" ? "glass" : "barrel") : "ball"); }, inside(px, pz) { return ax ? Math.abs(px - x) < len / 2 && Math.abs(pz - z) < inr : Math.abs(pz - z) < len / 2 && Math.abs(px - x) < inr; }, glassy: e.kind === "pint" };
  },
  // ---- copper pipe: the ball rolls in one end and comes out of the other
  pipe(e, k, X, Z, L, g) {
    const A = new THREE.Vector3(X(e.a[0]), Y0 + R, Z(e.a[1])), Bp = new THREE.Vector3(X(e.b[0]), Y0 + R, Z(e.b[1])), ad = new THREE.Vector3(e.ad[0], 0, e.ad[1]), bd = new THREE.Vector3(e.bd[0], 0, e.bd[1]), pk = e.peak || 0.5, up = new THREE.Vector3(0, 1, 0);
    const mid = A.clone().add(Bp).multiplyScalar(0.5).addScaledVector(up, pk);
    const cps = [A.clone(), A.clone().addScaledVector(ad, 0.35), A.clone().addScaledVector(ad, 0.75).addScaledVector(up, pk * 0.75), mid, Bp.clone().addScaledVector(bd, -0.75).addScaledVector(up, pk * 0.75), Bp.clone().addScaledVector(bd, -0.35), Bp.clone()];
    const curve = new THREE.CatmullRomCurve3(cps, false, "centripetal"); const pts = curve.getSpacedPoints(160);
    const mat = new THREE.MeshStandardMaterial({ color: e.col || 0xc8743a, roughness: 0.25, metalness: 1 });
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 160, 0.13, 16, false), mat); tube.castShadow = true; g.add(tube);
    for (let i = 0; i <= 8; i++) { const p = curve.getPointAt(i / 8), t = curve.getTangentAt(i / 8), f = new THREE.Mesh(new THREE.TorusGeometry(0.135, 0.022, 8, 24), mat); f.position.copy(p); f.lookAt(p.clone().add(t)); g.add(f); }
    for (const [p, d] of [[A, ad], [Bp, bd]]) { const m = new THREE.Mesh(new THREE.CircleGeometry(0.12, 24), new THREE.MeshBasicMaterial({ color: 0x060404 })); m.position.copy(p).addScaledVector(d, d === ad ? 0.02 : -0.02); m.lookAt(p.clone().addScaledVector(d, d === ad ? -1 : 1)); g.add(m); }
    for (const p of [cps[2], mid, cps[4]]) P(L, G.cyl8, M.metal, "#3a3a40", p.x, (p.y) / 2, p.z, 0.06, p.y, 0.06);
    const path = { pts, kind: "pipe", exitDir: bd };
    return { trig() { if (B.air) return false; const dx = B.x - A.x, dz = B.z - A.z; if (dx * dx + dz * dz > 0.26 * 0.26) return false; const sp = Math.hypot(B.vx, B.vz); if (sp < 0.3 || (B.vx * ad.x + B.vz * ad.z) / sp < 0.3) return false; enterPath({ ...path, pts: [new THREE.Vector3(B.x, B.y, B.z), ...path.pts] }, sp); sfx.pipeIn(); return true; }, hidden: true, path };
  },
  // ---- loop-the-loop: needs enough pace to get round the top
  loop(e, k, X, Z, L, g) {
    const dir = new THREE.Vector3(e.dir[0], 0, e.dir[1]), perp = new THREE.Vector3(-dir.z, 0, dir.x), up = new THREE.Vector3(0, 1, 0), rad = e.rad || 0.36, lat = 0.2;
    const C0 = new THREE.Vector3(X(e.c), Y0 + R, Z(e.r)), A = C0.clone().addScaledVector(dir, 0.45);
    const loopPts = (from) => { const p = []; for (let i = 0; i <= 12; i++) p.push(from.clone().lerp(A, i / 12)); for (let i = 1; i <= 90; i++) { const th = i / 90 * Math.PI * 2; p.push(A.clone().addScaledVector(dir, rad * Math.sin(th)).addScaledVector(up, rad * (1 - Math.cos(th))).addScaledVector(perp, lat * th / (Math.PI * 2))); } const E0 = A.clone().addScaledVector(perp, lat); for (let i = 1; i <= 14; i++) p.push(E0.clone().addScaledVector(dir, 0.55 * i / 14)); return p; };
    const vis = loopPts(C0.clone().addScaledVector(dir, -0.15));
    // the track: two rails just outside the ball's path, red and white
    const railMat = [new THREE.MeshStandardMaterial({ color: 0xd8202a, roughness: 0.3, metalness: 0.4 }), new THREE.MeshStandardMaterial({ color: 0xf4f4f4, roughness: 0.3, metalness: 0.4 })];
    const cen = A.clone().addScaledVector(up, rad);
    for (const s of [-1, 1]) { const rp = vis.map((p, i) => { const inLoop = i > 12 && i <= 102; let out; if (inLoop) { const q = p.clone().sub(cen).addScaledVector(perp, -p.clone().sub(A).dot(perp)); out = q.normalize(); } else out = up.clone().negate(); return p.clone().addScaledVector(out, 0.07).addScaledVector(perp, s * 0.065); }); const cv = new THREE.CatmullRomCurve3(rp); const segN = 12; for (let i = 0; i < segN; i++) { const sub = new THREE.CatmullRomCurve3(rp.slice(Math.floor(i * rp.length / segN), Math.min(rp.length, Math.floor((i + 1) * rp.length / segN) + 1))); const m = new THREE.Mesh(new THREE.TubeGeometry(sub, 16, 0.02, 8, false), railMat[i % 2]); m.castShadow = true; g.add(m); } void cv; }
    for (let i = 0; i < 9; i++) { const p = vis[13 + i * 10]; if (!p) continue; const q = p.clone().sub(cen); q.addScaledVector(perp, -q.dot(perp)); q.normalize(); const pp = p.clone().addScaledVector(q, 0.08); P(L, G.box, M.metal, "#c8c8d0", pp.x, pp.y, pp.z, Math.abs(perp.x) * 0.16 + 0.02, 0.02, Math.abs(perp.z) * 0.16 + 0.02); }
    for (const s of [-1, 1]) { const b = A.clone().addScaledVector(perp, s * 0.32 + lat / 2); P(L, G.box, M.metal, "#c8c8d0", b.x, Y0 + rad + 0.05, b.z, 0.04, rad * 2 + 0.1, 0.04); }
    P(L, G.box, M.metal, "#c8c8d0", A.x + perp.x * lat / 2, Y0 + rad * 2 + 0.2, A.z + perp.z * lat / 2, Math.abs(perp.x) * 0.7 + 0.04, 0.04, Math.abs(perp.z) * 0.7 + 0.04);
    return { trig() { if (B.air || B.path) return false; const dx = B.x - C0.x, dz = B.z - C0.z; if (dx * dx + dz * dz > 0.36 * 0.36) return false; const sp = Math.hypot(B.vx, B.vz); if (sp < 0.4 || (B.vx * dir.x + B.vz * dir.z) / sp < 0.75) return false; enterPath({ pts: loopPts(new THREE.Vector3(B.x, B.y, B.z)), kind: "loop", cen, rad, exitDir: dir }, sp); sfx.whoosh(); return true; } };
  },
  // ---- pool table: felt, cushions, six pockets and a rack of balls you can knock in
  pool(e, k, X, Z, L, g) {
    const x0 = X(e.c0) - T / 2, x1 = X(e.c1) + T / 2, z0 = Z(e.r0) - T / 2, z1 = Z(e.r1) + T / 2, long = (z1 - z0) > (x1 - x0), pr = 0.13;
    const pk = [[x0 + 0.06, z0 + 0.06], [x1 - 0.06, z0 + 0.06], [x0 + 0.06, z1 - 0.06], [x1 - 0.06, z1 - 0.06], long ? [x0 + 0.02, (z0 + z1) / 2] : [(x0 + x1) / 2, z0 + 0.02], long ? [x1 - 0.02, (z0 + z1) / 2] : [(x0 + x1) / 2, z1 - 0.02]];
    for (const [px, pz] of pk) { H.pockets.push({ x: px, z: pz, r: pr }); P(L, G.cyl, M.plain, "#050505", px, Y0 + 0.003, pz, pr * 2, 0.008, pr * 2); P(L, G.torus, M.metal, "#d8a848", px, Y0 + 0.008, pz, pr * 2 + 0.03, pr * 2 + 0.03, 0.4, 0, Math.PI / 2); }
    for (const d of [[(x0 + x1) / 2, z0 + (z1 - z0) * 0.25], [(x0 + x1) / 2, z0 + (z1 - z0) * 0.75]]) P(L, G.cyl, M.plain, "#f0f0f0", d[0], Y0 + 0.002, d[1], 0.04, 0.003, 0.04);
    // rack: a triangle of pool balls in front of the cup
    const cols = ["#f4c020", "#2a4ad8", "#d8202a", "#6a2aa8", "#f07a20", "#1a8a3a", "#7a1a1a", "#111111", "#f4c020", "#2a4ad8"], balls = [];
    const [rx, rz] = [X(e.rack[0]), Z(e.rack[1])]; let n = 0;
    for (let row = 0; row < 3; row++) for (let i = 0; i <= row; i++) { const bx = rx + (i - row / 2) * (R * 2.02), bz = rz - row * R * 1.76; const m = new THREE.Mesh(new THREE.SphereGeometry(R, 24, 16), new THREE.MeshPhysicalMaterial({ color: cols[n % cols.length], roughness: 0.15, clearcoat: 1 })); m.castShadow = true; g.add(m); balls.push({ x: bx, z: bz, vx: 0, vz: 0, m, live: true, y: Y0 + R }); n++; }
    const draw = () => { for (const b of balls) b.m.position.set(b.x, b.y, b.z); }; draw();
    return { balls, inPool: (x, z) => x > x0 && x < x1 && z > z0 && z < z1,
      sub(dt) { for (const b of balls) { if (!b.live) continue; if (b.drop) { b.y -= dt * 1.2; if (b.y < Y0 - 0.2) { b.live = false; b.m.visible = false; } continue; }
          const sp = Math.hypot(b.vx, b.vz); if (sp > 0) { const ns = Math.max(0, sp - (0.25 + sp * 0.4) * dt); b.vx *= ns / sp; b.vz *= ns / sp; b.x += b.vx * dt; b.z += b.vz * dt; }
          for (const w of H.walls) segHit(b, w.x1, w.z1, w.x2, w.z2, w.e, "ball");
          for (const p of H.pockets) if ((b.x - p.x) ** 2 + (b.z - p.z) ** 2 < (p.r - 0.02) ** 2) { b.drop = true; b.vx = b.vz = 0; sfx.pocket(); addBonus(25, "POTTED! +25"); }
          for (const c of balls) if (c !== b && c.live && !c.drop) ballBall(b, c); }
        for (const b of balls) if (b.live && !b.drop) ballBall(B, b); },
      upd() { draw(); }, moving: () => balls.some((b) => b.live && (Math.hypot(b.vx, b.vz) > 0.03 || b.drop)) };
  },
};
function ballBall(a, b) { const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz); if (d >= R * 2 || d < 1e-6) return; const nx = dx / d, nz = dz / d, ov = R * 2 - d; a.x -= nx * ov / 2; a.z -= nz * ov / 2; b.x += nx * ov / 2; b.z += nz * ov / 2; const vn = (a.vx - b.vx) * nx + (a.vz - b.vz) * nz; if (vn <= 0) return; const j = vn * 0.96; a.vx -= j * nx; a.vz -= j * nz; b.vx += j * nx; b.vz += j * nz; impact("ball", vn, a); }
let logoT = null; function logoTex() { return logoT || (logoT = (() => { const c = document.createElement("canvas"); c.width = 256; c.height = 128; const x = c.getContext("2d"); x.fillStyle = "rgba(255,255,255,.0)"; x.fillRect(0, 0, 256, 128); x.font = "56px Bungee, Impact"; x.textAlign = "center"; x.fillStyle = "#ffc64d"; x.fillText("LO", 128, 70); x.font = "bold 22px Inter, Arial"; x.fillStyle = "#fff"; x.fillText("PINT TUNNEL", 128, 108); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })()); }

// ---------------------------------------------------------------- building a hole
function disposeGroup(gr) { gr.traverse((o) => { if (o.geometry && o.geometry !== G.box && !Object.values(G).includes(o.geometry)) o.geometry.dispose(); if (o.material && o.material.map && o.material.map.isCanvasTexture && o.material.userData.own) o.material.map.dispose(); }); }
function buildHole(i) {
  if (hg) { scene.remove(hg); disposeGroup(hg); }
  anims.length = 0;
  const def = HOLES[i], th = def.theme, rows = def.map.length, cols = Math.max(...def.map.map((r) => r.length));
  const X = (c) => (c - (cols - 1) / 2) * T, Z = (r) => (r - (rows - 1) / 2) * T, elev = th.elev || 0;
  H = { def, i, rows, cols, X, Z, tiles: [], walls: [], ents: [], sups: [], trigs: [], pockets: [], start: null, cup: null, elev };
  // tiles
  for (let r = 0; r < rows; r++) { H.tiles[r] = []; for (let c = 0; c < cols; c++) { const ch = def.map[r][c] || " "; if (ch === " ") { H.tiles[r][c] = null; continue; }
    const t = { ch, c, r, kind: ch === "X" ? "void" : "^v<>".includes(ch) ? "ramp" : "flat", lv: "+shw".includes(ch) ? 1 : ch === "*" ? 2 : 0, sticky: ch === "~" };
    if (ch === "S" || ch === "s") H.start = [X(c), Z(r), t.lv]; if (ch === "H" || ch === "h") H.cup = [X(c) + (def.cupOff ? def.cupOff[0] : 0), Z(r) + (def.cupOff ? def.cupOff[1] : 0), t.lv]; H.tiles[r][c] = t; } }
  for (const row of H.tiles) for (const t of row) if (t && t.kind === "ramp") { const d = { "^": [0, -1], v: [0, 1], ">": [1, 0], "<": [-1, 0] }[t.ch]; const hiN = tileAt(t.c + d[0], t.r + d[1]), loN = tileAt(t.c - d[0], t.r - d[1]); t.lo = loN && loN.kind === "flat" ? loN.lv : 0; t.hi = hiN && hiN.kind === "flat" ? hiN.lv : t.lo + 1; }
  const pool = (def.ents || []).find((e) => e.t === "pool"); const inPoolTile = (c, r) => pool && c >= pool.c0 && c <= pool.c1 && r >= pool.r0 && r <= pool.r1;
  // bounds
  let bx0 = 1e9, bx1 = -1e9, bz0 = 1e9, bz1 = -1e9; for (const row of H.tiles) for (const t of row) if (t) { bx0 = Math.min(bx0, X(t.c) - T / 2); bx1 = Math.max(bx1, X(t.c) + T / 2); bz0 = Math.min(bz0, Z(t.r) - T / 2); bz1 = Math.max(bz1, Z(t.r) + T / 2); }
  const Bd = { x0: bx0, x1: bx1, z0: bz0, z1: bz1, cx: (bx0 + bx1) / 2, cz: (bz0 + bz1) / 2, w: bx1 - bx0, d: bz1 - bz0 }; H.B = Bd;
  hg = new THREE.Group(); hg.position.y = elev; scene.add(hg);
  const world = new THREE.Group(); scene.add(world); hg.userData.world = world; // things at true floor level (room, scenery)
  const Lc = [], Ld = [], Lw = [];
  const k = { L: Ld, Lw, g: hg, world, B: Bd, X, Z, T, elev, Y0, th, anims, PR, FAR, M, P, G, C, rnd, pick, neon: (t, col, x, y, z, ry = 0, w = 4, h = 1) => { const m = neon(t, col, w, h); m.material.userData.own = true; m.position.set(x, y, z); m.rotation.y = ry; world.add(m); return m; }, tv: (kind, x, y, z, ry = 0) => { PR.tv(Lw, x, y, z, ry); const m = tvScreen(kind); m.material.userData.own = true; m.position.set(x + Math.sin(ry) * 0.035, y, z + Math.cos(ry) * 0.035); m.rotation.y = ry; world.add(m); return m; } };
  // ---- the course: plinth, turf, ramps, water, rails
  const rail = th.rail || {}, railMat = rail.mat === "wood" || !rail.mat ? M.rail : M[rail.mat], railCol = rail.col || "#7a4a22", skirt = M[th.skirt || "wood"], skirtCol = th.skirtCol || "#4a2a14";
  M.turf.color.set(th.turf || "#ffffff");
  for (const row of H.tiles) for (const t of row) { if (!t) continue; const x = X(t.c), z = Z(t.r), bot = -elev;
    if (t.kind === "void") { const v = th.void || "water";
      if (v === "water") { P(Lc, G.box, M.plain, "#0a1a1e", x, (bot + 0.0) / 2 - 0.0, z, T, Math.max(0.02, -bot) + 0.0, T); P(Lc, G.plane, M.water, null, x, 0.035, z, T, T, 1, 0, -Math.PI / 2, 0, [T / 1.2, T / 1.2, (t.c * T / 1.2) % 1, (t.r * T / 1.2) % 1]); }
      else if (v === "flowers") PR.flowerBed(Lc, x, z, T, T, 0.01);
      else if (v === "hay") { P(Lc, G.box, M.fabric, "#c8a050", x, 0.03, z, T, 0.06, T); for (let q = 0; q < 14; q++) P(Lc, G.box, M.fabric, pick(["#d8b45a", "#b8903a", "#e8c870"]), x + rnd(-0.35, 0.35), 0.065, z + rnd(-0.35, 0.35), rnd(0.1, 0.25), 0.012, 0.012, rnd(0, 3)); }
      continue; }
    const topLo = Y0 + (t.kind === "ramp" ? t.lo * LH : t.lv * LH);
    P(Lc, G.box, skirt, skirtCol, x, (topLo - 0.004 + bot) / 2, z, T, topLo - 0.004 - bot, T, 0, 0, 0, [T, 0.4]);
    const tmat = inPoolTile(t.c, t.r) ? M.felt : M.turf, uv = [T / 1.6, T / 1.6, (t.c * T / 1.6) % 1, (-(t.r + 1) * T / 1.6) % 1];
    if (t.kind === "flat") { P(Lc, G.plane, tmat, null, x, topLo, z, T, T, 1, 0, -Math.PI / 2, 0, uv); if (t.sticky) P(Lc, G.cyl, M.beer, null, x + rnd(-0.06, 0.06), topLo + 0.003, z + rnd(-0.06, 0.06), T * 0.95, 0.004, T * 0.85, rnd(0, 3)); }
    else { const dh = (t.hi - t.lo) * LH, ang = Math.atan2(dh, T), len = Math.hypot(T, dh), ym = topLo + dh / 2;
      if (t.ch === "^" || t.ch === "v") { P(Lc, G.box, M.deck, "#b08a60", x, ym - 0.016, z, T, 0.03, len, 0, t.ch === "^" ? ang : -ang, 0, [T, len]); for (let q = 1; q < 6; q++) { const dz = (q / 6 - 0.5) * T, f = t.ch === "^" ? 0.5 - dz / T : 0.5 + dz / T; P(Lc, G.box, M.plain, "#2a1a0e", x, topLo + dh * f + 0.001, z + dz, T * 0.98, 0.003, 0.012, 0, t.ch === "^" ? ang : -ang); } }
      else { P(Lc, G.box, M.deck, "#b08a60", x, ym - 0.016, z, len, 0.03, T, 0, 0, t.ch === ">" ? ang : -ang, [len, T]); }
      for (const s of [-1, 1]) { if (t.ch === "^" || t.ch === "v") P(Lc, G.box, skirt, skirtCol, x + s * (T / 2 - 0.01), topLo + dh / 2, z, 0.02, dh, T); else P(Lc, G.box, skirt, skirtCol, x, topLo + dh / 2, z + s * (T / 2 - 0.01), T, dh, 0.02); } } }
  // walls: an edge needs a rail when the neighbour is empty, or a different height (not water/gaps: you can roll in those)
  const edges = [];
  for (const row of H.tiles) for (const t of row) { if (!t || t.kind === "void") continue;
    for (const [side, dc, dr, opp] of [["N", 0, -1, "S"], ["S", 0, 1, "N"], ["W", -1, 0, "E"], ["E", 1, 0, "W"]]) {
      const n = tileAt(t.c + dc, t.r + dr); if (n && n.kind === "void") continue;
      const p1 = edgeProf(t, side); let shared = false;
      if (n) { const p2 = edgeProf(n, opp); if (Math.abs(p1[0] - p2[0]) < 0.01 && Math.abs(p1[1] - p2[1]) < 0.01) continue; shared = true; }
      const horiz = side === "N" || side === "S", line = horiz ? Z(t.r) + dr * T / 2 : X(t.c) + dc * T / 2, a0 = horiz ? X(t.c) - T / 2 : Z(t.r) - T / 2;
      const top = Y0 + Math.max(p1[0], p1[1], n ? Math.max(...edgeProf(n, opp)) : 0) + 0.11;
      edges.push({ horiz, line, a0, a1: a0 + T, nx: -dc, nz: -dr, shared, top, pool: inPoolTile(t.c, t.r), draw: !shared || (dc + dr > 0) });
    } }
  edges.sort((a, b) => (a.horiz - b.horiz) || (a.line - b.line) || (a.nx - b.nx) || (a.nz - b.nz) || (a.a0 - b.a0));
  const runs = []; for (const e of edges) { const last = runs[runs.length - 1]; if (last && last.horiz === e.horiz && Math.abs(last.line - e.line) < 1e-4 && last.nx === e.nx && last.nz === e.nz && last.shared === e.shared && last.pool === e.pool && Math.abs(last.a1 - e.a0) < 1e-4 && Math.abs(last.top - e.top) < 0.01) last.a1 = e.a1; else runs.push({ ...e }); }
  for (const w of runs) {
    const off = w.shared ? RT / 2 : 0, e = w.pool ? 0.82 : (rail.e || 0.62), mat = w.pool ? "rubber" : (rail.snd || "wood");
    const seg = w.horiz ? { x1: w.a0, z1: w.line + w.nz * off, x2: w.a1, z2: w.line + w.nz * off } : { x1: w.line + w.nx * off, z1: w.a0, x2: w.line + w.nx * off, z2: w.a1 };
    H.walls.push(Object.assign(seg, { e, mat }));
    if (!w.draw) continue;
    const cOff = w.shared ? 0 : -RT / 2, len = w.a1 - w.a0 + (w.shared ? 0 : RT * 2), mid = (w.a0 + w.a1) / 2, cx = w.horiz ? mid : w.line + w.nx * cOff, cz = w.horiz ? w.line + w.nz * cOff : mid, h = w.top + elev;
    const sx = w.horiz ? len : RT, sz = w.horiz ? RT : len;
    if (w.pool) { P(Lc, G.box, M.wood, "#3a1a0a", cx, (w.top - elev) / 2 - 0.0, cz, sx, w.top + elev, sz, 0, 0, 0, [len / 1.5, 0.3]); P(Lc, G.box, M.felt, "#1d6e3a", cx - w.nx * 0.0, w.top + 0.004, cz, sx, 0.012, sz); P(Lc, G.box, M.metal, "#d8a848", cx + (w.horiz ? 0 : -w.nx * 0.05), w.top + 0.012, cz + (w.horiz ? -w.nz * 0.05 : 0), w.horiz ? len : 0.015, 0.006, w.horiz ? 0.015 : len); continue; }
    P(Lc, G.box, railMat, railCol, cx, w.top - h / 2, cz, sx, h, sz, 0, 0, 0, [len / 1.2, 0.3]);
    if (rail.cap) P(Lc, G.box, rail.cap === "brass" ? M.metal : rail.cap === "chrome" ? M.metal : M.wood, rail.cap === "brass" ? "#d8a848" : rail.cap === "chrome" ? "#e0e4ea" : rail.capCol || "#5a3a1a", cx, w.top + 0.008, cz, sx + 0.012, 0.016, sz + 0.012);
    if (rail.neon) { const nc = new THREE.Color(rail.neon).multiplyScalar(2.6); P(Lc, G.box, M.lights, nc, cx + (w.horiz ? 0 : w.nx * (RT / 2 + 0.004)), w.top - 0.05, cz + (w.horiz ? w.nz * (RT / 2 + 0.004) : 0), w.horiz ? len : 0.008, 0.018, w.horiz ? 0.008 : len); }
    for (const a of w.shared ? [] : [w.a0 - RT / 2, w.a1 + RT / 2]) { const px = w.horiz ? a : cx, pz = w.horiz ? cz : a; P(Lc, G.box, railMat, rail.postCol || railCol, px, w.top + 0.02 - (h + 0.04) / 2, pz, RT + 0.03, h + 0.04, RT + 0.03, 0, 0, 0, [0.2, 0.3]); if (rail.cap) P(Lc, G.box, M.metal, rail.cap === "chrome" ? "#e0e4ea" : "#d8a848", px, w.top + 0.035, pz, RT + 0.05, 0.012, RT + 0.05); }
  }
  // ---- cup with flag, tee mat
  const [hx, hz, hl] = H.cup, ht = Y0 + hl * LH; H.cupY = ht;
  P(Lc, G.cyl, M.plain, "#030303", hx, ht + 0.001, hz, CUP * 2, 0.004, CUP * 2); P(Lc, G.torus, M.paint, "#f4f4f4", hx, ht + 0.003, hz, CUP * 2 + 0.01, CUP * 2 + 0.01, 0.35, 0, Math.PI / 2);
  P(Lc, G.plane, M.glow, C(0.18, 0.16, 0.08), hx, ht + 0.006, hz, 0.9, 0.9, 1, 0, -Math.PI / 2);
  P(Lc, G.cyl8, M.paint, "#f4f4f4", hx, ht + 0.6, hz, 0.022, 1.2, 0.022); P(Lc, G.sph, M.paint, "#f4c020", hx, ht + 1.21, hz, 0.04, 0.04, 0.04);
  const flagG = new THREE.PlaneGeometry(0.34, 0.22, 8, 2), flag = new THREE.Mesh(flagG, new THREE.MeshStandardMaterial({ color: th.flag || 0xe8262e, side: THREE.DoubleSide, roughness: 0.7 })); flag.position.set(hx + 0.18, ht + 1.06, hz); flag.castShadow = true; hg.add(flag); const fp = flagG.attributes.position, fx0 = Float32Array.from(fp.array);
  anims.push((dt, t) => { for (let q = 0; q < fp.count; q++) { const x0 = fx0[q * 3] + 0.17; fp.setZ(q, Math.sin(t * 5 - x0 * 14) * 0.03 * x0 * 3); } fp.needsUpdate = true; });
  const [sx0, sz0, sl] = H.start; P(Lc, G.rbox, M.plain, "#24502a", sx0, Y0 + sl * LH + 0.002, sz0, 0.36, 0.008, 0.36); P(Lc, G.torus, M.paint, "#f4f4f4", sx0, Y0 + sl * LH + 0.009, sz0, 0.16, 0.16, 0.25, 0, Math.PI / 2);
  // ---- obstacles
  for (const e of def.ents || []) { const ent = makeEnt(e, k); ent.def = e; H.ents.push(ent); if (ent.sup) H.sups.push(ent); if (ent.trig) H.trigs.push(ent); }
  // ---- the setting: room or outdoors, then the hole's own decoration
  { const p1 = (def.path && def.path[1]) || [0, 0], dx = H.start[0] - X(p1[0]), dz = H.start[1] - Z(p1[1]), l = Math.hypot(dx, dz) || 1; k.cam = [H.start[0] + dx / l * 2.6, H.start[1] + dz / l * 2.6]; }
  setting(k, th);
  if (def.deco) def.deco(k);
  bakeInto(Lc, hg); bakeInto(Ld, hg); bakeInto(Lw, world);
  for (const m of hg.children) if (m.isMesh && m.material === M.turf) m.castShadow = false;
  H.world = world; hg.userData.world = world;
  const oldWorld = scene.userData.world; if (oldWorld) { scene.remove(oldWorld); disposeGroup(oldWorld); } scene.userData.world = world;
  // path waypoints for the camera and the helper
  H.path = (def.path || []).map(([c, r, m]) => [X(c), Z(r), m || 0]);
}

// ---------------------------------------------------------------- settings: lights, sky, room, scenery
function setting(k, th) {
  const Bd = k.B, L = k.Lw, world = k.world, out = th.kind === "out", lt = th.light || {};
  scene.background = new THREE.Color(th.bg || (out ? 0x1a2030 : 0x0a0808)); scene.fog.color.set(th.fog ? th.fog[0] : (out ? 0x2a3040 : 0x120c0c)); scene.fog.near = th.fog ? th.fog[1] : 18; scene.fog.far = th.fog ? th.fog[2] : 60;
  renderer.toneMappingExposure = th.exposure || 1.1;
  if (envTex) envTex.dispose(); envTex = pubEnv(renderer, th.env); scene.environment = envTex;
  const hm = lt.hemi || (out ? [0xbcd0ff, 0x3a3020, 0.9] : [0xffd0a0, 0x2a1408, 0.5]); hemi.color.set(hm[0]); hemi.groundColor.set(hm[1]); hemi.intensity = hm[2];
  const big = Math.max(Bd.w, Bd.d), cx = Bd.cx, cz = Bd.cz;
  if (lt.sun) { sun.visible = true; spot.visible = false; sun.color.set(lt.sun[0]); sun.intensity = lt.sun[1]; const d = lt.sun[2] || [6, 10, 4]; sun.position.set(cx + d[0], d[1], cz + d[2]); sun.target.position.set(cx, 0, cz); const sc = sun.shadow.camera, e = big / 2 + 2.5; sc.left = -e; sc.right = e; sc.top = e; sc.bottom = -e; sc.near = 1; sc.far = 40; sc.updateProjectionMatrix(); sun.shadow.mapSize.set(S.Q >= 2 ? 2048 : 1024, S.Q >= 2 ? 2048 : 1024); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
  else { sun.visible = false; spot.visible = true; const sp = lt.spot || [0xffd2a0, 200]; spot.color.set(sp[0]); spot.intensity = sp[1] * Math.max(1, big / 7) ** 1.2; const hgt = Math.max(5.5, big * 0.9); spot.position.set(cx + big * 0.15, hgt, cz + big * 0.25); spot.target.position.set(cx, 0, cz); spot.distance = hgt * 3; spot.angle = clamp(Math.atan((big * 0.62 + 1) / hgt), 0.4, 1.1); spot.shadow.mapSize.set(S.Q >= 2 ? 2048 : 1024, S.Q >= 2 ? 2048 : 1024); if (spot.shadow.map) { spot.shadow.map.dispose(); spot.shadow.map = null; } }
  const pts = lt.pts || []; fills.forEach((f, i) => { const p = pts[i]; if (!p) { f.intensity = 0; f.visible = false; return; } f.visible = true; f.position.set(cx + p[0] * (Bd.w / 2 + 1), p[1], cz + p[2] * (Bd.d / 2 + 1)); f.color.set(p[3]); f.intensity = p[4]; f.distance = p[5] || 14; });
  // room or ground
  const mx = th.margin || 3.2, rx0 = Bd.x0 - mx, rx1 = Bd.x1 + mx, rz0 = Bd.z0 - mx - 0.8, rz1 = Bd.z1 + mx, W = rx1 - rx0, D = rz1 - rz0, Hh = th.height || 4.2;
  k.room = { x0: rx0, x1: rx1, z0: rz0, z1: rz1, w: W, d: D, h: Hh, cx: (rx0 + rx1) / 2, cz: (rz0 + rz1) / 2 };
  const fm = M[th.floor || "boards"], ftint = th.floorTint || null;
  if (out) {
    const gsz = 60; P(L, G.plane, fm, ftint, cx, 0, cz, gsz, gsz, 1, 0, -Math.PI / 2, 0, [gsz / (th.floorScale || 2.5), gsz / (th.floorScale || 2.5)]);
    if (th.sky) { const sk = skyDome(...th.sky); sk.material.userData.own = true; sk.position.set(cx, 0, cz); world.add(sk); }
  } else {
    P(L, G.plane, fm, ftint, (rx0 + rx1) / 2, 0, (rz0 + rz1) / 2, W, D, 1, 0, -Math.PI / 2, 0, [W / (th.floorScale || 2.4), D / (th.floorScale || 2.4)]);
    const wm = M[th.wall || "brick"], wt = th.wallTint || null;
    for (const [x, z, ry, len] of [[(rx0 + rx1) / 2, rz0, 0, W], [rx0, (rz0 + rz1) / 2, Math.PI / 2, D], [rx1, (rz0 + rz1) / 2, -Math.PI / 2, D], [(rx0 + rx1) / 2, rz1, Math.PI, W]]) {
      P(L, G.plane, wm, wt, x, Hh / 2, z, len, Hh, 1, ry, 0, 0, [len / (th.wallScale || 2.6), Hh / (th.wallScale || 2.6)]);
      const nx = Math.sin(ry), nz = Math.cos(ry);
      if (th.wainscot !== false) { P(L, G.box, M.wood, th.wainscot || "#5a3018", x + nx * 0.04, 0.55, z + nz * 0.04, len, 1.1, 0.08, ry, 0, 0, [len / 2, 0.5]); P(L, G.box, M.wood, "#2a160c", x + nx * 0.09, 1.12, z + nz * 0.09, len, 0.06, 0.06, ry); }
      P(L, G.box, M.wood, "#1c0e08", x + nx * 0.03, 0.04, z + nz * 0.03, len, 0.08, 0.06, ry);
    }
    if (th.ceiling !== false) { P(L, G.plane, M[th.ceiling || "plaster"], th.ceilTint || "#6a5a48", (rx0 + rx1) / 2, Hh, (rz0 + rz1) / 2, W, D, 1, 0, Math.PI / 2, 0, [W / 2.5, D / 2.5]); for (let x = rx0 + 1; x < rx1; x += 1.8) P(L, G.box, M.wood, "#2a160c", x, Hh - 0.12, (rz0 + rz1) / 2, 0.22, 0.24, D, 0, 0, 0, [0.3, D / 2]); }
  }
}

// ---------------------------------------------------------------- the ball's physics
const timers = []; const later = (sec, fn) => timers.push({ t: Tm + sec, fn });
let bonusHole = 0, restT = 0, fallT = 0, Tm = 0, lastSurf = "turf";
const SUBSTEPS = 4;
function enterPath(path, sp) { const pts = path.pts, cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + pts[i].distanceTo(pts[i - 1])); B.path = { ...path, cum, s: 0, v: sp, total: cum[cum.length - 1] }; B.air = false; }
function pathPos(s) { const P2 = B.path, cum = P2.cum; let i = 1; while (i < cum.length - 1 && cum[i] < s) i++; const t = clamp((s - cum[i - 1]) / Math.max(1e-6, cum[i] - cum[i - 1]), 0, 1); return [P2.pts[i - 1].clone().lerp(P2.pts[i], t), P2.pts[i].clone().sub(P2.pts[i - 1]).normalize()]; }
function stepPath(dt) {
  const p = B.path, [, tan] = pathPos(p.s);
  const smooth = p.kind === "pipe"; p.v += (-G57 * tan.y - Math.sign(p.v) * (smooth ? 0.1 + Math.abs(p.v) * 0.04 : 0.25 + Math.abs(p.v) * 0.12)) * dt;
  if (Math.abs(p.v) < 0.12 && Math.abs(tan.y) < 0.15) p.v = p.s < p.total / 2 ? -0.9 : 0.9; // never sit still inside: it creeps out of the nearer end
  if (p.kind === "loop") { const [pos] = pathPos(p.s); if (pos.y > p.cen.y && p.v > 0 && p.v * p.v < GRAV * p.rad * 0.55 && !p.slip) { p.slip = true; p.v = Math.min(p.v, 0.05); } }
  p.s += p.v * dt;
  if (p.s >= p.total) { const [pos, t2] = pathPos(p.total); leavePath(pos, t2, p.v, false); return; }
  if (p.s <= 0) { const [pos, t2] = pathPos(0); leavePath(pos, t2, p.v, true); return; }
  const [pos] = pathPos(p.s); B.x = pos.x; B.y = pos.y; B.z = pos.z;
  if (p.kind === "pipe" && Math.random() < dt * 8) roll.set(0.5, 1, "metal");
}
function leavePath(pos, tan, v, back) { const kind = B.path.kind; B.path = null; const h = Math.hypot(tan.x, tan.z) || 1; B.x = pos.x; B.z = pos.z; B.vx = tan.x / h * v; B.vz = tan.z / h * v; const s = surfAt(B.x, B.z); B.y = s ? s.h + R : pos.y; B.vy = 0; B.air = !s; if (kind === "pipe" && !back) sfx.pipeOut(); if (back && kind === "loop") toast("NOT ENOUGH PACE<small>Hit it harder to get round the loop</small>", "bad", 1500); if (back && kind === "pipe") toast("NOT ENOUGH PACE<small>Give it more welly up the pipe</small>", "bad", 1500); }
function step(dt) {
  if (B.sink) return;
  if (B.path) { stepPath(dt); return; }
  for (const e of H.trigs) if (e.trig()) return;
  let s0 = surfAt(B.x, B.z);
  if (!B.air) {
    if (!s0 || s0.h < B.y - R - 0.05) B.air = true;
    else {
      if (s0.e && s0.e.mark) s0.e.mark();
      const e2 = 0.03, hx1 = surfAt(B.x + e2, B.z), hx0 = surfAt(B.x - e2, B.z), hz1 = surfAt(B.x, B.z + e2), hz0 = surfAt(B.x, B.z - e2);
      const gx = hx1 && hx0 && Math.abs(hx1.h - hx0.h) < 0.06 ? (hx1.h - hx0.h) / (2 * e2) : 0, gz = hz1 && hz0 && Math.abs(hz1.h - hz0.h) < 0.06 ? (hz1.h - hz0.h) / (2 * e2) : 0;
      B.vx -= G57 * gx * dt; B.vz -= G57 * gz * dt; B.slope = Math.hypot(gx, gz);
      let fr = 0.55, kk = 0.35; const t = s0.t; lastSurf = "turf";
      if (t && t.sticky) { fr = 2.6; kk = 1.6; } if (t && t.kind === "ramp") { fr = 0.42; kk = 0.3; lastSurf = "wood"; } if (s0.e) { fr = 0.42; kk = 0.3; lastSurf = "wood"; }
      for (const e of H.ents) if (e.inPool && e.inPool(B.x, B.z)) { fr = 0.4; kk = 0.24; lastSurf = "felt"; }
      for (const e of H.ents) if (e.inside && e.inside(B.x, B.z)) { lastSurf = e.glassy ? "glass" : "wood"; }
      // carriers: the coaster drags, a moving bridge carries
      B.ride = null; for (const e of H.ents) if (e.carry) { const c = e.carry(B, dt); if (c) { if (Math.hypot(B.vx - c[0], B.vz - c[1]) < 0.35) { B.ride = c; B.vx = c[0]; B.vz = c[1]; } else { const k2 = 2.4 * dt; B.vx += (c[0] - B.vx) * k2; B.vz += (c[1] - B.vz) * k2; } } }
      if (s0.e && s0.e.vel) { B.x += s0.e.vel()[0] * dt; }
      const sp = Math.hypot(B.vx, B.vz); if (sp > 0 && !B.ride) { const ns = Math.max(0, sp - (kk + sp * fr) * dt); B.vx *= ns / sp; B.vz *= ns / sp; }
    }
  }
  const ox = B.x, oz = B.z; B.x += B.vx * dt; B.z += B.vz * dt;
  for (const w of H.walls) segHit(B, w.x1, w.z1, w.x2, w.z2, w.e, w.mat);
  for (const e of H.ents) if (e.hit) e.hit(B);
  for (const e of H.ents) if (e.sub) e.sub(dt);
  for (const w of H.walls) segHit(B, w.x1, w.z1, w.x2, w.z2, w.e, w.mat);
  const s1 = surfAt(B.x, B.z);
  if (B.air) { B.vy -= GRAV * dt; B.y += B.vy * dt; if (s1 && B.y - R < s1.h - 0.15 && B.y > Y0 - 0.1) { B.x = ox; B.z = oz; const s0b = surfAt(ox, oz); if (!s0b || s0b.h < s1.h - 0.1) { B.vx *= -0.35; B.vz *= -0.35; impact("wood", 2, B); } } else if (s1 && B.y - R <= s1.h && B.y - R > s1.h - 0.15) { const imp = -B.vy; B.y = s1.h + R; B.vy = 0; B.air = false; if (imp > 0.6) { sfx.land(imp); B.vx *= 0.88; B.vz *= 0.88; if (imp > 1.5) fx.burst(B.x, B.y - R, B.z, 8, 0xffffff, 0.6, 0.6); } } }
  else if (s1) { const ny = s1.h + R; if (ny - B.y > 0.06) { B.x = ox; B.z = oz; B.vx *= -0.3; B.vz *= -0.3; } else { B.vy = (ny - B.y) / dt; B.y = ny; } }
  else B.air = true;
  // the cup: drops in if it's slow enough, lips out if it's going too fast
  const [hx, hz] = H.cup, dh = Math.hypot(B.x - hx, B.z - hz), spd = Math.hypot(B.vx, B.vz);
  if (!B.air && Math.abs(B.y - R - H.cupY) < 0.05) {
    if (dh < CUP - R * 0.25) { if (spd < 2.3) { B.sink = 0.0001; B.vx *= 0.3; B.vz *= 0.3; sfx.cup(); } else { const nx = (B.x - hx) / dh, nz = (B.z - hz) / dh; B.vx += nx * spd * 0.25; B.vz += nz * spd * 0.25; B.vx *= 0.85; B.vz *= 0.85; impact("metal", spd * 0.3, B); } }
    else if (dh < CUP * 1.7 && spd < 0.9) { B.vx += (hx - B.x) / dh * 0.9 * dt; B.vz += (hz - B.z) / dh * 0.9 * dt; }
  }
}

// ---------------------------------------------------------------- game state
const params = new URLSearchParams(location.search);
let state = "menu", mode = "front", order = [], holeN = 0, strokes = 0, card = [], best = { front: +(store.get("golfBest9") || 0), champ: +(store.get("golfBest") || 0) };
let lastRest = { x: 0, z: 0, y: 0 }, introT = 0, camMode = "follow", yawOff = 0;
const show = (id) => { for (const k2 of ["gate", "start", "pick", "pause", "over", "between"]) { const el = $(k2); if (el) el.hidden = k2 !== id; } $("hud").hidden = id !== null; $("hbtns").hidden = id !== null; };
function points(par, s) { return Math.max(0, par + 3 - s) * 100 + (s === 1 ? 200 : 0); }
function total() { return card.reduce((a, c) => a + points(c.par, c.s) + (c.bonus || 0), 0); }
function vsPar() { const d = card.reduce((a, c) => a + c.s - c.par, 0); return d === 0 ? "E" : (d > 0 ? "+" : "") + d; }
function addBonus(n, msg) { bonusHole += n; if (msg) toast(msg, "gold", 1300); hud(); }
function hud() { const def = HOLES[order[holeN]]; $("hHole").textContent = mode === "practice" ? `${order[holeN] + 1}` : `${holeN + 1}/${order.length}`; $("hName").textContent = def.name; $("hPar").textContent = def.par; $("hStrokes").textContent = strokes; $("hTotal").textContent = card.length ? vsPar() : "E"; $("hPts").textContent = (total() + bonusHole).toLocaleString("en-GB"); }
function startMode(m, single) {
  mode = m; order = m === "front" ? [0, 1, 2, 3, 4, 5, 6, 7, 8] : m === "champ" ? [...Array(18).keys()] : [single]; holeN = 0; card = []; sfx.click(); loadHole(0); show(null);
}
function loadHole(n) {
  holeN = n; timers.length = 0; const i = order[n]; buildHole(i); const def = HOLES[i];
  strokes = 0; bonusHole = 0; B.x = H.start[0]; B.z = H.start[1]; B.y = Y0 + H.start[2] * LH + R; B.vx = B.vz = B.vy = 0; B.air = false; B.path = null; B.sink = 0; lastRest = { x: B.x, z: B.z, y: B.y };
  hg.add(ballMesh, blob, aimDots, aimRing, aimHead); ballMesh.visible = true; ballMesh.scale.setScalar(1);
  state = "intro"; introT = 0; camMode = "follow"; yawOff = 0; aimYaw = null; placeCamOverview(true);
  hud(); banner(i, def);
  playMusic(def.theme.music || "acoustic", i + 1); ambience(def.theme.amb || "pub");
}
function banner(i, def) { const el = $("banner"); el.innerHTML = `<small>HOLE ${i + 1}</small><b>${def.name}</b><span>PAR ${def.par} · ${def.tag || ""}</span>`; el.classList.remove("on"); void el.offsetWidth; el.classList.add("on"); }
function sunk() {
  const def = HOLES[order[holeN]], d = strokes - def.par; const rec = { i: order[holeN], par: def.par, s: strokes, bonus: bonusHole };
  const NAMES = { "-4": "CONDOR!", "-3": "ALBATROSS!", "-2": "EAGLE!", "-1": "BIRDIE!", "0": "PAR", "1": "BOGEY", "2": "DOUBLE BOGEY", "3": "TRIPLE BOGEY" };
  const name = strokes === 1 ? "HOLE IN ONE!" : NAMES[d] || "+" + d;
  toast(`${name}<small>${strokes} stroke${strokes > 1 ? "s" : ""} · +${points(def.par, strokes) + bonusHole} pts</small>`, d <= -1 ? "gold" : d === 0 ? "good" : "bad", 2000);
  if (strokes === 1) { sfx.fanfare(); sfx.applause(true, 3); for (let q = 0; q < 4; q++) setTimeout(() => fx.burst(H.cup[0] + rnd(-0.5, 0.5), H.cupY + 0.5, H.cup[1] + rnd(-0.5, 0.5), 50, pick([0xffd23a, 0xff3d7f, 0x3de0ff, 0x2ee59d]), 2.5, 4), q * 250); try { PUB.confetti(); } catch (e) {} }
  else if (d <= -1) { sfx.fanfare(); sfx.applause(true, 2.2); fx.burst(H.cup[0], H.cupY + 0.4, H.cup[1], 60, 0xffd23a, 2.5, 4); }
  else if (d === 0) sfx.applause(false, 1.6); else if (d >= 2) sfx.sad();
  if (mode !== "practice") card.push(rec); else lastPractice = rec;
  state = "sunk"; hud(); later(1.9, () => between(rec));
}
let lastPractice = null, betweenTimer = 0;
function between(rec) {
  if (state !== "sunk" && state !== "picked") return;
  const last = mode !== "practice" && holeN >= order.length - 1; if (last) { finish(); return; }
  state = "between"; const el = $("between").querySelector(".card"), def = HOLES[rec.i], d = rec.s - rec.par;
  el.innerHTML = `<h2>${def.name.toUpperCase()}</h2><div class="stats"><div class="stat"><b>${rec.s}</b><span>Strokes</span></div><div class="stat"><b class="${d < 0 ? "u" : d > 0 ? "o" : ""}">${d === 0 ? "E" : (d > 0 ? "+" : "") + d}</b><span>To par</span></div><div class="stat"><b>${(points(rec.par, rec.s) + (rec.bonus || 0)).toLocaleString("en-GB")}</b><span>Points</span></div></div>${mode !== "practice" ? scoreCard(card, order) : ""}` +
    (mode === "practice" ? `<button class="btn go" id="bAgain" type="button">PLAY IT AGAIN</button><div class="row"><button class="btn ghost" id="bPick" type="button">Pick a hole</button><button class="btn ghost" id="bMenu" type="button">Menu</button></div>` : `<button class="btn go" id="bNext" type="button">NEXT HOLE ›</button><p class="fine">Next: Hole ${order[holeN + 1] + 1} · ${HOLES[order[holeN + 1]].name}</p>`);
  show("between"); [...el.querySelectorAll(".sc td")].forEach((td, q) => setTimeout(() => td.classList.add("in"), 30 + q * 8));
  sfx.card(0);
  if ($("bNext")) $("bNext").onclick = () => { sfx.click(); loadHole(holeN + 1); show(null); };
  if ($("bAgain")) $("bAgain").onclick = () => { sfx.click(); loadHole(0); show(null); };
  if ($("bPick")) $("bPick").onclick = () => { sfx.click(); openPick(); };
  if ($("bMenu")) $("bMenu").onclick = () => { sfx.click(); toMenu(); };
}
function scoreCard(cd, ord) {
  const halves = ord.length > 9 ? [ord.slice(0, 9), ord.slice(9)] : [ord]; let html = "";
  halves.forEach((hs, hi) => { const recs = hs.map((i) => cd.find((c) => c.i === i)); const sum = (f) => recs.reduce((a, c, q) => a + (c ? f(c, q) : 0), 0);
    const parT = hs.reduce((a, i) => a + HOLES[i].par, 0), youT = sum((c) => c.s), label = ord.length > 9 ? (hi ? "IN" : "OUT") : "TOT";
    html += `<table class="sc"><tr><th>HOLE</th>${hs.map((i) => `<th>${i + 1}</th>`).join("")}<th>${label}</th></tr><tr class="par"><td>PAR</td>${hs.map((i) => `<td>${HOLES[i].par}</td>`).join("")}<td>${parT}</td></tr><tr class="you"><td>YOU</td>${recs.map((c) => `<td class="${c ? (c.s === 1 ? "ace" : c.s < c.par ? "u" : c.s > c.par ? "o" : "") : "e"}">${c ? c.s : "·"}</td>`).join("")}<td>${recs.some(Boolean) ? youT : "·"}</td></tr></table>`; });
  return html;
}
function finish() {
  state = "over"; stopMusic(); const score = total(), key = mode === "champ" ? "champ" : "front", isBest = score > best[key];
  if (isBest) { const p = best[key]; best[key] = score; store.set(mode === "champ" ? "golfBest" : "golfBest9", String(score)); if (p > 0) PUB.record(p, score); }
  PUB.submit(mode === "champ" ? "golf" : "golf9", score);
  $("fTitle").textContent = mode === "champ" ? "CHAMPIONSHIP RESULTS" : "FRONT NINE RESULTS";
  $("fScore").textContent = score.toLocaleString("en-GB"); $("fPar").textContent = vsPar(); $("fBest").textContent = best[key].toLocaleString("en-GB"); $("newBest").hidden = !isBest;
  const aces = card.filter((c) => c.s === 1).length, birds = card.filter((c) => c.s < c.par).length, bon = card.reduce((a, c) => a + (c.bonus || 0), 0);
  $("fExtra").textContent = `${birds} under par · ${aces} hole${aces === 1 ? "" : "s"} in one · ${bon} bonus pts`;
  $("card").innerHTML = scoreCard(card, order); document.querySelectorAll("#over .lb-btn").forEach((b) => (b.dataset.lb = mode === "champ" ? "golf" : "golf9"));
  if (score > (mode === "champ" ? 3000 : 1500)) { sfx.fanfare(); sfx.applause(true, 3); } else sfx.applause(false, 1.6);
  show("over"); [...document.querySelectorAll("#card td")].forEach((td, q) => setTimeout(() => td.classList.add("in"), 200 + q * 10));
}
function penalty(kind) {
  if (state !== "roll") return; state = "fallen"; strokes++; hud(); roll.set(0);
  const msg = { water: "IN THE DRINK!", flowers: "IN THE FLOWER BED!", hay: "IN THE HAY!", gap: "OVER THE EDGE!", pocket: "POTTED YOURSELF!" }[kind] || "OUT OF BOUNDS!";
  if (kind === "water") { sfx.splash(); fx.burst(B.x, Y0, B.z, 30, 0x9adfff, 1.2, 2.2); } else if (kind === "flowers" || kind === "hay") sfx.rustle(); else if (kind === "pocket") sfx.pocket(); else sfx.drop();
  toast(`${msg}<small>+1 stroke penalty</small>`, "bad", 1500);
  later(1.2, () => { if (state !== "fallen") return; B.x = lastRest.x; B.z = lastRest.z; B.y = lastRest.y; B.vx = B.vz = B.vy = 0; B.air = false; B.path = null; ballMesh.visible = true; ballMesh.scale.setScalar(1); if (strokes >= HOLES[order[holeN]].par + 4) pickup(); else { state = "aim"; aimYaw = null; } });
}
function pickup() { const def = HOLES[order[holeN]]; strokes = def.par + 4; toast("PICKED UP<small>Maximum strokes reached</small>", "bad", 1500); const rec = { i: order[holeN], par: def.par, s: strokes, bonus: bonusHole }; if (mode !== "practice") card.push(rec); else lastPractice = rec; state = "picked"; hud(); later(1.6, () => between(rec)); }
function toMenu() { state = "menu"; stopMusic(); stopAmbience(); roll.set(0); show("start"); $("bestF").textContent = best.front.toLocaleString("en-GB"); $("bestC").textContent = best.champ.toLocaleString("en-GB"); }

// ---------------------------------------------------------------- aiming: drag back from anywhere, let go to putt
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hitV = new THREE.Vector3();
function ground(e) { ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera); plane.constant = -(B.y + H.elev); return ray.ray.intersectPlane(plane, hitV) ? hitV.clone() : null; }
let drag = null, shot = { dx: 0, dz: -1, p: 0 };
const cv = $("game");
cv.addEventListener("pointerdown", (e) => { if (state === "intro") { introT = 99; return; } if (state !== "aim") return; const g = ground(e); if (!g) return; drag = { sx: e.clientX, sy: e.clientY, g0: g, tick: -1 }; try { cv.setPointerCapture(e.pointerId); } catch (x) {} });
cv.addEventListener("pointermove", (e) => { if (!drag) return; const g = ground(e); if (!g) return; const dx = drag.g0.x - g.x, dz = drag.g0.z - g.z, l = Math.hypot(dx, dz), px = Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy); if (l < 1e-4) return; shot = { dx: dx / l, dz: dz / l, p: clamp(px / (Math.min(innerWidth, innerHeight) * 0.42), 0, 1) }; const tk = Math.floor(shot.p * 10); if (shot.p > 0.03 && tk !== drag.tick) { drag.tick = tk; sfx.tick(); } });
cv.addEventListener("pointerup", () => { if (!drag) return; drag = null; if (state === "aim" && shot.p > 0.04) putt(); shot.p = 0; });
cv.addEventListener("pointercancel", () => { drag = null; shot.p = 0; });
function putt() { const sp = shot.p * shot.p * 3.4 + shot.p * 4.4; B.vx = shot.dx * sp; B.vz = shot.dz * sp; strokes++; lastRest = { x: B.x, z: B.z, y: B.y }; state = "roll"; restT = 0; sfx.strike(shot.p); hud(); bumpEl($("hStrokes").parentElement); aimYaw = Math.atan2(shot.dx, -shot.dz); }

// ---------------------------------------------------------------- camera
const camPos = new THREE.Vector3(0, 6, 6), camLook = new THREE.Vector3(); let aimYaw = null, camYaw = 0;
function nextTarget() { // the next waypoint along the hole from where the ball is
  const pth = H.path; if (!pth.length) return [H.cup[0], H.cup[1]]; let bi = 0, bd = 1e9;
  for (let i = 0; i < pth.length - 1; i++) { const [ax, az] = pth[i], [bx, bz] = pth[i + 1], dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz, t = clamp(((B.x - ax) * dx + (B.z - az) * dz) / l2, 0, 1), d = Math.hypot(B.x - ax - dx * t, B.z - az - dz * t); if (d < bd - 1e-3) { bd = d; bi = i; } }
  let j = bi + 1; while (j < pth.length - 1 && Math.hypot(pth[j][0] - B.x, pth[j][1] - B.z) < 0.9) j++; return pth[j];
}
function placeCamOverview(snap) { const Bd = H.B, portrait = innerWidth / innerHeight < 0.9, big = Math.max(Bd.w * (portrait ? 1.7 : 1), Bd.d); const p = new THREE.Vector3(Bd.cx, big * 0.95 + 2 + H.elev, Bd.cz + big * 0.55 + 1.5), l = new THREE.Vector3(Bd.cx, H.elev, Bd.cz - 0.2); if (snap) { camPos.copy(p); camLook.copy(l); } return [p, l]; }
function updateCam(dt) {
  if (!H) return;
  const portrait = innerWidth / innerHeight < 0.9;
  if (state === "menu") { const Bd = H.B, a = Tm * 0.1, r = Math.max(Bd.w, Bd.d) * 0.8 + 3; camPos.set(Bd.cx + Math.sin(a) * r, r * 0.55 + 1.5 + H.elev, Bd.cz + Math.cos(a) * r); camLook.set(Bd.cx, H.elev, Bd.cz); camera.position.copy(camPos); camera.lookAt(camLook); return; }
  let tp, tl, rate = 3;
  if (camMode === "over" || state === "intro") { [tp, tl] = placeCamOverview(false); rate = state === "intro" ? 1.2 : 3; }
  else {
    if (state === "aim" && aimYaw === null) { const [tx, tz] = nextTarget(); aimYaw = Math.atan2(tx - B.x, -(tz - B.z)); }
    const want = (aimYaw ?? 0) + yawOff; let dy = want - camYaw; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2; camYaw += dy * Math.min(1, dt * (state === "aim" ? 4 : 1.2));
    const fx2 = Math.sin(camYaw), fz2 = -Math.cos(camYaw), dist = portrait ? 3.5 : 3.1, hgt = portrait ? 2.45 : 1.9, by = (B.path ? B.y : Math.max(B.y, Y0)) + H.elev;
    tp = new THREE.Vector3(B.x - fx2 * dist, by + hgt, B.z - fz2 * dist); tl = new THREE.Vector3(B.x + fx2 * 2.0, by - 0.35, B.z + fz2 * 2.0);
    if (state === "roll" || state === "sunk") rate = 3.2;
  }
  const k2 = Math.min(1, dt * rate); camPos.lerp(tp, k2); camLook.lerp(tl, k2); camera.position.copy(camPos); camera.lookAt(camLook);
}

// ---------------------------------------------------------------- main loop
let tPrev = performance.now();
function update(dt) {
  Tm += dt;
  for (let i = timers.length - 1; i >= 0; i--) if (timers[i].t <= Tm) { const f = timers[i].fn; timers.splice(i, 1); f(); }
  if (H) {
    for (const e of H.ents) if (e.upd) e.upd(dt, Tm);
    for (const a of anims) a(dt, Tm);
    if (M.water.normalMap) { M.water.normalMap.offset.x = Tm * 0.02; M.water.normalMap.offset.y = Tm * 0.013; }
    if (state === "intro") { introT += dt; if (introT > 2.4) { state = "aim"; camMode = "follow"; } }
    // a ball sitting on the spinning coaster or a moving bridge goes along for the ride while you line up
    if (state === "aim" || state === "intro") { const s = surfAt(B.x, B.z); if (s && s.e && s.e.vel) B.x += s.e.vel()[0] * dt; for (const e of H.ents) if (e.carry) { const c = e.carry(B, dt); if (c) { B.x += c[0] * dt; B.z += c[1] * dt; } } if (s && s.e && s.e.sup) { const s2 = s.e.sup(B.x, B.z); if (s2 == null) { state = "roll"; B.air = true; } } else if (!s) { state = "roll"; B.air = true; } }
    if (state === "roll" || state === "aim") for (const e of H.ents) if (e.sub && state === "aim") { const n = SUBSTEPS; for (let q = 0; q < n; q++) e.sub(dt / n); }
    if (state === "roll") {
      const n = SUBSTEPS * 2; for (let q = 0; q < n && state === "roll"; q++) step(dt / n);
      const sp = B.path ? Math.abs(B.path.v) : Math.hypot(B.vx, B.vz);
      roll.set(B.air || B.path && B.path.kind === "pipe" ? (B.path ? 0.5 : 0) : clamp(sp * 0.09, 0, 0.32), 0.5 + sp * 0.3, B.path && B.path.kind === "loop" ? "metal" : lastSurf);
      if (sp > 0.001 && !B.path) { const ax = new THREE.Vector3(B.vz, 0, -B.vx).normalize(); ballMesh.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(ax, sp * dt / R)); }
      if (B.sink) { B.sink += dt; B.x += (H.cup[0] - B.x) * Math.min(1, dt * 10); B.z += (H.cup[1] - B.z) * Math.min(1, dt * 10); B.y = H.cupY + R - Math.min(0.24, B.sink * B.sink * 3); if (B.sink > 0.35) { ballMesh.visible = false; roll.set(0); sunk(); } }
      else if (!B.path && B.y < Y0 - 0.12) { const t = surfAt(B.x, B.z); const c = Math.round(B.x / T + (H.cols - 1) / 2), r = Math.round(B.z / T + (H.rows - 1) / 2), tt = tileAt(c, r); penalty(H.pockets.some((p) => Math.hypot(B.x - p.x, B.z - p.z) < p.r + 0.05) ? "pocket" : tt && tt.kind === "void" ? (HOLES[order[holeN]].theme.void || "water") : "gap"); void t; }
      else if (!B.path && !B.air && (B.ride ? Math.hypot(B.vx - B.ride[0], B.vz - B.ride[1]) : sp) < 0.035 && (B.slope || 0) < 0.08 && !H.ents.some((e) => e.moving && e.moving())) { restT += dt; if (restT > 0.3) { B.vx = B.vz = 0; roll.set(0); for (const e of H.ents) if (e.rest) e.rest(); if (strokes >= HOLES[order[holeN]].par + 4) pickup(); else { state = "aim"; aimYaw = null; yawOff = 0; } } }
      else restT = 0;
    } else roll.set(0);
    ballMesh.position.set(B.x, B.y, B.z); const sh = surfAt(B.x, B.z); blob.position.set(B.x, (sh ? sh.h : Y0) + 0.004, B.z); blob.visible = ballMesh.visible && !!sh && !B.path; blob.material.opacity = sh ? clamp(1 - (B.y - R - sh.h) * 3, 0.2, 1) : 0;
    if (B.path && B.path.kind === "pipe") ballMesh.visible = false; else if (state !== "sunk" && state !== "between" && state !== "picked") ballMesh.visible = true;
    // aim helpers
    const aiming = state === "aim" && drag && shot.p > 0.03; aimDots.visible = aimHead.visible = !!aiming; aimRing.visible = state === "aim";
    aimRing.position.set(B.x, B.y - R + 0.006, B.z); aimRing.material.opacity = 0.35 + Math.sin(Tm * 4) * 0.15;
    if (aiming) { const pts = aimDots.geometry.attributes.position.array, Ln = 0.35 + shot.p * 2.2; for (let i = 0; i < 30; i++) { const t = (i / 29) * Ln, px = B.x + shot.dx * t, pz = B.z + shot.dz * t, s = surfAt(px, pz); pts[i * 3] = px; pts[i * 3 + 1] = (s ? s.h : B.y - R) + 0.02; pts[i * 3 + 2] = pz; } aimDots.geometry.attributes.position.needsUpdate = true; aimDots.material.color.setHSL(0.3 - shot.p * 0.3, 1, 0.6); aimHead.material.color.copy(aimDots.material.color); aimRing.material.color.copy(aimDots.material.color); const hx2 = B.x + shot.dx * (Ln + 0.1), hz2 = B.z + shot.dz * (Ln + 0.1), s2 = surfAt(hx2, hz2); aimHead.position.set(hx2, (s2 ? s2.h : B.y) + 0.05, hz2); aimHead.rotation.set(Math.PI / 2, 0, 0); aimHead.rotation.z = Math.atan2(shot.dx, shot.dz) * -1 + Math.PI; aimHead.rotation.order = "YXZ"; aimHead.rotation.set(-Math.PI / 2, Math.atan2(-shot.dx, -shot.dz), 0); }
    else aimRing.material.color.set(0xffe080);
    $("power").style.setProperty("--p", aiming ? shot.p : 0); $("power").classList.toggle("on", !!aiming);
  }
  updateCam(dt); fx.step(dt);
}
function frame(now) {
  const FF = window.__ff || 1, dt = Math.min(0.033, (now - tPrev) / 1000) * FF; tPrev = now; S.watch(now, state !== "menu");
  if (state !== "paused") update(dt); else updateCam(0);
  S.render(); requestAnimationFrame(frame);
}

// ---------------------------------------------------------------- menus and settings
const music = { set: () => setVolumes(S.set.music, S.set.sfx) };
function syncSettings() { document.querySelectorAll(".vMusic").forEach((el) => (el.value = S.set.music)); document.querySelectorAll(".vSfx").forEach((el) => (el.value = S.set.sfx)); document.querySelectorAll(".vQual").forEach((el) => (el.value = S.set.quality)); }
document.querySelectorAll(".vMusic").forEach((el) => el.addEventListener("input", () => { S.set.music = +el.value; S.saveSet(); music.set(); syncSettings(); }));
document.querySelectorAll(".vSfx").forEach((el) => el.addEventListener("input", () => { S.set.sfx = +el.value; S.saveSet(); music.set(); syncSettings(); sfx.tick(); }));
document.querySelectorAll(".vQual").forEach((el) => el.addEventListener("change", () => { S.set.quality = el.value; S.saveSet(); S.pickQ(); S.resize(); syncSettings(); }));
syncSettings();
function openPick() { state = "menu"; const el = $("pickGrid"); el.innerHTML = HOLES.map((h, i) => `<button class="hole-btn" type="button" data-h="${i}"><b>${i + 1}</b><span>${h.name}</span><i>Par ${h.par}</i></button>`).join(""); el.querySelectorAll("button").forEach((b) => (b.onclick = () => startMode("practice", +b.dataset.h))); show("pick"); }
$("modeFront").addEventListener("click", () => startMode("front"));
$("modeChamp").addEventListener("click", () => startMode("champ"));
$("modePractice").addEventListener("click", () => { sfx.click(); openPick(); });
$("pickBack").addEventListener("click", () => { sfx.click(); toMenu(); });
$("again").addEventListener("click", () => startMode(mode));
$("overMenu").addEventListener("click", () => { sfx.click(); toMenu(); });
let prevState = "aim";
const pause = () => { if (["aim", "roll", "intro"].includes(state)) { prevState = state; state = "paused"; stopMusic(); show("pause"); } };
$("pauseBtn").addEventListener("click", pause);
$("resumeBtn").addEventListener("click", () => { state = prevState; show(null); playMusic(HOLES[order[holeN]].theme.music || "acoustic", order[holeN] + 1); });
$("restartBtn").addEventListener("click", () => { startMode(mode, order[0]); });
$("quitBtn").addEventListener("click", () => toMenu());
$("viewBtn").addEventListener("click", () => { camMode = camMode === "follow" ? "over" : "follow"; $("viewBtn").classList.toggle("on", camMode === "over"); sfx.click(); });
$("rotL").addEventListener("click", () => { yawOff -= 0.45; camMode = "follow"; sfx.click(); });
$("rotR").addEventListener("click", () => { yawOff += 0.45; camMode = "follow"; sfx.click(); });
$("share").addEventListener("click", () => PUB.share(`I scored ${total().toLocaleString("en-GB")} (${vsPar()}) on Pub Golf's ${mode === "champ" ? "18-hole Championship" : "Front Nine"} ⛳🍺 Fancy a round?`, $("shareMsg")));
PUB.wireMute($("mute"));
document.addEventListener("visibilitychange", () => { if (document.hidden) pause(); });
order = [0]; buildHole(params.has("hole") ? clamp(+params.get("hole") - 1, 0, 17) : 0); hg.add(ballMesh, blob, aimDots, aimRing, aimHead); B.x = H.start[0]; B.z = H.start[1]; B.y = Y0 + H.start[2] * LH + R;
$("bestF").textContent = best.front.toLocaleString("en-GB"); $("bestC").textContent = best.champ.toLocaleString("en-GB");
requestAnimationFrame((t) => { tPrev = t; frame(t); $("loading").classList.add("done"); });
PUB.gate(() => show("start"));

// test hooks
window.__golf = {
  load: (i) => { order = [...Array(18).keys()]; mode = "champ"; card = []; loadHole(i); show(null); state = "aim"; },
  get: () => ({ state, hole: order[holeN], strokes, x: B.x, z: B.z, y: B.y, air: B.air, path: !!B.path, total: total(), card: card.length, bonus: bonusHole }),
  shoot: (dx, dz, p) => { if (state !== "aim") return false; const l = Math.hypot(dx, dz); shot = { dx: dx / l, dz: dz / l, p }; putt(); return true; },
  target: () => nextTarget(), cup: () => H.cup, ball: () => [B.x, B.z], path: () => H.path, surf: (x, z) => surfAt(x, z),
  sim: (sec) => { const n = Math.round(sec * 120); for (let i = 0; i < n; i++) update(1 / 120); },
  next: () => { if (state === "between") { loadHole(holeN + 1); show(null); state = "aim"; } },
  start: startMode, finish, renderer, view: (m) => { camMode = m; },
};
