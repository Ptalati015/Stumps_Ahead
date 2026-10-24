// SVG helpers for the match scene. Attributes only (no style attributes or
// markup strings), so the page's Content-Security-Policy stays strict.

const NS = 'http://www.w3.org/2000/svg';

/** svg('circle', { r: 2 }, parent) creates an SVG element and appends it to parent. */
export function svg(tag, attrs = {}, parent = null) {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v !== null && v !== undefined) node.setAttribute(k, String(v));
  }
  if (parent) parent.append(node);
  return node;
}

export function set(node, attrs) {
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
}

/** Points list for polyline/polygon from [[x, y], ...]. */
export function pts(list) {
  return list.map(([x, y]) => `${x.toFixed(3)},${y.toFixed(3)}`).join(' ');
}

// Rotate the down vector (0, 1) by deg, clockwise on screen like SVG rotate().
export function dirOf(deg) {
  const r = (deg * Math.PI) / 180;
  return [-Math.sin(r), Math.cos(r)];
}

export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp01 = (t) => (t < 0 ? 0 : t > 1 ? 1 : t);
export const easeOut = (t) => 1 - (1 - t) * (1 - t);
export const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t));

/** Interpolate a pose object between keyframes [{t, ...values}], t in 0..1. */
export function keyframes(frames, t) {
  if (t <= frames[0].t) return frames[0];
  for (let i = 1; i < frames.length; i++) {
    const b = frames[i];
    if (t <= b.t) {
      const a = frames[i - 1];
      const u = easeInOut((t - a.t) / (b.t - a.t));
      const out = {};
      for (const k of Object.keys(b)) out[k] = typeof b[k] === 'number' ? lerp(a[k] ?? b[k], b[k], u) : b[k];
      return out;
    }
  }
  return frames[frames.length - 1];
}
