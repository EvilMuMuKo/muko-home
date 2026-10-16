import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const url=process.argv[2]||'http://localhost:4173/';
const out=resolve(process.argv[3]||'../../outputs/MuKo Home 空间与视觉升级/渲染');
const baseline=process.argv.includes('--baseline');
await mkdir(out,{recursive:true});
const report={url,baseline,date:new Date().toISOString(),status:'FAIL',scope:'Real macOS Chromium GPU; phone-size viewport is emulation, not physical-phone acceptance',profiles:[]};
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-unsafe-webgpu','--ignore-gpu-blocklist']});
try {
 for(const config of [{id:'desktop',viewport:{width:1440,height:900},deviceScaleFactor:2},{id:'landscape-mobile',viewport:{width:900,height:560},deviceScaleFactor:2,hasTouch:true}]) {
  const p=await browser.newPage({...config,reducedMotion:'reduce'});
  const r={id:config.id,viewport:config.viewport,deviceScaleFactor:config.deviceScaleFactor,errors:[],missing:[],turns:[],shots:[],states:[]};report.profiles.push(r);
  p.on('pageerror',e=>r.errors.push(e.message));p.on('console',m=>{if(m.type()==='error')r.errors.push(m.text())});p.on('response',v=>{if(v.status()>=400)r.missing.push([v.status(),v.url()])});
  await p.goto(url);await p.waitForFunction(()=>window.homePresentation?.getState().ready,null,{timeout:120000});
  await p.evaluate(()=>window.homePresentation.whenVisualReady?.());
  await p.locator('.home-welcome').waitFor({state:'detached',timeout:15000});
  r.initial=await p.evaluate(()=>{let a=window.homePresentation,v=a.getPerformance(),c=document.querySelector('canvas');return {state:a.getState(),backend:v.rendering,geometry:v.geometry,buffer:[c.width,c.height],pixelRatio:v.pixelRatio,materialFailures:v.materialDetail.failed};});
  if(config.id==='desktop'&&!baseline)await writeFile(resolve(out,'home-model.json'),JSON.stringify(await p.evaluate(()=>window.homePresentation.getModel()),null,2));
  assert.equal(r.initial.backend.backend,'WebGPU');assert.deepEqual(r.initial.materialFailures,[]);
  await p.screenshot({path:resolve(out,config.id+'-entry.png')});r.shots.push(config.id+'-entry.png');
  for(let n=0;n<20;n++) {
   await p.keyboard.down(n%2?'j':'l');await p.waitForTimeout(130);
   const moving=await p.evaluate(()=>{let a=window.homePresentation.getPerformance(),c=document.querySelector('canvas');return {dpr:a.pixelRatio,buffer:[c.width,c.height]}});
   await p.keyboard.up(n%2?'j':'l');await p.waitForTimeout(350);
   const idle=await p.evaluate(()=>{let a=window.homePresentation.getPerformance(),c=document.querySelector('canvas');return {dpr:a.pixelRatio,buffer:[c.width,c.height]}});
   r.turns.push({moving,idle});
  }
  r.resolutionStable=r.turns.every(t=>t.moving.dpr===t.idle.dpr&&JSON.stringify(t.moving.buffer)===JSON.stringify(t.idle.buffer));
  if(!baseline)assert.equal(r.resolutionStable,true,'Turning must not resize main render buffer');
  const shot=async(name,view,light='day-public')=>{
   await p.evaluate(({view,light})=>{const a=window.homePresentation;a.setInteriorView(view);a.setLightingScene(light)},{view,light});
   await p.evaluate(()=>window.homePresentation.whenVisualReady?.());
   await p.waitForFunction(()=>!window.homePresentation.getPerformance().pending,null,{timeout:90000});
   await p.screenshot({path:resolve(out,`${config.id}-${name}.png`)});r.shots.push(`${config.id}-${name}.png`);
  };
  await shot('master-day','master-main');await shot('master-night','master-main','aperitif');await shot('reading-day','salon-bar-seat');
  await shot('kitchen','kitchen-main');await shot('living','living-main');await shot('cinema','guest-main','cinema');
  if(!baseline) {
   for(const mode of ['dining','activity','relax']) {
    await p.evaluate(mode=>{const a=window.homePresentation;a.setInteriorView('living-main');a.setLightingScene('day-public');a.setLivingMode(mode)},mode);
    await p.evaluate(()=>window.homePresentation.whenVisualReady?.());
    await p.waitForFunction(()=>!window.homePresentation.getPerformance().pending,null,{timeout:90000});
    r.states.push(await p.evaluate(()=>({mode:window.homePresentation.getLivingMode(),motion:window.homePresentation.getMovingPartTransforms().home})));
    await p.screenshot({path:resolve(out,`${config.id}-living-${mode}.png`)});r.shots.push(`${config.id}-living-${mode}.png`);
   }
   await shot('bath','bath-main');
   r.modelAudit=await p.evaluate(()=>{const a=window.homePresentation.getModelAudit();return {issues:a.issues,missing:a.objects.filter(o=>o.missing)}});
   assert.deepEqual(r.modelAudit.issues,[]);assert.deepEqual(r.modelAudit.missing,[]);
  }
  r.final=await p.evaluate(()=>{const q=window.homePresentation.getPerformance();return {pixelRatio:q.pixelRatio,frameMs:q.frameMs,effects:q.gpuFinish,exterior:q.exterior,reflection:q.roomRadiance,mirror:q.mirror,drawCalls:q.drawCalls,triangles:q.triangles}});
  assert.deepEqual(r.errors,[]);assert.deepEqual(r.missing,[]);
  await p.close();
 }
 report.status='PASS';
}catch(error){report.error=String(error);process.exitCode=1;}finally{await browser.close();await writeFile(resolve(out,'release-render-audit.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({status:report.status,error:report.error,profiles:report.profiles.map(r=>({id:r.id,resolutionStable:r.resolutionStable,shots:r.shots.length,errors:r.errors}))},null,2));}
