# District background layers

Each campaign district has a dedicated panoramic street scene, composited as its own scrolling background layer behind the shared foreground road art.

| District | Asset | Landmark details |
| --- | --- | --- |
| Downtown | `downtown.png` | Neon arcade and pawnshop signs, brick apartments, deep alley |
| Neon Market | `neon-market.png` | Night-market stalls, lanterns, arcade storefronts |
| Harborline | `harborline.png` | Warehouses, shipping containers, dock cranes, water |
| Old Quarter | `old-quarter.png` | Historic brick rowhouses and vintage theater |
| Skyway Heights | `skyway-heights.png` | Elevated transit, skybridges, glass towers |
| Floodways | `floodways.png` | Flood gates, pump station, canal walls |
| Crown Terminal | `crown-terminal.png` | Art-deco station facade, columns, clock |

Generated images are wide panoramas; the runtime preserves their aspect ratio and alternates mirrored repeats to soften tile seams. `game.js` supplies the per-district color grade and composes the shared road layers in front.

Downtown's refreshed art was generated from the original arcade-and-pawnshop scene. The original `sprites/backdrop_city.png` remains unchanged.
