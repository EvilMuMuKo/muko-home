import {defineConfig} from '@playwright/test';
import base from './playwright.config';
export default defineConfig({...base, metadata:{hardwareGPU:true}, outputDir:'test-results-native', use:{...base.use, launchOptions:{executablePath:process.env.CHROMIUM_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-unsafe-webgpu','--ignore-gpu-blocklist']}}});
