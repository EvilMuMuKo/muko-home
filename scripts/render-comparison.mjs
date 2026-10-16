#!/usr/bin/env node
// One-pass same-Chrome comparison. Run after starting both servers:
// node scripts/render-comparison.mjs --baseline-url http://localhost:4174 --candidate-url http://localhost:4173 --out /tmp/render-comparison.json
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, all) => {
  if (v.startsWith("--")) a.push([v.slice(2), all[i + 1]]); return a;
}, []));
if (!args["baseline-url"] || !args["candidate-url"] || !args.out) {
  console.error("Usage: node scripts/render-comparison.mjs --baseline-url URL --candidate-url URL --out FILE"); process.exit(2);
}
const urlFor = value => { const u = new URL(value); u.searchParams.set("renderer", "webgpu"); return u.href; };
const percentile = (a, p) => a.length ? [...a].sort((x,y)=>x-y)[Math.min(a.length-1,Math.ceil(a.length*p)-1)] : null;
const pause = ms => new Promise(r => setTimeout(r, ms));
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--enable-unsafe-webgpu"] });
const context = await browser.newContext({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 1, reducedMotion: "reduce" });
const report = { scope: "one same-browser sequential pass; no 3A acceptance", cacheReset: false, cacheNote: "Baseline runs first; browser cache is not reset before candidate.", viewport: { width: 960, height: 540, dpr: 1 }, runs: [] };
try {
  for (const [name, raw] of [["baseline",args["baseline-url"]],["candidate",args["candidate-url"]]]) {
    const page = await context.newPage(), errors = [], missing = [];
    page.on("pageerror", e => errors.push(String(e)));
    page.on("response", r => { if (r.status() === 404) missing.push({url:r.url(),status:404}); });
    const started = performance.now();
    await page.goto(urlFor(raw), { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForFunction(() => window.homePresentation?.getState?.()?.ready === true, null, { timeout: 90000 });
    const initialState=await page.evaluate(()=>window.homePresentation.getState());
    if (initialState.renderer !== "WebGPU") throw new Error(`${name}: renderer must be actual WebGPU; got ${initialState.renderer}`);
    await page.waitForFunction(() => {const p=window.homePresentation?.getPerformance?.(); return p?.geometry?.backend==="wasm" && p.geometry.transformedVertices>0 && (p.renders||0)>0;}, null, {timeout:90000});
    const boot = await page.evaluate(() => {
      const s=window.homePresentation.getState(), p=window.homePresentation.getPerformance();
      return {renderer:s.renderer, wasmReady:p.geometry?.backend==="wasm"&&p.geometry.transformedVertices>0, renders:p.renders||0, dpr:devicePixelRatio,
        quality:p.qualityProfile||null, lightBudget:{slots:p.qualityProfile?.lightSlots??null,shadowLights:p.qualityProfile?.shadowLights??null},
        adapter:null};
    });
    if (!boot.wasmReady) throw new Error(`${name}: WASM geometry kernel did not become ready`);
    const coldBootMs = performance.now()-started;
    const adapter = await page.evaluate(async()=>{try {const a=await navigator.gpu?.requestAdapter(); return a?.info?{vendor:a.info.vendor,architecture:a.info.architecture,device:a.info.device,isFallbackAdapter:a.info.isFallbackAdapter??null}:null;}catch{return null;}});
    await page.waitForFunction(()=>!document.querySelector(".home-welcome"),null,{timeout:10000}).catch(()=>{});
    const welcomeHidden=await page.locator(".home-welcome").count()===0 || !(await page.locator(".home-welcome").isVisible());
    if (!welcomeHidden) throw new Error(`${name}: welcome overlay did not dismiss`);
    const ghostActive=await page.evaluate(()=>window.homePresentation.getGhostWalkState?.().active===true);
    if(!ghostActive) throw new Error(`${name}: expected the initial ghost-walk camera mode`);
    for(const k of ["i","j","k","l"]) { await page.keyboard.down(k); await pause(500); await page.keyboard.up(k); }
    await page.keyboard.down("l"); await pause(4000); await page.keyboard.up("l");
    await pause(250);
    const before=await page.evaluate(()=>window.homePresentation.getPerformance());
    await page.keyboard.down("l"); await pause(4000); await page.keyboard.up("l");
    const after=await page.evaluate(()=>window.homePresentation.getPerformance());
    await pause(450);
    const idle=await page.evaluate(()=>window.homePresentation.getPerformance());
    const samples=(after.renderMs||[]).slice((before.renderMs||[]).length);
    if(samples.length<=5) throw new Error(`${name}: insufficient post-warmup renderMs samples (${samples.length})`);
    const med=percentile(samples,.5), p95=percentile(samples,.95);
    report.runs.push({name,url:urlFor(raw),coldBootMs,renderer:boot.renderer,wasmReady:boot.wasmReady,dpr:boot.dpr,ghostActive,
      adapter,quality:boot.quality,lightBudget:boot.lightBudget,
      warmCameraMs:6000,continuousRightLookMs:4000,idleMs:450,
      postWarmup:{frameCount:Math.max(0,(after.renders||0)-(before.renders||0)),renderCount:samples.length,
        renderMsCpuSubmission:{sampleCount:samples.length,medianMs:med,p95Ms:p95},
        idle:{renderCount:Math.max(0,(idle.renders||0)-(after.renders||0))}},
      pageErrors:errors,http404:missing});
    await page.close();
  }
  const [b,c]=report.runs, ratio=(x,y)=>x&&y?y/x:null;
  const same=JSON.stringify(b.lightBudget)===JSON.stringify(c.lightBudget);
  report.comparison={renderCountRatioCandidateOverBaseline:ratio(b.postWarmup.renderCount,c.postWarmup.renderCount),
    cpuSubmissionMedianRatioCandidateOverBaseline:ratio(b.postWarmup.renderMsCpuSubmission.medianMs,c.postWarmup.renderMsCpuSubmission.medianMs),
    cpuSubmissionP95RatioCandidateOverBaseline:ratio(b.postWarmup.renderMsCpuSubmission.p95Ms,c.postWarmup.renderMsCpuSubmission.p95Ms),
    strictLightBudgetEquality:same?"PASS":"FAIL"};
  report.metricLimit="renderMs is JavaScript CPU render-submission time, not GPU frame time, display latency, or real-phone FPS.";
  await mkdir(dirname(resolve(args.out)),{recursive:true});
  await writeFile(args.out,JSON.stringify(report,null,2));
  console.log(JSON.stringify({out:args.out,comparison:report.comparison,runs:report.runs.map(r=>({name:r.name,coldBootMs:r.coldBootMs,postWarmup:r.postWarmup,errors:r.pageErrors.length,http404:r.http404.length}))},null,2));
} finally { await context.close(); await browser.close(); }
