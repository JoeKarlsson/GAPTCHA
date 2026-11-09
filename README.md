# GAPTCHA

> Geo-Augmented Place That Checks Authenticity

GAPTCHA is an augmented reality scavenger hunt we built at the 2017 AT&T
hackathon in Honolulu. Scan a printed marker and an arrow points toward a
hidden checkpoint; scan a few and walk to where the arrows cross. This repo is
the whole game, a static site. Play it at
[gaptcha.joekarlsson.com](https://gaptcha.joekarlsson.com).

![GAPTCHA's demo playing itself: a hunter near the Honolulu checkpoint scans three markers, dashed lines from each marker cross on the map, the hunter heads to where they cross and the page says GOT 'EM, while a feed lists the simulated hunters' scans](.github/readme/2026-11-recording.gif)

## Quick start

Node.js 22 (what CI uses) and Python 3 for the local server.

```bash
git clone https://github.com/JoeKarlsson/GAPTCHA.git
cd GAPTCHA
npm install
npm run serve        # build dist/ and serve it at http://localhost:4791
```

To play, print [the marker](public/img/marker-gaptcha.png), stick it up name
side on top, facing north, and open the site on your phone. You win within 20
meters of the checkpoint. More than 5 km from the Honolulu original, GAPTCHA
hides a demo checkpoint 100 to 300 meters from you on your first scan.

## Development

```bash
npm test               # unit tests for the bearing and distance math
npm run test:e2e       # Playwright: e2e, axe, layout, metadata and a fake-camera AR test
node scripts/render-og.mjs  # redraw the share card, public/img/og.png
```

| Path | What's in it |
| --- | --- |
| `public/js/checkpoint.js` | Bearing and distance math, the hidden checkpoint, attempts and scan history in `localStorage` |
| `public/js/simulated-players.js` | The other hunters in the feed. There's no server, so they're made up |
| `public/js/embed-*.js`, `demo-steps.js` | The self-playing demo shown in an iframe or with `?embed` |
| `scripts/build.mjs` | Copies `public/` to `dist/` with content-hashed CSS and JS URLs |

Gotchas: add `?simulate=fast` to a URL to speed up the simulated feed. After
changing the share card, bump the `?v=` on the `og:image` URLs. AR runs on
A-Frame 1.7.1 and AR.js 3.4.8 from jsDelivr, pinned with SRI.

Pushing to `master` runs the tests and deploys `dist/` to GitHub Pages.

## Credits

Built at DevLeague by [Joe Karlsson](https://github.com/JoeKarlsson/),
[Sean Nakamura](https://github.com/senakamura/),
[Tony Gaskell](https://github.com/thgaskell/),
[Brandon Baris](https://github.com/brandonbaris/) and
[Joelle Torneros](https://github.com/jmt75200/). Forked from
[thgaskell/GAPTCHA](https://github.com/thgaskell/GAPTCHA). More on
[its page on joekarlsson.com](https://www.joekarlsson.com/work/gaptcha/).

## License

MIT. See [LICENSE](LICENSE).
