import { scan, compassName } from './checkpoint.js';

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

if (!('geolocation' in navigator)) {
  status.textContent = 'This browser can’t share your location, so GAPTCHA can’t point you anywhere.';
} else {
  navigator.geolocation.getCurrentPosition(
    (position) => {
      const player = { lat: position.coords.latitude, lon: position.coords.longitude };
      const { bearingDegrees } = scan(player, storage());
      pointArrow(bearingDegrees);
      status.textContent = `The checkpoint is to the ${compassName(bearingDegrees)} (${Math.round(bearingDegrees)}°). Scan from somewhere else to close in.`;
    },
    (error) => {
      status.textContent = `Couldn’t get your location: ${error.message}. Allow location access and reload.`;
    },
    { enableHighAccuracy: true, timeout: 20000 }
  );
}
