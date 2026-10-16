#!/usr/bin/env node
// Stress room radiance on an already running preview. Does not build or start the server.
// Usage: node scripts/radiance-stress.mjs [url] [outJson]
// Defaults: http://localhost:4173/  /tmp/muko-radiance-stress.json
import {chromium} from '@playwright/test';
import {mkdir, writeFile} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import assert from 'node:assert/strict';

const url = process.argv[2] || 'http://localhost:4173/';
const out = resolve(process.argv[3] || '/tmp/muko-radiance-stress.json');
const timeoutMs = 300000;
const switchCount = 30;

const report = {
  url,
  out,
  date: new Date().toISOString(),
  timeoutMs,
  status: 'FAIL',
  elapsedMs: 0,
  pageErrors: [],
  failedResources: [],
  consoleErrors: [],
  destroyedTextureErrors: [],
  switches: [],
  afterBurst: null,
  rooms: [],
  roomRadiance: null,
  error: null,
};

function isDestroyedTexture(text) {
  return /destroyed texture/i.test(text) || (/destroy/i.test(text) && /texture/i.test(text));
}

function viewForRoom(views, roomId) {
  return views.find((view) => view.id === `${roomId}-main`) || views.find((view) => view.roomId === roomId) || null;
}

let browser;
const startedAt = Date.now();
const killer = setTimeout(() => {
  report.error = `Timed out after ${timeoutMs}ms`;
  process.exitCode = 1;
  void browser?.close();
}, timeoutMs);

