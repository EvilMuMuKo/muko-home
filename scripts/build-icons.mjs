import { chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';
const svg=await readFile(new URL('../public/favicon.svg',import.meta.url),'utf8');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
try {
  const page=await browser.newPage({deviceScaleFactor:1});
  for(const [file,size] of [['favicon-32.png',32],['apple-touch-icon.png',180],['icon-192.png',192],['icon-512.png',512]]) {
    await page.setViewportSize({width:size,height:size});
    await page.setContent(`<html><style>html,body{margin:0;width:100%;height:100%;overflow:hidden}svg{display:block;width:100%;height:100%}</style>${svg}</html>`);
    await page.screenshot({path:new URL('../public/'+file,import.meta.url).pathname,omitBackground:true});
    console.log(file,size);
  }
} finally { await browser.close(); }
