import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDemoSteps, describeCheck } from '../../public/js/demo-steps.js';
import { ORIGINAL_CHECKPOINT, CAPTURE_RADIUS_METERS, distanceAndBearing } from '../../public/js/checkpoint.js';

const steps = buildDemoSteps(ORIGINAL_CHECKPOINT);

test('the demo hunt is the same every time', () => {
  assert.deepEqual(buildDemoSteps(ORIGINAL_CHECKPOINT), steps);
});

test('it starts, scans three markers, misses once, wins, then resets', () => {
  assert.deepEqual(steps.map((step) => step.type), [
    'start', 'walk', 'scan', 'walk', 'scan', 'walk', 'scan', 'walk', 'check', 'walk', 'check', 'reset',
  ]);
  const checks = steps.filter((step) => step.type === 'check');
  assert.deepEqual(checks.map((step) => step.captured), [false, true]);
});

test('every scan’s arrow points at the checkpoint', () => {
  for (const step of steps.filter((s) => s.type === 'scan')) {
    const { bearingDegrees } = distanceAndBearing(step.at, ORIGINAL_CHECKPOINT);
    assert.ok(Math.abs(bearingDegrees - step.bearing) < 1, `${step.text} vs ${bearingDegrees}`);
  }
});

test('each scan is walked to first, and the arrows come from different directions', () => {
  steps.forEach((step, index) => {
    if (step.type === 'scan') assert.deepEqual(steps[index - 1].to, step.at);
  });
  const bearings = steps.filter((s) => s.type === 'scan').map((s) => s.bearing);
  assert.equal(new Set(bearings.map((b) => Math.round(b / 45))).size, bearings.length);
});

test('the start is a few hundred meters out, and the win is inside the capture radius', () => {
  const start = distanceAndBearing(steps[0].at, ORIGINAL_CHECKPOINT).distanceMeters;
  assert.ok(start > 200 && start < 600, `start ${start} m away`);
  const [miss, win] = steps.filter((s) => s.type === 'check');
  assert.ok(miss.distanceMeters >= CAPTURE_RADIUS_METERS);
  assert.ok(win.distanceMeters < CAPTURE_RADIUS_METERS);
});

test('a win reports the shared attempt count; a miss says to keep going', () => {
  const [miss, win] = steps.filter((s) => s.type === 'check');
  assert.equal(describeCheck(win, 17), 'GOT ’EM! It took a total of 17 attempts since it was last found.');
  assert.match(describeCheck(miss, 3), /Nope, not here/);
});
