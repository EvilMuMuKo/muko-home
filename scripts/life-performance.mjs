import {chromium} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-unsafe-webgpu','--ignore-gpu-blocklist']});
const report={date:new Date().toISOString(),scope:'macOS real Chromium GPU; landscape phone viewport is emulation, not phone hardware. 3s warmup, 12s sustained turning. rAF cadence and scene render counts both recorded.',runs:[]};
try{
 for(const url of ['http://localhost:4174/','http://localhost:4173/'])for(const viewport of [{width:1440,height:900},{width:900,height:560}]){
  const p=await browser.newPage({viewport,deviceScaleFactor:2,reducedMotion:'reduce'}),errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  const started=Date.now();await p.goto(url);await p.waitForFunction(()=>window.homePresentation?.getState().ready,null,{timeout:120000});await p.evaluate(()=>window.homePresentation.whenVisualReady?.());
  await p.evaluate(()=>window.homePresentation.startGhostWalk({position:[9.3,1.74,7.8],target:[9.4,1.3,8.9]}));await p.keyboard.down('l');await p.waitForTimeout(3000);
  const before=await p.evaluate(()=>window.homePresentation.getPerformance());
  const cadence=await p.evaluate(()=>new Promise(resolve=>{let t0=performance.now(),last=t0,samples=[];const tick=t=>{samples.push(t-last);last=t;if(t-t0<12000)requestAnimationFrame(tick);else{const s=[...samples].sort((a,b)=>a-b);resolve({frames:samples.length,elapsedMs:t-t0,p50:s[Math.floor(s.length*.5)],p95:s[Math.floor(s.length*.95)],worst:s.at(-1),over40ms:samples.filter(v=>v>40).length});}};requestAnimationFrame(tick)}));
  await p.keyboard.up('l');const after=await p.evaluate(()=>window.homePresentation.getPerformance());
  report.runs.push({url,viewport,initialReadyAndWarmupMs:Date.now()-started-12000,backend:after.rendering,quality:after.qualityProfile,dpr:after.pixelRatio,effectTier:after.effectTier,renders:after.renders-before.renders,renderedFps:(after.renders-before.renders)/(cadence.elapsedMs/1000),cadence,errors});await p.close();
 }
}finally{await browser.close();await writeFile(process.argv[2]||'../../outputs/MuKo Home 空间与视觉升级/performance.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report.runs.map(r=>({url:r.url,viewport:r.viewport,p95:r.cadence.p95,fps:r.renderedFps,errors:r.errors})),null,2));}
