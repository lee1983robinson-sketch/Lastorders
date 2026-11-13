// Snack Merge: drop bar snacks into the glass, two the same make the next one up. World 360 x 640.
(() => {
  "use strict";
  const { $, store, REDUCED, pop, thud, cheer, fanfare, sad, burp, beep, music, wireMute, fit, show, gate, toast, share, best, rr, particles } = PUB;
  const W = 360, H = 640, LX = 44, RX = 316, FLOOR = 568, TOPY = 176, DANGER = 196, DROPY = 140;
  const TIERS = [
    { n: "Peanuts", r: 12, c: "#D49A5A", p: 1, img: "peanuts" }, { n: "Crisps", r: 16, c: "#F2C23A", p: 3, img: "crisps" }, { n: "Pork Scratchings", r: 21, c: "#B86A30", p: 6, img: "scratchings" },
    { n: "Pickled Egg", r: 26, c: "#F6E7A0", p: 10, img: "egg" }, { n: "Scotch Egg", r: 32, c: "#C0702C", p: 15, img: "scotch-egg" }, { n: "Sausage Roll", r: 38, c: "#E8A848", p: 21, img: "sausage-roll" },
    { n: "Pork Pie", r: 45, c: "#D9963E", p: 28, img: "pie" }, { n: "Burger", r: 52, c: "#E04A2A", p: 36, img: "burger" }, { n: "Pizza", r: 60, c: "#FF6A3D", p: 45, img: "pizza" }, { n: "Mighty Kebab", r: 68, c: "#7BD86A", p: 55, img: "kebab" },
  ];
  let g = null, view = null; fit($("game"), W, H, (o) => { view = o; g = o.g; });
  const FX = particles();

  // ---------- snack drawings (local units: radius r, centre 0,0) ----------
  function face(r, dark = "#2A1400") {
    const e = r * 0.16; g.fillStyle = dark; g.beginPath(); g.arc(-r * 0.3, -r * 0.05, e * 0.55, 0, 7); g.arc(r * 0.3, -r * 0.05, e * 0.55, 0, 7); g.fill();
    g.fillStyle = "#FFFFFF"; g.beginPath(); g.arc(-r * 0.27, -r * 0.1, e * 0.2, 0, 7); g.arc(r * 0.33, -r * 0.1, e * 0.2, 0, 7); g.fill();
    g.strokeStyle = dark; g.lineWidth = Math.max(1.2, r * 0.06); g.lineCap = "round"; g.beginPath(); g.arc(0, r * 0.08, r * 0.14, 0.2, Math.PI - 0.2); g.stroke();
    g.fillStyle = "rgba(255,110,140,.45)"; g.beginPath(); g.arc(-r * 0.5, r * 0.15, r * 0.1, 0, 7); g.arc(r * 0.5, r * 0.15, r * 0.1, 0, 7); g.fill();
  }
  function ball(r, c1, c2) { const gr = g.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r); gr.addColorStop(0, c1); gr.addColorStop(1, c2); g.fillStyle = gr; }
  function shine(r) { g.fillStyle = "rgba(255,255,255,.35)"; g.beginPath(); g.ellipse(-r * 0.38, -r * 0.48, r * 0.26, r * 0.13, -0.6, 0, 7); g.fill(); }
  const DRAW = [
    (r) => { ball(r, "#F2C08A", "#A86A30"); g.beginPath(); g.ellipse(0, -r * 0.42, r * 0.62, r * 0.56, 0, 0, 7); g.ellipse(0, r * 0.42, r * 0.62, r * 0.56, 0, 0, 7); g.fill(); g.strokeStyle = "rgba(90,50,20,.35)"; g.lineWidth = 1; for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(-r * 0.5, i * r * 0.3); g.lineTo(r * 0.5, i * r * 0.3 + 2); g.stroke(); } face(r * 0.8); },
    (r) => { ball(r, "#FFD08A", "#C0701A"); g.beginPath(); for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2, rr2 = r * (0.9 + (i % 2) * 0.1); g.lineTo(Math.cos(a) * rr2, Math.sin(a) * rr2 * 0.85); } g.closePath(); g.fill(); g.fillStyle = "rgba(255,240,200,.35)"; for (let i = 0; i < 7; i++) { g.beginPath(); g.arc(Math.cos(i * 2.3) * r * 0.5, Math.sin(i * 1.7) * r * 0.45, r * 0.08, 0, 7); g.fill(); } face(r); },
    (r) => { ball(r, "#E2A060", "#7A3E14"); g.beginPath(); for (let i = 0; i < 18; i++) { const a = i / 18 * Math.PI * 2, rr2 = r * (0.82 + Math.abs(Math.sin(i * 1.9)) * 0.18); g.lineTo(Math.cos(a) * rr2, Math.sin(a) * rr2); } g.closePath(); g.fill(); g.fillStyle = "rgba(255,230,190,.45)"; for (let i = 0; i < 9; i++) { g.beginPath(); g.ellipse(Math.cos(i * 2.1) * r * 0.55, Math.sin(i * 1.3) * r * 0.5, r * 0.12, r * 0.07, i, 0, 7); g.fill(); } face(r); },
    (r) => { ball(r, "#FFFDF0", "#C8C0A0"); g.beginPath(); g.arc(0, 0, r, 0, 7); g.fill(); g.strokeStyle = "rgba(160,140,90,.35)"; g.lineWidth = 1.2; for (let i = 1; i <= 3; i++) { g.beginPath(); g.ellipse(0, 0, r * (0.25 * i), r * 0.95, 0, 0, 7); g.stroke(); } g.fillStyle = "#B8A070"; g.beginPath(); g.moveTo(-r * 0.1, -r); g.quadraticCurveTo(0, -r * 1.3, r * 0.15, -r * 1.15); g.lineTo(r * 0.05, -r * 0.95); g.fill(); shine(r); face(r * 0.85, "#5A4A20"); },
    (r) => { g.fillStyle = "#2F6BEA"; rr(g, -r * 0.8, -r * 0.95, r * 1.6, r * 1.9, r * 0.25); g.fill(); g.fillStyle = "#1E4FC0"; for (const y of [-r * 0.95, r * 0.8]) { g.beginPath(); for (let i = 0; i <= 8; i++) g.lineTo(-r * 0.8 + i * r * 0.2, y + (i % 2) * r * 0.12); g.lineTo(r * 0.8, y + r * 0.15); g.lineTo(-r * 0.8, y + r * 0.15); g.fill(); } g.fillStyle = "#FFD24A"; rr(g, -r * 0.62, -r * 0.48, r * 1.24, r * 0.38, r * 0.1); g.fill(); g.fillStyle = "#1E2A6A"; g.font = `bold ${r * 0.28}px Bungee, Impact, sans-serif`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("CRISPS", 0, -r * 0.28); g.fillStyle = "#F2C14E"; g.beginPath(); g.ellipse(0, r * 0.35, r * 0.34, r * 0.22, 0.3, 0, 7); g.fill(); g.save(); g.translate(0, r * 0.1); face(r * 0.55, "#0A1440"); g.restore(); shine(r); },
    (r) => { ball(r, "#FFFFFF", "#D8CFAE"); g.beginPath(); g.ellipse(0, 0, r * 0.82, r, 0, 0, 7); g.fill(); g.fillStyle = "rgba(230,200,120,.25)"; g.beginPath(); g.ellipse(r * 0.1, r * 0.2, r * 0.5, r * 0.6, 0, 0, 7); g.fill(); shine(r); face(r * 0.8, "#4A3A20"); },
    (r) => { ball(r, "#C8844A", "#6A3610"); g.beginPath(); g.arc(0, 0, r, 0, 7); g.fill(); g.fillStyle = "#E7A8A0"; g.beginPath(); g.arc(0, 0, r * 0.74, 0, 7); g.fill(); g.fillStyle = "#FFFDF4"; g.beginPath(); g.arc(0, 0, r * 0.56, 0, 7); g.fill(); g.fillStyle = "#FFB627"; g.beginPath(); g.arc(0, r * 0.05, r * 0.3, 0, 7); g.fill(); g.fillStyle = "rgba(255,220,180,.35)"; for (let i = 0; i < 16; i++) { const a = i * 0.39; g.beginPath(); g.arc(Math.cos(a) * r * 0.87, Math.sin(a) * r * 0.87, r * 0.05, 0, 7); g.fill(); } g.save(); g.translate(0, -r * 0.05); face(r * 0.42); g.restore(); },
    (r) => { ball(r, "#F6C878", "#A8661E"); g.beginPath(); g.arc(0, 0, r, 0, 7); g.fill(); g.strokeStyle = "#B87628"; g.lineWidth = r * 0.12; g.beginPath(); for (let i = 0; i <= 24; i++) { const a = i / 24 * Math.PI * 2, rr2 = r * (0.86 + (i % 2) * 0.06); g.lineTo(Math.cos(a) * rr2, Math.sin(a) * rr2); } g.stroke(); g.strokeStyle = "rgba(255,240,200,.5)"; g.lineWidth = 2; g.beginPath(); g.moveTo(-r * 0.3, -r * 0.4); g.lineTo(-r * 0.05, -r * 0.55); g.moveTo(r * 0.3, -r * 0.4); g.lineTo(r * 0.05, -r * 0.55); g.stroke(); g.fillStyle = "#6A3A12"; g.beginPath(); g.arc(0, -r * 0.45, r * 0.07, 0, 7); g.fill(); face(r * 0.75); },
    (r) => { g.fillStyle = "#E8A04A"; g.beginPath(); g.ellipse(0, -r * 0.3, r * 0.95, r * 0.66, 0, Math.PI, 0); g.lineTo(r * 0.95, -r * 0.2); g.lineTo(-r * 0.95, -r * 0.2); g.fill(); g.fillStyle = "#FFF2C8"; for (let i = 0; i < 8; i++) { g.beginPath(); g.ellipse(Math.cos(i * 2.4) * r * 0.5, -r * 0.6 + Math.sin(i * 1.3) * r * 0.15, r * 0.06, r * 0.03, i, 0, 7); g.fill(); }
      g.fillStyle = "#5FBF5A"; g.beginPath(); for (let i = 0; i <= 10; i++) g.lineTo(-r * 0.98 + i * r * 0.196, -r * 0.18 + (i % 2) * r * 0.12); g.lineTo(r * 0.98, -r * 0.05); g.lineTo(-r * 0.98, -r * 0.05); g.fill();
      g.fillStyle = "#FFC832"; g.beginPath(); g.moveTo(-r * 0.95, -r * 0.08); g.lineTo(r * 0.95, -r * 0.08); g.lineTo(r * 0.6, r * 0.12); g.lineTo(0, r * 0.02); g.lineTo(-r * 0.7, r * 0.14); g.fill();
      g.fillStyle = "#6A341A"; rr(g, -r * 0.96, r * 0.0, r * 1.92, r * 0.36, r * 0.16); g.fill(); g.fillStyle = "#E8A04A"; rr(g, -r * 0.9, r * 0.36, r * 1.8, r * 0.42, r * 0.2); g.fill(); g.save(); g.translate(0, -r * 0.45); face(r * 0.6); g.restore(); },
    (r) => { ball(r, "#FFFFFF", "#C8C8D0"); g.beginPath(); g.arc(0, 0, r, 0, 7); g.fill(); g.strokeStyle = "#3D5AA8"; g.lineWidth = r * 0.05; g.beginPath(); g.arc(0, 0, r * 0.9, 0, 7); g.stroke();
      g.fillStyle = "#8A4A1E"; g.beginPath(); g.ellipse(r * 0.05, r * 0.15, r * 0.58, r * 0.4, 0.2, 0, 7); g.fill();
      g.fillStyle = "#E8B060"; g.beginPath(); g.arc(-r * 0.35, -r * 0.3, r * 0.3, 0, 7); g.fill(); g.fillStyle = "#C88A3A"; g.beginPath(); g.arc(-r * 0.35, -r * 0.3, r * 0.16, 0, 7); g.fill();
      g.fillStyle = "#F0C060"; for (const [x, y] of [[r * 0.3, -r * 0.35], [r * 0.5, -r * 0.05], [r * 0.15, -r * 0.55]]) { g.beginPath(); g.ellipse(x, y, r * 0.16, r * 0.12, 0.4, 0, 7); g.fill(); }
      g.fillStyle = "#5FBF5A"; for (const [x, y] of [[-r * 0.45, r * 0.35], [-r * 0.32, r * 0.48], [-r * 0.55, r * 0.5], [-r * 0.2, r * 0.6]]) { g.beginPath(); g.arc(x, y, r * 0.07, 0, 7); g.fill(); }
      g.fillStyle = "#F07A2A"; g.save(); g.translate(r * 0.42, r * 0.45); g.rotate(-0.5); rr(g, -r * 0.2, -r * 0.05, r * 0.4, r * 0.1, r * 0.05); g.fill(); g.restore();
      g.save(); g.translate(r * 0.05, r * 0.12); face(r * 0.38, "#2A1000"); g.restore(); },
  ];
  // real snack photos become round tokens (matching the round physics), built once and reused every frame
  const RIMS = ["#D49A5A", "#F2C23A", "#B86A30", "#E8D27A", "#C0702C", "#E8A848", "#D9963E", "#E04A2A", "#FF6A3D", "#7BD86A"];
  const BADGES = [];
  function badge(t) {
    if (BADGES[t]) return BADGES[t]; const im = PUB.art("snacks/" + TIERS[t].img); if (!im) return null;
    const r = TIERS[t].r, S = 3, D = Math.ceil(r * 2 * S) + 4, c = document.createElement("canvas"); c.width = c.height = D; const x = c.getContext("2d"); x.translate(D / 2, D / 2); x.scale(S, S);
    const disc = x.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r); disc.addColorStop(0, "#3A2A4A"); disc.addColorStop(1, "#140C22");
    x.save(); x.beginPath(); x.arc(0, 0, r, 0, 7); x.clip(); x.fillStyle = disc; x.fillRect(-r, -r, r * 2, r * 2);
    const k = (r * 2.15) / Math.max(im.naturalWidth, im.naturalHeight); x.drawImage(im, -im.naturalWidth * k / 2, -im.naturalHeight * k / 2 + r * 0.04, im.naturalWidth * k, im.naturalHeight * k);
    const sh = x.createRadialGradient(0, 0, r * 0.7, 0, 0, r); sh.addColorStop(0, "rgba(0,0,0,0)"); sh.addColorStop(1, "rgba(0,0,0,.45)"); x.fillStyle = sh; x.fillRect(-r, -r, r * 2, r * 2);
    const gl = x.createLinearGradient(0, -r, 0, 0); gl.addColorStop(0, "rgba(255,255,255,.35)"); gl.addColorStop(1, "rgba(255,255,255,0)"); x.fillStyle = gl; x.beginPath(); x.ellipse(-r * 0.15, -r * 0.5, r * 0.7, r * 0.38, -0.3, 0, 7); x.fill();
    x.restore(); x.lineWidth = Math.max(2, r * 0.09); x.strokeStyle = RIMS[t]; x.beginPath(); x.arc(0, 0, r - x.lineWidth / 2, 0, 7); x.stroke();
    x.lineWidth = 1; x.strokeStyle = "rgba(255,255,255,.45)"; x.beginPath(); x.arc(0, 0, r - Math.max(2, r * 0.09) - 0.5, Math.PI * 1.1, Math.PI * 1.7); x.stroke();
    return (BADGES[t] = c);
  }
  function drawSnack(t, x, y, ang = 0, s = 1) {
    const r = TIERS[t].r * s; g.save(); g.translate(x, y); g.rotate(ang); g.fillStyle = "rgba(0,0,0,.25)"; g.beginPath(); g.ellipse(2, r * 0.9, r * 0.8, r * 0.18, 0, 0, 7); g.fill();
    const b = badge(t); if (b) g.drawImage(b, -r - 2 * s / 3, -r - 2 * s / 3, r * 2 + 4 * s / 3, r * 2 + 4 * s / 3); else DRAW[t](r);
    g.restore();
  }

  // ---------- physics ----------
  let bodies = [], state = "menu", score = 0, held = 0, nextT = 0, dropX = W / 2, canDrop = true, dangerT = 0, t = 0, biggest = 0, idSeq = 1;
  const pickT = () => { const max = Math.min(4, 1 + Math.floor(biggest / 2)); return Math.floor(Math.random() * (max + 1)); };
  function addBody(tier, x, y, vx = 0, vy = 0) { const b = { id: idSeq++, t: tier, r: TIERS[tier].r, x, y, vx, vy, a: 0, born: t, pop: 0 }; bodies.push(b); return b; }
  function physics(dt) {
    const steps = 4, h = dt / steps, G = 1500;
    for (let s = 0; s < steps; s++) {
      for (const b of bodies) { b.vy += G * h; b.x += b.vx * h; b.y += b.vy * h; b.a += (b.vx / b.r) * h; }
      for (let it = 0; it < 3; it++) {
        for (let i = 0; i < bodies.length; i++) {
          const a = bodies[i];
          if (a.x < LX + a.r) { a.x = LX + a.r; if (a.vx < 0) a.vx *= -0.2; }
          if (a.x > RX - a.r) { a.x = RX - a.r; if (a.vx > 0) a.vx *= -0.2; }
          if (a.y > FLOOR - a.r) { a.y = FLOOR - a.r; if (a.vy > 0) a.vy *= -0.15; a.vx *= 0.985; }
          for (let j = i + 1; j < bodies.length; j++) {
            const b = bodies[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), min = a.r + b.r;
            if (d >= min || d === 0) continue;
            if (a.t === b.t && !a.dead && !b.dead && a.t < TIERS.length) { merge(a, b); continue; }
            const nx = dx / d, ny = dy / d, ov = min - d, ma = a.r * a.r, mb = b.r * b.r, tot = ma + mb;
            a.x -= nx * ov * (mb / tot); a.y -= ny * ov * (mb / tot); b.x += nx * ov * (ma / tot); b.y += ny * ov * (ma / tot);
            const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
            if (rv < 0) { const j2 = -(1.1) * rv / (1 / ma + 1 / mb); a.vx -= (j2 / ma) * nx; a.vy -= (j2 / ma) * ny; b.vx += (j2 / mb) * nx; b.vy += (j2 / mb) * ny;
              const tx = -ny, ty = nx, rt = (b.vx - a.vx) * tx + (b.vy - a.vy) * ty, f = rt * 0.08; a.vx += tx * f * (mb / tot); a.vy += ty * f * (mb / tot); b.vx -= tx * f * (ma / tot); b.vy -= ty * f * (ma / tot); }
          }
        }
        bodies = bodies.filter((b) => !b.dead);
      }
      for (const b of bodies) { b.vx *= 0.9995; b.vy *= 0.9995; }
    }
  }
  function merge(a, b) {
    a.dead = b.dead = true; const nt = a.t + 1, x = (a.x + b.x) / 2, y = (a.y + b.y) / 2;
    score += TIERS[a.t].p * 2; FX.burst(x, y, TIERS[a.t].c, 12 + a.t * 2, 140 + a.t * 15, 3 + a.t * 0.3); FX.ring(x, y, "#FFF6E0", a.r * 1.8);
    pop(1.4 - a.t * 0.08);
    if (nt >= TIERS.length) { score += 500; toast("TWO MIGHTY KEBABS!<br>+500", 1600); fanfare(); cheer(true); return hud(); }
    const nb = addBody(nt, x, y, (a.vx + b.vx) / 2, Math.min(0, (a.vy + b.vy) / 2) - 60); nb.pop = 1;
    if (nt > biggest) { biggest = nt; if (nt >= 4) { toast(TIERS[nt].n.toUpperCase() + "!", 1200); nt >= 7 ? (fanfare(), cheer(false)) : beep(660, 990, 0.15, "triangle", 0.06); if (nt === 9) burp(); } }
    hud();
  }

  // ---------- game ----------
  function hud() { $("score").textContent = score; $("best").textContent = Math.max(score, best("mergeBest")); }
  function start() { bodies = []; score = 0; biggest = 0; held = pickT(); nextT = pickT(); canDrop = true; dangerT = 0; state = "play"; show(null); hud(); music([[48, 52, 55], [53, 57, 60], [55, 59, 62], [48, 52, 55]], [76, 0, 74, 72, 74, 0, 76, 0, 79, 0, 77, 76, 74, 0, 0, 0, 72, 0, 74, 76, 77, 0, 76, 74, 72, 0, 71, 0, 72, 0, 0, 0], 112); }
  function drop() {
    if (!canDrop || state !== "play") return; const r = TIERS[held].r; const x = Math.max(LX + r, Math.min(RX - r, dropX));
    addBody(held, x, DROPY); held = nextT; nextT = pickT(); canDrop = false; beep(400, 250, 0.08, "sine", 0.05); setTimeout(() => (canDrop = true), 450);
  }
  function over() {
    state = "over"; sad(); const b = best("mergeBest", score); PUB.submit("merge", score);
    $("oScore").textContent = score; $("oBest").textContent = b; $("oBig").textContent = TIERS[biggest].n; $("oSub").textContent = biggest >= 9 ? "The Mighty Kebab! You legend." : biggest >= 7 ? "Got to the " + TIERS[biggest].n.toLowerCase() + ". Not bad at all." : "Glass is full. Have another go."; $("shareMsg").hidden = true; show("over");
  }
  const cv = $("game");
  cv.addEventListener("pointerdown", (e) => { if (state !== "play") return; PUB.ctx(); dropX = view.point(e).x; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener("pointermove", (e) => { if (state === "play" && (e.buttons || e.pointerType !== "mouse")) dropX = view.point(e).x; });
  cv.addEventListener("pointerup", (e) => { if (state !== "play") return; dropX = view.point(e).x; drop(); });
  addEventListener("keydown", (e) => { if (state !== "play") return; if (e.code === "ArrowLeft") dropX -= 16; if (e.code === "ArrowRight") dropX += 16; if (e.code === "Space" || e.code === "ArrowDown") { e.preventDefault(); drop(); } });

  // ---------- drawing ----------
  function drawGlass() {
    // table
    const tb = g.createLinearGradient(0, FLOOR, 0, H); tb.addColorStop(0, "#7A4A28"); tb.addColorStop(1, "#3A2010"); g.fillStyle = tb; g.fillRect(0, FLOOR + 6, W, H);
    g.fillStyle = "rgba(0,0,0,.25)"; for (let i = 0; i < 5; i++) g.fillRect(0, FLOOR + 12 + i * 7, W, 1);
    // glass body
    g.save(); g.beginPath(); g.moveTo(LX - 6, TOPY); g.lineTo(LX - 2, FLOOR + 6); g.lineTo(RX + 2, FLOOR + 6); g.lineTo(RX + 6, TOPY); g.closePath();
    const gl = g.createLinearGradient(LX, 0, RX, 0); gl.addColorStop(0, "rgba(180,220,255,.16)"); gl.addColorStop(0.15, "rgba(180,220,255,.05)"); gl.addColorStop(0.85, "rgba(180,220,255,.05)"); gl.addColorStop(1, "rgba(180,220,255,.14)"); g.fillStyle = gl; g.fill();
    g.strokeStyle = "rgba(220,240,255,.55)"; g.lineWidth = 3; g.stroke(); g.restore();
    g.fillStyle = "rgba(220,240,255,.35)"; rr(g, LX - 2, FLOOR, RX - LX + 4, 10, 4); g.fill();
    g.fillStyle = "rgba(255,255,255,.18)"; g.fillRect(LX + 6, TOPY + 20, 6, FLOOR - TOPY - 60);
    // danger line
    const dang = dangerT > 0.2; g.setLineDash([8, 6]); g.strokeStyle = dang ? `rgba(255,61,127,${0.5 + 0.5 * Math.sin(t * 14)})` : "rgba(255,246,224,.25)"; g.lineWidth = 2; g.beginPath(); g.moveTo(LX, DANGER); g.lineTo(RX, DANGER); g.stroke(); g.setLineDash([]);
  }
  function draw(dt) {
    const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, "#1B1240"); bg.addColorStop(1, "#2A160E"); g.fillStyle = bg; g.fillRect(0, 0, W, H); PUB.backdrop(g, W, H, 0.55);
    for (let i = 0; i < 9; i++) { g.fillStyle = ["#FFB62714", "#FF3D7F12", "#3DE0FF10"][i % 3]; g.beginPath(); g.arc((i * 97) % W, 120 + ((i * 53) % 300), 30 + (i % 4) * 14, 0, 7); g.fill(); }
    // evolution strip
    const sx = 26, step = (W - 52) / 9; g.fillStyle = "#0A0E24aa"; rr(g, 10, 64, W - 20, 40, 14); g.fill();
    for (let i = 0; i < TIERS.length; i++) { g.globalAlpha = i <= biggest ? 1 : 0.35; drawSnack(i, sx + i * step, 84, 0, 11 / TIERS[i].r); } g.globalAlpha = 1;
    drawGlass();
    for (const b of bodies) { let s = 1; if (b.pop > 0) { b.pop = Math.max(0, b.pop - dt * 4); s = 1 + Math.sin(b.pop * Math.PI) * 0.25; } drawSnack(b.t, b.x, b.y, b.a, s); }
    if (state === "play") {
      const r = TIERS[held].r, x = Math.max(LX + r, Math.min(RX - r, dropX));
      g.strokeStyle = "rgba(255,246,224,.25)"; g.setLineDash([3, 6]); g.lineWidth = 2; g.beginPath(); g.moveTo(x, DROPY + r); g.lineTo(x, FLOOR); g.stroke(); g.setLineDash([]);
      g.globalAlpha = canDrop ? 1 : 0.4; drawSnack(held, x, DROPY, 0); g.globalAlpha = 1;
      g.fillStyle = "#0A0E24cc"; rr(g, W - 72, 116, 58, 50, 12); g.fill(); g.fillStyle = "#B9B6D9"; g.font = "bold 9px Inter, Arial"; g.textAlign = "center"; g.fillText("NEXT", W - 43, 128); drawSnack(nextT, W - 43, 148, 0, Math.min(1, 15 / TIERS[nextT].r));
    }
    FX.step(dt); FX.draw(g);
  }
  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.033, (now - last) / 1000); last = now; t += dt;
    if (state === "play") {
      physics(dt);
      const over_ = bodies.some((b) => t - b.born > 1.2 && b.y - b.r < DANGER && Math.abs(b.vy) < 120);
      dangerT = over_ ? dangerT + dt : Math.max(0, dangerT - dt * 2); if (dangerT > 2.2) over();
    }
    draw(dt); requestAnimationFrame(loop);
  }
  $("go").addEventListener("click", start); $("again").addEventListener("click", start);
  $("share").addEventListener("click", () => share(`I scored ${score} on Snack Merge and made a ${TIERS[biggest].n.toLowerCase()} 🥧🍺 Beat that.`, $("shareMsg")));
  wireMute(); hud();
  gate(() => show("start"));
  requestAnimationFrame(loop);
})();
