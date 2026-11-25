// Shows the simulated hunters (see simulated-players.js) on a page.
import { startSimulation, describeEvent, isFastMode, nextEvent, seededRandom } from './simulated-players.js';

const MAX_ITEMS = 5;

export function describeStats(state) {
  return `${state.hunters} hunters active now. ${state.attempts} attempts since the checkpoint was last found.`;
}

// Scans from just before the page opened, so the feed starts full. Display only: they don't
// touch the shared attempt count, and a find would contradict the stats line, so only scans.
export function recentScans(state, checkpoint, random, count = MAX_ITEMS) {
  const scans = [];
  let current = state;
  while (scans.length < count) {
    const next = nextEvent(current, checkpoint, random);
    if (next.event.type === 'scan') scans.push(next.event);
    current = next.state;
  }
  return scans;
}

// `list` gets MAX_ITEMS rows, newest first. A new event moves the text down a row instead of
// adding a row, so nothing below the feed shifts; the newest event is announced on its own.
// `stats` shows the counts.
export function mountHunterFeed({ list, stats, checkpoint, storage, delays, onScan = () => {} }) {
  const rows = Array.from({ length: MAX_ITEMS }, () => list.appendChild(document.createElement('li')));
  const announcer = document.createElement('p');
  announcer.className = 'visually-hidden';
  announcer.setAttribute('role', 'status');
  list.after(announcer);

  function show(texts) {
    rows.forEach((row, index) => { row.textContent = texts[index] ?? ''; });
  }

  const simulation = startSimulation({
    checkpoint,
    storage,
    fast: isFastMode(window.location.search),
    delays,
    onEvent(event, state) {
      const text = describeEvent(event);
      show([text, ...rows.map((row) => row.textContent)]);
      announcer.textContent = text;
      stats.textContent = describeStats(state);
      if (event.type === 'scan') onScan(event);
    },
  });
  const recent = recentScans(simulation.state, checkpoint, seededRandom(Date.now()));
  show(recent.map(describeEvent));
  recent.forEach(onScan);
  stats.textContent = describeStats(simulation.state);
  return simulation;
}

// A button that pauses and resumes something that keeps updating on its own (WCAG 2.2.2).
export function wirePauseButton(button, { pause, resume, noun }) {
  let paused = false;
  button.addEventListener('click', () => {
    paused = !paused;
    if (paused) pause();
    else resume();
    button.textContent = `${paused ? 'Resume' : 'Pause'} ${noun}`;
  });
}
