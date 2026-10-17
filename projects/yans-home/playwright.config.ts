import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  workers: 1,
  timeout: 120000,
  use: {
    baseURL: "http://localhost:4188",
    viewport: { width: 900, height: 560 },
    reducedMotion: "reduce",
    launchOptions: {
      executablePath: process.env.CI
        ? undefined
        : process.env.CHROMIUM_PATH || "/usr/bin/chromium",
      args: [
        "--no-sandbox",
        "--use-angle=swiftshader",
        "--enable-unsafe-swiftshader",
        "--disable-dev-shm-usage",
      ],
    },
  },
  webServer: {
    command: "npm run preview -- --port 4188",
    url: "http://localhost:4188",
    reuseExistingServer: !process.env.CI,
  },
});
