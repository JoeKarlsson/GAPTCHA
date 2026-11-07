import { test, expect, chromium } from '@playwright/test';
import { resolve } from 'node:path';

// Feeds Chromium a fake camera showing the printed marker, then checks AR.js finds it
// and the arrow points along the bearing to the checkpoint.
test('the camera finds the marker and the arrow points at the checkpoint', async ({}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'fake camera needs Chromium flags; runs once');
  const browser = await chromium.launch({
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      `--use-file-for-fake-video-capture=${resolve('tests/fixtures/marker.y4m')}`,
    ],
  });
  const context = await browser.newContext({
    permissions: ['camera', 'geolocation'],
    geolocation: { latitude: 21.2900, longitude: -157.8074 }, // ~500 m due north of the checkpoint
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  await page.goto('http://localhost:4791/play.html');
  await expect(page.locator('#status')).toContainText('to the south');
  await expect
    .poll(() => page.evaluate(() => document.getElementById('marker').object3D.visible), { timeout: 15000 })
    .toBe(true);
  const rotation = await page.evaluate(() => document.getElementById('arrow').getAttribute('rotation').y);
  expect(Math.abs(rotation + 180) < 2 || Math.abs(rotation - 180) < 2).toBe(true);
  await browser.close();
});
