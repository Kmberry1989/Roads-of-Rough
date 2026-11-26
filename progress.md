Original prompt: Code a 2D Beat-em-up side scroller with assumptions you can make from these assets.

- 2026-08-21: Approved plan implemented as a dependency-free canvas game. Initial implementation includes asset loading, chroma-key sprite rendering, character select, combat, waves, HUD, keyboard/touch/gamepad controls, and deterministic test hooks.
- 2026-08-21: Playwright smoke pass verified title/character select, keyboard movement, combat damage, score/meter changes, pause/resume, mobile touch controls, wave 1-4 spawning, and special/Sonic Break feedback. `node --check game.js` passed and browser console error capture stayed empty.
- 2026-08-21: Visual review confirmed the neon city composition, keyed sprite transparency, HUD, GO signal, character cards, enemy health bars, touch pad, and special feedback are visible. Desktop hides touch controls; touch-capable contexts show them.
- 2026-08-21: Extended deterministic run used charged specials to clear all four waves and reach `mode: "victory"` at x=5103 with score 2975, health 26, and no console errors. Defeat/restart remains reachable when the player stays in enemy range.

## Handoff

- The app is intentionally dependency-free and starts from `index.html`.
- `window.render_game_to_text()` and `window.advanceTime(ms)` are available for future automated playthroughs.
- A full run can end in defeat if the player stays in enemy range; victory requires clearing the fourth wave and walking to the end of the street.

- 2026-08-22: Added hero identity stats and role/special labels. Kyle is balanced, Eric is durable/heavy, Kristen is fast/fragile, Rochelle is defensive, and Vickie starts with more special meter.
- 2026-08-22: Added dodge/rush-step input on Shift/B and touch controls, with temporary invulnerability, cooldown state, text-state reporting, and a soft combat frontier that prevents sprinting past uncleared encounters.
- 2026-08-22: Added a six-enemy final wave with a 180 HP Street Boss, boss aura/name/health bar, reduced knockback, boss scoring, special defeat message, and `bossDefeated` state.
- 2026-08-22: Verification: `node --check game.js` passed; existing web-game client verified character selection, hero-specific state, movement, and dodge; deterministic full route cleared waves 1-4 plus the boss at `mode: "victory"`, `bossDefeated: true`, score 4475, health 52, with no browser console errors. Boss and victory screenshots were visually inspected.
- 2026-08-24: Added a dependency-free synthesized Web Audio mix with named hit, heavy, dodge, special, enemy-defeat, boss-defeat, and victory profiles. Audio is routed through a master volume, with persisted mute/volume controls, a visible unavailable state, and guarded no-audio fallback.
- 2026-08-24: Verification: `node --check game.js` passed. Desktop web-game client captured wave 1 gameplay with movement and no console errors. A touch-capable Playwright context (`maxTouchPoints: 1`, coarse pointer) verified the pad becoming visible on run start, right movement, light attack, dodge, volume change to 0.18, and mute state. A Web Audio-disabled context verified `supported: false`, `NO AUDIO`, disabled volume input, playable wave 1 state, and no console errors. Desktop and touch screenshots were visually inspected.
- 2026-08-24: Moved the audio UI from the mobile center to a compact upper-right control. The mixer panel opens from `MIX`, collapses on outside interaction, and auto-collapses after 3.6 seconds. The volume slider is no longer persistent during play.
- 2026-08-24: Reduced simultaneous pressure to two active enemies while retaining the existing wave recipes through queued batch spawning. Added queued/capacity fields to `render_game_to_text()` and kept the combat frontier aware of queued enemies.
- 2026-08-24: Fixed player light/heavy animation mapping to use the supplied punch/kick sheets, mapped action and defeat clips across their full frame sets, added smoother looping frame blending, and limited non-looping blend strength to keep sprite poses crisp. Verification: `node --check game.js`, web-game smoke, desktop/touch focused Playwright checks, and visually inspected desktop/mobile full-page captures all passed with no browser console errors.
- 2026-10-02: Added four 1536×1024 expansion source sheets under `sprites/expansion/`: Kyle co-op actions, expanded heavy-enemy reactions and tells, a throwable-projectile enemy, and interactive city props. The generated sheets were visually inspected. They are intentionally not wired into gameplay yet; the thrower and prop sheets need background extraction before runtime slicing.
- 2026-10-03: Completed the hero roster's co-op action sources with matching 1536×1024 sheets for Eric, Kristen, Rochelle, and Vickie. Each adds guard, parry, grab, throw, knockdown recovery, teammate revive, and team celebration poses while preserving the supplied character identity.
- 2026-09-24: Began the audit-priority combat readability pass. Added type-specific enemy windup/active/recovery timing and colored ground/label telegraphs for grunts, rushers, bruisers, and the Street Boss. Added per-hit hit-stop, white sprite flashes, attack-weighted particle bursts, and light/heavy/special impact rings while preserving the canvas-only architecture and existing controls.
- 2026-09-24: Fresh browser QA passed. Desktop deterministic play reached wave 4 victory with `bossDefeated: true`, score 4175, 80 HP, and no console errors/warnings. A 390x844 touch context used the visible on-screen movement, attack, special, and dodge controls to defeat the boss and reach victory with 60 HP and no console errors/warnings. Desktop boss-telegraph and desktop/touch victory captures were visually inspected; the boss tell label was then separated from the persistent boss name for legibility.

