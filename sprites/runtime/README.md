# Derived hero sprites

The original base and special sheets in `sprites/` remain byte-for-byte unchanged. These transparent runtime PNGs are built from measured, per-hero cells rather than guessed shared crops.

`hero-frames.json` records source rectangles, pose names, body baselines, horizontal foot anchors, and packed runtime rectangles for all five heroes. Base atlases contain 52 poses in five columns of 640×256 cells, including two additional walk poses per hero. One new pose is used directly; the other mirrors its lower body below the hips to alternate the leading foot while keeping the torso and arms steady. Special atlases keep the three original poses and add five distinct frames. Existing special names, timing, damage, and meter costs are unchanged.

Every cell places its body anchor at x=320 and its ground baseline at y=244. The builder identifies the largest opaque connected body component so detached authored dust/sparks do not move the foot anchor, retains nearby shoe fragments, and drops isolated effects/specks. Pink matte edge contamination is keyed before packing. Knockdown uses the cell's horizontal centre. The five transparent `player_*-portrait.png` files are detailed head-and-shoulders close-ups for the phone roster.

| Clip | Base atlas indices |
| --- | --- |
| Idle | 25–29 (five distinct frames) |
| Light attack | 30–34 (five distinct frames) |
| Heavy attack | 6, 7, 9, 10, 11 |
| Walk | 12, 51, 13, 50, 14 (alternating five-pose cycle) |
| Hurt/recovery | 35–39 (five distinct frames) |
| Defeat | 40–44 (five distinct frames) |
| Victory | 45–49 (five distinct frames) |
| Special | 3–7 in the special atlas (five distinct frames) |

The jump, crouch, guard, and duplicate ready poses are measured but do not add mechanics. All clips draw one authored pose at a time to avoid doubled silhouettes.

## Street weapons

`weapons/weapons-intact.png` and `weapons/weapons-broken.png` are generated transparent atlases with three equal horizontal rows: steel pipe, baseball bat, and chain. Intact art is used for route pickups and attack overlays; broken variants animate briefly when durability runs out. Pickups cycle by district, and each weapon has its own damage, reach, and durability. Press E or tap near a pickup to equip it.

## Enemy atlases

`enemy_baddy1.png` through `enemy_baddy10.png` are derived from the ten copied enemy sheets and their character-specific pose sheets in `sprites/workbench/`. Each atlas uses 640×320 cells and a shared floor line at y=315. `enemy-frames.json` records the 13 original plus 25 new crops per enemy. Idle, attack, walk, hurt, and defeat each use five different drawings.

Rebuild these atlases with `node scripts/build-enemy-sprites.mjs` while the repository is served at `http://127.0.0.1:4173`, with Playwright available as described above. Hero, enemy, and thrower builders read `sprites/workbench/`; the originals remain in their existing directories untouched.

To rebuild, serve the repository at `http://127.0.0.1:4173`, then run `node scripts/build-hero-sprites.mjs` with Playwright available. Set `PLAYWRIGHT_MODULE` to an existing Playwright module if needed; `GAME_URL` overrides the server URL. The builder is development-only. The shipped game continues to load through `index.html` without packages or a build step.
