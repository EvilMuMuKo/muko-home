import {chromium} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
const [url,out]=process.argv.slice(2);
if(!url||!out)throw Error('URL OUTPUT required');
const b=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-unsafe-webgpu','--ignore-gpu-blocklist']});
const report={scope:'Same macOS browser/GPU; mobile is viewport/touch emulation, not phone hardware; HTTP cache cleared, shader cache not cleared',runs:[]};
try{for(const mobile of [false,true]){
 const c=await b.newContext({viewport:mobile?{width:844,height:390}:{width:1440,height:900},deviceScaleFactor:mobile?2:1.5,isMobile:mobile,hasTouch:mobile,reducedMotion:'reduce'});
 const p=await c.newPage(),errors=[],warnings=[];p.on('pageerror',e=>errors.push(e.message));p.on('console',e=>{if(e.type()==='warning')warnings.push(e.text())});
 const cd=await c.newCDPSession(p);await cd.send('Network.enable');await cd.send('Network.clearBrowserCache');
 const start=Date.now();await p.goto(url);await p.waitForFunction(()=>window.homePresentation?.getState().ready,null,{timeout:120000});const interactiveMs=Date.now()-start;
 await p.evaluate(()=>window.homePresentation.whenVisualReady());const visualMs=Date.now()-start;
 await p.evaluate(()=>window.homePresentation.startGhostWalk({position:[9.3,1.74,7.8],target:[9.4,1.3,8.9]}));await p.keyboard.down('l');await p.waitForTimeout(3000);
 const before=await p.evaluate(()=>window.homePresentation.getPerformance());
 const cadence=await p.evaluate(()=>new Promise(resolve=>{let start=performance.now(),last=start,a=[];function f(t){a.push(t-last);last=t;if(t-start<12000)requestAnimationFrame(f);else{a.sort((x,y)=>x-y);resolve({elapsed:t-start,p95:a[Math.floor(a.length*.95)],worst:a.at(-1)})}}requestAnimationFrame(f)}));
 await p.keyboard.up('l');const after=await p.evaluate(()=>window.homePresentation.getPerformance());
 const dprs=[];for(let i=0;i<20;i++){await p.keyboard.down('l');await p.waitForTimeout(50);dprs.push(await p.evaluate(()=>({dpr:window.homePresentation.getPerformance().pixelRatio,buffer:window.homePresentation.getPerformance().drawingBuffer})));await p.keyboard.up('l');await p.waitForTimeout(50);}
 report.runs.push({mobile,interactiveMs,visualMs,backend:after.rendering,version:await p.evaluate(()=>window.homePresentation.getState().version),quality:after.qualityProfile,p95Raf:cadence.p95,renderedFps:(after.renders-before.renders)/(cadence.elapsed/1000),beforeCalls:before.drawCalls,afterCalls:after.drawCalls,triangles:after.triangles,dprs,errors,warnings:[...new Set(warnings)]});await c.close();
}}finally{await b.close();await writeFile(out,JSON.stringify(report,null,2));console.log(JSON.stringify(report.runs.map(r=>({mobile:r.mobile,version:r.version,interactive:r.interactiveMs,visual:r.visualMs,p95:r.p95Raf,fps:r.renderedFps,warnings:r.warnings})),null,2))}
