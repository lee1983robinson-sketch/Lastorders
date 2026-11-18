// Bottle Flip: flick a bottle across the pub and land it standing up. Robbo's Game Lab.
// Pull back and let go: the further you pull, the further it flies. Every jump is set up so a bottle that lands
// in the middle of the next spot comes down upright, so it's all about judging distance. Land three in a row
// spot on for a combo. Three bottles, then it's last orders.
import { THREE, PUB, $, store, clamp, lerp, rnd, pick, chance, radial as radialT, makeStage, pubRoom, ctex, woodT, P, bake, G, MAT, snd, pubMusic, sparks, toast, bumpEl, screens, wireSettings, shadowTex } from "/kit3d.js";

const S = makeStage($("game"), { key: "flipSet", fov: 42, bloom: 0.6, fogNear: 12, fogFar: 34, exposure: 1.25 });
const { scene, camera } = S;
const roomG = new THREE.Group(); scene.add(roomG);
pubRoom(scene, { parent: roomG, w: 44, d: 14, lamps: [[-12, -2], [0, -2], [12, -2], [-6, 3], [6, 3]], keyPower: 170, neon: [["BOTTLE FLIP", "#3de0ff", -6, 4.9, -6.92, 0], ["LAST ORDERS", "#ff3d7f", 8, 4.9, -6.92, 0], ["OPEN", "#ffd23a", 18, 4.2, -6.92, 0]] });
const wood = woodT(), woodM = new THREE.MeshStandardMaterial({ map: wood.map, normalMap: wood.nm, roughness: 0.3, metalness: 0.05 });
const fx = sparks(scene, 240);
const world = new THREE.Group(); scene.add(world);   // platforms and bottle live here so we can shift the origin

// ---------------------------------------------------------------- the bottle: glass, beer inside, label, cap
const BH = 0.5, BR = 0.07;
const SKINS = [{ n: "Lager", glass: 0x3a6a2a, liquid: 0xffb028, label: "#e8262e", txt: "LAGER" }, { n: "Brown Ale", glass: 0x5a3010, liquid: 0x8a4010, label: "#f0c830", txt: "ALE" }, { n: "Cider", glass: 0xd8e8f0, liquid: 0xf0c040, label: "#2a8a3a", txt: "CIDER" }, { n: "Stout", glass: 0x1a1a1a, liquid: 0x1a0e08, label: "#f0e8d0", txt: "STOUT" }];
let skinI = +(store.get("flipSkin") || 0) % SKINS.length;
const bottle = new THREE.Group(); world.add(bottle);
const glassM = new THREE.MeshPhysicalMaterial({ color: SKINS[skinI].glass, roughness: 0.05, metalness: 0.1, clearcoat: 1, transparent: true, opacity: 0.62, envMapIntensity: 1.8 });
const liquidM = new THREE.MeshStandardMaterial({ color: SKINS[skinI].liquid, emissive: SKINS[skinI].liquid, emissiveIntensity: 0.25, roughness: 0.2 });
const labelTex = (sk) => ctex(256, 128, (g, w, h) => { g.fillStyle = sk.label; g.fillRect(0, 0, w, h); g.fillStyle = "rgba(255,255,255,.9)"; g.fillRect(0, 10, w, 6); g.fillRect(0, h - 16, w, 6); g.fillStyle = sk.label === "#f0e8d0" ? "#111" : "#fff"; g.font = "800 44px Bungee, Impact"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(sk.txt, w / 2, h / 2 + 2); });
const labelM = new THREE.MeshStandardMaterial({ map: labelTex(SKINS[skinI]), roughness: 0.6 });
{
  const body = new THREE.LatheGeometry([[0, 0], [BR * 0.95, 0], [BR, 0.01], [BR, BH * 0.6], [BR * 0.9, BH * 0.68], [BR * 0.4, BH * 0.8], [BR * 0.36, BH * 0.97], [BR * 0.42, BH * 0.98], [BR * 0.4, BH]].map(([x, y]) => new THREE.Vector2(x, y)), 28);
  const g = new THREE.Mesh(body, glassM); g.castShadow = true; bottle.add(g);
  const liq = new THREE.Mesh(new THREE.CylinderGeometry(BR * 0.9, BR * 0.9, BH * 0.5, 24), liquidM); liq.position.y = BH * 0.26; bottle.add(liq); bottle.userData.liq = liq;
  const lab = new THREE.Mesh(new THREE.CylinderGeometry(BR * 1.01, BR * 1.01, BH * 0.26, 28, 1, true), labelM); lab.position.y = BH * 0.32; bottle.add(lab);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(BR * 0.45, BR * 0.45, 0.02, 16), MAT.brass); cap.position.y = BH + 0.005; bottle.add(cap);
}
function setSkin(i) { skinI = i; const sk = SKINS[i]; glassM.color.set(sk.glass); liquidM.color.set(sk.liquid); liquidM.emissive.set(sk.liquid); labelM.map.dispose(); labelM.map = labelTex(sk); labelM.needsUpdate = true; store.set("flipSkin", String(i)); $("skinBtn").textContent = "Bottle: " + sk.n; }
const blob = new THREE.Mesh(G.plane, new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false })); blob.rotation.x = -Math.PI / 2; blob.scale.set(0.3, 0.3, 1); world.add(blob);

