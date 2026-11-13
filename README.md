# Last Orders

A one-tap 18+ arcade game: flap a flying pint home past the pubs.

It's a static website (no server, no database), so it can go on Render as a free **Static Site**, which never goes to sleep and doesn't use your free web-service hours.

- `index.html`: the whole game
- `manifest.webmanifest`, `sw.js`, icons: make it installable as an app ("Add to Home screen") and playable offline
- `og.png`: the picture shown when the link is shared on Facebook or WhatsApp

When you change the game, bump `VERSION` in `sw.js` so phones pick up the new version.