try {
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist'],
  });
  const page = await browser.newPage({
    viewport: {width: 1440, height: 900},
    deviceScaleFactor: 2,
    reducedMotion: 'reduce',
  });
  page.setDefaultTimeout(timeoutMs);
  page.setDefaultNavigationTimeout(timeoutMs);
  page.on('pageerror', (error) => {
    report.pageErrors.push(error.message);
    if (isDestroyedTexture(error.message)) report.destroyedTextureErrors.push(error.message);
  });
  page.on('console', (message) => {
    const text = message.text();
    if (message.type() === 'error') report.consoleErrors.push(text);
    if ((message.type() === 'error' || message.type() === 'warning') && isDestroyedTexture(text)) {
      report.destroyedTextureErrors.push(text);
    }
  });
  page.on('requestfailed', (request) => {
    const errorText = request.failure()?.errorText || 'failed';
    // A cancelled in-flight request is not a failed resource load.
    if (errorText.includes('ERR_ABORTED')) return;
    report.failedResources.push({url: request.url(), error: errorText});
  });
  page.on('response', (response) => {
    if (response.status() >= 400) report.failedResources.push({status: response.status(), url: response.url()});
  });

  await page.goto(url, {waitUntil: 'domcontentloaded'});
  await page.waitForFunction(() => window.homePresentation?.getState?.().ready === true);
  await page.evaluate(() => {
    const ready = window.homePresentation?.whenVisualReady;
    if (typeof ready !== 'function') throw new Error('whenVisualReady is missing');
    return ready();
  });

  const catalog = await page.evaluate(() => {
    const model = window.homePresentation.getModel();
    return {
      scenes: model.lighting.scenes.map((scene) => ({id: scene.id, daylight: !!scene.daylight})),
      views: model.presentation.interiorViews.map((view) => ({id: view.id, roomId: view.roomId})),
      rooms: model.rooms.map((room) => room.id),
    };
  });
  const day = catalog.scenes.find((scene) => scene.id === 'day-public' && scene.daylight) || catalog.scenes.find((scene) => scene.daylight);
  const night = catalog.scenes.find((scene) => scene.id === 'aperitif' && !scene.daylight) || catalog.scenes.find((scene) => !scene.daylight);
  if (!catalog.views.length) throw new Error('No interior views');
  if (!day || !night) throw new Error('Day and night lighting scenes are not both available');
  const plan = Array.from({length: switchCount}, (_, index) => {
    const view = catalog.views[index % catalog.views.length];
    const light = index % 2 === 0 ? day : night;
    return {index, viewId: view.id, roomId: view.roomId, lightingScene: light.id, daylight: light.daylight};
  });

  // Issue all 30 room/day-night switches without waiting for whenVisualReady.
  const issued = plan.map((step) => page.evaluate((step) => {
    const app = window.homePresentation;
    app.setLightingScene(step.lightingScene);
    app.setInteriorView(step.viewId);
    const state = app.getState();
    return {active: state.active, activePoint: state.activePoint, lightScene: state.lightScene, night: state.night};
  }, step));
  const applied = await Promise.all(issued);
  report.switches = plan.map((step, index) => ({...step, applied: applied[index]}));
  assert.equal(report.switches.length, switchCount);
  for (const step of report.switches) {
    assert.equal(step.applied.activePoint, step.viewId, `view ${step.index} did not apply`);
    assert.equal(step.applied.lightScene, step.lightingScene, `lighting ${step.index} did not apply`);
    assert.equal(step.applied.night, !step.daylight, `day/night ${step.index} did not apply`);
  }

  await page.evaluate(() => window.homePresentation.whenVisualReady());
  report.afterBurst = await page.evaluate(() => window.homePresentation.getPerformance().roomRadiance);

  for (const roomId of catalog.rooms) {
    const view = viewForRoom(catalog.views, roomId);
    if (!view) throw new Error(`No interior view for room ${roomId}`);
    const visit = await page.evaluate(async (viewId) => {
      const app = window.homePresentation;
      app.setInteriorView(viewId);
      await app.whenVisualReady();
      const state = app.getState();
      const radiance = app.getPerformance().roomRadiance;
      return {
        active: state.active,
        activePoint: state.activePoint,
        cacheEntries: radiance?.cacheEntries ?? null,
        cacheCapacity: radiance?.cacheCapacity ?? null,
        lastError: radiance?.lastError ?? null,
        currentRoom: radiance?.currentRoom ?? null,
      };
    }, view.id);
    report.rooms.push({roomId, viewId: view.id, ...visit});
  }

  report.roomRadiance = await page.evaluate(() => window.homePresentation.getPerformance().roomRadiance);

  assert.deepEqual(report.pageErrors, []);
  assert.deepEqual(report.failedResources, []);
  assert.deepEqual(report.destroyedTextureErrors, []);
  for (const audit of [report.afterBurst, ...report.rooms, report.roomRadiance]) {
    assert.ok(audit, 'roomRadiance audit missing');
    assert.ok(audit.cacheEntries <= audit.cacheCapacity, `cacheEntries ${audit.cacheEntries} > cacheCapacity ${audit.cacheCapacity}`);
    assert.equal(audit.lastError, null);
  }
  for (const visit of report.rooms) assert.equal(visit.active, visit.roomId, `visit landed in ${visit.active}, expected ${visit.roomId}`);
  assert.equal(report.rooms.length, catalog.rooms.length);
  report.status = 'PASS';
} catch (error) {
  process.exitCode = 1;
  if (!report.error) report.error = error instanceof Error ? (error.stack || error.message) : String(error);
} finally {
  clearTimeout(killer);
  if (browser) await browser.close().catch(() => {});
  report.elapsedMs = Date.now() - startedAt;
  await mkdir(dirname(out), {recursive: true});
  await writeFile(out, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({
    status: report.status,
    out,
    error: report.error,
    elapsedMs: report.elapsedMs,
    switches: report.switches.length,
    rooms: report.rooms.length,
    cacheEntries: report.roomRadiance?.cacheEntries ?? null,
    cacheCapacity: report.roomRadiance?.cacheCapacity ?? null,
    pageErrors: report.pageErrors.length,
    failedResources: report.failedResources.length,
    destroyedTextureErrors: report.destroyedTextureErrors.length,
  }));
}
