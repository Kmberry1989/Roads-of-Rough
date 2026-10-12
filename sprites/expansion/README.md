# Expansion sprite sources

These 1536×1024 source sheets extend the existing cast and city art:

- `player_kyle-coop-actions.png`: guard, parry, grab, throw, knockdown recovery, revive, and team interaction poses.
- `player_eric-coop-actions.png`: Eric versions of the same defensive, grapple, recovery, revive, and team actions.
- `player_kristen-coop-actions.png`: Kristen versions of the same defensive, grapple, recovery, revive, and team actions.
- `player_rochelle-coop-actions.png`: Rochelle versions of the same defensive, grapple, recovery, revive, and team actions.
- `player_vickie-coop-actions.png`: Vickie versions of the same defensive, grapple, recovery, revive, and team actions.
- `enemy-heavy-expanded-actions.png`: heavy attack tells, shoulder charge, guard, guard break, launch, knockdown, stun, and recovery.
- `enemy-thrower-actions.png`: ranged bottle enemy with windup, throw, retreat, shove, reactions, recovery, and projectile frames.
- `environment-interactive-props.png`: destructible street props, pickups, obstacles, ambient loops, and foreground debris.

## Integration status

The thrower is integrated in waves 2–4 through `runtime/enemy-thrower.png`. The other expansion sheets remain source-only.

The five hero and heavy enemy sheets retain backgrounds close to the current magenta-key workflow. The environment sheet still needs background extraction. All generated originals remain intact.

## Thrower runtime atlas (2026-10-12)

`runtime/enemy-thrower-frames.json` records the measured source rectangles, extracted bounds, horizontal body anchors, and runtime rectangles for all 18 poses. The original 1536×1024 sheet has uneven rows of 5, 5, 4, and 4 frames. The derived 3200×1280 atlas uses 640×320 cells, a shared body baseline at 300, and centred bottle frames. This preserves character proportions during knockdown and keeps the body anchored through extended-arm poses.

The source's visible dark gradient/guide matte has low alpha coverage. `scripts/build-thrower-sprite.mjs` removes coverage below 96, remaps the remaining 96–255 coverage, and removes magenta source shadows. It preserves opaque dark outlines and clothing rather than globally keying black. The release pose's detached bottle and trail are masked so gameplay can render one independent projectile. The runtime PNG loads directly without the legacy magenta key.

| Runtime clip | Measured poses (atlas indices) |
| --- | --- |
| Idle | idle, ready (0, 2) |
| Walk/retreat | walk, retreat (1, 6) |
| Windup | ready, windup (2, 3) |
| Release/recovery | release, recover (4, 5) |
| Hurt | hurt (8) |
| Defeat | knockdown, defeat (9, 10) |
| Bottle rotation | bottle0–bottle3 (14–17) |

Guard, rise, crouch, and panic are measured for future use, without adding those mechanics. Thrower clips use discrete poses to avoid ghosted tells.

To rebuild, serve the repository at `http://127.0.0.1:4173`, then run `node scripts/build-thrower-sprite.mjs` with Playwright available. `PLAYWRIGHT_MODULE` can point to an existing Playwright `index.mjs`; `GAME_URL` overrides the local server address. These tools are development-only; the shipped canvas game has no package dependencies. `node scripts/verify-thrower.mjs` exercises the focused timing and lifecycle checks; `scripts/verify-game.mjs` retains the full control and route regressions.