- 2026-10-11: Completed a fresh audit; saved AUDIT.md and evidence/harnesses under output/playwright/audit-2026-10-11. Eight findings: frozen resize/rotation dimensions, invalid looping-frame blend, mirrored anchor offset, early combo expiry, close-range hit blind spots, held input after blur, incomplete gamepad flow, and global shortcuts consuming audio UI keys. Game source was left unchanged.
- 2026-10-11: Syntax/diff checks passed. Original-source desktop route reached wave 4 victory with Eric, bossDefeated=true, score 4725, health 93; pause/resume and defeat/R restart passed. Touch emulation verified selection, movement, light attack, and dodge. Captured browser errors/warnings were empty and screenshots were visually inspected. Physical devices/controllers, audible output, multi-touch, fullscreen, other browser engines, and a fresh full touch victory route remain unverified. Repair the audit findings before expansion integration.

- 2026-10-11: Fixed all eight audit findings while preserving the dependency-free canvas game. Responsive CSS now fits a 16:9 game to both viewport dimensions; container queries adapt small controls. Corrected animation wrapping and mirrored anchors, restored 1/2/3-hit combo bonuses and idle expiry, extended hit volumes to forward close-range targets, added focus-loss clearing/auto-pause and native audio keyboard ownership, and completed gamepad menu/combat/pause/restart/dodge controls. LT adds dodge while existing shoulder special mappings remain. R consistently restarts during play/pause.
- 2026-10-11: scripts/verify-game.mjs passed 13 asserting regression groups, including fullscreen, both rotation directions, 320px controls, real emulated two-finger touch events, drawing/combat isolation, and simulated gamepad lifecycle/source isolation. Original-handler desktop and touch four-wave routes both defeated the Street Boss and reached victory with 85 HP; defeat/R restart passed. No browser console errors/warnings. Visually inspected gameplay/layout/victory evidence under output/playwright/fixes-2026-10-11. Fixed a landscape audio/HUD overlap found during visual inspection; its focused layout check and final bundled client smoke passed. Physical devices/controllers, other engines, and audible playback remain unverified.

