# GAPTCHA

> Geo-Augmented Place That Checks Authenticity

An augmented reality scavenger hunt. Play it at **https://gaptcha.joekarlsson.com**.

![marker-gaptcha](public/img/marker-gaptcha.png)

## How it works

1. Print the [marker](public/img/marker-gaptcha.png) and stick it somewhere, printed name on top and facing north.
2. Open the site on your phone and tap **Scan a marker**. When the camera sees the marker, an arrow appears on it pointing toward the hidden checkpoint.
3. Scan from a few places and follow where the arrows cross.
4. When you think you're there, tap **Did I win?** You need to be within 20 meters.

The original checkpoint is the Sacred Hearts cafeteria in Honolulu, where we built this for the 2017 AT&T hackathon. Anywhere more than 5 km from it, GAPTCHA hides a demo checkpoint 100 to 300 meters from you on your first scan, and keeps it until you find it or tap **Start a new hunt**.

## What changed in 2026

The 2017 version ran on Express and stored the checkpoint and every scan in AT&T M2X, which shut down in 2021. It's now a static site:

- `public/js/checkpoint.js` replaces the old `/api/checkpoint` routes in the browser: bearing and distance math, the hidden checkpoint, attempt counts and scan history, all in `localStorage`.
- The "live feed" map now shows your own scans (Leaflet with OpenStreetMap tiles).
- AR runs on A-Frame 1.7.1 and AR.js 3.4.8 from jsDelivr (pinned, with SRI), instead of the vendored 2017 builds. The arrow is built from A-Frame shapes instead of a PLY model.

## Develop

```bash
npm install
npm run serve        # http://localhost:4791
npm test             # unit tests for the bearing/distance math
npx playwright test  # e2e, axe, layout and metadata tests; includes a fake-camera AR test
```

Pushing to `master` runs the tests and deploys `public/` to GitHub Pages.

## Credits

Built at DevLeague by [Joe Karlsson](https://github.com/JoeKarlsson/), [Sean Nakamura](https://github.com/senakamura/), [Tony Gaskell](https://github.com/thgaskell/), [Brandon Baris](https://github.com/brandonbaris/) and [Joelle Torneros](https://github.com/jmt75200/). Forked from [thgaskell/GAPTCHA](https://github.com/thgaskell/GAPTCHA).
