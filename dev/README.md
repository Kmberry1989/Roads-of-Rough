# Animation lab

Open `http://127.0.0.1:4173/dev/animations.html` while the existing static server runs. The route also works under a deployed subdirectory; all asset links are relative. No build, packages, game session, or credentials are required.

- Select any of the 16 runtime actors and a clip. All runtime animations are listed, plus otherwise unused base hero/thrower poses. Expansion sheets that have no runtime mapping are not included.
- Play/replay, change speed, loop, or cycle all clips for the selected actor. Inspection playback uses eight poses per second, except the thrower's .95-second windup. This isolates pose glitches; it does not simulate combat state transitions, effects, or collisions.
- Scrub, step, or click a contact-sheet frame to pause on that exact pose. Space toggles playback, arrows step, and R replays when focus is outside form controls.
- Flip facing, zoom, change background, overlay the previous pose, and enable crop/anchor guides. Source comparison shows the untouched original crop. Hero comparison uses the selected compatible hero clip, or explicitly labels its idle fallback.
- Copy the reproduction link. It captures actor, clip, frame, facing, speed, zoom, background, and guide/comparison settings. Opening it always pauses at the chosen frame.

`../sprite-catalog.js` owns the shared frame rectangles and canvas renderer used by both the game and this lab. Hero source measurements live in `../sprites/runtime/hero-frames.json`; thrower measurements live in `../sprites/expansion/runtime/enemy-thrower-frames.json`. Rebuild hero derivatives with `scripts/build-hero-sprites.mjs`; never edit the original sprite sheets.

Verification (development-only Playwright, no runtime dependency):

```sh
PLAYWRIGHT_MODULE=/Users/kyleberry/.codex/skills/develop-web-game/scripts/node_modules/playwright/index.mjs node scripts/verify-animation-lab.mjs
```

The verification visits every selectable frame, checks playback/stepping/sequencing and exact-frame URL restoration, measures actual opaque idle foot pixels for all heroes, checks touch layout, and writes screenshots/results under `output/playwright/animation-lab-2026-10-14/`.
