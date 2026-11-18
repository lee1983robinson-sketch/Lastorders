// Jukebox Hero: a neon rhythm game. Robbo's Game Lab.
// Notes fly out of the jukebox down four glowing lanes; tap the lane as each one crosses the line.
// The backing track and the notes are generated together on the audio clock, so timing is exact.
// Hit notes play the tune; misses go dull. Every song is a bit faster than the last.
import { THREE, PUB, $, store, clamp, lerp, rnd, pick, chance, radial, makeStage, pubRoom, ctex, P, bake, G, MAT, snd, sparks, toast, bumpEl, screens, wireSettings } from "/kit3d.js";

const S = makeStage($("game"), { key: "jukeSet", fov: 58, bloom: 0.6, bloomThreshold: 0.9, fogNear: 14, fogFar: 46, exposure: 1.1, bg: 0x07040c, fogColor: 0x0a0612 });
const { scene, camera } = S;
pubRoom(scene, { w: 16, d: 46, h: 7, x: 0, z: -18, bar: false, keyPower: 60, lamps: [[-5, 8], [5, 8], [-5, -6], [5, -6], [-5, -20], [5, -20]], neon: [["JUKEBOX", "#ff3d7f", -7.92, 4.8, -10, Math.PI / 2], ["HERO", "#3de0ff", 7.92, 4.8, -10, -Math.PI / 2], ["ROCK & ROLL", "#ffd23a", -7.92, 4.2, -26, Math.PI / 2], ["PLAY IT LOUD", "#7a5aff", 7.92, 4.2, -26, -Math.PI / 2]] });
const fx = sparks(scene, 300);
const LANES = 4, LW = 0.9, HITZ = 0, FAR = -30, COLS = [0xff3d7f, 0xffd23a, 0x2ee59d, 0x3da0ff];
const laneX = (l) => (l - (LANES - 1) / 2) * LW;

// ---------------------------------------------------------------- the highway, hit pads and the jukebox
const hw = new THREE.Group(); scene.add(hw);
{
  const L = [];
  P(L, G.box, MAT.shiny, "#0a0814", 0, 0.02, (HITZ + FAR) / 2 + 1, LANES * LW + 0.3, 0.04, HITZ - FAR + 6);
  for (let i = 0; i <= LANES; i++) { const x = (i - LANES / 2) * LW; P(L, G.box, MAT.lights, new THREE.Color(0.35, 0.18, 0.7), x, 0.05, (HITZ + FAR) / 2 + 1, 0.03, 0.01, HITZ - FAR + 6); }
  for (const s of [-1, 1]) P(L, G.box, MAT.lights, new THREE.Color(1.3, 0.25, 0.85), s * (LANES * LW / 2 + 0.16), 0.08, (HITZ + FAR) / 2 + 1, 0.05, 0.04, HITZ - FAR + 6);
  P(L, G.box, MAT.lights, new THREE.Color(2.5, 2.5, 2.5), 0, 0.055, HITZ, LANES * LW, 0.01, 0.05);
  // the jukebox at the far end
  const jz = FAR - 1.6; P(L, G.box, MAT.shiny, "#3a1a0a", 0, 1.3, jz, 2.6, 2.6, 1.0); P(L, G.cyl, MAT.shiny, "#3a1a0a", 0, 2.6, jz, 2.6, 1.0, 1.0, 0, Math.PI / 2);
  P(L, G.box, MAT.chrome, null, 0, 1.75, jz + 0.52, 1.7, 0.9, 0.05); P(L, G.box, MAT.plain, "#1a0a12", 0, 0.7, jz + 0.52, 1.8, 0.6, 0.04);
  for (let k = 0; k < 8; k++) P(L, G.box, MAT.lights, new THREE.Color(1.4, 1.1, 0.6), -0.7 + k * 0.2, 1.75, jz + 0.56, 0.12, 0.6, 0.01);
  for (const s of [-1, 1]) P(L, G.cyl, MAT.chrome, null, s * 1.32, 1.3, jz + 0.3, 0.12, 2.5, 0.12);
  for (const m of bake(L)) { m.receiveShadow = true; hw.add(m); }
}
// neon tubes on the jukebox that pulse with the beat
const tubeMats = COLS.map((c) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(2) }));
const tubes = [];
{ const jz = FAR - 1.6; for (let i = 0; i < 4; i++) { const t = new THREE.Mesh(new THREE.TorusGeometry(1.3 - i * 0.12, 0.045, 8, 48, Math.PI), tubeMats[i]); t.position.set(0, 2.6, jz + 0.52 + i * 0.01); hw.add(t); tubes.push(t); }
  for (const s of [-1, 1]) { const t = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.4, 10), tubeMats[s < 0 ? 0 : 3]); t.position.set(s * 1.18, 1.3, FAR - 1.6 + 0.52); hw.add(t); tubes.push(t); } }
