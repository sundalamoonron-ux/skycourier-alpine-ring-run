# SkyCourier — Alpine Ring Run

[![make.fun](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/c/best-flight-game-20261126-0057)
[![Rank](https://make.fun/badge/best-flight-game-20261126-0057/sundalamoonron-ux/skycourier-alpine-ring-run/rank.svg)](https://make.fun/c/best-flight-game-20261126-0057)
[![Reward](https://make.fun/badge/best-flight-game-20261126-0057/sundalamoonron-ux/skycourier-alpine-ring-run/reward.svg)](https://make.fun/c/best-flight-game-20261126-0057)

A little bush plane, a big valley. Fly a red-and-cream bush plane through
glowing rings over a patchwork alpine valley — farm fields, a winding river,
pine-covered hills and snow-capped ridges — then grease the landing back on
the strip. Three missions, one flight model: throttle and turn discipline
decide whether you land or walk home.

## Missions

1. **Ring Run** — fly all 8 rings in order, then land.
2. **Courier Dash** — pick up a parcel at Pine Village, drop it at Lake
   Lodge and North Farm, then land. Tighter fuel.
3. **Sunset Landing** — climb above 300 m, thread one high ring, then land
   before the light goes.

## How to fly

| Control | Action |
| --- | --- |
| ← → (or A / D) | Bank and turn |
| ↑ ↓ | Pitch up / down |
| W / S | Throttle up / down |
| Mouse move | Steer (bank + pitch) |
| Mouse wheel | Throttle |
| G | Landing gear up / down |
| P | Pause · M mute · R restart |
| 1 / 2 / 3 | Pick a mission on the title screen |
| Enter / click | Start |

Watch the fuel, mind the stall speed, and put the gear down before you
land — a hard touchdown on the grass is a crash, and a soft one on the
centreline pays up to 300 points.

## Play it

```sh
node serve.ts   # then open http://localhost:8080
```

No build step, no network, no libraries: plain static files under `game/`,
all sound synthesized with the Web Audio API.

## Hand it in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` copies `game/` and `screenshots/` to `/output` and writes
`/output/dossier.json` with the vendored make.fun library.

## Layout

- `game/index.html` — the page and the canvas
- `game/src/main.js` — boot, fixed-step loop, keys and mouse
- `game/src/game.js` — screens, mission loop, title and debrief panels
- `game/src/plane.js` — the flight model
- `game/src/objectives.js` — missions, ring passes, scoring
- `game/src/terrain.js` — the valley: ground height, river, trees, peaks
- `game/src/render.js` — the chase-view renderer
- `game/src/hud.js` — HUD and the lit instrument panel
- `game/src/input.js` — keyboard and mouse
- `game/src/audio.js` — procedural engine, wind and chimes
- `game/src/shots.js` — deterministic autopilot scenes for screenshots
- `game/src/math3d.js` — the pinhole camera
- `game/src/rng.js` — seeded random numbers
- `game/src/config.js` — tuning constants and mission definitions
