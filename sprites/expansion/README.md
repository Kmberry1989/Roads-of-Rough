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

These are source sheets and are not yet referenced by `game.js`. Frame rectangles should be measured and recorded when their matching mechanics are implemented.

The five hero and heavy enemy sheets retain backgrounds close to the current magenta-key workflow. The thrower and environment sheets contain dark gradient backgrounds and require an approved extraction pass or loader-specific masking before runtime use. Keep the generated originals intact while preparing derived runtime sheets.
