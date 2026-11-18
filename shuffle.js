// Shuffleboard: the long pub table. Slide your pucks as close to the far edge as you dare. Robbo's Game Lab.
// Four pucks each per end, alternating with Big Dave. Only the furthest player scores: every one of their
// pucks past the other's best counts its zone (1, 2 or 3), or 4 if it's hanging over the edge. First to 15.
import { THREE, PUB, $, store, clamp, lerp, rnd, pick, chance, makeStage, pubRoom, ctex, P, bake, G, MAT, snd, rollSound, pubMusic, sparks, toast, bumpEl, screens, wireSettings, shadowTex } from "/kit3d.js";

const S = makeStage($("game"), { key: "shuffleSet", fov: 44, bloom: 0.5, fogNear: 14, fogFar: 36, exposure: 1.2 });
const { scene, camera } = S;
pubRoom(scene, { w: 12, d: 18, z: -2, keyPower: 160, lamps: [[0, -6], [0, -1], [0, 4], [-4, 2]], neon: [["SHUFFLEBOARD", "#ffd23a", 0, 4.9, -10.92, 0], ["ON THE EDGE", "#ff3d7f", -5.92, 4.4, -2, Math.PI / 2], ["LAST ORDERS", "#3de0ff", 5.92, 4.4, -2, -Math.PI / 2]] });
const fx = sparks(scene, 200);
// table: z from +LEN/2 (your end) to -LEN/2 (the far edge); x across, width W
const LEN = 6.4, W = 0.62, PR = 0.05, TOP = 0.86, FAR = -LEN / 2, NEAR = LEN / 2, FOUL = NEAR - 1.6;
const Z3 = FAR + 0.16, Z2 = FAR + 0.46, Z1 = FAR + 0.95;   // zone boundaries (beyond each line is worth more)
const topTex = ctex(256, 2560, (g, w, h) => {
  const zPix = (z) => ((z - FAR) / LEN) * h;   // far edge at the top of the texture
  g.fillStyle = "#b07840"; g.fillRect(0, 0, w, h);
  for (let x = 0; x < w; x += 32) { g.fillStyle = `rgba(${Math.random() < 0.5 ? "60,30,10" : "220,170,110"},${rnd(0.08, 0.2)})`; g.fillRect(x, 0, 32, h); }
  for (let i = 0; i < 1400; i++) { const x = Math.random() * w, y = Math.random() * h; g.strokeStyle = `rgba(${Math.random() < 0.5 ? "50,25,8" : "230,180,120"},${rnd(0.06, 0.22)})`; g.lineWidth = rnd(0.5, 1.8); g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x + rnd(-2, 2), y + 60, x + rnd(-3, 3), y + 140, x + rnd(-2, 2), y + rnd(120, 300)); g.stroke(); }
  g.fillStyle = "rgba(255,240,210,.85)"; for (const z of [Z3, Z2, Z1, FOUL]) g.fillRect(0, zPix(z) - 3, w, 6);
  g.font = "800 72px Bungee, Impact, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
  for (const [v, a, b] of [[3, FAR, Z3], [2, Z3, Z2], [1, Z2, Z1]]) { g.fillStyle = "rgba(255,240,210,.8)"; g.save(); g.translate(w / 2, zPix((a + b) / 2)); g.scale(1, v === 3 ? 0.5 : 1); g.fillText(String(v), 0, 0); g.restore(); }
  g.fillStyle = "rgba(200,30,40,.55)"; g.fillRect(0, zPix(FAR) , w, 10);
});
const tableTop = new THREE.MeshPhysicalMaterial({ map: topTex, roughness: 0.15, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1.2 });
{
  const L = [], rail = new THREE.MeshStandardMaterial({ color: 0x2a1408, roughness: 0.35, metalness: 0.1 });
  P(L, G.box, tableTop, null, 0, TOP - 0.03, 0, W, 0.06, LEN);
  for (const s of [-1, 1]) { P(L, G.box, MAT.plain, "#140a06", s * (W / 2 + 0.06), TOP - 0.07, 0, 0.12, 0.04, LEN); P(L, G.box, rail, null, s * (W / 2 + 0.14), TOP + 0.0, 0, 0.06, 0.18, LEN + 0.2); P(L, G.box, MAT.brass, null, s * (W / 2 + 0.14), TOP + 0.095, 0, 0.065, 0.015, LEN + 0.2); }
  P(L, G.box, MAT.plain, "#140a06", 0, TOP - 0.1, FAR - 0.18, W + 0.4, 0.04, 0.32); P(L, G.box, rail, null, 0, TOP - 0.02, FAR - 0.36, W + 0.34, 0.2, 0.06); P(L, G.box, rail, null, 0, TOP - 0.02, NEAR + 0.1, W + 0.34, 0.16, 0.06);
  P(L, G.box, rail, null, 0, TOP - 0.3, 0, W + 0.3, 0.5, LEN + 0.6);
  for (const z of [-LEN / 2 + 0.3, 0, LEN / 2 - 0.3]) for (const s of [-1, 1]) P(L, G.box, rail, null, s * (W / 2 + 0.05), 0.3, z, 0.12, 0.6, 0.12);
  P(L, G.plane, MAT.glow, new THREE.Color(0.45, 0.32, 0.18), 0, TOP + 0.002, FAR + 0.6, W * 1.6, 1.6, 1, 0, -Math.PI / 2);
  for (const m of bake(L)) { m.castShadow = m.material !== MAT.glow; m.receiveShadow = true; scene.add(m); }
  const sl = new THREE.SpotLight(0xffe0b0, 60, 10, 0.5, 0.5, 1.5); sl.position.set(0, TOP + 2.4, FAR + 0.6); sl.target.position.set(0, TOP, FAR + 0.6); scene.add(sl, sl.target);
}
// pucks: chrome with a coloured cap
const capM = [new THREE.MeshPhysicalMaterial({ color: 0xd81e28, roughness: 0.25, clearcoat: 1 }), new THREE.MeshPhysicalMaterial({ color: 0x2a5ad8, roughness: 0.25, clearcoat: 1 })];
function makePuck(team) { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.CylinderGeometry(PR, PR, 0.028, 32), MAT.chrome); b.position.y = 0.014; b.castShadow = true; const c = new THREE.Mesh(new THREE.CylinderGeometry(PR * 0.78, PR * 0.82, 0.012, 32), capM[team]); c.position.y = 0.032; const sh = new THREE.Mesh(G.plane, new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false })); sh.rotation.x = -Math.PI / 2; sh.scale.set(0.18, 0.18, 1); sh.position.y = 0.002; g.add(b, c, sh); scene.add(g); return g; }
const pucks = [];   // {team, x, z, vx, vz, on, g, y, vy}

