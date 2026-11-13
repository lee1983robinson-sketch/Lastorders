// Pint Stacker: tap to drop glasses onto the tray and build the tallest tower. World 360 x 640.
(() => {
  "use strict";
  const { $, store, REDUCED, pop, thud, smash, cheer, fanfare, sad, beep, music, wireMute, fit, show, gate, toast, share, best, rr, particles } = PUB;
  const W = 360, H = 640, BASE_Y = 560;
  let g = null, view = null; fit($("game"), W, H, (o) => { view = o; g = o.g; });
  const FX = particles();
  const KINDS = [
    // sizes follow the real drink photos so what you see is what stacks
    { n: "pint", w: 44, h: 76, col: "#FFB627" }, { n: "half", w: 40, h: 56, col: "#FFB627" }, { n: "wine", w: 37, h: 76, col: "#9B1B3E" },
    { n: "stout", w: 43, h: 76, col: "#1B0F0B" }, { n: "shot", w: 30, h: 28, col: "#E89A2E" }, { n: "bottle", w: 24, h: 74, col: "#6B3A12" },
  ];
  let state = "menu", stack = [], mover = null, falling = null, score = 0, perfect = 0, t = 0, cam = 0, camT = 0, lean = 0, topple = null;
  function nextKind() { const pool = score < 5 ? [0, 1, 5] : score < 12 ? [0, 1, 2, 3, 5] : [0, 1, 2, 3, 4, 5]; return KINDS[pool[Math.floor(Math.random() * pool.length)]]; }
  function top() { return stack[stack.length - 1]; }
  function spawnMover() { const k = nextKind(), y = top().y - top().h - 120; mover = { ...k, x: 60, y, dir: 1, speed: Math.min(120 + score * 9, 330) }; }
  function start() {
    stack = [{ n: "tray", w: 150, h: 10, x: W / 2, y: BASE_Y, col: "#C8CCD8" }]; score = 0; perfect = 0; cam = 0; camT = 0; lean = 0; topple = null; falling = null; state = "play"; show(null); hud(); spawnMover();
    music([[45, 48, 52], [41, 45, 48], [43, 47, 50], [45, 48, 52]], [69, 0, 72, 0, 76, 0, 74, 72, 71, 0, 72, 0, 74, 0, 0, 0, 72, 0, 74, 0, 76, 79, 77, 76, 74, 0, 72, 0, 69, 0, 0, 0], 116);
  }
  function hud() { $("score").textContent = score; $("best").textContent = Math.max(score, best("stackBest")); }
  function drop() { if (state !== "play" || !mover || falling) return; PUB.ctx(); falling = { ...mover, vy: 0 }; mover = null; beep(600, 300, 0.08, "sine", 0.04); }
  function land() {
    const f = falling, tp = top(); falling = null; let off = f.x - tp.x;
    if (Math.abs(off) > (tp.w / 2 + f.w / 2) * 0.62) { f.y = tp.y - tp.h; return fallOff(f, off); }
    if (Math.abs(off) < 4) { off = 0; f.x = tp.x; perfect++; FX.ring(f.x, f.y - f.h / 2 - cam, "#FFF6E0", 60); FX.burst(f.x, tp.y - tp.h - cam, "#FFB627", 14, 160, 3); toast(perfect >= 3 ? "PERFECT ×" + perfect + "!" : "PERFECT!", 800); beep(880 + perfect * 80, 1320 + perfect * 80, 0.12, "triangle", 0.06); score += perfect >= 3 ? 2 : 1; }
    else { perfect = 0; thud(); }
    f.y = tp.y - tp.h; stack.push(f); score++; hud();
    if (score % 10 === 0) { fanfare(); toast(score + " HIGH!", 1100); }
    // balance: for each level, the weight above it must sit over it
    for (let i = 0; i < stack.length - 1; i++) {
      const above = stack.slice(i + 1); let m = 0, cx = 0; for (const s of above) { const mass = s.w * s.h; m += mass; cx += s.x * mass; } cx /= m;
      if (Math.abs(cx - stack[i].x) > stack[i].w / 2 + 2) return toppleFrom(i + 1, Math.sign(cx - stack[i].x));
    }
    lean = 0; for (let i = 1; i < stack.length; i++) lean += (stack[i].x - stack[i - 1].x) / 600;
    camT = Math.max(0, (BASE_Y - top().y) - 260); spawnMover();
  }
  function fallOff(f, off) { topple = { items: [{ ...f, vx: Math.sign(off) * 120, vy: -60, a: 0, va: Math.sign(off) * 4 }] }; over("It slid right off!"); }
  function toppleFrom(i, dir) { topple = { items: stack.splice(i).map((s, k) => ({ ...s, vx: dir * (80 + k * 20), vy: -40 - k * 10, a: 0, va: dir * (2 + k * 0.3) })) }; over("TIMBER! The lot's gone over."); }
  function over(msg) { state = "over"; smash(); setTimeout(smash, 250); sad(); const b = best("stackBest", score); PUB.submit("stack", score); setTimeout(() => { $("oScore").textContent = score; $("oBest").textContent = b; $("oSub").textContent = msg; $("shareMsg").hidden = true; show("over"); }, 1300); }
  function update(dt) {
    t += dt; cam += (camT - cam) * Math.min(1, dt * 4);
    if (mover) { mover.x += mover.dir * mover.speed * dt; if (mover.x > W - mover.w / 2 - 8) { mover.x = W - mover.w / 2 - 8; mover.dir = -1; } if (mover.x < mover.w / 2 + 8) { mover.x = mover.w / 2 + 8; mover.dir = 1; } }
    if (falling) { falling.vy += 1800 * dt; falling.y += falling.vy * dt; if (falling.y >= top().y - top().h) land(); }
    if (topple) for (const it of topple.items) { it.vy += 1400 * dt; it.x += it.vx * dt; it.y += it.vy * dt; it.a += it.va * dt; if (!it.splashed && it.y > BASE_Y + 60) { it.splashed = true; FX.burst(it.x, BASE_Y + 40 - cam, "#CFE7F2", 14, 200, 2.5); } }
  }
  // ---------- drawing ----------
  function glass(k, x, y, a = 0) { // x, y = bottom centre in world, already camera-adjusted
    g.save(); g.translate(x, y); g.rotate(a);
    const w = k.w, h = k.h;

    // Soft contact shadow gives each glass a little weight on the stack.
    if (k.n !== "tray") {
      g.fillStyle = "rgba(0,0,0,.24)";
      g.beginPath(); g.ellipse(0, -1, w * .48, 3.5, 0, 0, Math.PI * 2); g.fill();
    }

    const photo = { pint: "lager", half: "lager", stout: "stout", wine: "wine", bottle: "bottle" }[k.n], im = photo && PUB.art("drinks/" + photo);
    if (im) { g.drawImage(im, -w / 2, -h, w, h); g.restore(); return; }

    if (k.n === "tray") {
      const tg = g.createLinearGradient(0, -h, 0, 0);
      tg.addColorStop(0, "#F5F7FC"); tg.addColorStop(.28, "#C9D0DE");
      tg.addColorStop(.62, "#818A9E"); tg.addColorStop(1, "#454D62");
      g.fillStyle = tg; rr(g, -w / 2, -h, w, h, 5); g.fill();
      g.strokeStyle = "rgba(255,255,255,.55)"; g.lineWidth = 1;
      g.beginPath(); g.moveTo(-w / 2 + 7, -h + 1); g.lineTo(w / 2 - 7, -h + 1); g.stroke();
      g.restore(); return;
    }

    if (k.n === "wine") {
      // Bowl, stem and foot with glass-like highlights.
      const bowl = g.createLinearGradient(-w / 2, 0, w / 2, 0);
      bowl.addColorStop(0, "rgba(180,205,235,.48)"); bowl.addColorStop(.18, "rgba(245,250,255,.20)");
      bowl.addColorStop(.72, "rgba(190,215,245,.12)"); bowl.addColorStop(1, "rgba(220,235,255,.42)");
      g.fillStyle = bowl; g.beginPath();
      g.moveTo(-w / 2, -h); g.lineTo(w / 2, -h);
      g.quadraticCurveTo(w / 2 + 2, -h * .42, 0, -h * .42);
      g.quadraticCurveTo(-w / 2 - 2, -h * .42, -w / 2, -h); g.closePath(); g.fill();
      g.save(); g.beginPath(); g.moveTo(-w / 2 + 2, -h * .74); g.lineTo(w / 2 - 2, -h * .74);
      g.quadraticCurveTo(w / 2, -h * .42, 0, -h * .44); g.quadraticCurveTo(-w / 2, -h * .42, -w / 2 + 2, -h * .74); g.closePath(); g.clip();
      const wine = g.createLinearGradient(0, -h * .75, 0, -h * .4);
      wine.addColorStop(0, "#F04A67"); wine.addColorStop(1, "#70152F");
      g.fillStyle = wine; g.fillRect(-w, -h, w * 2, h);
      g.restore();
      g.strokeStyle = "rgba(255,255,255,.72)"; g.lineWidth = 1.6; g.beginPath();
      g.moveTo(-w * .42, -h * .94); g.quadraticCurveTo(-w * .48, -h * .68, -w * .2, -h * .5); g.stroke();
      g.fillStyle = "rgba(225,238,255,.75)"; g.fillRect(-1.5, -h * .42, 3, h * .36);
      g.beginPath(); g.ellipse(0, -1.5, w * .34, 3, 0, 0, Math.PI * 2); g.fill();
    } else {
      const topW = w, bottomW = k.n === "shot" ? w * .8 : w * .82;
      const leftTop = -topW / 2, rightTop = topW / 2;
      const leftBottom = -bottomW / 2, rightBottom = bottomW / 2;

      // Glass body: cool edge tint, clear centre and a darker weighted base.
      const body = g.createLinearGradient(leftTop, 0, rightTop, 0);
      body.addColorStop(0, "rgba(207,229,255,.48)");
      body.addColorStop(.12, "rgba(245,250,255,.17)");
      body.addColorStop(.48, "rgba(255,255,255,.07)");
      body.addColorStop(.86, "rgba(210,232,255,.13)");
      body.addColorStop(1, "rgba(210,230,255,.42)");
      g.fillStyle = body; g.beginPath();
      g.moveTo(leftTop, -h); g.lineTo(rightTop, -h);
      g.lineTo(rightBottom, 0); g.lineTo(leftBottom, 0); g.closePath(); g.fill();

      // Liquid clipped inside the glass, with a subtle meniscus.
      const fillTop = k.n === "shot" ? -h * .70 : k.n === "stout" ? -h * .86 : -h * .80;
      g.save(); g.beginPath(); g.moveTo(leftTop + 3, -h + 3); g.lineTo(rightTop - 3, -h + 3);
      g.lineTo(rightBottom - 3, -2); g.lineTo(leftBottom + 3, -2); g.closePath(); g.clip();
      const liquid = g.createLinearGradient(0, fillTop, 0, 0);
      if (k.n === "stout") {
        liquid.addColorStop(0, "#563326"); liquid.addColorStop(.18, "#2C1711"); liquid.addColorStop(1, "#100A08");
      } else {
        liquid.addColorStop(0, "#FFD15A"); liquid.addColorStop(.22, "#FFB323"); liquid.addColorStop(.78, "#E98A0B"); liquid.addColorStop(1, "#A94D08");
      }
      g.fillStyle = liquid; g.fillRect(-w, fillTop, w * 2, h);
      g.fillStyle = "rgba(255,255,255,.20)";
      g.beginPath(); g.ellipse(0, fillTop + 1, w * .39, 2.2, 0, 0, Math.PI * 2); g.fill();
      // Fine carbonation bubbles in lager.
      if (k.n !== "stout" && k.n !== "shot") {
        for (let i = 0; i < 5; i++) {
          const bx = Math.sin(i * 8.1 + w) * w * .25, by = fillTop + 9 + i * 8;
          g.fillStyle = i % 2 ? "rgba(255,245,195,.32)" : "rgba(255,255,255,.22)";
          g.beginPath(); g.arc(bx, by, i % 2 ? 1.1 : 1.5, 0, Math.PI * 2); g.fill();
        }
      }
      g.restore();

      // Foam head, with a rounded, slightly uneven edge.
      if (k.n !== "shot") {
        const foamH = k.n === "stout" ? h * .17 : h * .22;
        const foam = g.createLinearGradient(0, -h - 2, 0, -h + foamH);
        foam.addColorStop(0, "#FFFDF1"); foam.addColorStop(.55, "#FFF3D6"); foam.addColorStop(1, "#D9C7A7");
        g.fillStyle = foam; rr(g, -topW / 2 + 2, -h - 2, topW - 4, foamH, 6); g.fill();
        g.fillStyle = "rgba(255,255,255,.65)";
        g.beginPath(); g.ellipse(-topW * .19, -h + 2, topW * .16, 2, 0, 0, Math.PI * 2); g.fill();
      }

      // Bright glass rim and long specular reflections.
      g.strokeStyle = "rgba(255,255,255,.82)"; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(-topW / 2 + 1, -h); g.lineTo(topW / 2 - 1, -h); g.stroke();
      g.strokeStyle = "rgba(255,255,255,.58)"; g.lineWidth = 2.2;
      g.beginPath(); g.moveTo(-topW * .34, -h * .84); g.lineTo(-bottomW * .34, -h * .12); g.stroke();
      g.strokeStyle = "rgba(160,205,255,.34)"; g.lineWidth = 1;
      g.beginPath(); g.moveTo(topW * .39, -h * .82); g.lineTo(bottomW * .39, -h * .12); g.stroke();
      g.strokeStyle = "rgba(255,255,255,.36)"; g.lineWidth = 1;
      g.beginPath(); g.moveTo(-bottomW * .42, -1); g.lineTo(bottomW * .42, -1); g.stroke();

      if (k.n === "tankard") {
        const hg = g.createLinearGradient(w / 2, 0, w / 2 + 14, 0);
        hg.addColorStop(0, "rgba(220,235,255,.25)"); hg.addColorStop(.5, "rgba(255,255,255,.65)"); hg.addColorStop(1, "rgba(180,205,235,.22)");
        g.strokeStyle = hg; g.lineWidth = 5; g.beginPath(); g.arc(w / 2 + 6, -h * .5, h * .22, -1.4, 1.4); g.stroke();
      }
    }
    g.restore();
  }
  function draw(dt) {
    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#211747"); bg.addColorStop(.48, "#21152F"); bg.addColorStop(1, "#160D13");
    g.fillStyle = bg; g.fillRect(0, 0, W, H); PUB.backdrop(g, W, H, 0.5);

    // Warm out-of-focus pub lights add atmosphere without distracting from the tower.
    for (let i = 0; i < 7; i++) {
      const lx = 24 + i * 53, ly = 82 + (i % 3) * 54;
      const glow = g.createRadialGradient(lx, ly, 1, lx, ly, 30);
      glow.addColorStop(0, i % 2 ? "rgba(255,184,77,.12)" : "rgba(91,192,255,.09)");
      glow.addColorStop(1, "rgba(255,184,77,0)");
      g.fillStyle = glow; g.fillRect(lx - 30, ly - 30, 60, 60);
    }
    // Very subtle wall texture.
    g.fillStyle = "rgba(255,255,255,.018)";
    for (let y = 20; y < H; y += 34) g.fillRect(0, y, W, 1);

    // height markers
    g.fillStyle = "rgba(255,246,224,.12)"; g.font = "bold 11px Inter, Arial"; g.textAlign = "left";
    for (let m = 0; m < 400; m += 5) { const y = BASE_Y - m * 52 + cam; if (y < -20 || y > H) continue; g.fillRect(0, y, 18, 1.5); if (m) g.fillText(m, 22, y + 4); }
    // bar counter
    const by = BASE_Y + cam; const bar = g.createLinearGradient(0, by, 0, H);
    bar.addColorStop(0, "#B77A48"); bar.addColorStop(.06, "#80502B"); bar.addColorStop(.35, "#5B321B"); bar.addColorStop(1, "#24130D");
    g.fillStyle = bar; g.fillRect(0, by, W, H - by + 40);
    g.fillStyle = "rgba(255,220,165,.13)"; g.fillRect(0, by + 4, W, 2);
    for (let i = 0; i < 18; i++) {
      const yy = by + 18 + i * 11;
      g.strokeStyle = i % 3 === 0 ? "rgba(255,210,150,.055)" : "rgba(20,8,3,.07)";
      g.lineWidth = 1; g.beginPath(); g.moveTo(0, yy); g.bezierCurveTo(90, yy - 2, 220, yy + 3, W, yy - 1); g.stroke();
    }
    g.save(); const sway = REDUCED || state !== "play" ? 0 : Math.sin(t * 2) * lean * 0.6;
    g.translate(W / 2, by); g.rotate(sway); g.translate(-W / 2, -by);
    for (const s of stack) glass(s, s.x, s.y + cam);
    g.restore();
    if (falling) glass(falling, falling.x, falling.y + cam);
    if (mover) { glass(mover, mover.x, mover.y + cam); g.strokeStyle = "rgba(255,246,224,.15)"; g.setLineDash([3, 6]); g.beginPath(); g.moveTo(mover.x, mover.y + cam + 4); g.lineTo(mover.x, top().y - top().h + cam); g.stroke(); g.setLineDash([]); }
    if (topple) for (const it of topple.items) glass(it, it.x, it.y + cam, it.a);
    FX.step(dt); FX.draw(g);
  }
  let last = performance.now();
  function loop(now) { const dt = Math.min(0.033, (now - last) / 1000); last = now; update(dt); draw(dt); requestAnimationFrame(loop); }
  $("game").addEventListener("pointerdown", drop);
  addEventListener("keydown", (e) => { if (e.code === "Space") { e.preventDefault(); drop(); } });
  $("go").addEventListener("click", start); $("again").addEventListener("click", start);
  $("share").addEventListener("click", () => share(`I stacked ${score} drinks on Pint Stacker 🍺🍺🍺 Beat that.`, $("shareMsg")));
  wireMute(); stack = [{ n: "tray", w: 150, h: 10, x: W / 2, y: BASE_Y, col: "#C8CCD8" }]; hud();
  gate(() => show("start"));
  requestAnimationFrame(loop);
})();
