import { tryCapture, startNewHunt, savedScans, knownCheckpoint } from './checkpoint.js';
import { addPlayerAttempt, resetAttempts } from './simulated-players.js';
import { mountHunterFeed } from './hunter-feed.js';

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
      // The win message counts every hunter's attempts, like the 2017 version did.
      const sharedAttempts = addPlayerAttempt(storage());
      if (result.captured) {
        resetAttempts(storage());
        winStatus.textContent = `GOT ’EM! It took a total of ${sharedAttempts} attempts since it was last found.`;
      } else {
        winStatus.textContent = 'Nope, not here. Scan another marker and try again.';
      }
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

// The scan map replaces the old live M2X feed: this browser's own scans, plus simulated hunters.
// Leaflet (CSS and JS) loads only when the map nears the screen, so it never blocks the first paint.
const LEAFLET = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/';
const LEAFLET_CSS_SRI = 'sha384-sHL9NAb7lN7rfvG5lfHpm643Xkcjzp4jFvuavGOndn6pjVqS6ny56CAt3nsEVT4H';
const LEAFLET_JS_SRI = 'sha384-cxOPjt7s7Iz04uaHJceBmS+qpjv2JkIHNVcuOrM+YHwZOmJGBXI00mdUXEq65HTH';

function loadFromCdn(tag, attributes) {
  return new Promise((resolve, reject) => {
    const element = document.createElement(tag);
    Object.assign(element, attributes, { crossOrigin: 'anonymous' });
    element.addEventListener('load', resolve);
    element.addEventListener('error', () => reject(new Error(`Couldn’t load ${attributes.href || attributes.src}`)));
    document.head.append(element);
  });
}

const loadLeaflet = () => Promise.all([
  loadFromCdn('link', { rel: 'stylesheet', href: `${LEAFLET}leaflet.css`, integrity: LEAFLET_CSS_SRI }),
  loadFromCdn('script', { src: `${LEAFLET}leaflet.js`, integrity: LEAFLET_JS_SRI }),
]);

const mapElement = document.getElementById('scan-map');
const mapSummary = document.getElementById('scan-summary');
const scans = savedScans(storage());
const checkpoint = knownCheckpoint(storage());
const center = scans.length ? scans[scans.length - 1] : checkpoint;
mapSummary.textContent = scans.length
  ? `${scans.length} scan${scans.length === 1 ? '' : 's'} from this browser, most recent at the center of the map. Filled dots are yours.`
  : 'No scans from this browser yet. The map starts in your hunt’s neighborhood.';

const MAX_HUNTER_DOTS = 25;
let map = null;
const hunterDots = [];
const hunterScans = []; // kept until the map exists, then drawn

function drawHunterScan(event) {
  const dot = window.L.circleMarker([event.position.lat, event.position.lon], {
    radius: 6, color: '#075e55', weight: 2, fillColor: '#fff', fillOpacity: 1, className: 'hunter-dot',
  }).bindPopup(`${event.handle} (simulated)`).addTo(map);
  hunterDots.push(dot);
  if (hunterDots.length > MAX_HUNTER_DOTS) hunterDots.shift().remove();
}

function createMap() {
  map = window.L.map(mapElement, { scrollWheelZoom: false }).setView([center.lat, center.lon], 15);
  window.L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);
  for (const point of scans) {
    window.L.circleMarker([point.lat, point.lon], { radius: 8, color: '#0b7f72', fillColor: '#11DFC7', fillOpacity: 1, className: 'own-scan' })
      .bindPopup(`Scanned ${new Date(point.timestamp).toLocaleString()}`)
      .addTo(map);
  }
  for (const event of hunterScans.splice(0).slice(-MAX_HUNTER_DOTS)) drawHunterScan(event);
}

const mapObserver = new IntersectionObserver((entries) => {
  if (!entries.some((entry) => entry.isIntersecting)) return;
  mapObserver.disconnect();
  loadLeaflet().then(createMap, (error) => {
    mapElement.textContent = 'The map couldn’t load. Your scans are still saved in this browser.';
    throw error;
  });
}, { rootMargin: '600px 0px' });
mapObserver.observe(mapElement);

mountHunterFeed({
  list: document.getElementById('hunter-feed'),
  stats: document.getElementById('hunter-stats'),
  checkpoint,
  storage: storage(),
  onScan(event) {
    if (map) drawHunterScan(event);
    else hunterScans.push(event);
  },
});

const copyLinkButton = document.getElementById('copy-link-button');
copyLinkButton.addEventListener('click', async () => {
  await navigator.clipboard.writeText('https://gaptcha.joekarlsson.com/');
  copyLinkButton.textContent = 'Link copied';
});