// ---------------------------------------------------------------- platforms: bits of pub furniture
const KINDS = [
  { k: "stool", w: 0.4, h: 0.78, build(L) { P(L, G.cyl, MAT.plain, "#7a1a1a", 0, 0.74, 0, 0.42, 0.08, 0.42); P(L, G.torus, MAT.brass, null, 0, 0.3, 0, 0.36, 0.36, 0.5, 0, Math.PI / 2); for (let q = 0; q < 3; q++) { const b = q * 2.09; P(L, G.cyl8, MAT.plain, "#1a1210", Math.cos(b) * 0.13, 0.36, Math.sin(b) * 0.13, 0.035, 0.72, 0.035); } } },
  { k: "table", w: 0.9, h: 0.75, build(L) { P(L, G.cyl, woodM, null, 0, 0.72, 0, 0.92, 0.06, 0.92, 0, 0, 0, [1, 1]); P(L, G.cyl8, MAT.plain, "#1a1210", 0, 0.36, 0, 0.1, 0.72, 0.1); P(L, G.cyl, MAT.plain, "#1a1210", 0, 0.02, 0, 0.55, 0.04, 0.55); P(L, G.cyl, MAT.plain, "#e8e0d0", 0.28, 0.755, 0.18, 0.18, 0.01, 0.18); } },
  { k: "crate", w: 0.5, h: 0.84, build(L) { for (let s = 0; s < 3; s++) { P(L, G.box, MAT.plain, pick(["#8a6428", "#7a5a22"]), 0, 0.14 + s * 0.28, 0, 0.5, 0.27, 0.5); P(L, G.box, MAT.plain, "#8a5a1a", 0, 0.14 + s * 0.28, 0.252, 0.52, 0.06, 0.01); } } },
  { k: "keg", w: 0.5, h: 0.62, build(L) { P(L, G.cyl, MAT.chrome, null, 0, 0.31, 0, 0.5, 0.62, 0.5); for (const y of [0.06, 0.56]) P(L, G.cyl, MAT.shiny, "#c8101a", 0, y, 0, 0.52, 0.05, 0.52); } },
  { k: "bar", w: 1.8, h: 1.12, build(L) { P(L, G.box, woodM, null, 0, 0.55, 0, 1.8, 1.1, 0.7, 0, 0, 0, [2, 1]); P(L, G.box, woodM, null, 0, 1.1, 0, 1.9, 0.06, 0.8, 0, 0, 0, [2, 0.3]); P(L, G.box, MAT.brass, null, 0, 0.15, 0.37, 1.8, 0.04, 0.04); P(L, G.box, MAT.plain, "#3a2a20", 0.5, 1.135, 0.1, 0.25, 0.005, 0.25); } },
  { k: "shelf", w: 0.7, h: 1.55, build(L) { P(L, G.box, woodM, null, 0, 1.52, 0, 0.72, 0.05, 0.35, 0, 0, 0, [1, 0.3]); for (const x of [-0.3, 0.3]) P(L, G.box, MAT.plain, "#1a1210", x, 0.76, -0.1, 0.04, 1.52, 0.04); P(L, G.box, woodM, null, 0, 0.7, 0, 0.7, 0.04, 0.3, 0, 0, 0, [1, 0.3]); for (let k = 0; k < 4; k++) P(L, G.cyl8, MAT.bottleGlass, pick(["#3a6a2a", "#6a3a14", "#2a4a6a"]), -0.24 + k * 0.16, 0.85, 0, 0.07, 0.26, 0.07); } },
  { k: "pint", w: 0.16, h: 0.9, bonus: 3, build(L) { P(L, G.cyl, woodM, null, 0, 0.72, 0, 0.7, 0.06, 0.7, 0, 0, 0, [1, 1]); P(L, G.cyl8, MAT.plain, "#1a1210", 0, 0.36, 0, 0.1, 0.72, 0.1); P(L, G.cyl, MAT.glass, null, 0, 0.82, 0, 0.16, 0.16, 0.16); P(L, G.cyl, MAT.plain, "#ffa51f", 0, 0.8, 0, 0.145, 0.12, 0.145); P(L, G.cyl, MAT.plain, "#fff6e0", 0, 0.88, 0, 0.15, 0.03, 0.15); P(L, G.plane, MAT.glow, new THREE.Color(0.6, 0.45, 0.1), 0, 0.9, 0.12, 0.6, 0.6, 1); } },
];
const protos = Object.fromEntries(KINDS.map((K) => { const L = []; K.build(L); const g = new THREE.Group(); for (const m of bake(L)) { m.castShadow = m.material !== MAT.glow; m.receiveShadow = true; g.add(m); } return [K.k, g]; }));
const plats = [];
function addPlat(kind, x) { const K = KINDS.find((q) => q.k === kind), g = protos[kind].clone(); g.position.set(x, 0, 0); world.add(g); const p = { K, x, w: K.w, h: K.h, g }; plats.push(p); return p; }
function nextKind(n) { const r = Math.random(); if (n > 4 && r < 0.12) return "pint"; return pick(n < 3 ? ["table", "stool", "crate", "keg"] : ["table", "stool", "crate", "keg", "bar", "shelf", "stool"]); }
function spawnNext() { const last = plats[plats.length - 1], n = landed, K = nextKind(n), gap = clamp(1.1 + n * 0.05 + rnd(0, 0.9), 1.1, 2.6); addPlat(K, last.x + last.w / 2 + gap + KINDS.find((q) => q.k === K).w / 2); }
function shiftWorld(dx) { for (const p of plats) { p.x -= dx; p.g.position.x = p.x; } bx -= dx; camX -= dx; camLX -= dx; }