- 2026-10-12: Integrated the expansion thrower in waves 2–4, replacing one melee slot per wave while retaining the two-enemy cap, four-wave progression, Street Boss, dependency-free canvas runtime, and all existing inputs.
- 2026-10-12: Preserved `sprites/expansion/enemy-thrower-actions.png` byte-for-byte. Added derived `sprites/expansion/runtime/enemy-thrower.png`, an 18-pose source/bounds/anchor/runtime frame manifest, and reproducible development-only `scripts/build-thrower-sprite.mjs`. The supplied gradient matte has low alpha coverage: coverage cleanup and magenta shadow removal preserve opaque dark clothing. Normalised 640×320 cells share a 300px body baseline and measured horizontal anchors; bottle cells are centred. Masked the baked detached bottle from the release pose. Discrete thrower frames avoid ghosted tells; unused defensive/recovery poses are measured without introducing new mechanics.
- 2026-10-12: Added a 0.95s interruptible bottle windup, green aiming line, labelled tell, fixed target ellipse/crosshair/countdown, elevated warning beacon above the touch pad, and 0.65–1.05s bottle arc. The target locks at windup start; changing lanes or using existing dodge invulnerability escapes the 46×26px landing area. Landing deals 12 damage once, with player flash/hit-stop, glass particles/impact ring, and HIT/DODGED/GLASS BREAK feedback. Slow retreat permits melee pursuit; offscreen throwers cannot initiate attacks. Launched bottles survive their owner's defeat, freeze on pause/hit-stop, clear on restart/player defeat, and must resolve before wave completion/victory. Text state exposes targets, projectiles, timing, hit area, and last landing outcome.
- 2026-10-12: Validation: syntax checks, bundled web-game client smoke, 10 focused thrower assertion groups, and all 13 existing regression groups passed with no browser console errors/warnings. Focused checks cover target locking, damage, keyboard/touch lane escapes and timed dodges, simulated gamepad dodge, cancellation by hurt/death, post-release owner death, pause, restart, offscreen gating, asset transparency, and wave inclusion. Existing unmodified-handler desktop/touch full routes defeated the boss and reached victory at 101/109 HP. Visually inspected derived atlas and desktop/mobile windup, flight, landing, dodge, and victory screenshots under `output/playwright/thrower-2026-10-12`.

### Remaining verification / next expansion work

- Physical touch devices/controllers, other browser engines, and audible playback remain unverified; touch/gamepad evidence above is browser emulation.
- Other expansion sheets remain source-only. Use the thrower manifest/builder as a reference, but inspect their actual alpha/backgrounds independently before integrating them.

- 2026-10-12: Completed a fresh live-site visual audit at deployed commit `401546d` in the Codex in-app browser. Saved `VISUAL_AUDIT.md`, 17 screenshots, and state evidence under `output/playwright/visual-audit-2026-10-12`. Five findings: P1 legacy walk slicing includes neighbouring/jump pose fragments; P1 portrait canvas scaling makes essential text tiny; P1 small-phone controls/audio overlap combat warnings; P2 animation blending doubles silhouettes; P2 paused overlay says tap restarts while the verified action resumes. Desktop thrower extraction/tell/arc/landing are visually clear, and landscape is more readable than portrait. Fresh pointer-handler Kyle route reached four-wave victory with bossDefeated=true, 72 HP, score 4725; browser warning/error capture was empty. No game-source fixes or production changes were made in this audit. Repair sprite slicing and portrait layout first; physical devices, other engines, audible playback, and complete accessibility compliance remain unverified.

