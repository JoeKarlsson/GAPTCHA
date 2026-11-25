// Renders public/img/og.png (1200x630), the share card, from HTML with Playwright.
// Run: node scripts/render-og.mjs
// The card is the marker, like the site: a thick black frame, GAPTCHA in Anybody,
// and the marker's triangle in the AR arrow's green.
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// inlined: a page made with setContent can't load file:// URLs
const font = (name) => `data:font/woff2;base64,${readFileSync(new URL(`../public/fonts/${name}`, import.meta.url)).toString('base64')}`;
const output = fileURLToPath(new URL('../public/img/og.png', import.meta.url));

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: Anybody; font-weight: 400 900; font-stretch: 50% 150%; src: url('${font('anybody-latin.woff2')}') format('woff2'); }
@font-face { font-family: Archivo; font-weight: 400 700; font-stretch: 62% 125%; src: url('${font('archivo-latin.woff2')}') format('woff2'); }
* { margin: 0; box-sizing: border-box; }
body { width: 1200px; height: 630px; background: #fff; border: 48px solid #000; position: relative; overflow: hidden; }
.name { position: absolute; left: 50px; top: 30px; font: 900 260px/0.85 Anybody; font-stretch: 50%; }
.line { position: absolute; left: 54px; bottom: 50px; width: 560px; font: 400 40px/1.3 Archivo; }
.triangle { position: absolute; right: 50px; bottom: 50px; width: 320px; height: 320px; background: #10a63c; clip-path: polygon(100% 0, 100% 100%, 0 100%); }
</style></head><body>
<div class="name">GAPTCHA</div>
<div class="line">Scan markers. Walk to where the arrows cross.</div>
<div class="triangle"></div>
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.setContent(html);
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: output });
await browser.close();
console.log(`Wrote ${output}`);
