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

test('play page status panel has no axe violations', async ({ page, context }) => {
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation(HONOLULU_CHECKPOINT);
  await page.goto('/play.html');
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
  await expect(page.locator('#win-status')).toHaveText(/GOT ’EM! You found it after 2 attempts/);
});

test('players far from Honolulu get a demo checkpoint and their scans land on the map', async ({ page, context }) => {
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: 44.9778, longitude: -93.265 });
  await page.goto('/play.html');
  await expect(page.locator('#status')).toContainText('checkpoint is to the');
  const checkpoint = await page.evaluate(() => JSON.parse(localStorage.getItem('gaptcha-checkpoint')));
  expect(Math.abs(checkpoint.lat - 44.9778)).toBeLessThan(0.01);

  await page.goto('/');
  await expect(page.locator('#scan-summary')).toHaveText(/^1 scan from this browser/);
  await expect(page.locator('#scan-map path.leaflet-interactive')).toHaveCount(1);
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
    expect(html, file).toContain('<meta property="og:image" content="https://gaptcha.joekarlsson.com/img/og.png">');
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