// ---------------------------------------------------------------- physics
const DECEL = 0.62, roll = rollSound();
function stepPhys(dt) {
  let moving = false;
  for (const p of pucks) {
    if (!p.on) { if (p.fall) { p.vy -= 9.8 * dt; p.y += p.vy * dt; p.x += p.vx * dt; p.z += p.vz * dt; if (p.y < -0.6) { p.fall = false; p.g.visible = false; } } continue; }
    const sp = Math.hypot(p.vx, p.vz); if (sp > 0) { const ns = Math.max(0, sp - DECEL * dt); p.vx *= ns / sp; p.vz *= ns / sp; if (ns > 0.002) moving = true; }
    p.x += p.vx * dt; p.z += p.vz * dt;
    // into the gutter if it touches a side; off the end if its centre goes past the edge
    if (Math.abs(p.x) > W / 2 - PR * 0.4) { p.on = false; p.fall = true; p.vy = 0; PUB.noise(0.2, 0.08, 600); }
    if (p.z < FAR - PR * 0.2) { p.on = false; p.fall = true; p.vy = 0; snd.thock(90, 0.2); }
  }
  for (let i = 0; i < pucks.length; i++) for (let j = i + 1; j < pucks.length; j++) {
    const a = pucks[i], b = pucks[j]; if (!a.on || !b.on) continue; const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
    if (d < PR * 2 && d > 1e-6) { const nx = dx / d, nz = dz / d, ov = PR * 2 - d; a.x -= nx * ov / 2; a.z -= nz * ov / 2; b.x += nx * ov / 2; b.z += nz * ov / 2;
      const rv = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz; if (rv < 0) { const j2 = -rv * 0.94; a.vx -= j2 * nx; a.vz -= j2 * nz; b.vx += j2 * nx; b.vz += j2 * nz; const s = Math.abs(rv); PUB.beep(1800, 1700, 0.06, "sine", clamp(s * 0.05, 0.02, 0.09)); snd.thock(400, clamp(s * 0.08, 0.04, 0.2)); fx.burst((a.x + b.x) / 2, TOP + 0.04, (a.z + b.z) / 2, 6, 0xfff0c0, 0.6, 0.5); } }
  }
  return moving;
}
function slideSpeed() { let m = 0; for (const p of pucks) if (p.on) m = Math.max(m, Math.hypot(p.vx, p.vz)); return m; }