const jukeLight = new THREE.PointLight(0xff3d7f, 40, 14, 2); jukeLight.position.set(0, 3, FAR + 1); scene.add(jukeLight);
// beat lines that scroll down the lanes
const beatLines = []; for (let i = 0; i < 12; i++) { const m = new THREE.Mesh(G.box, new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 0.25, 0.9), transparent: true, opacity: 0.5, depthWrite: false })); m.scale.set(LANES * LW, 0.005, 0.03); scene.add(m); beatLines.push(m); }
// hit pads
const pads = COLS.map((c, l) => { const g = new THREE.Group(); g.position.set(laneX(l), 0.06, HITZ);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.04, 10, 40), new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(0.9) })); ring.rotation.x = -Math.PI / 2; g.add(ring);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(0.3, 40), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.15, depthWrite: false })); disc.rotation.x = -Math.PI / 2; disc.position.y = 0.005; g.add(disc);
  const flash = new THREE.Mesh(G.plane, new THREE.MeshBasicMaterial({ map: radial, color: c, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })); flash.rotation.x = -Math.PI / 2; flash.scale.set(1.6, 1.6, 1); flash.position.y = 0.01; g.add(flash);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 3, 24, 1, true), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); beam.position.y = 1.5; g.add(beam);
  scene.add(g); return { g, ring, disc, flash, beam, glow: 0 }; });
// notes: one instanced gem mesh per lane colour, plus a glow card under each
const NOTE_MAX = 48;
const gemGeo = new THREE.CylinderGeometry(0.26, 0.26, 0.12, 6);
const noteMeshes = COLS.map((c) => { const m = new THREE.InstancedMesh(gemGeo, new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.8, roughness: 0.2, metalness: 0.4 }), NOTE_MAX); m.frustumCulled = false; scene.add(m); return m; });
const noteGlow = new THREE.InstancedMesh(G.plane, new THREE.MeshBasicMaterial({ map: radial, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.45 }), NOTE_MAX * 4); noteGlow.frustumCulled = false; scene.add(noteGlow);
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), ZERO = new THREE.Matrix4().makeScale(0, 0, 0), _c = new THREE.Color();

