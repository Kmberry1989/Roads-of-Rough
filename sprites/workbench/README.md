# Sprite workbench

The PNGs named `player_*.png`, `player_*-special.png`, `baddy1.png` through `baddy10.png`, and `enemy-thrower-actions.png` are working copies of the original sheets. The originals remain in their existing locations and are not edited.

The `*-expanded-poses-transparent.png` hero sheets use a 5×6 grid. Rows are idle, punch, hurt/recovery, defeat, victory, and special. Enemy sheets use a 5×5 grid with rows idle, attack, walk, hurt, and defeat. The thrower sheet uses the same 5×5 row order as the heroes through defeat, except its rows are idle, walk, throw, hurt, and defeat. `thrower-bottle-expanded-poses.png` supplies five distinct projectile frames.

Rebuild the runtime atlases while serving the repository at `http://127.0.0.1:4173`:

```sh
PLAYWRIGHT_MODULE=/Users/kyleberry/.codex/skills/develop-web-game/scripts/node_modules/playwright/index.mjs node scripts/build-hero-sprites.mjs
PLAYWRIGHT_MODULE=/Users/kyleberry/.codex/skills/develop-web-game/scripts/node_modules/playwright/index.mjs node scripts/build-enemy-sprites.mjs
PLAYWRIGHT_MODULE=/Users/kyleberry/.codex/skills/develop-web-game/scripts/node_modules/playwright/index.mjs node scripts/build-thrower-sprite.mjs
```

The runtime atlases preserve the original measured poses and append the new frames. `sprite-catalog.js` selects the distinct five-frame sequences used by the game and animation viewer.
