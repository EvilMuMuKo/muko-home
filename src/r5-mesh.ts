import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {metricUV} from './texture-mapping';

type Mats=Record<string,THREE.Material>;
export type R5Motion={
  cinema?:THREE.Group;
  chair?:THREE.Object3D;
  bed?:{root:THREE.Group; leaves:THREE.Group[]; cushions:THREE.Mesh[]; pillow:THREE.Mesh};
};
type Motion={model?:any;r5?:R5Motion;mobileTV?:{group:THREE.Group;object:any}};
function box(g:THREE.Object3D,m:Mats,w:number,h:number,d:number,x:number,y:number,z:number,mat='oak',r=.006){
 const geo=metricUV(new RoundedBoxGeometry(w,h,d,1,Math.min(r,w/4,h/4,d/4)));
 const a=new THREE.Mesh(geo,m[mat]||m.oak);a.position.set(x,y,z);a.castShadow=true;a.receiveShadow=true;g.add(a);return a;
}
function wheel(g:THREE.Group,m:Mats,x:number,z:number){
 const a=new THREE.Mesh(new THREE.CylinderGeometry(.045,.045,.035,12),m.charcoal||m.oak);
 a.rotation.z=Math.PI/2;a.position.set(x,.055,z);a.castShadow=true;g.add(a);
 box(g,m,.025,.05,.025,x,.095,z,'steel');box(g,m,.045,.012,.065,x,.10,z,'bronze');
}

/** Current furniture reads the approved dimension data, instead of scaling historical TV meshes. */
export function buildR5Furniture(g:THREE.Group,o:any,m:Mats,motion:Motion){
 if(o.type==='subwoofer'){
  box(g,m,o.w,o.h,o.d,0,o.h/2,0,'salonTimber',.012);
  box(g,m,o.w-.03,o.h-.04,.006,0,o.h/2,o.d/2+.002,'charcoal',.008);
  return true;
 }
 if(o.id==='study-monitor'){
  box(g,m,.22,.016,.16,0,.008,0,'steel');
  box(g,m,.035,.11,.035,0,.071,.018,'steel');
  box(g,m,.62,.32,.045,0,.23,0,'charcoal',.008);
  box(g,m,.58,.28,.003,0,.23,-.024,'screen',.002);
  return true;
 }
 if(o.type==='mobile_tv'&&o.screen){
  const state=motion.r5||=( {} );
  const {w,h,centerHeightM:y}=o.screen,bw=o.stand.w,bd=o.stand.d;
  box(g,m,w,h,.060,0,y,0,'charcoal',.012).name=`${o.id}:body`;
  box(g,m,1.872876,1.053493,.002,0,y,.031,'screen',.001).name=`${o.id}:screen`;
  for(const x of [-.10,.10])box(g,m,.035,1.16,.045,x,.73,-.08,'bronze');
  box(g,m,.64,.075,.09,0,1.26,-.06,'steel');
  for(const z of [-bd/2+.045,bd/2-.045]){
   box(g,m,bw,.032,.032,0,.125,z,'steel');
   for(const x of [-bw/2+.035,bw/2-.035])wheel(g,m,x,z);
  }
  box(g,m,.035,.032,bd-.09,0,.125,0,'steel');
  const shelf=box(g,m,o.id==='living-tv'?.78:.94,.024,.44,0,.515,-.04,'salonTimber');
  shelf.name=o.id==='living-tv'?'home:mobile-device-shelf':'cinema:mobile-device-shelf';
  const prefix=o.id==='living-tv'?'home':'cinema';
  const pack=box(g,m,.18,.045,.075,0,.43,-.11,'charcoal');pack.name=`${prefix}:mobile-power-pack`;
  box(g,m,.34,.012,.11,0,.402,-.11,'steel');
  const wire=new THREE.CatmullRomCurve3([new THREE.Vector3(0,1.23,-.12),new THREE.Vector3(.04,.88,-.12),new THREE.Vector3(0,.55,-.17)]);
  const cable=new THREE.Mesh(new THREE.TubeGeometry(wire,10,.004,5,false),m.charcoal||m.oak);g.add(cable);
  // The unplugged supply lead travels on the stand; never draw a permanent live lead across the floor.
  const lead=box(g,m,.08,.08,.014,.24,.37,-.14,'charcoal',.015);lead.name=`${prefix}:stowed-supply-lead`;
  if(o.id==='living-tv'){
   const dock=new THREE.Group();dock.name='home:mobile-game-dock';dock.position.set(0,.527,.095);g.add(dock);
   for(const x of [-.265,.265]){
    box(dock,m,.15,.014,.085,x,.007,0,'charcoal').name=`home:controller-base-${x<0?'left':'right'}`;
    const c=new THREE.Group();c.name=`home:game-controller-${x<0?'left':'right'}`;c.position.set(x,.012,0);dock.add(c);
    box(c,m,.12,.024,.055,0,.014,0,'cream',.012);
    for(const sign of [-1,1]){
     box(c,m,.035,.028,.065,sign*.049,.019,.015,'cream',.012).rotation.y=sign*.22;
     box(c,m,.012,.006,.012,sign*.023,.031,.005,'charcoal');
    }
   }
   motion.mobileTV={group:g,object:o};
  }else {
   state.cinema=g;
   box(g,m,.85,.06,.13,0,.557,.08,'charcoal',.012).name='cinema:mobile-soundbar';
  }
  g.userData.animated=true;return true;
 }
 if(o.type==='study_desk'){
  box(g,m,o.w,.03,o.d,0,.725,0,'oak',.008).name='study:desktop';
  for(const x of [.125,1.255])for(const z of [1.715,2.245])
   box(g,m,.03,.71,.03,x-o.x,.355,z-o.z,'bronze',.003).name='study:outside-leg';
  // The slim edge frame remains entirely above the required 680mm clearance.
  for(const z of [-.28,.28])box(g,m,o.w-.05,.025,.018,0,.6975,z,'bronze',.003);
  return true;
 }
 if(o.type==='study_sofa_bed'){
  const state=motion.r5||=( {} );g.userData.animated=true;
  box(g,m,1.05,.18,.8,0,.22,0,'salonTimber',.012);
  for(const x of [-.495,.495])for(const z of [-.37,.37])box(g,m,.05,.15,.05,x,.075,z,'salonTimber');
  // Timber rear rail, softly padded, follows the product's 850mm closed height.
  box(g,m,1.05,.48,.045,0,.61,-.3775,'salonTimber');
  const pillow=box(g,m,.97,.41,.14,0,.62,-.30,'oliveFabric',.045);
  box(g,m,.99,.15,1.82/3,0,.325,-.35+1.82/6,'oliveFabric',.035).name='study:seat-cushion';
  const leaves:THREE.Group[]=[],cushions:THREE.Mesh[]=[];
  for(let i=0;i<2;i++){
   const leaf=new THREE.Group();leaf.name=`study:pullout-${i+1}`;g.add(leaf);leaves.push(leaf);
   box(leaf,m,1.03,.055,.56,0,.20,0,'salonTimber');
   for(const x of [-.47,.47]){box(leaf,m,.035,.16,.035,x,.105,.24,'salonTimber');wheel(leaf,m,x,.24);}
   const foam=box(leaf,m,.99,.15,1.82/3,0,.325,0,'oliveFabric',.035);cushions.push(foam);
   if(i===1)box(leaf,m,1.05,.31,.05,0,.155,.3283333333,'salonTimber');
  }
  // Fine channel seams replace a featureless inflated cushion; never add below-desk braces.
  for(const x of [-.24,.24])box(g,m,.004,.002,.53,x,.401,-.04,'salonFabric',.001);
  state.bed={root:g,leaves,cushions,pillow};return true;
 }
 return false;
}