// ---------------------------------------------------------------- scoring an end
function zoneOf(p) { if (!p.on) return 0; if (p.z - PR < FAR) return 4; if (p.z < Z3) return 3; if (p.z < Z2) return 2; if (p.z < Z1) return 1; return 0; }
function scoreEnd() {
  const live = pucks.filter((p) => p.on && p.z < FOUL); if (!live.length) return { team: -1, pts: 0 };
  live.sort((a, b) => a.z - b.z); const lead = live[0].team; const other = live.find((p) => p.team !== lead), limit = other ? other.z : Infinity;
  let pts = 0, hangers = 0; for (const p of live) { if (p.team !== lead || p.z >= limit) break; const z = zoneOf(p); pts += z; if (z === 4) hangers++; }
  return { team: lead, pts, hangers };
}

// ---------------------------------------------------------------- turns, Big Dave
let state = "menu", turn = 0, thrown = [0, 0], ends = 0, totals = [0, 0], hangersAll = 0, best = +(store.get("shuffleBest") || 0), current = null, firstTeam = 0;
const show = screens(["gate", "start", "pause", "over"]);
const music = pubMusic({ bpm: 84 });
function newGame() { totals = [0, 0]; ends = 0; hangersAll = 0; firstTeam = 0; newEnd(); state = "aim"; show(null); music.start(S.set.music * 0.5); hud(); }
function newEnd() { for (const p of pucks) scene.remove(p.g); pucks.length = 0; thrown = [0, 0]; turn = firstTeam; setupThrow(); }
function setupThrow() {
  const g = makePuck(turn); current = { team: turn, x: 0, z: NEAR - 0.25, vx: 0, vz: 0, on: true, g, y: 0, vy: 0, fall: false }; pucks.push(current);
  state = turn === 0 ? "aim" : "dave"; hud();
  if (turn === 1) { $("turn").textContent = "BIG DAVE'S GO"; setTimeout(daveThrow, 1200); } else $("turn").textContent = "YOUR GO";
}
function release(vx, vz) { current.vx = vx; current.vz = vz; thrown[current.team]++; state = "slide"; snd.whoosh(0.06); PUB.noise(0.15, 0.05, 2000); }
function daveThrow() {
  if (state !== "dave") return;
  // aim at the 3 zone; if you're ahead, try to knock your best one off
  const mine = pucks.filter((p) => p.on && p.team === 0 && p.z < FOUL).sort((a, b) => a.z - b.z)[0], his = pucks.filter((p) => p.on && p.team === 1 && p.z < FOUL).sort((a, b) => a.z - b.z)[0];
  let tx = rnd(-0.12, 0.12), tz = rnd(Z3 + 0.03, Z2 - 0.05), hard = false;
  if (mine && (!his || mine.z < his.z) && Math.random() < 0.7) { tx = mine.x; tz = mine.z; hard = true; }
  const dz = current.z - tz, dx = tx - current.x, d = Math.hypot(dx, dz), v = Math.sqrt(2 * DECEL * d) * (hard ? 1.25 : 1) * (1 + rnd(-0.06, 0.06)), a = Math.atan2(dx, dz) + rnd(-0.025, 0.025);
  release(Math.sin(a) * v, -Math.cos(a) * v);
}
function afterThrow() {
  current = null;
  if (thrown[0] >= 4 && thrown[1] >= 4) return endOver();
  turn = thrown[1 - turn] < 4 ? 1 - turn : turn; setupThrow();
}
function endOver() {
  const r = scoreEnd(); ends++;
  if (r.team >= 0 && r.pts > 0) { totals[r.team] += r.pts; if (r.team === 0) { hangersAll += r.hangers; toast(`+${r.pts} TO YOU${r.hangers ? "<small>Hanger! Right on the edge</small>" : "<small>End " + ends + "</small>"}`, "gold", 1800); snd.cheer(); } else { toast(`+${r.pts} TO BIG DAVE<small>End ${ends}</small>`, "bad", 1800); PUB.beep(400, 260, 0.3, "triangle", 0.05); } firstTeam = 1 - r.team; }
  else toast("NO SCORE<small>Nothing past the line</small>", "", 1500);
  hud(); state = "between";
  setTimeout(() => { if (totals[0] >= 15 || totals[1] >= 15) finish(); else { newEnd(); } }, 2200);
}
function finish() {
  state = "over"; music.stop(); const won = totals[0] > totals[1], score = totals[0] * 100 + (won ? 1000 + (totals[0] - totals[1]) * 50 : 0) + hangersAll * 50;
  const isBest = score > best; if (isBest) { const p = best; best = score; store.set("shuffleBest", String(best)); if (p > 0) PUB.record(p, best); }
  if (won) store.set("shuffleWins", String(+(store.get("shuffleWins") || 0) + 1));
  PUB.submit("shuffle", score);
  $("oTitle").textContent = won ? "YOU BEAT BIG DAVE!" : "BIG DAVE WINS"; $("fYou").textContent = totals[0]; $("fDave").textContent = totals[1]; $("fScore").textContent = score.toLocaleString("en-GB"); $("newBest").hidden = !isBest;
  if (won) snd.fanfare(); else snd.sad(); show("over"); lastScore = score;
}
let lastScore = 0;
function hud() { $("hYou").textContent = totals[0]; $("hDave").textContent = totals[1]; $("hEnd").textContent = ends + 1; $("hPucks").innerHTML = [0, 1].map((t) => `<span class="pk t${t}">${[0, 1, 2, 3].map((i) => `<i class="${i < 4 - thrown[t] ? "" : "gone"}"></i>`).join("")}</span>`).join(""); }

