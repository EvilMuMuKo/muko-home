> 审核快照与关闭记录：以下为 Grok 在 R3 中间稿（1700mm客房柜）上的独立源代码审查，保留原文。之后主代理已将柜长改1650mm、中心z=1.075m、床品格1000mm与冰箱格650mm；冰箱世界位置保持不变。平面台面虚线和玻璃跨度标注已修复；“桌椅都在柜下”改为“柜前下方：折桌在前、折椅在下”。600mm身体的100mm余量是概念身体包络推算，非凳子本身170mm余量；不申报实体舒适通过。最终漫步及回归见 validation.json，不继承此快照的未运行状态。

# R3 geometry review

Independent read of `src/r3-design.ts`, `src/r2-glazing.ts`, `src/bay-life.ts`, `docs/r3-design.md`, `scripts/render-r3-drawings.mjs`, and the generated `src/generated-layout.json` those sources produce (`version` 13.0.0). Every metre below is a concept budget. Nothing here was surveyed. This pass did not run the browser, the geometry suite, or a walk. It does not accept photoreal appearance, glazing hardware, comfort, or a phone run.

Stated status from this round, not re-checked here: five geometry tests PASS. An earlier walk failed on the guest-door free-end path. R3 shortens that cabinet. The walk still needs a retest. Do not treat the gap below as a pass.

Yaw used for doors and cabinets is the scene convention (`closed = -deg(rotation)`), which matches the floor-plan comment that positive `rotation` heads from +x toward +z.

## Guest cabinet and the inward leaf

`r2-guest-wardrobe` is `x=4.3`, `z=1.10`, `w=1.70`, `d=0.60`, `rotation=-90` (`src/r3-design.ts` 66–69). Under that yaw, width runs along z, so the body is `z=0.25` to `1.95` and `x=4.00` to `4.60`. The north face moved from the R2 value `2.15` to `1.95`.

The drinks bay stays on the same world z. R2 bay `x=0.625` at cabinet `z=1.20` and R3 bay `x=0.525` at cabinet `z=1.10` both land at world `z=0.575`, which is `guest-drinks-fridge.z`. Linen is the bay that lost 200 mm (`w` 1.25 → 1.05). The comment at lines 64–65 matches the boxes.

`guest-door` is hinge `[3.92, 3.4]`, `width=0.86`, `rotation=0`, `openAngle=-90`. The open free end is `(3.92, 2.54)`. Distance from that point to the cabinet north face is `2.54 - 1.95 = 0.59` m. The nearest cabinet corner `(4.00, 1.95)` is about 1.45 m from the hinge, outside the 0.86 m leaf. The leaf and the cabinet boxes do not meet. Whether a person can pass the free end is exactly the failed walk and is not retested here.

## Island: 500 top, 200 case, two stools

`s02-entry-return` is `x=4.95`, `w=0.50`, `d=1.60`, `h=0.95`, `rotation=0`: x `4.70–5.20`, z `6.725–8.325`. `entryIsland` repeats those bounds, `kneeVoidDepthM=0.30`, `closedStorageDepthM=0.20`. `column-handdrawn` stays `x=5.15`, `w=0.50` (x `4.90–5.40`). Same 500 mm width, centres 200 mm apart, as `docs/r3-design.md` line 9.

`r3-entry-island-base` is `x=5.10`, `d=0.20`, `w=1.60`, `rotation=90`. Depth maps onto x, so the case is x `5.00–5.20` (east 200 mm) and the west 300 mm of the top has no case. `accessFace` after the rotation rewrite is `+x`, toward the entry side of the case. The two stools are `entry-counter-stool-0/1` at `x=4.40`, `z=7.075` and `7.775` (700 mm apart), size `0.46` square. East edge `4.63` is outside the top edge `4.70`. Pulled centres are `x=4.00`, `pulledWestMinX=3.77`.

Doc line 10’s “约 100 mm” is not a stored clearance. The model stores stool edge `3.77` and `rearBarMaxX=3.60` (170 mm). A 600 mm body is not an object.

## Floor plan and counter station

`scripts/render-r3-drawings.mjs` 25 rotates furniture with SVG `rotate(rotation)`. For the island that draws the 500 mm top along x and, at rotation 90, the 200 mm case along x. Section 04 uses `base.d` for the x-depth (`line 54`), which is the rotated depth, and `stool.w` (`line 56`). Stools are `rotation=90` in the layout, but `w=d=0.46`, so the section width does not flip.

Line 31 says the 500 mm top is a dashed outline. Line 25 sets `stroke-dasharray` only for suspended cabinets. The island top is an undashed empty fill.

Line 30 draws the counter corner as x `0–3.92` at `z=5.85`. `kitchen-pass-window` is `width=3.989`, `center=[1.9945, 5.85]` (`r3-design.ts` 77–78), so the leaf run ends at `x=3.989`. `buildR2Glazing` places the counter root at `x=0`, `z=5.85` (`r2-glazing.ts` 21) and spans `o.width`, which matches `3.989/2=1.9945`. The side leaf still runs `z=4.31` to `5.85` at `x=3.92`. Its end post is `endPostOffsetM=0.069` (`r3-design.ts` 76), i.e. `x=3.989`. The counter `r3Corner` is only `{omitEndPost:true}`, so that side post is the shared corner post. The floor-plan stroke stops 69 mm short of that span.

## Suspended cabinet and folded storage

`r2-living-deep` is `y=1.40`, `h=1.30`, `d=0.35`, `z=9.085`, `rotation=0` (`r3-design.ts` 57–58). Underside is `y=1.40`. Footprint z is `8.91–9.260`. Bays are `small-items` and `linen`, not `folded-storage`.

`entryStorage.tvSideStorage` says folded furniture max height `1.24` m. `dining.table.parkedEnvelope` is still `y` context plus `h=1.12` at object `dining-table.y=0.12`, so `0.12+1.12=1.24`. That addition is the whole of the 1.24 claim.

The envelope itself is `z=8.82`, `d=0.18`, so it occupies z `8.73–8.91`. The suspended body starts at `z=8.91`. The folded table meets the front face and is not under the cabinet. Chair parks stay at `z=9.00` and `z=9.16` (`foldedHeightM=0.99`), which do fall inside `8.91–9.26`. `docs/r3-design.md` line 12 calls both the table and the chairs furniture under the cabinet. R3 does not move `parkedEnvelope`, `dining.table` position, or the chair parks when it shifts `r2-living-deep` from `z=8.96`, `d=0.60` to `z=9.085`, `d=0.35`. The sequence path still starts at `[8.64, 8.82]`.

## Other

`docs/r3-design.md` line 35 points at `docs/r3/validation.json`. That file is not in `docs/r3`. This review does not invent its PASS/FAIL rows.

`r3Revision.glazing` still says selected hardware is pending (`r3-design.ts` 96). `r2-glazing.ts` 70–71 labels the mechanism `concept_mechanism_not_selected_hardware`.
