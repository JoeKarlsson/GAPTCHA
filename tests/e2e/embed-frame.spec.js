import { test, expect } from '@playwright/test';
import { watchEmbedDemo } from './embed-helpers.js';

// The harness page comes from route(), which Chromium treats as a public site, and its Local
// Network Access check then refuses to frame localhost. joekarlsson.com framing
// gaptcha.joekarlsson.com is public-to-public, so the check doesn't apply there.
// WebKit has no such check and refuses Chromium flags, so the flag goes to Chromium only.
test.use({
  launchOptions: async ({ browserName }, use) => {
    await use(browserName === 'chromium' ? { args: ['--disable-features=LocalNetworkAccessChecks'] } : {});
  },
});

test('framed by another site, the page switches to the demo on its own', async ({ page, context }) => {
  await watchEmbedDemo(context);
  // 127.0.0.1 and localhost are different origins, so this is a real cross-origin frame.
  await page.route('http://127.0.0.1:4791/harness', (route) => route.fulfill({
    contentType: 'text/html',
    body: '<!doctype html><title>Harness</title><iframe src="http://localhost:4791/?simulate=fast" style="width:1200px;height:1100px;border:0"></iframe>',
  }));
  await page.goto('http://127.0.0.1:4791/harness');
  const frame = page.frameLocator('iframe');
  await expect(frame.locator('#demo')).toBeVisible();
  await expect(frame.locator('.hero')).toBeHidden();
  await expect(frame.locator('#demo-map path.demo-scan').first()).toBeAttached();
  const child = page.frames().find((f) => f.url().startsWith('http://localhost:4791/'));
  expect(await child.evaluate(() => window.__privacyCalls)).toEqual([]);
});

// joekarlsson.com frames the demo at a fixed height that follows the frame's width (its project
// page uses max(880px, min(1070px, 1440px - 130cqw))), so the page must fill its frame and never
// grow past it as the hunters feed fills in and the hunt loops. It used to grow 250-300px a loop.
// Sizes: a laptop and a tablet column, a narrow window where the columns stack, an iPhone and the
// narrowest phone. Run once, in Chromium, since it sets its own sizes.
for (const [label, width, height] of [
  ['laptop', 856, 880],
  ['tablet', 764, 880],
  ['narrow window', 500, 880],
  ['iphone', 361, 971],
  ['narrow phone', 288, 1066],
]) {
  test(`fills a ${label} frame (${width}x${height}) without growing past it`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'sets its own frame sizes');
    await page.setViewportSize({ width, height });
    await page.goto('/?embed&simulate=fast');
    await expect(page.locator('#demo-map path.demo-scan').first()).toBeAttached();
    let tallest = 0;
    let textOverMap = false;
    // Fast mode loops the hunt and fills the feed within a few seconds
    for (let i = 0; i < 40; i++) {
      const now = await page.evaluate(() => {
        const note = document.querySelector('.simulated-note').getBoundingClientRect();
        const map = document.getElementById('demo-map').getBoundingClientRect();
        const stacked = map.top >= note.top;
        return { height: document.documentElement.scrollHeight, textOverMap: stacked && note.bottom > map.top };
      });
      tallest = Math.max(tallest, now.height);
      textOverMap ||= now.textOverMap;
      await page.waitForTimeout(150);
    }
    expect(await page.locator('#demo-hunter-feed li').count()).toBeGreaterThan(0);
    expect(tallest).toBeLessThanOrEqual(height);
    expect(textOverMap).toBe(false);
  });
}
