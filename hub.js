// Robbo's Game Lab platform: home, games, leaderboards, achievements and profile in one page.
// Every number shown comes from the player's own saved data or the live leaderboard. Nothing is made up.
(() => {
  "use strict";
  const { $, store } = PUB;
  const num = (k) => +(store.get(k) || 0);
  const J = (k, d) => { try { return JSON.parse(store.get(k) || "") ?? d; } catch (e) { return d; } };
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const today = () => PUB.todayKey();
  const fmt = (n) => Number(n).toLocaleString();

  // ---------- the catalogue ----------
  const quizStatus = () => store.get("quizDay") === today() ? "Tonight: " + (store.get("quizScore-" + today()) || 0) + " pts" : "Tonight's quiz is ready";
  const GAMES = [
    { id: "mega", page: "goldpints", name: "Golden Pints", cat: "slots", tag: "Modern 5-reel slot with free spins and a daily wheel.", hero: "Five reels, twenty lines, a Cool Pint wild and free spins that pay triple. Spin the daily wheel too.", isNew: true, best: () => num("gpBest") ? "Biggest win " + fmt(num("gpBest")) : "" },
    { id: "crush", page: "crush", name: "Bar Crush", cat: "puzzles", tag: "Swap drinks, match three, set off rockets and bombs.", hero: "Match drinks, build rockets, bombs and wilds, and smash through the levels. Every fifth one is the Big Round.", isNew: true, best: () => num("crushLevel") > 1 ? "On level " + num("crushLevel") : "" },
    { id: "flying", page: "flying-pint", name: "Flying Pint", cat: "arcade", tag: "Tap to flap a pint home past the pubs.", hero: "It's chucking-out time. Flap your pint home past the pubs, grab kebabs and beat your best.", best: () => num("loBest") ? "Best " + num("loBest") : "" },
    { id: "goggles", page: "run", name: "Beer Goggles", cat: "arcade", tag: "3D runner. Every beer makes the chaser fitter.", hero: "A 3D night-out runner. Grab the beers, dodge the bins, and don't let the chaser catch you.", best: () => num("bgBest") ? "Best " + fmt(num("bgBest")) : "" },
    { id: "slots", page: "slots", name: "Club Fruitie", cat: "slots", tag: "Old-school fruit machine with a feature board.", hero: "The one by the gents. Climb the number trail, get on the feature board and chase the cash ladder.", isNew: true, best: () => num("slotBest") ? "Biggest win " + fmt(num("slotBest")) : "" },
    { id: "darts", page: "darts", name: "Darts", cat: "pub", tag: "501 against the pub's finest. Mind the sway.", best: () => num("dWon") ? num("dWon") + " legs won" : "" },
    { id: "pool", page: "pool", name: "Pool", cat: "pub", tag: "UK reds and yellows against the regulars.", best: () => num("poolWins") ? num("poolWins") + " frames won" : "" },
    { id: "pong", page: "pong", name: "Beer Pong", cat: "pub", tag: "Flick it in the cups. Get on fire.", best: () => num("pongBest") ? "Best " + num("pongBest") : "" },
    { id: "bowling", page: "bowling", name: "Bottle Bowling", cat: "pub", tag: "Ten-pin with beer bottles. Hook it in.", best: () => num("bowlBest") ? "Best " + num("bowlBest") : "" },
    { id: "quiz", page: "quiz", name: "Pub Quiz", cat: "pub", tag: "A new ten-question quiz every night.", best: quizStatus },
    { id: "cards", page: "cards", name: "Higher or Lower", cat: "pub", tag: "Guess the next card. Aces high.", best: () => num("cardsBest") ? "Best " + num("cardsBest") + " in a row" : "" },
    { id: "barman", page: "barman", name: "Barman Rush", cat: "arcade", tag: "Four bars, one barman. Slide the pints.", best: () => num("barBest") ? "Best " + fmt(num("barBest")) : "" },
    { id: "stack", page: "stack", name: "Pint Stacker", cat: "arcade", tag: "Tap to stack drinks. One wobble and it's over.", best: () => num("stackBest") ? "Best height " + num("stackBest") : "" },
    { id: "pour", page: "pour", name: "Perfect Pour", cat: "arcade", tag: "Hold to pour, stop on the line. Mind the head.", best: () => num("pourBest") ? "Best " + fmt(num("pourBest")) : "" },
    { id: "pop", page: "pop", name: "Pub Pop", cat: "puzzles", tag: "Bubble shooter. Match three, drop the lot.", best: () => num("popLevel") > 1 ? "On level " + num("popLevel") : "" },
    { id: "merge", page: "merge", name: "Snack Merge", cat: "puzzles", tag: "Drop bar snacks. Two the same make a bigger one.", best: () => num("mergeBest") ? "Best " + fmt(num("mergeBest")) : "" },
    { id: "sort", page: "sort", name: "Drink Sort", cat: "puzzles", tag: "Tricky puzzle. One drink per glass.", best: () => num("sortLevel") > 1 ? "On level " + num("sortLevel") : "" },
  ];
  const BY = Object.fromEntries(GAMES.map((g) => [g.id, g]));
  const FEATURED = ["mega", "crush", "flying", "goggles", "slots"];
  const CATS = [["arcade", "Arcade"], ["pub", "Pub Games"], ["puzzles", "Puzzles"], ["slots", "Slots"]];
  const art = (g) => `/img/games/${g.page}.webp`, heroArt = (g) => `/img/games/${g.page}-hero.webp`, href = (g) => `/${g.page}.html`;

  // ---------- favourites ----------
  let favs = J("favs", []);
  const isFav = (id) => favs.includes(id);
  function toggleFav(id) { favs = isFav(id) ? favs.filter((x) => x !== id) : [...favs, id]; store.set("favs", JSON.stringify(favs)); document.querySelectorAll(`.fav[data-id="${id}"]`).forEach((b) => { b.classList.toggle("on", isFav(id)); b.setAttribute("aria-pressed", isFav(id)); }); route(true); }
  document.addEventListener("click", (e) => { const b = e.target.closest && e.target.closest(".fav"); if (!b) return; e.preventDefault(); e.stopPropagation(); toggleFav(b.dataset.id); buzz(10); }, true);   // capture phase, so the heart never opens the game

  const PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l13-7.5z"/></svg>';
  const HEART = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.4-9.2-8.7C1.4 8.4 3.3 5 6.6 5c2 0 3.3 1.1 4 2.3h2.8C14.1 6.1 15.4 5 17.4 5c3.3 0 5.2 3.4 3.8 6.3C19 15.6 12 20 12 20z"/></svg>';
  const CAT_NAME = { arcade: "Arcade", pub: "Pub Game", puzzles: "Puzzle", slots: "Slots" };
  // App-style tile: square artwork, name, then your best (gold) or the category (grey). Press and hold for details.
  function card(g) {
    const st = g.best();
    return `<a class="gc" href="${href(g)}" data-id="${g.id}" draggable="false"><div class="art"><img src="${art(g)}" alt="" width="640" height="480" loading="lazy" decoding="async" draggable="false">${g.isNew ? '<span class="newb">NEW</span>' : ""}${isFav(g.id) ? `<span class="fv">${HEART}</span>` : ""}
      <button class="info" type="button" data-peek="${g.id}" aria-label="About ${esc(g.name)}"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/></svg></button></div>
      <b class="nm">${esc(g.name)}</b><small class="${st ? "gold" : ""}">${st ? esc(st) : CAT_NAME[g.cat]}</small></a>`;
  }

  // ---------- player data ----------
  const realName = () => { const n = store.get("lbName") || ""; return n && !/^Punter \d+$/.test(n) ? n : ""; };
  const plays = () => J("statPlays", {});
  const totalPlays = () => Object.values(plays()).reduce((a, b) => a + b, 0);
  const AV_COLS = [["#4C8DFF", "#8A6CFF"], ["#FF6A8A", "#FF9A3D"], ["#3DD6B0", "#4C8DFF"], ["#FFC64D", "#FF6A3D"], ["#B06CFF", "#FF5AA8"], ["#4CC9FF", "#3D6BFF"]];
  const avBg = (s) => { let h = 0; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; const c = AV_COLS[h % AV_COLS.length]; return `linear-gradient(135deg, ${c[0]}, ${c[1]})`; };
  const initial = (s) => (String(s).trim()[0] || "?").toUpperCase();
  function paintAvatar() { const n = realName(); $("avatarTxt").textContent = n ? initial(n) : "?"; $("avatarBtn").style.background = n ? avBg(n) : ""; }

  // ---------- achievements (worked out from saved scores, never invented) ----------
  const ACH = [
    ["first", "🍺", "First Round", "Play any game", () => totalPlays() >= 1 || GAMES.some((g) => g.best())],
    ["name", "🏷️", "Name on the Board", "Pick a leaderboard nickname", () => !!realName()],
    ["crawl", "🚶", "Pub Crawl", "Play 5 different games", () => Object.keys(plays()).length >= 5],
    ["house", "🏠", "Full House", "Play every game", () => Object.keys(plays()).length >= GAMES.length],
    ["regular", "📅", "The Regular", "Play on 3 different days", () => J("statDays", []).length >= 3],
    ["daily", "✅", "Daily Grind", "Finish 3 daily challenges", () => dcTotal() >= 3],
    ["fly", "🪽", "High Flyer", "Score 20 in Flying Pint", () => num("loBest") >= 20],
    ["goggles", "🥽", "Outrun the Goggles", "Score 250 in Beer Goggles", () => num("bgBest") >= 250],
    ["bull", "🎯", "Oche Hero", "Win a leg of darts", () => num("dWon") >= 1],
    ["pool", "🎱", "Pool Shark", "Win a frame of pool", () => num("poolWins") >= 1],
    ["pong", "🔥", "On Fire", "Score 6 in Beer Pong", () => num("pongBest") >= 6],
    ["strike", "🎳", "Bottle Strike", "Score 100 in Bottle Bowling", () => num("bowlBest") >= 100],
    ["quiz", "🧠", "Quiz Night", "Score 150 in the Pub Quiz", () => num("quizBest") >= 150],
    ["cards", "🃏", "Card Sharp", "Get 7 in a row at Higher or Lower", () => num("cardsBest") >= 7],
    ["barman", "🍻", "Top Barman", "Score 500 in Barman Rush", () => num("barBest") >= 500],
    ["stack", "🗼", "Tower of Pints", "Stack 10 drinks", () => num("stackBest") >= 10],
    ["pour", "🚰", "Perfect Pint", "Score 800 in Perfect Pour", () => num("pourBest") >= 800],
    ["crush", "💥", "Bar Crusher", "Reach level 6 in Bar Crush", () => num("crushLevel") >= 6],
    ["stars", "⭐", "Three Star Night", "Get 3 stars on a Bar Crush level", () => Object.keys(localStorage).some((k) => /^crushStars\d+$/.test(k) && num(k) >= 3)],
    ["pop", "🫧", "Pop Star", "Reach level 5 in Pub Pop", () => num("popLevel") >= 5],
    ["merge", "🥙", "Snack Attack", "Score 1,000 in Snack Merge", () => num("mergeBest") >= 1000],
    ["sort", "🧪", "Sorted", "Reach level 6 in Drink Sort", () => num("sortLevel") >= 6],
    ["fruit", "🍒", "Lucky Fruit", "Collect a 500 win on Club Fruitie", () => num("slotBest") >= 500],
    ["gold", "🏆", "Golden Touch", "Land a 1,000 win on Golden Pints", () => num("gpBest") >= 1000],
  ];
  let achv = J("achv", {});
  function checkAch(announce) {
    const fresh = [];
    for (const [id, ic, name] of ACH) { let ok = false; try { ok = ACH.find((a) => a[0] === id)[4](); } catch (e) {} if (ok && !achv[id]) { achv[id] = Date.now(); fresh.push([ic, name]); } }
    if (fresh.length) { store.set("achv", JSON.stringify(achv)); if (announce) fresh.forEach(([ic, name], i) => setTimeout(() => achToast(ic, name), 900 + i * 2600)); }
  }
  function achToast(ic, name) { const el = $("achToast"); el.innerHTML = `<em>${ic}</em><span><small>Achievement unlocked</small>${esc(name)}</span>`; el.classList.add("on"); setTimeout(() => el.classList.remove("on"), 2300); }

  // ---------- daily challenges (checked against today's real best scores) ----------
  const DC_POOL = [["flying", 10, "Fly past 10 pubs"], ["flying", 20, "Fly past 20 pubs"], ["goggles", 200, "Score 200 in Beer Goggles"], ["merge", 600, "Score 600 in Snack Merge"],
    ["barman", 200, "Score 200 in Barman Rush"], ["stack", 6, "Stack 6 drinks"], ["bowling", 80, "Bowl 80 or more"], ["pong", 4, "Score 4 in Beer Pong"], ["pour", 500, "Score 500 in Perfect Pour"],
    ["cards", 5, "Get 5 in a row at Higher or Lower"], ["crush", 1, "Beat a Bar Crush level"], ["pop", 1, "Clear a Pub Pop level"], ["sort", 1, "Solve a Drink Sort level"], ["quiz", 1, "Play tonight's Pub Quiz"], ["pool", 1, "Win a frame of pool"]];
  function dailyFor(day) {
    let h = 2166136261; for (const ch of "dc-" + day) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
    const rnd = () => { h = (Math.imul(h, 1664525) + 1013904223) >>> 0; return h / 4294967296; };
    const out = [], used = new Set(); while (out.length < 3) { const c = DC_POOL[Math.floor(rnd() * DC_POOL.length)]; if (used.has(c[0])) continue; used.add(c[0]); out.push(c); } return out;
  }
  function dcState() { const day = today(), best = J("day-" + day, {}); return dailyFor(day).map(([g, goal, text]) => ({ g, goal, text, have: best[g] || 0, done: (best[g] || 0) >= goal })); }
  function dcTotal() { const log = J("dcLog", {}); return Object.values(log).reduce((a, b) => a + b, 0); }
  function logDaily() { const n = dcState().filter((d) => d.done).length, log = J("dcLog", {}); if ((log[today()] || 0) !== n) { log[today()] = n; store.set("dcLog", JSON.stringify(log)); } }

  // ---------- home ----------
  let heroI = 0, heroT = null;
  function renderHome() {
    const h = +new Date().toLocaleString("en-GB", { hour: "numeric", hour12: false, timeZone: "Europe/London" }), part = h < 12 ? "Morning" : h < 18 ? "Afternoon" : "Evening";
    $("hello").textContent = `${part}${realName() ? ", " + realName() : ""}`;
    const dcs = dcState(), done = dcs.filter((d) => d.done).length, got = Object.keys(achv).length;
    $("quick").innerHTML = `<a class="chip" href="#me"><b>${fmt(totalPlays())}</b> games played</a><a class="chip" href="#awards"><span class="dot"></span><b>${got}/${ACH.length}</b> achievements</a><span class="chip"><b>${done}/3</b> daily challenges</span>`;
    // featured carousel
    $("hero").innerHTML = FEATURED.map((id, i) => { const g = BY[id], st = g.best();
      return `<div class="slide ${i === heroI ? "on" : ""}" aria-hidden="${i !== heroI}"><img src="${heroArt(g)}" alt="" ${i ? 'loading="lazy"' : 'fetchpriority="high"'} decoding="async" width="1024" height="576">
        <div class="cap"><span class="tagpill">${g.isNew ? "New · Featured" : "Featured"}</span><h3>${esc(g.name)}</h3><p>${esc(g.hero || g.tag)}</p>
        <div class="capbtns"><a class="play" href="${href(g)}">${PLAY}Play</a>${st ? `<span class="pb">${esc(st)}</span>` : ""}</div></div></div>`; }).join("");
    $("heroDots").innerHTML = FEATURED.map((_, i) => `<button type="button" class="${i === heroI ? "on" : ""}" aria-label="Featured game ${i + 1}" data-i="${i}"></button>`).join("");
    $("heroDots").querySelectorAll("button").forEach((b) => b.addEventListener("click", () => goHero(+b.dataset.i, true)));
    startHero();
    // recently played
    const recent = J("statRecent", []).map((r) => BY[r.g]).filter(Boolean).slice(0, 8);
    $("recentBlock").hidden = !recent.length; $("rowRecent").innerHTML = recent.map((g) => card(g)).join("");
    // daily challenges
    $("dcSub").textContent = done === 3 ? "All done today. Nice one." : "New ones every day at midnight";
    $("daily").innerHTML = dcs.map((d) => { const g = BY[d.g], pct = Math.min(100, Math.round((d.have / d.goal) * 100));
      return `<a class="dc ${d.done ? "done" : ""}" href="${href(g)}"><img src="${art(g)}" alt="" loading="lazy"><div class="dt"><b>${esc(d.text)}</b><span>${esc(g.name)} · ${d.done ? "Complete" : d.goal > 1 ? `Best today ${fmt(d.have)} of ${fmt(d.goal)}` : "Not yet today"}</span><div class="prog"><i style="width:${pct}%"></i></div></div><span class="tick"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 5 5 9-10"/></svg></span></a>`; }).join("");
    renderFavRows();
    $("catRows").innerHTML = CATS.map(([c, label]) => `<section class="block"><div class="bh"><h2>${label}</h2><a class="link" href="#games/${c}">See all</a></div><div class="hrow">${GAMES.filter((g) => g.cat === c).map((g) => card(g)).join("")}</div></section>`).join("");
  }
  function renderFavRows() {
    const f = favs.map((id) => BY[id]).filter(Boolean);
    $("favBlock").hidden = !f.length; $("rowFav").innerHTML = f.map((g) => card(g)).join("");
    $("meFavBlock").hidden = !f.length; $("meFav").innerHTML = f.map((g) => card(g)).join("");
  }
  function goHero(i, user) {
    const slides = $("hero").querySelectorAll(".slide"), dots = $("heroDots").querySelectorAll("button"); if (!slides.length) return;
    heroI = (i + slides.length) % slides.length; slides.forEach((s, k) => { s.classList.toggle("on", k === heroI); s.setAttribute("aria-hidden", k !== heroI); }); dots.forEach((d, k) => d.classList.toggle("on", k === heroI));
    if (user) startHero();
  }
  function startHero() { clearInterval(heroT); if (matchMedia("(prefers-reduced-motion: reduce)").matches) return; heroT = setInterval(() => { if (!document.hidden && view === "home") goHero(heroI + 1); }, 6500); }
  { let x0 = null; const h = $("hero"); h.addEventListener("pointerdown", (e) => { x0 = e.clientX; }); h.addEventListener("pointerup", (e) => { if (x0 == null) return; const dx = e.clientX - x0; x0 = null; if (Math.abs(dx) > 40) goHero(heroI + (dx < 0 ? 1 : -1), true); }); }

  // ---------- all games ----------
  let filter = "all";
  function renderGames(f) {
    if (f) filter = f;
    const opts = [["all", "All"], ...CATS, ["fav", "Favourites"]];
    $("filters").innerHTML = opts.map(([k, l]) => `<button type="button" role="tab" class="${k === filter ? "on" : ""}" data-f="${k}">${l}</button>`).join("");
    $("filters").querySelectorAll("button").forEach((b) => b.addEventListener("click", () => { location.hash = b.dataset.f === "all" ? "#games" : "#games/" + b.dataset.f; }));
    const list = GAMES.filter((g) => filter === "all" || (filter === "fav" ? isFav(g.id) : g.cat === filter));
    $("allGrid").innerHTML = list.length ? list.map((g) => card(g)).join("") : `<p class="msg" style="grid-column:1/-1">Tap the heart on any game to add it to your favourites.</p>`;
  }

  // ---------- leaderboards ----------
  let boardGame = "flying", period = "today";
  const cacheLB = {};
  function renderBoardsShell(g) {
    if (g && BY[g]) boardGame = g;
    $("gpick").innerHTML = GAMES.map((x) => `<button type="button" role="tab" class="${x.id === boardGame ? "on" : ""}" data-g="${x.id}"><img src="${art(x)}" alt="" loading="lazy">${esc(x.name)}</button>`).join("");
    $("gpick").querySelectorAll("button").forEach((b) => b.addEventListener("click", () => { location.hash = "#boards/" + b.dataset.g; }));
    const on = $("gpick").querySelector(".on"); if (on) on.scrollIntoView({ block: "nearest", inline: "center" });
    loadBoard();
  }
  document.querySelectorAll(".seg button").forEach((b) => b.addEventListener("click", () => { period = b.dataset.p; document.querySelectorAll(".seg button").forEach((x) => x.classList.toggle("on", x === b)); loadBoard(); }));
  async function loadBoard() {
    const key = boardGame + "|" + period, el = $("board"), unit = PUB.UNITS[boardGame] ? " " + PUB.UNITS[boardGame] : "";
    const cached = cacheLB[key];
    if (cached && Date.now() - cached.t < 60000) return drawBoard(cached.j, unit);
    el.innerHTML = `<div class="list" style="margin-top:22px">${Array.from({ length: 6 }, () => '<div class="skel"></div>').join("")}</div><p class="msg">Loading… the free scoreboard can take up to a minute to wake up.</p>`;
    try { const j = await PUB.api(`/api/top?game=${boardGame}&period=${period}&id=${PUB.playerId()}`); cacheLB[key] = { j, t: Date.now() }; if (key === boardGame + "|" + period) drawBoard(j, unit); }
    catch (e) { if (key === boardGame + "|" + period) el.innerHTML = `<p class="msg">Couldn't reach the scoreboard just now. Your scores are safe on your phone and get sent next time.</p>`; }
  }
  function drawBoard(j, unit) {
    const el = $("board"), top = j.top || [], g = BY[boardGame];
    if (!top.length) { el.innerHTML = `<p class="msg">No scores ${period === "today" ? "today" : "yet"} on ${esc(g.name)}. Be the first!<br><br><a class="play" href="${href(g)}">${PLAY}Play ${esc(g.name)}</a></p>`; return; }
    const pod = [top[1], top[0], top[2]].map((r, i) => r ? `<div class="pd p${[2, 1, 3][i]} ${r.me ? "me" : ""}"><div class="av" style="background:${[2, 1, 3][i] === 1 ? "" : ""}">${esc(initial(r.n))}<em>${r.r}</em></div><b>${esc(r.n)}${r.me ? " (you)" : ""}</b><span>${fmt(r.s)}</span><div class="step"></div></div>` : `<div class="pd"></div>`).join("");
    const rest = top.slice(3).map((r, i) => `<div class="pc ${r.me ? "me" : ""}" style="animation-delay:${Math.min(i, 12) * 0.03}s"><span class="rk">${r.r}</span><span class="av" style="background:${avBg(r.n)}">${esc(initial(r.n))}</span><b>${esc(r.n)}${r.me ? " (you)" : ""}</b><span>${fmt(r.s)}</span></div>`).join("");
    const meShown = top.some((r) => r.me);
    const you = j.you && !meShown ? `<div class="youbar"><div class="pc me"><span class="rk">${j.you.r}</span><span class="av" style="background:${avBg(realName() || "you")}">${esc(initial(realName() || "Y"))}</span><b>You</b><span>${fmt(j.you.s)}</span></div></div>` : "";
    el.innerHTML = `<div class="podium">${pod}</div><div class="list">${rest}</div>${you}<p class="msg" style="padding-top:14px">${fmt(j.total || top.length)} player${(j.total || top.length) === 1 ? "" : "s"} ${period === "today" ? "today" : "all time"}${unit ? " ·" + unit : ""}</p>`;
  }

  // ---------- achievements view ----------
  function renderAwards() {
    const got = ACH.filter((a) => achv[a[0]]), n = got.length, pct = n / ACH.length, R = 30, C = 2 * Math.PI * R;
    $("awCount").textContent = `${n} of ${ACH.length} unlocked`; $("awSub").textContent = `${Math.round(pct * 100)}%`;
    $("awRing").innerHTML = `<svg viewBox="0 0 72 72" style="width:72px;height:72px"><circle cx="36" cy="36" r="${R}" stroke="rgba(150,170,255,.15)" stroke-width="7"/><circle cx="36" cy="36" r="${R}" stroke="url(#rg)" stroke-width="7" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - pct)}" transform="rotate(-90 36 36)" style="transition:stroke-dashoffset 1s"/><defs><linearGradient id="rg"><stop offset="0" stop-color="#4C8DFF"/><stop offset="1" stop-color="#FFC64D"/></linearGradient></defs></svg>`;
    const recent = got.slice().sort((a, b) => achv[b[0]] - achv[a[0]]).slice(0, 6);
    $("awRecentBlock").hidden = !recent.length;
    const tile = (a) => { const t = achv[a[0]]; return `<div class="aw ${t ? "got" : ""}"><span class="ic">${a[1]}</span><b>${esc(a[2])}</b><span>${esc(a[3])}</span><small>${t ? "Unlocked " + new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "Locked"}</small></div>`; };
    $("awRecent").innerHTML = recent.map(tile).join("");
    $("awGrid").innerHTML = ACH.slice().sort((a, b) => (achv[b[0]] ? 1 : 0) - (achv[a[0]] ? 1 : 0)).map(tile).join("");
  }

  // ---------- profile ----------
  function renderMe() {
    const n = realName(); $("meName").textContent = n || "Player"; $("meAvatar").textContent = n ? initial(n) : "?"; $("meAvatar").style.background = n ? avBg(n) : "";
    $("meName2").textContent = n ? "Change name" : "Pick a name";
    const p = plays();
    $("meStats").innerHTML = [[fmt(totalPlays()), "Games played"], [Object.keys(p).length + " of " + GAMES.length, "Different games"], [J("statDays", []).length, "Days played"], [Object.keys(achv).length + " of " + ACH.length, "Achievements"]].map(([v, l]) => `<div class="st"><b>${v}</b><span>${l}</span></div>`).join("");
    const since = store.get("statSince"); $("meSince").textContent = since ? `Play counts started on ${new Date(since + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}. Scores go back further.` : "Play counts start from your next game.";
    $("meBests").innerHTML = GAMES.map((g) => { const st = g.best(); return `<a class="bst" href="${href(g)}"><img src="${art(g)}" alt="" loading="lazy"><b>${esc(g.name)}</b><span class="${st ? "" : "dim"}">${st ? esc(st) : "Not played yet"}</span></a>`; }).join("");
    renderFavRows();
  }

  // ---------- name sheet ----------
  function openName() { $("nameIn").value = realName(); $("nameErr").textContent = ""; $("nameSheet").hidden = false; setTimeout(() => $("nameIn").focus(), 200); }
  $("nameBtn").addEventListener("click", openName); $("meName2").addEventListener("click", openName);
  $("nameCancel").addEventListener("click", () => ($("nameSheet").hidden = true)); $("nameSheet").addEventListener("click", (e) => { if (e.target === $("nameSheet")) $("nameSheet").hidden = true; });
  $("nameSave").addEventListener("click", async () => {
    const n = $("nameIn").value.replace(/\s+/g, " ").trim(), E = $("nameErr"); if (n.length < 2) { E.textContent = "At least 2 letters, go on."; return; }
    E.textContent = "Saving…"; $("nameSave").disabled = true;
    try { const j = await Promise.race([PUB.api("/api/name", { id: PUB.playerId(), name: n }), new Promise((_, rej) => setTimeout(() => rej({ slow: true }), 8000))]); store.set("lbName", j.name); store.set("lbNamePending", "0"); }
    catch (e) { if (e && (e.status === 400 || e.status === 409)) { E.textContent = e.message; $("nameSave").disabled = false; return; } store.set("lbName", n); store.set("lbNamePending", "1"); }
    store.set("nameAsked", "1"); $("nameSave").disabled = false; $("nameSheet").hidden = true; for (const k in cacheLB) delete cacheLB[k];
    paintAvatar(); checkAch(true); route();
  });

  // ---------- search ----------
  $("searchBtn").addEventListener("click", () => { const box = $("searchbox"); box.hidden = !box.hidden; if (!box.hidden) { $("q").value = ""; runSearch(); setTimeout(() => $("q").focus(), 50); } });
  $("q").addEventListener("input", runSearch);
  function runSearch() {
    const q = $("q").value.trim().toLowerCase(), catName = Object.fromEntries(CATS);
    const list = GAMES.filter((g) => !q || (g.name + " " + g.tag + " " + catName[g.cat]).toLowerCase().includes(q));
    $("sresults").innerHTML = list.length ? list.map((g) => card(g)).join("") : `<p class="empty">Nothing called "${esc(q)}" behind the bar.</p>`;
  }

  // ---------- routing (each tab keeps its own scroll position, like an app) ----------
  let view = "home";
  try { history.scrollRestoration = "manual"; } catch (e) {}
  const scrollMem = {}, TITLES = { home: "", games: "Games", boards: "Leaderboards", awards: "Achievements", me: "Profile" };
  function route(keep) {
    const [v, arg] = (location.hash.replace("#", "") || "home").split("/"), name = ["home", "games", "boards", "awards", "me"].includes(v) ? v : "home";
    const changed = name !== view, y = scrollY;
    view = name;
    document.querySelectorAll(".view").forEach((s) => { const on = s.id === "v-" + name; if (on && s.hidden) { s.hidden = false; s.style.animation = "none"; void s.offsetWidth; s.style.animation = ""; } else if (!on) s.hidden = true; });
    document.querySelectorAll(".tabs a").forEach((a) => { const on = a.dataset.v === name; a.classList.toggle("on", on); if (on) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
    $("searchbox").hidden = true; $("barTitle").textContent = TITLES[name];
    if (name === "home") renderHome(); else if (name === "games") renderGames(arg || "all"); else if (name === "boards") renderBoardsShell(arg); else if (name === "awards") renderAwards(); else renderMe();
    if (changed) scrollTo(0, arg ? 0 : scrollMem[name] || 0); else if (keep === true) scrollTo(0, y);
    onScroll();
  }
  addEventListener("hashchange", () => route());
  // Tabs: Home is the root. Back from any tab goes Home, then out of the app, rather than through every tab you visited.
  document.querySelectorAll(".tabs a").forEach((a) => a.addEventListener("click", (e) => {
    e.preventDefault(); buzz(8);
    const to = a.dataset.v;
    if (to === view) { scrollTo({ top: 0, behavior: "smooth" }); return; }           // tap the tab you're on: back to the top
    if (to === "home") { if (history.state && history.state.tab) { history.back(); return; } history.replaceState(null, "", location.pathname); route(); return; }
    if (view === "home") history.pushState({ tab: 1 }, "", "#" + to); else history.replaceState({ tab: 1 }, "", "#" + to);
    route();
  }));
  // The top bar: brand on Home; on other tabs the big title moves up into the bar as you scroll.
  function onScroll() { const y = scrollY; if (!document.getElementById("v-" + view).hidden) scrollMem[view] = y; $("topbar").classList.toggle("scrolled", y > 4); $("topbar").classList.toggle("titled", view !== "home" && y > 34); }
  addEventListener("scroll", onScroll, { passive: true });

  // ---------- feel: haptics, press-and-hold preview, zoom into the game ----------
  function buzz(ms) { try { if (navigator.vibrate && !PUB.REDUCED) navigator.vibrate(ms); } catch (e) {} }
  let peekId = null;
  function peek(id) {
    const g = BY[id]; if (!g) return; peekId = id; buzz(14);
    const st = g.best(), n = plays()[id] || 0;
    $("pkArt").src = heroArt(g); $("pkName").textContent = g.name; $("pkCat").textContent = CAT_NAME[g.cat] + (g.isNew ? " · New" : "");
    $("pkText").textContent = g.hero || g.tag;
    $("pkStats").innerHTML = `<div><b>${st ? esc(st) : "None yet"}</b><span>Your best</span></div><div><b>${n ? fmt(n) : "0"}</b><span>Times played</span></div>`;
    $("pkPlay").href = href(g); $("pkBoard").href = "#boards/" + id;
    const f = $("pkFav"); f.dataset.id = id; f.classList.toggle("on", isFav(id)); f.setAttribute("aria-pressed", isFav(id));
    $("peek").hidden = false; document.body.classList.add("locked");
  }
  function unpeek() { $("peek").hidden = true; document.body.classList.remove("locked"); peekId = null; }
  $("peek").addEventListener("click", (e) => { if (e.target === $("peek") || e.target.closest("#pkClose")) unpeek(); });
  $("pkBoard").addEventListener("click", () => unpeek());
  // Long press (touch) or right-click (desktop) on a tile opens the preview. The "…" button does the same.
  let lpT = null, lpX = 0, lpY = 0, lpFired = false;
  document.addEventListener("pointerdown", (e) => {
    const t = e.target.closest && e.target.closest(".gc"); if (!t || e.button > 0) return;
    lpFired = false; lpX = e.clientX; lpY = e.clientY; t.classList.add("press");
    clearTimeout(lpT); lpT = setTimeout(() => { lpFired = true; t.classList.remove("press"); peek(t.dataset.id); }, 430);
  }, { passive: true });
  const lpCancel = () => { clearTimeout(lpT); document.querySelectorAll(".gc.press").forEach((x) => x.classList.remove("press")); };
  document.addEventListener("pointermove", (e) => { if (Math.hypot(e.clientX - lpX, e.clientY - lpY) > 9) lpCancel(); }, { passive: true });
  document.addEventListener("pointerup", lpCancel, { passive: true }); document.addEventListener("pointercancel", lpCancel, { passive: true });
  document.addEventListener("contextmenu", (e) => { const t = e.target.closest && e.target.closest(".gc"); if (!t) return; e.preventDefault(); if (!lpFired) peek(t.dataset.id); });
  document.addEventListener("click", (e) => {
    if (!e.target.closest) return;
    const info = e.target.closest("[data-peek]"); if (info) { e.preventDefault(); e.stopPropagation(); peek(info.dataset.peek); return; }
    const t = e.target.closest(".gc, #pkPlay, .play, .dc"); if (!t || e.metaKey || e.ctrlKey) return;
    if (lpFired) { e.preventDefault(); e.stopPropagation(); lpFired = false; return; }   // the long press already opened the preview
    const url = t.getAttribute("href"); if (!url || url[0] !== "/") return;
    e.preventDefault(); e.stopPropagation(); buzz(10); launch(t, url);
  }, true);
  // Opening a game: its artwork grows to fill the screen, then the game loads underneath.
  function launch(from, url) {
    const slide = from.closest(".slide"), img = from.querySelector("img") || (slide && slide.querySelector("img")) || ($("peek").hidden ? null : $("pkArt"));
    if (PUB.REDUCED || !img) { location.href = url; return; }
    const r = img.getBoundingClientRect(), z = $("zoom");
    z.style.backgroundImage = `url("${img.currentSrc || img.src}")`;
    Object.assign(z.style, { left: r.left + "px", top: r.top + "px", width: r.width + "px", height: r.height + "px", borderRadius: "18px", opacity: "1" });
    z.hidden = false; void z.offsetWidth; z.classList.add("go");
    Object.assign(z.style, { left: "0px", top: "0px", width: innerWidth + "px", height: innerHeight + "px", borderRadius: "0px" });
    setTimeout(() => (location.href = url), 300);
  }
  addEventListener("pageshow", () => { const z = $("zoom"); z.hidden = true; z.classList.remove("go"); unpeek(); });

  // ---------- get the app ----------
  const standalone = matchMedia("(display-mode: standalone)").matches || matchMedia("(display-mode: fullscreen)").matches || navigator.standalone;
  function showGetApp() { if (standalone) return; let no = 0; try { no = +localStorage.getItem("getAppNo") || 0; } catch (e) {} if (Date.now() - no < 7 * 864e5) return; $("getApp").hidden = false; }
  $("getAppX").addEventListener("click", () => { $("getApp").hidden = true; store.set("getAppNo", String(Date.now())); });

  // ---------- start up ----------
  logDaily(); checkAch(true); paintAvatar(); route();
  if (location.hash && location.hash !== "#home" && !(history.state && history.state.tab)) { const h = location.hash; history.replaceState(null, "", location.pathname); history.pushState({ tab: 1 }, "", h); }   // opened straight on a tab: Back still lands on Home
  addEventListener("pageshow", (e) => { if (e.persisted) { logDaily(); checkAch(true); route(true); } });   // back from a game: refresh bests
  if (store.get("lo18") !== "1") { $("gate").hidden = false; $("yes").addEventListener("click", () => { store.set("lo18", "1"); $("gate").hidden = true; }); $("no").addEventListener("click", () => { $("gateMsg").hidden = false; }); }
  const splash = $("splash"), playSplash = () => { splash.hidden = false; splash.classList.remove("out"); setTimeout(() => splash.classList.add("out"), 1300); setTimeout(() => (splash.hidden = true), 1850); };
  let seen = false; try { seen = sessionStorage.getItem("labSplash") === "1"; sessionStorage.setItem("labSplash", "1"); } catch (e) {}
  if (!seen) playSplash();
  let deferred = null;
  addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferred = e; $("install").hidden = false; $("installTip").hidden = true; showGetApp(); });
  async function install() { if (!deferred) { $("getApp").hidden = true; return; } deferred.prompt(); try { await deferred.userChoice; } catch (e) {} deferred = null; $("install").hidden = true; $("getApp").hidden = true; }
  $("install").addEventListener("click", install); $("getAppGo").addEventListener("click", install);
  addEventListener("appinstalled", () => { $("getApp").hidden = true; $("install").hidden = true; });
  if (standalone) { $("installTip").hidden = true; document.documentElement.classList.add("standalone"); }
})();
