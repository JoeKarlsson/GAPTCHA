import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync, readdirSync } from 'node:fs';

const PAGES = ['/', '/play.html', '/404.html'];
const HONOLULU_CHECKPOINT = { latitude: 21.285471, longitude: -157.807362 };

// Fail on console errors and failed requests. The play page asks for the camera,
// which headless browsers without a fake device refuse; that error is expected.
function watchForErrors(page) {
  const errors = [];
  page.on('console', (message) => {
    if (message.type() === 'error' && !/getUserMedia|NotFoundError|Requested device not found|NotAllowedError|webcam/i.test(message.text())) {
      errors.push(message.text());
    }
  });
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('requestfailed', (request) => errors.push(`failed: ${request.url()}`));
  return errors;
}

for (const path of PAGES) {
  test(`${path} loads without errors and has no sideways scroll`, async ({ page, context }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation(HONOLULU_CHECKPOINT);
    const errors = watchForErrors(page);
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1')).toHaveCount(1);
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 800 });
      // The play page crops an oversized camera feed with overflow: hidden, so test whether
      // the page can actually move sideways rather than comparing scrollWidth.
      const scrolledX = await page.evaluate(() => {
        window.scrollTo(500, window.scrollY);
        const x = window.scrollX;
        window.scrollTo(0, window.scrollY);
        return x;
      });
      expect(scrolledX, `sideways scroll at ${width}px`).toBe(0);
    }
    expect(errors).toEqual([]);
  });
}

for (const path of ['/', '/404.html']) {
  test(`${path} has no axe violations`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .exclude('.leaflet-container')
      .analyze();
    expect(results.violations).toEqual([]);
  });
}

// Stands in for AR.js seeing the printed marker (the camera path is covered in ar.spec.js).
async function findMarker(page) {
  await expect(page.locator('#status')).not.toHaveText('');
  await page.evaluate(() => document.getElementById('marker').dispatchEvent(new CustomEvent('markerFound')));
}

test('play page status panel has no axe violations', async ({ page, context }) => {
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation(HONOLULU_CHECKPOINT);
  await page.goto('/play.html');
  await findMarker(page);
  await expect(page.locator('#status')).toContainText('checkpoint is to the');
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .include('.panel')
    .analyze();
  expect(results.violations).toEqual([]);
});

test('standing on the checkpoint wins, and a miss says so', async ({ page, context }) => {
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: 21.2857, longitude: -157.8077 }); // ~40 m away
  await page.goto('/');
  await page.getByRole('button', { name: 'Did I win?' }).click();
  await expect(page.locator('#win-status')).toHaveText(/Nope, not here/);

  await context.setGeolocation(HONOLULU_CHECKPOINT);
  await page.getByRole('button', { name: 'Did I win?' }).click();
  await expect(page.locator('#win-status')).toHaveText(/GOT ’EM! It took a total of \d+ attempts since it was last found/);
});

test('players far from Honolulu get a demo checkpoint and their scans land on the map', async ({ page, context }) => {
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: 44.9778, longitude: -93.265 });
  await page.goto('/play.html');
  await findMarker(page);
  await expect(page.locator('#status')).toContainText('checkpoint is to the');
  const checkpoint = await page.evaluate(() => JSON.parse(localStorage.getItem('gaptcha-checkpoint')));
  expect(Math.abs(checkpoint.lat - 44.9778)).toBeLessThan(0.01);

  await page.goto('/');
  await expect(page.locator('#scan-summary')).toHaveText(/^1 scan from this browser/);
  await page.locator('#scan-map').scrollIntoViewIfNeeded();
  await expect(page.locator('#scan-map path.own-scan')).toHaveCount(1);
});

test('at 2560px the content stays in the centered column', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'desktop only');
  await page.setViewportSize({ width: 2560, height: 1400 });
  await page.goto('/');
  const outside = await page.evaluate(() => {
    const columnWidth = 960 + 40; // Skeleton container plus its padding
    const left = (window.innerWidth - columnWidth) / 2;
    const right = left + columnWidth;
    return [...document.querySelectorAll('.container *')]
      .filter((element) => element.closest('.container') && element.getBoundingClientRect().width > 0)
      .filter((element) => {
        const box = element.getBoundingClientRect();
        return box.left < left - 1 || box.right > right + 1;
      })
      .map((element) => element.outerHTML.slice(0, 80));
  });
  expect(outside).toEqual([]);
});

test('every page has its metadata and the sitemap lists the indexable ones', async () => {
  const htmlFiles = readdirSync('public').filter((file) => file.endsWith('.html'));
  const sitemap = readFileSync('public/sitemap.xml', 'utf8');
  const indexable = [];
  const titles = new Set();
  for (const file of htmlFiles) {
    const html = readFileSync(`public/${file}`, 'utf8');
    const description = html.match(/<meta name="description" content="([^"]*)">/)?.[1];
    expect(html, file).toMatch(/<title>[^<]+<\/title>/);
    expect(description?.length, `${file} description`).toBeLessThanOrEqual(160);
    expect(html, file).toContain('<meta name="color-scheme" content="only light">');
    expect(html, file).toContain('<meta name="darkreader-lock">');
    expect(html, file).toContain('<meta property="og:image" content="https://gaptcha.joekarlsson.com/img/og.png?v=2">');
    expect(html.match(/<h1[\s>]/g)?.length, `${file} h1 count`).toBe(1);
    const title = html.match(/<title>([^<]+)<\/title>/)[1];
    expect(titles.has(title), `duplicate title ${title}`).toBe(false);
    titles.add(title);
    if (!html.includes('content="noindex"')) {
      expect(html, file).toMatch(/<link rel="canonical" href="https:\/\/gaptcha\.joekarlsson\.com\//);
      indexable.push(file === 'index.html' ? 'https://gaptcha.joekarlsson.com/' : `https://gaptcha.joekarlsson.com/${file}`);
    }
  }
  const listed = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  expect(listed.sort()).toEqual(indexable.sort());
});