// ---------------------------------------------------------------- music + chart, generated together
let A = null, bus = null, lead = null;
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
const SONGS = [["Last Orders Rock", [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]]], ["Chucking-Out Time", [[52, 55, 59], [48, 52, 55], [55, 59, 62], [50, 54, 57]]], ["Kebab Shop Boogie", [[50, 53, 57], [55, 58, 62], [53, 57, 60], [57, 61, 64]]], ["The Lock-In", [[45, 48, 52], [43, 47, 50], [41, 45, 48], [40, 44, 47]]]];
function audio() { A = PUB.ctx(); if (!bus) { bus = A.createGain(); bus.connect(A.destination); lead = A.createGain(); lead.connect(bus); } bus.gain.value = store.get("loMute") === "1" ? 0 : S.set.music * 1.1; return A; }
function tone(dst, type, f, t, d, v, cut = 3000) { const o = A.createOscillator(), g = A.createGain(), fl = A.createBiquadFilter(); o.type = type; o.frequency.value = f; fl.type = "lowpass"; fl.frequency.value = cut; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + d); o.connect(fl).connect(g).connect(dst); o.start(t); o.stop(t + d + 0.05); }
let nbuf = null; function hit(t, d, v, type, f) { if (!nbuf) { nbuf = A.createBuffer(1, A.sampleRate, A.sampleRate); const x = nbuf.getChannelData(0); for (let i = 0; i < x.length; i++) x[i] = Math.random() * 2 - 1; } const s = A.createBufferSource(), fl = A.createBiquadFilter(), g = A.createGain(); s.buffer = nbuf; fl.type = type; fl.frequency.value = f; g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d); s.connect(fl).connect(g).connect(bus); s.start(t); s.stop(t + d + 0.02); }
function kick(t) { const o = A.createOscillator(), g = A.createGain(); o.frequency.setValueAtTime(160, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.22); g.gain.setValueAtTime(0.7, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28); o.connect(g).connect(bus); o.start(t); o.stop(t + 0.3); }
let song = null;   // {bpm, start, spb, bars, notes:[{t, lane, pitch, judged}], next (scheduler beat)}
function makeSong(n) {
  const [name, ch] = SONGS[n % SONGS.length], bpm = Math.min(96 + n * 10, 168), spb = 60 / bpm, bars = 16, start = A.currentTime + 2.2, notes = [];
  const dens = Math.min(0.32 + n * 0.08, 0.78); let lane = 1;
  for (let b = 4; b < bars * 4; b += 0.5) { // notes on 8ths after a one-bar count-in
    const strong = b % 1 === 0, bar = Math.floor(b / 4), c = ch[bar % 4];
    if (Math.random() < (strong ? dens + 0.15 : dens * 0.55)) {
      lane = clamp(lane + pick([-1, 0, 1, 1, -1, 2, -2]), 0, 3); const pitch = c[lane % 3] + 12 + (lane === 3 ? 12 : 0);
      notes.push({ t: start + b * spb, lane, pitch, judged: false });
      if (n >= 2 && strong && Math.random() < 0.12 + n * 0.03) { const l2 = (lane + 2) % 4; notes.push({ t: start + b * spb, lane: l2, pitch: c[(l2 + 1) % 3] + 12, judged: false }); }
    }
  }
  return { n, name, ch, bpm, spb, bars, start, notes, next: 0, end: start + bars * 4 * spb };
}
function schedule() { // backing track, a bit ahead of time
  if (!song || state !== "play") return; const sp = song.spb / 2;
  while (song.start + song.next * sp < A.currentTime + 0.3 && song.next < song.bars * 8) {
    const t = song.start + song.next * sp, e = song.next, beat = e / 2, bar = Math.floor(beat / 4), c = song.ch[bar % 4];
    if (e % 2 === 0) kick(t); if (e % 4 === 2) hit(t, 0.18, 0.32, "bandpass", 1900); hit(t, 0.04, 0.08, "highpass", 8000);
    if (e % 2 === 0) tone(bus, "sawtooth", hz(c[0] - 24), t, sp * 1.8, 0.16, 600); if (e % 8 === 0) for (const nn of c) tone(bus, "triangle", hz(nn), t, sp * 7.5, 0.04, 1800);
    song.next++;
  }
}
setInterval(() => { if (A) schedule(); }, 60);

// ---------------------------------------------------------------- judging taps
const WIN = { perfect: 0.05, great: 0.095, good: 0.14 };
let state = "menu", score = 0, combo = 0, maxCombo = 0, health = 1, songN = 0, hits = { perfect: 0, great: 0, good: 0, miss: 0 }, best = +(store.get("jukeBest") || 0);
const mult = () => Math.min(1 + Math.floor(combo / 10), 4);
function tap(l) {
  if (state !== "play") return; pads[l].glow = 1; const now = A.currentTime;
  let bestN = null, bd = 1; for (const nt of song.notes) { if (nt.judged || nt.lane !== l) continue; const d = Math.abs(nt.t - now); if (d < bd) { bd = d; bestN = nt; } if (nt.t > now + 0.3) break; }
  if (!bestN || bd > WIN.good) { combo = 0; health = Math.max(0, health - 0.02); return; }   // a stray tap: no note there
  bestN.judged = true; const g = bd <= WIN.perfect ? "perfect" : bd <= WIN.great ? "great" : "good"; hits[g]++;
  combo++; maxCombo = Math.max(maxCombo, combo); score += { perfect: 300, great: 200, good: 100 }[g] * mult(); health = Math.min(1, health + 0.025);
  tone(lead, "square", hz(bestN.pitch), A.currentTime, 0.22, 0.07, 2600); tone(lead, "triangle", hz(bestN.pitch + 12), A.currentTime, 0.18, 0.04, 4000);
  fx.burst(laneX(l), 0.3, HITZ, g === "perfect" ? 22 : 12, COLS[l], 2, 3); pads[l].beam.material.opacity = 0.7;
  judge(g); if (combo % 25 === 0) { toast(`${combo} COMBO!<small>×${mult()} multiplier</small>`, "gold", 1000); snd.combo(combo / 5); }
}
function judge(g) { const el = $("judge"); el.textContent = { perfect: "PERFECT", great: "GREAT", good: "GOOD", miss: "MISS" }[g]; el.className = "judge " + g; void el.offsetWidth; el.classList.add("on"); }
function miss(nt) { nt.judged = true; hits.miss++; combo = 0; health = Math.max(0, health - 0.08); judge("miss"); hit(A.currentTime, 0.12, 0.12, "lowpass", 300); if (health <= 0) gameOver(); }

