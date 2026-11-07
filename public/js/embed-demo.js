// The embedded demo: plays the scripted hunt from demo-steps.js on a map, next to the simulated
// hunters feed, in a loop. It never asks for location or the camera, and keeps everything in
// memory so it can't touch a real player's saved hunt.
import { ORIGINAL_CHECKPOINT, destinationPoint } from './checkpoint.js';
import { addPlayerAttempt, resetAttempts, isFastMode, loadState } from './simulated-players.js';
import { mountHunterFeed, describeStats } from './hunter-feed.js';
import { buildDemoSteps, describeCheck } from './demo-steps.js';
import { loadLeaflet, OSM_TILES, OSM_ATTRIBUTION } from './leaflet-loader.js';

const fast = isFastMode(window.location.search);
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const STEP_MS = fast ? 60 : 1500;
const WALK_MS = fast || reducedMotion ? 0 : 1100;
const PAUSE_AFTER_WIN_MS = fast ? 120 : 4000;
const ARROW_OVERSHOOT_METERS = 150;

// A Storage stand-in that lives only as long as the page.
function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => (values.has(key) ? values.get(key) : null),
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}

const storage = memoryStorage();
const statusLine = document.getElementById('demo-status');
const mapElement = document.getElementById('demo-map');
const statsLine = document.getElementById('demo-hunter-stats');
const steps = buildDemoSteps(ORIGINAL_CHECKPOINT);
// The demo player's scans and checks count toward the shared total, so the stats line keeps up.
function countDemoAttempt() {
  const attempts = addPlayerAttempt(storage);
  statsLine.textContent = describeStats(loadState(storage));
  return attempts;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Links that would leave the frame for the real game open it in a new tab instead.
for (const link of document.querySelectorAll('a[href="play.html"], a[href="/play.html"]')) {
  link.href = 'https://gaptcha.joekarlsson.com/play.html';
  link.target = '_blank';
  link.rel = 'noopener';
}

mountHunterFeed({
  list: document.getElementById('demo-hunter-feed'),
  stats: statsLine,
  checkpoint: ORIGINAL_CHECKPOINT,
  storage,
  delays: { min: 1500, max: 5000 }, // busier than the real page, so a short visit sees hunters
});

function walk(marker, from, to) {
  if (!WALK_MS) {
    marker.setLatLng([to.lat, to.lon]);
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const started = performance.now();
    function frame(now) {
      const progress = Math.min(1, (now - started) / WALK_MS);
      marker.setLatLng([from.lat + (to.lat - from.lat) * progress, from.lon + (to.lon - from.lon) * progress]);
      if (progress < 1) requestAnimationFrame(frame);
      else resolve();
    }
    requestAnimationFrame(frame);
  });
}

async function playHunt(L, layers) {
  let player = null;
  let position = null;
  for (const step of steps) {
    if (step.type === 'start') {
      position = step.at;
      player = L.circleMarker([position.lat, position.lon], {
        radius: 8, color: '#fff', weight: 3, fillColor: '#222', fillOpacity: 1, className: 'demo-player',
      }).addTo(layers);
      statusLine.textContent = step.text;
    } else if (step.type === 'walk') {
      statusLine.textContent = step.text;
      await walk(player, position, step.to);
      position = step.to;
    } else if (step.type === 'scan') {
      countDemoAttempt();
      const arrowEnd = destinationPoint(step.at, step.bearing, step.distanceMeters + ARROW_OVERSHOOT_METERS);
      L.polyline([[step.at.lat, step.at.lon], [arrowEnd.lat, arrowEnd.lon]], {
        color: '#0b7f72', weight: 3, dashArray: '8 6', className: 'demo-arrow',
      }).addTo(layers);
      L.circleMarker([step.at.lat, step.at.lon], {
        radius: 7, color: '#0b7f72', weight: 2, fillColor: '#11DFC7', fillOpacity: 1, className: 'demo-scan',
      }).addTo(layers);
      player.bringToFront();
      statusLine.textContent = step.text;
    } else if (step.type === 'check') {
      const attempts = countDemoAttempt();
      statusLine.textContent = describeCheck(step, attempts);
      if (step.captured) {
        resetAttempts(storage);
        statsLine.textContent = describeStats(loadState(storage));
        L.circleMarker([ORIGINAL_CHECKPOINT.lat, ORIGINAL_CHECKPOINT.lon], {
          radius: 18, color: '#075e55', weight: 4, fill: false, className: 'demo-checkpoint',
        }).bindTooltip('Checkpoint', { permanent: true, direction: 'top', offset: [0, -16] }).addTo(layers);
        player.bringToFront();
        if (reducedMotion) return false; // stay on the finished hunt; the feed keeps running
        await sleep(PAUSE_AFTER_WIN_MS);
        continue;
      }
    } else if (step.type === 'reset') {
      statusLine.textContent = step.text;
    }
    await sleep(reducedMotion ? 0 : STEP_MS);
  }
  return true;
}

loadLeaflet().then(async () => {
  const L = window.L;
  const map = L.map(mapElement, {
    scrollWheelZoom: false,
    dragging: !L.Browser.mobile, // a one-finger drag on a phone scrolls the page, not the map
    tap: false,
  });
  L.tileLayer(OSM_TILES, { maxZoom: 19, attribution: OSM_ATTRIBUTION }).addTo(map);
  const places = steps.flatMap((step) => [step.at, step.to]).filter(Boolean).map((point) => [point.lat, point.lon]);
  map.fitBounds(places, { padding: [24, 24] });
  const layers = L.layerGroup().addTo(map);
  while (await playHunt(L, layers)) layers.clearLayers();
}, (error) => {
  mapElement.textContent = 'The map couldn’t load, so the demo can’t play right now.';
  throw error;
});
