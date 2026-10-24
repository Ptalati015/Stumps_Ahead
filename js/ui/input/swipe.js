// Swipe-to-hit and drag-to-move input for the batting view (SPEC 12.1).
// The maths is pure and unit tested; attachSwipe only wires pointer events.
import { shotFromAim, normAngle, MAX_OFFSET_M } from '../../engine/outcomes.js';

// A swipe counts (and its timing is taken) once it has moved this far.
export const SWIPE_THRESHOLD_PX = 30;
// Longer than this fraction of the zone height and the shot is played in the air.
// On a phone the zone is only ~100px tall, so there is a floor: otherwise
// nearly every swipe past the 30px threshold would be aerial.
export const AERIAL_FRACTION = 0.4;
export const AERIAL_MIN_PX = 110;
// Dragging this many pixels moves the batter the full range.
const DRAG_PX_FOR_FULL_RANGE = 90;

/**
 * Screen swipe vector to a batter-relative aim angle. The camera is behind
 * the batter: up the screen is straight back past the bowler, and a
 * right-hander's off side is screen right (mirrored for a left-hander).
 * @param {number} dx  px, + = right
 * @param {number} dy  px, + = down
 * @param {'R'|'L'} bats
 * @returns {number} degrees, 0 = straight, + = leg side
 */
export function swipeToAim(dx, dy, bats = 'R') {
  const screenDeg = (Math.atan2(dx, -dy) * 180) / Math.PI; // 0 = up, + = right
  const aim = bats === 'L' ? screenDeg : -screenDeg;
  return Math.round(normAngle(aim));
}

/**
 * Turn a finished gesture into a shot.
 * @returns {{shot:string, aimDeg:number, aerial:boolean}}
 */
export function classifySwipe({ dx, dy, zoneHeight, loft = false, bats = 'R' }) {
  const len = Math.hypot(dx, dy);
  if (len < SWIPE_THRESHOLD_PX) return { shot: 'defend', aimDeg: 0, aerial: false };
  const aimDeg = swipeToAim(dx, dy, bats);
  const aerial = Boolean(loft) || len > Math.max(AERIAL_MIN_PX, (zoneHeight || 0) * AERIAL_FRACTION);
  return { shot: shotFromAim(aimDeg, aerial), aimDeg, aerial };
}

/** Horizontal drag in px to a batter offset in metres (+ = leg side). */
export function dragToOffset(startOffset, dx, bats = 'R') {
  // Screen right is a right-hander's off side, which is negative offset.
  const metres = (dx / DRAG_PX_FOR_FULL_RANGE) * MAX_OFFSET_M * (bats === 'L' ? 1 : -1);
  return clampOffset(startOffset + metres);
}

/** Clamp to the crease range and snap to the nearest 5 cm. */
export function clampOffset(m) {
  const c = Math.min(MAX_OFFSET_M, Math.max(-MAX_OFFSET_M, m));
  return Math.round(c * 20) / 20;
}

/**
 * Wire pointer events on the swipe zone.
 * handlers:
 *   mode(): 'move' | 'swipe' | 'off'   what a gesture does right now
 *   onMove(dx)                          drag in move mode (px from gesture start)
 *   onMoveEnd()
 *   onAim({ aimDeg, aerial } | null)    live aim while swiping
 *   onShot({ shot, aimDeg, aerial, atMs })  once per gesture; atMs = when it passed the threshold (or the tap)
 *   zoneHeight(), loft(), bats()
 * @returns {{ detach(): void, flush(): void }} flush resolves a swipe still in progress (finger not lifted yet)
 */
export function attachSwipe(zone, handlers) {
  let g = null; // current gesture

  const now = (e) => (e && e.timeStamp > 0 ? e.timeStamp : performance.now());

  function down(e) {
    if (e.button != null && e.button !== 0) return;
    const mode = handlers.mode();
    if (mode === 'off' || g) return;
    e.preventDefault?.();
    g = { id: e.pointerId, x: e.clientX, y: e.clientY, dx: 0, dy: 0, t: now(e), mode, atMs: null, done: false };
    zone.setPointerCapture?.(e.pointerId);
  }

  function move(e) {
    if (!g || e.pointerId !== g.id || g.done) return;
    const dx = e.clientX - g.x;
    const dy = e.clientY - g.y;
    if (g.mode === 'move') {
      handlers.onMove(dx);
      return;
    }
    g.dx = dx;
    g.dy = dy;
    if (g.atMs == null && Math.hypot(dx, dy) >= SWIPE_THRESHOLD_PX) g.atMs = now(e);
    if (g.atMs != null) {
      const c = classifySwipe({ dx, dy, zoneHeight: handlers.zoneHeight(), loft: handlers.loft(), bats: handlers.bats() });
      handlers.onAim({ aimDeg: c.aimDeg, aerial: c.aerial });
    }
  }

  function resolve(gesture, dx, dy) {
    gesture.done = true;
    handlers.onAim(null);
    const c = classifySwipe({ dx, dy, zoneHeight: handlers.zoneHeight(), loft: handlers.loft(), bats: handlers.bats() });
    // A tap is timed at the touch; a swipe when it passed the threshold.
    handlers.onShot({ ...c, atMs: gesture.atMs ?? gesture.t });
  }

  function up(e) {
    if (!g || e.pointerId !== g.id) return;
    const gesture = g;
    g = null;
    zone.releasePointerCapture?.(e.pointerId);
    if (gesture.done) return;
    if (gesture.mode === 'move') {
      handlers.onMoveEnd();
      return;
    }
    resolve(gesture, e.clientX - gesture.x, e.clientY - gesture.y);
  }

  function flush() {
    if (g && g.mode === 'swipe' && !g.done && g.atMs != null) resolve(g, g.dx, g.dy);
  }

  function cancel(e) {
    if (!g || e.pointerId !== g.id) return;
    if (g.mode === 'move') handlers.onMoveEnd();
    else handlers.onAim(null);
    g = null;
  }

  zone.addEventListener('pointerdown', down);
  zone.addEventListener('pointermove', move);
  zone.addEventListener('pointerup', up);
  zone.addEventListener('pointercancel', cancel);
  return {
    flush,
    detach() {
      zone.removeEventListener('pointerdown', down);
      zone.removeEventListener('pointermove', move);
      zone.removeEventListener('pointerup', up);
      zone.removeEventListener('pointercancel', cancel);
      g = null;
    },
  };
}
