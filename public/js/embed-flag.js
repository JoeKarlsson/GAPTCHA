// Runs before the page paints: inside an iframe (or with ?embed) GAPTCHA shows a demo that plays
// itself instead of the full page, and never asks for location or the camera. Framing pages like
// joekarlsson.com block both through Permissions-Policy anyway.
(function () {
  var framed;
  try {
    framed = window.top !== window.self;
  } catch (error) {
    framed = true; // a cross-origin parent can make reading window.top throw
  }
  if (framed || new URLSearchParams(window.location.search).has('embed')) {
    document.documentElement.setAttribute('data-embed', '');
  }
})();
