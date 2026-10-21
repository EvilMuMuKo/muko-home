import { test, expect } from '@playwright/test';

test('gallery filters and modal navigation preserve focus and original downloads', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/gallery/');
  await expect(page.locator('.card')).toHaveCount(9);
  await page.screenshot({ path: 'test-results/gallery-desktop.png' });
  await page.getByRole('button', { name: '卧室与影音', exact: true }).click();
  await expect(page.locator('.card:visible')).toHaveCount(3);
  const trigger = page.getByRole('button', { name: '放大查看：影音室 · 窗边停留', exact: true });
  await trigger.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.locator('#viewer-title')).toHaveText('影音室 · 窗边停留');
  await expect(page.locator('#download')).toHaveAttribute('href', /originals\/V08.png$/);
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#viewer-title')).toHaveText('主卧 · 温暖的暗调');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(trigger).toBeFocused();
  expect(errors).toEqual([]);
});

test('mobile gallery defers original PNGs and fits a narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 });
  const originals: string[] = [];
  page.on('request', request => { if (request.url().includes('/originals/')) originals.push(request.url()); });
  await page.goto('/gallery/');
  await expect(page.locator('.card')).toHaveCount(9);
  await expect(page.locator('.card img').first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(originals).toEqual([]);
  await page.getByRole('button', { name: '放大查看：入户 · MuKo’s Bar', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(originals).toEqual([]);
  await page.getByRole('button', { name: '放大细看', exact: true }).click();
  await expect(page.locator('#viewer-image')).toHaveAttribute('src', /originals\/V01.png$/);
  await expect(page.getByRole('button', { name: '适应屏幕', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.screenshot({ path: 'test-results/gallery-mobile-viewer.png' });
});

test('a shared gallery fragment opens the requested image directly', async ({ page }) => {
  await page.goto('/gallery/#V08');
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.locator('#viewer-title')).toHaveText('影音室 · 窗边停留');
  await page.getByRole('button', { name: '关闭大图', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page).not.toHaveURL(/#V08$/);
});