// ---------------------------------------------------------------- input: touch zones, the pad buttons, D F J K
const KEYS = { KeyD: 0, KeyF: 1, KeyJ: 2, KeyK: 3, ArrowLeft: 0, ArrowDown: 1, ArrowUp: 2, ArrowRight: 3 };
addEventListener("keydown", (e) => { if (e.repeat) return; if (e.code in KEYS) { e.preventDefault(); tap(KEYS[e.code]); } if (e.code === "KeyP" || e.code === "Escape") pause(); });
document.querySelectorAll(".lane").forEach((b) => b.addEventListener("pointerdown", (e) => { e.preventDefault(); tap(+b.dataset.l); b.classList.add("on"); setTimeout(() => b.classList.remove("on"), 90); }));

// ---------------------------------------------------------------- flow
const show = screens(["gate", "start", "pause", "over"]);
function begin() { audio(); score = 0; combo = 0; maxCombo = 0; health = 1; songN = 0; hits = { perfect: 0, great: 0, good: 0, miss: 0 }; song = makeSong(0); state = "play"; show(null); $("lanes").hidden = false; announce(); }
function announce() { toast(`${song.name.toUpperCase()}<small>Song ${song.n + 1} · ${song.bpm} BPM</small>`, "gold", 2000); }
function pause() { if (state !== "play") return; state = "paused"; A.suspend(); show("pause"); $("lanes").hidden = true; }
function resume() { if (state !== "paused") return; A.resume(); state = "play"; show(null); $("lanes").hidden = false; }
function gameOver() {
  if (state !== "play") return; state = "over"; $("lanes").hidden = true; const isBest = score > best; if (isBest) { const p = best; best = score; store.set("jukeBest", String(best)); if (p > 0) PUB.record(p, best); }
  PUB.submit("jukebox", score); const tot = hits.perfect + hits.great + hits.good + hits.miss, acc = tot ? Math.round(((hits.perfect + hits.great * 0.7 + hits.good * 0.4) / tot) * 100) : 0;
  $("fScore").textContent = score.toLocaleString("en-GB"); $("fCombo").textContent = maxCombo; $("fAcc").textContent = acc + "%"; $("fSongs").textContent = songN; $("fBest").textContent = best.toLocaleString("en-GB"); $("newBest").hidden = !isBest;
  $("fLine").textContent = `${hits.perfect} perfect · ${hits.great} great · ${hits.good} good · ${hits.miss} missed`;
  hit(A.currentTime, 0.6, 0.3, "lowpass", 400); setTimeout(() => show("over"), 900);
}

