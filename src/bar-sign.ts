import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {metricUV} from './texture-mapping';
let lettering:THREE.MeshStandardMaterial|undefined;
/** Code-native lettering, one shared texture; no online font or additional render pass. */
export function buildBarSign(g:THREE.Group,o:any,m:Record<string,THREE.Material>) {
  if(o.type!=='bar_sign')return false;
  const board=new THREE.Mesh(metricUV(new RoundedBoxGeometry(o.w,o.h,o.d,1,.008)),m.salonTimber||m.oak);
  board.position.y=o.h/2;board.castShadow=true;board.receiveShadow=true;g.add(board);
  if(!lettering) {
    const c=document.createElement('canvas');c.width=1536;c.height=384;
    const ctx=c.getContext('2d')!;
    ctx.fillStyle='#d7bf99';ctx.fillRect(0,0,c.width,c.height);
    // Restrained timber-like horizontal variation rather than a bright sign box.
    for(let y=0;y<c.height;y+=3) {ctx.fillStyle=`rgba(88,56,34,${.015+.012*Math.sin(y*.17)})`;ctx.fillRect(0,y,c.width,1);}
    ctx.strokeStyle='#876745';ctx.lineWidth=2;ctx.strokeRect(28,28,c.width-56,c.height-56);
    ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#322a24';
    ctx.font='92px Georgia, serif';ctx.fillText('MuKo’s Bar',c.width/2,c.height*.48);
    ctx.font='18px Georgia, serif';ctx.fillStyle='#65503b';ctx.fillText('COFFEE  ·  CRAFT  ·  TWO OF US',c.width/2,c.height*.76);
    const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;
    texture.anisotropy=4;
    lettering=new THREE.MeshStandardMaterial({map:texture,roughness:.88,metalness:0,emissive:'#d6c4a3',emissiveMap:texture,emissiveIntensity:.08});
  }
  for(const side of [-1,1]) {
    const plane=new THREE.Mesh(new THREE.PlaneGeometry(o.w-.035,o.h-.035),lettering);
    plane.position.set(0,o.h/2,side*(o.d/2+.001));if(side===-1)plane.rotation.y=Math.PI;
    g.add(plane);
  }
  const rodH=2.7-(o.y+o.h);
  for(const x of [-o.w*.34,o.w*.34]) {
    const rod=new THREE.Mesh(new THREE.CylinderGeometry(.005,.005,rodH,8),m.bronze||m.steel);
    rod.position.set(x,o.h+rodH/2,0);g.add(rod);
  }
  g.userData.signAudit={text:'MuKo’s Bar',lowerEdgeM:o.y,glazingClearanceM:.145,concept:true};
  return true;
}
