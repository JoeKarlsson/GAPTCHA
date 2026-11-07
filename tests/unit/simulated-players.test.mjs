import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  seededRandom, initialState, nextEvent, describeEvent, addPlayerAttempt, resetAttempts, loadState,
  SCAN_DELAY_MS, SCAN_DISTANCE_METERS, HUNTERS,
} from '../../public/js/simulated-players.js';
import { distanceAndBearing } from '../../public/js/checkpoint.js';

const CHECKPOINT = { lat: 44.9778, lon: -93.265 };

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => (values.has(key) ? values.get(key) : null),
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}

function runEvents(seed, count) {
  const random = seededRandom(seed);
  let state = initialState(random);
  const events = [];
  for (let i = 0; i < count; i += 1) {
    const result = nextEvent(state, CHECKPOINT, random);
    events.push(result.event);
    state = result.state;
  }
  return events;
}

test('the same seed plays out the same hunt', () => {
  assert.deepEqual(runEvents(42, 50), runEvents(42, 50));
  assert.notDeepEqual(runEvents(42, 50), runEvents(43, 50));
});

test('events arrive every 5 to 25 seconds', () => {
  for (const event of runEvents(7, 500)) {
    assert.ok(event.delayMs >= SCAN_DELAY_MS.min && event.delayMs <= SCAN_DELAY_MS.max, event.delayMs);
  }
});

test('simulated scans land within range of the checkpoint, and the hunter count stays in bounds', () => {
  for (const event of runEvents(11, 500)) {
    assert.ok(event.hunters >= HUNTERS.min && event.hunters <= HUNTERS.max);
    if (event.type !== 'scan') continue;
    const { distanceMeters } = distanceAndBearing(CHECKPOINT, event.position);
    assert.ok(distanceMeters >= SCAN_DISTANCE_METERS.min - 1 && distanceMeters <= SCAN_DISTANCE_METERS.max + 1, distanceMeters);
  }
});

test('attempts tick up on each scan, and a find resets them', () => {
  const random = seededRandom(3);
  let state = { attempts: 10, hunters: 4 };
  let sawFind = false;
  for (let i = 0; i < 2000 && !sawFind; i += 1) {
    const before = state.attempts;
    const { event, state: next } = nextEvent(state, CHECKPOINT, random);
    if (event.type === 'found') {
      sawFind = true;
      assert.equal(event.attempts, before + 1);
      assert.equal(next.attempts, 0);
      assert.match(describeEvent(event), /found the checkpoint after \d+ attempts/);
    } else {
      assert.equal(next.attempts, before + 1);
      assert.match(describeEvent(event), /^\S+ scanned a marker \d+ m (north|south|east|west|northeast|northwest|southeast|southwest) of the checkpoint\.$/);
    }
    state = next;
  }
  assert.ok(sawFind, 'a simulated hunter finds it eventually');
});

test("the player's attempts add to the shared counter and a win resets it", () => {
  const storage = memoryStorage();
  const start = loadState(storage, seededRandom(1)).attempts;
  storage.setItem('gaptcha-simulation', JSON.stringify({ attempts: start, hunters: 4 }));
  assert.equal(addPlayerAttempt(storage), start + 1);
  resetAttempts(storage);
  assert.equal(JSON.parse(storage.getItem('gaptcha-simulation')).attempts, 0);
  assert.equal(storage.getItem('gaptcha-checkpoint'), null, 'the simulation never touches the player hunt');
});
