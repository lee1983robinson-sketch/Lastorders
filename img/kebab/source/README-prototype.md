# KEBAB RUN — The Last Delivery

A playable, mobile-friendly arcade driving prototype for Robbo's Game Lab.

## Run
- Extract the ZIP.
- Open `index.html` in a modern browser, or deploy the folder to a static host.
- No build tools or dependencies are required. Google Fonts are optional; local system fonts are fallbacks.

## Controls
- Desktop: Left/Right arrows or A/D to steer; Space to throw a kebab.
- Mobile: on-screen left/right and THROW KEBAB buttons.

## Included gameplay
- Three-lane arcade road with scrolling British-style high street scenery.
- Traffic and road cone hazards, collisions and score penalties.
- Delivery throwing action, delivery streak and food-temperature countdown.
- Five deliveries to complete the shift.
- Responsive title screen, HUD and end-of-shift screen.

## Included original visual assets
The `assets/` folder contains generated concept artwork and crops prepared for this prototype:
- `title-art.png`
- `road-gameplay.png`
- `doorstep-delivery.png`
- `world-select.png`
- `food-and-scooters.png`
- `kebab-food.png`
- `scooter-rider.png`
- `visual-concept-sheet.png` (full reference sheet)

These are visual reference / promotional assets, not separated transparent production sprites or a true 3D model pack. The playable road, rider and obstacles are currently drawn in Canvas; Claude can use the included pictures as references while replacing them with proper isolated game assets and 3D models.

## Next pass for Claude
1. Turn the current lane-based prototype into a more convincing pseudo-3D or real 3D scooter game.
2. Replace the Canvas placeholder rider, cars and houses with individual transparent sprites or 3D models.
3. Make delivery aiming depend on distance, lane alignment and throw power rather than the current simplified score roll.
4. Add customer animations, dogs, buses, cyclists, puddles, roadworks, near misses and more varied routes.
5. Add original/licensed music and sound effects; no third-party music is bundled.
6. Integrate the existing Robbo's Game Lab leaderboard and save system when the host project is supplied.

## Asset/licensing note
The artwork in this package was generated for this project. Keep this README with the assets. Review any third-party font, music, sound, SDK or service licences separately before commercial release.