// ---------------------------------------------------------------- loop
let tPrev = performance.now(), Tm = 0, hudT = 0;
function frame(now) {
  const dt = Math.min(0.033, (now - tPrev) / 1000); tPrev = now; Tm += dt; S.watch(now, state === "play");
  const at = A ? A.currentTime : Tm, speed = song ? 9 + song.n * 1.1 : 9;   // metres per second down the lane
  // notes
  const counts = [0, 0, 0, 0]; let gi = 0;
  if (song && (state === "play" || state === "over" || state === "paused")) {
    for (const nt of song.notes) {
      const dz = (nt.t - at) * speed; if (dz > -FAR + 2) break;
      if (!nt.judged && state === "play" && at - nt.t > WIN.good) miss(nt);
      if (nt.judged || dz < -2) continue;
      const i = counts[nt.lane]++; if (i >= NOTE_MAX) continue; const z = HITZ - dz, s = 1 + Math.max(0, 1 - Math.abs(dz) / 3) * 0.15;
      _q.setFromEuler(_e.set(0, at * 2 + i, 0)); _m.compose(_v.set(laneX(nt.lane), 0.18, z), _q, _s.set(s, s, s)); noteMeshes[nt.lane].setMatrixAt(i, _m);
      _q.setFromEuler(_e.set(-Math.PI / 2, 0, 0)); _m.compose(_v.set(laneX(nt.lane), 0.07, z), _q, _s.set(1.3, 1.3, 1)); noteGlow.setMatrixAt(gi, _m); noteGlow.setColorAt(gi, _c.set(COLS[nt.lane])); gi++;
    }
    if (state === "play" && at > song.end + 0.5) { songN++; song = makeSong(songN); announce(); snd.fanfare(); health = Math.min(1, health + 0.3); }
  }
  for (let l = 0; l < 4; l++) { for (let i = counts[l]; i < NOTE_MAX; i++) noteMeshes[l].setMatrixAt(i, ZERO); noteMeshes[l].instanceMatrix.needsUpdate = true; }
  for (let i = gi; i < NOTE_MAX * 4; i++) noteGlow.setMatrixAt(i, ZERO); noteGlow.instanceMatrix.needsUpdate = true; if (noteGlow.instanceColor) noteGlow.instanceColor.needsUpdate = true;
  // pads, beat pulse, scrolling beat lines
  const beatPh = song ? (((at - song.start) / song.spb) % 1 + 1) % 1 : (Tm * 1.6) % 1, pulse = Math.pow(1 - beatPh, 3);
  for (const p of pads) { p.glow = Math.max(0, p.glow - dt * 6); p.flash.material.opacity = p.glow * 0.9; p.disc.material.opacity = 0.15 + p.glow * 0.5; p.beam.material.opacity = Math.max(0, p.beam.material.opacity - dt * 3); p.ring.scale.setScalar(1 + p.glow * 0.12); }
  tubes.forEach((t, i) => t.material.color.copy(_c.set(COLS[i % 4]).multiplyScalar(1.2 + pulse * 1.6)));
  jukeLight.intensity = 30 + pulse * 50; jukeLight.color.set(COLS[Math.floor((song ? (at - song.start) / song.spb : Tm) / 4) & 3]);
  beatLines.forEach((b, i) => { const k = song ? (at - song.start) / song.spb : Tm * 1.6; const z = HITZ - (((i - (k % 1)) * (song ? song.spb : 0.6)) * speed); b.position.set(0, 0.06, z); b.visible = z < HITZ + 0.5 && z > FAR; });
  // camera: low behind the hit line, nodding to the beat
  const P2 = innerWidth / innerHeight < 0.9;
  camera.position.set(0, (P2 ? 4.4 : 2.6) + pulse * 0.03, P2 ? 6.4 : 3.6); camera.lookAt(0, 0, P2 ? -7 : -8); camera.fov = P2 ? 58 : 52; camera.updateProjectionMatrix();
  if (state === "menu") { camera.position.set(Math.sin(Tm * 0.25) * 1.5, 2.2, 3); camera.lookAt(0, 1.2, FAR + 2); }
  hudT += dt; if (hudT > 0.08 && state === "play") { hudT = 0; $("hScore").textContent = score.toLocaleString("en-GB"); $("hCombo").textContent = combo; $("hMult").textContent = "×" + mult(); $("hSong").textContent = song.n + 1; $("hHealth").style.width = Math.round(health * 100) + "%"; $("hHealth").parentElement.classList.toggle("low", health < 0.3); }
  fx.step(dt); S.render(); requestAnimationFrame(frame);
}
$("go").addEventListener("click", () => begin());
$("again").addEventListener("click", () => begin());
$("pauseBtn").addEventListener("click", pause); $("resumeBtn").addEventListener("click", resume);
$("restartBtn").addEventListener("click", () => { A.resume(); begin(); });
$("quitBtn").addEventListener("click", () => { A.resume(); state = "menu"; song = null; show("start"); $("lanes").hidden = true; });
$("share").addEventListener("click", () => PUB.share(`I scored ${score.toLocaleString("en-GB")} on Jukebox Hero 🎸 with a ${maxCombo} combo. Beat that.`, $("shareMsg")));
wireSettings(S, { vol: (v) => { if (bus) bus.gain.value = store.get("loMute") === "1" ? 0 : v * 1.1; } });
PUB.wireMute($("mute")); $("mute").addEventListener("click", () => { if (bus) bus.gain.value = store.get("loMute") === "1" ? 0 : S.set.music * 1.1; });
document.addEventListener("visibilitychange", () => { if (document.hidden) pause(); });
$("bestStart").textContent = best.toLocaleString("en-GB");
requestAnimationFrame((t) => { tPrev = t; frame(t); $("loading").classList.add("done"); });
PUB.gate(() => show("start"));
window.__juke = { get: () => ({ state, score, combo, health, songN, hits, notes: song ? song.notes.length : 0 }), tap, auto: () => { // test helper: hit every note on time
  const iv = setInterval(() => { if (state !== "play") return; const now = A.currentTime; for (const nt of song.notes) if (!nt.judged && Math.abs(nt.t - now) < 0.03) tap(nt.lane); }, 8); return iv; }, begin };
