// Bar Crush: a premium pub match-3. World 360 x 640, 8 x 8 board.
// Match 3 to clear; 4 in a line makes a Rocket, 5 makes a Wild, a T or L makes a Bomb; specials combine when swapped together.
// Power-ups (shuffle, bomb, rocket, freeze), levels with stars, the Big Round every fifth level, and an original house soundtrack.
(() => {
  "use strict";
  const { $, store, REDUCED, beep, noise, cheer, fanfare, sad, wireMute, fit, show, gate, toast, share, rr, particles } = PUB;
  const W = 360, H = 640, N = 8, S = 41, BX = (W - N * S) / 2, BY = 128;
  const TYPES = [{ k: "beer", c: "#FFB627" }, { k: "wine", c: "#FF4A5A" }, { k: "blue", c: "#2EC4E0" }, { k: "purple", c: "#A45CFF" },
    { k: "whisky", c: "#E08A2A" }, { k: "burger", c: "#7BD86A" }, { k: "chips", c: "#FF6A3D" }];
  let g = null, view = null, SPR = [], CACHE = {};
  fit($("game"), W, H, (o) => { view = o; g = o.g; SPR = []; CACHE = {}; });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { CACHE = {}; });
  const FX = particles();
  const IMG = (n) => PUB.art("crush/" + n);
  TYPES.forEach((T) => IMG(T.k)); ["wild", "rocket", "bomb"].forEach(IMG);   // start loading every piece straight away
  const SHOW_IDS = ["gate", "start", "over", "lvlpick"];

  // ---------- levels ----------
  const levelCfg = (L) => {
    const big = L % 5 === 0;
    const colours = big ? 5 : L <= 3 ? 5 : L <= 12 ? 6 : 7;
    const moves = big ? 28 : Math.max(18, 24 - Math.floor((L - 1) / 3));
    // points per move fall sharply as more drink types appear, so targets follow the drink count (calibrated with a bot)
    const perMove = colours === 5 ? 70 + Math.min(L, 30) * 3 : colours === 6 ? 45 + Math.min(L, 40) * 2 : 28 + Math.min(L, 60) * 0.15;
    const target = Math.round((moves * perMove * (big ? 1.25 : 1)) / 50) * 50;
    return { big, colours, moves, target, mult: big ? 2 : 1 };
  };
  let unlocked = Math.max(1, +(store.get("crushLevel") || 1));
  let level = unlocked, cfg = levelCfg(level);
  const starsOf = (L) => +(store.get("crushStars" + L) || 0);
  const bestOf = (L) => +(store.get("crushBest" + L) || 0);

  // ---------- power-ups ----------
  let PU = { shuffle: 3, bomb: 3, rocket: 3, freeze: 3 };
  try { PU = Object.assign(PU, JSON.parse(store.get("crushPU") || "{}")); } catch (e) {}
  const savePU = () => store.set("crushPU", JSON.stringify(PU));
  let armed = null, rocketDir = "row", freeze = false;

  // ---------- board state ----------
  let grid = [], dying = [], beams = [], bolts = [], state = "menu", busy = false, score = 0, shownScore = 0, moves = 0, t = 0, idle = 0, hintCells = null, sel = null, idSeq = 1, shake = 0, starsLit = 0, freezeFx = 0;
  const tile = (tt, s = null) => ({ t: tt, s, id: idSeq++, fy: 0, vy: 0, sw: null, pop: 0, born: 0 });
  const randT = () => Math.floor(Math.random() * cfg.colours);
  const at = (r, c) => (r >= 0 && r < N && c >= 0 && c < N ? grid[r][c] : null);
  const key = (r, c) => r * N + c, rc = (k) => [Math.floor(k / N), k % N];
  const sleep = (ms) => new Promise((res) => setTimeout(res, REDUCED ? ms * 0.5 : ms));

  // ---------- sound effects ----------
  const nf = (n) => 440 * Math.pow(2, (n - 69) / 12);
  const sfx = {
    select: () => beep(1200, 1500, 0.04, "sine", 0.05),
    swap: () => { noise(0.12, 0.05, 2600, 0, 1.2); beep(500, 700, 0.08, "triangle", 0.04); },
    invalid: () => { beep(220, 160, 0.12, "square", 0.04); beep(200, 140, 0.12, "square", 0.035, 0.1); },
    match: (n, cascade) => { const base = 72 + Math.min(cascade - 1, 6) * 2; [0, 4, 7].slice(0, 2 + Math.min(1, n - 3)).forEach((d, i) => beep(nf(base + d), nf(base + d), 0.12, "triangle", 0.06, i * 0.04)); noise(0.08, 0.04, 6000); },
    make4: () => { beep(600, 1800, 0.25, "sawtooth", 0.04); beep(1200, 2400, 0.2, "sine", 0.04, 0.05); },
    make5: () => [84, 88, 91, 96, 100].forEach((n, i) => beep(nf(n), nf(n), 0.18, "sine", 0.05, i * 0.05)),
    bomb: () => { beep(140, 40, 0.5, "sine", 0.18); noise(0.5, 0.2, 700, 0, 0.6); noise(0.3, 0.1, 3000, 0.02); },
    rocket: () => { noise(0.4, 0.09, 1800, 0, 0.8); beep(300, 2200, 0.35, "sawtooth", 0.035); },
    wild: () => { [96, 91, 88, 84, 79, 76].forEach((n, i) => beep(nf(n), nf(n), 0.1, "triangle", 0.05, i * 0.03)); noise(0.5, 0.06, 8000); },
    cascade: (k) => beep(nf(79 + k * 2), nf(84 + k * 2), 0.15, "sine", 0.05),
    star: (i) => [0, 4, 7].forEach((d, j) => beep(nf(76 + i * 4 + d), nf(76 + i * 4 + d), 0.2, "triangle", 0.06, j * 0.05)),
    power: () => { beep(400, 1600, 0.2, "sine", 0.05); noise(0.2, 0.04, 5000); },
    freeze: () => { [100, 96, 103, 98].forEach((n, i) => beep(nf(n), nf(n), 0.3, "sine", 0.035, i * 0.06)); noise(0.6, 0.03, 9000); },
  };

  // ---------- the soundtrack: "Lock-In House", original, ~115 BPM ----------
  let musicOn = store.get("crushMusic") !== "0", mTimer = null, mStep = 0, mNext = 0;
  const CH = [[57, 60, 64, 67], [50, 53, 57, 62], [55, 59, 62, 65], [48, 52, 55, 59]];   // Am7, Dm9-ish, G7, Cmaj7
  const ROOT = [45, 38, 43, 36];
  const LEAD_A = [76, 0, 0, 74, 0, 72, 0, 69, 0, 72, 0, 74, 0, 0, 72, 0], LEAD_B = [69, 0, 72, 0, 74, 0, 76, 0, 79, 0, 76, 0, 74, 72, 0, 0];
  const LEAD_C = [81, 0, 0, 79, 0, 76, 0, 74, 0, 76, 0, 0, 72, 0, 74, 0], LEAD_D = [74, 0, 72, 0, 69, 0, 67, 0, 69, 0, 0, 0, 0, 0, 0, 0];
  function mStart() {
    if (!musicOn || mTimer) return; let B; try { B = PUB.bus(); } catch (e) { return; } if (!B.ac) return;
    mStep = 0; mNext = B.ac.currentTime + 0.08; mTimer = setInterval(mSched, 80); mSched();
  }
  function mStop() { if (mTimer) { clearInterval(mTimer); mTimer = null; } }
  addEventListener("pagehide", mStop);
  function env(gn, at, peak, dur, a = 0.005) { gn.gain.setValueAtTime(0.0001, at); gn.gain.exponentialRampToValueAtTime(peak, at + a); gn.gain.exponentialRampToValueAtTime(0.0001, at + dur); }
  function mSched() {
    let B; try { B = PUB.bus(); } catch (e) { return mStop(); } const A = B.ac, OUT = B.music; if (!A || !OUT) return mStop();
    const STEP = 60 / 115 / 4;
    while (mNext < A.currentTime + 0.25) {
      const at = mNext, s = mStep % 16, bar = Math.floor(mStep / 16) % 32, ch = bar % 4, sect = Math.floor(bar / 8);   // sections: intro, A, B, breakdown
      const kickOn = sect !== 3, leadOn = sect === 1 || sect === 2;
      const osc = (type, f, dur, vol, filt, dest = OUT, det = 0) => { const o = A.createOscillator(), gn = A.createGain(); o.type = type; o.frequency.value = f; o.detune.value = det; env(gn, at, vol, dur);
        if (filt) { const fl = A.createBiquadFilter(); fl.type = "lowpass"; fl.frequency.setValueAtTime(filt, at); fl.Q.value = 3; o.connect(fl).connect(gn); } else o.connect(gn); gn.connect(dest); o.start(at); o.stop(at + dur + 0.02); };
      const nz = (dur, vol, type, freq) => { const src = A.createBufferSource(), fl = A.createBiquadFilter(), gn = A.createGain(); src.buffer = B.noise; fl.type = type; fl.frequency.value = freq; env(gn, at, vol, dur, 0.002); src.connect(fl).connect(gn).connect(OUT); src.start(at, Math.random()); src.stop(at + dur + 0.02); };
      // four-on-the-floor kick
      if (kickOn && s % 4 === 0) { const o = A.createOscillator(), gn = A.createGain(); o.frequency.setValueAtTime(150, at); o.frequency.exponentialRampToValueAtTime(42, at + 0.14); env(gn, at, 0.32, 0.26, 0.003); o.connect(gn).connect(OUT); o.start(at); o.stop(at + 0.3); }
      // handclaps on 2 and 4 (a quick double hit)
      if (s === 4 || s === 12) { nz(0.12, 0.09, "bandpass", 1400); const at2 = at + 0.012; const src = A.createBufferSource(), fl = A.createBiquadFilter(), gn = A.createGain(); src.buffer = B.noise; fl.type = "bandpass"; fl.frequency.value = 1100; env(gn, at2, 0.06, 0.14, 0.002); src.connect(fl).connect(gn).connect(OUT); src.start(at2, Math.random()); src.stop(at2 + 0.16); }
      // hats: soft 16ths, open hat on the off-beat
      nz(0.025, s % 2 ? 0.012 : 0.02, "highpass", 8000);
      if (s % 4 === 2) nz(0.16, 0.03, "highpass", 6500);
      // warm offbeat bass, octave bounce
      if (s % 4 === 2 || s === 15 || (sect > 0 && s === 7)) osc("sawtooth", nf(ROOT[ch] + (s === 15 || s === 7 ? 12 : 0)), STEP * 1.6, 0.11, 520);
      // chord stabs, syncopated
      if ([3, 6, 10, 14].includes(s) && (sect !== 0 || bar % 2)) for (const n of CH[ch]) osc("square", nf(n), STEP * 0.9, 0.011, 1900);
      // breakdown pad
      if (sect === 3 && s === 0) for (const n of CH[ch]) osc("triangle", nf(n), STEP * 15, 0.018, 1200);
      // lead synth with a gentle detune; the phrase changes every bar so it never nags
      if (leadOn) { const phr = [LEAD_A, LEAD_B, LEAD_C, LEAD_D][(bar + (sect === 2 ? 2 : 0)) % 4], n = phr[s];
        if (n) { let len = 1; while (len < 4 && !phr[(s + len) % 16]) len++; const up = sect === 2 && bar % 2 ? 12 : 0; osc("square", nf(n + up), STEP * len * 0.9, 0.022, 2600); osc("sawtooth", nf(n + up), STEP * len * 0.9, 0.012, 1800, OUT, 7); } }
      mNext += STEP; mStep++;
    }
  }
  function setMusic(on) { musicOn = on; store.set("crushMusic", on ? "1" : "0"); $("music").classList.toggle("off", !on); $("music").setAttribute("aria-label", on ? "Turn music off" : "Turn music on"); if (on && state === "play") mStart(); else mStop(); }
  $("music").addEventListener("click", () => { PUB.ctx && PUB.ctx(); setMusic(!musicOn); });

  // ---------- art: tiles built once per screen size ----------
  function sprite(tt) {
    if (SPR[tt]) return SPR[tt]; if (!TYPES[tt]) return null; const im = IMG(TYPES[tt].k); if (!im || !view) return null;
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5) * view.scale, px = Math.ceil(S * dpr), c = document.createElement("canvas"); c.width = c.height = px;
    const b = c.getContext("2d"); b.scale(px / S, px / S);
    const k = (S * 0.86) / Math.max(im.naturalWidth, im.naturalHeight), w = im.naturalWidth * k, h = im.naturalHeight * k;
    b.fillStyle = "rgba(0,0,0,.35)"; b.beginPath(); b.ellipse(S / 2, S / 2 + h / 2 - 1, w * 0.36, 2.6, 0, 0, 7); b.fill();
    b.drawImage(im, (S - w) / 2, (S - h) / 2 - 1, w, h);
    return (SPR[tt] = c);
  }
  function drawTile(tl, x, y, sc = 1, a = 1) {
    const cx = x + S / 2, cy = y + S / 2;
    g.globalAlpha = a;
    if (tl.s === "wild" || tl.t < 0) {
      const im = IMG("wild"); g.save(); g.translate(cx, cy); g.scale(sc, sc);
      const glow = g.createRadialGradient(0, 0, 4, 0, 0, S * 0.62); glow.addColorStop(0, "rgba(255,240,180,.55)"); glow.addColorStop(1, "rgba(255,180,60,0)"); g.fillStyle = glow; g.beginPath(); g.arc(0, 0, S * 0.62, 0, 7); g.fill();
      g.rotate(Math.sin(t * 2) * 0.2); if (im) { const d = S * 0.98; g.drawImage(im, -d / 2, -d / 2, d, d * im.naturalHeight / im.naturalWidth); } g.restore(); g.globalAlpha = 1; return;
    }
    const sp = sprite(tl.t);
    if (tl.s === "bomb") { const p = 0.5 + Math.sin(t * 6) * 0.5; g.fillStyle = `rgba(255,120,40,${0.25 + p * 0.25})`; g.beginPath(); g.arc(cx, cy, S * 0.5, 0, 7); g.fill(); }
    if (tl.s === "row" || tl.s === "col") { g.save(); g.beginPath(); rr(g, x + 2, y + 2, S - 4, S - 4, 8); g.clip(); g.strokeStyle = TYPES[tl.t].c; g.lineWidth = 2.5;
      for (let i = -2; i <= 2; i++) { g.globalAlpha = a * (0.25 + 0.25 * Math.sin(t * 7 + i)); g.beginPath(); if (tl.s === "row") { g.moveTo(x, cy + i * 8); g.lineTo(x + S, cy + i * 8); } else { g.moveTo(cx + i * 8, y); g.lineTo(cx + i * 8, y + S); } g.stroke(); } g.restore(); g.globalAlpha = a; }
    if (sp) { const w = S * sc; g.drawImage(sp, cx - w / 2, cy - w / 2, w, w); } else { g.fillStyle = TYPES[tl.t].c; g.beginPath(); g.arc(cx, cy, S * 0.3 * sc, 0, 7); g.fill(); }
    if (tl.s === "row" || tl.s === "col") { const im = IMG("rocket"); if (im) { g.save(); g.translate(x + S - 9, y + S - 10); g.rotate(tl.s === "row" ? Math.PI / 2 : 0); const d = 17; g.drawImage(im, -d / 2, -d * 0.6, d, d * im.naturalHeight / im.naturalWidth); g.restore(); } }
    if (tl.s === "bomb") { const im = IMG("bomb"); if (im) { const d = 19; g.drawImage(im, x + S - d - 1, y + S - d - 1, d, d); } }
    g.globalAlpha = 1;
  }

  // ---------- board logic ----------
  function fill() {
    grid = [];
    for (let r = 0; r < N; r++) { grid.push([]); for (let c = 0; c < N; c++) { let tt; do { tt = randT(); } while ((c >= 2 && grid[r][c - 1].t === tt && grid[r][c - 2].t === tt) || (r >= 2 && grid[r - 1][c].t === tt && grid[r - 2][c].t === tt)); const tl = tile(tt); tl.fy = -(N - r) * S - 80 - c * 14; grid[r].push(tl); } }
    if (!hasMove()) fill();
  }
  function lines() {   // every straight run of 3+ of the same drink
    const out = [];
    for (let r = 0; r < N; r++) { let c = 0; while (c < N) { const a = grid[r][c]; let e = c + 1; if (a && a.t >= 0) while (e < N && grid[r][e] && grid[r][e].t === a.t) e++; if (e - c >= 3) out.push({ dir: "h", cells: Array.from({ length: e - c }, (_, i) => [r, c + i]) }); c = e; } }
    for (let c = 0; c < N; c++) { let r = 0; while (r < N) { const a = grid[r][c]; let e = r + 1; if (a && a.t >= 0) while (e < N && grid[e][c] && grid[e][c].t === a.t) e++; if (e - r >= 3) out.push({ dir: "v", cells: Array.from({ length: e - r }, (_, i) => [r + i, c]) }); r = e; } }
    return out;
  }
  // join crossing lines into groups so a T or L counts as one shape
  function groups() {
    const ls = lines(), gs = [];
    for (const l of ls) { const ks = new Set(l.cells.map(([r, c]) => key(r, c))); let joined = null;
      for (const gp of gs) if ([...ks].some((k) => gp.keys.has(k))) { if (!joined) { joined = gp; gp.lines.push(l); ks.forEach((k) => gp.keys.add(k)); } }
      if (!joined) gs.push({ lines: [l], keys: ks }); }
    return gs;
  }
  function swapCells(a, b) { const t1 = grid[a[0]][a[1]]; grid[a[0]][a[1]] = grid[b[0]][b[1]]; grid[b[0]][b[1]] = t1; }
  const isSpecial = (tl) => tl && !!tl.s;
  function hasMove(find) {
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) for (const [dr, dc] of [[0, 1], [1, 0]]) { const r2 = r + dr, c2 = c + dc; if (r2 >= N || c2 >= N) continue;
      const A = grid[r][c], B = grid[r2][c2]; if (A.s === "wild" || B.s === "wild" || (isSpecial(A) && isSpecial(B))) return find ? [[r, c], [r2, c2]] : true;
      swapCells([r, c], [r2, c2]); const ok = lines().length > 0; swapCells([r, c], [r2, c2]); if (ok) return find ? [[r, c], [r2, c2]] : true; }
    return find ? null : false;
  }
  function tween(tl, fromR, fromC, toR, toC) { tl.sw = { dx: (fromC - toC) * S, dy: (fromR - toR) * S, t: 0, d: 0.16 }; }

  async function trySwap(a, b) {
    if (busy || state !== "play") return; busy = true; idle = 0; hintCells = null; sel = null;
    const A = at(...a), B = at(...b);
    swapCells(a, b); tween(A, a[0], a[1], b[0], b[1]); tween(B, b[0], b[1], a[0], a[1]); sfx.swap(); await sleep(170);
    if (A.s === "wild" || B.s === "wild" || (isSpecial(A) && isSpecial(B))) { useMove(); await combo(A, B, b, a); gravity(); await settle(); await resolve(null); return endCheck(); }
    if (!lines().length) { swapCells(a, b); tween(A, b[0], b[1], a[0], a[1]); tween(B, a[0], a[1], b[0], b[1]); sfx.invalid(); await sleep(190); busy = false; return; }
    useMove(); await resolve([b, a]); endCheck();
  }
  function useMove() { if (freeze) { freeze = false; toast("FREE MOVE!", 900); return; } moves--; }
  // two specials (or a wild) swapped together
  async function combo(A, B, at1, at2) {
    const set = new Set(), [r, c] = at1;
    const sA = A.s, sB = B.s, wild = sA === "wild" ? A : sB === "wild" ? B : null, other = wild === A ? B : A;
    if (sA === "wild" && sB === "wild") { A.s = B.s = null; for (let i = 0; i < N * N; i++) set.add(i); toast("DRINKS ALL ROUND!", 1500); sfx.wild(); shake = 0.6; boltsTo(at1, [...set]); }
    else if (wild) {
      const tt = other.t, targets = [], wPos = wild === A ? at1 : at2; wild.s = null;   // the wild is used up here
      for (let rr2 = 0; rr2 < N; rr2++) for (let cc = 0; cc < N; cc++) if (grid[rr2][cc] && grid[rr2][cc].t === tt) targets.push(key(rr2, cc));
      if (other.s === "row" || other.s === "col" || other.s === "bomb") { for (const k of targets) { const [tr, tc] = rc(k); grid[tr][tc].s = other.s === "bomb" ? "bomb" : Math.random() < 0.5 ? "row" : "col"; grid[tr][tc].pop = 1; } toast(other.s === "bomb" ? "BOMBS AWAY!" : "ROCKET PARTY!", 1400); await sleep(350); }
      else toast("ROUND ON ME!", 1200);
      sfx.wild(); boltsTo(wPos, targets); targets.forEach((k) => set.add(k)); set.add(key(...wPos));
    } else {
      const both = [sA, sB], rocket = (s) => s === "row" || s === "col";
      if (rocket(sA) && rocket(sB)) { for (let i = 0; i < N; i++) { set.add(key(r, i)); set.add(key(i, c)); } beam(r, "row"); beam(c, "col"); sfx.rocket(); toast("CROSSFIRE!", 1000); }
      else if (both.includes("bomb") && both.some(rocket)) { for (let d = -1; d <= 1; d++) for (let i = 0; i < N; i++) { if (r + d >= 0 && r + d < N) set.add(key(r + d, i)); if (c + d >= 0 && c + d < N) set.add(key(i, c + d)); } for (let d = -1; d <= 1; d++) { beam(r + d, "row"); beam(c + d, "col"); } sfx.rocket(); sfx.bomb(); shake = 0.5; toast("MEGA ROCKETS!", 1100); }
      else { for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) if (at(r + dr, c + dc)) set.add(key(r + dr, c + dc)); sfx.bomb(); shake = 0.7; FX.ring(BX + c * S + S / 2, BY + r * S + S / 2, "#FF7A3D", 120); toast("BIG BANG!", 1000); }
      A.s = null; B.s = null;   // used up by the combo
    }
    await clearSet(set, 2);
  }
  async function resolve(focus) {
    let cascade = 1;
    for (;;) {
      const gs = groups(); if (!gs.length) break;
      const set = new Set(), make = [];
      for (const gp of gs) {
        gp.keys.forEach((k) => set.add(k));
        const longest = gp.lines.reduce((m, l) => Math.max(m, l.cells.length), 0), cross = gp.lines.some((l) => l.dir === "h") && gp.lines.some((l) => l.dir === "v");
        const [r0, c0] = rc([...gp.keys][0]), tt = grid[r0][c0].t;
        let cell = null; if (focus) for (const f of focus) if (f && gp.keys.has(key(...f))) { cell = f; break; }
        let s = null;
        if (longest >= 5) s = "wild";
        else if (cross) { s = "bomb"; if (!cell) { const h = gp.lines.find((l) => l.dir === "h"), v = gp.lines.find((l) => l.dir === "v"); const hit = h.cells.find(([hr, hc]) => v.cells.some(([vr, vc]) => vr === hr && vc === hc)); cell = hit || h.cells[1]; } }
        else if (longest === 4) { const l = gp.lines.find((x) => x.cells.length === 4); s = l.dir === "h" ? "row" : "col"; }
        if (s) { if (!cell) { const l = gp.lines.reduce((m, x) => (x.cells.length > m.cells.length ? x : m)); cell = l.cells[Math.floor(l.cells.length / 2)]; } make.push({ cell, s, t: s === "wild" ? -1 : tt }); }
      }
      if (cascade > 1) { sfx.cascade(cascade); const words = ["NICE ONE!", "CRACKING!", "LOVELY JUBBLY!", "ABSOLUTE SCENES!", "LEGEND!", "UNBELIEVABLE!"]; toast(`${words[Math.min(words.length - 1, cascade - 2)]}<br><small style="font-size:16px">COMBO ×${cascade}</small>`, 1000); }
      else sfx.match(set.size, cascade);
      await clearSet(set, cascade, make);
      for (const m of make) { const [r, c] = m.cell; grid[r][c] = tile(m.t, m.s); grid[r][c].pop = 1; if (m.s === "wild") { sfx.make5(); toast("WILD!", 900); } else if (m.s === "bomb") { beep(200, 600, 0.2, "square", 0.04); } else sfx.make4(); FX.ring(BX + c * S + S / 2, BY + r * S + S / 2, "#FFF6E0", 50); }
      gravity(); await settle(); cascade++; focus = null;
    }
    if (!hasMove()) { toast("NO MOVES. SHUFFLE!", 1000); await sleep(500); shuffleBoard(); await settle(); }
    busy = false;
  }
  // clear a set of cells, setting off any specials caught in it (they chain)
  async function clearSet(set, mult, keep = []) {
    const done = new Set(); let specials = 0, grew = true;
    while (grew) {
      grew = false;
      for (const k of [...set]) {
        if (done.has(k)) continue; done.add(k); const [r, c] = rc(k), tl = at(r, c); if (!tl || !tl.s || keep.some((m) => m.cell[0] === r && m.cell[1] === c)) continue;
        specials++;
        if (tl.s === "row") { for (let i = 0; i < N; i++) set.add(key(r, i)); beam(r, "row"); sfx.rocket(); grew = true; }
        else if (tl.s === "col") { for (let i = 0; i < N; i++) set.add(key(i, c)); beam(c, "col"); sfx.rocket(); grew = true; }
        else if (tl.s === "bomb") { for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) if (at(r + dr, c + dc)) set.add(key(r + dr, c + dc)); FX.ring(BX + c * S + S / 2, BY + r * S + S / 2, "#FF7A3D", 70); sfx.bomb(); shake = Math.max(shake, 0.35); grew = true; }
        else if (tl.s === "wild") { const present = [...new Set(grid.flat().filter((x) => x && x.t >= 0).map((x) => x.t))], tt = present[Math.floor(Math.random() * present.length)], ts = [];
          for (let rr2 = 0; rr2 < N; rr2++) for (let cc = 0; cc < N; cc++) if (grid[rr2][cc] && grid[rr2][cc].t === tt) { set.add(key(rr2, cc)); ts.push(key(rr2, cc)); } boltsTo([r, c], ts); sfx.wild(); grew = true; }
      }
    }
    for (const m of keep) set.delete(key(...m.cell));
    const pts = (set.size * 10 + specials * 60) * mult * cfg.mult; score += pts;
    let i = 0; const many = set.size > 18;
    for (const k of set) { const [r, c] = rc(k), tl = at(r, c); if (!tl) continue; const x = BX + c * S, y = BY + r * S;
      dying.push({ tile: tl, x, y, t: i * (many ? 0.004 : 0.012) }); if (!many || i % 2 === 0) FX.burst(x + S / 2, y + S / 2, tl.t >= 0 ? TYPES[tl.t].c : "#FFD45C", many ? 5 : 9, 150, 3); grid[r][c] = null; i++; }
    if (set.size) { const [r, c] = rc([...set][Math.floor(set.size / 2)]); FX.text(BX + c * S + S / 2, BY + r * S, "+" + pts.toLocaleString(), mult > 1 ? "#FFD45C" : "#FFF6E0", mult > 2 ? 20 : 16); }
    await sleep(230);
  }
  function beam(i, dir) { beams.push({ i, dir, t: 0 }); }
  function boltsTo(from, keys) { for (const k of keys.slice(0, 40)) { const [r, c] = rc(k); bolts.push({ x0: BX + from[1] * S + S / 2, y0: BY + from[0] * S + S / 2, x1: BX + c * S + S / 2, y1: BY + r * S + S / 2, t: 0 }); } }
  function gravity() {
    for (let c = 0; c < N; c++) {
      let w = N - 1;
      for (let r = N - 1; r >= 0; r--) if (grid[r][c]) { if (w !== r) { grid[w][c] = grid[r][c]; grid[w][c].fy -= (w - r) * S; grid[w][c].vy = 0; grid[r][c] = null; } w--; }
      for (let r = w, k = 0; r >= 0; r--, k++) { const tl = tile(randT()); tl.fy = -(w + 1) * S - 16 - k * 6; grid[r][c] = tl; }
    }
  }
  async function settle() { for (let i = 0; i < 60; i++) { await sleep(25); if (!grid.flat().some((tl) => tl && (tl.fy !== 0 || tl.vy !== 0))) break; } await sleep(40); }
  function shuffleBoard() {
    const all = grid.flat();
    do { for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [all[i], all[j]] = [all[j], all[i]]; } for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) grid[r][c] = all[r * N + c]; }
    while (lines().length || !hasMove());
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) { grid[r][c].fy = -40 - Math.random() * 60; grid[r][c].vy = 0; }
  }

  // ---------- power-ups ----------
  function puUi() { $("pu").querySelectorAll("button").forEach((b) => { const p = b.dataset.p; b.querySelector("i").textContent = PU[p]; b.classList.toggle("zero", PU[p] <= 0); b.classList.toggle("armed", armed === p || (p === "freeze" && freeze)); }); }
  $("pu").querySelectorAll("button").forEach((b) => b.addEventListener("click", async () => {
    const p = b.dataset.p; if (state !== "play" || busy) return; PUB.ctx && PUB.ctx();
    if (PU[p] <= 0) { toast("NONE LEFT<br><small style='font-size:14px'>Win levels to earn more</small>", 1100); return; }
    if (p === "shuffle") { PU.shuffle--; savePU(); armed = null; sfx.power(); busy = true; toast("SHUFFLE!", 800); shuffleBoard(); puUi(); await settle(); busy = false; return; }
    if (p === "freeze") { if (freeze) return; PU.freeze--; savePU(); freeze = true; freezeFx = 1; sfx.freeze(); toast("FROZEN!<br><small style='font-size:14px'>Your next move is free</small>", 1300); puUi(); return; }
    if (armed === p) { if (p === "rocket") { rocketDir = rocketDir === "row" ? "col" : "row"; toast(rocketDir === "row" ? "ROCKET ↔" : "ROCKET ↕", 700); } else armed = null; }
    else { armed = p; toast(p === "bomb" ? "TAP A DRINK TO BOMB IT" : `TAP A DRINK<br><small style='font-size:14px'>tap the rocket again to switch ${rocketDir === "row" ? "↕" : "↔"}</small>`, 1300); }
    sfx.select(); puUi();
  }));
  async function firePower(cell) {
    const p = armed; armed = null; if (!p || PU[p] <= 0) return puUi();
    PU[p]--; savePU(); puUi(); busy = true; idle = 0; hintCells = null; sel = null;
    const [r, c] = cell, set = new Set();
    if (p === "bomb") { for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) if (at(r + dr, c + dc)) set.add(key(r + dr, c + dc)); FX.ring(BX + c * S + S / 2, BY + r * S + S / 2, "#FF7A3D", 90); sfx.bomb(); shake = 0.45; }
    else { for (let i = 0; i < N; i++) set.add(rocketDir === "row" ? key(r, i) : key(i, c)); beam(rocketDir === "row" ? r : c, rocketDir); sfx.rocket(); }
    await clearSet(set, 1); gravity(); await settle(); await resolve(null); endCheck();
  }

  // ---------- level flow ----------
  function start(L = level) {
    level = L; cfg = levelCfg(level); moves = cfg.moves; score = 0; shownScore = 0; dying = []; beams = []; bolts = []; busy = false; sel = null; armed = null; freeze = false; starsLit = 0; hintCells = null; idle = 0;
    fill(); state = "play"; show(null, SHOW_IDS); puUi(); PUB.ctx && PUB.ctx(); mStart();
    toast(cfg.big ? `THE BIG ROUND!<br><small style="font-size:15px">Points ×2 · Target ${cfg.target.toLocaleString()}</small>` : `LEVEL ${level}<br><small style="font-size:15px">Target ${cfg.target.toLocaleString()}</small>`, 1700);
    if (cfg.big) fanfare();
  }
  function endCheck() {
    if (moves > 0 || state !== "play") return;
    state = "over"; mStop(); const won = score >= cfg.target;
    const s = score >= cfg.target * 1.8 ? 3 : score >= cfg.target * 1.4 ? 2 : won ? 1 : 0;
    const prevBest = bestOf(level); if (score > prevBest) store.set("crushBest" + level, String(score));
    $("oScore").textContent = score.toLocaleString(); $("oBest").textContent = Math.max(score, prevBest).toLocaleString(); $("shareMsg").hidden = true;
    const stars = $("oStars").querySelectorAll("span"); stars.forEach((x) => x.classList.remove("on"));
    if (won) {
      if (s > starsOf(level)) store.set("crushStars" + level, String(s));
      if (level + 1 > unlocked) { unlocked = level + 1; store.set("crushLevel", String(unlocked)); }
      PUB.submit("crush", level); PUB.best("crushBest", level);
      const kinds = ["shuffle", "bomb", "rocket", "freeze"], gift = kinds[Math.floor(Math.random() * 4)]; PU[gift]++; let reward = `+1 ${gift[0].toUpperCase() + gift.slice(1)}`;
      if (s === 3) { const g2 = kinds[Math.floor(Math.random() * 4)]; PU[g2]++; reward += ` and +1 ${g2[0].toUpperCase() + g2.slice(1)}`; } savePU();
      $("oTitle").textContent = cfg.big ? "BIG ROUND BEATEN!" : "LEVEL COMPLETE!"; $("oSub").textContent = s === 3 ? "Three stars. Barman of the year." : s === 2 ? "Two stars. Go again for the third?" : "Target beaten. Score higher for more stars.";
      $("oReward").hidden = false; $("oReward").textContent = "Power-ups: " + reward; $("again").textContent = "NEXT LEVEL"; $("again").onclick = () => start(level + 1);
      setTimeout(() => { show("over", SHOW_IDS); fanfare(); cheer(s === 3); try { PUB.confetti(s === 3 ? 200 : 120); } catch (e) {} stars.forEach((x, i) => { if (i < s) setTimeout(() => { x.classList.add("on"); sfx.star(i); }, 450 + i * 380); }); }, 700);
    } else {
      $("oTitle").textContent = "LAST ORDERS!"; $("oSub").textContent = `Out of moves. You needed ${cfg.target.toLocaleString()}.`; $("oReward").hidden = true;
      $("again").textContent = "TRY AGAIN"; $("again").onclick = () => start(level);
      setTimeout(() => { show("over", SHOW_IDS); sad(); }, 700);
    }
  }
  function openLevels() {
    const max = Math.max(unlocked + 4, 20), html = [];
    for (let L = 1; L <= max; L++) { const st = starsOf(L), big = L % 5 === 0;
      html.push(`<button type="button" data-l="${L}" class="${big ? "big" : ""} ${L === unlocked ? "cur" : ""}" ${L > unlocked ? "disabled" : ""}>${L}<small>${[1, 2, 3].map((i) => (i <= st ? "<b>★</b>" : "★")).join("")}</small></button>`); }
    $("levels").innerHTML = html.join(""); $("levels").querySelectorAll("button").forEach((b) => b.addEventListener("click", () => start(+b.dataset.l)));
    show("lvlpick", SHOW_IDS); const cur = $("levels").querySelector(".cur"); if (cur) cur.scrollIntoView({ block: "center" });
  }
  $("go").addEventListener("click", () => start(unlocked));
  $("openLevels").addEventListener("click", openLevels); $("toLevels").addEventListener("click", openLevels);
  $("lvlBack").addEventListener("click", () => { $("startLvl").textContent = unlocked; show("start", SHOW_IDS); });
  $("share").addEventListener("click", () => share(`I'm on level ${unlocked} of Bar Crush 🍺🍸 Beat that.`, $("shareMsg")));

  // ---------- input: swipe or tap-tap ----------
  const cv = $("game"); let downCell = null, downPt = null;
  const cellAt = (p) => { const c = Math.floor((p.x - BX) / S), r = Math.floor((p.y - BY) / S); return r >= 0 && r < N && c >= 0 && c < N ? [r, c] : null; };
  cv.addEventListener("pointerdown", (e) => { if (state !== "play" || busy) return; PUB.ctx && PUB.ctx(); const p = view.point(e), cell = cellAt(p); if (!cell) return; downCell = cell; downPt = p; try { cv.setPointerCapture(e.pointerId); } catch (er) {} });
  cv.addEventListener("pointermove", (e) => { if (!downCell || armed) return; const p = view.point(e), dx = p.x - downPt.x, dy = p.y - downPt.y; if (Math.max(Math.abs(dx), Math.abs(dy)) < 14) return;
    const to = Math.abs(dx) > Math.abs(dy) ? [downCell[0], downCell[1] + Math.sign(dx)] : [downCell[0] + Math.sign(dy), downCell[1]]; const from = downCell; downCell = null; if (at(...to)) trySwap(from, to); });
  cv.addEventListener("pointerup", () => { if (!downCell) return; const c = downCell; downCell = null;
    if (armed) return firePower(c);
    if (sel && Math.abs(sel[0] - c[0]) + Math.abs(sel[1] - c[1]) === 1) { const s = sel; sel = null; trySwap(s, c); } else { sel = sel && sel[0] === c[0] && sel[1] === c[1] ? null : c; if (sel) sfx.select(); } });

  // ---------- drawing ----------
  const glowCols = ["#3DE0FF", "#A45CFF", "#FF7A3D", "#FFB627"];
  const BOKEH = Array.from({ length: 14 }, (_, i) => ({ x: (i * 97) % W, y: 40 + ((i * 151) % 560), r: 10 + (i % 5) * 7, c: glowCols[i % 4], s: 0.2 + (i % 3) * 0.1 }));
  function cached(name, w, h, paint) {
    if (CACHE[name]) return CACHE[name]; if (!view) return null;
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5) * view.scale, c = document.createElement("canvas"); c.width = Math.ceil(w * dpr); c.height = Math.ceil(h * dpr);
    const x = c.getContext("2d"); x.scale(dpr, dpr); paint(x); return (CACHE[name] = c);
  }
  function logo() {
    return cached("logo", W, 58, (x) => {
      x.textAlign = "center"; x.textBaseline = "middle"; x.lineJoin = "round";
      x.font = "30px Bungee, Impact, sans-serif"; const wBar = x.measureText("BAR ").width, wCr = x.measureText("CRUSH").width, x0 = W / 2 - (wBar + wCr) / 2;
      x.textAlign = "left";
      x.shadowColor = "#A45CFF"; x.shadowBlur = 18; x.lineWidth = 8; x.strokeStyle = "#1A0A3A"; x.strokeText("BAR", x0, 31); x.strokeText("CRUSH", x0 + wBar, 31); x.shadowBlur = 0;
      const g1 = x.createLinearGradient(0, 16, 0, 46); g1.addColorStop(0, "#FFF6C4"); g1.addColorStop(0.5, "#FFC53D"); g1.addColorStop(1, "#E07A00"); x.fillStyle = g1; x.fillText("BAR", x0, 31);
      const g2 = x.createLinearGradient(0, 16, 0, 46); g2.addColorStop(0, "#E0FBFF"); g2.addColorStop(0.5, "#3DE0FF"); g2.addColorStop(1, "#1A6ABF"); x.fillStyle = g2; x.fillText("CRUSH", x0 + wBar, 31);
      x.fillStyle = "#FFD45C"; x.beginPath(); const cx = W / 2, cy = 8; x.moveTo(cx - 12, cy + 6); x.lineTo(cx - 13, cy - 2); x.lineTo(cx - 6, cy + 2); x.lineTo(cx, cy - 5); x.lineTo(cx + 6, cy + 2); x.lineTo(cx + 13, cy - 2); x.lineTo(cx + 12, cy + 6); x.closePath(); x.fill();
    });
  }
  function boardFrame() {
    return cached("frame", W, BY + N * S + 16, (x) => {
      const pad = 8, fx = BX - pad, fy = BY - pad, fw = N * S + pad * 2;
      x.shadowColor = "#A45CFF"; x.shadowBlur = 22; const fr = x.createLinearGradient(fx, fy, fx + fw, fy + fw); fr.addColorStop(0, "#FFB627"); fr.addColorStop(0.5, "#FF7A3D"); fr.addColorStop(1, "#A45CFF");
      x.fillStyle = fr; rr(x, fx - 3, fy - 3, fw + 6, fw + 6, 18); x.fill(); x.shadowBlur = 0;
      const inner = x.createLinearGradient(0, fy, 0, fy + fw); inner.addColorStop(0, "#141A4A"); inner.addColorStop(1, "#0A0E2E"); x.fillStyle = inner; rr(x, fx, fy, fw, fw, 15); x.fill();
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) { const cx = BX + c * S, cy = BY + r * S; const tg = x.createLinearGradient(0, cy, 0, cy + S); tg.addColorStop(0, "#1E2766"); tg.addColorStop(1, "#141A4C"); x.fillStyle = tg; rr(x, cx + 1.5, cy + 1.5, S - 3, S - 3, 8); x.fill();
        x.strokeStyle = "rgba(90,140,255,.22)"; x.lineWidth = 1; rr(x, cx + 1.5, cy + 1.5, S - 3, S - 3, 8); x.stroke(); }
    });
  }
  function panel(x, y, w, h, label, val, col, warn) {
    g.fillStyle = "rgba(14,18,58,.82)"; rr(g, x, y, w, h, 12); g.fill();
    const bd = g.createLinearGradient(x, y, x + w, y + h); bd.addColorStop(0, warn ? "#FF3D7F" : "#3DE0FF"); bd.addColorStop(1, warn ? "#FF7A3D" : "#A45CFF"); g.strokeStyle = bd; g.lineWidth = 2; rr(g, x, y, w, h, 12); g.stroke();
    g.fillStyle = "rgba(255,255,255,.08)"; rr(g, x + 3, y + 3, w - 6, h * 0.4, 9); g.fill();
    g.textAlign = "center"; g.textBaseline = "middle"; g.font = "800 9.5px Inter, Arial, sans-serif"; g.fillStyle = "#B9C6FF"; g.fillText(label, x + w / 2, y + 12);
    g.font = "22px Bungee, Impact, sans-serif"; g.fillStyle = col; g.fillText(val, x + w / 2, y + h - 17);
  }
  function draw(dt) {
    g.fillStyle = "#0A0E24"; g.fillRect(0, 0, W, H); PUB.backdrop(g, W, H, 0.55);
    const vg = g.createRadialGradient(W / 2, 290, 60, W / 2, 290, 420); vg.addColorStop(0, "rgba(60,30,120,.25)"); vg.addColorStop(1, "rgba(5,6,20,.7)"); g.fillStyle = vg; g.fillRect(0, 0, W, H);
    for (const b of BOKEH) { const y = (b.y - t * 6 * b.s + 640) % 640; g.globalAlpha = 0.12 + Math.sin(t * b.s * 3 + b.x) * 0.05; g.fillStyle = b.c; g.beginPath(); g.arc(b.x, y, b.r, 0, 7); g.fill(); } g.globalAlpha = 1;
    const lg = logo(); if (lg) g.drawImage(lg, 0, 2, W, 58);
    // HUD panels with a rolling score
    shownScore += (score - shownScore) * Math.min(1, dt * 8); if (Math.abs(score - shownScore) < 1) shownScore = score;
    const warn = state === "play" && moves <= 5 && Math.sin(t * 8) > 0;
    panel(14, 62, 96, 54, "LEVEL", String(level), "#FFE27A"); panel(118, 62, 124, 54, freeze ? "MOVES · FROZEN" : "MOVES", String(moves), freeze ? "#9FE8FF" : warn ? "#FF6A8A" : "#FFE27A", moves <= 5 && state === "play");
    panel(250, 62, 96, 54, "SCORE", Math.round(shownScore).toLocaleString(), "#FFE27A");
    if (cfg.big) { g.fillStyle = "#FF3D7F"; rr(g, W / 2 - 70, 114, 140, 14, 7); g.fill(); g.font = "9px Bungee, Impact, sans-serif"; g.fillStyle = "#fff"; g.textAlign = "center"; g.fillText("THE BIG ROUND · POINTS ×2", W / 2, 121.5); }
    const fr = boardFrame(); if (fr) g.drawImage(fr, 0, 0, W, BY + N * S + 16);
    if (state === "play" && !busy) { idle += dt; if (idle > 6 && !hintCells) hintCells = hasMove(true); }
    // tiles
    g.save(); g.beginPath(); g.rect(BX - 2, BY - 2, N * S + 4, N * S + 4); g.clip();
    if (shake > 0 && !REDUCED) { g.translate((Math.random() - 0.5) * 10 * shake, (Math.random() - 0.5) * 10 * shake); shake = Math.max(0, shake - dt * 1.6); }
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      const tl = grid[r] && grid[r][c]; if (!tl) continue;
      if (tl.fy < 0 || tl.vy) { tl.vy += 2600 * dt; tl.fy += tl.vy * dt; if (tl.fy >= 0) { if (tl.vy > 380 && !REDUCED) { tl.vy = -tl.vy * 0.2; tl.fy = 0; } else { tl.fy = 0; tl.vy = 0; } } }
      let ox = 0, oy = 0; if (tl.sw) { tl.sw.t += dt; const k = Math.min(1, tl.sw.t / tl.sw.d), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; ox = tl.sw.dx * (1 - e); oy = tl.sw.dy * (1 - e); if (k >= 1) tl.sw = null; }
      const x = BX + c * S + ox, y = BY + r * S + tl.fy + oy; if (y < BY - S) continue;
      let sc = 1;
      if (tl.pop) { tl.pop = Math.max(0, tl.pop - dt * 2.6); sc = 1 + Math.sin(tl.pop * Math.PI) * 0.3; }
      if (sel && sel[0] === r && sel[1] === c) { sc = 1.06 + Math.abs(Math.sin(t * 7)) * 0.08; g.fillStyle = "rgba(255,214,92,.22)"; rr(g, x + 1, y + 1, S - 2, S - 2, 9); g.fill(); g.strokeStyle = "#FFD45C"; g.lineWidth = 2.5; rr(g, x + 1.5, y + 1.5, S - 3, S - 3, 9); g.stroke(); }
      if (hintCells && hintCells.some(([a, b]) => a === r && b === c)) { sc = 1 + Math.sin(t * 8) * 0.07; g.strokeStyle = `rgba(255,255,255,${0.3 + Math.sin(t * 8) * 0.25})`; g.lineWidth = 2; rr(g, x + 2, y + 2, S - 4, S - 4, 9); g.stroke(); }
      drawTile(tl, x, y, sc);
    }
    for (let i = dying.length - 1; i >= 0; i--) { const d = dying[i]; d.t += dt; const k = d.t / 0.22; if (k < 0) continue; if (k >= 1) { dying.splice(i, 1); continue; } drawTile(d.tile, d.x, d.y, 1 + k * 0.5, 1 - k); }
    // rocket beams and wild lightning
    for (let i = beams.length - 1; i >= 0; i--) { const b = beams[i]; b.t += dt; const k = b.t / 0.35; if (k >= 1) { beams.splice(i, 1); continue; }
      const a = 1 - k; g.fillStyle = `rgba(255,246,224,${a * 0.85})`; const wdt = S * (0.4 + k * 0.6);
      if (b.dir === "row") { g.fillRect(BX, BY + b.i * S + S / 2 - wdt / 2, N * S, wdt); } else { g.fillRect(BX + b.i * S + S / 2 - wdt / 2, BY, wdt, N * S); } }
    for (let i = bolts.length - 1; i >= 0; i--) { const b = bolts[i]; b.t += dt; if (b.t > 0.4) { bolts.splice(i, 1); continue; }
      g.strokeStyle = `rgba(255,240,160,${1 - b.t / 0.4})`; g.lineWidth = 2; g.beginPath(); g.moveTo(b.x0, b.y0); const segs = 5; for (let s = 1; s <= segs; s++) { const k = s / segs; g.lineTo(b.x0 + (b.x1 - b.x0) * k + (s < segs ? (Math.random() - 0.5) * 10 : 0), b.y0 + (b.y1 - b.y0) * k + (s < segs ? (Math.random() - 0.5) * 10 : 0)); } g.stroke(); }
    if (freeze || freezeFx > 0) { freezeFx = Math.max(0, freezeFx - dt); g.fillStyle = `rgba(160,230,255,${0.08 + freezeFx * 0.25})`; g.fillRect(BX, BY, N * S, N * S); }
    g.restore();
    // progress bar with stars
    const px = 66, pw = 228, py = 474, k = Math.min(1, score / (cfg.target * 1.8));
    g.fillStyle = "rgba(10,14,36,.9)"; rr(g, px, py, pw, 14, 7); g.fill(); g.strokeStyle = "rgba(255,255,255,.15)"; g.lineWidth = 1; rr(g, px, py, pw, 14, 7); g.stroke();
    const pg = g.createLinearGradient(px, 0, px + pw, 0); pg.addColorStop(0, "#FFB627"); pg.addColorStop(1, "#FFE27A"); g.fillStyle = pg; if (k > 0) { rr(g, px, py, Math.max(14, pw * k), 14, 7); g.fill(); g.fillStyle = "rgba(255,255,255,.3)"; rr(g, px + 3, py + 2, Math.max(8, pw * k - 6), 4, 2); g.fill(); }
    let lit = 0;
    [1, 1.4, 1.8].forEach((f, i) => { const on = score >= cfg.target * f; if (on) lit++; const sx = px + pw * (f / 1.8) - (i === 2 ? 8 : 0), sy = py + 7;
      g.save(); g.translate(sx, sy); const pulse = on ? 1 + Math.sin(t * 5 + i) * 0.08 : 0.9; g.scale(pulse, pulse); g.fillStyle = on ? "#FFD45C" : "#3A3E70"; g.strokeStyle = on ? "#8A5200" : "#1A1E40"; g.lineWidth = 1.5;
      g.beginPath(); for (let j = 0; j < 10; j++) { const rr3 = j % 2 ? 5 : 11, a = j * Math.PI / 5 - Math.PI / 2; g.lineTo(Math.cos(a) * rr3, Math.sin(a) * rr3); } g.closePath(); g.fill(); g.stroke(); g.restore(); });
    if (lit > starsLit && state === "play") { for (let i = starsLit; i < lit; i++) { sfx.star(i); FX.burst(px + pw * ([1, 1.4, 1.8][i] / 1.8), py + 7, "#FFD45C", 16, 140, 3); } starsLit = lit; }
    g.textAlign = "center"; g.textBaseline = "middle"; g.font = "800 11px Inter, Arial, sans-serif"; g.fillStyle = "#F4E2C2"; g.fillText(`Target ${cfg.target.toLocaleString()}`, W / 2, 495);
    FX.step(dt); FX.draw(g);
  }
  let last = performance.now();
  function loop(now) { const dt = Math.min(0.033, (now - last) / 1000); last = now; t += dt; if (g) draw(dt); requestAnimationFrame(loop); }
  wireMute(); setMusic(musicOn); fill(); puUi();
  gate(() => { $("startLvl").textContent = unlocked; show("start", SHOW_IDS); });
  requestAnimationFrame(loop);
})();
