// Last Orders scoreboard: a tiny API for the pub games' online leaderboards. No npm packages needed (Node 18+).
// Storage: Upstash Redis when UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are set (keys start "lo:" so it can
// share StatsPack's database), otherwise a local file. Everything is mirrored in memory, so reads are instant.
"use strict";
const http = require("http"), fs = require("fs"), path = require("path"), crypto = require("crypto");
const PORT = process.env.PORT || 4960, VERSION = "1.0.0";
const URL_ = (process.env.UPSTASH_REDIS_REST_URL || "").trim().replace(/\/+$/, ""), TOKEN = (process.env.UPSTASH_REDIS_REST_TOKEN || "").trim();
const ORIGIN = (process.env.ALLOWED_ORIGIN || "*").trim();
const FILE = path.join(__dirname, "cache", "lb.json");

// game key -> highest believable score (stops silly numbers)
const GAMES = { flying: 2000, goggles: 200000, darts: 100000, pop: 2000, merge: 200000, crush: 2000, barman: 500000, stack: 5000,
  bowling: 300, pong: 1000, pool: 100000, pour: 100000, sort: 2000, quiz: 1000, cards: 1000 };
const BAD = ["fuck", "shit", "cunt", "nigg", "fag", "paki", "twat", "wank", "nazi", "rape", "slut", "whore", "bitch", "dick", "cock", "pussy", "retard"];

