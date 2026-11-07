// Shows the simulated hunters (see simulated-players.js) on a page.
import { startSimulation, describeEvent, isFastMode } from './simulated-players.js';

const MAX_ITEMS = 5;

export function describeStats(state) {
  return `${state.hunters} hunters active now · ${state.attempts} attempts since the checkpoint was last found`;
}

// `list` gets one <li> per event, newest first; `stats` shows the counts.
export function mountHunterFeed({ list, stats, checkpoint, storage, delays, onScan = () => {} }) {
  const simulation = startSimulation({
    checkpoint,
    storage,
    fast: isFastMode(window.location.search),
    delays,
    onEvent(event, state) {
      const item = document.createElement('li');
      item.textContent = describeEvent(event);
      list.prepend(item);
      while (list.children.length > MAX_ITEMS) list.lastElementChild.remove();
      stats.textContent = describeStats(state);
      if (event.type === 'scan') onScan(event);
    },
  });
  stats.textContent = describeStats(simulation.state);
  return simulation;
}
