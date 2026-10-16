import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { metricUV } from "./texture-mapping";
type M = Record<string,THREE.Material>;
export const createLifeMotion = () => ({fridges:[] as any[],showers:[] as any[],shelves:[] as any[]});
export type LifeMotion = ReturnType<typeof createLifeMotion>;
const ease = (p:number) => {p=THREE.MathUtils.clamp(p,0,1);return p*p*(3-2*p);};
function box(g:THREE.Object3D,m:M,w:number,h:number,d:number,x:number,y:number,z:number,key="oak",r=0.005) {
  const mesh=new THREE.Mesh(metricUV(new RoundedBoxGeometry(w,h,d,1,Math.min(r,w/4,h/4,d/4))),m[key]||m.oak);
  mesh.position.set(x,y,z);mesh.castShadow=!mesh.material.transparent;mesh.receiveShadow=true;g.add(mesh);return mesh;
}
function bar(g:THREE.Object3D,m:M,a:number[],b:number[],r=0.008,key="steel") {
  const start=new THREE.Vector3(...a as [number,number,number]),end=new THREE.Vector3(...b as [number,number,number]);
  const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r,r,start.distanceTo(end),10),m[key]||m.steel);
  mesh.position.copy(start.clone().add(end).multiplyScalar(.5));mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),end.sub(start).normalize());g.add(mesh);mesh.castShadow=true;return mesh;
}
function circle(g:THREE.Object3D,m:M,r:number,x:number,y:number,z:number,key="charcoal") {
  const mesh=new THREE.Mesh(new THREE.CircleGeometry(r,32),m[key]||m.charcoal);mesh.rotation.y=Math.PI;mesh.position.set(x,y,z);g.add(mesh);return mesh;
}

