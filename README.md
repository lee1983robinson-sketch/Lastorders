# Last Orders

Last Orders: eight 18+ pub games in one place, with a home screen at `/`.

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
