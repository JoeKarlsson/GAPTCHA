import { scan, compassName, knownCheckpoint } from './checkpoint.js';
import { addPlayerAttempt } from './simulated-players.js';
import { mountHunterFeed } from './hunter-feed.js';

const arrow = document.getElementById('arrow');
const status = document.getElementById('status');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let hasBearing = false;
let spinDegrees = 0;

// Spin the arrow until we know where to point it (the original "leet spin").
function spinUntilBearing() {
  if (hasBearing) return;
  spinDegrees = (spinDegrees + 5) % 360;
  arrow.setAttribute('rotation', `0 ${-spinDegrees} 0`);
  requestAnimationFrame(spinUntilBearing);
}
if (!reduceMotion) requestAnimationFrame(spinUntilBearing);

function pointArrow(bearingDegrees) {
  hasBearing = true;
  arrow.setAttribute('rotation', `0 ${-Math.round(bearingDegrees)} 0`);
}

function storage() {
  try {
    return window.localStorage;
  } catch {
    status.textContent = 'This browser is blocking storage, so GAPTCHA can’t remember your hunt.';
    throw new Error('localStorage unavailable');
  }
}

// A scan happens when the camera finds a marker, not when the page loads.
// Location is fetched in advance so the bearing is ready the moment a marker shows up.
const RESCAN_AFTER_MS = 30000; // seeing the same marker again within this window only re-points the arrow
let player = null;
let markerInView = false;
let lastScanAt = -Infinity;
let lastBearing = null;

function scanNow() {
  const now = Date.now();
  if (lastBearing !== null && now - lastScanAt < RESCAN_AFTER_MS) {
    pointArrow(lastBearing);
    return;
  }
  const { bearingDegrees } = scan(player, storage());
  addPlayerAttempt(storage());
  lastScanAt = now;
  lastBearing = bearingDegrees;
  pointArrow(bearingDegrees);
  status.textContent = `The checkpoint is to the ${compassName(bearingDegrees)} (${Math.round(bearingDegrees)}°). Scan another marker somewhere else to close in.`;
}

document.getElementById('marker').addEventListener('markerFound', () => {
  markerInView = true;
  if (player) scanNow();
  else status.textContent = 'Marker found. Waiting for your location…';
});
document.getElementById('marker').addEventListener('markerLost', () => {
  markerInView = false;
});

if (!('geolocation' in navigator)) {
  status.textContent = 'This browser can’t share your location, so GAPTCHA can’t point you anywhere.';
} else {
  status.textContent = 'Point your camera at a GAPTCHA marker.';
  navigator.geolocation.watchPosition(
    (position) => {
      const firstFix = player === null;
      player = { lat: position.coords.latitude, lon: position.coords.longitude };
      if (firstFix && markerInView) scanNow();
    },
    (error) => {
      status.textContent = `Couldn’t get your location: ${error.message}. Allow location access and reload.`;
    },
    { enableHighAccuracy: true, timeout: 20000, maximumAge: 10000 }
  );
}

mountHunterFeed({
  list: document.getElementById('hunter-feed'),
  stats: document.getElementById('hunter-stats'),
  checkpoint: knownCheckpoint(storage()),
  storage: storage(),
});
