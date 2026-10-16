#!/usr/bin/env node
import { chromium } from "@playwright/test";

function options(argv) {
  const result = { url: null, runs: 3, labels: ["cold", "warm", "warm"], timeout: 180000 };
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    const [key, inline] = arg.split("=", 2);
    const value = arg.startsWith("--") ? inline ?? argv[++i] : arg;
    if (key === "--runs") result.runs = Math.max(1, Number(value));
    else if (key === "--labels") result.labels = value.split(",").map((label) => label.trim());
    else if (key === "--timeout") result.timeout = Math.max(1000, Number(value));
    else if (arg.startsWith("--")) throw new Error(`Unknown option: ${arg}`);
    else if (!result.url) result.url = arg;
    else throw new Error(`Unexpected argument: ${arg}`);
  }
  if (!result.url) throw new Error("Usage: node scripts/load-profile.mjs <url> [--runs=3] [--labels=cold,warm,warm] [--timeout=180000]");
  if (result.labels.length < result.runs) throw new Error("Provide at least one cache label per run.");
  return result;
}

const config = options(process.argv);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", args: ["--enable-unsafe-webgpu", "--ignore-gpu-blocklist"] });
const context = await browser.newContext();
const reports = [];

try {
  for (let run = 0; run < config.runs; run++) {
    const label = config.labels[run];
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    const failures = [];
    const pageErrors = [];
    page.on("pageerror", error => pageErrors.push(error.message));
    page.on("console", message => { if (message.type() === "error") pageErrors.push(message.text()); });
    page.on("requestfailed", (request) => failures.push({ url: request.url(), error: request.failure()?.errorText ?? "unknown" }));
    await cdp.send("Network.enable");
    await cdp.send("Network.setCacheDisabled", { cacheDisabled: false });
    if (label === "cold") await cdp.send("Network.clearBrowserCache");
    await page.addInitScript(() => {
      window.__loadProfileEvents = [];
      let last = "";
      const record = () => {
        const root = document.querySelector("#loading");
        const status = document.querySelector("#loading-status");
        const sample = { at: performance.now(), text: status?.textContent?.trim() ?? "", done: root?.classList.contains("done") ?? false };
        const key = `${sample.text}|${sample.done}`;
        if (key !== last) { last = key; window.__loadProfileEvents.push(sample); }
      };
      new MutationObserver(record).observe(document, { subtree: true, childList: true, attributes: true, characterData: true });
      document.addEventListener("DOMContentLoaded", record, { once: true });
    });
    const navigationStarted = Date.now();
    let navigationError = null;
    try {
      await page.goto(config.url, { waitUntil: "domcontentloaded", timeout: config.timeout });
      await page.waitForFunction(() => document.querySelector("#loading")?.classList.contains("done") === true, null, { timeout: config.timeout });
      await page.waitForFunction(() => window.homePresentation?.getState().ready, null, { timeout: config.timeout });
    } catch (error) {
      navigationError = String(error);
    }
    const report = await page.evaluate(() => {
      const navigation = performance.getEntriesByType("navigation")[0];
      const resources = performance.getEntriesByType("resource").map((entry) => ({
        name: entry.name,
        initiatorType: entry.initiatorType,
        startTime: Math.round(entry.startTime),
        duration: Math.round(entry.duration),
        responseStart: Math.round(entry.responseStart),
        responseEnd: Math.round(entry.responseEnd),
        transferSize: entry.transferSize,
        decodedBodySize: entry.decodedBodySize,
        encodedBodySize: entry.encodedBodySize,
      })).sort((a, b) => a.startTime - b.startTime);
      const resourceBytes = resources.reduce((sum, entry) => sum + (entry.transferSize || 0), 0);
      const app = window.homePresentation;
      return {
        userAgent: navigator.userAgent,
        documentReadyState: document.readyState,
        loadingDone: document.querySelector("#loading")?.classList.contains("done") ?? false,
        loadingText: document.querySelector("#loading-status")?.textContent?.trim() ?? null,
        loadingEvents: window.__loadProfileEvents ?? [],
        navigation: navigation ? {
          fetchStart: Math.round(navigation.fetchStart),
          responseStart: Math.round(navigation.responseStart),
          domInteractive: Math.round(navigation.domInteractive),
          domContentLoaded: Math.round(navigation.domContentLoadedEventEnd),
          load: Math.round(navigation.loadEventEnd),
          duration: Math.round(navigation.duration),
        } : null,
        resourceCount: resources.length,
        transferBytes: resourceBytes,
        resources,
        appState: app?.getState?.() ?? null,
        appPerformance: app?.getPerformance?.() ?? null,
      };
    });
    reports.push({ run: run + 1, cacheLabel: label, navigationElapsedMs: Date.now() - navigationStarted, navigationError, pageErrors, failedRequests: failures, ...report });
    await page.close();
  }
} finally {
  await context.close();
  await browser.close();
}

process.stdout.write(`${JSON.stringify({ url: config.url, runs: reports }, null, 2)}\n`);
