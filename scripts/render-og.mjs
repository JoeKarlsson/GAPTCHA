// Renders public/img/og.png (1200x630), the share card, from HTML with Playwright.
// Run: node scripts/render-og.mjs
// Redraws the 2017 "chance to win" poster: yellow ground, pink and blue blocks,
// circles and slanted bars, white Raleway type.
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// inlined: a page made with setContent can't load file:// URLs
const fontUrl = `data:font/woff2;base64,${readFileSync(new URL('../public/fonts/raleway-latin.woff2', import.meta.url)).toString('base64')}`;
const output = fileURLToPath(new URL('../public/img/og.png', import.meta.url));

const color = { yellow: '#fff200', pink: '#f49ac1', sky: '#6dcff6', navy: '#2357a5', white: '#fff' };

const circle = (x, y, size, fill) =>
  `<div class="circle" style="left:${x}px;top:${y}px;width:${size}px;height:${size}px;background:${fill}"></div>`;
// slanted bars: parallelograms with upright sides, running down to the right
const slant = (x, y, fill) => `<div class="slant" style="left:${x}px;top:${y}px;background:${fill}"></div>`;

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: Raleway; font-weight: 300 600; src: url('${fontUrl}') format('woff2'); }
* { margin: 0; box-sizing: border-box; }
body { width: 1200px; height: 630px; background: ${color.yellow}; position: relative; overflow: hidden; font-family: Raleway, sans-serif; }
.circle { position: absolute; border-radius: 50%; }
.slant { position: absolute; width: 64px; height: 108px; clip-path: polygon(0 0, 100% 64px, 100% 100%, 0 44px); }
.stack { position: absolute; left: 388px; top: 160px; width: 428px; display: flex; flex-direction: column; gap: 10px; }
.block { color: ${color.white}; text-align: center; }
.name { background: ${color.pink}; font-size: 78px; font-weight: 600; line-height: 92px; }
.tagline { background: ${color.navy}; font-size: 38px; font-weight: 400; line-height: 62px; }
.win { background: ${color.sky}; font-size: 140px; font-weight: 600; line-height: 130px; letter-spacing: normal; }
.tag { position: absolute; left: 0; right: 0; top: 498px; text-align: center; color: ${color.navy}; font-size: 36px; font-weight: 600; }
</style></head><body>
${circle(313, 27, 60, color.sky)}${circle(350, 66, 50, color.pink)}
${circle(781, 37, 72, color.navy)}${circle(829, 13, 54, color.pink)}
${circle(338, 512, 66, color.pink)}${circle(313, 552, 52, color.navy)}
${circle(781, 538, 62, color.pink)}
${slant(286, 120, color.sky)}${slant(286, 206, color.pink)}${slant(286, 292, color.navy)}
${slant(852, 280, color.sky)}${slant(852, 360, color.pink)}${slant(852, 440, color.navy)}
<div class="stack">
  <div class="block name">GAPTCHA</div>
  <div class="block tagline">Find, scan</div>
  <div class="block win">WIN!</div>
</div>
<div class="tag">#chancetowin</div>
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.setContent(html);
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: output });
await browser.close();
console.log(`Wrote ${output}`);
