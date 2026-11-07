import { test, expect } from '@playwright/test';
import { watchEmbedDemo } from './embed-helpers.js';

// The harness page comes from route(), which Chromium treats as a public site, and its Local
// Network Access check then refuses to frame localhost. joekarlsson.com framing
// gaptcha.joekarlsson.com is public-to-public, so the check doesn't apply there.
test.use({ launchOptions: { args: ['--disable-features=LocalNetworkAccessChecks'] } });

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