/** Articulated appliances and everyday objects share the same visible solids used by collision checks. */
export function buildLifeFurniture(g:THREE.Group,o:any,m:M,motion:LifeMotion):boolean {
  if(o.type==="fridge") {
    const w=o.w,d=o.d,h=o.h, drinks=o.doorLayout==="single_drinks", bottom=drinks?.04:.52;
    g.userData.animated=true;
    box(g,m,w,.03,d,0,.025,0,"steel");
    for(const x of [-w/2+.015,w/2-.015])box(g,m,.03,h,d,x,h/2,0,"cabinetPaint");
    box(g,m,w,h,.03,0,h/2,d/2-.015,"cabinetPaint");
    box(g,m,w,.03,d,0,h-.015,0,"cabinetPaint");
    for(const y of drinks?[.18,.4,.62]:[.65,1.0,1.35,1.65]) {
      box(g,m,w-.075,.012,d-.1,0,y,.015,"glass",.001);
      for(let i=0;i<(drinks?3:2);i++) {
        const x=-(w-.18)/2+i*(drinks?.15:.28);
        if(drinks) {
          const can=new THREE.Mesh(new THREE.CylinderGeometry(.029,.029,.12,16),m.sage);can.position.set(x,y+.066,.06);g.add(can);
          circle(g,m,.018,x,y+.064,.028,"cream");
        } else box(g,m,.12,.13,.15,x,y+.071,.12,i%2?"sage":"cream",.008);
      }
    }
    const leaves:any[]=[];
    for(const side of drinks?[-1]:[-1,1]) {
      const leafW=drinks?w:w/2-.003;
      const pivot=new THREE.Group();pivot.name=`${o.id}:door-${side}`;pivot.position.set(side*w/2,bottom,-d/2-.02);g.add(pivot);
      const cx=-side*leafW/2;
      box(pivot,m,leafW,h-bottom-.025,.035,cx,(h-bottom)/2,0,drinks?"salonFrame":"cabinetPaint",.012);
      if(drinks)box(pivot,m,leafW-.075,h-bottom-.14,.012,cx,(h-bottom)/2,-.025,"glass",.003);
      box(pivot,m,.014,(h-bottom)*.32,.02,-side*(leafW-.05),(h-bottom)*.55,-.03,"steel",.004);
      // Door bins sit on the real leaf, not on the cabinet behind it.
      for(const y of [0.25,0.65]) if(y<h-bottom-.12)box(pivot,m,leafW-.08,.075,.07,cx,y,.055,"cream",.01);
      leaves.push({pivot,sign:-side});
    }
    let drawer:THREE.Group|null=null;
    if(!drinks) {
      drawer=new THREE.Group();drawer.name=o.id+":drawer";drawer.position.set(0,.06,-d/2+.24);g.add(drawer);
      box(drawer,m,w-.06,.35,.43,0,.2,0,"steel",.008);
      box(drawer,m,w,.43,.035,0,.215,-.235,"cabinetPaint",.008);
      box(drawer,m,.36,.015,.025,0,.33,-.265,"steel");
    }
    for(let i=0;i<9;i++)box(g,m,w-.08,.006,.012,0,.07+i*.016,-d/2-.04,"charcoal",.001);
    motion.fridges.push({root:g,leaves,drawer,drawerBase:drawer?.position.z??0,id:o.id});
    return true;
  }
  if(o.type==="lounge_chair") {
    for(const x of [-.31,.31])for(const z of [-.29,.29])bar(g,m,[x,.03,z],[x,.36,z],.022,"salonDarkTimber");
    box(g,m,.76,.12,.78,0,.36,0,"salonDarkTimber",.045);
    box(g,m,.71,.17,.66,0,.47,-.02,"salonClay",.07);
    const back=box(g,m,.76,.46,.16,0,.65,.30,"salonClay",.065);back.rotation.x=-.13;
    for(const x of [-.38,.38])box(g,m,.1,.20,.69,x,.56,-.015,"salonTimber",.04);
    const pillow=box(g,m,.33,.31,.1,.12,.65,.17,"linen",.05);pillow.rotation.z=-.09;
    return true;
  }
  if(o.type==="record_console") {
    const w=o.w,d=o.d,h=o.h;
    for(const x of [-w/2+.02,w/2-.02,0])box(g,m,.025,h-.12,d,x,(h+.12)/2,0,"salonDarkTimber");
    for(const y of [.12,.45,h-.02])box(g,m,w,.025,d,0,y,0,"salonDarkTimber");
    box(g,m,w,h-.12,.018,0,(h+.12)/2,d/2-.009,"salonDarkTimber");
    for(const x of [-w/2+.07,w/2-.07])for(const z of [-d/2+.04,d/2-.04])box(g,m,.025,.12,.025,x,.06,z,"bronze");
    for(let i=0;i<24;i++)box(g,m,.018,.28,.28,-w/2+.06+i*.022,.285,0,i%4===0?"salonClay":i%3===0?"sage":"salonPaper",.001);
    for(let i=0;i<10;i++)box(g,m,.018,.18,.27,-.50+i*.026,.55,0,i%3?"salonPaper":"charcoal",.001);
    box(g,m,.43,.05,.30,-.15,h+.025,0,"salonTimber",.009);
    const platter=new THREE.Mesh(new THREE.CylinderGeometry(.115,.115,.009,48),m.charcoal);platter.position.set(-.19,h+.056,0);g.add(platter);
    bar(g,m,[.015,h+.08,.1],[.04,h+.08,-.09],.004,"steel");bar(g,m,[.04,h+.08,-.09],[-.035,h+.065,-.07],.004,"steel");
    // Compact audio unit lives in the ventilated upper cubby, below the window sill.
    box(g,m,.20,.18,.22,.30,.55,0,"charcoal",.01);circle(g,m,.045,.30,.54,-d/2-.002,"linen");
    return true;
  }
  if(o.type==="ventilated_rail") {
    for(const x of [-o.w/2+.012,o.w/2-.012])box(g,m,.024,o.h,o.d,x,o.h/2,0,"salonTimber");
    box(g,m,o.w,.024,o.d,0,o.h-.012,0,"salonTimber");
    bar(g,m,[-.24,.68,-.05],[.24,.68,-.05],.009,"bronze");
    for(const x of [-.13,.13]) {
      bar(g,m,[x-.105,.55,-.05],[x,.65,-.05],.004,"salonTimber");bar(g,m,[x,.65,-.05],[x+.105,.55,-.05],.004,"salonTimber");
      const garment=box(g,m,.2,.43,.06,x,.34,-.035,x<0?"linen":"sage",.027);garment.rotation.z=x<0?.04:-.04;
    }
    g.userData.storageAudit={ventilated:true,mechanismSpaceCounted:false,purpose:"worn_again_clothes"};return true;
  }
  if(o.type==="speaker") {
    box(g,m,o.w,o.h,o.d,0,o.h/2,0,"charcoal",.009);
    circle(g,m,o.w*.31,0,o.h*.32,-o.d/2-.001,"linen");circle(g,m,o.w*.12,0,o.h*.76,-o.d/2-.001,"steel");return true;
  }
  if(o.type==="counter_appliance") {
    box(g,m,o.w,o.h,o.d,0,o.h/2,0,"charcoal",.018);
    box(g,m,o.w-.03,o.h*.6,.018,0,o.h*.42,-o.d/2-.01,"glass",.008);
    box(g,m,o.w*.55,.018,.025,0,o.h*.72,-o.d/2-.035,"steel",.005);
    for(const x of [-.07,.07])circle(g,m,.017,x,o.h*.88,-o.d/2-.012,"steel");return true;
  }
  if(o.type==="tray") {box(g,m,o.w,o.h,o.d,0,o.h/2,0,o.material,.007);return true;}
  if(o.type==="ceiling_equipment") {
    box(g,m,o.w,o.h,o.d,0,0,0,"cream",.01);
    for(let i=0;i<10;i++)box(g,m,o.w*.68,.003,.008,0,-o.h/2-.002,-o.d*.35+i*.022,"charcoal",.001);return true;
  }
  if(o.type==="folding_shelf") {
    const pivot=new THREE.Group();g.add(pivot);g.userData.animated=true;
    box(pivot,m,o.w,.025,o.d,0,0,-o.d/2,"salonTimber",.005);
    for(const x of [-o.w*.32,o.w*.32])bar(pivot,m,[x,-.20,0],[x,-.02,-o.d*.75],.007,"steel");
    box(g,m,o.w,.08,.02,0,-.02,.012,"salonTimber");
    motion.shelves.push({root:g,pivot});return true;
  }
  if(o.type==="shower" && o.enclosure) {
    const w=o.w,d=o.d,cut=o.enclosure.cutM,h=o.enclosure.heightM;
    const pts=[[-w/2,-d/2],[w/2,-d/2],[w/2,d/2],[-w/2+cut,d/2],[-w/2,d/2-cut]];
    const shape=new THREE.Shape(pts.map(([x,z])=>new THREE.Vector2(x,-z)));
    const base=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:.035,bevelEnabled:false}),m.stone);base.rotation.x=-Math.PI/2;g.add(base);base.receiveShadow=true;
    const screen=(a:number[],b:number[])=>{
      const len=Math.hypot(b[0]-a[0],b[1]-a[1]);
      const mesh=box(g,m,len,h,.008,(a[0]+b[0])/2,h/2+.035,(a[1]+b[1])/2,"glass",.001);
      mesh.rotation.y=-Math.atan2(b[1]-a[1],b[0]-a[0]);mesh.castShadow=false;
      bar(g,m,[a[0],h+.04,a[1]],[b[0],h+.04,b[1]],.007,"steel");
    };
    // The two wall-backed sides stay architectural; exposed front/left are glass.
    screen(pts[2],pts[3]);screen(pts[4],pts[0]);
    const a=pts[4],b=pts[3],len=Math.hypot(b[0]-a[0],b[1]-a[1]);
    const pivot=new THREE.Group();pivot.position.set(a[0],.035,a[1]);pivot.rotation.y=-Math.atan2(b[1]-a[1],b[0]-a[0]);g.add(pivot);
    box(pivot,m,len-.016,h,.008,(len-.016)/2,h/2,0,"glass",.001).castShadow=false;
    bar(pivot,m,[len-.1,.9,-.025],[len-.1,1.13,-.025],.007,"steel");
    for(const y of [.25,1.7])box(pivot,m,.026,.065,.02,.015,y,0,"steel");
    bar(g,m,[w/2-.06,.8,-d/2+.06],[w/2-.06,2.17,-d/2+.06],.012,"steel");
    const head=new THREE.Mesh(new THREE.CylinderGeometry(.1,.1,.025,32),m.steel);head.position.set(w/2-.2,2.17,-d/2+.16);g.add(head);
    box(g,m,.19,.012,.07,0,.01,-d/2+.06,"steel",.002);
    g.userData.animated=true;g.userData.shower={...o.enclosure,visibleFloorAreaM2:w*d-cut*cut/2};
    motion.showers.push({root:g,pivot,baseAngle:pivot.rotation.y});return true;
  }
  return false;
}
export function applyLifeMotion(motion:LifeMotion,state:any) {
  for(const f of motion.fridges) {
    const p=ease(f.id==="guest-drinks-fridge"?state.miniFridge||0:state.fridge||0);
    for(const leaf of f.leaves)leaf.pivot.rotation.y=leaf.sign*THREE.MathUtils.degToRad(100)*p;
    if(f.drawer)f.drawer.position.z=f.drawerBase-.48*ease(state.drawer||0);
  }
  for(const s of motion.showers)s.pivot.rotation.y=s.baseAngle+Math.PI*.45*ease(state.shower||0);
  for(const s of motion.shelves)s.pivot.rotation.x=-Math.PI/2*(1-ease(state.foldingShelf||0));
}
