# Last Orders

By **Robbo's Game Lab**. Logo files: `lab-badge.svg`, `lab-logo.png`.

Last Orders: fifteen 18+ pub games in one place, with a home screen at `/`.

It's a static website (no server, no database), so it can go on Render as a free **Static Site**, which never goes to sleep and doesn't use your free web-service hours.

- `index.html`: the home screen with every game
- `common.css`, `common.js`: shared look, sound, 18+ check and helpers
- `flying-pint.html`: Flying Pint (the original flappy pint game)
- `pop.*`, `merge.*`, `crush.*`, `barman.*`, `stack.*`: Pub Pop, Snack Merge, Bar Crush, Barman Rush, Pint Stacker
- `run.html` + `run3d.js`: Beer Goggles, the 3D running game (uses three.js in `vendor/`, MIT licence)
- `darts.html`: 501 darts against a pub opponent
- `run-lite.html`: the flat 2D version of Beer Goggles for older phones
- `manifest.webmanifest`, `sw.js`, icons: make it installable as an app ("Add to Home screen") and playable offline
- `og.png`: the picture shown when the link is shared on Facebook or WhatsApp

When you change the game, bump `VERSION` in `sw.js` so phones pick up the new version.

## Leaderboards

`api/` is a separate tiny Node service (no npm packages) for the online leaderboards. On Render it's its own
**Web Service** with Root Directory `api`, Start Command `node server.js`, and the same Upstash settings as StatsPack
(`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`). Its keys all start with `lo:`.
The games send scores to `https://lastorders-api.onrender.com`. If Render gives the service a different address,
change `LB_API` near the top of the leaderboard section in `common.js`.

## Games

flying-pint, run (Beer Goggles 3D), run-lite, darts, pop, merge, crush, barman, stack, bowling, pong, pool, pour, sort, quiz (+ quiz-data.js), cards.


## Version 3.2 visual and audio polish

- Shared premium arcade styling across the home screen and game screens.
- Individual game melodies remain distinct; the shared synthesiser now adds a restrained original bass/drum pulse.
- Sound is generated in the browser with Web Audio (no third-party music files or copyrighted recordings).
- Small optional mobile tap feedback, respecting reduced-motion preferences.
- Service-worker cache version bumped to `lastorders-3.2` so deployed devices refresh the assets.

All gameplay logic, game data, leaderboards, and existing image assets are retained.

## Version 3.3 Flying Pint deluxe

- Flying Pint gets particle bursts, a score pop, glowing pub signs, twinkling windows, moonlight, drifting cloud and a richer street.
- Glow effects use gradients rather than per-frame canvas blur so it stays smooth on mid-range phones.
