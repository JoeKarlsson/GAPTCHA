import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  distanceAndBearing, destinationPoint, compassName, currentCheckpoint, tryCapture, ORIGINAL_CHECKPOINT,
} from '../../public/js/checkpoint.js';

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => (values.has(key) ? values.get(key) : null),
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}

test('distance and bearing match known values', () => {
  // One degree of latitude due north is ~111.2 km.
  const north = distanceAndBearing({ lat: 0, lon: 0 }, { lat: 1, lon: 0 });
  assert.ok(Math.abs(north.distanceMeters - 111195) < 10);
  assert.ok(Math.abs(north.bearingDegrees - 0) < 1e-9);

  const west = distanceAndBearing({ lat: 0, lon: 0 }, { lat: 0, lon: -1 });
  assert.ok(Math.abs(west.bearingDegrees - 270) < 1e-9);
  assert.equal(compassName(west.bearingDegrees), 'west');
  assert.equal(compassName(359), 'north');
});

test('destinationPoint round-trips through distanceAndBearing', () => {
  const start = { lat: 44.9778, lon: -93.265 };
  const end = destinationPoint(start, 123, 250);
  const back = distanceAndBearing(start, end);
  assert.ok(Math.abs(back.distanceMeters - 250) < 0.01);
  assert.ok(Math.abs(back.bearingDegrees - 123) < 0.01);
});

test('players near Honolulu hunt the original checkpoint, others get a nearby demo one', () => {
  const storage = memoryStorage();
  const honolulu = { lat: 21.29, lon: -157.81 };
  assert.equal(currentCheckpoint(honolulu, storage).isDemo, false);

  const minneapolis = { lat: 44.9778, lon: -93.265 };
  const demo = currentCheckpoint(minneapolis, storage, () => 0.5);
  assert.equal(demo.isDemo, true);
  assert.ok(Math.abs(distanceAndBearing(minneapolis, demo).distanceMeters - 200) < 0.01);
  // Same checkpoint on the next call, even with a different random source.
  assert.deepEqual(currentCheckpoint(minneapolis, storage, () => 0.9), demo);
});

test('capture succeeds inside 20 m, then a new hunt starts', () => {
  const storage = memoryStorage();
  const near = destinationPoint(ORIGINAL_CHECKPOINT, 0, 30);
  assert.equal(tryCapture(near, storage).captured, false);
  const result = tryCapture(destinationPoint(ORIGINAL_CHECKPOINT, 0, 10), storage);
  assert.equal(result.captured, true);
  assert.equal(result.attempts, 2);
  assert.equal(storage.getItem('gaptcha-attempts'), '0');
});
