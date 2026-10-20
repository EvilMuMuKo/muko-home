import { chromium } from '@playwright/test';
import { mkdir,writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const url=process.argv[2]||'http://localhost:4173/';
const out=resolve(process.argv[3]||'../../outputs/MuKo Home 游戏化材质升级/WebGPU桌面');
await mkdir(out,{recursive:true});
const report={url,time:new Date().toISOString(),status:'FAIL',pageErrors:[],consoleErrors:[],missing:[],shots:[],scope:'Native macOS Chromium WebGPU. Desktop GPU evidence, not physical-phone measurement.'};
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-unsafe-webgpu','--ignore-gpu-blocklist']});
try {
 const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1,reducedMotion:'reduce'});
 page.on('pageerror',e=>report.pageErrors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.consoleErrors.push(m.text());});page.on('response',r=>{if(r.status()>=400)report.missing.push([r.status(),r.url()]);});
 await page.goto(url);await page.waitForFunction(()=>window.homePresentation?.getState().ready,null,{timeout:120000});
 await page.waitForFunction(()=>window.homePresentation.getPerformance().renders>0);
 await page.locator(".home-welcome").waitFor({state:"detached",timeout:10000});
 report.adapter=await page.evaluate(async()=>{
  const adapter=await navigator.gpu?.requestAdapter();const info=adapter?.info;
  return info?{vendor:info.vendor,architecture:info.architecture,description:info.description,isFallbackAdapter:info.isFallbackAdapter??adapter.isFallbackAdapter??null}:null;
 });
 report.initial=await page.evaluate(()=>({state:window.homePresentation.getState(),performance:window.homePresentation.getPerformance(),accessories:window.homePresentation.getAccessoryAudit()}));
 assert.equal(report.initial.state.renderer,'WebGPU');assert.equal(report.initial.performance.geometry.backend,'wasm');assert(report.initial.performance.geometry.transformedVertices>0);assert.equal(report.initial.performance.gpuFinish.enabled,true);assert.equal(report.initial.performance.staticOcclusion.status,'baked');assert.deepEqual(report.initial.performance.materialDetail.failed,[]);
 assert.equal(report.initial.performance.materialDetail.loaded,report.initial.performance.materialDetail.requested);
 const material=id=>report.initial.performance.materials.find(m=>m.key===id);
 for(const id of ['floor','oak','linen','plaster','stone','masterWallcover']){
  assert(material(id),`material ${id} missing`);
  assert.equal(material(id).maps.normal,true,`${id} missing normal`);
  assert.equal(material(id).maps.roughness,true,`${id} missing roughness`);
  assert.equal(material(id).roughness,1,`${id} absolute roughness changed`);
  for(const channel of material(id).channels){
   if(!channel.missing) assert.equal(channel.colorSpace,channel.channel==='map'?'srgb':'',`${id} ${channel.channel} colourspace`);
  }
 }
 assert.equal(material('floor').channels[0].width,2048);
 assert.equal(report.initial.state.lighting.areaSlotCount,2);
 assert.equal(report.initial.state.lighting.slotCount,12);
 const shot=async(name,view,light)=>{
  const before=await page.evaluate(()=>window.homePresentation.getPerformance().renders);
  await page.evaluate(({view,light})=>{window.homePresentation.setLightingScene(light);window.homePresentation.setInteriorView(view);},{view,light});
  await page.evaluate(()=>window.homePresentation.whenVisualReady());
  await page.waitForFunction(({before,view,light})=>{
   const h=window.homePresentation,p=h.getPerformance(),s=h.getState();
   return p.renders>before && !p.pending && s.activePoint===view && s.lightScene===light;
  },{before,view,light},{timeout:60000});
  const state=await page.evaluate(()=>{const s=window.homePresentation.getState();return {activePoint:s.activePoint,lightScene:s.lightScene,night:s.night,renders:window.homePresentation.getPerformance().renders};});
  const path=resolve(out,name+'.png');await page.screenshot({path});report.shots.push({name,path,view,light,state});
 };
 await shot('bar-day','salon-bar-seat','day-public');await shot('bar-night','salon-bar-seat','aperitif');await shot('living-night','living-media','game');await shot('master-day','master-main','day-public');await shot('master-night','master-main','aperitif');await shot('master-work','master-work','work');
 report.final=await page.evaluate(()=>window.homePresentation.getPerformance());
 const before=report.final.renders;await page.waitForTimeout(450);assert.equal(await page.evaluate(()=>window.homePresentation.getPerformance().renders),before);report.idleSuspends=true;
 assert.deepEqual(report.pageErrors,[]);assert.deepEqual(report.consoleErrors,[]);assert.deepEqual(report.missing,[]);report.status='PASS';
} catch(e){report.error=String(e);process.exitCode=1;} finally{await browser.close();await writeFile(resolve(out,'webgpu-visual-audit.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({status:report.status,error:report.error,backend:report.initial?.state.renderer,finish:report.initial?.performance.gpuFinish,AO:report.initial?.performance.staticOcclusion?.elapsedMs,shots:report.shots.length,errors:report.consoleErrors},null,2));}
