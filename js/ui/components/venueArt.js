// Small stylised ground for a Venue card (SPEC 14.1): an oval of stands in
// the venue's colours, the field and pitch strip, a scoreboard block and the
// sky. night = pink ball: dark sky, four floodlights with a glow. Drawn by us
// with the SVG helpers (attributes only), no images or logos.

import { svg } from '../scene/svg.js';

const W = 120;
const H = 80;

function mix(hex, other, f) {
  const a = parseInt(hex.slice(1), 16);
  const b = parseInt(other.slice(1), 16);
  const ch = (s) => Math.round(((a >> s) & 255) * (1 - f) + ((b >> s) & 255) * f);
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

/** @param {import('../../data/venues.js').Venue} venue */
export function venueArt(venue, { night = false } = {}) {
  const [lower, upper, trim] = venue.stands;
  const root = svg('svg', { class: 'vart', viewBox: `0 0 ${W} ${H}`, 'aria-hidden': 'true', focusable: 'false' });
  // Sky, in two bands for a little depth.
  svg('rect', { width: W, height: H, fill: night ? '#06101f' : mix(venue.sky, '#ffffff', 0.25) }, root);
  svg('rect', { y: 0, width: W, height: 14, fill: night ? '#020711' : mix(venue.sky, '#3a6fa0', 0.35) }, root);
  if (night) {
    for (const [x, y] of [[14, 6], [40, 4], [80, 4], [106, 6]]) {
      svg('circle', { cx: x, cy: y + 2, r: 13, fill: '#ffe9a8', opacity: 0.07 }, root);
      svg('circle', { cx: x, cy: y + 2, r: 7, fill: '#fff3c4', opacity: 0.16 }, root);
    }
  }
  // Stands: upper tier, lower tier, then the roof trim around the top.
  svg('ellipse', { cx: 60, cy: 50, rx: 56, ry: 28, fill: night ? mix(upper, '#000000', 0.45) : upper }, root);
  svg('ellipse', { cx: 60, cy: 50, rx: 56, ry: 28, fill: 'none', stroke: trim, 'stroke-width': 1.6 }, root);
  svg('ellipse', { cx: 60, cy: 52, rx: 46, ry: 22, fill: night ? mix(lower, '#000000', 0.35) : lower }, root);
  // Crowd speckle on the stands.
  const dots = ['#f4f4ee', '#f2c14e', '#e05a5a', '#7fb7e6'];
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2;
    const r = i % 2 ? 0.92 : 0.84;
    svg('circle', { cx: 60 + Math.cos(a) * 51 * r, cy: 51 + Math.sin(a) * 25 * r, r: 0.9, fill: dots[i % 4], opacity: night ? 1 : 0.75 }, root);
  }
  // Field, mowing band and the pitch strip.
  svg('ellipse', { cx: 60, cy: 54, rx: 38, ry: 17, fill: night ? '#3f9b4e' : '#2f7d3c' }, root);
  svg('ellipse', { cx: 60, cy: 54, rx: 26, ry: 11, fill: night ? '#47a35a' : '#36883f' }, root);
  svg('rect', { x: 57.5, y: 46, width: 5, height: 16, rx: 0.8, fill: '#d8c597' }, root);
  // Scoreboard block on the far side.
  svg('rect', { x: 50, y: 15, width: 20, height: 9, rx: 1, fill: '#151b22', stroke: trim, 'stroke-width': 0.8 }, root);
  for (let i = 0; i < 4; i++) svg('rect', { x: 53 + i * 4, y: 18, width: 2.4, height: 3, fill: night ? '#ffd23f' : '#9be07f' }, root);
  // Floodlight towers at night.
  if (night) {
    for (const [x, y] of [[14, 6], [40, 4], [80, 4], [106, 6]]) {
      svg('rect', { x: x - 0.5, y: y + 2, width: 1, height: 22 - y, fill: '#2a3240' }, root);
      svg('rect', { x: x - 4, y, width: 8, height: 3.4, rx: 0.6, fill: '#fff8de', stroke: '#2a3240', 'stroke-width': 0.4 }, root);
    }
  }
  return root;
}
