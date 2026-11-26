# Animation viewer

Open `http://127.0.0.1:4173/animation-viewer.html` while the repository's static server runs, or click **Sprite Animation Viewer** on the game's character-select screen. The viewer also works under a deployed subdirectory. No build, packages, game session, or credentials are required.

- Select any of the 16 runtime actors and an animation. All runtime animations are listed, plus otherwise unused base hero/thrower poses. Expansion sheets that have no runtime mapping are not included.
- Every gameplay animation uses at least five distinct drawings. Pose-only inspection options remain single frames and are labeled `pose:`.
- Play/replay, change speed, loop, or cycle all clips for the selected actor. Inspection playback uses eight poses per second, except the thrower's .95-second windup. This isolates pose glitches; it does not simulate combat state transitions, effects, or collisions.
- Scrub, step, or click a contact-sheet frame to pause on that exact pose. Space toggles playback, arrows step, and R replays when focus is outside form controls.
- Flip facing, zoom, change background, overlay the previous pose, and enable crop/anchor guides. Source comparison shows the untouched original crop. Hero comparison uses the selected compatible hero clip, or explicitly labels its idle fallback.
- Copy the reproduction link. It captures actor, clip, frame, facing, speed, zoom, background, and guide/comparison settings. Opening it always pauses at the chosen frame.

`../sprite-catalog.js` owns the shared frame rectangles and canvas renderer used by both the game and this lab. Hero source measurements live in `../sprites/runtime/hero-frames.json`; enemy measurements live in `../sprites/runtime/enemy-frames.json`; thrower measurements live in `../sprites/expansion/runtime/enemy-thrower-frames.json`. The builders read only the preserved copies and added pose sheets in `../sprites/workbench/`; the original sprite sheets stay unchanged.

Verification (development-only Playwright, no runtime dependency):

```sh
PLAYWRIGHT_MODULE=/Users/kyleberry/.codex/skills/develop-web-game/scripts/node_modules/playwright/index.mjs node scripts/verify-animation-lab.mjs
```

The verification visits every selectable frame, checks playback/stepping/sequencing and exact-frame URL restoration, measures actual opaque idle foot pixels for all heroes, checks touch layout, and writes screenshots/results under `output/playwright/animation-lab-2026-10-14/`.