// ---------------------------------------------------------------- aiming: drag the puck back and let go
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -TOP), hitV = new THREE.Vector3();
const ground = (e) => { ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera); return ray.ray.intersectPlane(plane, hitV) ? hitV.clone() : null; };
let drag = null, aim = { x: 0, p: 0 };
$("game").addEventListener("pointerdown", (e) => { if (state !== "aim") return; drag = { y: e.clientY, x: e.clientX }; try { $("game").setPointerCapture(e.pointerId); } catch (x) {} });
$("game").addEventListener("pointermove", (e) => { if (!drag) return; const dy = e.clientY - drag.y, dx = e.clientX - drag.x; const np = clamp(dy / (innerHeight * 0.4), 0, 1); if (Math.floor(np * 14) !== Math.floor(aim.p * 14)) snd.tick(); aim = { p: np, a: clamp(-dx / innerWidth * 0.25, -0.1, 0.1) }; });
$("game").addEventListener("pointerup", () => { if (!drag) return; drag = null; if (state === "aim" && aim.p > 0.03) { const v = 0.6 + aim.p * 2.4; release(Math.sin(aim.a) * v, -Math.cos(aim.a) * v); } aim = { p: 0, a: 0 }; });
const guide = new THREE.Points(new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(new Float32Array(40 * 3), 3)), new THREE.PointsMaterial({ size: 0.03, color: 0xffe080, transparent: true, opacity: 0.9, depthWrite: false })); guide.visible = false; scene.add(guide);

