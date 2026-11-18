import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../../public/js/analytics.js', import.meta.url), 'utf8');

// Runs analytics.js against a stand-in window and returns what it queued and loaded.
function loadAnalytics({ userAgent = 'Mozilla/5.0 (Macintosh)', page = 'home' } = {}) {
  const listeners = {};
  const appended = [];
  const window = {
    navigator: { webdriver: false, userAgent, languages: ['en-US'] },
    location: { pathname: '/play.html' },
    document: {
      documentElement: { dataset: { page } },
      head: { appendChild: (element) => appended.push(element) },
      createElement: () => ({ dataset: {} }),
    },
    addEventListener: (type, listener) => {
      listeners[type] = listener;
    },
  };
  window.window = window;
  vm.runInNewContext(source, window);
  const events = () => JSON.parse(JSON.stringify((window.plausible.q || []).map((args) => [...args])));
  return { window, listeners, appended, events };
}

test('bots get the queue stub but no Plausible script', () => {
  const { window, appended } = loadAnalytics({ userAgent: 'Googlebot/2.1' });
  assert.equal(typeof window.plausible, 'function');
  assert.equal(appended.length, 0);
});

test('the 404 page sends its path', () => {
  const { events } = loadAnalytics({ page: 'not-found' });
  assert.deepEqual(events(), [['404', { props: { path: '/play.html' } }]]);
});

test('only the first script error on a page is reported, extension errors never', () => {
  const { listeners, events } = loadAnalytics();
  listeners.error({ message: 'boom', filename: 'chrome-extension://abc/content.js', lineno: 3 });
  listeners.unhandledrejection({ reason: new Error("Failed to create 'TrustedTypePolicy' named 'ext'") });
  listeners.error({ message: 'x is undefined', filename: 'https://gaptcha.joekarlsson.com/js/play.js', lineno: 12 });
  listeners.error({ message: 'second', filename: 'https://gaptcha.joekarlsson.com/js/play.js', lineno: 20 });
  assert.deepEqual(events(), [
    ['JS Error', { props: { message: 'x is undefined', source: 'https://gaptcha.joekarlsson.com/js/play.js:12', path: '/play.html' } }],
  ]);
});
