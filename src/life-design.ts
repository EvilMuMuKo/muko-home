/** Final living-program overlay. Metres are unified concept coordinates, not a survey. */
export function createLifeDesign<T extends Record<string, any>>(base: T): T {
  const m: any = structuredClone(base);
  const get = (id: string) => m.objects.find((o: any) => o.id === id);
  const move = (id: string, patch: any) => {
    const o = get(id); if (!o) throw new Error(`Missing design object: ${id}`);
    const dx = (patch.x ?? o.x) - o.x, dz = (patch.z ?? o.z) - o.z;
    if (o.collisionParts) o.collisionParts = o.collisionParts.map((p: any) => ({...p,x:p.x+dx,z:p.z+dz}));
    Object.assign(o, patch); return o;
  };
  const add = (o: any) => m.objects.push(o);
  const fixture = (id: string, patch: any) => {
    const f = m.lighting.fixtures.find((f: any) => f.id === id); if (f) Object.assign(f, patch);
  };
  m.version = "10.0.0";
  m.objects = m.objects.filter((o: any) => !["bar-window-worktop", "bar-window-worktop-connector"].includes(o.id));

  // Reclassify the existing end alcove as a public refrigerator niche, with the
  // closed gas kitchen behind its own full-height partition. No shell grows.
  m.walls = m.walls.filter((w: any) => !["kitchen-side", "kitchen-notch-in", "kitchen-notch-return"].includes(w.id));
  m.walls.push({id:"kitchen-side",a:[3.5,3.4],b:[3.5,5.68],thickness:0.18,height:2.7,
    structuralStatus:"partition_change_requires_site_confirmation"});
  Object.assign(m.walls.find((w: any) => w.id === "kitchen-west"), {a:[3.5,5.68],b:[0,5.68]});
  m.rooms.find((r: any) => r.id === "kitchen").polygon = [[0,3.4],[3.5,3.4],[3.5,5.68],[0,5.68]];
  m.rooms.find((r: any) => r.id === "bar").polygon = [[0,5.68],[4.8,5.68],[4.8,8.45],[0,8.45]];
  m.rooms.find((r: any) => r.id === "hall").polygon = [[4.8,1.65],[6.9,1.65],[6.9,4.4],[11.65,4.4],[11.65,9.35],[7.95,9.35],[7.95,8.45],[4.8,8.45],[4.8,5.68],[3.5,5.68],[3.5,3.4],[4.8,3.4]];
  const kitchenDoor = m.openings.find((o: any) => o.id === "kitchen-door");
  kitchenDoor.center = [2.4,5.68]; kitchenDoor.panelClosedCenter = [2.4,5.56];
  move("kitchen-slider-panel", {z:5.56,rendererHidden:true,proxyOnly:true}); move("kitchen-door-leaf", {z:5.68});
  const fridge = move("kitchen-fridge", {room:"hall",x:4.045,z:4.05,w:0.91,d:0.75,h:1.85,rotation:90,
    label:"餐厨共享双门冰箱",doorLayout:"french_double",accessFace:"+x",
    useEnvelope:{x:4.95,z:4.05,w:0.9,d:1.2},dimensionStatus:"generic_full_size_appliance_budget_not_selected_product"});
  fridge.opening = {...fridge.opening, maxAngle:100, hinge:"double",drawerTravel:0.48};
  const surround = move("fridge-surround", {room:"hall",x:4.025,z:4.05,w:1.01,d:0.83,h:2.0,rotation:90});
  // Absolute component boxes remain world-aligned; this open shell cannot seal
  // the appliance or count its ventilation cavity as usable storage.
  surround.collisionParts = [
    {x:4.025,z:3.555,w:0.83,d:0.02,y:0,h:2,material:"oak"},
    {x:4.025,z:4.545,w:0.83,d:0.02,y:0,h:2,material:"oak"},
    {x:4.025,z:4.05,w:0.83,d:1.01,y:1.98,h:0.02,material:"oak"},
  ];
  move("upper-fridge", {room:"hall",x:4.025,z:4.05,y:2.08,w:1.01,d:0.83,h:0.5,rotation:90});
  add({id:"kitchen-prep-return",type:"cabinet_frame",room:"kitchen",x:3.08,z:4.8,y:0,w:1.1,d:0.65,h:0.9,rotation:-90,material:"oak",
    collisionParts:[
      {x:3.08,z:4.8,w:0.65,d:1.1,y:0.86,h:0.04,material:"stone"},
      {x:3.39,z:4.8,w:0.02,d:1.1,y:0.08,h:0.78,material:"oak"},
      ...[4.26,5.34].map(z=>({x:3.08,z,w:0.65,d:0.02,y:0.08,h:0.78,material:"oak"})),
    ]});
  add({id:"kitchen-airfryer",type:"counter_appliance",room:"kitchen",x:3.08,z:4.5,y:0.9,w:0.34,d:0.4,h:0.34,rotation:-90,material:"charcoal",appliance:"airfryer"});
  add({id:"kitchen-oven",type:"counter_appliance",room:"kitchen",x:3.08,z:4.96,y:0.16,w:0.6,d:0.55,h:0.6,rotation:-90,material:"charcoal",appliance:"oven"});
  add({id:"kitchen-prep-board",type:"tray",room:"kitchen",x:3.06,z:5.1,y:0.905,w:0.34,d:0.4,h:0.025,rotation:0,material:"oak"});

  // A real seated changing bench, flush to the entrance wall, and a separate
  // ventilated worn-again bay. Nothing projects into the former sofa pinch.
  move("entry-bench", {x:6.75,z:8.16,rotation:0});
  const shoes = move("entry-shoe", {x:7.5,z:8.16,w:0.6,d:0.36});
  // This cabinet's old component coordinates were authored for a 900mm unit.
  shoes.collisionParts = [
    ...[-1,1].map(s=>({x:7.5+s*0.29,z:8.16,w:0.02,d:0.36,y:0.08,h:1.02,material:"oak"})),
    ...[0.08,0.4,0.73,1.08].map(y=>({x:7.5,z:8.16,w:0.56,d:0.36,y,h:0.02,material:"oak"})),
    {x:7.5,z:8.33,w:0.56,d:0.02,y:0.1,h:0.98,material:"oak"},
  ];
  move("entry-pegboard", {x:6.75,z:8.29,y:1.12,w:0.65,h:0.7});
  move("key-tray", {x:6.75,z:8.18,y:1.13});
  add({id:"entry-worn-again",type:"ventilated_rail",room:"hall",x:7.5,z:8.14,y:1.14,w:0.6,d:0.4,h:0.82,rotation:0,material:"oak",purpose:"次净衣；与干净储衣、待洗衣篮分离",accessFace:"-z"});
  fixture("entry-shoe-low",{position:[7.5,0.12,7.96],target:[7.5,0.015,7.6],length:0.5});
  fixture("storage-entry-task",{position:[6.75,1.84,8.23],target:[6.75,1.15,8.10],anchor:"entry-pegboard",length:0.56});

  // Normal-height two-person dining belongs to the living room. The full-size
  // tabletop folds upright into its own parking strip, rather than vanishing.
  move("dining-table", {room:"living",x:11.0,z:9.06,w:1.1,d:0.7,h:0.74,rotation:0,shape:"rectangle"});
  move("dining-chair-left", {room:"living",x:8.27,z:8.78,w:0.5,d:0.55,h:0.88,rotation:0});
  move("dining-chair-right", {room:"living",x:8.27,z:9.03,w:0.5,d:0.55,h:0.88,rotation:0});
  const dining = m.homeDesign.dining;
  dining.role = "living_normal_height_daily_dining";
  dining.table.use = {x:9.3,z:7.8,widthM:1.1,depthM:0.7,heightM:0.74};
  dining.table.parkedEnvelope = {x:11.0,z:9.06,w:1.1,d:0.18,h:1.12,rotation:0,coordinateFrame:"world_aabb"};
  dining.table.provenance = "Full-size rectangular folding-table concept; hardware and transport require product selection";
  dining.chairs = [
    {id:"dining-chair-left",use:{x:8.5,z:7.8,w:0.5,d:0.55,pullbackM:0.35,rotation:90},park:{x:8.27,z:8.78,rotation:0,foldedDepthM:0.15,foldedHeightM:0.99}},
    {id:"dining-chair-right",use:{x:10.1,z:7.8,w:0.5,d:0.55,pullbackM:0.35,rotation:-90},park:{x:8.27,z:9.03,rotation:0,foldedDepthM:0.15,foldedHeightM:0.99}},
  ];
  dining.usePositions = {table:{x:9.3,z:7.8,rotation:0},chairs:dining.chairs.map((c:any)=>({id:c.id,...c.use}))};
  dining.sequence = {
    description:"沙发先后移，直立餐桌搬至餐位；折椅经沙发前通路逐把就位，最后放平桌面；收回时逆序",
    tablePath:[[11.0,9.06],[11.0,8.4],[9.3,7.8]],
    chairPaths:[[[8.27,8.78],[7.7,8.1],[8.15,7.8]],[[8.27,9.03],[7.7,8.1],[7.7,7.0],[10.45,7.0],[10.45,7.8]]],
    chairRetreatM:0.35, temporarySeatAvailable:false,
  };
  dining.stateEnvelopes = {deployed:{shape:"rectangle",w:1.1,d:0.7,h:0.74},folded:{shape:"upright_folded_table",w:1.1,d:0.18,h:1.12}};
  m.homeDesign.modularSofa.separated = [{x:8.35,z:6.55,rotation:175},{x:10.25,z:6.55,rotation:185}];
  m.homeDesign.modularSofa.meal = [{x:8.6625,z:6.0,rotation:180},{x:9.9375,z:6.0,rotation:180}];
  m.homeDesign.modularSofa.activity = [{x:8.6625,z:5.575,rotation:180},{x:9.9375,z:5.575,rotation:180}];
  m.homeDesign.mobileTV.poses[1] = {...m.homeDesign.mobileTV.poses[1],x:10.4,z:7.9,rotation:270};
  m.homeDesign.livingModes = {
    default:"relax",modes:["relax","dining","activity"],
    activityClearFloor:{minX:8.0,maxX:11.0,minZ:6.3,maxZ:8.4},
    diningSofaFrontPassageM:0.925,
    parking:{table:"dining-table",chairs:["dining-chair-left","dining-chair-right"],tv:"living-tv",sofa:"living-sofa"},
    note:"Furniture transition requires multiple actions; no one-move conversion claim; TV stays on its wheeled stand in all modes",
  };

  add({id:"reading-chair",type:"lounge_chair",room:"bar",x:1.6,z:6.65,y:0,w:0.86,d:0.88,h:0.82,rotation:-90,material:"salonClay"});
  add({id:"reading-records",type:"record_console",room:"bar",x:0.29,z:6.5,y:0,w:1.2,d:0.34,h:0.68,rotation:90,material:"salonDarkTimber",recordCountBudget:45,accessFace:"+x",placement:"below_bar_window",windowSillM:0.9,highestEquipmentTopM:0.765});
  add({id:"reading-side",type:"side_table",room:"bar",x:1.65,z:7.38,y:0,w:0.38,d:0.38,h:0.5,rotation:0,material:"oak"});
  add({id:"reading-lamp",type:"floor_lamp",room:"bar",x:1.9,z:5.98,y:0,w:0.3,d:0.3,h:1.55,rotation:0,material:"bronze"});
  m.homeDesign.readingNook = {chairId:"reading-chair",recordsId:"reading-records",mainDining:false,windowUncovered:true,recordsUnderWindow:true,frontAccessClearanceM:0.7,windowHandleAndTurntableLid:"site_and_product_confirmation"};
  m.homeDesign.barOperationCounter = {id:"s02-bar-prep",role:"coffee_cocktail_beer_service",noHighEquipmentAtWindow:true};

  // Collection is explicit: bottles on the two bottle-height levels, cups in
  // the compact upper tier and coffee cabinet. Mechanism bays are not storage.
  m.objects = m.objects.filter((o:any)=>!/^s02-(bottle|cup|stemware)-/.test(o.id));
  for (let level=0;level<2;level++) for(let i=0;i<6;i++) add({id:`s02-bottle-${level}-${i}`,type:"study_bottle",room:"bar",x:3.20+i*0.19,z:8.12,y:1.54+level*0.34,w:0.075,d:0.075,h:0.3,rotation:0,material:"glass"});
  for(let i=0;i<6;i++) add({id:`s02-cup-${i}`,type:"study_cup",room:"bar",x:3.2+i*0.19,z:8.12,y:2.218,w:0.09,d:0.09,h:0.12,rotation:0,material:"cream"});
  for(let i=0;i<4;i++) add({id:`s02-stemware-${i}`,type:"study_stemware",room:"bar",x:3.30+i*0.25,z:8.15,y:1.33,w:0.09,d:0.09,h:0.23,rotation:0,material:"glass"});
  m.homeDesign.collection = {bottles:12,cupsAndGlasses:24,displayCups:6,hangingGlasses:4,closedCoffeeCabinetCups:14,
    cupBudgetDiameterM:0.1,bottleBudgetDiameterM:0.09,bottleBudgetHeightM:0.31,
    status:"concept_item_budget; individual_collection_sizes_pending",displayUnitId:"upper-bar-display",displayUnitCount:1};

  add({id:"guest-drinks-fridge",type:"fridge",room:"guest",x:3.45,z:0.55,y:0,w:0.48,d:0.52,h:0.85,rotation:180,doorLayout:"single_drinks",accessFace:"+z",ventilation:{sideM:0.05,rearM:0.06,topM:0.1},opening:{hinge:"left",maxAngle:95,drawerTravel:0},material:"charcoal"});
  m.homeDesign.guestBed.drinksFridgeId = "guest-drinks-fridge";
  m.homeDesign.guestBed.sleepingRole = "intentional_second_sleep_room";
  m.homeDesign.guestBed.mattressComfortStatus = "1400mm mechanism retained; two-person comfort requires owner trial; not shrunk for layout";
  get("master-work-pegboard").purpose = "headphones_cables_stationery_shared_photos";
  add({id:"master-speaker-left",type:"speaker",room:"master",x:8.03,z:4.13,y:0.78,w:0.13,d:0.15,h:0.23,rotation:0,material:"charcoal"});
  add({id:"master-speaker-right",type:"speaker",room:"master",x:10.37,z:4.13,y:0.78,w:0.13,d:0.15,h:0.23,rotation:0,material:"charcoal"});

  // Retain existing sanitary positions and drains. A bevelled enclosure frees
  // the pinch at the toilet front instead of pretending a solid box is usable.
  get("shower").enclosure = {kind:"bevel_corner",cutM:0.5,doorClearWidthM:0.65,hingedInward:true,heightM:2.05};
  get("toilet").smartProvision = {socketRequired:true,wetZoneAndCircuit:"site_electrician_confirmation"};
  const bathDoor = m.openings.find((o:any)=>o.id==="bath-door"); bathDoor.openAngle = -90;
  add({id:"bath-heater",type:"ceiling_equipment",room:"bath",x:5.8,z:0.75,y:2.62,w:0.6,d:0.3,h:0.055,rotation:0,material:"cream",purpose:"浴霸与排风；风管、潮湿分区及电路待核"});
  m.homeDesign.bathroom = {retainedDrainObjectIds:["toilet","vanity","shower"],doorSwing:"outward_concept",shower:"bevel_corner_900x1050mm_bounding_box_not_full_clear_rectangle",status:"conditional_concept_requires_full_scale_trial_and_site_drain_check"};

  // A modest hinged work flap belongs to the housekeeping cabinet, not a
  // dining table borrowed from another room. Stowed unless explicitly used.
  add({id:"laundry-folding-shelf",type:"folding_shelf",room:"balcony",x:12.25,z:8.595,y:0.92,w:0.62,d:0.42,h:0.025,rotation:0,material:"oak"});
  m.homeDesign.laundryWorkflow = {foldingSurface:"laundry-folding-shelf",fixedSortingTableRemoved:true,basketStoredIn:"housekeeping-cabinet",shelfDefault:"folded",shelfUse:"washer doors closed; take basket then unfold; refold before circulation",cabinetDoorAndBasketRetrieval:"model_joint_check_required"};

  fixture("dining-offset-1",{roomId:"living",spaceIds:["living"],position:[9.02,2.55,7.8],target:[9.02,0.75,7.8]});
  fixture("dining-offset-2",{roomId:"living",spaceIds:["living"],position:[9.58,2.55,7.8],target:[9.58,0.75,7.8]});
  m.lighting.fixtures.push({id:"reading-local-task",roomId:"bar",spaceIds:["bar"],position:[1.9,1.35,5.98],target:[1.6,0.8,6.65],group:"task",kelvin:3000,lumens:230,type:"spot",beamAngle:65,range:1.8,shadowPriority:0,anchor:"reading-lamp",installation:"shielded reading standard lamp"});
  for (const scene of m.lighting.scenes) {
    scene.fixtureLevels = {...scene.fixtureLevels,"reading-local-task":scene.daylight?0.25:scene.id==="cinema"?0:0.8};
    if(scene.id==="day-public") {
      scene.ambientIntensity=1.05;
      for(const id of ["master-headboard","master-reading-1","master-reading-2","master-wall-wash"]) scene.fixtureLevels[id]=0;
    }
    if (scene.id==="two-person-dining") scene.viewId="living-seated";
  }
  const views=m.presentation.interiorViews;
  for(const v of views) {
    if(v.id==="salon-bar-seat") Object.assign(v,{label:"阅读与唱片角",position:[3.3,1.5,7.2],target:[0.5,0.85,6.5]});
    if(v.id==="kitchen-main") Object.assign(v,{position:[2.2,1.65,5.28],target:[0.9,1.05,4.15]});
    if(v.id==="bath-main") Object.assign(v,{position:[5.83,1.6,1.5],target:[5.9,1.15,0.43]});
    if(v.id==="entry-storage") Object.assign(v,{position:[6.8,1.6,6.9],target:[7.05,1.35,8.16]});
  }
  m.homeDesign.lifeRevision = {
    version:1,base:"ff3730a2",evidence:"latest_user_charter_and_annotation",dimensionStatus:"virtual_not_surveyed",
    kitchen:{previousGrossAreaM2:8.82,proposedGrossAreaM2:7.98,partitionShiftM:0.28,externalFridge:true,areaIncreaseClaim:false,structureChange:"BLOCKED_until_partition_verified"},
    entry:{benchRetained:true,wornAgainBay:true},
    conditional:["kitchen_partitions","fridge_exact_hinge_and_ventilation","bath_clearances_and_enclosure_hardware","sofa_bed_two_person_comfort","folding_furniture_hardware","site_daylight"],
  };
  m.homeDesign.assumptions = m.homeDesign.assumptions.filter((a:any)=>!["daily-dining","hatch-clearance"].includes(a.id));
  m.homeDesign.assumptions.push({id:"daily-living-meals",statement:"客厅正常桌椅用餐，原餐厅为阅读唱片角；所有家具停车及转换均为概念模型",status:"concept"});
  return m as T;
}