const mode = URL_ && TOKEN && /^https:\/\//.test(URL_) ? "upstash" : "file";
const DB = { boards: {}, names: {} }; // boards["pop:all"] = { id: {s, t} }, names[id] = name
let ready = false, lastErr = null;
async function cmd(args) {
  const r = await fetch(URL_, { method: "POST", headers: { Authorization: `Bearer ${TOKEN}`, "content-type": "application/json" }, body: JSON.stringify(args), signal: AbortSignal.timeout(8000) });
  const j = await r.json().catch(() => ({})); if (!r.ok || j.error) throw new Error(j.error || "HTTP " + r.status); return j.result;
}
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });
const boardKey = (g, p) => `${g}:${p === "today" ? today() : "all"}`;
async function load() {
  if (mode === "upstash") {
    try {
      const keys = ["names", ...Object.keys(GAMES).flatMap((g) => [`${g}:all`, `${g}:${today()}`])];
      const res = await Promise.all(keys.map((k) => cmd(["HGETALL", "lo:" + k]).then((f) => [k, f || []])));
      for (const [k, flat] of res) { const obj = {}; for (let i = 0; i < flat.length; i += 2) { try { obj[flat[i]] = JSON.parse(flat[i + 1]); } catch (e) {} } if (k === "names") DB.names = obj; else DB.boards[k] = obj; }
      console.log("[lb] Upstash connected,", Object.keys(DB.names).length, "players");
    } catch (e) { lastErr = e.message; console.warn("[lb] Upstash failed:", e.message); }
  } else { try { Object.assign(DB, JSON.parse(fs.readFileSync(FILE, "utf8"))); } catch (e) {} console.log("[lb] using local file"); }
  ready = true;
}
let fileT = null;
function save(k, field, val) {
  if (mode === "upstash") { cmd(["HSET", "lo:" + k, field, JSON.stringify(val)]).catch((e) => (lastErr = e.message)); if (!k.endsWith(":all") && k !== "names") cmd(["EXPIRE", "lo:" + k, String(60 * 60 * 24 * 3)]).catch(() => {}); return; }
  clearTimeout(fileT); fileT = setTimeout(() => { try { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(DB)); } catch (e) {} }, 400);
}
function cleanName(n) {
  n = String(n || "").replace(/[^\p{L}\p{N} '_.-]/gu, "").replace(/\s+/g, " ").trim().slice(0, 16);
  if (n.length < 2) return null; const low = n.toLowerCase().replace(/[^a-z]/g, ""); if (BAD.some((b) => low.includes(b))) return null; return n;
}
const okId = (id) => typeof id === "string" && /^[a-z0-9]{12,40}$/.test(id);
function ranked(k, id) {
  const b = DB.boards[k] || {}; const rows = Object.entries(b).map(([pid, v]) => ({ id: pid, s: v.s, t: v.t })).sort((a, c) => c.s - a.s || a.t - c.t);
  const top = rows.slice(0, 50).map((r, i) => ({ r: i + 1, n: DB.names[r.id] || "Punter", s: r.s, me: r.id === id }));
  const mi = rows.findIndex((r) => r.id === id); return { top, total: rows.length, you: mi >= 0 ? { r: mi + 1, s: rows[mi].s } : null };
}
// rate limit: 40 requests a minute per IP
const HITS = new Map();
function limited(ip) { const now = Date.now(), h = (HITS.get(ip) || []).filter((t) => now - t < 60000); h.push(now); HITS.set(ip, h); return h.length > 40; }
setInterval(() => { const now = Date.now(); for (const [k, v] of HITS) if (!v.some((t) => now - t < 60000)) HITS.delete(k); }, 120000).unref();

function send(res, code, obj) { res.writeHead(code, { "content-type": "application/json; charset=utf-8", "access-control-allow-origin": ORIGIN, "access-control-allow-methods": "GET,POST,OPTIONS", "access-control-allow-headers": "content-type", "cache-control": "no-store" }); res.end(JSON.stringify(obj)); }
function body(req) { return new Promise((ok) => { let d = ""; req.on("data", (c) => { d += c; if (d.length > 4000) req.destroy(); }); req.on("end", () => { try { ok(JSON.parse(d || "{}")); } catch (e) { ok({}); } }); }); }

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, "http://x"), p = u.pathname, ip = String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").split(",")[0].trim();
  if (req.method === "OPTIONS") return send(res, 204, {});
  if (p === "/" || p === "/api/status") return send(res, 200, { ok: true, version: VERSION, store: mode, ready, players: Object.keys(DB.names).length, error: lastErr ? "storage problem" : null });
  if (!ready) return send(res, 503, { error: "Scoreboard is waking up. Try again in a moment." });
  if (limited(ip)) return send(res, 429, { error: "Slow down a bit." });
  try {
    if (p === "/api/top" && req.method === "GET") {
      const g = u.searchParams.get("game"), per = u.searchParams.get("period") === "today" ? "today" : "all", id = u.searchParams.get("id") || "";
      if (!GAMES[g]) return send(res, 400, { error: "Unknown game." });
      return send(res, 200, { game: g, period: per, ...ranked(boardKey(g, per), id) });
    }
    if (p === "/api/score" && req.method === "POST") {
      const b = await body(req), g = b.game, s = Math.floor(+b.score);
      if (!GAMES[g] || !okId(b.id) || !Number.isFinite(s) || s <= 0 || s > GAMES[g]) return send(res, 400, { error: "That score doesn't look right." });
      if (b.name && !DB.names[b.id]) { const n = cleanName(b.name); if (n) { DB.names[b.id] = n; save("names", b.id, n); } }
      if (!DB.names[b.id]) { DB.names[b.id] = "Punter " + (1000 + parseInt(crypto.createHash("md5").update(b.id).digest("hex").slice(0, 6), 16) % 9000); save("names", b.id, DB.names[b.id]); }
      const out = {};
      for (const per of ["all", "today"]) {
        const k = boardKey(g, per); DB.boards[k] = DB.boards[k] || {}; const cur = DB.boards[k][b.id];
        if (!cur || s > cur.s) { DB.boards[k][b.id] = { s, t: Date.now() }; save(k, b.id, DB.boards[k][b.id]); out[per + "Best"] = true; }
        const r = ranked(k, b.id); out[per] = r.you; out[per + "Total"] = r.total;
      }
      return send(res, 200, { ok: true, name: DB.names[b.id], ...out });
    }
    if (p === "/api/name" && req.method === "POST") {
      const b = await body(req); if (!okId(b.id)) return send(res, 400, { error: "Bad player." });
      const n = cleanName(b.name); if (!n) return send(res, 400, { error: "Pick another name: 2 to 16 letters or numbers, and keep it clean." });
      const taken = Object.entries(DB.names).some(([id, v]) => id !== b.id && v.toLowerCase() === n.toLowerCase()); if (taken) return send(res, 409, { error: "Someone's already got that name." });
      DB.names[b.id] = n; save("names", b.id, n); return send(res, 200, { ok: true, name: n });
    }
    if (p === "/api/me" && req.method === "GET") { const id = u.searchParams.get("id"); return send(res, 200, { name: okId(id) ? DB.names[id] || null : null }); }
    return send(res, 404, { error: "Not found." });
  } catch (e) { console.error(e); return send(res, 500, { error: "Something went wrong." }); }
});
load().finally(() => {});
server.listen(PORT, () => console.log(`[lb] Last Orders scoreboard ${VERSION} on port ${PORT} (${mode})`));
