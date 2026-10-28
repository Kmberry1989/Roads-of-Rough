# Derived hero sprites

The original base and special sheets in `sprites/` remain byte-for-byte unchanged. These transparent runtime PNGs are built from measured, per-hero cells rather than guessed shared crops.

`hero-frames.json` records source rectangles, pose names, body baselines, horizontal foot anchors, and packed runtime rectangles for all five heroes. Base atlases contain 25 poses in five columns of 640×256 cells. Special atlases contain three isolated fireball action poses in one row. The renderer uses the ready pose again during special recovery instead of accidentally including an adjacent uppercut character. Existing special names, timing, damage, and meter costs are unchanged.

Every cell places its body anchor at x=320 and its ground baseline at y=244. The builder identifies the largest opaque connected body component so detached authored dust/sparks do not move the foot anchor. Knockdown uses the cell's horizontal centre. Original magenta fills/guides are keyed with the existing game's colour rule; dark outlines and clothing are retained. Portrait PNGs use the isolated idle cell for the phone roster.

| Clip | Base atlas indices |
| --- | --- |
| Idle | 0, 1 |
| Light attack | 2, 3, 4, 5 |
| Heavy attack | 6, 7, 9, 10, 11 |
| Walk/dodge | 12, 13, 14, 15, 16 |
| Hurt | 20, 21 |
| Defeat | 22 |
| Victory | 23, 24 |

The jump, crouch, guard, and duplicate ready poses are measured but do not add mechanics. All clips draw one authored pose at a time to avoid doubled silhouettes.

To rebuild, serve the repository at `http://127.0.0.1:4173`, then run `node scripts/build-hero-sprites.mjs` with Playwright available. Set `PLAYWRIGHT_MODULE` to an existing Playwright module if needed; `GAME_URL` overrides the server URL. The builder is development-only. The shipped game continues to load through `index.html` without packages or a build step.
