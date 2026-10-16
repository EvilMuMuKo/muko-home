import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const NOTE = 'CPU and viewport emulation are not actual phone or GPU performance.';
const KEYS = ['qualityProfile', 'rendering', 'pixelRatio', 'drawingBuffer', 'renders', 'shadowUpdates', 'roomRadiance', 'mirror', 'diffuseBounce', 'drawCalls', 'triangles', 'startup', 'frameP95Ms'];
const args = process.argv.slice(2);

if (args.includes('--help') || args.length < 2) {
  console.log('Usage: node scripts/mobile-performance.mjs URL OUTPUT [CPUrate=4]');
  process.exit(args.includes('--help') ? 0 : 1);
}

const [url, output, rateArg] = args;
const rate = Number.isFinite(Number(rateArg)) ? Number(rateArg) : 4;
const report = {
  url, status: 'FAIL', errors: [], requestFailures: [], quality: null, phases: [],
  note: NOTE, cpuRate: rate, viewport: { width: 844, height: 390, deviceScaleFactor: 3 },
};
let browser;
let page;
const deadline = setTimeout(() => {
  process.exitCode = 1;
  report.errors.push('130s overall deadline exceeded');
  browser?.close().catch(() => {});
}, 130000);

const readPerf = () => page.evaluate((keys) => {
  const p = globalThis.homePresentation?.getPerformance?.() ?? {};
  return Object.fromEntries(keys.map((k) => [k, p[k]]));
}, KEYS);

function phaseStats(raf, tasks, t0, t1, before, after) {
  const deltas = raf.filter(([t]) => t >= t0 && t <= t1).map((x) => x[1]).sort((a, b) => a - b);
  const n = deltas.length;
  const dt = Math.max(1, t1 - t0);
  return {
    before, after,
    elapsedMs: dt,
    raf: { p95: n ? deltas[Math.min(n - 1, Math.ceil(n * 0.95) - 1)] : null, worst: n ? deltas[n - 1] : null, over250: deltas.filter((d) => d > 250).length, samples: n },
    renderedFps: ((after.renders ?? 0) - (before.renders ?? 0)) / (dt / 1000),
    longtasks: tasks.filter((e) => e.start < t1 && e.start + e.duration > t0),
  };
}

async function sample() {
  return page.evaluate(() => ({ now: performance.now(), raf: globalThis.__rafIntervals.slice(-6000), tasks: globalThis.__longtasks.slice() }));
}

async function phase(name, run) {
  const before = await readPerf();
  const a = await sample();
  await run();
  const after = await readPerf();
  const b = await sample();
  report.phases.push({ name, ...phaseStats(b.raf.filter(([t]) => t >= a.now), b.tasks, a.now, b.now, before, after) });
}

try {
  browser = await chromium.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist'],
  });
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    reducedMotion: 'reduce',
    userAgent: UA,
  });
  await context.addInitScript(() => {
    const raf = [];
    const tasks = [];
    globalThis.__rafIntervals = raf;
    globalThis.__longtasks = tasks;
    let last = performance.now();
    const loop = (t) => { raf.push([t, t - last]); last = t; requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
    try {
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) tasks.push({ start: e.startTime, duration: e.duration });
      }).observe({ type: 'longtask', buffered: true });
    } catch { /* longtask unsupported */ }
  });
  page = await context.newPage();
  page.on('pageerror', (e) => report.errors.push(String(e)));
  page.on('console', message => { if (message.type() === 'error') report.errors.push(message.text()); });
  page.on('requestfailed', (r) => report.requestFailures.push({ url: r.url(), error: r.failure()?.errorText ?? '' }));
  await (await context.newCDPSession(page)).send('Emulation.setCPUThrottlingRate', { rate });
  const tNav = Date.now();
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => {
    return !!globalThis.homePresentation?.getState?.()?.ready && !!document.querySelector('#loading.done');
  }, null, { timeout: 90000 });
  report.startupMs = Date.now() - tNav;
  report.pointerCoarse = await page.evaluate(() => matchMedia('(pointer: coarse)').matches);
  const snap = await readPerf();
  report.quality = { qualityProfile: snap.qualityProfile, rendering: snap.rendering, pixelRatio: snap.pixelRatio };
  if (!report.pointerCoarse || !snap.qualityProfile?.mobile) throw new Error('Mobile/coarse-pointer profile was not active');
  await page.evaluate(() => globalThis.homePresentation.startGhostWalk({ position: [9.3, 1.74, 7.8], target: [9.4, 1.3, 8.9] }));
  await phase('l20', async () => {
    await page.keyboard.down('l');
    await page.waitForTimeout(20000);
    await page.keyboard.up('l');
  });
  let visualDeadline;
  try {
    await Promise.race([
      page.evaluate(() => globalThis.homePresentation.whenVisualReady()),
      new Promise((_, reject) => { visualDeadline = setTimeout(() => reject(new Error('Visual completion exceeded 30s')), 30000); }),
    ]);
  } finally { clearTimeout(visualDeadline); }
  await phase('wl-sj', async () => {
    await page.keyboard.down('w');
    await page.keyboard.down('l');
    await page.waitForTimeout(8000);
    await page.keyboard.up('w');
    await page.keyboard.up('l');
    await page.keyboard.down('s');
    await page.keyboard.down('j');
    await page.waitForTimeout(8000);
    await page.keyboard.up('s');
    await page.keyboard.up('j');
  });
  report.status = report.errors.length || report.requestFailures.length ? 'FAIL' : 'PASS';
  if (report.status === 'FAIL') process.exitCode = 1;
} catch (err) {
  process.exitCode = 1;
  report.errors.push(String(err?.stack || err));
} finally {
  clearTimeout(deadline);
  await browser?.close().catch(() => {});
  await writeFile(output, JSON.stringify(report, null, 2));
  console.log(output);
}