test('security.txt has not expired', async () => {
  const expires = readFileSync('public/.well-known/security.txt', 'utf8').match(/^Expires: (.+)$/m)[1];
  expect(new Date(expires).getTime()).toBeGreaterThan(Date.now() + 30 * 24 * 60 * 60 * 1000);
});

test('photos keep their proportions at every width', async ({ page }) => {
  await page.goto('/');
  const images = page.locator('img');
  for (const img of await images.all()) {
    await img.scrollIntoViewIfNeeded();
    const ratios = await img.evaluate((el) => el.complete && el.naturalWidth
      ? { rendered: el.clientWidth / el.clientHeight, natural: el.naturalWidth / el.naturalHeight, src: el.src }
      : null);
    if (!ratios || !ratios.rendered) continue;
    expect(Math.abs(ratios.rendered - ratios.natural), ratios.src).toBeLessThan(0.02);
  }
});

test('simulated hunters show up in the feed and on the map', async ({ page, context }) => {
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: 44.9778, longitude: -93.265 });
  await page.goto('/?simulate=fast');
  await expect(page.locator('#hunter-stats')).toHaveText(/\d+ hunters active now · \d+ attempts since the checkpoint was last found/);
  await expect(page.locator('#hunter-feed li').first()).toHaveText(/scanned a marker|found the checkpoint/);
  await expect(page.locator('#hunter-feed li')).toHaveCount(5);
  await page.locator('#scan-map').scrollIntoViewIfNeeded();
  await expect(page.locator('#scan-map path.hunter-dot').first()).toBeAttached();
  await expect(page.getByText('Other hunters are simulated in this demo.')).toBeVisible();

  await page.goto('/play.html?simulate=fast');
  await expect(page.locator('#hunter-feed li').first()).toHaveText(/scanned a marker|found the checkpoint/);
});

test('your own win uses the shared attempt counter and resets it', async ({ page, context }) => {
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation(HONOLULU_CHECKPOINT);
  await page.addInitScript(() => localStorage.setItem('gaptcha-simulation', JSON.stringify({ attempts: 41, hunters: 5 })));
  await page.goto('/');
  await page.getByRole('button', { name: 'Did I win?' }).click();
  await expect(page.locator('#win-status')).toHaveText('GOT ’EM! It took a total of 42 attempts since it was last found.');
});

test('the play page doesn’t scan until a marker is in view', async ({ page, context }) => {
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: 44.9778, longitude: -93.265 });
  await page.goto('/play.html');
  await expect(page.locator('#status')).toHaveText('Point your camera at a GAPTCHA marker.');
  await page.waitForTimeout(1500);
  await expect(page.locator('#status')).toHaveText('Point your camera at a GAPTCHA marker.');
  expect(await page.evaluate(() => localStorage.getItem('gaptcha-scans'))).toBeNull();

  await findMarker(page);
  await expect(page.locator('#status')).toContainText('checkpoint is to the');
});

test('Leaflet loads only when the map nears the screen', async ({ page }) => {
  const leafletRequests = [];
  page.on('request', (request) => { if (request.url().includes('leaflet')) leafletRequests.push(request.url()); });
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  expect(leafletRequests).toEqual([]);
  await page.locator('#scan-map').scrollIntoViewIfNeeded();
  await expect(page.locator('#scan-map .leaflet-tile-pane')).toBeAttached();
  expect(leafletRequests.length).toBe(2);
});

test('every section is the same distance from the next', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'one viewport is enough; the spacing tokens are shared');
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    const gaps = await page.evaluate(() => {
      // content box of each section: its container, including anything that hangs out of it (the hero phone)
      const boxes = [...document.querySelectorAll('.section > .container')].map((container) => {
        let bottom = container.getBoundingClientRect().bottom;
        for (const element of container.querySelectorAll('*')) {
          if (!element.closest('.leaflet-container')) bottom = Math.max(bottom, element.getBoundingClientRect().bottom);
        }
        return { top: container.getBoundingClientRect().top, bottom };
      });
      return boxes.slice(1).map((box, index) => Math.round(box.top - boxes[index].bottom));
    });
    expect(Math.max(...gaps) - Math.min(...gaps), `gaps at ${width}px: ${gaps.join(', ')}`).toBeLessThanOrEqual(4);
  }
});

test('every local CSS and JS URL carries a content hash', async ({ page }) => {
  for (const path of ['/', '/play.html', '/404.html']) {
    await page.goto(path);
    const urls = await page.$$eval('link[rel=stylesheet][href], script[src]', (els) =>
      els.map((el) => el.getAttribute('href') ?? el.getAttribute('src')).filter((url) => !/^https?:/.test(url)));
    expect(urls.length, path).toBeGreaterThan(0);
    for (const url of urls) expect(url, `${path} ${url}`).toMatch(/\?v=[0-9a-f]{10}$/);
  }
});
