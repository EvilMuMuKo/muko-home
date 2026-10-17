// Refresh the static compatibility/loading preview from the actual entrance model.
import { chromium } from '@playwright/test';
import { resolve } from 'node:path';
const browser = await chromium.launch({channel:'chrome',args:['--enable-unsafe-webgpu','--ignore-gpu-blocklist']});
try {
  const page = await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1,reducedMotion:'reduce'});
  await page.goto(process.argv[2] || 'http://localhost:4173/');
  await page.waitForFunction(()=>window.homePresentation?.getState().ready && window.homePresentation.getPerformance().renders>0,null,{timeout:120000});
  await page.evaluate(()=>window.homePresentation.whenVisualReady());
  await page.locator('.home-welcome').waitFor({state:'detached',timeout:10000});
  await page.waitForFunction(()=>!window.homePresentation.getPerformance().pending);
  await page.addStyleTag({content:'.viewer > :not(canvas) { visibility:hidden !important }'});
  await page.screenshot({path:resolve(process.argv[3] || 'public/preview.jpg'),type:'jpeg',quality:88});
} finally {await browser.close();}