// ---------------------------------------------------------------- flight
const GRAV = 9.8;
let bx = 0, by = 0, vx = 0, vy = 0, ang = 0, w = 0, cur = null, tgt = null, flying = false, wob = 0, wobV = 0, tumbling = 0, tumbleDir = 1;
const launch = (p) => [0.9 + p * 5.2, 2.6 + p * 4.6];   // vx, vy for a power 0..1
function landX(p, from, to) { const [ux, uy] = launch(p), y0 = from.h, y1 = to.h; const disc = uy * uy - 2 * GRAV * (y1 - y0); if (disc < 0) return null; const t = (uy + Math.sqrt(disc)) / GRAV; return { x: from.x + ux * t, t }; }
function idealT() { let lo = 0, hi = 1; for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2, r = landX(m, cur, tgt); if (!r || r.x < tgt.x) lo = m; else hi = m; } return landX((lo + hi) / 2, cur, tgt).t; }
function flick(p) { const [ux, uy] = launch(p); vx = ux; vy = uy; flying = true; const T = idealT(); flips = tgt.K.k === "bar" || tgt.K.k === "shelf" ? 2 : 1; w = -(Math.PI * 2 * flips) / T; state = "fly"; snd.whoosh(0.08 + p * 0.06); PUB.beep(300, 700, 0.12, "triangle", 0.04); }
let flips = 1;

