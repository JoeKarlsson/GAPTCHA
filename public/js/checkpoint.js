// Client-side stand-in for the old AT&T M2X checkpoint API (M2X shut down in 2021).
// Everything lives in the browser: the hidden checkpoint, attempt count and scan history.

export const CAPTURE_RADIUS_METERS = 20;

// The original hackathon checkpoint (Sacred Hearts cafeteria, Honolulu).
export const ORIGINAL_CHECKPOINT = { lat: 21.285471, lon: -157.807362 };

// Players farther than this from the original get a demo checkpoint near them.
const ORIGINAL_PLAY_AREA_METERS = 5000;
const DEMO_MIN_METERS = 100;
const DEMO_MAX_METERS = 300;
const MAX_SAVED_SCANS = 50;

const STORAGE_KEYS = {
  checkpoint: 'gaptcha-checkpoint',
  attempts: 'gaptcha-attempts',
  scans: 'gaptcha-scans',
};

const EARTH_RADIUS_METERS = 6371008.8;
const toRadians = (degrees) => (degrees * Math.PI) / 180;
const toDegrees = (radians) => (radians * 180) / Math.PI;

// Great-circle distance (haversine) and the initial compass bearing from `from` to `to`.
export function distanceAndBearing(from, to) {
  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(to.lat);
  const deltaLat = lat2 - lat1;
  const deltaLon = toRadians(to.lon - from.lon);

  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
  const distanceMeters = 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(a)));

  const y = Math.sin(deltaLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLon);
  const bearingDegrees = (toDegrees(Math.atan2(y, x)) + 360) % 360;

  return { distanceMeters, bearingDegrees };
}

// The point `distanceMeters` away from `from` along `bearingDegrees`.
export function destinationPoint(from, bearingDegrees, distanceMeters) {
  const angularDistance = distanceMeters / EARTH_RADIUS_METERS;
  const bearing = toRadians(bearingDegrees);
  const lat1 = toRadians(from.lat);
  const lon1 = toRadians(from.lon);

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angularDistance) +
      Math.cos(lat1) * Math.sin(angularDistance) * Math.cos(bearing)
  );
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(lat1),
      Math.cos(angularDistance) - Math.sin(lat1) * Math.sin(lat2)
    );

  return { lat: toDegrees(lat2), lon: ((toDegrees(lon2) + 540) % 360) - 180 };
}

const COMPASS_POINTS = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'];
export function compassName(bearingDegrees) {
  return COMPASS_POINTS[Math.round(bearingDegrees / 45) % 8];
}

function readJson(storage, key, fallback) {
  const raw = storage.getItem(key);
  return raw === null ? fallback : JSON.parse(raw);
}

// The checkpoint this player is hunting. Near Honolulu it's the original;
// anywhere else it's a demo checkpoint 100-300 m away, kept until found or reset.
export function currentCheckpoint(player, storage, random = Math.random) {
  if (distanceAndBearing(player, ORIGINAL_CHECKPOINT).distanceMeters <= ORIGINAL_PLAY_AREA_METERS) {
    return { ...ORIGINAL_CHECKPOINT, isDemo: false };
  }
  const saved = readJson(storage, STORAGE_KEYS.checkpoint, null);
  if (saved && distanceAndBearing(player, saved).distanceMeters <= ORIGINAL_PLAY_AREA_METERS) {
    return { ...saved, isDemo: true };
  }
  const distance = DEMO_MIN_METERS + random() * (DEMO_MAX_METERS - DEMO_MIN_METERS);
  const demo = destinationPoint(player, random() * 360, distance);
  storage.setItem(STORAGE_KEYS.checkpoint, JSON.stringify(demo));
  return { ...demo, isDemo: true };
}

export function startNewHunt(storage) {
  storage.removeItem(STORAGE_KEYS.checkpoint);
  storage.setItem(STORAGE_KEYS.attempts, '0');
}

function countAttempt(storage) {
  const attempts = readJson(storage, STORAGE_KEYS.attempts, 0) + 1;
  storage.setItem(STORAGE_KEYS.attempts, String(attempts));
  return attempts;
}

// Replaces GET /api/checkpoint/lat/:lat/long/:lon: logs the scan and returns the way to the checkpoint.
export function scan(player, storage, now = Date.now()) {
  countAttempt(storage);
  const scans = readJson(storage, STORAGE_KEYS.scans, []);
  scans.push({ lat: player.lat, lon: player.lon, timestamp: now });
  storage.setItem(STORAGE_KEYS.scans, JSON.stringify(scans.slice(-MAX_SAVED_SCANS)));
  return distanceAndBearing(player, currentCheckpoint(player, storage));
}

// Replaces GET /api/checkpoint/capture/lat/:lat/long/:lon.
export function tryCapture(player, storage) {
  const attempts = countAttempt(storage);
  const { distanceMeters } = distanceAndBearing(player, currentCheckpoint(player, storage));
  if (distanceMeters < CAPTURE_RADIUS_METERS) {
    startNewHunt(storage);
    return { captured: true, attempts, distanceMeters };
  }
  return { captured: false, attempts, distanceMeters };
}

export function savedScans(storage) {
  return readJson(storage, STORAGE_KEYS.scans, []);
}

// The checkpoint being hunted, without creating one: the saved demo checkpoint, or the original.
export function knownCheckpoint(storage) {
  const saved = readJson(storage, STORAGE_KEYS.checkpoint, null);
  return saved ? { ...saved, isDemo: true } : { ...ORIGINAL_CHECKPOINT, isDemo: false };
}