- 2026-10-12: Repaired all five visual findings locally. Added reproducible measured atlases for each hero's 25 base poses and three special poses, with stable foot/body anchors, isolated idle portraits, and unchanged original sheets. Removed pose crossfading, excluded jump from walk, and isolated special recovery from neighbouring uppercut cells. Portrait now has a closer, undistorted camera, readable native roster/HUD/result UI, a separate header/mixer and 44px control area below combat, and a 12px minimum displayed warning size. Added accurate pause copy, explicit portrait RESUME/RESTART, background-tap resume/restart, immediate pad hiding during pause, and a portrait PAUSE button. Existing keyboard, touch, and gamepad controls and combat mechanics remain intact; the core stays one dependency-free canvas.
- 2026-10-12: Final validation passed 30 groups: 13 existing regressions, 10 thrower groups, and seven visual groups, including 90 single-pose walking/special draws across all heroes/directions, byte-identical original art, both portrait floor edges, expanded mixer separation, resume preserving state, and restart resetting position. Desktop/touch full routes reached victory with Eric at 101/125 and 97/125 HP. Browser warnings/errors were empty; syntax/diff checks and bundled client smoke passed. Visually inspected all five atlases plus phone menus, warnings, pause and victory evidence under `output/playwright/visual-fixes-2026-10-12`. Updated `VISUAL_AUDIT.md` with repair status and `sprites/runtime/README.md` with frame maps/rebuild instructions. Repairs remain local; physical devices/controllers, other engines, audible playback, and full accessibility compliance remain open.

## 2026-10-14 — Animation lab and sprite alignment follow-up

- Added the dependency-free `dev/animations.html` route, with all 16 runtime actors, 121 clips/pose groups, and 294 frame entries. Includes contact sheets, exact frame scrubbing/stepping, replay, speed, looping, automatic clip cycling, facing, zoom/backgrounds, crop/floor guides, previous-frame overlay, untouched source comparison, and five-hero alignment comparison. Reproduction URLs restore an exact paused frame. See `dev/README.md` for usage and timing limits.
- Extracted the game's frame rectangles, renderer, and magenta key predicate into `sprite-catalog.js` so inspection uses the same runtime definitions. Existing keyboard/touch/gamepad gameplay controls remain intact.
- Corrected Rochelle idle0's source anchor from X=52 to X=103.5. Magenta shoe regions split into small disconnected components, so the old largest-component heuristic lost the second shoe. Standing poses now measure all opaque floor pixels; dynamic poses retain body/effect filtering. Original sheets are untouched; runtime atlases, portraits, and measurement JSON were rebuilt.
- Expanded the jump pose's top crop by 16 source pixels to restore hair that protrudes above the nominal third row, including Rochelle's clipped jump top.
- New lab verification passed for every actor/clip/frame, URL restoration, play/replay/stepping/sequence, pixel-level idle centering on all five heroes, and 390px touch layout. Desktop roster, kick, bottle/source, and phone screenshots were inspected. The preview adapts its canvas width on narrow screens so the inspected sprite remains readable.
- Full gameplay regression passed all 13 groups, including keyboard/gamepad, audio, touch, pause/restart, resize/fullscreen, defeat, and desktop/touch boss victories. Visual and thrower regression results recorded in this run's output directory; see final verification entry below.
- These follow-up changes are local. No new commit, push, or deployment performed. Existing unrelated .DS_Store files remain untouched.
- Final verification: all 13 gameplay, 10 thrower, and 7 visual regression groups passed with no captured browser errors. The lab suite additionally passed 16 actors / 121 clips / 294 frame entries, contact-sheet selection, share-link feedback, exact paused URL restoration, playback controls/cycling, pixel-level idle anchors, and mobile overflow/touch checks. Original base/special sheet Git hashes matched HEAD. Inspected the final desktop select screenshot: Rochelle is centered with the other heroes. `node --check` for the game, catalog, lab, builder, and new verifier, plus `git diff --check`, passed.

## 2026-11-22 — Enemy sprite dimension and animation pass

