// Pub Empire: a pub property board game for 2 to 4 players (computer regulars or mates on the same phone).
// Robbo's Game Lab. Pretend money only.
(() => {
  "use strict";
  const { $, store } = PUB;
  const SAVE = "empSave";
  const fmt = (n) => "£" + Math.round(n).toLocaleString("en-GB");
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const spd = (ms) => ms * (PUB.REDUCED ? 0.35 : 1);
  const rnd = (n) => Math.floor(Math.random() * n);

  // ---------- the high street ----------
  const GR = { amber: { n: "Amber", c: "#C8873E" }, sky: { n: "Sky", c: "#45ACD6" }, rose: { n: "Rose", c: "#D0607E" }, orange: { n: "Orange", c: "#EE8A3A" },
    red: { n: "Red", c: "#D9443F" }, green: { n: "Green", c: "#3E9E62" }, blue: { n: "Blue", c: "#3D68C9" }, purple: { n: "Purple", c: "#8E5BC9" } };
  const P = (name, g, price) => ({ t: "pub", name, g, price });
  const SQ = [
    { t: "start", name: "First Round", desc: "Collect £200 wages every time you pass." },
    P("The Dog & Duck", "amber", 60), { t: "card", deck: "house", name: "Round on the House" }, P("The Fox & Hounds", "amber", 60),
    { t: "tax", name: "Council Rates", amt: 100, desc: "The council wants its cut. Pay £100 into the Taxi Kitty." },
    { t: "rank", name: "Northside Taxi Rank", price: 200 },
    P("The Railway Arms", "sky", 100), { t: "card", deck: "quiz", name: "Pub Quiz" }, P("The Tipsy Tavern", "sky", 100), P("The Old Brewery", "sky", 120),
    { t: "jail", name: "The Cells", desc: "Just visiting? Keep your nose clean." },
    P("The Red Lion", "rose", 140), { t: "util", name: "The Brewery", price: 150 }, P("The Black Bull", "rose", 140), P("The Crown & Anchor", "rose", 160),
    { t: "rank", name: "West End Taxi Rank", price: 200 },
    P("The Three Pigeons", "orange", 180), { t: "card", deck: "house", name: "Round on the House" }, P("The Final Whistle", "orange", 180), P("The Golden Lion", "orange", 200),
    { t: "taxi", name: "Free Taxi Home", desc: "A safe ride home. Land here to scoop the Taxi Kitty." },
    P("The Barrel & Bottle", "red", 220), { t: "card", deck: "quiz", name: "Pub Quiz" }, P("The Drunken Duck", "red", 220), P("The Last Orders", "red", 240),
    { t: "rank", name: "Southbank Taxi Rank", price: 200 },
    P("The Yorkshire Tap", "green", 260), P("The King's Head", "green", 260), { t: "util", name: "The Jukebox", price: 150 }, P("The Grandstand", "green", 280),
    { t: "goJail", name: "Drink-Driving Checkpoint", desc: "Drink-driving is no joke. Straight to The Cells, and no £200." },
    P("The King's Arms", "blue", 300), P("The Crown", "blue", 300), { t: "card", deck: "quiz", name: "Pub Quiz" }, P("The Grand Hotel", "blue", 320),
    { t: "rank", name: "Eastgate Taxi Rank", price: 200 },
    P("The VIP Lounge", "purple", 350), { t: "card", deck: "house", name: "Round on the House" }, P("The Rooftop Bar", "purple", 380), P("The Penthouse", "purple", 400),
  ];
  const UPN = ["Beer garden", "Big screen", "Function room", "Late licence", "Superpub"];
  const MULT = [5, 15, 35, 45, 55];
  const buyable = (i) => ["pub", "rank", "util"].includes(SQ[i].t);
  const base = (i) => Math.max(4, Math.round(SQ[i].price / 10));
  const buildCost = (i) => (i < 10 ? 50 : i < 20 ? 100 : i < 30 ? 150 : 200);
  const mortVal = (i) => SQ[i].price / 2;
  const unmortCost = (i) => Math.round(SQ[i].price * 0.55);
  const members = (g) => SQ.map((s, i) => (s.g === g ? i : -1)).filter((i) => i >= 0);
  const RANKS = SQ.map((s, i) => (s.t === "rank" ? i : -1)).filter((i) => i >= 0);
  const UTILS = SQ.map((s, i) => (s.t === "util" ? i : -1)).filter((i) => i >= 0);

  // ---------- cards ----------
  const CARDS = {
    house: [
      { ic: "trophy", t: "Pub of the Year", x: "Your local wins the award. Collect £200.", f: { cash: 200 } },
      { ic: "ticket", t: "Meat raffle winner", x: "A tray of sausages and £50. Lovely.", f: { cash: 50 } },
      { ic: "sun", t: "Beer garden weather", x: "Sun's out, every table's full. Collect £100.", f: { cash: 100 } },
      { ic: "music", t: "Broken jukebox", x: "Someone kicked it. Pay £50 for repairs.", f: { cash: -50 } },
      { ic: "glass", t: "Smashed a glass", x: "The whole pub cheers. Pay £20.", f: { cash: -20 } },
      { ic: "cake", t: "It's your birthday!", x: "Everyone gets you a drink in. Collect £10 from every player.", f: { each: 10 } },
      { ic: "chair", t: "You're in the chair", x: "Your round. Pay every player £25.", f: { each: -25 } },
      { ic: "key", t: "Your mate vouches for you", x: "Bail card. Keep it to get out of The Cells for free.", f: { bail: 1 } },
      { ic: "siren", t: "Dancing on the tables", x: "The bouncers aren't impressed. Go straight to The Cells.", f: { jail: 1 } },
      { ic: "taxi", t: "Taxi!", x: "Hop in. Go to the nearest taxi rank.", f: { nearest: 1 } },
      { ic: "pint", t: "Back to the bar", x: "Go to First Round and collect £200.", f: { to: 0 } },
      { ic: "tools", t: "Pest control visit", x: "Pay £25 for every upgrade and £100 for every Superpub you own.", f: { repairs: [25, 100] } },
      { ic: "back", t: "Wrong bus home", x: "Go back 3 spaces.", f: { back: 3 } },
      { ic: "coin", t: "Found a tenner", x: "Down the back of the sofa. Collect £10.", f: { cash: 10 } },
    ],
    quiz: [
      { ic: "star", t: "Picture round sweep", x: "Ten out of ten. Collect £100.", f: { cash: 100 } },
      { ic: "globe", t: "Capital of Peru?", x: "Lima, obviously. Collect £50.", f: { cash: 50 } },
      { ic: "music", t: "Lost on the music round", x: "Nobody knew it was ABBA. Pay £30.", f: { cash: -30 } },
      { ic: "mic", t: "Quiz master's favourite", x: "Collect £20 from every player.", f: { each: 20 } },
      { ic: "pin", t: "Meet at The Red Lion", x: "Go to The Red Lion. Collect £200 if you pass First Round.", f: { to: 11 } },
      { ic: "crown", t: "Penthouse party", x: "You're on the guest list. Go to The Penthouse.", f: { to: 39 } },
      { ic: "taxi", t: "Lift home sorted", x: "Go to Free Taxi Home.", f: { to: 20 } },
      { ic: "key", t: "Team captain's bail", x: "Bail card. Keep it to get out of The Cells for free.", f: { bail: 1 } },
      { ic: "phone", t: "Caught Googling", x: "Phone out during the quiz! Go straight to The Cells.", f: { jail: 1 } },
      { ic: "trophy", t: "Rollover jackpot", x: "Nobody's won it for weeks. Collect £200.", f: { cash: 200 } },
      { ic: "receipt", t: "The tab's on you", x: "The whole team ordered doubles. Pay £75.", f: { cash: -75 } },
      { ic: "tools", t: "Refurb the toilets", x: "Pay £40 for every upgrade and £115 for every Superpub you own.", f: { repairs: [40, 115] } },
      { ic: "taxi", t: "Taxi!", x: "Go to the nearest taxi rank.", f: { nearest: 1 } },
      { ic: "coin", t: "Bonus question", x: "Bang on. Collect £25.", f: { cash: 25 } },
    ],
  };

  // ---------- simple line icons (no emoji art) ----------
  const IC = {
    pint: '<path d="M7 4h10l-1.3 16a1.5 1.5 0 0 1-1.5 1.4H9.8a1.5 1.5 0 0 1-1.5-1.4z"/><path d="M7.4 8.5h9.2"/><path d="M8 4c0-1.2 1-2 2-1.6.6-1 2.6-1 3.2 0 1-.5 2.6.2 2.8 1.6"/>',
    taxi: '<path d="M4 16v-3l2-5h12l2 5v3z"/><path d="M9.5 8 10 5.5h4L14.5 8"/><circle cx="7.5" cy="16.5" r="1.8"/><circle cx="16.5" cy="16.5" r="1.8"/><path d="M4 12.5h16"/>',
    gift: '<rect x="4" y="9" width="16" height="11" rx="1.5"/><path d="M3 9h18v3H3zM12 9v11"/><path d="M12 9c-1.5-3-5.5-4-5.5-1.5S10 9 12 9zm0 0c1.5-3 5.5-4 5.5-1.5S14 9 12 9z"/>',
    quiz: '<path d="M4 5h16v11H11l-4 4v-4H4z"/><path d="M10 8.5a2 2 0 1 1 2.8 1.8c-.6.3-.8.7-.8 1.4M12 13.6v.1"/>',
    receipt: '<path d="M6 3h12v18l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5L6 21z"/><path d="M9 8h6M9 11.5h6M9 15h4"/>',
    barrel: '<ellipse cx="12" cy="5" rx="6" ry="2"/><path d="M6 5c-1 4.5-1 9.5 0 14 0 1.1 2.7 2 6 2s6-.9 6-2c1-4.5 1-9.5 0-14"/><path d="M5.4 9.5c4.4 1.3 8.8 1.3 13.2 0M5.4 14.5c4.4 1.3 8.8 1.3 13.2 0"/>',
    music: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
    bars: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8.5 4v16M12 4v16M15.5 4v16"/>',
    siren: '<path d="M7 18v-6a5 5 0 0 1 10 0v6"/><path d="M4 18h16v3H4zM12 2v2M4.2 5.2l1.4 1.4M19.8 5.2l-1.4 1.4"/>',
    trophy: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4"/>',
    ticket: '<path d="M3 8a2 2 0 0 0 0 4v4h18v-4a2 2 0 0 1 0-4V4H3z" transform="translate(0 2)"/><path d="M14 6v12" stroke-dasharray="2 2"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    glass: '<path d="M6 3h12l-2 9a4 4 0 0 1-8 0z"/><path d="M12 16v5M8 21h8"/><path d="m15 5-3 4 2 1-2 3"/>',
    cake: '<path d="M4 21h16v-8H4z"/><path d="M4 16c2 1.5 4 1.5 5.3 0 1.3 1.5 4 1.5 5.4 0 1.3 1.5 3.3 1.5 5.3 0"/><path d="M8 13V9M12 13V9M16 13V9M8 6.5v.1M12 6.5v.1M16 6.5v.1"/>',
    chair: '<path d="M6 21v-8h12v8M6 13V4h12v9M6 17h12"/>',
    key: '<circle cx="7.5" cy="15.5" r="4.5"/><path d="m10.7 12.3 9.3-9.3M17 6l2.5 2.5M14.5 8.5 16.5 10.5"/>',
    tools: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.2L3 17.8V21h3.2l6.3-6.3a4 4 0 0 0 5.2-5.4l-2.6 2.6-2.4-.6-.6-2.4z"/>',
    back: '<path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',
    coin: '<circle cx="12" cy="12" r="9"/><path d="M14.5 8.5a3 3 0 0 0-5 1.5c0 3 5 2 5 5a3 3 0 0 1-5.2 1.3M12 6v2M12 16v2"/>',
    star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M8 21h8"/>',
    pin: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
    crown: '<path d="m3 8 4.5 4L12 5l4.5 7L21 8l-2 11H5z"/>',
    phone: '<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>',
    start: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
    cash: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.6"/><path d="M6 9.5v.1M18 14.5v.1"/>',
  };
  const svg = (k) => `<svg viewBox="0 0 24 24" aria-hidden="true">${IC[k] || ""}</svg>`;
  const sqIcon = (s) => ({ start: "start", card: s.deck === "quiz" ? "quiz" : "gift", tax: "receipt", rank: "taxi", util: s.name.includes("Jukebox") ? "music" : "barrel", jail: "bars", goJail: "siren", taxi: "taxi" }[s.t] || "pint");

  // ---------- players ----------
  const CHARS = [{ k: "lager", n: "Lager" }, { k: "stout", n: "Stout" }, { k: "wine", n: "Wine" }, { k: "bottle", n: "Bottle" }, { k: "cool", n: "Cool Pint" }];
  const COLORS = ["#FFC64D", "#4C8DFF", "#FF5A8A", "#3DD6B0"];
  const CPUS = [{ name: "Jamie", r: 1, b: 1 }, { name: "Big Dave", r: 0.65, b: 0.8 }, { name: "Shaz", r: 1.35, b: 1.15 }];
  const charImg = (k) => `/img/chars/${k}.webp`;
  const realName = () => { const n = store.get("lbName") || ""; return n && !/^Punter \d+$/.test(n) ? n : ""; };

  // ---------- state ----------
  let S = null;                       // the saved game
  let vis = [];                       // where each token is drawn (may lag behind the model while hopping)
  let forced = null;               // test hook: fix the next roll
  let focus = 0, pending = null, debt = null, moving = false, lastHuman = 0;
  const me = () => S.players[S.cur];
  const alive = () => S.players.filter((p) => !p.out);
  const V = (p, you, them) => (p.you ? you : them);
  const nm = (p) => (p.you ? "You" : p.name);
  const propsOf = (pi) => SQ.map((_, i) => i).filter((i) => S.own[i] === pi);
  const ownsSet = (pi, g) => members(g).every((j) => S.own[j] === pi);
  const worth = (p) => { const pi = S.players.indexOf(p); return p.cash + propsOf(pi).reduce((a, i) => a + (S.mort[i] ? mortVal(i) : SQ[i].price) + S.ups[i] * buildCost(i), 0); };
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  function rentFor(i, dice) {
    const s = SQ[i], o = S.own[i];
    if (s.t === "pub") { const u = S.ups[i]; return u ? base(i) * MULT[u - 1] : base(i) * (ownsSet(o, s.g) ? 2 : 1); }
    if (s.t === "rank") { const n = RANKS.filter((j) => S.own[j] === o).length; return 25 * Math.pow(2, n - 1); }
    if (s.t === "util") { const both = UTILS.every((j) => S.own[j] === o); return (dice[0] + dice[1]) * (both ? 10 : 4); }
    return 0;
  }

  // ---------- sound ----------
  const sfx = {
    tap: () => PUB.pop(1.1),
    step: (k) => PUB.beep(520 + k * 18, 700 + k * 18, 0.05, "sine", 0.035),
    dice: () => { for (let k = 0; k < 7; k++) PUB.noise(0.05, 0.1 + Math.random() * 0.06, 2200 + Math.random() * 2400, k * 0.075, 1.4); setTimeout(() => PUB.thud(), spd(820)); },
    buy: () => { PUB.beep(1568, 1568, 0.07, "square", 0.045); PUB.beep(2093, 2093, 0.28, "square", 0.045, 0.08); PUB.noise(0.18, 0.07, 6500, 0.04); },
    pay: () => { for (let k = 0; k < 4; k++) PUB.beep(2500 - k * 180, 2300 - k * 180, 0.05, "sine", 0.045, k * 0.055); },
    earn: () => { for (let k = 0; k < 4; k++) PUB.beep(1700 + k * 220, 1900 + k * 220, 0.05, "sine", 0.045, k * 0.055); },
    card: () => { PUB.noise(0.14, 0.09, 4200, 0, 1); PUB.pop(0.9, 0.06); },
    jail: () => { for (let k = 0; k < 2; k++) { PUB.beep(680, 1080, 0.24, "square", 0.035, k * 0.5); PUB.beep(1080, 680, 0.24, "square", 0.035, k * 0.5 + 0.25); } },
    build: () => { PUB.thud(); setTimeout(() => PUB.thud(), 120); PUB.beep(1320, 1320, 0.3, "triangle", 0.05, 0.25); PUB.beep(1760, 1760, 0.35, "triangle", 0.04, 0.33); },
    kitty: () => { PUB.cheer(false); sfx.earn(); },
  };
  let musicOn = store.get("empMusic") !== "0";
  const TUNE_CH = [[60, 64, 67], [57, 60, 64], [62, 65, 69], [55, 59, 62], [60, 64, 67], [53, 57, 60], [55, 59, 62], [60, 64, 67]];
  const TUNE = [72, 0, 74, 76, 0, 79, 0, 76, 74, 0, 72, 0, 69, 0, 72, 0, 74, 0, 77, 0, 76, 74, 72, 0, 71, 0, 72, 74, 0, 0, 0, 0,
    72, 0, 74, 76, 0, 79, 0, 81, 79, 0, 76, 0, 77, 0, 76, 74, 72, 0, 69, 0, 71, 72, 74, 0, 72, 0, 0, 0, 0, 0, 0, 0];
  function startMusic() { if (musicOn) PUB.music(TUNE_CH, TUNE, 112); }
  function setMusicBtn() { $("music").classList.toggle("off", !musicOn); $("music").setAttribute("aria-label", musicOn ? "Turn music off" : "Turn music on"); }
  $("music").addEventListener("click", () => { musicOn = !musicOn; store.set("empMusic", musicOn ? "1" : "0"); setMusicBtn(); if (musicOn) { if (S && !S.over) startMusic(); } else PUB.stopMusic(); });
  setMusicBtn(); PUB.wireMute($("mute"));

  // ---------- board building ----------
  const board = $("board");
  function cell(i) { // grid row/col and which side the square sits on
    if (i <= 10) return { r: 11, c: 11 - i, s: i % 10 === 0 ? "c" : "b" };
    if (i <= 20) return { r: 11 - (i - 10), c: 1, s: i === 20 ? "c" : "l" };
    if (i <= 30) return { r: 1, c: 1 + (i - 20), s: i === 30 ? "c" : "t" };
    return { r: 1 + (i - 30), c: 11, s: "r" };
  }
  const SHORT = { start: "First Round", jail: "The Cells", taxi: "Free Taxi", goJail: "Checkpoint" };
  const tiles = [];
  SQ.forEach((s, i) => {
    const c = cell(i), el = document.createElement("div");
    el.className = `tile s-${c.s === "c" ? "b" : c.s} k-${s.t}${s.t === "pub" ? " prop" : ""}${["pub", "rank", "util"].includes(s.t) ? " buy" : ""}${c.s === "c" ? " corner" : ""}`;
    el.style.gridRow = c.r; el.style.gridColumn = c.c; el.dataset.i = i;
    el.setAttribute("role", "button"); el.setAttribute("aria-label", s.name);
    el.innerHTML = (s.t === "pub" ? `<span class="band" style="--g:${GR[s.g].c}"></span>` : svg(sqIcon(s))) + `<span class="nm">${esc(SHORT[s.t] || s.name.replace(/^The /, ""))}</span>` + (s.price ? `<span class="pr">${fmt(s.price)}</span>` : "") + `<span class="own"></span><span class="ups"></span>`;
    board.insertBefore(el, $("centre")); tiles.push(el);
  });
  board.addEventListener("click", (e) => { const t = e.target.closest(".tile"); if (!t) return; focusSq(+t.dataset.i, true); sfx.tap(); });

  // dice faces
  const PIPS = { 1: [5], 2: [1, 9], 3: [1, 5, 9], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] };
  for (const d of [$("d1"), $("d2")]) d.innerHTML = [1, 2, 3, 4, 5, 6].map((n) => `<div class="f f${n}">${PIPS[n].map((p) => `<i style="grid-area:${Math.ceil(p / 3)} / ${((p - 1) % 3) + 1}"></i>`).join("")}</div>`).join("");
  const FACE = { 1: [0, 0], 2: [0, -90], 3: [-90, 0], 4: [90, 0], 5: [0, 90], 6: [0, 180] };
  const spin = [[0, 0], [0, 0]];
  function showDice(a, b, instant) {
    [a, b].forEach((v, k) => { const d = $(k ? "d2" : "d1"), [fx, fy] = FACE[v]; if (!instant) { spin[k][0] += 360 * (1 + rnd(2)); spin[k][1] += 360 * (1 + rnd(2)); }
      d.style.transition = instant ? "none" : ""; d.style.transform = `rotateX(${-18 + fx + spin[k][0]}deg) rotateY(${22 + fy + spin[k][1]}deg)`; });
  }
  async function rollDice() {
    const a = forced ? forced[0] : 1 + rnd(6), b = forced ? forced[1] : 1 + rnd(6); forced = null; S.dice = [a, b]; sfx.dice(); $("dice").classList.add("shadow"); showDice(a, b); await sleep(spd(1050)); return [a, b];
  }

  // ---------- rendering ----------
  function render() {
    if (!S) return;
    const n = S.players.length;
    $("players").classList.toggle("four", n >= 4);
    $("players").innerHTML = S.players.map((p, k) => `<div class="pchip${k === S.cur && !S.over ? " on" : ""}${p.out ? " out" : ""}" style="--pc:${p.color}"><img src="${charImg(p.char)}" alt=""><div><b>${esc(p.name)}</b><span data-cash="${k}">${p.out ? "BUST" : fmt(p.cash)}</span></div>${p.jail && !p.out ? '<em class="jailtag">CELLS</em>' : ""}</div>`).join("");
    $("roundTxt").textContent = S.over ? "Game over" : `Round ${S.round}${S.len ? " of " + S.len : ""}${S.kitty ? " · Kitty " + fmt(S.kitty) : ""}`;
    tiles.forEach((el, i) => {
      if (!buyable(i)) return;
      const o = S.own[i]; el.classList.toggle("owned", o >= 0 && !S.mort[i]); el.classList.toggle("mort", !!S.mort[i]);
      el.style.setProperty("--oc", o >= 0 ? S.players[o].color : "transparent");
      el.style.setProperty("--uw", el.clientWidth + "px");
      el.querySelector(".ups").innerHTML = S.ups[i] === 5 ? '<i class="sp"></i>' : "<i></i>".repeat(S.ups[i]);
    });
    placeTokens(); drawTurn(); drawActs(); renderDeed(); renderLog();
    $("mineBtn").disabled = !S.players.some((p) => !p.cpu && !p.out);
    if (!$("mine").hidden) renderMine();
  }
  function placeTokens() {
    const box = $("tokens"); if (!S) { box.innerHTML = ""; return; }
    if (box.children.length !== S.players.length) box.innerHTML = S.players.map((p, k) => `<div class="tok" data-k="${k}" style="--pc:${p.color}"><img src="${charImg(p.char)}" alt=""></div>`).join("");
    const bw = board.clientWidth, u = bw / 11.9, tw = u * 0.72;
    const groups = {}; S.players.forEach((p, k) => { if (!p.out) (groups[vis[k]] = groups[vis[k]] || []).push(k); });
    const OFF = [[0, 0], [0.3, -0.2], [-0.3, 0.2], [0.3, 0.22]];
    [...box.children].forEach((el) => {
      const k = +el.dataset.k, p = S.players[k]; el.hidden = p.out; if (p.out) return;
      const t = tiles[vis[k]], g = groups[vis[k]], idx = g.indexOf(k), o = g.length > 1 ? OFF[idx] : OFF[0];
      const x = t.offsetLeft + t.offsetWidth / 2 - tw / 2 + o[0] * u, y = t.offsetTop + t.offsetHeight / 2 - tw / 2 + o[1] * u;
      el.style.transform = `translate(${x}px, ${y}px)`; el.classList.toggle("cur", k === S.cur && !S.over);
    });
  }
  addEventListener("resize", () => render());
  function drawTurn() {
    const p = me(); if (!p) return;
    $("turnTxt").innerHTML = S.over ? "" : `<img src="${charImg(p.char)}" alt=""><span style="--pc:${p.color}">${p.you ? "<b>Your</b> turn" : `<b>${esc(p.name)}</b>'s turn`}</span>`;
  }
  function msg(html) { $("msg").innerHTML = `<span>${html}</span>`; }
  function log(html, p) { S.log.unshift({ h: html, c: p ? p.color : "#888" }); S.log.length = Math.min(S.log.length, 40); renderLog(); }
  function renderLog() { $("log").innerHTML = S.log.map((l) => `<li style="--pc:${l.c}"><i></i><span>${l.h}</span></li>`).join(""); }
  function flash(p, delta) { const k = S.players.indexOf(p), el = document.querySelector(`[data-cash="${k}"]`); render(); const e2 = document.querySelector(`[data-cash="${k}"]`); if (!e2) return; e2.classList.add(delta >= 0 ? "up" : "down"); setTimeout(() => e2.classList.remove("up", "down"), 700); }

  function focusSq(i, user) {
    focus = i; tiles.forEach((t, k) => t.classList.toggle("focus", k === i)); renderDeed();
    if (user && innerWidth < 900) { const d = $("deed"), r = d.getBoundingClientRect(); if (r.top > innerHeight - 120) d.scrollIntoView({ behavior: "smooth", block: "nearest" }); }
  }
  function renderDeed() {
    const i = focus, s = SQ[i], el = $("deed"); if (!S) return;
    const o = S.own[i], owner = o >= 0 ? S.players[o] : null;
    let head = "", body = "";
    const ownerLine = owner ? `<div class="downer" style="--oc:${owner.color}"><img src="${charImg(owner.char)}" alt=""><span>${owner.you ? "Yours" : "Owned by " + esc(owner.name)}${S.mort[i] ? " · <b>mortgaged</b>" : ""}</span></div>` : buyable(i) ? `<div class="downer"><span>For sale · <b>${fmt(s.price)}</b></span></div>` : "";
    if (s.t === "pub") {
      const g = GR[s.g], u = S.ups[i], set = o >= 0 && ownsSet(o, s.g), lvl = o < 0 || S.mort[i] ? -1 : u ? u + 1 : set ? 1 : 0;
      const rows = [["Round (rent)", base(i)], ["With the full " + g.n + " set", base(i) * 2], ...UPN.map((n, k) => [n, base(i) * MULT[k]])];
      head = `<div class="dh" style="--g:${g.c}"><small>${g.n} set · ${fmt(s.price)}</small><b>${esc(s.name)}</b></div>`;
      body = `<table>${rows.map((r, k) => `<tr class="${k === lvl ? "now" : ""}"><td>${r[0]}</td><td>${fmt(r[1])}</td></tr>`).join("")}</table><p class="dnote">Upgrades ${fmt(buildCost(i))} each · Mortgage ${fmt(mortVal(i))}</p>${ownerLine}`;
    } else if (s.t === "rank") {
      const n = o >= 0 ? RANKS.filter((j) => S.own[j] === o).length : 0;
      head = `<div class="dh" style="--g:#2B2B2B"><small>Taxi rank · ${fmt(s.price)}</small><b>${esc(s.name)}</b></div>`;
      body = `<table>${[1, 2, 3, 4].map((k) => `<tr class="${k === n && !S.mort[i] ? "now" : ""}"><td>Own ${k} rank${k > 1 ? "s" : ""}</td><td>${fmt(25 * Math.pow(2, k - 1))}</td></tr>`).join("")}</table><p class="dnote">Mortgage ${fmt(mortVal(i))}</p>${ownerLine}`;
    } else if (s.t === "util") {
      head = `<div class="dh" style="--g:#5A4632"><small>Local business · ${fmt(s.price)}</small><b>${esc(s.name)}</b></div>`;
      body = `<p class="dtext">Anyone landing here pays <b>4× their dice roll</b>, or <b>10×</b> if the same person owns both The Brewery and The Jukebox.</p><p class="dnote">Mortgage ${fmt(mortVal(i))}</p>${ownerLine}`;
    } else {
      const cols = { start: "#B98A1C", card: s.deck === "quiz" ? "#5A3FC0" : "#8A5A10", tax: "#A23A3A", jail: "#4A5578", goJail: "#C0392B", taxi: "#B99A10" };
      let extra = "";
      if (s.t === "taxi") extra = `<p class="dnote">Taxi Kitty right now: <b>${fmt(S.kitty)}</b></p>`;
      if (s.t === "jail") { const inside = S.players.filter((p) => p.jail && !p.out).map((p) => esc(p.name)); extra = `<p class="dnote">${inside.length ? "Inside: " + inside.join(", ") : "Nobody's in at the moment."} Pay £50, use a Bail card or roll doubles to get out.</p>`; }
      if (s.t === "card") extra = `<p class="dnote">Draw a ${esc(s.name)} card. Could be good, could be your round.</p>`;
      head = `<div class="dh" style="--g:${cols[s.t]}"><small>${{ start: "Corner", card: "Card", tax: "Bill", jail: "Corner", goJail: "Corner", taxi: "Corner" }[s.t]}</small><b>${esc(s.name)}</b></div>`;
      body = `<p class="dtext">${esc(s.desc || "")}</p>${extra}`;
    }
    el.innerHTML = head + `<div class="db">${body}</div>`;
  }

  // ---------- turn input ----------
  function ask(opts) { return new Promise((res) => { pending = { opts, res }; drawActs(); if (!$("mine").hidden) renderMine(); }); }
  function answer(k) { if (!pending) return; const o = pending.opts.find((x) => x.k === k); if (!o || (o.dis && o.dis())) return; const r = pending.res; pending = null; sfx.tap(); drawActs(); r(k); }
  function drawActs() {
    const el = $("acts"); if (!S) return;
    if (S.over) { el.innerHTML = ""; return; }
    if (!pending) { el.innerHTML = me().cpu && !moving ? '<div class="thinking"><span>' + esc(me().name) + ' is thinking</span><i></i><i></i><i></i></div>' : ""; return; }
    el.innerHTML = pending.opts.map((o) => `<button type="button" class="abtn ${o.cls || ""}" data-k="${o.k}"${o.dis && o.dis() ? " disabled" : ""}>${o.label}</button>`).join("");
  }
  $("acts").addEventListener("click", (e) => { const b = e.target.closest("[data-k]"); if (b) answer(b.dataset.k); });

  // ---------- money and property actions ----------
  function gain(p, amt) { p.cash += amt; flash(p, amt); }
  function buy(p, i) { p.cash -= SQ[i].price; S.own[i] = S.players.indexOf(p); sfx.buy(); log(`<b>${esc(nm(p))}</b> bought ${esc(SQ[i].name)} for ${fmt(SQ[i].price)}`, p); flash(p, -SQ[i].price); }
  const canUpgrade = (pi, i) => { const s = SQ[i]; if (s.t !== "pub" || S.own[i] !== pi || !ownsSet(pi, s.g)) return false; const g = members(s.g); if (g.some((j) => S.mort[j])) return false; const mn = Math.min(...g.map((j) => S.ups[j])); return S.ups[i] < 5 && S.ups[i] === mn; };
  const canSell = (pi, i) => { const s = SQ[i]; if (s.t !== "pub" || S.own[i] !== pi || !S.ups[i]) return false; const mx = Math.max(...members(s.g).map((j) => S.ups[j])); return S.ups[i] === mx; };
  const canMort = (pi, i) => S.own[i] === pi && !S.mort[i] && (SQ[i].t !== "pub" || members(SQ[i].g).every((j) => !S.ups[j]));
  function upgrade(p, i) {
    p.cash -= buildCost(i); S.ups[i]++; sfx.build();
    log(`<b>${esc(nm(p))}</b> added a ${UPN[S.ups[i] - 1].toLowerCase()} to ${esc(SQ[i].name)}`, p);
    if (S.ups[i] === 5) { if (!p.cpu) store.set("empSuper", "1"); PUB.toast(`🏆 <b>${esc(SQ[i].name)}</b> is now a Superpub!`, 1800); }
    flash(p, -buildCost(i));
  }
  function sellUp(p, i) { const v = buildCost(i) / 2; S.ups[i]--; p.cash += v; log(`<b>${esc(nm(p))}</b> sold an upgrade at ${esc(SQ[i].name)} for ${fmt(v)}`, p); flash(p, v); }
  function mortgage(p, i) { S.mort[i] = true; p.cash += mortVal(i); log(`<b>${esc(nm(p))}</b> mortgaged ${esc(SQ[i].name)} for ${fmt(mortVal(i))}`, p); flash(p, mortVal(i)); }
  function unmortgage(p, i) { const c = unmortCost(i); S.mort[i] = false; p.cash -= c; log(`<b>${esc(nm(p))}</b> paid off ${esc(SQ[i].name)} (${fmt(c)})`, p); flash(p, -c); }

  async function pay(p, amt, to, why) {
    amt = Math.round(amt); if (amt <= 0) return true;
    if (p.cash < amt) { const ok = await raise(p, amt, to, why); if (!ok) { await bust(p, to); return false; } }
    p.cash -= amt;
    if (to === "kitty") S.kitty += amt; else if (typeof to === "number") S.players[to].cash += amt;
    sfx.pay(); flash(p, -amt); if (typeof to === "number") flash(S.players[to], amt);
    return true;
  }
  async function raise(p, amt, to, why) {
    if (p.cpu || p !== me()) { cpuRaise(p, amt); return p.cash >= amt; }   // someone paying out of turn sells/mortgages automatically
    debt = { amt, to, why, p };
    msg(`${p.you ? "You owe" : esc(p.name) + " owes"} <b>${fmt(amt)}</b> for ${esc(why)}. Sell upgrades or mortgage pubs to raise it.`);
    openMine();
    const a = await ask([{ k: "pay", label: `Pay ${fmt(amt)}`, cls: "go", dis: () => p.cash < amt }, { k: "bust", label: "Go bust", cls: "sec" }]);
    debt = null; closeMine();
    return a === "pay";
  }
  async function bust(p, to) {
    const pi = S.players.indexOf(p), cred = typeof to === "number" ? S.players[to] : null;
    let upCash = 0;
    for (const i of propsOf(pi)) { upCash += (S.ups[i] * buildCost(i)) / 2; S.ups[i] = 0; if (cred) S.own[i] = to; else { S.own[i] = -1; S.mort[i] = false; } }
    if (cred) cred.cash += p.cash + upCash;
    for (const d of p.bail) S.decks[d].push(CARDS[d].findIndex((c) => c.f.bail));
    p.bail = []; p.cash = 0; p.out = true; p.jail = 0;
    log(`<b>${esc(nm(p))}</b> ${V(p, "are", "is")} bust${cred ? ` and ${esc(cred.name)} takes the lot` : ""}`, p);
    PUB.sad(); render();
    await popup({ deck: "BUST", ic: "receipt", t: p.you ? "You're bust!" : `${p.name} is bust!`, x: cred ? `Everything goes to ${cred.you ? "you" : cred.name}.` : "Their pubs go back on the market.", quick: p.cpu });
    if (alive().length <= 1) gameOver("bust");
  }

  // ---------- computer regulars ----------
  const reserve = (p) => Math.min(70 + S.round * 13, 340) * p.pers.r;
  function cpuWantsBuy(p, i) {
    const s = SQ[i], pi = S.players.indexOf(p); if (p.cash < s.price) return false;
    const left = p.cash - s.price;
    if (s.t === "pub") {
      const g = members(s.g), mine = g.filter((j) => S.own[j] === pi).length, others = g.filter((j) => S.own[j] >= 0 && S.own[j] !== pi);
      if (mine === g.length - 1) return true;                                           // completes a set
      if (others.length === g.length - 1 && new Set(others.map((j) => S.own[j])).size === 1 && left >= 40) return true; // blocks a set
      if (mine > 0 && left >= reserve(p) * 0.6) return true;
    }
    if (s.t === "rank" && RANKS.some((j) => S.own[j] === pi) && left >= reserve(p) * 0.7) return true;
    return left >= reserve(p);
  }
  function cpuManage(p) {
    const pi = S.players.indexOf(p);
    for (const i of propsOf(pi).filter((i) => S.mort[i]).sort((a, b) => SQ[b].price - SQ[a].price)) if (p.cash - unmortCost(i) >= reserve(p) * 1.5) unmortgage(p, i);
    let built = true, guard = 0;
    while (built && guard++ < 40) {
      built = false;
      const sets = Object.keys(GR).filter((g) => ownsSet(pi, g)).sort((a, b) => SQ[members(b)[0]].price - SQ[members(a)[0]].price);
      for (const g of sets) { const j = members(g).find((x) => canUpgrade(pi, x)); if (j != null && p.cash - buildCost(j) >= reserve(p) * p.pers.b) { upgrade(p, j); built = true; } }
    }
  }
  function cpuRaise(p, amt) {
    const pi = S.players.indexOf(p); let guard = 0;
    while (p.cash < amt && guard++ < 80) {
      const sell = propsOf(pi).filter((i) => canSell(pi, i)).sort((a, b) => SQ[a].price - SQ[b].price)[0];
      if (sell != null) { sellUp(p, sell); continue; }
      const m = propsOf(pi).filter((i) => canMort(pi, i)).sort((a, b) => (SQ[a].t === "pub" && ownsSet(pi, SQ[a].g)) - (SQ[b].t === "pub" && ownsSet(pi, SQ[b].g)) || SQ[a].price - SQ[b].price)[0];
      if (m != null) { mortgage(p, m); continue; }
      break;
    }
  }

  // ---------- moving ----------
  async function hopTo(k, sq) { vis[k] = sq; placeTokens(); const el = $("tokens").children[k]; if (el) { el.classList.remove("hop"); void el.offsetWidth; el.classList.add("hop"); } }
  async function moveBy(p, n, wages = true) {
    const k = S.players.indexOf(p); moving = true; drawActs();
    for (let s = 1; s <= n; s++) {
      p.pos = (p.pos + 1) % 40; await hopTo(k, p.pos); sfx.step(s);
      if (p.pos === 0 && wages) { p.cash += 200; flash(p, 200); PUB.toast(`${p.you ? "Wages" : esc(p.name) + "'s wages"}! <b>+£200</b>`, 1100); sfx.earn(); log(`<b>${esc(nm(p))}</b> passed First Round: +£200`, p); }
      await sleep(spd(n > 12 ? 95 : 150));
    }
    moving = false; focusSq(p.pos); render(); await sleep(spd(250));
  }
  async function moveTo(p, target, wages = true) { const n = (target - p.pos + 40) % 40; await moveBy(p, n, wages); }
  async function moveBack(p, n) {
    const k = S.players.indexOf(p); moving = true;
    for (let s = 0; s < n; s++) { p.pos = (p.pos + 39) % 40; await hopTo(k, p.pos); sfx.step(2); await sleep(spd(170)); }
    moving = false; focusSq(p.pos); render(); await sleep(spd(250));
  }
  async function sendToJail(p, why) {
    const k = S.players.indexOf(p); p.pos = 10; p.jail = 1; vis[k] = 10; S.doubles = 0;
    sfx.jail(); log(`<b>${esc(nm(p))}</b> ${V(p, "go", "goes")} to The Cells`, p); focusSq(10); render();
    await popup({ deck: "THE CELLS", ic: "siren", t: p.you ? "Off to The Cells" : `${p.name} is off to The Cells`, x: why, quick: p.cpu });
  }

  // ---------- event card / popup ----------
  function popup(c) {
    return new Promise((res) => {
      const box = $("cardBox"), card = $("ecard");
      card.className = "ecard" + (c.deck === "PUB QUIZ" ? " quiz" : "");
      $("cDeck").textContent = c.deck; $("cIcon").innerHTML = svg(c.ic); $("cTitle").textContent = c.t; $("cText").textContent = c.x;
      $("cOk").textContent = c.ok || "CHEERS";
      box.hidden = false; void card.offsetWidth; card.style.animation = "none"; void card.offsetWidth; card.style.animation = "";
      const done = () => { box.hidden = true; $("cOk").onclick = null; clearTimeout(t); res(); };
      $("cOk").onclick = () => { sfx.tap(); done(); };
      const t = c.quick ? setTimeout(done, spd(2100)) : null;
    });
  }
  async function drawCard(p, deck) {
    if (!S.decks[deck].length) S.decks[deck] = shuffle(CARDS[deck].map((_, i) => i).filter((i) => !S.players.some((q) => q.bail.includes(deck) && CARDS[deck][i].f.bail)));
    const ci = S.decks[deck].shift(), c = CARDS[deck][ci], f = c.f, pi = S.players.indexOf(p);
    if (!f.bail) S.decks[deck].push(ci);
    sfx.card(); log(`<b>${esc(nm(p))}</b> drew “${esc(c.t)}”`, p);
    await popup({ deck: deck === "quiz" ? "PUB QUIZ" : "ROUND ON THE HOUSE", ic: c.ic, t: c.t, x: c.x, quick: p.cpu, ok: f.jail ? "FAIR ENOUGH" : f.cash < 0 || f.each < 0 || f.repairs ? "PAY UP" : "CHEERS" });
    if (f.cash > 0) { gain(p, f.cash); sfx.earn(); }
    else if (f.cash < 0) await pay(p, -f.cash, "kitty", c.t.toLowerCase());
    else if (f.each > 0) { for (const [k, q] of S.players.entries()) if (k !== pi && !q.out && !p.out) await pay(q, f.each, pi, "a birthday drink"); }
    else if (f.each < 0) { for (const [k, q] of S.players.entries()) if (k !== pi && !q.out && !p.out) await pay(p, -f.each, k, "a round"); }
    else if (f.bail) { p.bail.push(deck); PUB.toast(`${p.you ? "You keep" : esc(p.name) + " keeps"} the <b>Bail card</b>`, 1300); }
    else if (f.jail) await sendToJail(p, "Straight to The Cells. No £200.");
    else if (f.to != null) { await moveTo(p, f.to); await resolve(p, S.dice); }
    else if (f.nearest) { let j = p.pos; do { j = (j + 1) % 40; } while (SQ[j].t !== "rank"); await moveTo(p, j); await resolve(p, S.dice); }
    else if (f.back) { await moveBack(p, f.back); await resolve(p, S.dice); }
    else if (f.repairs) { const props = propsOf(pi), cost = props.reduce((a, i) => a + (S.ups[i] === 5 ? f.repairs[1] : S.ups[i] * f.repairs[0]), 0); if (cost) await pay(p, cost, "kitty", c.t.toLowerCase()); else msg(`No upgrades, so nothing to pay. Phew.`); }
    render();
  }

  // ---------- landing ----------
  async function resolve(p, dice) {
    const i = p.pos, s = SQ[i], pi = S.players.indexOf(p); focusSq(i);
    if (buyable(i)) {
      const o = S.own[i];
      if (o === -1) return offerBuy(p, i);
      if (o === pi) { msg(`${p.you ? "Your" : esc(p.name) + "'s"} own pub, <b>${esc(s.name)}</b>. Feet up.`); return; }
      if (S.mort[i]) { msg(`<b>${esc(s.name)}</b> is mortgaged, so no round to buy.`); return; }
      const owner = S.players[o], r = rentFor(i, dice);
      msg(`${esc(nm(p))} ${V(p, "buy", "buys")} ${owner.you ? "you" : esc(owner.name)} a round: <b>${fmt(r)}</b>`);
      log(`<b>${esc(nm(p))}</b> paid ${owner.you ? "you" : esc(owner.name)} ${fmt(r)} at ${esc(s.name)}`, p);
      await pay(p, r, o, `a round at ${s.name}`);
      await sleep(spd(500)); return;
    }
    if (s.t === "card") return drawCard(p, s.deck);
    if (s.t === "tax") { msg(`Council Rates: <b>${fmt(s.amt)}</b> into the Taxi Kitty.`); log(`<b>${esc(nm(p))}</b> paid ${fmt(s.amt)} council rates`, p); await pay(p, s.amt, "kitty", "council rates"); return; }
    if (s.t === "goJail") return sendToJail(p, s.desc);
    if (s.t === "taxi") {
      if (S.kitty > 0) { const k = S.kitty; S.kitty = 0; gain(p, k); sfx.kitty(); msg(`Free Taxi Home! ${esc(nm(p))} ${V(p, "scoop", "scoops")} the kitty: <b>${fmt(k)}</b>`); log(`<b>${esc(nm(p))}</b> scooped the Taxi Kitty: ${fmt(k)}`, p); PUB.toast(`🚕 Kitty! <b>+${fmt(k)}</b>`, 1500); }
      else msg("Free Taxi Home. The kitty's empty tonight.");
      return;
    }
    if (s.t === "jail") { msg("Just visiting The Cells. Wave through the bars."); return; }
    if (s.t === "start") msg("Back at First Round.");
  }
  async function offerBuy(p, i) {
    const s = SQ[i];
    if (p.cpu) { await sleep(spd(500)); if (cpuWantsBuy(p, i)) { buy(p, i); msg(`${esc(p.name)} buys <b>${esc(s.name)}</b>.`); } else msg(`${esc(p.name)} passes on ${esc(s.name)}.`); await sleep(spd(500)); return; }
    msg(`<b>${esc(s.name)}</b> is for sale: <b>${fmt(s.price)}</b>${p.cash < s.price ? ". Short? Mortgage something in My pubs." : ""}`);
    const a = await ask([{ k: "buy", label: `Buy ${fmt(s.price)}`, cls: "go", dis: () => p.cash < s.price }, { k: "pass", label: "No thanks", cls: "sec" }]);
    if (a === "buy") { buy(p, i); msg(`${esc(nm(p))} ${V(p, "own", "owns")} <b>${esc(s.name)}</b>. Cheers!`); }
    else msg(`${esc(nm(p))} ${V(p, "pass", "passes")} on ${esc(s.name)}.`);
  }

  // ---------- the turn ----------
  async function jailTurn(p) {
    if (p.cpu) {
      await sleep(spd(600));
      if (p.bail.length) { useBail(p); return "free"; }
      const unowned = SQ.filter((s, i) => buyable(i) && S.own[i] < 0).length;
      if (p.cash >= 50 + reserve(p) * 0.5 && (S.round < 14 || unowned > 6)) { await pay(p, 50, "kitty", "bail"); p.jail = 0; log(`<b>${esc(p.name)}</b> paid £50 to leave The Cells`, p); return "free"; }
    } else {
      msg(`${p.you ? "You're" : esc(p.name) + " is"} in The Cells${p.jail > 1 ? ` (try ${p.jail} of 3)` : ""}.`);
      const opts = [{ k: "roll", label: "🎲 Roll doubles" }, { k: "pay", label: "Pay £50", cls: "sec", dis: () => p.cash < 50 }];
      if (p.bail.length) opts.splice(1, 0, { k: "bail", label: "Use Bail card", cls: "go" });
      const a = await ask(opts);
      if (a === "bail") { useBail(p); return "free"; }
      if (a === "pay") { await pay(p, 50, "kitty", "bail"); p.jail = 0; log(`<b>${esc(nm(p))}</b> paid £50 to leave The Cells`, p); return "free"; }
    }
    const d = await rollDice();
    if (d[0] === d[1]) { p.jail = 0; msg(`Doubles! ${esc(nm(p))} ${V(p, "walk", "walks")} free.`); log(`<b>${esc(nm(p))}</b> rolled doubles to leave The Cells`, p); return d; }
    if (p.jail >= 3) { msg(`Third try. ${esc(nm(p))} ${V(p, "pay", "pays")} £50 and ${V(p, "leave", "leaves")}.`); await pay(p, 50, "kitty", "bail"); if (p.out) return "stay"; p.jail = 0; return d; }
    p.jail++; msg(`No doubles. ${p.you ? "You stay" : esc(p.name) + " stays"} in The Cells.`); await sleep(spd(900)); return "stay";
  }
  function useBail(p) { const d = p.bail.shift(); S.decks[d].push(CARDS[d].findIndex((c) => c.f.bail)); p.jail = 0; log(`<b>${esc(nm(p))}</b> used a Bail card`, p); PUB.toast("🔑 Bail card used", 1100); }

  async function turn() {
    if (!S || S.over) return;
    const p = me(); if (!p.cpu) lastHuman = S.cur;
    save(); render(); focusSq(p.pos);
    msg(p.cpu ? `${esc(p.name)} steps up to the bar…` : p.you ? "Your go. Roll the dice!" : `${esc(p.name)}, your go. Roll the dice!`);
    let doubles = 0;
    if (p.jail) {
      const r = await jailTurn(p);
      if (S.over) return;
      if (r === "stay" || p.out) return endPhase(p);
      if (Array.isArray(r)) { await moveBy(p, r[0] + r[1]); await resolve(p, r); if (S.over) return; return endPhase(p); }
    }
    while (true) {
      if (p.cpu) await sleep(spd(650)); else await ask([{ k: "roll", label: "🎲 Roll the dice", cls: "go" }]);
      const d = await rollDice(), dbl = d[0] === d[1];
      if (dbl && ++doubles === 3) { log(`<b>${esc(nm(p))}</b> rolled three doubles in a row`, p); await sendToJail(p, "Three doubles in a row. Calm down! Off to The Cells."); break; }
      msg(`${esc(nm(p))} rolled <b>${d[0] + d[1]}</b>${dbl ? " (doubles!)" : ""}`);
      await moveBy(p, d[0] + d[1]);
      await resolve(p, d);
      if (S.over || p.out || p.jail || !dbl) break;
      msg(`Doubles! ${esc(nm(p))} ${V(p, "roll", "rolls")} again.`); await sleep(spd(500));
    }
    if (S.over) return;
    await endPhase(p);
  }
  async function endPhase(p) {
    if (S.over) return;
    if (!p.out) {
      if (p.cpu) { cpuManage(p); render(); await sleep(spd(700)); }
      else { await ask([{ k: "end", label: "End turn", cls: "go" }]); }
    }
    endTurn();
  }
  function endTurn() {
    if (S.over) return;
    const prev = S.cur; let n = S.cur;
    do { n = (n + 1) % S.players.length; } while (S.players[n].out && n !== prev);
    if (n <= prev) S.round++;
    S.cur = n;
    if (S.len && S.round > S.len) return gameOver("time");
    turn();
  }

  // ---------- my pubs sheet ----------
  function openMine() { $("mine").hidden = false; renderMine(); }
  function closeMine() { $("mine").hidden = true; }
  $("mineBtn").addEventListener("click", () => { sfx.tap(); openMine(); });
  $("mClose").addEventListener("click", () => { if (!debt) closeMine(); });
  $("mine").addEventListener("click", (e) => { if (e.target === $("mine") && !debt) closeMine(); });
  function renderMine() {
    if (!S) return;
    const viewer = me().cpu ? S.players[lastHuman] : me(), pi = S.players.indexOf(viewer);
    const live = !me().cpu && !moving && !!pending && viewer === me();
    $("mTitle").textContent = viewer.you ? "My pubs" : `${viewer.name}'s pubs`;
    const db = $("debtBox");
    if (debt && debt.p === viewer) {
      db.hidden = false;
      db.innerHTML = `<p>You owe <b>${fmt(debt.amt)}</b> for ${esc(debt.why)}. You've got <b>${fmt(viewer.cash)}</b>.</p><div class="row"><button class="btn" data-ans="pay" type="button"${viewer.cash < debt.amt ? " disabled" : ""}>PAY ${fmt(debt.amt)}</button><button class="btn ghost" data-ans="bust" type="button">Go bust</button></div>`;
    } else db.hidden = true;
    const mine = propsOf(pi);
    if (!mine.length) { $("mList").innerHTML = `<div class="mempty">No pubs yet. Land on one and buy it!</div>`; return; }
    const groups = {};
    for (const i of mine) { const key = SQ[i].t === "pub" ? SQ[i].g : SQ[i].t; (groups[key] = groups[key] || []).push(i); }
    const order = [...Object.keys(GR), "rank", "util"];
    $("mList").innerHTML = order.filter((g) => groups[g]).map((g) => {
      const label = GR[g] ? GR[g].n + " set" : g === "rank" ? "Taxi ranks" : "Local businesses", col = GR[g] ? GR[g].c : g === "rank" ? "#777" : "#8A6A42";
      const full = GR[g] && ownsSet(pi, g);
      return `<div class="mset"><div class="msh" style="--g:${col}">${label}${full ? "<em>Full set · build away</em>" : ""}</div>${groups[g].map((i) => {
        const s = SQ[i], u = S.ups[i];
        const status = S.mort[i] ? "Mortgaged" : s.t === "pub" ? (u ? (u === 5 ? "Superpub" : `${u} upgrade${u > 1 ? "s" : ""}`) : full ? "Full set: double rent" : "No upgrades") : "Earning";
        const b = [];
        if (s.t === "pub" && full) b.push(`<button class="b-up" data-act="up" data-i="${i}"${live && canUpgrade(pi, i) && viewer.cash >= buildCost(i) ? "" : " disabled"}>+ ${u < 4 ? UPN[u] : "Superpub"} ${fmt(buildCost(i))}</button>`);
        if (u) b.push(`<button class="b-sell" data-act="sell" data-i="${i}"${live && canSell(pi, i) ? "" : " disabled"}>Sell +${fmt(buildCost(i) / 2)}</button>`);
        if (S.mort[i]) b.push(`<button class="b-un" data-act="un" data-i="${i}"${live && viewer.cash >= unmortCost(i) ? "" : " disabled"}>Pay off ${fmt(unmortCost(i))}</button>`);
        else b.push(`<button class="b-mort" data-act="mort" data-i="${i}"${live && canMort(pi, i) ? "" : " disabled"}>Mortgage +${fmt(mortVal(i))}</button>`);
        return `<div class="mrow"><div class="mn"><b>${esc(s.name)}</b><small>${status} · rent ${S.mort[i] ? "none" : fmt(s.t === "util" ? 0 : rentFor(i, [3, 4])) + (s.t === "util" ? " (dice)" : "")}</small></div><div class="mb">${b.join("")}</div></div>`;
      }).join("")}</div>`;
    }).join("");
  }
  $("mine").addEventListener("click", (e) => {
    const a = e.target.closest("[data-ans]"); if (a) { answer(a.dataset.ans); return; }
    const b = e.target.closest("[data-act]"); if (!b || b.disabled) return;
    const p = me(), pi = S.cur, i = +b.dataset.i;
    if (p.cpu || moving || !pending) return;
    if (b.dataset.act === "up" && canUpgrade(pi, i) && p.cash >= buildCost(i)) upgrade(p, i);
    else if (b.dataset.act === "sell" && canSell(pi, i)) sellUp(p, i);
    else if (b.dataset.act === "mort" && canMort(pi, i)) mortgage(p, i);
    else if (b.dataset.act === "un" && S.mort[i] && p.cash >= unmortCost(i)) unmortgage(p, i);
    sfx.tap(); render(); save();
  });

  // ---------- game over ----------
  function gameOver(reason) {
    S.over = true; pending = null; PUB.stopMusic(); render();
    const ranked = S.players.map((p, k) => ({ p, k, w: p.out ? -1 : worth(p) })).sort((a, b) => b.w - a.w);
    const win = ranked[0], wp = win.p;
    $("oTitle").textContent = reason === "time" ? "CLOSING TIME!" : "LAST LANDLORD STANDING!";
    $("oWinner").innerHTML = `<img src="${charImg(wp.char)}" alt=""><b>${wp.you ? "YOU WIN!" : esc(wp.name).toUpperCase() + " WINS"}</b>`;
    $("oSub").textContent = reason === "time" ? `Richest at closing time with ${fmt(win.w)} in cash, pubs and upgrades.` : "Everyone else has gone bust.";
    $("oStand").innerHTML = ranked.map((r, n) => `<li class="${n ? "" : "first"}"><img src="${charImg(r.p.char)}" alt=""><b>${esc(r.p.name)}</b>${r.p.out ? "<em>BUST</em>" : `<span>${fmt(r.w)}</span>`}</li>`).join("");
    const humanWin = !wp.cpu && win.k === 0 && S.players.some((p) => p.cpu);
    if (humanWin) { const prev = +(store.get("empWins") || 0), w = prev + 1; store.set("empWins", String(w)); PUB.fanfare(); PUB.cheer(true); PUB.submit("empire", w); }
    else if (!wp.cpu) { PUB.fanfare(); PUB.cheer(true); } else PUB.sad();
    store.set("empPlayed", String(+(store.get("empPlayed") || 0) + 1));
    try { localStorage.removeItem(SAVE); } catch (e) {}
    S.result = { winner: wp.name, worth: win.w };
    setTimeout(() => PUB.show("over", ["gate", "start", "over"]), spd(900));
  }
  $("again").addEventListener("click", () => { sfx.tap(); openSetup(); });
  $("share").addEventListener("click", () => {
    const r = S && S.result; const txt = r ? (r.winner && S.players[0].name === r.winner ? `I just won Pub Empire 🍺 ${fmt(r.worth)} empire, everyone else skint. Fancy a game?` : `Just played Pub Empire 🍺 Buy the pubs, charge a round, bankrupt your mates.`) : "Pub Empire 🍺";
    PUB.share(txt + " https://lastorders.onrender.com/empire.html", $("shareMsg"));
  });

  // ---------- save ----------
  function save() { if (!S || S.over) return; try { store.set(SAVE, JSON.stringify(S)); } catch (e) {} }
  function loadSave() { try { const s = JSON.parse(store.get(SAVE) || "null"); return s && s.v === 1 && !s.over ? s : null; } catch (e) { return null; } }

  // ---------- set up ----------
  const setup = { char: "lager", len: 20, seats: [{ type: "you" }, { type: "cpu" }, { type: "cpu" }, { type: "off" }], names: ["", "Mate 1", "Mate 2", "Mate 3"] };
  function drawSetup() {
    $("charPick").innerHTML = CHARS.map((c) => `<button type="button" data-c="${c.k}" class="${c.k === setup.char ? "on" : ""}" aria-pressed="${c.k === setup.char}"><img src="${charImg(c.k)}" alt="">${c.n}</button>`).join("");
    $("seats").innerHTML = setup.seats.map((s, k) => {
      if (k === 0) return `<div class="seat" style="--pc:${COLORS[0]}"><span class="sw"></span><b>${esc(realName() || "You")}</b><span class="fine">That's you</span></div>`;
      const cpu = CPUS[k - 1];
      return `<div class="seat${s.type === "off" ? " off" : ""}" style="--pc:${COLORS[k]}"><span class="sw"></span>${s.type === "mate" ? `<input data-name="${k}" maxlength="14" value="${esc(setup.names[k])}" aria-label="Player ${k + 1} name">` : `<b>${s.type === "cpu" ? esc(cpu.name) : "Empty seat"}</b>`}
        <div class="opts">${[["cpu", "Computer"], ["mate", "Mate"], ["off", "Off"]].map(([t, l]) => `<button type="button" data-seat="${k}" data-t="${t}" class="${s.type === t ? "on" : ""}">${l}</button>`).join("")}</div></div>`;
    }).join("");
    document.querySelectorAll("#lenPick button").forEach((b) => b.classList.toggle("on", +b.dataset.len === setup.len));
    const saved = loadSave(); $("continueBtn").hidden = !saved;
    if (saved) $("continueBtn").textContent = `CONTINUE GAME (ROUND ${saved.round})`;
  }
  $("charPick").addEventListener("click", (e) => { const b = e.target.closest("[data-c]"); if (!b) return; setup.char = b.dataset.c; sfx.tap(); drawSetup(); });
  $("seats").addEventListener("click", (e) => { const b = e.target.closest("[data-seat]"); if (!b) return; const k = +b.dataset.seat; setup.seats[k].type = b.dataset.t; if (setup.seats.filter((s) => s.type !== "off").length < 2) setup.seats[k].type = "cpu"; sfx.tap(); drawSetup(); });
  $("seats").addEventListener("input", (e) => { const k = e.target.dataset.name; if (k) setup.names[+k] = e.target.value; });
  $("lenPick").addEventListener("click", (e) => { const b = e.target.closest("[data-len]"); if (!b) return; setup.len = +b.dataset.len; sfx.tap(); drawSetup(); });
  function openSetup() { drawSetup(); PUB.show("start", ["gate", "start", "over"]); }

  function newGame() {
    const active = setup.seats.map((s, k) => ({ ...s, k })).filter((s) => s.type !== "off");
    const humans = active.filter((s) => s.type !== "cpu").length;
    const free = CHARS.map((c) => c.k).filter((c) => c !== setup.char);
    S = {
      v: 1, len: setup.len, round: 1, cur: 0, kitty: 0, over: false, dice: [3, 4], log: [],
      own: Array(40).fill(-1), ups: Array(40).fill(0), mort: Array(40).fill(false),
      decks: { house: shuffle(CARDS.house.map((_, i) => i)), quiz: shuffle(CARDS.quiz.map((_, i) => i)) },
      players: active.map((s, n) => {
        const cpu = s.type === "cpu", base = { cash: 1500, pos: 0, jail: 0, bail: [], out: false, color: COLORS[s.k], char: n === 0 ? setup.char : free.shift() };
        if (s.k === 0) return { ...base, name: realName() || (humans > 1 ? "Player 1" : "You"), cpu: false, you: humans === 1 };
        if (cpu) return { ...base, name: CPUS[s.k - 1].name, cpu: true, pers: CPUS[s.k - 1] };
        return { ...base, name: (setup.names[s.k] || "Mate " + s.k).trim().slice(0, 14) || "Mate " + s.k, cpu: false };
      }),
    };
    vis = S.players.map(() => 0); focus = 0;
    log("The pubs are open. Good luck!");
    begin();
  }
  function begin() {
    PUB.show(null, ["gate", "start", "over"]); startMusic(); showDice(S.dice[0], S.dice[1], true);
    $("tokens").innerHTML = ""; render(); setTimeout(() => { render(); turn(); }, 350);
  }
  $("newBtn").addEventListener("click", () => { sfx.tap(); if (loadSave() && !confirmNew()) return; newGame(); });
  function confirmNew() { const b = $("newBtn"); if (b.dataset.sure) { delete b.dataset.sure; return true; } b.dataset.sure = "1"; b.textContent = "TAP AGAIN TO START A NEW GAME"; setTimeout(() => { delete b.dataset.sure; b.textContent = "NEW GAME"; }, 3000); return false; }
  $("continueBtn").addEventListener("click", () => { const s = loadSave(); if (!s) return; sfx.tap(); S = s; vis = S.players.map((p) => p.pos); focus = me().pos; log("Welcome back. Game on."); begin(); });

  // rules
  $("rulesBtn").addEventListener("click", () => { sfx.tap(); $("rules").hidden = false; });
  $("rulesOk").addEventListener("click", () => { $("rules").hidden = true; });
  $("rules").addEventListener("click", (e) => { if (e.target === $("rules")) $("rules").hidden = true; });

  // a peaceful board behind the set-up screen
  S = { players: [], own: Array(40).fill(-1), ups: Array(40).fill(0), mort: Array(40).fill(false), log: [], kitty: 0, round: 1, len: 0, cur: 0, over: true, dice: [5, 6] };
  showDice(5, 6, true); focusSq(0);
  PUB.gate(() => openSetup());
  // expose a tiny hook for automated checks
  window.__emp = { state: () => S, answer, SQ, force: (a, b) => (forced = [a, b]) };
})();