const clamp=(x:number)=>Math.max(0,Math.min(1,x));
const ease=(x:number)=>{x=clamp(x);return x*x*(3-2*x)};
/** All runtime envelopes follow these same visible objects, including table legs and sliding leaves. */
export function applyR5Motion(motion:Motion,scene:THREE.Scene,state:{smallBed:number;cinemaTV:number}){
 const r=motion.r5,model=motion.model;if(!r||!model?.homeDesign.r5Revision)return;
 const q=clamp(state.smallBed),p=ease((q-.2)/.8);
 if(r.bed){
  for(let i=0;i<2;i++){
   const leaf=r.bed.leaves[i];
   leaf.position.z=(-.35+1.82/6)+(i+1)*(1.82/3)*p;
   leaf.visible=p>.001;
   // Pull the nested support out first, then lift its folded pad onto the sleeping surface.
   const lift=ease((p-.65)/.35);
   r.bed.cushions[i].visible=lift>.001;
   r.bed.cushions[i].position.y=.20+.125*lift;
  }
  r.bed.pillow.visible=p<.5;
 }
 r.chair ||= scene.getObjectByName('study-office-chair');
 if(r.chair){
  // Clear the chair before the mattress starts moving, return it only after the mattress is closed.
  const c=ease(clamp(q/.2)),a=model.homeDesign.studyNook.states.deskUseChair,b=model.homeDesign.studyNook.states.smallBedOpenChairParking;
  r.chair.position.set(THREE.MathUtils.lerp(a[0],b[0],c),0,THREE.MathUtils.lerp(a[1],b[1],c));
  r.chair.userData.animated=true;
 }
 if(r.cinema){
  const t=ease(state.cinemaTV),a=model.homeDesign.cinemaTV.poses.far,b=model.homeDesign.cinemaTV.poses.near;
  r.cinema.position.set(THREE.MathUtils.lerp(a[0],b[0],t),0,THREE.MathUtils.lerp(a[1],b[1],t));
  r.cinema.rotation.y=-THREE.MathUtils.degToRad(THREE.MathUtils.lerp(a[2],b[2],t));
 }
}