- Original hero and enemy source sheets are all 1536×1024, but the ten enemy runtime clips used variable-sized crops. That changed their apparent scale between poses. The old walk clips also skipped one stride pose and included that pose in hurt.
- Added reproducible `scripts/build-enemy-sprites.mjs` and generated `sprites/runtime/enemy_baddy1.png` through `enemy_baddy10.png`. Every atlas is 3200×960 with 13 measured poses in 640×320 cells on a shared floor line. Original source sheets remain unchanged. Magenta matte removal is flood-filled from crop edges to preserve dark-purple clothing.
- Updated the game and animation lab to use the derived atlases. Walk now uses all four stride poses; hurt uses only the actual reaction pose. Tuned enemy 10's narrower fourth walk panel after visual inspection to remove a neighboring hair fragment.
- The animation lab showed enemy 10's four walk frames without a neighboring-pose fragment; all ten generated atlases report the same 3200×960 dimensions. Automated test suites were not run for this visual-only request.

## 2026-11-22 — Standalone animation viewer

- Added `animation-viewer.html` as a direct entry point to the shared sprite animation viewer and linked it from the game's character-select screen. The link appears only during selection.
- Reframed the viewer around straightforward controls for actor, animation, facing, speed, zoom, background, playback, looping, and frame stepping. Frame metadata is now collapsible, and the contact strip labels each pose correctly.
- Visually inspected the viewer with Kyle's idle frames and the game character-select screen with its new viewer link. Both rendered correctly. Formal test suites were not run.

## 2026-11-22 — Five-step animation clips

- Initial implementation used held frames to reach five entries; this was superseded by the following pass after the user clarified that frames must show different poses.

## 2026-11-22 — Distinct copied-sheet animation frames

- Preserved every original hero, enemy, and thrower sheet. Created working copies under `sprites/workbench/` and generated character-specific supplementary pose sheets there.
- Replaced repeated timeline entries with five distinct drawings for hero idle, punch, hurt/recovery, defeat, victory, special, and thrower idle, walk, attack, hurt, defeat, and bottle flight. Hero walk/kick and thrower windup use five unique supplied poses. Each of the ten enemy atlases now has five unique frames for idle, attack, walk, hurt, and defeat.
- Idle clips ping-pong from the first pose to the last and back. Updated the three atlas builders, source-frame manifests, animation viewer source comparison, and sprite documentation to use the copies and supplemental art.
- The viewer visibly cycles Kyle's idle through eight forward/reverse steps; Enemy 1 and thrower idle also expose eight steps over five distinct poses. Hero and enemy runtime previews were visually inspected, atlas rebuilds completed from copied sources, and all 21 source copies matched their originals byte-for-byte. Formal gameplay test suites were not run.

## 2026-11-22 — Three-district campaign and boss fights

- Expanded the route from one four-wave street to three districts: Downtown, Neon Market, and Harborline. Each district has four waves and a boss encounter; the campaign now tracks all 12 waves and ends after the Harborline boss.
- Reused the supplied city backdrops with district-specific combinations and color grading. Added two named boss variants, `THE ENFORCER` and `DOCK KING`, with distinct attack telegraphs, damage/range tuning, aura colors, and higher health. Boss counters and district state are exposed in `render_game_to_text()`.
- Existing sprite originals, copied workbench sheets, runtime atlases, and animation viewer remain in place. No gameplay test or browser playthrough was run for this change.

## 2026-11-23 — Full campaign playthrough and regression pass

- Updated the gameplay route regression to cover all 12 waves, all three named bosses, and capture each encounter. Desktop and touch playthroughs both reached victory; three bosses defeated; final HP 53 (desktop) / 41 (touch); no browser errors. Evidence and encounter screenshots: `output/playwright/campaign-2026-11-23/final-game/`.
- Visual inspection found checkerboard matte baked into expanded enemy pose sheets, visible as gray boxes during boss fights. Updated `scripts/build-enemy-sprites.mjs` to flood-remove connected bright neutral pixels from each added pose crop and rebuilt all ten runtime enemy atlases. Re-inspected Street Boss, Enforcer, and Dock King captures; the boxes are gone and costume whites remain.
- Fixed animation viewer source loading by moving `loadPath` into the viewer's shared scope. Adjusted regression assumptions for five-pose clips, ping-pong idle, copied workbench sources, and 8-pose sequence timing. Diagnostic route patterns now match cache-busted `game.js` URLs.
- Final verification passed: gameplay (13 groups including desktop/touch 12-wave victories), thrower (10 groups), visuals (8 groups including transparent corners across all 250 expanded enemy frames and phone layouts), animation viewer (16 actors / 130 clips / 566 frames), JavaScript syntax checks, and `git diff --check`. No browser errors or warnings in the passing runs.

