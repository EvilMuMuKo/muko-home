# MuKo Home V9

V9 keeps the V8 building shell and the confirmed column. Dimensions remain adjustable concept values, not a surveyed construction design.

## Layout and furniture

- The entrance return keeps the unchanged column's 500 mm cross-section. The latest user decision permits a narrower 405×895 mm pull-out worktop: two 447.5×405×18 mm leaves, three conceptual 540 mm rail stages and a 464×864×277 mm enclosed upper mechanism pocket. A flush front drops, the folded packet extends, then its inner leaf unfolds toward the cabinet; reverse movement hides it again. Worktop height is 875 mm, below the 950 mm fixed island. The long upper side is closed to hide the mechanism; two lower open bays remain. The old upward flap and its exposed receiver/struts are removed. Salice/ATIM Lunch 450 is the dimensional reference; the model is not factory CAD, verified hardware or installation/load approval.
- The working bar stays available for coffee, drinks, keg equipment, cleaning and storage. The low window-side surface is 850 mm high and 400 mm deep. A light suspended loop and one compact three-tier display add vertical use without a continuous bottle wall.
- A 960 mm round table and two folding chairs have explicit stowed and deployed poses. Their animation moves/unfolds the table first, carries the first chair around its perimeter, then places the second chair. It is a concept assembly, not manufacturer CAD. There is no permanent entrance perch: the hatch remains an occasional cup/light-food surface and the main passage stays clear.
- Living-room television uses a four-caster lockable stand with PS5 shelf, integrated short device cables and two movable poses. Unplug wall power before moving; VESA, payload and anti-tip certification remain pending. The low cabinet returns to the inner wall.
- Two 1275×1050 mm sofa modules connect into the full 2550 mm seat without a middle armrest; they can separate and turn independently. Recessed feet/glides and releasable connectors are shown. The central floor has no fixed coffee table; the balcony route stays behind/beside seating.
- The complete 1800×2000 mm mattress and bed frame return to their original V8 orientation and position; anchored bedside lighting follows the original bed relationship. The Windows and MacBook zones join into a 2600×750 mm inline workbench on the wall opposite the bed. Both chairs face the same wall; no corner return remains. Clearances remain conditional; static gaps are not simultaneous-user acceptance.
- Two bay windows project outward by an initial 600 mm. Their solid 900 mm ledges are not counted as walking floor, low seats, or hollow structural storage.
- Laundry has operable washer/dryer doors and an actual-size basket in the lower housekeeping bay. The fixed sorting table was removed because it blocked cabinet access; the deployed dining table doubles as a clean folding surface. Dishwasher front and basket are articulated.

## Presentation

One landscape viewer, three tabs: space, day/night, furniture. Redundant scene cards, route demonstrations, physical toy controls, repeated viewpoint buttons and the separate storage catalogue have been removed from the client UI. Room viewpoints use a dropdown. Furniture actions are filtered to the selected room. Legacy programmatic inspection APIs remain available for regression checks. The old route player and avatar generation have been removed from runtime code.

Arrival starts directly in first-person walking. Enlarged independent left movement and right rate-controlled look sticks support simultaneous touch; WASD/arrows and IJKL provide keyboard equivalents. Walls retain real door openings, window sills remain solid, and live door leaves/major furniture participate in collision. The circular body footprint remains inside the modeled floor, slides along walls and resolves feasible animated-object overlap without crossing walls. Cached mesh hulls avoid rebuilding unchanged collision geometry. This game collision proxy is not physical circulation acceptance. Idle walking suspends rendering.

Two perforated pegboards serve the inline workbench and entrance daily items. They have actual through-holes, stand-off air gaps, hooks and removable accessories; the entrance board replaces the old display cubby and floating hooks. Oil, wet-preparation and service-access areas retain clear surfaces. The entrance return now opens on its +x long side toward the foyer. Plants use curved thin leaves, branches and separate pot/soil materials, replacing ellipsoid blobs. Stemware has shaped bowls and stems; toilet and laundry basket have actual hollow forms. A whole-scene inventory checks missing objects and non-finite geometry, supplemented by view-by-view visual inspection.

Visible light choices are day, evening, cinema. Daylight uses a declared concept sun direction (azimuth155°, altitude42°, +x=south, -z=east), clear-glazing shadows are disabled and the roof remains in the shadow pass when hidden from the camera. It is not a location/date-specific daylight simulation: true north, site coordinates, surrounding buildings, floor and glazing properties are unknown.

## Source and verification

`home-design.ts` generates the final layout and states. `home-mesh.ts` consumes its dimensions and movement paths. `daylight.ts` defines the study assumptions. `window.homePresentation.getModel()` exports the final data; `getHomeDesign()` adds measured articulated bounds and runtime daylight status. All viewpoints share the same scene.

Keep the existing Three.js/Vite stack and mobile quality tiers. No new mobile full-screen AO/bloom or real-time reflections are added. Static room batching excludes articulated parts.

Run `npm ci`, `npm run build`, and `npm test`. Set `CHROMIUM_PATH` when local Chromium is not at `/usr/bin/chromium`. `scripts/v9-audit.mjs` captures comparable render evidence against a running server; `scripts/v9-compare.mjs` compares those reports. Software-renderer timing does not measure physical-phone FPS.

Component sweeps use sampled visible-mesh AABBs and explicit tolerances; reports must retain limitations for body envelopes, coupled tasks, surveyed fit and hardware loads. Browser checks do not certify construction or everyday joint use.

## Equipment transition cleanup

The current mobile-TV layout owns its PS5, two supported controller charging bases, power-pack bracket and short internal cable. The former fixed screen-wash light and scene temperature overrides are removed. The perimeter low cabinet, upper cabinet and side cabinet remain useful, with explicit daily-storage roles and no television/PS5 installation assigned to them. Old coffee table, rear cabinet, flip-up furniture, entry display and laundry folding unit are excluded from the selected model; the storage ledger now names the actual replacements. See `equipment-reconciliation.md` for the inventory and verification boundary.
