# Roads of Rough visual audit — 12 October 2026

All five findings below have now been repaired and verified locally. The baseline captures remain as audit history; see the repair verification at the end. The deployed site still contains the audited `401546d` build until these repairs are committed and deployed.

Reviewed the live [GitHub Pages game](https://kmberry1989.github.io/Roads-of-Rough/) at commit `401546dfd94813ae8e06800e4a682b1c2d8626c3`. All visual evidence below was captured during this audit in the Codex in-app browser. Historical audit screenshots were not used as evidence.

The city art, neon palette, desktop HUD, and derived thrower sprite fit together well. The thrower's clean silhouette, aiming line, target marker, visible arc, and landing flash make the attack readable at desktop size. The main problems are legacy sprite slicing and the portrait phone layout. This audit made no game-source changes.

## Findings and repair order

### V1 — P1: Walking frames include pieces of neighbouring poses

In screenshots 03, 04, 09, and 14, Kyle has detached face/hand/foot fragments beside the main body. These are visible source-sheet fragments, not gameplay particles. The current `heroFrames.walk` rectangles do not consistently isolate the supplied poses; the final walking crop also reaches the jump pose. The source sheet has uneven panels, while the shared rectangles assume more regular spacing. Frame blending makes the fragments more conspicuous.

Measure and isolate each used hero pose, record body/foot anchors, and verify all five heroes in both directions. Use the thrower's derived atlas approach where needed. Keep authored jump/recovery frames out of the walk clip. Source locations: `game.js:242`, `game.js:920`.

### V2 — P1: Portrait scaling makes essential text too small

At 390×844 the game rectangle is 390×219.375, centred between large empty bands. A 20px warning becomes approximately 6.1 CSS pixels, a 13px HUD label becomes 4px, and the character roles become about 3.4px. At 320px they are smaller again. Character names, special descriptions, input instructions, score, and end-of-run copy are difficult to read. The larger DOM audio/touch controls dominate the tiny canvas UI. Selected character roles also sit on the lower card border even at desktop size.

Provide a phone layout with readable HUD/menu text independently of canvas downscaling, and give combat more usable display area. Keep the canvas architecture, but reserve space for controls and adapt the camera/UI to the available playfield. Offer a clear landscape prompt if landscape is the intended minimum playable layout. Source locations: `styles.css:20`, `game.js:1016`, `game.js:1105`.

### V3 — P1: Small-phone controls overlap combat warnings

At 390px, the ground target partly overlaps the action row. At 320px, the two-row action panel covers the thrower's lower body and combat lane, while the audio panel overlaps the `BOTTLE • MOVE!` label. The elevated warning beacon helps but does not restore the landing area's readability. Landscape separates these elements much more successfully.

Reserve a control area outside the combat drawing region, or project important markers into a guaranteed clear region. Place audio settings away from attack labels. Check both floor extremes, every horizontal target position, and 320/390px portrait layouts. Measured 390px touch buttons are approximately 36px tall after CSS scaling; consider larger physical targets for rapid combat. Source locations: `styles.css:147`, `styles.css:153`, `game.js:980`.

### V4 — P2: Frame blending produces doubled fighter silhouettes

Screenshots 02, 03, 06, and 14 show ghosted heads/limbs on melee enemies or heroes. Looping clips draw two different poses with fractional alpha, so a fighter can look translucent or appear to have multiple bodies. The thrower avoids this by using discrete authored poses.

Use crisp frame changes for combat sprites, or only interpolate assets specifically authored for that treatment. Keep intentional dodge/invulnerability flashes distinct from ordinary animation. Source location: `game.js:341`.

### V5 — P2: Pause-screen action copy contradicts the actual action

The paused overlay says `PRESS R OR TAP TO RESTART`. A fresh check paused at x=408, tapped the canvas, and resumed in `play` at x=408 with unchanged health/meter. Restart would put the player at x=330. The accessibility status correctly says tap to resume, so the two surfaces disagree. Touch combat buttons also remain bright beneath the pause overlay.

Give pause its own resume/restart wording and quiet the combat pad while paused. Keep restart wording for victory/defeat. Source location: `game.js:1129`. The before/after state is saved in `evidence.json`.

## Captured flow

### 1. Character selection — clear on desktop, poor portrait readability

The selected border and distinct hero portraits work well. Roles sit close to the lower card rules. On a phone, names, roles, and the keyboard-heavy instructions become tiny; audio controls are visually larger than important game information.

![01 Desktop selection](output/playwright/visual-audit-2026-10-12/01-desktop-select.png)
![07 Phone selection](output/playwright/visual-audit-2026-10-12/07-mobile-select.png)

### 2. Start and movement — functional, visible sprite defects

The GO arrow, city setting, health/meter bars, and score are clear on desktop. Ordinary walk animation shows detached fragments and doubled silhouettes. The phone starts correctly and shows its pad, but gives the playfield little room.

![02 Desktop start](output/playwright/visual-audit-2026-10-12/02-desktop-start.png)
![03 Desktop walk fragments](output/playwright/visual-audit-2026-10-12/03-desktop-walk.png)
![08 Phone gameplay](output/playwright/visual-audit-2026-10-12/08-mobile-gameplay.png)

### 3. Desktop thrower: windup, flight, landing — readable

The new sprite is clean and stays anchored. The aiming line and fixed target communicate the attack location; the bottle remains distinct during its arc. Landing visibly reduces HP and shows a white player flash, impact marks, and `BOTTLE HIT!`. A nearby melee enemy can visually overlap the thrower's body, but the tell stays above them.

![04 Desktop thrower tell](output/playwright/visual-audit-2026-10-12/04-desktop-thrower-tell.png)
![05 Desktop bottle flight](output/playwright/visual-audit-2026-10-12/05-desktop-bottle-flight.png)
![06 Desktop landing feedback](output/playwright/visual-audit-2026-10-12/06-desktop-bottle-hit.png)

### 4. Responsive thrower and touch pad — portrait needs repair; landscape clearer

The same live windup was captured at 390×844, 320×568, and 844×390. The canvas retains its aspect ratio and controls fit inside the viewport, but fitting does not guarantee readable combat. At 320px, settings and action controls cover key attack information. Phone flight and landing remain visible, though labels are very small.

![09 Portrait thrower tell](output/playwright/visual-audit-2026-10-12/09-mobile-thrower-tell.png)
![09b Small phone overlap](output/playwright/visual-audit-2026-10-12/09b-small-phone-tell.png)
![10 Landscape thrower tell](output/playwright/visual-audit-2026-10-12/10-landscape-thrower-tell.png)
![11 Phone bottle flight](output/playwright/visual-audit-2026-10-12/11-mobile-bottle-flight.png)
![12 Phone bottle hit](output/playwright/visual-audit-2026-10-12/12-mobile-bottle-hit.png)

### 5. Pause and tap resume — works, inaccurate caption

Pause has a distinct cyan panel and darkens the stage. The visual caption claims tap restarts, while the tap actually resumes the same position/state. The phone's touch pad remains visually prominent behind the overlay.

![13 Phone pause](output/playwright/visual-audit-2026-10-12/13-mobile-pause.png)
![16 Wide pause caption](output/playwright/visual-audit-2026-10-12/16-wide-pause-caption.png)

### 6. Boss encounter — identifiable, animation artifacts persist

The larger boss, red ground tell, name, and attack label distinguish the final encounter in landscape. The hero's walk fragments and blended silhouettes still distract from the fight.

![14 Landscape boss tell](output/playwright/visual-audit-2026-10-12/14-landscape-boss.png)

### 7. Victory — reached, portrait copy remains small

The gold result panel has a clear state change and score. The fresh Kyle route cleared all four waves with `bossDefeated: true`, 72 HP, and score 4725. The phone's subtitle/restart copy remains very small.

![15 Phone victory](output/playwright/visual-audit-2026-10-12/15-mobile-result.png)

## Evidence and limits

State evidence: [evidence.json](output/playwright/visual-audit-2026-10-12/evidence.json). Browser warnings/errors captured in this run were empty. The audit used normal keyboard/pointer handlers and the existing `advanceTime` hook for exact animation captures; no health, meter, kills, or encounter progression were injected. Touch capability was emulated in the in-app browser. The final route used the visible pad's pointer handlers.

This is a visual and interaction audit in one browser, not a claim of full accessibility compliance. Tiny text, control coverage, and scaled touch targets are demonstrated; contrast ratios, screen-reader playability, reduced-motion behaviour, physical phone/controller usability, other browser engines, and audible playback were not audited. Source inspection also shows zoom disabled in the viewport metadata, making independent text-size adaptation especially valuable.

The temporary viewport/touch/test-time settings were reset after capture. No fixes, commits, pushes, or production changes were made during this audit.

## Repair verification — 12 October 2026

All five findings are closed in the local checkout:

- **V1:** Added measured base/special atlases and idle portraits for all five heroes. Walk contains only the five walk/run poses, excluding the jump pose. Every used pose has a consistent foot anchor and baseline; neighbouring special/uppercut cells are isolated too. All ten original hero sheets passed Git blob equality checks. The manifest and reproducible builder live under `sprites/runtime/` and `scripts/build-hero-sprites.mjs`.
- **V2:** Portrait phones now use a closer canvas camera, readable native roster/status/result UI, and a taller street. A 320px phone has an approximately 300×328px combat canvas, versus the old 320×180px letterbox. HUD labels stay 12px; in-canvas warnings have a 12px display floor. Desktop character roles/special names sit inside their cards. Canvas geometry preserves its intrinsic aspect ratio during resizing and rotation; world coordinates and combat timing remain unchanged.
- **V3:** Portrait HUD/audio occupy the header, while 44px touch controls sit below the combat region. The expanded mixer remains above the street. Both floor extremes (470 and 635) passed clear-warning checks at 320px and 390px. The same controls, keyboard mappings, and gamepad mappings are retained; portrait additionally offers an explicit PAUSE button.
- **V4:** All character animation draws use one authored pose, with 90 walking/special pose draws checked across the five heroes and both directions. Intentional invulnerability flicker and hit flashes remain.
- **V5:** Desktop pause explicitly distinguishes resume from restart. Portrait pause offers readable RESUME/RESTART controls and a background-tap resume action. The combat pad hides immediately while paused. Resume preserves the existing player state; restart returns to the starting position.

Validation passed: all 13 existing control/combat/route regression groups, all 10 focused thrower groups, seven new visual-repair groups, the bundled web-game client smoke, syntax checks, and `git diff --check`. Final unmodified-handler desktop and touch routes both cleared four waves and defeated the boss at victory, with Eric at 101/125 and 97/125 HP respectively. Captured warnings/errors were empty. Screenshots and atlas images were visually inspected. Rotation tests wait for the browser to paint its responsive layout before measuring it.

Evidence: [visual checks](output/playwright/visual-fixes-2026-10-12/focused/results.json), [control/route regressions](output/playwright/visual-fixes-2026-10-12/regression/results.json), [thrower checks](output/playwright/visual-fixes-2026-10-12/thrower/results.json).

Focused sprite, floor-edge, and projectile checks use controlled browser-only fixtures. The two full victory routes use the normal input handlers without injecting health, kills, or progression.

![Repaired phone selection](output/playwright/visual-fixes-2026-10-12/focused/phone-390-select.png)
![Small-phone warning at the lower floor edge](output/playwright/visual-fixes-2026-10-12/focused/phone-320-tell-635.png)
![Readable pause controls](output/playwright/visual-fixes-2026-10-12/focused/phone-390-pause.png)
![Repaired touch victory](output/playwright/visual-fixes-2026-10-12/regression/touch-victory.png)

The core remains a single dependency-free gameplay canvas, with native DOM UI for portrait menus/status and the existing touch/audio controls. Physical devices/controllers, other browser engines, audible playback, and full accessibility compliance remain unverified. These repairs are local and have not been committed, pushed, or deployed in this repair turn.

## 2026-10-14 follow-up

The earlier geometric draw-call check proved that each cell was drawn at the intended X, but did not prove that the opaque hero pixels were centered inside that cell. Rochelle's first idle pose exposed this gap: the packing heuristic centered one disconnected shoe (source X=52) rather than both feet (X=103.5). The builder now measures all floor pixels on standing poses, and the new animation-lab verification checks opaque idle pixel extents for all five heroes. Jump crops also include 16 extra source pixels above the row to preserve protruding hair.

Use `dev/animations.html` to reproduce runtime frames without gameplay setup. It shares frame rectangles/rendering with the game and provides source/roster comparisons, pose overlays, crop/anchor guides, and exact-frame links. Full-resolution inspected screenshots and results are in `output/playwright/animation-lab-2026-10-14/`. Clip playback is for pose inspection; combat timing/effects/collision verification remains in the gameplay and thrower suites.
