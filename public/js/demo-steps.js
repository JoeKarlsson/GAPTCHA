// The scripted hunt the embedded demo plays: walk to three markers, scan each one for an arrow
// toward the hidden checkpoint, head to where the arrows cross, miss once, then win.
// Pure and deterministic, so the demo and its tests see the same hunt every time.
import {
  ORIGINAL_CHECKPOINT, CAPTURE_RADIUS_METERS, destinationPoint, distanceAndBearing, compassName,
} from './checkpoint.js';

// Places around the original Sacred Hearts checkpoint, as bearing and distance from it.
const START = { bearing: 225, meters: 420 };
const MARKERS = [
  { bearing: 240, meters: 330 },
  { bearing: 320, meters: 260 },
  { bearing: 140, meters: 290 },
];
const FIRST_GUESS = { bearing: 200, meters: 45 };
const FINAL_GUESS = { bearing: 80, meters: 8 };

const around = (checkpoint, { bearing, meters }) => destinationPoint(checkpoint, bearing, meters);

export function buildDemoSteps(checkpoint = ORIGINAL_CHECKPOINT) {
  const steps = [{
    type: 'start',
    at: around(checkpoint, START),
    text: 'A hunter sets out in Honolulu. The checkpoint is hidden somewhere nearby.',
  }];

  for (const [index, marker] of MARKERS.entries()) {
    const at = around(checkpoint, marker);
    const { bearingDegrees, distanceMeters } = distanceAndBearing(at, checkpoint);
    const bearing = Math.round(bearingDegrees);
    steps.push({ type: 'walk', to: at, text: `Walking to marker ${index + 1} of ${MARKERS.length}…` });
    steps.push({
      type: 'scan',
      at,
      bearing,
      distanceMeters,
      text: `Scanned marker ${index + 1}. The arrow points ${compassName(bearing)} (${bearing}°).`,
    });
  }

  for (const [guess, text] of [[FIRST_GUESS, 'Heading to where the arrows cross…'], [FINAL_GUESS, 'A little closer…']]) {
    const at = around(checkpoint, guess);
    const { distanceMeters } = distanceAndBearing(at, checkpoint);
    steps.push({ type: 'walk', to: at, text });
    steps.push({ type: 'check', at, distanceMeters, captured: distanceMeters < CAPTURE_RADIUS_METERS });
  }

  steps.push({ type: 'reset', text: 'Starting a new hunt…' });
  return steps;
}

// What the status line says after a "Did I win?" check, given the shared attempt count.
export function describeCheck(step, attempts) {
  return step.captured
    ? `GOT ’EM! It took a total of ${attempts} attempts since it was last found.`
    : 'Did I win? Nope, not here. Keep following the arrows.';
}
