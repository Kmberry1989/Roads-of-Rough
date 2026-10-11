# Roads of Rough audit — 11 October 2026

The original audit found eight defects affecting resizing, animation, combat, and input. All eight have since been fixed and passed regression checks; see the repair verification below. The findings and baseline evidence are retained as the historical audit.

Reviewed checkout: `main`, commit `e37cedc`, initially clean. Reviewed `game.js` SHA-256: `93b151657bba22c6286b8cc0c45fd258b8fa0cc8a46d4684bdd6716720fea020`.

## Findings

### 1. P1 — Resizing freezes the canvas at its initial dimensions

Baseline location: [game.js:1005](https://github.com/Kmberry1989/Roads-of-Rough/blob/e37cedc40e6b2d762d194c2a9146f68c6c9475d2/game.js#L1005), [styles.css:22](https://github.com/Kmberry1989/Roads-of-Rough/blob/e37cedc40e6b2d762d194c2a9146f68c6c9475d2/styles.css#L22).

`resizeCanvas()` reads the already styled canvas rectangle and writes those dimensions back as inline pixel sizes. The inline sizes override subsequent responsive CSS changes. Starting at 1280×720 and shrinking to 900×500 leaves the canvas at 1280×720 inside a 900×500 shell, clipping the score HUD and lower playfield. Starting at 390×844 and rotating to 844×390 leaves the canvas at 390×219.375 while the controls move to the larger shell.

Use the available viewport/container dimensions to compute a fresh 16:9 display size, or let responsive CSS own the dimensions without freezing them inline. Validate both rotation directions, desktop resizing, and fullscreen entry/exit.

Evidence: `checks.desktopResize` and `checks.touchRotation` in [evidence.json](<output/playwright/audit-2026-10-11/evidence.json>); [clipped desktop](<output/playwright/audit-2026-10-11/desktop-resized.png>) and [rotated touch layout](<output/playwright/audit-2026-10-11/touch-rotated.png>).

### 2. P2 — Looping animations stop cycling and overlay opaque poses

Baseline location: [game.js:325](https://github.com/Kmberry1989/Roads-of-Rough/blob/e37cedc40e6b2d762d194c2a9146f68c6c9475d2/game.js#L325).

For looping animations, `safeProgress` keeps increasing, but `index` is clamped to the last frame rather than wrapped. `blend = safeProgress - index` then exceeds 1. Canvas rejects alpha values outside 0–1 and retains the previous alpha. A two-frame idle trace at progress 3, 4, and 8 draws the same last and first frames at alpha 1 each. Idle, walk, and hurt clips therefore become frozen composites instead of continuing to animate.

Wrap looping progress by frame count before calculating the integer frame and fractional blend. Keep non-looping actions clamped separately. Verify several cycles, including a return to idle after an attack.

Evidence: `checks.animation` in `evidence.json`, obtained by tracing the existing canvas draw calls in a diagnostic browser page.

### 3. P2 — Facing left shifts the sprite away from its position

Baseline location: [game.js:315](https://github.com/Kmberry1989/Roads-of-Rough/blob/e37cedc40e6b2d762d194c2a9146f68c6c9475d2/game.js#L315).

The mirrored branch translates to `x + width / 2` before drawing a rectangle centred at zero. The right-facing branch centres at `x`. With the same idle frame and logical x=330, the rendered centre changes from 330 to 412.66 when facing left. The offset varies with frame width and affects both heroes and enemies, separating the artwork from its shadow, hit geometry, and telegraph position.

Mirror about the same ground-contact anchor used for the right-facing sprite. Check idle, punch, kick, and wide special frames in both directions.

Evidence: `checks.facingAnchor` in `evidence.json`; this is a canvas transform measurement, not a change to gameplay state.

### 4. P2 — Early punch chains lose their combo count before impact

Baseline location: [game.js:644](https://github.com/Kmberry1989/Roads-of-Rough/blob/e37cedc40e6b2d762d194c2a9146f68c6c9475d2/game.js#L644), [game.js:535](https://github.com/Kmberry1989/Roads-of-Rough/blob/e37cedc40e6b2d762d194c2a9146f68c6c9475d2/game.js#L535), [game.js:696](https://github.com/Kmberry1989/Roads-of-Rough/blob/e37cedc40e6b2d762d194c2a9146f68c6c9475d2/game.js#L696).

The first light attack starts with combo=1 and comboTimer=0. On the following update, the zero timer resets the combo while the attack is still active. The timer is refreshed only when an action finishes; chaining a punch resets actionTime without refreshing it. In an isolated scene using the existing update logic, both the first punch and its early chained follow-up had combo=0 at impact and dealt 12 damage each. The intended `12 + combo * 2` bonus was lost.

Refresh the combo lifetime when starting/linking a punch, or expire chains only in the appropriate idle state. Verify first-hit damage, second/third-hit bonuses, and timeout after an actual gap.

Evidence: `checks.combo` in `evidence.json`. This reproduction used a browser-only controlled enemy position and cooldown to isolate the timer; production files were unchanged.

### 5. P2 — Close-range attacks have uncommunicated blind spots

Baseline location: [game.js:573](https://github.com/Kmberry1989/Roads-of-Rough/blob/e37cedc40e6b2d762d194c2a9146f68c6c9475d2/game.js#L573), [game.js:683](https://github.com/Kmberry1989/Roads-of-Rough/blob/e37cedc40e6b2d762d194c2a9146f68c6c9475d2/game.js#L683).

The hit test measures horizontal distance from an offset attack centre and requires it to exceed -35. This excludes enemies less than 33 units in front for light attacks, 53 for heavy attacks, and 125 for specials. Enemies normally stop approaching at about 68 units. A fully charged special therefore spends all 100 meter while missing an enemy at its ordinary melee position. In controlled tests, specials did zero damage at gaps of 20, 68, and 100, but dealt 36 at 160. Light and heavy attacks also missed an overlapping target at gap 20.

Make the hit volume cover the space from the fighter's front through the outer attack edge, with explicit facing and lane checks. If the special is deliberately ranged, its near limit needs clear player feedback before meter is spent.

Evidence: `checks.closeRange` in `evidence.json`, using controlled positions and unchanged attack/update functions. The fresh full route also demonstrated successful specials at longer range.

### 6. P2 — Movement remains held after focus loss

Baseline location: [game.js:1122](https://github.com/Kmberry1989/Roads-of-Rough/blob/e37cedc40e6b2d762d194c2a9146f68c6c9475d2/game.js#L1122), [game.js:1144](https://github.com/Kmberry1989/Roads-of-Rough/blob/e37cedc40e6b2d762d194c2a9146f68c6c9475d2/game.js#L1144).

Key input is cleared only on keyup. The blur handler collapses the audio UI without clearing input or pausing. A simulated blur while ArrowRight was held left the player walking from x=395 to x=590 over the next 750 ms without new input. Switching apps while holding movement can leave the fighter moving or taking damage if keyup is not delivered to this window.

Clear keyboard, held touch, and pending action state on blur/visibility loss; reset edge tracking and visible held-button styling. Consider automatically pausing an active fight.

Evidence: `checks.blur` in `evidence.json`. The blur event was simulated; a physical app-switch test was not performed.

### 7. P2 — Gamepad support cannot drive the complete game flow

Baseline location: [game.js:510](https://github.com/Kmberry1989/Roads-of-Rough/blob/e37cedc40e6b2d762d194c2a9146f68c6c9475d2/game.js#L510), [game.js:655](https://github.com/Kmberry1989/Roads-of-Rough/blob/e37cedc40e6b2d762d194c2a9146f68c6c9475d2/game.js#L655), [game.js:787](https://github.com/Kmberry1989/Roads-of-Rough/blob/e37cedc40e6b2d762d194c2a9146f68c6c9475d2/game.js#L787).

Gamepad polling occurs inside `updatePlayer()`, reached only during play. Character selection and confirmation therefore never consume controller input. The button mappings cover light, heavy, and special only; there are no mappings for dodge, pause, resume, or restart. A simulated pad holding the confirm/Start buttons and a horizontal stick remained on character select for two seconds. After keyboard confirmation, the same simulated pad moved and attacked successfully. Both shoulder buttons map to special, leaving no dodge input.

Poll the controller at the top-level input layer and map selection, confirmation, pause/resume, restart, and dodge with button-edge detection.

Evidence: `checks.gamepadSelect`, `checks.gamepadPlay`, and `checks.gamepadShoulders` in `evidence.json`. Controller hardware was not tested.

### 8. P2 — Global gameplay shortcuts break keyboard-operated audio controls

Baseline location: [game.js:1017](https://github.com/Kmberry1989/Roads-of-Rough/blob/e37cedc40e6b2d762d194c2a9146f68c6c9475d2/game.js#L1017).

The window keydown handler does not check the focused target before preventing arrow/Space/Enter defaults and adding gameplay input. With the volume range focused, holding ArrowRight left the volume at 0.32 and moved the player from x=590 to x=700. The labelled audio UI therefore loses native keyboard behaviour while affecting combat behind it.

Ignore gameplay shortcuts when focus belongs to the audio controls or another interactive DOM element. Verify slider arrow keys and Space/Enter activation of the audio buttons without moving or starting the fighter.

Evidence: `checks.sliderKeyboard` in `evidence.json`.

## What passed

- `node --check game.js` and `git diff --check`.
- The bundled web-game Playwright client completed a fresh keyboard movement/gameplay smoke run; its screenshot was inspected.
- An unmodified-source desktop run selected Eric, cleared waves 1–4, defeated the Street Boss, and reached victory at x=5100, score 4725, health 93. The controller used normal keyboard event handlers and `advanceTime`, with no injected health, meter, enemy kills, or wave progression. The victory screenshot was inspected.
- Pause froze player state and resumed correctly. An idle run reached zero health; R restarted at wave 1 with 100 HP.
- A 390×844 touch-capable Chromium context selected Kristen with a tap. Visible DOM controls triggered movement, light attack, and dodge using pointer input. Screenshots were inspected.
- Captured browser page errors, console errors, and warnings were empty in the smoke, diagnostic, and route runs.

[Route and control results](<output/playwright/audit-2026-10-11/route-evidence.json>) · [Victory screenshot](<output/playwright/audit-2026-10-11/route-final.png>) · [Touch attack screenshot](<output/playwright/audit-2026-10-11/touch-attack.png>).

## Scope and limitations

This audit covered the current local canvas game, input flow, rendering, combat, waves, and supplied expansion inventory. Chromium touch emulation and a simulated gamepad establish input-handler behaviour, not physical iPhone/Android or controller compatibility. Safari, Firefox, physical audio playback, simultaneous multi-touch, fullscreen transitions, and a complete touch victory route were not verified in this run. `advanceTime` fixes the simulation timestep but spawning still uses `Math.random()`, so exact route scores and health can vary.

The eight expansion source sheets are still absent from the runtime asset list and game mechanics. Their README accurately labels them as source art needing frame mapping and, for the thrower/props, background extraction. Guard, parry, grab, throw, revive, co-op, ranged enemies, and interactive props are future work, not current playable features.

For the original audit, the diagnostic harness intercepted the served `game.js` only in one browser context to expose existing functions and state for isolated combo, hit-volume, and drawing tests. The route, resize, focus, keyboard, and touch checks use the original source. That audit phase made no fixes, commits, pushes, deployments, or dependency changes. The subsequent repair is documented below.

## Reproduction files and next work

Evidence and harnesses are saved under [output/playwright/audit-2026-10-11](<output/playwright/audit-2026-10-11>). Serve this checkout at `http://127.0.0.1:4173`, then run `audit.mjs`, `route.mjs`, and `touch.mjs` in that order with Node. The harnesses require a resolvable Playwright installation, or PLAYWRIGHT_MODULE pointing to its entrypoint. These baseline harnesses overwrite their historical evidence files on rerun; use the regression harness below to verify the fixes without overwriting the baseline.

The completed repair followed this order: responsive sizing; loop/mirroring correctness; combo lifetime and near hit volumes; focus ownership; complete gamepad flow. Expansion art integration remains future work.

## Repair verification — 11 October 2026

All eight findings are closed by the changes in game.js, styles.css, and index.html. CSS now owns a viewport-fitted 16:9 canvas; controls adapt to the actual game container, with two action-button rows on very narrow screens. Looping frames wrap and mirrored sprites retain their anchor. Punch chains deal 14/16/18 damage and expire after an idle gap. Attack volumes include nearby forward targets while excluding targets behind the fighter, outside reach, or in another lane.

Focus loss clears all input and pauses the fight. Native audio keyboard controls remain independent of gameplay. Controller selection and confirmation now work before combat; Start pauses/resumes, Back restarts, and LT dodges. A/X, B/Y, and LB/RB retain their existing hit, kick, and special mappings. Gamepad polling no longer changes touch-held actions. R now restarts the current hero during play or pause, matching the displayed restart instruction.

The asserting [regression harness](scripts/verify-game.mjs) passed 13 groups of checks: resize, fullscreen, blur/resume, native audio keyboard controls, rotation/narrow controls, simultaneous two-finger touch, drawing cycles/anchors, combo damage/expiry, hit volumes in both directions, gamepad lifecycle/source isolation, desktop victory, defeat/restart, and touch victory. Drawing/combat isolation and simulated gamepad tests expose existing functions in a browser-only diagnostic context; both full victory routes use normal input handlers without gameplay state mutation.

Fresh desktop and touch routes both selected Eric, cleared all four waves, defeated the boss, and reached victory with 85 HP. Random spawning means exact scores and health can vary on rerun. Browser errors and warnings were empty. Screenshots of resized gameplay, mobile layouts, and both victory screens were inspected. A subsequent focused landscape check confirmed the audio controls begin at y=59.625, below the score HUD ending at y=55.25.

Results: [regression results](output/playwright/fixes-2026-10-11/results.json), [desktop victory](output/playwright/fixes-2026-10-11/desktop-victory.png), [touch victory](output/playwright/fixes-2026-10-11/touch-victory.png), [landscape layout](output/playwright/fixes-2026-10-11/touch-landscape.png). A fresh bundled web-game client smoke run also passed after the final runtime edits.

To rerun: serve the checkout at http://127.0.0.1:4173, then run `node scripts/verify-game.mjs` with Playwright installed in your tool environment. If Node cannot resolve it, set `PLAYWRIGHT_MODULE` to the absolute path of your installed Playwright entrypoint. `GAME_URL` and `QA_OUTPUT` override the server and output directory. The game itself still has no dependency changes.

Physical phone/controller compatibility, other browser engines, and audible output remain unverified. Touch victory and simultaneous multi-touch were verified in Chromium emulation; gamepad controls were verified through a simulated controller.
