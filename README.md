# Last Orders

By **Robbo's Game Lab**. Logo files: `lab-badge.svg`, `lab-logo.png`.

Last Orders: seventeen 18+ pub games in one place (including two free-play fruit machines), with a home screen at `/`.

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

## Flying Pint 3.4 Signature Edition

- Original soundtrack "Chucking-Out Time": honky-tonk pub piano melody, plucked bass, kick/snare/hi-hat, glass clinks and an organ pad. The band builds up as your score climbs (5, 10, 20).
- Separate music and sound-effect channels; music stops on a crash, never runs two loops, and shuts down when you leave the page.
- Expressive drinks: blinking, eyebrows, happy when scoring, surprised on a close shave ("PHEW!"), disappointed on a crash, beaming on a new best.
- Milestones at 5, 10, 20, 30 and 50 with their own banner, colour flash, particles and musical sting.
- New personal best (only when an earlier best is genuinely beaten): big animated banner with trophy and light rays, gold confetti, a crown for the rest of the run, a fanfare, and a gold record-breaking game-over card.
- Gameplay, collisions, scoring, kebab bonus, drinks, controls, medals, sharing and the "flying" leaderboard are unchanged.

## Version 3.5: smoother Beer Goggles, house band and records for every game

- Beer Goggles: no more stutters. Building lights no longer switch on and off (which forced the phone to rebuild its shaders), buildings reuse their textures instead of making new ones (which built up lag the longer you ran), lighter shadows, phone-friendly sharpness, and an automatic two-step quality drop on slow phones.
- Every game's music now plays through the new house band: honky-tonk piano (organ for Pool and Darts, bells for the calmer puzzle games), plucked bass, drums and glass clinks, keeping each game's own tune.
- Shared sounds use one noise buffer instead of building a new one per sound; fanfare and "unlucky" stings upgraded; music stops when you leave a game.
- New personal best celebration (trophy, gold card, confetti, fanfare) for Snack Merge, Barman Rush, Pint Stacker, Bottle Bowling, Beer Pong, Perfect Pour, Pub Quiz, Higher or Lower and Beer Goggles. Only when an earlier best is genuinely beaten.

## Version 3.6: real artwork

- Artwork lives in /img (WebP). Games use PUB.art(name) and fall back to their drawn versions until an image has loaded.
- Pub photo backdrop (blurred and dimmed, cached once) in Snack Merge, Pint Stacker, Barman Rush, Pool, Pub Quiz, Drink Sort, Perfect Pour and Pub Pop.
- Snack Merge: ten real snacks as round photo tokens (Peanuts → Crisps → Pork Scratchings → Pickled Egg → Scotch Egg → Sausage Roll → Pork Pie → Burger → Pizza → Mighty Kebab). Physics and points unchanged.
- Pint Stacker: real lager, stout, wine and bottle; glass sizes now match the photos (the tankard became a bottle).
- Barman Rush: real pints. Pool: real table photo mapped onto the playing area.
- Flying Pint: illustrated characters (lager, stout, wine, bottle and the new Cool Pint), animated with flapping wings, squash and stretch, breathing, blinking, sparkles, a sweat drop on close shaves, stars on a crash and the record crown. The shot keeps its drawn character until it has artwork.

## Version 3.8: Fruit Machine

- slots.html / slots.js: a British pub fruit machine. Three reels, one win line, random holds (never twice running, two reels at most) and nudges, Hi-Lo gamble ladder (up to five doubles), and a "Pub Crawl" pick-a-pint bonus for three pints anywhere.
- Reel maths tuned by simulating a million spins: about a 21% hit rate and 87% return before holds and nudges.
- Free play only: credits are pretend, can't be bought and can't be cashed out. A free 500-credit "lock-in" top-up appears when you run dry. Leaderboard key "slots" records the biggest single collected win (API cap 2,000,000).

## Version 3.9: two machines

- Club Fruitie (slots.html, leaderboard key "slots"): old-school pub fruitie. Numbers on the win line climb a 30-step trail; a full trail puts you on the 14-box feature board, where a chasing light lands on cash (3x to 20x), the cash ladder (gamble up to 150x), a streak (5 free spins, wins x2), 6 nudges, go again or the 200x jackpot. Plus random holds and nudges, Hi-Lo gamble and the pick-a-pint bonus. Simulated: board about every 23 spins, ~85% return with holds and nudges.
- Golden Pints (goldpints.html, key "mega"): modern 5-reel, 20-line slot with real drink photos, the Cool Pint wild (reels 2-4), Bonus Bell free spins (10/15/20, wins x3, retrigger), anticipation slow-down, payline display, big/mega/epic win celebrations, auto (25) and turbo, a level bar with bonus credits and a once-a-day bonus wheel. Simulated: ~29% of spins win, free spins about 1 in 220, ~87% return.
- Both share one free-play credit balance and the 500-credit lock-in top-up.

## Version 4.0: Bar Crush redesign

- New look: real drink and food pieces (beer, wine, blue and purple cocktails, whisky, burger, chips) cut from the concept art, glass HUD panels, neon board frame, star progress bar.
- Specials: 4 in a line makes a Rocket (clears its row or column), 5 makes a Wild (clears every drink of the type it's swapped with), a T or L makes a Bomb (3x3). Swapping two specials together: rocket+rocket crossfire, rocket+bomb triple lines, bomb+bomb 5x5, wild+rocket or wild+bomb turns every drink of that type into one, wild+wild clears the board.
- Power-ups (start with 3 each, earn more by winning): Shuffle, Bomb (tap a drink), Rocket (tap a drink; tap the button again to switch row/column), Freeze (next move is free).
- Levels: target scales with level and with how many drink types are on the board (calibrated with a bot), three stars, level select, best score per level, The Big Round (every fifth level: 28 moves, points x2).
- Original "Lock-In House" soundtrack (115 BPM, generated in code) with its own music on/off button, separate from the sound button.