// ---------------------------------------------------------------- game state
let state = "menu", score = 0, landed = 0, combo = 0, lives = 3, best = +(store.get("flipBest") || 0), camX = 0, camLX = 0;
const show = screens(["gate", "start", "pause", "over"]);
const music = pubMusic({ bpm: 98, chords: [[57, 60, 64], [55, 59, 62], [53, 57, 60], [52, 55, 59]] });
function reset() {
  for (const p of plats) world.remove(p.g); plats.length = 0; score = 0; landed = 0; combo = 0; lives = 3;
  cur = addPlat("table", 0); spawnNext(); tgt = plats[1]; placeOn(cur); camX = (cur.x + tgt.x) / 2; camLX = camX; hud();
}
function placeOn(p) { bx = p.x; by = p.h; ang = 0; vx = vy = 0; flying = false; wob = 0; wobV = 0; tumbling = 0; }
function start() { reset(); state = "aim"; show(null); music.start(S.set.music * 0.55); }
function hud() { $("hScore").textContent = score; $("hCombo").textContent = combo > 1 ? "×" + Math.min(combo, 5) : "×1"; $("hLives").innerHTML = [0, 1, 2].map((i) => `<i class="${i < lives ? "" : "gone"}"></i>`).join(""); $("hBest").textContent = Math.max(best, score); }
function land(p, err, off) {
  if (p !== tgt) { cur = p; wobV = err * -6; state = "settle"; settleT = 0.5; snd.thock(160, 0.2); toast("BACK WHERE YOU STARTED", "", 800); return; }
  const perfect = Math.abs(err) < 0.16 && Math.abs(off) < p.w * 0.22;
  combo = perfect ? combo + 1 : 0; const mult = Math.min(Math.max(combo, 1), 5), pts = (perfect ? 3 : 1) * mult * (p.K.bonus || 1) * flips;
  score += pts; landed++; bumpEl($("hScore").parentElement);
  wobV = err * -6 + (perfect ? 0 : (Math.random() < 0.5 ? -1 : 1) * 1.6);
  snd.thock(160, 0.25); setTimeout(() => snd.clink(1900), 40);
  if (perfect) { toast(`${flips > 1 ? "DOUBLE FLIP!" : combo > 2 ? "ON FIRE!" : "PERFECT!"}<small>+${pts}${mult > 1 ? ` · combo ×${mult}` : ""}</small>`, "gold", 1100); fx.burst(p.x + world.position.x, p.h + 0.2, 0, 26, 0xffd23a, 1.4, 2.5); snd.combo(combo); }
  else toast(`NICE<small>+${pts}</small>`, "good", 700);
  cur = p; state = "settle"; settleT = 0.6; hud();
}
let settleT = 0;
function fail(reason) {
  lives--; combo = 0; tumbling = 0.0001; state = "fall"; snd.clink(1500); setTimeout(() => snd.thock(110, 0.3), 200);
  toast(reason, "bad", 900); hud();
}
function afterFall() {
  if (lives <= 0) return over();
  placeOn(cur); state = "aim";
}
function over() {
  state = "over"; music.stop(); const isBest = score > best; if (isBest) { const p = best; best = score; store.set("flipBest", String(best)); if (p > 0) PUB.record(p, best); }
  PUB.submit("flip", score); store.set("flipFlips", String(+(store.get("flipFlips") || 0) + landed));
  $("fScore").textContent = score; $("fLanded").textContent = landed; $("fBest").textContent = best; $("newBest").hidden = !isBest; show("over"); if (isBest) snd.fanfare(); else snd.sad();
}

