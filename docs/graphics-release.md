# Graphics release

Concept preview of the current residential scene. This note records what the source implements. It is not a photometric acceptance, a site survey, or an art-direction sign-off.

Physical validation: **NOT RUN**. AAA visual quality: **NOT APPROVED**. The automated suite defines 90 regression checks. The exact-head [PR 6 CI run](https://github.com/EvilMuMuKo/muko-home/pull/6/checks) is the authority for their final execution result. Native desktop WebGPU capture and continuous home-walk checks described below passed.

## Pipeline

Startup in `src/scene.js` creates the renderer, initializes LTC area-light data, then upgrades materials before any mesh builders run.

After the meshes, the `day-public` lighting, and the entrance pose are ready, startup calls `await Ht.compileAsync(Ct, ct)` for the selected actual entrance camera before hiding the loading screen or resuming controls. `Ka` selects `presentation.defaultView` (`entry-view`); `enterGhostWalk()` then poses `ct`, and `Jt.pause()` holds the loop until compile finishes. On success, `#loading` gains class `done` and `Jt.resume()` runs. On failure the scene hides interaction controls (`#control-panel` and `#panel-toggle`), hides the canvas, and shows `#fallback` with static `preview.jpg`. This is an implemented loading path, not proof of final visual or performance acceptance.

`src/renderer.ts` requests WebGPU unless `?renderer=` says otherwise. It probes `navigator.gpu` before taking a canvas context. Success uses `WebGPURenderer` with antialiasing. Failure, or `?renderer=webgl`, uses `WebGLRenderer` (recorded backend `WebGL2`) on the same canvas. `?gpuFallback` records a previous WebGPU device loss. A later WebGPU device loss reloads once with `renderer=webgl` and `gpuFallback=1`.

The scene tone mapping is ACES Filmic. The output color space is sRGB. Exposure is the active lighting scene's `exposure`, or 0.95 in daylight and 1.12 otherwise.

Environment lighting is Three.js `RoomEnvironment` converted by `PMREMGenerator.fromScene` with sigma `0.04`. The generator and the room scene are disposed after the texture is assigned. Initial `environmentIntensity` is `0.2`; the active scene then overrides it. This is a generic room PMREM, not a capture of this home.

Shadows are manual (`shadowMap.autoUpdate` is false). The directional sun uses a 1024² map on mobile and 2048² on desktop. A roof proxy on layer 1 stays in the sun shadow pass when the overview camera hides the roof. Interior spot shadows use the spot budget below. Area lights do not cast shadows.

Post-processing runs only when `quality.postprocessing` is true (`src/quality.ts`: not mobile and not economical).

- WebGPU: `src/gpu-effects.ts` adds a TSL bloom to the scene-pass color. Strength `0.015` (night `0.16` via `setNight`), radius `0.18`, threshold `1.5`, resolution scale `0.25`. The pipeline output node is `color.add(glow)`. The audit flag `rayTracing` is `false`.
- WebGL2: `EffectComposer` with 4× MSAA targets, `RenderPass`, `GTAOPass` (radius `0.12`, thickness `0.08`, scale `0.55`, samples `12`), and `OutputPass`.
- Mobile, economical devices, and a WebGPU path that does not get the finish: direct `renderer.render`. No fullscreen AO or bloom. The README mobile statement matches this gate.

`quality.mobile` is `matchMedia("(max-width:1000px), (pointer:coarse)")`. Economical is Save-Data, `deviceMemory <= 4`, or `hardwareConcurrency <= 4`.

## Materials

`refineMaterials` (`src/material-detail.ts`) loads twelve maps: oak, floor, linen, and plaster, each with color, normal, and roughness. Color uses sRGB. Normal and roughness use no color space. Repeats are `1 / tileMetres`, so one tile covers a fixed metre size. Anisotropy is `min(8, device max or 4)`. If a roughness map loads, material roughness is set to `1` so the map stays absolute. A failed map is recorded and that channel is left unset.

| Family | Runtime tile | Maps | Device files | Applied to |
| --- | --- | --- | --- | --- |
| Oak (`white_oak_veneer`) | 0.5 m × 0.5 m | color, normal, roughness | one WebP set | `oak` (tint `#ffffff`, normal scale `0.17`), `darkoak` (tint `#b49a78`) |
| Floor (`wood_floor`) | 1.7 m × 1.7 m | color, normal, roughness | `floor-*-desktop.webp` when not mobile; otherwise `floor-*.webp` | `floor` (tint `#ffffff`, normal scale `0.15`) |
| Linen (`rough_linen`) | 0.28 m × 0.28 m | color, normal, roughness | one WebP set | `linen` (`#f0e9de`), `sage` (`#a3ad96`); normal scale `0.2` |
| Plaster (`white_plaster_02`) | 1.5 m × 1.5 m | color, normal, roughness | one WebP set | `plaster` (tint `#ffffff`, normal scale `0.15`, roughness `1`) |

Captured source sizes in `materials/sources.json` differ slightly for floor (`1.6999996900558472` m) and linen (about `0.271` m). The runtime uses the table above. Oak, linen, and plaster have no desktop file variant in the loader. There is no evidence of further scanned families.

Stone is not a scan. `mineralSurface()` builds a 128² color, normal, and roughness set, tile `0.6` m, and assigns it to `stone` (normal scale `0.35`, roughness `1`, tint `#ffffff`).

Other authored responses, without those four scans:

- Paint: `upperPaint` and `cabinetPaint` share a 64² procedural roughness microtexture, repeat `16`.
- Cabinet interior and book cloths borrow oak or linen normal and roughness at normal scale `0.06`, roughness `1`.
- `steel` / `bronze`: metalness `1`, roughness `0.28` / `0.36`, roughness map cleared.
- `mirror`: metalness `1`, roughness `0.035`, no maps.
- `displayGlass`: physical material, roughness `0.045`, IOR `1.5`, thickness `0.008` m. Mobile: transmission `0`, transparent, opacity `0.28`, depth write off. Desktop: transmission `0.9`, opacity `1`, depth write on.

On desktop only, `enhanceSurfaces` copies oak, dark oak, linen, sage, steel, bronze, cabinet paint, and upper paint onto `MeshPhysicalMaterial`. Linen and sage get sheen `0.35` / sheen roughness `0.9`. Cabinet paint gets clearcoat `0.16` / clearcoat roughness `0.5`. Steel and bronze get anisotropy `0.25`. Mobile keeps the standard materials.

## Soft bedding

The mattress case in `src/scene.js` builds the linen mattress, then `buildSoftBedding` (`src/soft-bedding.ts`) adds bedding on that parent. The mattress mesh is unchanged. This is authored static geometry and deformation, not cloth physics, animation, or simulation.

- Two linen pillows (`soft-bedding:pillow`), each a 24×16 superellipsoid with a flattened mattress contact face, plus piping on each pillow (`soft-bedding:pillow-piping`: closed tube, 48 segments, 4 radial, radius `0.0013` m).
- One sage runner (`soft-bedding:runner`): a 24×16 grid, width `bed.w + 0.01`, with a shallow static wave and a short draped foot. Sage is cloned and set to `DoubleSide`.
- Those source supports are **3072** new triangles: 768 per pillow, 384 per piping tube, and 768 for the runner. The count is the authored index total. It is not a performance acceptance.

## Wall-paint palette

Art-direction palette only. It is not a verified visual-quality approval, a photometric acceptance, or a sign-off. Physical validation stays **NOT RUN**. AAA visual quality stays **NOT APPROVED**.

Requested bold wall painting: bar north terracotta `#ad7359`; bar service back wall moss `#6d7967`; master headboard/east dark sage `#74806e`; other master walls warm mushroom `#8d877b`; living back wall balcony-west tobacco greige `#bda68f`; other walls outside the master stay warm white/oat. Cinema side `#485149`, front `#303933`, ceiling `#53594f`. Current `roomPalette` / `wallColour` store the same master, bar, living, and cinema values (`masterSage`, `masterMushroom`, bar `north` clay, bar `west-left` moss, living `balcony-west` tobacco, other living `oat`, cinema side / `guest-west` front / ceiling).

`masterWallcover` in `src/room-finish.ts` is a linen clone, colour `#ffffff`, roughness `1`, `normalScale` `0.055`, with vertex colours on. Sheen `0.12` and sheen roughness `0.95` are set only when that clone is a `MeshPhysicalMaterial`, which is the desktop upgrade. The linen-based wallcover is applied on the master face only (a master-room face with a dominant Z normal). Neighbouring wall faces keep plaster (`roomPlaster`). Adjacent groups of the same material are merged. The runtime does not cap the group count. The wallcover test expects at most 3 groups on its sample box.

Six final native Chrome / WebGPU frames were captured and inspected: bar day/night, living night, master day/night/work. The master frames show the current dark-sage and mushroom wallcover, revised bedding, and continuous headboard wash. These are appearance checks, not pixel-derived colour accuracy or photometric acceptance. Forty-two additional first-person frames cover eight rooms plus public day/night views, captured during one continuous keyboard/joystick walk with no position teleport. All eight room arrivals and a nearby refrigerator action passed; no page errors or missing resources occurred. The read-only look API was checked not to move the camera.

A same-Chrome 960×540, DPR 1 comparison against `e69a45c` used actual WebGPU and WASM on both sides. First-ready time was 1416 ms baseline / 1796 ms candidate. After warm-up, CPU render-submission median was 1.7 / 2.0 ms, P95 2.4 / 2.7 ms, with 238 / 237 render submissions during a four-second turn. Both had zero idle renders and identical configured light budgets. Browser/driver caches were not reset; one sequential run cannot establish cold-start causality, GPU frame time or physical-phone FPS. An earlier candidate run took 10.9 seconds before the explicit entrance precompile; the later result is not a guarantee for all devices.

`node scripts/gpu-visual-audit.mjs`, `node scripts/whole-home-walk-audit.mjs --base-url=http://localhost:4173/`, and `node scripts/render-comparison.mjs --baseline-url URL --candidate-url URL --out FILE` reproduce the native checks where Chrome and WebGPU are available. `capture-entry-preview.mjs` updates the fallback from the current entrance model. Local full-size evidence is delivered under `outputs/MuKo Home 游戏化材质升级/`, outside the public repository.

Floor contact darkening is a CPU bake in `src/baked-occlusion.ts` into each floor's `aoMap` on **uv1** (256² mobile, 512² desktop). uv1 is normalized per floor. That is near-contact darkening of static footprints, not bounced light. Movable grounding is a separate unlit radial patch (`src/dynamic-contact.ts`, `toneMapped: false`, opacity clamped to `0.2`). The helper's stated draw-call upper bound is 8. Current attachments are the two sofa modules and `living-tv`. The constant is not a runtime clamp.

## Lighting budget

Verified in `src/quality.ts` and `Qg` in `src/scene.js`.

Total light slots: **4** mobile economical, **6** mobile, **12** desktop (economical does not lower the desktop slot count).

LTC area slots: **1 on mobile, 2 on desktop**. They are subtracted from the total, so the spot pool is `lightSlots - areaBudget`:

| Profile | Total slots | Area (LTC) | Spots |
| --- | --- | --- | --- |
| Mobile economical | 4 | 1 | 3 |
| Mobile | 6 | 1 | 5 |
| Desktop | 12 | 2 | 10 |

`type === "line"` fixtures compete for the area slots. Every other active fixture competes for the spot slots. `allocateLighting` (`src/lighting-allocation.ts`) ranks by score. The local room is the selected room when the view is not `all`; otherwise `observerRoom` uses the polygon under the observer. Living is tested before the overlapping hall. That room reserves one `task` / `work` / `reading` source, then caps at 3 lights on mobile or 4 on desktop. Other rooms cap at 2. Those caps apply inside each pool, and the slot argument stops the list.

Each frame's area slot calls `alignAreaLight`. The strip is `fixture.length` wide and `0.035` m high. Local −Z aims at the fixture target. Intensity is `lumens / (width * height * π) * level * previewScale`, then clamped to `250`. The model scale is `0.025`. `castShadow` stays false and `areaLightPreviewOnly` is set. This is a preview approximation.

Spot intensity on the active pooled path is `min(2.8, baseIntensity * level)`. Shadow-casting spots are the first `shadowLights` entries after the highest `shadowPriority`: **1** mobile, **2** desktop, map **512²** / **1024²**. Unused shadow maps in the pool are 1×1. Area lights are not in that list.

LTC data loads once per backend in `initAreaLighting`: WebGL `RectAreaLightUniformsLib.init()`, WebGPU `RectAreaLightTexturesLib.init()` passed to `RectAreaLightNode.setLTC`.

A hemisphere fill (`ambient`) and one directional sun remain outside this slot pool. Sun direction comes from `src/daylight.ts`: azimuth `155°`, altitude `42°`, status `concept_directional_sun_not_site_simulation`.

## Anchor corrections

`reviseHomeLighting` (`src/lighting-revision.ts`) runs from home design. Revision id `final-furniture-anchors-2026-10-16`. Its own scope string is "concept visual lighting; no surveyed daylight or photometric acceptance". Default scene becomes `day-public`.

Corrected ids: `dining-offset-1`, `dining-offset-2`, `bar-task`, `display-level-1`, `display-level-2`, `display-level-3`, `living-wall-cove`, `balcony-laundry`, `master-reading-1`, `master-reading-2`.

- Dining offsets follow the expanded dining-table path, height `2.55` m, ±`0.28` m in X, `200` lm, beam `58°`, when that path and the table exist.
- `bar-task` sits under the coffee cabinet, aimed forward and down. The installation string says concept position.
- Display levels sit on the display shelves, aimed into the cabinet.
- `living-wall-cove` drops its anchor, uses `600` lm, and is labeled a concealed cornice uplight that still needs site confirmation.
- `balcony-laundry` is a ceiling task aim at the laundry basket. Concept position.
- Master reading lights sit at the bed edges, `130` lm, beam `45°`.
- `bar-wall-wash`, `master-wall-wash`, and `corridor-wash` use beam `80°` and lumens capped at `300`.
- Daylight scenes force night levels to `0`, including night-group fixture levels.
- `aperitif` and `game`: ambient `0.36`, environment `0.17`. `cinema`: ambient `0.28`, environment `0.13`.

## Limits

No evidence in `src/` of ray-traced rendering, global illumination, lightmaps, or a scene light-probe grid. The walk-target filter uses a `Raycaster` against walls. That is interaction, not a lighting algorithm.

Do not describe the PMREM as a scene-accurate reflection or an indirect bake. Do not describe the floor AO as global illumination. Do not describe the sun as a surveyed solar study. Missing daylight inputs listed in code: surveyed true north, latitude/longitude, date and time, floor and neighbouring obstructions, glazing transmittance.

## Remaining asset requirements

These are still open. Current stand-ins are named so they are not mistaken for the missing assets.

- **Tailored cloth.** Curtains are a 9×19 Verlet grid on a `0.26` m × `2.36` m plane (`src/cloth.ts`) using a cloned linen material. There is no tailored panel, pattern, or drape asset.
- **Seams.** `addUpholsterySeam` extrudes a `0.0017` m tube around cushions that pass a size gate. There is no seam texture or stitch map.
- **Local reflection / indirect bake.** Lighting uses the generic room PMREM plus the static floor contact bake and the dynamic contact patches. No room capture, no probe volume, and no indirect lightmap is loaded.
- **Daylight site capture.** The sun is the fixed concept direction above. The missing survey inputs are still listed in `daylightStudy.missingInputs`.

## Review findings

Accepted:

- **Pinned `ShapeGeometry` already maps physical XY. `metricUV` writes physical position coordinates for consistency across geometry builders.** `ShapeGeometry` sets `uv` from `vertex.x`, `vertex.y`. Floors still call `metricUV(new ShapeGeometry(...))` in `src/scene.js`. `metricUV` (`src/texture-mapping.ts`) writes those position coordinates by dominant face: a top face uses XZ, an X-dominant side uses ZY, otherwise XY. That write keeps builders on one convention. It is not a repair of a 0–1 scale bug. With repeat `1 / tileMetres`, one UV unit is one metre on the map. `uv1` stays a separate channel: normalized floor AO mapping for the contact bake, not albedo or roughness.
- **`RenderPipeline` applies `renderOutput` automatically. Do not double-tone.** Three.js `RenderPipeline.outputColorTransform` defaults to `true`, and `_updateContext` wraps `outputNode` in `renderOutput(outputNode, toneMapping, outputColorSpace)`. `createGPUFinish` sets `outputNode` to scene color plus bloom and leaves `outputColorTransform` at the default. A second `renderOutput`, or turning the transform off without adding exactly one manual output node, is not what this path does.
- **Material upgrade runs before mesh build, so the current clone order is safe.** `ew()` awaits `refineMaterials`, then `enhanceSurfaces`, `configureRoomMaterials`, and `prepareSalonMaterials`. `bw()` awaits `ew()` before `ow()`, `lw()`, furniture, interior, and architecture mesh builders. Room and salon clones therefore copy maps and desktop physical upgrades that are already assigned. The floor AO clone happens later, on the built floor, and only adds `aoMap`.

Rejected:

- **The WebGPU finish must call `renderOutput` itself.** Rejected for the current `gpu-effects.ts`. The pipeline already applies it. Wrapping `color.add(glow)` in another `renderOutput` would tone-map and convert twice.
- **Cloning before mesh build drops the texture upgrade.** Rejected for the current `bw()` / `ew()` order. A clone taken before `refineMaterials` would miss later map assignments. That is not the order in source.
- **Scene-accurate probes, path tracing, or a finished indirect bake.** Rejected. No implementation evidence. The environment helper is `RoomEnvironment` plus PMREM only.
- **Area-light count outside the 4 / 6 / 12 pools.** Rejected. The only area budget in source is the one-or-two slot carve-out in the table above.
