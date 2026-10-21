import {test,expect} from '@playwright/test';
import * as THREE from 'three';
import {createServer} from 'vite';
import {auditSceneSurfaces} from '../src/material-detail';
import {finishArchitecture} from '../src/room-finish';
import {roomPalette} from '../src/atmosphere-design';

test('R4 sign faces living seats and clears the full kitchen glass travel region',async()=>{
 const server=await createServer({configFile:false,root:process.cwd(),server:{middlewareMode:true},appType:'custom'});
 try{
  const {finalModel:m}=await server.ssrLoadModule('/src/final-design.ts');
  const s=m.objects.find((o:any)=>o.id==='r2-bar-sign');
  // Header recess on the kitchen side of the fold plane. The old diagonal-sign facing test does not apply.
  expect(s.z+s.d/2).toBeLessThanOrEqual(5.85);
  expect(s.z-s.d/2).toBeGreaterThan(5.7);
  expect(s.y).toBeGreaterThanOrEqual(2.4);
  expect(s.y+s.h).toBeLessThanOrEqual(2.6);
  expect(s.x).toBeCloseTo(1.395, 3);
  const living=m.presentation.interiorViews.find((v:any)=>v.id==='r4-bar-from-living');
  expect(living.target[0]).toBeCloseTo(1.395, 3);
  expect(living.target[1]).toBeGreaterThan(2);
  const dusk=m.lighting.scenes.find((x:any)=>x.id==='aperitif');
  expect(dusk.roomLevels.bar.task).toBe(.55);
  expect(dusk.fixtureKelvin['bar-task']).toBe(3000);
 }finally{await server.close()}
});

test('surface diagnostics detect a textured UV-less asset without rejecting untextured geometry',()=>{
 const scene=new THREE.Scene(),g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,1,0,0,0,1,0],3));
 const material=new THREE.MeshStandardMaterial({map:new THREE.Texture()}),mesh=new THREE.Mesh(g,material);mesh.name='broken-asset';scene.add(mesh);
 expect(auditSceneSurfaces(scene).missingUV).toHaveLength(1);
 material.map=null;expect(auditSceneSurfaces(scene).missingUV).toEqual([]);
 g.dispose();material.dispose();
});

test('final browser scene has complete mapped geometry and retains compatible R4 diagnostics',async({page})=>{
 const warnings:string[]=[];page.on('console',e=>{if(e.type()==='warning')warnings.push(e.text())});
 await page.goto('/?renderer=webgl');
 await page.waitForFunction(()=>window.homePresentation?.getState().ready,null,{timeout:120000});
 await page.evaluate(()=>window.homePresentation.whenVisualReady());
 const result=await page.evaluate(()=>({surface:window.homePresentation.getSurfaceAudit(),revision:window.homePresentation.getR4Revision()}));
 expect(result.surface.missingUV).toEqual([]);expect(result.surface.meshes).toBeGreaterThan(100);
 expect(result.revision.structureChanged).toBe(false);
 expect(warnings.filter(w=>w.includes('Vertex attribute'))).toEqual([]);
});

// R3 guest opening is rotation 0 at z=3.4: guest is local -Z, hall is +Z.
test('guest leaf keeps its dark finish inside the cinema and pale finish toward the hall',()=>{
 const scene=new THREE.Scene(),door=new THREE.Group();door.name='opening:guest-door';scene.add(door);
 const oak=new THREE.MeshStandardMaterial(),paint=new THREE.MeshStandardMaterial({vertexColors:true});
 const leaf=new THREE.Mesh(new THREE.BoxGeometry(.86,2.08,.04),oak);door.add(leaf);
 finishArchitecture(scene,{oak,roomPlaster:paint,cinemaCeiling:paint},()=>{});
 const normals=leaf.geometry.getAttribute('normal'),colors=leaf.geometry.getAttribute('color');
 for(let i=0;i<normals.count;i++)if(Math.abs(normals.getZ(i))>.5){
  const expected=new THREE.Color(normals.getZ(i)<0?roomPalette.cinema:roomPalette.paper);
  expect(colors.getX(i)).toBeCloseTo(expected.r,5);expect(colors.getY(i)).toBeCloseTo(expected.g,5);expect(colors.getZ(i)).toBeCloseTo(expected.b,5);
 }
 scene.traverse(n=>{if(n instanceof THREE.Mesh)n.geometry.dispose()});oak.dispose();paint.dispose();
});
