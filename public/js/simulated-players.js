// Made-up other hunters, so the game feels busy without a server.
// Everything here is simulated in the browser and labeled as such on the page.
// The player's own hunt (checkpoint, scans) lives in checkpoint.js; this module
// keeps its own shared attempt counter under a separate localStorage key.

import { destinationPoint, distanceAndBearing, compassName } from './checkpoint.js';

const STORAGE_KEY = 'gaptcha-simulation';

export const SCAN_DELAY_MS = { min: 5000, max: 25000 };
export const FAST_SCAN_DELAY_MS = { min: 50, max: 200 }; // ?simulate=fast, for tests
export const SCAN_DISTANCE_METERS = { min: 60, max: 600 };
export const HUNTERS = { min: 2, max: 12 };
export const FIND_CHANCE = 1 / 40; // per simulated event

const HANDLES = [
  'kai_808', 'leilani.h', 'brandon_b', 'mochi_hunter', 'nakamura', 'spamusubi', 'tony_g', 'jmt75200',
  'shaka_sam', 'ukulele_lu', 'pupu_platter', 'diamondhead', 'koa_k', 'hula_hoop', 'manoa_mapper', 'poke_bowl',
];

// Small seeded RNG (mulberry32) so a seed always produces the same hunt.
export function seededRandom(seed) {
  let state = seed >>> 0;
  return function random() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const between = (random, { min, max }) => min + random() * (max - min);

export function initialState(random) {
  return {
    attempts: Math.round(between(random, { min: 12, max: 60 })),
    hunters: Math.round(between(random, { min: 3, max: 7 })),
  };
}

// The next simulated event and the state after it. Pure: same state + RNG, same result.
export function nextEvent(state, checkpoint, random, delays = SCAN_DELAY_MS) {
  const delayMs = Math.round(between(random, delays));
  const handle = HANDLES[Math.floor(random() * HANDLES.length)];

  // Hunters drift up or down by one now and then.
  const drift = random();
  let hunters = state.hunters;
  if (drift < 0.2 && hunters > HUNTERS.min) hunters -= 1;
  else if (drift > 0.8 && hunters < HUNTERS.max) hunters += 1;

  if (random() < FIND_CHANCE) {
    return {
      event: { type: 'found', handle, delayMs, attempts: state.attempts + 1, hunters },
      state: { attempts: 0, hunters },
    };
  }

  const position = destinationPoint(checkpoint, random() * 360, between(random, SCAN_DISTANCE_METERS));
  // Describe where the scan was relative to the checkpoint, the way the old live feed did.
  const { distanceMeters, bearingDegrees } = distanceAndBearing(checkpoint, position);
  const attempts = state.attempts + 1;
  return {
    event: {
      type: 'scan', handle, delayMs, attempts, hunters, position,
      distanceMeters: Math.round(distanceMeters / 10) * 10,
      direction: compassName(bearingDegrees),
    },
    state: { attempts, hunters },
  };
}

export function describeEvent(event) {
  return event.type === 'found'
    ? `${event.handle} found the checkpoint after ${event.attempts} attempts. New hunt started.`
    : `${event.handle} scanned a marker ${event.distanceMeters} m ${event.direction} of the checkpoint.`;
}

export function loadState(storage, random) {
  const raw = storage.getItem(STORAGE_KEY);
  return raw === null ? initialState(random) : JSON.parse(raw);
}

export function saveState(storage, state) {
  storage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// The player's own scan or "Did I win?" tap counts toward the shared total.
export function addPlayerAttempt(storage, random = Math.random) {
  const state = loadState(storage, random);
  const next = { ...state, attempts: state.attempts + 1 };
  saveState(storage, next);
  return next.attempts;
}

export function resetAttempts(storage, random = Math.random) {
  saveState(storage, { ...loadState(storage, random), attempts: 0 });
}

// Runs the feed: calls onEvent for each simulated event until stop() is called.
export function startSimulation({ checkpoint, storage, onEvent, seed = Date.now(), fast = false }) {
  const random = seededRandom(seed);
  const delays = fast ? FAST_SCAN_DELAY_MS : SCAN_DELAY_MS;
  let timer = null;

  function schedule() {
    const { event, state } = nextEvent(loadState(storage, random), checkpoint, random, delays);
    timer = setTimeout(() => {
      // Re-read so attempts the player made in the meantime aren't lost.
      const current = loadState(storage, random);
      const merged = event.type === 'found'
        ? { attempts: 0, hunters: state.hunters }
        : { attempts: current.attempts + 1, hunters: state.hunters };
      saveState(storage, merged);
      onEvent({ ...event, attempts: event.type === 'found' ? current.attempts + 1 : merged.attempts }, merged);
      schedule();
    }, event.delayMs);
  }

  const startState = loadState(storage, random);
  saveState(storage, startState);
  schedule();
  return { state: startState, stop: () => clearTimeout(timer) };
}

export function isFastMode(search) {
  return new URLSearchParams(search).get('simulate') === 'fast';
}
