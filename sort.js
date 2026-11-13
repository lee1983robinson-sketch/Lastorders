// Drink Sort: pour between glasses until every glass holds one drink. World 360 x 640.
(() => {
  "use strict";
  const { $, store, REDUCED, pop, thud, cheer, fanfare, sad, beep, noise, music, wireMute, fit, show, gate, toast, share, best, rr, shade, particles } = PUB;
  const W = 360, H = 640, CAP = 4;
  let g = null, view = null; fit($("game"), W, H, (o) => { view = o; g = o.g; });
  const FX = particles();
  const DRINKS = [
    { n: "Lager", c: "#FFB627", foam: true }, { n: "Red wine", c: "#9B1B3E" }, { n: "Cider", c: "#8BC34A" }, { n: "Blue", c: "#2E7BFF" },
    { n: "Stout", c: "#2A1810", foam: true }, { n: "Rosé", c: "#FF8FB1" }, { n: "Aperol", c: "#FF6A1A" }, { n: "Gin", c: "#BFE8F2" }, { n: "Crème de menthe", c: "#2ED39A" }, { n: "Cola", c: "#5A2A12" },
  ];
  let level = +(store.get("sortLevel") || 1), glasses = [], sel = -1, history = [], undos = 3, extra = 1, moves = 0, state = "menu", t = 0, anim = null, lifted = 0;

  // ---------- levels: shuffle, then make sure it can be solved ----------
  function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  function make(lv) {
    const nc = Math.min(DRINKS.length, 3 + Math.floor((lv + 1) / 2)), empties = lv > 14 ? 2 : 2;
    for (let attempt = 0; attempt < 60; attempt++) {
      const R = rng(lv * 7919 + attempt * 104729), pool = []; for (let c = 0; c < nc; c++) for (let k = 0; k < CAP; k++) pool.push(c);
      for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
      const gl = []; for (let c = 0; c < nc; c++) gl.push(pool.slice(c * CAP, c * CAP + CAP)); for (let e = 0; e < empties; e++) gl.push([]);
      if (gl.some((x) => x.length === CAP && x.every((v) => v === x[0]))) continue;
      if (solvable(gl)) return gl;
    }
    const gl = []; for (let c = 0; c < nc; c++) gl.push([c, c, c, c]); gl.push([], []); return gl; // fallback (never seen)
  }
  function topRun(x) { if (!x.length) return 0; const c = x[x.length - 1]; let n = 0; for (let i = x.length - 1; i >= 0 && x[i] === c; i--) n++; return n; }
  function canPour(a, b) { if (a === b || !a.length || b.length >= CAP) return false; if (b.length && b[b.length - 1] !== a[a.length - 1]) return false; return true; }
  function solved(gl) { return gl.every((x) => !x.length || (x.length === CAP && x.every((v) => v === x[0]))); }
  function solvable(start) {
    const seen = new Set(); let nodes = 0;
    const key = (gl) => gl.map((x) => x.join("")).sort().join("|");
    function dfs(gl) {
      if (solved(gl)) return true; if (++nodes > 120000) return false; const k = key(gl); if (seen.has(k)) return false; seen.add(k);
      for (let i = 0; i < gl.length; i++) for (let j = 0; j < gl.length; j++) {
        const a = gl[i], b = gl[j]; if (!canPour(a, b)) continue; if (!b.length && topRun(a) === a.length) continue;
        const n = Math.min(topRun(a), CAP - b.length); const na = a.slice(0, a.length - n), nb = b.concat(a.slice(a.length - n));
        const ng = gl.slice(); ng[i] = na; ng[j] = nb; if (dfs(ng)) return true;
      }
      return false;
    }
    return dfs(start.map((x) => x.slice()));
  }

  // ---------- layout ----------
  const GW = 46, GH = 150;
  function slots() { const n = glasses.length, perRow = n <= 6 ? n : Math.ceil(n / 2), rows = n <= 6 ? 1 : 2, gap = Math.min(18, (W - perRow * GW) / (perRow + 1));
    const out = []; for (let i = 0; i < n; i++) { const r = rows === 1 ? 0 : i < perRow ? 0 : 1, inRow = r === 0 ? Math.min(perRow, n) : n - perRow, c = r === 0 ? i : i - perRow, rowW = inRow * GW + (inRow - 1) * gap;
      out.push({ x: (W - rowW) / 2 + c * (GW + gap), y: rows === 1 ? 250 : r === 0 ? 150 : 370 }); } return out; }

  // ---------- play ----------
  function startLevel() { glasses = make(level); sel = -1; history = []; undos = 3; extra = 1; moves = 0; state = "play"; show(null); hud(); toast("LEVEL " + level, 900); music([[48, 52, 55], [45, 48, 52], [41, 45, 48], [43, 47, 50]], [72, 0, 0, 76, 0, 0, 79, 0, 77, 0, 0, 74, 0, 0, 72, 0, 69, 0, 0, 72, 0, 0, 76, 0, 74, 0, 0, 71, 0, 0, 72, 0], 96); }
  function hud() { $("lvl").textContent = level; $("moves").textContent = moves; $("undo").textContent = `Undo (${undos})`; $("undo").disabled = !undos || !history.length; $("add").textContent = extra ? "+1 glass" : "No glasses left"; $("add").disabled = !extra; }
  function tap(i) {
    if (state !== "play" || anim) return; PUB.ctx();
    if (sel < 0) { if (!glasses[i].length) return; sel = i; beep(600, 760, 0.05, "triangle", 0.04); return; }
    if (sel === i) { sel = -1; return; }
    const a = glasses[sel], b = glasses[i];
    if (!canPour(a, b)) { beep(240, 180, 0.12, "square", 0.04); const s = sel; sel = i && glasses[i].length ? i : -1; if (sel === s) sel = -1; return; }
    const n = Math.min(topRun(a), CAP - b.length), col = a[a.length - 1];
    history.push(glasses.map((x) => x.slice())); anim = { from: sel, to: i, n, col, t: 0 }; sel = -1; moves++;
    noise(0.45, 0.05, 900, 0.12); hud();
  }
  function finishPour() {
    const { from, to, n, col } = anim; anim = null; const a = glasses[from], b = glasses[to]; a.splice(a.length - n, n); for (let k = 0; k < n; k++) b.push(col);
    if (b.length === CAP && b.every((v) => v === b[0])) { const p = slots()[to]; FX.burst(p.x + GW / 2, p.y + 10, DRINKS[col].c, 16, 160, 3); FX.ring(p.x + GW / 2, p.y + GH / 2, "#FFF6E0", 50); pop(1.2); toast(DRINKS[col].n.toUpperCase() + " SORTED!", 800); }
    if (solved(glasses)) win();
    hud();
  }
  function win() {
    state = "over"; fanfare(); cheer(true); PUB.submit("sort", level); best("sortBest", level);
    const s = moves <= glasses.length * 2 + 2 ? 3 : moves <= glasses.length * 3 + 4 ? 2 : 1; level++; store.set("sortLevel", String(level));
    $("oTitle").textContent = "LEVEL " + (level - 1) + " SORTED!"; $("oStars").innerHTML = [1, 2, 3].map((i) => `<span class="${i <= s ? "on" : ""}">★</span>`).join(""); $("oSub").textContent = `Done in ${moves} pours.`; $("shareMsg").hidden = true;
    setTimeout(() => show("over"), 900);
  }
  $("undo").addEventListener("click", () => { if (!undos || !history.length || anim) return; glasses = history.pop(); undos--; moves = Math.max(0, moves - 1); sel = -1; hud(); });
  $("add").addEventListener("click", () => { if (!extra || anim || glasses.length >= 12) return; extra--; glasses.push([]); hud(); beep(500, 900, 0.1, "triangle", 0.05); });
  $("restart").addEventListener("click", () => { if (anim || state !== "play") return; glasses = make(level); history = []; moves = 0; undos = 3; extra = 1; sel = -1; hud(); });

  const cv = $("game");
  cv.addEventListener("pointerdown", (e) => { const p = view.point(e); const sl = slots(); for (let i = 0; i < sl.length; i++) { const s = sl[i]; if (p.x >= s.x - 6 && p.x <= s.x + GW + 6 && p.y >= s.y - 30 && p.y <= s.y + GH + 10) { tap(i); return; } } sel = -1; });

  // ---------- drawing ----------
  function glassShape(x, y) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + GW, y); g.lineTo(x + GW - 5, y + GH - 10); g.quadraticCurveTo(x + GW - 6, y + GH, x + GW / 2, y + GH); g.quadraticCurveTo(x + 6, y + GH, x + 5, y + GH - 10); g.closePath(); }
  function drawGlass(i, x, y, tilt = 0, pivot = null) {
    const content = glasses[i]; g.save();
    if (tilt) { g.translate(pivot.x, pivot.y); g.rotate(tilt); g.translate(-pivot.x, -pivot.y); }
    glassShape(x, y); g.fillStyle = "rgba(200,230,255,.07)"; g.fill();
    g.save(); glassShape(x, y); g.clip();
    const lh = (GH - 14) / CAP; let shown = content.slice(); if (anim && anim.from === i) shown = shown.slice(0, shown.length - Math.round(anim.n * Math.min(1, anim.t / 0.55))); if (anim && anim.to === i) { const add = Math.round(anim.n * Math.min(1, Math.max(0, anim.t - 0.2) / 0.5)); for (let k = 0; k < add; k++) shown.push(anim.col); }
    shown.forEach((c, k) => { const yy = y + GH - 4 - (k + 1) * lh; const D = DRINKS[c]; const gr = g.createLinearGradient(x, 0, x + GW, 0); gr.addColorStop(0, shade(D.c, -0.25)); gr.addColorStop(0.4, shade(D.c, 0.15)); gr.addColorStop(1, shade(D.c, -0.3)); g.fillStyle = gr; g.fillRect(x - 10, yy, GW + 20, lh + 1);
      g.fillStyle = "rgba(255,255,255,.35)"; for (let b = 0; b < 3; b++) { const by = yy + lh - ((t * 18 + b * 13 + i * 7 + k * 5) % lh); g.beginPath(); g.arc(x + 10 + b * 12, by, 1.3, 0, 7); g.fill(); } });
    if (shown.length) { const top = shown[shown.length - 1], yy = y + GH - 4 - shown.length * lh; if (DRINKS[top].foam) { g.fillStyle = top === 4 ? "#F3E6C8" : "#FFF6E0"; g.fillRect(x - 10, yy - 5, GW + 20, 7); } else { g.fillStyle = "rgba(255,255,255,.35)"; g.fillRect(x - 10, yy, GW + 20, 2); } }
    g.restore();
    glassShape(x, y); g.strokeStyle = i === sel ? "#FFB627" : "rgba(220,240,255,.7)"; g.lineWidth = i === sel ? 3 : 2; g.stroke();
    g.fillStyle = "rgba(255,255,255,.22)"; g.fillRect(x + 7, y + 10, 4, GH - 40);
    const full = content.length === CAP && content.every((v) => v === content[0]); if (full && !(anim && (anim.from === i || anim.to === i))) { g.fillStyle = "#5FE3B0"; g.font = "bold 12px Inter, Arial"; g.textAlign = "center"; g.fillText("✓", x + GW / 2, y - 8); }
    g.restore();
  }
  function draw(dt) {
    const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, "#1B1240"); bg.addColorStop(1, "#2A160E"); g.fillStyle = bg; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 8; i++) { g.fillStyle = ["#FFB62712", "#FF3D7F10", "#3DE0FF0e"][i % 3]; g.beginPath(); g.arc((i * 97) % W, 100 + (i * 71) % 400, 30 + (i % 3) * 20, 0, 7); g.fill(); }
    const bar = g.createLinearGradient(0, 548, 0, H); bar.addColorStop(0, "#8A5A32"); bar.addColorStop(0.1, "#5A3418"); bar.addColorStop(1, "#24130A"); g.fillStyle = bar; g.fillRect(0, 548, W, H);
    const sl = slots(); lifted += ((sel >= 0 ? 1 : 0) - lifted) * Math.min(1, dt * 14);
    for (let i = 0; i < glasses.length; i++) {
      if (anim && anim.from === i) continue; const s = sl[i]; drawGlass(i, s.x, s.y - (i === sel ? 22 * lifted : 0));
      g.fillStyle = "rgba(0,0,0,.25)"; g.beginPath(); g.ellipse(s.x + GW / 2, s.y + GH + 4, GW * 0.45, 4, 0, 0, 7); g.fill();
    }
    if (anim) {
      anim.t += dt; const a = sl[anim.from], b = sl[anim.to], k = Math.min(1, anim.t / 0.18), back = anim.t > 0.75 ? Math.min(1, (anim.t - 0.75) / 0.18) : 0, side = a.x < b.x ? 1 : -1;
      const px = a.x + (b.x - a.x - side * (GW - 4)) * (k - back), py = a.y + (b.y - 60 - a.y) * (k - back);
      const tilt = side * 1.25 * (k - back);
      drawGlass(anim.from, px, py, tilt, { x: px + (side > 0 ? GW : 0), y: py });
      if (anim.t > 0.15 && anim.t < 0.72) { g.strokeStyle = DRINKS[anim.col].c; g.lineWidth = 5; g.lineCap = "round"; g.beginPath(); const sx = px + (side > 0 ? GW : 0); g.moveTo(sx, py + 4); g.lineTo(b.x + GW / 2, b.y + GH - 10 - glasses[anim.to].length * ((GH - 14) / CAP)); g.stroke(); }
      if (anim.t > 0.95) finishPour();
    }
    FX.step(dt); FX.draw(g);
  }
  let last = performance.now();
  function loop(now) { const dt = Math.min(0.033, (now - last) / 1000); last = now; t += dt; draw(dt); requestAnimationFrame(loop); }
  $("go").addEventListener("click", startLevel); $("again").addEventListener("click", startLevel);
  $("pick1").addEventListener("click", () => { level = 1; startLevel(); });
  $("share").addEventListener("click", () => share(`I'm on level ${level} of Drink Sort 🍷🍺 Bet you can't sort it.`, $("shareMsg")));
  wireMute(); glasses = make(level);
  gate(() => { $("startLvl").textContent = level; $("pick1").hidden = level <= 1; show("start"); });
  requestAnimationFrame(loop);
})();