## 2026-11-25 — Hero walk cycle cleanup

- Preserved original sheets and workbench inputs; rebuilt derived hero atlases with two generated walk poses per playable hero and expanded base atlases from 50 to 52 frames.
- Replaced the old walk/run mix with a five-frame alternating footfall sequence (`12, 51, 13, 50, 14`), filtering detached FX/specks and pink edge contamination from packed hero crops. Runtime/game and animation viewer cache keys updated.
- Added viewer verification for five distinct walk crops per hero and transparent cell edges. Animation-lab verification passed for all 16 actors, 130 clips, and 566 frames, including playback, paused URL/source restoration, the five walk crops per hero, and mobile viewer controls. `verify-visuals.mjs` remains blocked by the existing online-lobby panel intercepting the audio control; this is outside the sprite cycle. Physical-device play remains unverified.

## 2026-11-26 — Expanded the campaign with two districts

- Added Old Quarter and Skyway Heights, expanding the campaign from 3 districts / 12 waves to 5 districts / 20 waves. Each new district has its own color grade, backdrop pairing, four-wave encounter, and named boss with a distinct telegraphed attack.
- Updated the victory message and gameplay route verifier for five bosses and twenty waves. Reused the existing city art with new combinations and tints; no new background art was created.
- Automated gameplay/browser validation was not run for this change.

## 2026-11-26 — Added two more campaign districts

- Added Floodways and Crown Terminal, bringing the route to seven districts, 28 waves, and seven district bosses. Both use unique palette/backdrop combinations and new boss attack telegraphs.
- Updated the gameplay route verifier horizon and expected campaign length/boss list. Automated gameplay/browser validation was not run for this change.

## 2026-11-26 — Added street weapons

- Added generated transparent intact and broken sprite atlases for a steel pipe, baseball bat, and chain. District pickups appear along the route; E or a nearby canvas tap equips one. Weapon swings increase damage and reach, consume durability on hits, and show a broken sprite when exhausted. Weapon state is shown in the HUD/text state and included in co-op snapshots.
- Updated pickup instructions and cache-busted the runtime assets. `git diff --check` passed; browser gameplay and visual verification were not run.

## 2026-11-26 — Detailed fighter portraits

- Replaced all five small roster portraits with generated, transparent 1254×1254 head-and-shoulders close-ups. Kept each fighter's signature hair, glasses/accessories, and clothing, and matched the series framing and neon rim lighting. Roster portraits now render with smooth scaling and a cache-busted URL.
- Browser roster layout verification was not run.

## 2026-11-26 — Unique visual layers for every district

- Generated dedicated wide street-scene layers for Downtown, Neon Market, Harborline, Old Quarter, Skyway Heights, Floodways, and Crown Terminal. Each has its own architecture, landmarks, and palette instead of reusing the three original storefront paintings.
- Wired each district to its new background asset. The scene scrolls at a separate parallax speed and alternates mirrored tiles for clean joins; the shared foreground road layers remain in front.
- Browser gameplay and visual verification were not run.

## 2026-11-26 — Refined the original Downtown stage

- Reworked Downtown from the original arcade-and-pawnshop art into a cleaner, more detailed panorama with a deeper alley, stronger neon lighting, clearer storefront shapes, and an open combat lane. The original source image remains unchanged; the refreshed art replaces only `sprites/stages/downtown.png`.
- Bumped the game and background cache keys. Browser gameplay verification was not run.
