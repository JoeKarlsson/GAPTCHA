// Plausible (self-hosted), skipped for bots and headless browsers.
(function () {
  if (
    navigator.webdriver ||
    /bot|crawl|spider|scrape|headless/i.test(navigator.userAgent) ||
    !navigator.languages ||
    navigator.languages.length === 0
  ) {
    return;
  }
  window.plausible =
    window.plausible ||
    function () {
      (window.plausible.q = window.plausible.q || []).push(arguments);
    };
  const script = document.createElement('script');
  script.defer = true;
  script.dataset.domain = 'gaptcha.joekarlsson.com';
  script.src = 'https://plausible.joekarlsson.io/js/script.tagged-events.outbound-links.file-downloads.js';
  document.head.appendChild(script);

  if (document.documentElement.dataset.page === 'not-found') {
    window.plausible('404', { props: { path: location.pathname } });
  }

  // Report the first uncaught error on a page, so breakage on the live site shows up.
  let reported = false;
  const report = (message, source) => {
    if (reported) return;
    reported = true;
    window.plausible('JS Error', {
      props: { message: String(message).slice(0, 200), source, path: location.pathname },
    });
  };
  addEventListener('error', (e) => report(e.message, `${e.filename}:${e.lineno}`));
  addEventListener('unhandledrejection', (e) => report(e.reason, 'promise'));
})();
