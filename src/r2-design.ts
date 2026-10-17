import type { R2Bay } from './r2-cabinet-mesh';

/** Approved R2 relationships. Metre values remain an unmeasured concept budget. */
export function createR2Design<T extends Record<string, any>>(base: T): T {
  const m: any = structuredClone(base);
  m.version = '12.0.0';
  const get = (id: string) => m.objects.find((o: any) => o.id === id);
  const removed = new Set<string>();
  const remove = (...ids: string[]) => ids.forEach(id => removed.add(id));
  const move = (id: string, patch: any) => {
    const o = get(id); if (!o) throw new Error(`R2 missing ${id}`);
    const dx = (patch.x ?? o.x) - o.x, dz = (patch.z ?? o.z) - o.z;
    if (o.collisionParts) o.collisionParts = o.collisionParts.map((p: any) => ({...p,x:p.x+dx,z:p.z+dz}));
    if (o.useEnvelope) o.useEnvelope = {...o.useEnvelope,x:o.useEnvelope.x+dx,z:o.useEnvelope.z+dz};
    Object.assign(o,patch); return o;
  };
  const bay = (x: number,w: number,y: number,h: number,door: 'solid'|'open',purpose: string,shelves: number[]=[]): R2Bay => ({x,w,y,h,door,purpose,shelves});
  const cabinet = (id:string,room:string,x:number,z:number,w:number,d:number,h:number,rotation:number,bays:R2Bay[],label:string) => {
    const o = {id,type:'wall_storage',room,x,z,w,d,h,y:0,rotation,label,
      fronts:['solid'],shelves:[],purpose:label,access:'mixed',material:'cabinetPaint',caseMaterial:'oak',
      insideMaterial:'cabinetInterior',coordinateStatus:'R2_virtual_budget_not_surveyed',
      r2Cabinet:{bays,frameMaterial:'oak',frontMaterial:'cabinetPaint',backMaterial:'cabinetInterior'}};
    remove(id); m.objects.push(o); removed.delete(id); return o;
  };
  const slab = (id:string,room:string,x:number,z:number,w:number,d:number,y:number,h:number,material='barStone') => {
    m.objects.push({id,type:'cabinet_frame',room,x,z,w,d,y,h,rotation:0,material,
      collisionParts:[{x,z,w,d,y,h,material}]});
  };
  const cutSlab = (id:string,room:string,x:number,z:number,w:number,d:number,y:number,h:number,hole:{x:number,z:number,w:number,d:number}) => {
    const x0=x-w/2,x1=x+w/2,z0=z-d/2,z1=z+d/2;
    const a=hole.x-hole.w/2,b=hole.x+hole.w/2,c=hole.z-hole.d/2,e=hole.z+hole.d/2;
    const pieces=[[x0,a,z0,z1],[b,x1,z0,z1],[a,b,z0,c],[a,b,e,z1]].filter(([u,v,p,q])=>v-u>.001&&q-p>.001);
    m.objects.push({id,type:'cabinet_frame',room,x,z,w,d,y,h,rotation:0,material:'barStone',sinkCutout:hole,
      collisionParts:pieces.map(([u,v,p,q])=>({x:(u+v)/2,z:(p+q)/2,w:v-u,d:q-p,y,h,material:'barStone'}))});
  };

  // Open the photographed west-facing guest entry, not merely reverse its leaf.
  Object.assign(m.openings.find((o:any)=>o.id==='guest-door'),{
    wallId:'guest-west',center:[4.35,3.4],hinge:[3.92,3.4],width:.86,rotation:0,openAngle:90,
    spatialNote:'R2 west-facing doorway relationship; jamb dimensions and wall alteration unverified'});
  // Virtual partition records exist for adjacency; openings remove their entire height.
  Object.assign(m.walls.find((w:any)=>w.id==='kitchen-side'),{a:[3.92,3.4],b:[3.92,5.85],height:2.7});
  Object.assign(m.walls.find((w:any)=>w.id==='kitchen-west'),{a:[0,5.85],b:[3.92,5.85],height:2.7});
  m.openings = m.openings.filter((o:any)=>o.id!=='kitchen-door');
  m.openings.push(
    {id:'kitchen-glass-boundary',type:'open',wallId:'kitchen-side',center:[3.92,4.625],width:2.45,height:2.7},
    {id:'kitchen-counter-boundary',type:'open',wallId:'kitchen-west',center:[1.96,5.85],width:3.92,height:2.7},
    {id:'kitchen-door',type:'sliding_door',standalone:true,r2Glazing:'side',center:[3.92,5.08],width:1.54,height:2.7,
      thickness:.025,panelClosedCenter:[3.92,5.08],travel:[0,-.97]},
    {id:'kitchen-pass-window',type:'sliding_door',standalone:true,r2Glazing:'counter',center:[1.96,5.85],width:3.92,
      height:1.75,sill:.95,thickness:.025,panelClosedCenter:[1.96,5.85],travel:[0,0]});
  m.rooms.find((r:any)=>r.id==='kitchen').polygon=[[0,3.4],[3.92,3.4],[3.92,5.85],[0,5.85]];
  m.rooms.find((r:any)=>r.id==='bar').polygon=[[0,5.85],[4.9,5.85],[4.9,8.45],[0,8.45]];
  m.rooms.find((r:any)=>r.id==='hall').polygon=[[4.8,2],[6.9,2],[6.9,7.3],[7.95,7.3],[7.95,8.45],[4.9,8.45],[4.9,5.85],[3.92,5.85],[3.92,3.4],[4.8,3.4]];

  m.rooms.find((r:any)=>r.id==='living').polygon=[[6.9,4.4],[11.65,4.4],[11.65,9.35],[7.95,9.35],[7.95,7.3],[6.9,7.3]];

  remove('kitchen-top','kitchen-left','kitchen-prep-return','upper-kitchen-sink','fridge-surround','upper-fridge','kitchen-slider-panel');
  // Fronts face the actual operator; usable openings remain void, not solid blocks.
  cabinet('r2-kitchen-back','kitchen',1.485,3.79,2.79,.60,.915,180,
    [bay(-.9,.99,.09,.825,'solid','utensils'),bay(.47,1.75,.09,.825,'solid','appliance')],'后排操作收纳');
  cabinet('r2-kitchen-sink-base','kitchen',.415,4.645,1.11,.65,.915,90,
    [bay(0,1.11,.09,.825,'solid','appliance')],'窗下水槽柜');
  slab('r2-back-worktop','kitchen',1.485,3.79,2.79,.60,.915,.035);
  cutSlab('r2-sink-worktop','kitchen',.415,4.645,.65,1.11,.915,.035,{x:.415,z:4.7,w:.508,d:.408});
  get('r2-kitchen-sink-base').r2Cabinet.cutouts=[{x:.055,z:0,w:.408,d:.508,y0:.74,y1:1.0}];
  // Basin, stone cutout and cabinet top opening share the same actual bowl dimensions.
  move('kitchen-hob',{y:.95}); move('kitchen-sink',{x:.415,y:.95});
  move('kitchen-bin',{x:.34,z:4.65});
  cabinet('r2-kitchen-peninsula','kitchen',1.395,5.525,2.61,.65,.915,0,
    [bay(-.96,.69,.09,.825,'solid','utensils'),bay(-.295,.64,.09,.825,'open','appliance'),bay(.665,1.28,.09,.825,'open','appliance')],
    '半岛备餐与出品');
  slab('r2-main-countertop','kitchen',1.395,5.525,2.61,.65,.915,.035);
  cabinet('r2-shallow-peninsula','kitchen',3.31,5.675,1.22,.35,.915,0,
    [bay(0,1.22,.09,.825,'solid','utensils')],'冰箱前浅备物台');
  slab('r2-shallow-countertop','kitchen',3.31,5.675,1.22,.35,.915,.035);
  move('kitchen-dishwasher',{x:1.1,z:5.525,y:.075,rotation:0});
  move('kitchen-oven',{x:2.15,z:5.52,y:.16,rotation:0});
  move('kitchen-airfryer',{x:1.85,z:5.53,y:.95,rotation:0});
  move('kitchen-prep-board',{x:2.36,z:5.53,y:.955,rotation:0});
  move('kitchen-fridge',{x:3.4,z:3.935,rotation:180,accessFace:'+z'});
  cabinet('r2-fridge-cabinet','kitchen',3.4,3.90,1.04,.82,2.7,180,
    [bay(0,1.04,.09,1.86,'open','appliance'),bay(0,1.04,1.95,.75,'solid','seasonal')],'冰箱通顶柜位');
  for (const id of ['upper-kitchen-left','upper-kitchen-prep']) {
    const o=get(id); if(o) {o.h=2.7-o.y; o.z=3.665;}
  }

  // One integrated service wall replaces the scattered lower/upper bar units.
  remove('wet-bar','s02-bar-coffee','s02-bar-prep','s02-bar-beer','s02-bar-storage','upper-bar-coffee','upper-bar-display');
  const barBays:R2Bay[]=[]; let start=-3.51/2;
  for (const [width,purpose] of [[.6,'appliance'],[1.05,'appliance'],[.55,'display'],[.8,'beer'],[.51,'supplies']] as const) {
    const cx=start+width/2;
    barBays.push(bay(cx,width,.09,.825,purpose==='beer'?'open':'solid',purpose));
    barBays.push(bay(cx,width,.95,.75,purpose==='supplies'?'solid':'open',purpose));
    barBays.push(bay(cx,width,1.7,1.0,purpose==='display'?'open':'solid',purpose,purpose==='display'?[.10,.42,.74]:[.48]));
    start+=width;
  }
  cabinet('r2-waterbar','bar',1.845,7.985,3.51,.75,2.7,0,barBays,'咖啡精酿与酒具通顶柜');
  cutSlab('r2-bar-niche-counter','bar',1.845,7.985,3.47,.71,.915,.035,{x:.39,z:7.98,w:.388,d:.348});
  get('r2-waterbar').r2Cabinet.cutouts=[{x:.39-1.845,z:7.98-7.985,w:.388,d:.348,y0:.74,y1:1.01}];
  // Keep small-appliance external dimensions, place them inside their assigned niches.
  move('coffee-machine',{x:1.02,z:7.98});move('grinder',{x:1.46,z:7.98});
  const beerShift=2.69-get('kegerator').x;
  for(const id of ['kegerator','beer-font','keg','co2-cylinder']) move(id,{x:get(id).x+beerShift});
  // Reuse the former rinse basin as a real small sink in the 600-wide module.
  m.objects.push({id:'r2-bar-sink',type:'sink',room:'bar',x:.39,z:7.98,y:.95,w:.46,d:.42,h:.07,rotation:0});
  const rinse=get('s02-bar-basin');
  if(rinse) move(rinse.id,{x:.39,z:7.98,y:.95});
  for(const o of m.objects) {
    if(o.id.startsWith('s02-bottle-')) { const parts=o.id.split('-');const row=Number(parts.at(-2)),col=Number(parts.at(-1));o.x=1.81+(col%3)*.15;o.z=7.92+(col>=3?.13:0);o.y=1.818+row*.32; }
    if(o.id.startsWith('s02-cup-') || o.id.startsWith('s02-stemware-')) {o.rendererHidden=true;removed.add(o.id);}
  }
  move('reading-chair',{x:1.05,z:6.7});move('reading-side',{x:1.75,z:6.9});move('reading-lamp',{x:.58,z:7.35});
  m.homeDesign.barOperationCounter={id:'r2-waterbar',role:'equipment_niches_plus_kitchen_peninsula_service',noHighEquipmentAtWindow:true};
  m.homeDesign.suspendedBarRack=false;
  m.homeDesign.lifeRevision.kitchen={...m.homeDesign.lifeRevision.kitchen,externalFridge:false,proposedGrossAreaM2:3.92*2.45,areaIncreaseClaim:false,activeRevision:'R2',structureChange:'BLOCKED_until_partition_verified'};
  m.homeDesign.laundryWorkflow.basketStoredIn='r2-housekeeping';
  m.homeDesign.accessoryReconciliation.tv.repurposed=['r2-living-shallow','r2-living-deep'];
  // Historical route budgets are not valid after the peninsula/glass boundary moves.
  delete m.homeDesign.entryIslandDining.routingCorridor;
  m.homeDesign.entryIslandDining.rearBarMaxX=3.6;
  m.homeDesign.entryIslandDining.routeValidation='R2 browser navigation plus joint-use pending; no inherited V11 clearance claim';

  remove('entry-shoe','entry-bench','upper-entry','entry-worn-again');
  move('entry-pegboard',{x:6.8,z:8.27,w:.6,y:.95,h:.85});
  cabinet('r2-entry','hall',7.155,8.085,1.41,.55,2.7,0,
    [bay(-.355,.70,.09,.35,'open','bench'),bay(-.355,.70,.44,1.61,'open','pegboard'),bay(-.355,.70,2.05,.65,'solid','seasonal'),
     bay(.35,.71,.09,1.96,'solid','wardrobe'),bay(.35,.71,2.05,.65,'solid','seasonal')],'换鞋洞洞板与次净衣整合柜');

  remove('living-tv-console','upper-living-media','upper-living-side');
  cabinet('r2-living-shallow','living',9.05,4.65,3.8,.32,2.7,180,
    [bay(-1.425,.95,.09,2.61,'solid','books',[.4,.8,1.2,1.6,2.05]),bay(1.425,.95,.09,2.61,'solid','books',[.4,.8,1.2,1.6,2.05]),
     bay(0,1.9,.09,.76,'solid','small-items'),bay(0,1.9,.85,.95,'open','books',[.475]),bay(0,1.9,1.8,.9,'solid','seasonal',[.45])],
    '客厅通顶浅收纳');
  cabinet('r2-living-deep','living',8.64,8.96,1.2,.6,2.7,0,
    [bay(0,1.2,.09,1.86,'solid','folded-storage'),bay(0,1.2,1.95,.75,'solid','seasonal')],'备用桌椅或行李整仓');
  // Preserve the full 1650mm screen; a schematic parking rectangle never shrinks it.
  m.homeDesign.mobileTV.poses[0]={x:10.15,z:8.90,rotation:180,label:'日常停靠'};
  move('living-tv',{x:10.15});
  move('ps5',{x:10.15,z:8.99});
  move('robot-dock',{x:11.34,z:9.05});
  move('plant-living',{x:9.1,z:4.66,y:.859});
  // Folded furniture has a named real stowage pose, not invisible deletion.
  const dining=m.homeDesign.dining;
  move('dining-table',{x:8.64,z:8.82,y:.12});
  dining.table.parkedEnvelope={x:8.64,z:8.82,w:1.1,d:.18,h:1.12,rotation:0,coordinateFrame:'world_aabb'};
  for(const [id,z] of [['dining-chair-left',9.00],['dining-chair-right',9.16]] as const) {
    move(id,{x:8.64,z,y:.12}); const c=dining.chairs.find((c:any)=>c.id===id);c.park={...c.park,x:8.64,z};
  }
  dining.table.use={...dining.table.use,x:9.3,z:7.55};
  dining.table.foldedPositionStatus='R2 deep cabinet; manual carry mechanism and effort pending';
  dining.usePositions.table={...dining.usePositions.table,x:9.3,z:7.55};
  for(const c of dining.chairs) {
    c.use={...c.use,z:7.55};
    const o=get(c.id);o.retreat={...o.retreat,x:c.use.x+Math.sign(c.use.x-9.3)*c.use.pullbackM,z:7.55,distanceM:c.use.pullbackM};
  }
  dining.usePositions.chairs=dining.chairs.map((c:any)=>({...c.use,id:c.id}));
  m.homeDesign.modularSofa.meal=m.homeDesign.modularSofa.meal.map((p:any)=>({...p,z:5.75}));
  for(const f of m.lighting.fixtures.filter((f:any)=>/^dining-offset-/.test(f.id))) {f.position[2]=7.55;f.target[2]=7.55;}
  dining.sequence={...dining.sequence,description:'先开柜门，直立抬出桌椅；右椅保持朝向绕过折桌与柜门，再转向展开并入位',tablePath:[[8.64,8.82],[8.64,7.95],[9.3,7.55]],chairPaths:[[[8.64,9.00],[8.64,7.85],[8.1,7.55]],[[8.64,9.16],[8.64,7.85],[10.5,7.85],[10.5,7.55]]],
    mechanismStatus:'manual_carry_and_reposition_demo_not_automatic_hardware',
    chairTransitRotationDeg:0,chairTurnProgress:[.89,.935],chairUnfoldProgress:[.94,.975],chairTuckProgress:[.975,1],
    temporaryChairCenters:[[8.1,7.55],[10.5,7.55]],
    carryHeightRule:'retain parked lift until folded envelope passes cabinet front, then lower outside',
    validationBoundary:'mesh collision sampling; carrying effort, people and product mechanism not accepted'};

  remove('guest-wardrobe','upper-guest-wardrobe','master-wardrobe','upper-master-wardrobe','housekeeping-cabinet','upper-housekeeping');
  cabinet('r2-guest-wardrobe','guest',4.3,1.2,1.9,.6,2.7,-90,
    [bay(-.325,1.25,.09,2.16,'solid','linen',[.35,.7,1.05,1.4,1.75]),bay(.625,.65,.09,.91,'open','appliance'),bay(.625,.65,1.0,1.25,'solid','wardrobe'),bay(0,1.9,2.25,.45,'solid','seasonal')],
    '客房床品与可选饮料冰箱柜');
  move('guest-drinks-fridge',{x:4.28,z:.575,rotation:-90,accessFace:'-x'});
  cabinet('r2-master-wardrobe','master',7.3,1.46,2.6,.6,2.7,90,
    [bay(-.975,.65,.09,2.06,'solid','wardrobe'),bay(-.325,.65,.09,2.06,'solid','wardrobe'),bay(.325,.65,.09,2.06,'solid','linen',[.35,.7,1.05,1.4]),bay(.975,.65,.09,2.06,'solid','linen',[.5,1.0,1.5]),bay(0,2.6,2.15,.55,'solid','seasonal')],
    '主卧衣柜整合到顶');
  const deskUpper=get('upper-master-work'); if(deskUpper) {deskUpper.y=2.05;deskUpper.h=.65;deskUpper.d=.30;deskUpper.z=4.16;}
  cabinet('r2-housekeeping','balcony',12.25,8.93,.62,.65,2.7,0,
    [bay(0,.62,.09,1.86,'solid','utility'),bay(0,.62,1.95,.75,'solid','supplies',[.35])],
    '阳台长物与顶部耗材柜');

  m.objects.push({id:'r2-bar-sign',type:'bar_sign',room:'bar',x:1.8,z:6.03,y:2.26,w:1.2,h:.28,d:.04,rotation:0,text:'MuKo’s Bar'});
  m.homeDesign.collection={...m.homeDesign.collection,displayUnitId:'r2-waterbar',displayUnitCount:1,displayCups:0,hangingGlasses:0,closedCoffeeCabinetCups:24,status:'concept_budget_not_verified_capacity'};
  m.homeDesign.styleReference={publicNote:'69671635000000000e03c4fd',visibleScope:'public text and first image only; remaining carousel blocked by login',interpretation:'restrained hard finishes, warm red-brown timber, pale woven textiles, distributed warm lamps',noFixedCoffeeTable:true};
  m.lighting.fixtures.push({id:'r2-bar-sign-light',roomId:'bar',spaceIds:['bar','hall'],position:[1.8,2.62,6.22],target:[1.8,2.4,6.03],group:'decor',kelvin:2700,lumens:110,type:'spot',beamAngle:65,range:1.2,shadowPriority:0,installation:'small shielded sign wash',anchor:'r2-bar-sign',dimensionStatus:'concept_budget_not_surveyed',fluxStatus:'concept_not_photometric_acceptance'});
  // Derived anchor updates avoid old fixtures embedded in new tall cabinets.
  const anchorReplacement:Record<string,string>={'upper-bar-coffee':'r2-waterbar','upper-bar-display':'r2-waterbar','s02-bar-coffee':'r2-waterbar','s02-bar-prep':'r2-waterbar','upper-entry':'r2-entry','entry-shoe':'r2-entry','upper-living-media':'r2-living-shallow','living-tv-console':'r2-living-shallow','upper-living-side':'r2-living-shallow','upper-guest-wardrobe':'r2-guest-wardrobe','upper-master-wardrobe':'r2-master-wardrobe','master-wardrobe':'r2-master-wardrobe','housekeeping-cabinet':'r2-housekeeping'};
  m.lighting.fixtures=m.lighting.fixtures.filter((f:any)=>!f.id.includes('bar-loop'));
  for(const f of m.lighting.fixtures) {
    if(anchorReplacement[f.anchor]) f.anchor=anchorReplacement[f.anchor];
    if(f.id.startsWith('display-level')) {
      const level=Number(f.id.at(-1))-1, shelf=1.8+level*.32;
      f.position=[2.015,Math.min(2.66,shelf+.28),8.18];f.target=[2.015,shelf+.05,7.93];f.length=.43;
    }
    if(f.anchor==='r2-waterbar' && !f.id.startsWith('display-level')) {f.position=[1.23,1.63,7.86];f.target=[1.23,1.0,7.95];}
    if(f.anchor==='r2-entry') {f.position=[6.80,.12,7.83];f.target=[6.80,.02,7.55];}
    if(f.anchor==='r2-living-shallow') {f.position=[9.05,1.77,4.75];f.target=[9.05,1.2,4.70];}
    if(f.anchor==='upper-kitchen-sink') {f.anchor='kitchen-sink';f.position=[.6,2.55,4.65];f.target=[.4,.95,4.7];}
  }
  const evening=m.lighting.scenes.find((s:any)=>s.id==='aperitif');
  if(evening) evening.roomLevels.bar={...evening.roomLevels.bar,task:.36};
  m.objects=m.objects.filter((o:any)=>!removed.has(o.id));
  // Refresh face-aware cabinets, collision geometry and diagnostics from one final layer.
  for(const o of m.objects.filter((o:any)=>o.r2Cabinet)) {
    o.accessFace=({0:'-z',90:'+x',180:'+z','-90':'-x'} as any)[o.rotation];
    const normal=({0:[0,-1],90:[1,0],180:[0,1],'-90':[-1,0]} as Record<string,number[]>)[o.rotation];
    o.useEnvelope={x:o.x+normal[0]*(o.d/2+.3),z:o.z+normal[1]*(o.d/2+.3),w:o.w,d:.6,h:1.88,y:0,rotation:o.rotation,coordinateFrame:'oriented_world',source:'R2_operator_budget_not_joint_acceptance'};
  }
  const views:Record<string,any>={
    'kitchen-main':{label:'半开放厨房',position:[3.35,1.65,5.08],target:[1.35,1.05,4.35],horizontalFov:91},
    'kitchen-fridge':{position:[3.25,1.65,5.15],target:[3.4,1.3,3.95],horizontalFov:82},
    'hall-view':{position:[6.15,1.65,5.75],target:[2.5,1.15,6.05],horizontalFov:92},
    'entry-view':{position:[5.78,1.74,8.17],target:[2.2,1.45,6.05],horizontalFov:90},
    'salon-bar-seat':{position:[3.95,1.65,6.65],target:[1.7,1.4,7.99],horizontalFov:94},
    's02-rack':{label:'酒具与设备收纳',position:[3.5,1.65,6.7],target:[2.0,1.9,7.98],horizontalFov:85}
  };
  for(const v of m.presentation.interiorViews) if(views[v.id]) Object.assign(v,views[v.id]);
  m.homeDesign.r2Revision={
    source:'approved R2 2D relationship; unmeasured dimensions',version:12,
    alignment:{guestJambAndGlassX:3.92,fridgeFrontAndColumnFarFaceZ:4.31,livingCabinetAndColumnNearFaceZ:4.81},
    clearances:{mainKitchenM:1.11,fridgeZoneM:1.19,barZoneM:1.76},
    glazing:{sideSpanM:1.54,targetClearOpeningM:.90,hardware:'three linked leaves; concept overlap, frame and seals pending'},
    noFixedCoffeeTable:true,removedIds:[...removed],
    conditions:['structure, existing jamb and utility survey','fridge full-door/drawer/person combination','glass hardware and smoke boundary','folded furniture product and retrieval','physical phone testing']};
  m.rooms.find((r:any)=>r.id==='kitchen').name='半开放厨房';
  return m;
}
