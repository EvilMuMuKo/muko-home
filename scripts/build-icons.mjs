import { chromium } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
const svg=await readFile(new URL('../public/favicon.svg',import.meta.url),'utf8');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
try {
  const page=await browser.newPage({deviceScaleFactor:1});
  for(const [file,size] of [['favicon-32.png',32],['apple-touch-icon.png',180],['icon-192.png',192],['icon-512.png',512]]) {
    // Rasterize into a fixed canvas; viewport screenshot resizing can capture
    // stale compositor tiles when generating several small icons in succession.
    const data=await page.evaluate(async({svg,size})=>{
      const image=new Image();
      image.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
      await image.decode();
      const canvas=document.createElement('canvas');
      canvas.width=canvas.height=size;
      canvas.getContext('2d').drawImage(image,0,0,size,size);
      return canvas.toDataURL('image/png').split(',')[1];
    },{svg,size});
    await writeFile(new URL('../public/'+file,import.meta.url),Buffer.from(data,'base64'));
    console.log(file,size);
  }
} finally { await browser.close(); }
