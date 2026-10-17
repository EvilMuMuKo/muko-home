import {chromium} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-unsafe-webgpu','--ignore-gpu-blocklist']});
const page=await browser.newPage({viewport:{width:900,height:560}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
const views={guest:'guest-main',bath:'bath-main',master:'master-main',kitchen:'kitchen-main',bar:'salon-bar-seat',living:'living-main',balcony:'balcony-main'};
const data={version:1,source:'Unified R2 V12 spatial revision; offline static architecture only',variants:{}};
try {
 await page.goto((process.argv[2]||'http://localhost:4173/')+'?gi-bake');
 await page.waitForFunction(()=>window.homePresentation?.getState().ready,null,{timeout:120000});
 for(const variant of ['day','night']) {
  data.variants[variant]=[];
  for(const [room,view] of Object.entries(views)) {
   const start=Date.now();
   await page.evaluate(({view,variant})=>{let a=window.homePresentation;a.setInteriorView(view);a.setLightingScene(variant==='day'?'day-public':'aperitif')},{view,variant});
   await page.evaluate(()=>window.homePresentation.whenVisualReady());
   const atlas=await page.evaluate(room=>window.homePresentation.bakeDiffuseRoom(room),room);
   data.variants[variant].push(atlas);
   console.log(JSON.stringify({variant,room,ms:Date.now()-start,texels:atlas.atlas.rgba.length,nonzero:atlas.atlas.rgba.filter(v=>v!==0).length}));
   if(errors.length)throw new Error(errors.join('\n'));
  }
 }
 await writeFile('src/generated-diffuse.json',JSON.stringify(data));
 console.log('PASS offline diffuse atlas generated');
} catch(e) {console.error(e);console.error(errors);process.exitCode=1;}finally{await browser.close();}
