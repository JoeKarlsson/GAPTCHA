// Records any attempt to read location or open the camera, and every status line the demo shows.
export async function watchEmbedDemo(context) {
  await context.addInitScript(() => {
    window.__privacyCalls = [];
    const record = (name) => () => window.__privacyCalls.push(name);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition = record('getCurrentPosition');
      navigator.geolocation.watchPosition = record('watchPosition');
    }
    if (navigator.mediaDevices) navigator.mediaDevices.getUserMedia = record('getUserMedia');
    window.__statuses = [];
    document.addEventListener('DOMContentLoaded', () => {
      const status = document.getElementById('demo-status');
      if (!status) return;
      new MutationObserver(() => window.__statuses.push(status.textContent)).observe(status, { childList: true, characterData: true, subtree: true });
    });
  });
}