// ---------------------------------------------------------------- aiming: pull back, let go
let drag = null, power = 0;
$("game").addEventListener("pointerdown", (e) => { if (state !== "aim") return; drag = { x: e.clientX, y: e.clientY }; try { $("game").setPointerCapture(e.pointerId); } catch (x) {} });
$("game").addEventListener("pointermove", (e) => { if (!drag) return; const d = Math.hypot(e.clientX - drag.x, e.clientY - drag.y); const np = clamp(d / (Math.min(innerWidth, innerHeight) * 0.55), 0, 1); if (Math.floor(np * 12) !== Math.floor(power * 12)) snd.tick(); power = np; });
$("game").addEventListener("pointerup", () => { if (!drag) return; drag = null; if (state === "aim" && power > 0.03) flick(power); power = 0; });
$("game").addEventListener("pointercancel", () => { drag = null; power = 0; });
const arcPts = new Float32Array(30 * 3), arc = new THREE.Points(new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(arcPts, 3)), new THREE.PointsMaterial({ size: 0.16, color: 0xffe080, transparent: true, opacity: 1, depthWrite: false, map: radialT, blending: THREE.AdditiveBlending })); arc.visible = false; world.add(arc);

// ---------------------------------------------------------------- loop
let tPrev = performance.now(), Tm = 0, slow = 0;
function frame(now) {
  let dt = Math.min(0.033, (now - tPrev) / 1000) * (window.__ff || 1); tPrev = now; Tm += dt; S.watch(now, state !== "menu" && state !== "over");
  if (slow > 0) { slow -= dt; dt *= 0.35; }
  if (state === "fly") {
    const n = 4; for (let i = 0; i < n && state === "fly"; i++) {
      const h = dt / n; vy -= GRAV * h; const py = by; bx += vx * h; by += vy * h; ang += w * h;
      // touch down on whatever's underneath (the base of the bottle)
      if (vy < 0) for (const p of plats) { if (py >= p.h - 0.001 && by <= p.h && Math.abs(bx - p.x) <= p.w / 2 + BR * 0.6) { by = p.h; const err = Math.atan2(Math.sin(ang), Math.cos(ang)), off = bx - p.x;
          if (Math.abs(err) < 0.5 && Math.abs(off) <= p.w / 2 - BR * 0.3) { ang = err; land(p, err, off); if (p !== cur && p === tgt) { slow = Math.abs(err) < 0.16 ? 0.35 : 0; } }
          else { tumbleDir = Math.sign(err || off) || 1; fail(Math.abs(err) >= 0.5 ? "TOPPLED!" : "OFF THE EDGE!"); } break; } }
      if (state === "fly" && by <= 0) { by = 0; tumbleDir = Math.sign(vx) || 1; fail("SMASH!"); fx.burst(bx + world.position.x, 0.1, 0, 30, 0xbfe0ff, 2, 2); snd.clink(3000); }
    }
  }
  if (state === "settle") { wobV += (-wob * 120 - wobV * 9) * dt; wob += wobV * dt; ang = wob * 0.15; settleT -= dt; if (settleT <= 0) { ang = 0; if (cur === tgt) { spawnNext(); tgt = plats[plats.length - 1]; while (plats.length > 4) { const p = plats.shift(); world.remove(p.g); } } if (bx > 14) shiftWorld(bx); state = "aim"; } }
  if (state === "fall") { tumbling += dt; ang += tumbleDir * dt * 7 * (tumbling < 0.35 ? 1 : 0.2); vy -= GRAV * dt; by = Math.max(0, by + vy * dt); bx += vx * dt * 0.3; if (tumbling > 1.0) afterFall(); }
  // the bottle (rotates about its base when wobbling or tipping)
  bottle.position.set(bx, by, 0); bottle.rotation.z = ang; bottle.userData.liq.rotation.z = -ang * 0.6;
  if (state === "fly") bottle.position.y = by + BH / 2 - Math.cos(ang) * BH / 2, bottle.position.x = bx + Math.sin(ang) * BH / 2;
  const ground = plats.reduce((g, p) => (Math.abs(bx - p.x) < p.w / 2 && p.h <= by + 0.01 ? Math.max(g, p.h) : g), 0); blob.position.set(bx, ground + 0.005, 0); blob.scale.setScalar(0.3 / (1 + (by - ground) * 0.8));
  // aim arc
  arc.visible = state === "aim" && !!drag && power > 0.03;
  if (arc.visible) { const [ux, uy] = launch(power); for (let i = 0; i < 30; i++) { const t = i * 0.05; arcPts[i * 3] = cur.x + ux * t; arcPts[i * 3 + 1] = cur.h + BH * 0.5 + uy * t - 0.5 * GRAV * t * t; arcPts[i * 3 + 2] = 0; } arc.geometry.attributes.position.needsUpdate = true; }
  $("power").style.setProperty("--p", arc.visible ? power : 0); $("power").classList.toggle("on", arc.visible);
  // camera: side-on, a touch from above, framing this spot and the next
  const P2 = innerWidth / innerHeight < 0.9;
  if (tgt) { camX = lerp(camX, (cur.x + tgt.x) / 2 + (state === "fly" ? (bx - (cur.x + tgt.x) / 2) * 0.3 : 0), Math.min(1, dt * 3)); }
  const span = tgt ? Math.abs(tgt.x - cur.x) + 1.2 : 3, dist = span * (P2 ? 1.75 : 0.95) + 0.9, cy = Math.max(cur ? cur.h : 0.8, tgt ? tgt.h : 0.8) * 0.8 + 0.4;
  camera.position.set(camX + world.position.x, cy + dist * 0.28, dist); camera.lookAt(camX + world.position.x, cy, 0);
  if (state === "menu") { camera.position.set(Math.sin(Tm * 0.2) * 2.5, 1.6, 3); camera.lookAt(0, 0.9, 0); }
  roomG.position.x = 0; fx.step(dt); S.render(); requestAnimationFrame(frame);
}

