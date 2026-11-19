# COSTA PALMERA

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Iceland26/palmera-heat/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Iceland26/palmera-heat/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An original 3D open-world crime game that runs entirely in the browser — built
for the [make.fun gta6-01 bounty](https://make.fun/c/gta6-01). No build step,
no assets, no network: every texture is painted on a canvas at runtime, every
sound is synthesised with WebAudio, and the whole city is generated from a
seeded random stream.

## The story

Marisol Vega came home to Costa Palmera with empty pockets and a borrowed
name. Five jobs stand between her and a clean slate:

1. **First Wheels** — Sol needs a loaner coupe back at the garage before dark.
2. **Harbour Run** — a hot crate off the docks, delivered against the clock.
3. **Three-Star Goodbye** — rattle the precinct, draw three stars, then vanish.
4. **Marlin's Yacht Party** — gatecrash the Marlin Yacht Club and settle a score.
5. **Palmera Sunset** — every cop in the city is awake. Run the cash drops and
   finish where the pier meets the sunset.

Finish the story for the ending card — then the city is yours in free roam.

## Controls

| Input | Action |
| --- | --- |
| `W A S D` / arrows | Walk, run, drive |
| Mouse (click the game to lock) | Look / aim |
| Mouse click | Shoot |
| `E` | Enter / exit a car |
| `Shift` | Sprint on foot |
| `Space` | Handbrake |
| `P` / `Esc` | Pause |
| `M` | Mute |

## Features

- **A living coastal city** — a five-by-four road grid, an ocean boulevard,
  beach and animated sea, a working pier, a harbour, and city blocks with
  procedurally textured buildings and lit windows at golden hour.
- **On foot and behind the wheel** — walk, sprint, steal parked cars, jack
  traffic, and drive an arcade handling model with chase camera, collisions
  and a handbrake.
- **Traffic and crowds** — sixteen AI cars run the grid with lane discipline
  and junction turns; twenty-two pedestrians stroll the pavements and panic
  when the shooting starts.
- **A full wanted system** — one to five stars: cruisers scale with your heat,
  roadblocks appear at three stars, a helicopter with a searchlight joins at
  four, and a bust meter fills when they pin you. Break line of sight and the
  heat cools off.
- **Combat** — mouse-aimed hitscan shooting with tracers and muzzle flash;
  some rivals shoot back. Busted sends you to the precinct with a fine,
  wasted sends you to the Clinica — either way the story continues.
- **Presentation** — live circular minimap with police/traffic/mission blips,
  cash, stars, health, speedometer, objective tracker with distance, and
  story subtitles.
- **Sound, synthesised live** — engine hum tied to your speed, two-tone
  sirens, gunshots, pickup blips and mission stings. No audio files.
- **Saves itself** — cash, story position, health and where you left off are
  kept in `localStorage`; Continue picks the story back up.

## Run it

Any static file server works — the kit's own is included:

```sh
node serve.ts          # serves game/ at http://localhost:8080
```

or open `game/index.html` through any static host. Desktop Chrome with
keyboard and mouse is the target.

## Layout

- `game/index.html` — page shell, HUD, menus
- `game/src/` — the game: `world` (city), `vehicles`, `people`, `police`,
  `missions` (the five jobs), `hud`, `audio`, `textures`, `shots`
  (the staged screenshot scenes)
- `game/vendor/` — Three.js r160 (MIT), the only third-party code
- `screenshots/` — the four dossier stills, captured from the game's own
  `?shot=` staging flow
- `main.ts` — the kit's dossier build; `out/` is generated

## Licence

MIT — see `LICENSE`. Three.js is MIT-licensed by its authors.
