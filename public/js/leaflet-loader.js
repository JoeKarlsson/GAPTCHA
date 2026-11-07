// Loads Leaflet (CSS and JS) from the CDN on demand, with integrity checks, so it never blocks the first paint.
const LEAFLET = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/';
const LEAFLET_CSS_SRI = 'sha384-sHL9NAb7lN7rfvG5lfHpm643Xkcjzp4jFvuavGOndn6pjVqS6ny56CAt3nsEVT4H';
const LEAFLET_JS_SRI = 'sha384-cxOPjt7s7Iz04uaHJceBmS+qpjv2JkIHNVcuOrM+YHwZOmJGBXI00mdUXEq65HTH';

function loadFromCdn(tag, attributes) {
  return new Promise((resolve, reject) => {
    const element = document.createElement(tag);
    Object.assign(element, attributes, { crossOrigin: 'anonymous' });
    element.addEventListener('load', resolve);
    element.addEventListener('error', () => reject(new Error(`Couldn’t load ${attributes.href || attributes.src}`)));
    document.head.append(element);
  });
}

export const loadLeaflet = () => Promise.all([
  loadFromCdn('link', { rel: 'stylesheet', href: `${LEAFLET}leaflet.css`, integrity: LEAFLET_CSS_SRI }),
  loadFromCdn('script', { src: `${LEAFLET}leaflet.js`, integrity: LEAFLET_JS_SRI }),
]);

export const OSM_TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