// ---------------------------------------------------------------- menus
$("go").addEventListener("click", () => { PUB.pop(); start(); });
$("again").addEventListener("click", () => { PUB.pop(); start(); });
$("skinBtn").addEventListener("click", () => { setSkin((skinI + 1) % SKINS.length); PUB.pop(); });
let prev = "aim";
$("pauseBtn").addEventListener("click", () => { if (["aim", "fly", "settle", "fall"].includes(state)) { prev = state; state = "paused"; music.stop(); show("pause"); } });
$("resumeBtn").addEventListener("click", () => { state = prev; show(null); music.start(S.set.music * 0.55); tPrev = performance.now(); });
$("restartBtn").addEventListener("click", () => start());
$("quitBtn").addEventListener("click", () => { state = "menu"; music.stop(); reset(); show("start"); });
$("share").addEventListener("click", () => PUB.share(`I scored ${score} on Bottle Flip 🍾 landed ${landed} in a row-ish. Your go.`, $("shareMsg")));
wireSettings(S, { vol: (v) => music.vol(v * 0.55) });
PUB.wireMute($("mute"));
document.addEventListener("visibilitychange", () => { if (document.hidden && ["aim", "fly", "settle", "fall"].includes(state)) { prev = state; state = "paused"; music.stop(); show("pause"); } });
setSkin(skinI); reset(); $("bestStart").textContent = best;
requestAnimationFrame((t) => { tPrev = t; frame(t); $("loading").classList.add("done"); });
PUB.gate(() => show("start"));
window.__flip = { get: () => ({ state, score, landed, lives, combo, bx, cur: cur && cur.x, tgt: tgt && tgt.x }), ideal: () => { let lo = 0, hi = 1; for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2, r = landX(m, cur, tgt); if (!r || r.x < tgt.x) lo = m; else hi = m; } return (lo + hi) / 2; }, flick: (p) => { if (state === "aim") flick(p); }, start };