// ---------------------------------------------------------------- loop
let tPrev = performance.now(), Tm = 0; const camPos = new THREE.Vector3(0, 2, 5), camLook = new THREE.Vector3();
function frame(now) {
  const dt = Math.min(0.033, (now - tPrev) / 1000) * (window.__ff || 1); tPrev = now; Tm += dt; S.watch(now, state !== "menu" && state !== "over");
  if (state === "slide" || state === "between" || state === "dave" || state === "aim") {
    const n = 8; let mv = false; for (let i = 0; i < n; i++) mv = stepPhys(dt / n) || mv;
    if (state === "slide" && !mv && !pucks.some((p) => p.fall)) { state = "settled"; setTimeout(afterThrow, 700); }
    roll.set(clamp(slideSpeed() * 0.08, 0, 0.14), 0.5 + slideSpeed() * 0.4);
  } else roll.set(0);
  for (const p of pucks) { p.g.position.set(p.x, TOP + p.y, p.z); }
  // guide line while aiming (where it'll stop, roughly)
  guide.visible = state === "aim" && !!drag && aim.p > 0.03;
  if (guide.visible) { const v = 0.6 + aim.p * 2.4, d = (v * v) / (2 * DECEL), arr = guide.geometry.attributes.position.array; for (let i = 0; i < 40; i++) { const t = (i / 39) * d; arr[i * 3] = current.x + Math.sin(aim.a) * t; arr[i * 3 + 1] = TOP + 0.01; arr[i * 3 + 2] = current.z - Math.cos(aim.a) * t; } guide.geometry.attributes.position.needsUpdate = true; }
  $("power").style.setProperty("--p", guide.visible ? aim.p : 0); $("power").classList.toggle("on", guide.visible);
  // camera: from your end, down the table; drifts towards the scoring end while pucks slide
  const P2 = innerWidth / innerHeight < 0.9, follow = current && state === "slide" ? clamp((NEAR - current.z) / LEN, 0, 1) : state === "between" ? 1 : 0;
  camPos.lerp(new THREE.Vector3(0, TOP + (P2 ? 1.5 : 1.0) - follow * 0.3, NEAR + (P2 ? 1.6 : 1.2) - follow * (LEN * 0.55)), Math.min(1, dt * 2));
  camLook.lerp(new THREE.Vector3(0, TOP, FAR + 1.2 - follow * 0.2), Math.min(1, dt * 2.5));
  if (state === "menu") { camPos.set(Math.sin(Tm * 0.2) * 2.2, TOP + 1.4, Math.cos(Tm * 0.2) * 2.6 + 0.5); camLook.set(0, TOP, -1); }
  camera.position.copy(camPos); camera.lookAt(camLook);
  fx.step(dt); S.render(); requestAnimationFrame(frame);
}
$("go").addEventListener("click", () => { PUB.pop(); newGame(); });
$("again").addEventListener("click", () => { PUB.pop(); newGame(); });
let prev = "aim";
$("pauseBtn").addEventListener("click", () => { if (state === "aim") { prev = state; state = "paused"; music.stop(); show("pause"); } });
$("resumeBtn").addEventListener("click", () => { state = prev; show(null); music.start(S.set.music * 0.5); });
$("restartBtn").addEventListener("click", () => newGame());
$("quitBtn").addEventListener("click", () => { state = "menu"; music.stop(); for (const p of pucks) scene.remove(p.g); pucks.length = 0; show("start"); });
$("share").addEventListener("click", () => PUB.share(`I scored ${lastScore.toLocaleString("en-GB")} on Shuffleboard (${totals[0]}-${totals[1]} v Big Dave) 🥌🍺 Your go.`, $("shareMsg")));
wireSettings(S, { vol: (v) => music.vol(v * 0.5) });
PUB.wireMute($("mute"));
$("bestStart").textContent = best.toLocaleString("en-GB");
requestAnimationFrame((t) => { tPrev = t; frame(t); $("loading").classList.add("done"); });
PUB.gate(() => show("start"));
window.__shuffle = { get: () => ({ state, totals, ends, thrown, pucks: pucks.length, cur: current && [current.x, current.z] }), slide: (p, a = 0) => { if (state !== "aim") return false; const v = 0.6 + p * 2.4; release(Math.sin(a) * v, -Math.cos(a) * v); return true; }, powerFor: (z) => { const d = (NEAR - 0.25) - z; return (Math.sqrt(2 * DECEL * d) - 0.6) / 2.4; }, start: newGame };
