/** R4 refines presentation, never the R3 shell, structure or furniture footprints. */
export function createR4Design<T extends Record<string, any>>(base: T): T {
  const m: any = structuredClone(base);
  m.version = '14.0.0';
  const sign = m.objects.find((o: any) => o.id === 'r2-bar-sign');
  if (!sign) throw new Error('Missing bar sign');
  // Model rotations are clockwise: -65 produces a normal toward the living room (+x,+z).
  Object.assign(sign, {x:2.4,z:6.60,y:2.18,w:1.32,h:.34,d:.04,rotation:-65});
  sign.presentation = {primaryAudience:'living',minimumLowerEdgeM:2.18,
    clearanceBasis:'outside full kitchen glazing travel; concept, not installation acceptance'};
  const lamp = m.lighting.fixtures.find((f: any) => f.id === 'r2-bar-sign-light');
  Object.assign(lamp, {position:[2.64,2.64,6.82],target:[2.40,2.35,6.60],
    lumens:170,kelvin:3000,beamAngle:70,range:1.4});
  const evening = m.lighting?.scenes?.find((s: any) => s.id === 'aperitif');
  if (evening) evening.roomLevels.bar = {...evening.roomLevels.bar,
    task:.55,ambient:.30,accent:.42,decor:.60};
  m.homeDesign.r4Revision = {style:'Japanese warm home; clear by day, intimate and usable at night',
    inheritedSpatialRevision:'R3',structureChanged:false,
    signViews:[{id:'living-seated',position:[9.3,1.15,6.6]},
      {id:'living-standing',position:[9.3,1.74,7.5]},
      {id:'entry',position:[5.78,1.74,8.17]}]};
  for (const view of m.presentation.interiorViews) {
    // A full-height inward door must not obscure the bathroom's only preset.
    if (view.id === 'bath-main') Object.assign(view, {position:[5.88,1.65,1.70],
      target:[5.85,.95,.65],horizontalFov:100});
    if (view.id === 'kitchen-fridge') Object.assign(view, {position:[2.85,1.65,5.10],
      target:[3.38,1.25,3.95],horizontalFov:92});
  }
  m.presentation.interiorViews.push({id:'r4-bar-from-living',label:'客厅望向 MuKo’s Bar',
    position:[8.4,1.35,7.0],target:[2.4,1.85,6.6],horizontalFov:72});
  return m;
}
