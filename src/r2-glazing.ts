import * as THREE from 'three';
import {metricUV} from './texture-mapping';

/** Linked sliding leaves preserve a real opening, with one independently collidable hierarchy. */
export function buildR2Glazing(scene:THREE.Object3D,o:any,m:Record<string,THREE.Material>,tag:(g:THREE.Object3D,rooms:string[],kind:string)=>void,moving:any[]) {
  const root=new THREE.Group();root.name='opening:'+o.id;root.userData.animated=true;
  const side=o.r2Glazing==='side', count=side?3:4, span=o.width, overlap=.02;
  const length=(span+(count-1)*overlap)/count,step=length-overlap;
  const sill=o.sill||0, height=o.height;
  root.position.set(side?3.92:0,0,side?4.31:5.85);
  scene.add(root);tag(root,['kitchen','bar','hall'],'opening');
  const box=(g:THREE.Object3D,w:number,h:number,d:number,x:number,y:number,z:number,mat:string)=>{
    const a=new THREE.Mesh(metricUV(new THREE.BoxGeometry(w,h,d)),m[mat]||m.steel);
    a.position.set(x,y,z);a.castShadow=mat!=='glass';a.receiveShadow=true;g.add(a);return a;
  };
  const rail=(g:THREE.Object3D,len:number,h:number,t:number,x:number,y:number,z:number,mat:string)=>
    side?box(g,t,h,len,x,y,z,mat):box(g,len,h,t,x,y,z,mat);
  // The entrance track is recessed flush with the floor, never an impassable 2D fence.
  for(const y of [side?-.013:sill+.012,sill+height-.012]) rail(root,span,.024,.085,0,y,side?span/2:0,'steel').position[side?'z':'x']=span/2;
  for(const end of [0,span]) {
    if(side)box(root,.025,height,.025,0,sill+height/2,end,'steel');
    else box(root,.025,height,.025,end,sill+height/2,0,'steel');
  }
  for(let i=0;i<count;i++) {
    const leaf=new THREE.Group();leaf.name=`${o.id}:leaf:${i}`;leaf.userData.animated=true;
    const center=length/2+i*step,offset=-i*.027;
    leaf.position.set(side?offset:center,0,side?center:offset);root.add(leaf);
    rail(leaf,length-.04,height-.05,.008,0,sill+height/2,0,'glass');
    for(const edge of [-1,1]) {
      if(side)box(leaf,.024,height,.024,0,sill+height/2,edge*(length/2-.012),'bronze');
      else box(leaf,.024,height,.024,edge*(length/2-.012),sill+height/2,0,'bronze');
    }
    for(const y of [sill+.012,sill+height-.012])rail(leaf,length,.024,.024,0,y,0,'bronze');
    if(i===count-1) {
      if(side)box(leaf,.035,.15,.018,.025,sill+height*.52,length/2-.065,'steel');
      else box(leaf,.018,.12,.035,length/2-.065,sill+height*.5,.025,'steel');
    }
    moving.push({group:leaf,closed:[side?offset:center,side?center:offset],travel:side?[0,-i*step]:[-i*step,0]});
  }
  root.userData.glazingAudit={leaves:count,spanM:span,stackLengthM:length,openBudgetM:span-length-.04,
    status:'concept_mechanism_not_selected_hardware',sillM:sill};
  return root;
}
