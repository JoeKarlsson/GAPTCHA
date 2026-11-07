import { tryCapture, startNewHunt, savedScans, ORIGINAL_CHECKPOINT } from './checkpoint.js';

const winButton = document.getElementById('win-button');
const newHuntButton = document.getElementById('new-hunt-button');
const winStatus = document.getElementById('win-status');

function storage() {
  try {
    return window.localStorage;
  } catch {
    winStatus.textContent = 'This browser is blocking storage, so GAPTCHA can’t remember your hunt.';
    throw new Error('localStorage unavailable');
  }
}

winButton.addEventListener('click', () => {
  if (!('geolocation' in navigator)) {
    winStatus.textContent = 'This browser can’t share your location.';
    return;
  }
  winStatus.textContent = 'Checking where you are…';
  navigator.geolocation.getCurrentPosition(
    (position) => {
      const player = { lat: position.coords.latitude, lon: position.coords.longitude };
      const result = tryCapture(player, storage());
      winStatus.textContent = result.captured
        ? `GOT ’EM! You found it after ${result.attempts} attempts.`
        : 'Nope, not here. Scan another marker and try again.';
    },
    (error) => {
      winStatus.textContent = `Couldn’t get your location: ${error.message}.`;
    },
    { enableHighAccuracy: true, timeout: 20000 }
  );
});

newHuntButton.addEventListener('click', () => {
  startNewHunt(storage());
  winStatus.textContent = 'Done. Your next scan hides a new checkpoint near you.';
});

// The scan map replaces the old live M2X feed: it shows this browser's own scans.
const mapElement = document.getElementById('scan-map');
const mapSummary = document.getElementById('scan-summary');
const scans = savedScans(storage());
const center = scans.length ? scans[scans.length - 1] : ORIGINAL_CHECKPOINT;
const map = window.L.map(mapElement, { scrollWheelZoom: false }).setView([center.lat, center.lon], 15);
window.L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
}).addTo(map);
for (const point of scans) {
  window.L.circleMarker([point.lat, point.lon], { radius: 8, color: '#0b7f72', fillColor: '#11DFC7', fillOpacity: 1 })
    .bindPopup(`Scanned ${new Date(point.timestamp).toLocaleString()}`)
    .addTo(map);
}
mapSummary.textContent = scans.length
  ? `${scans.length} scan${scans.length === 1 ? '' : 's'} from this browser, most recent at the center of the map.`
  : 'No scans from this browser yet. The map starts at the original checkpoint’s neighborhood in Honolulu.';

const copyLinkButton = document.getElementById('copy-link-button');
copyLinkButton.addEventListener('click', async () => {
  await navigator.clipboard.writeText('https://gaptcha.joekarlsson.com/');
  copyLinkButton.textContent = 'Link copied';
});
