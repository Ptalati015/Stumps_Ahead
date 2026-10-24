// Drag-to-move input for the batting view (SPEC 12.1, 15.3). Before release
// the batter can be dragged across the crease; shots come from the buttons.
// The maths is pure and unit tested; attachDrag only wires pointer events.
import { MAX_OFFSET_M } from '../../engine/outcomes.js';

// Dragging this many pixels moves the batter the full range.
const DRAG_PX_FOR_FULL_RANGE = 90;

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
 * Wire pointer events on the drag zone.
 * handlers:
 *   enabled(): boolean   whether a drag moves the batter right now
 *   onMove(dx)           px from the start of the drag
 *   onMoveEnd()
 * @returns {{ detach(): void }}
 */
export function attachDrag(zone, handlers) {
  let g = null; // current drag

  function down(e) {
    if (e.button != null && e.button !== 0) return;
    if (g || !handlers.enabled()) return;
    e.preventDefault?.();
    g = { id: e.pointerId, x: e.clientX };
    zone.setPointerCapture?.(e.pointerId);
  }

  function move(e) {
    if (!g || e.pointerId !== g.id) return;
    if (handlers.enabled()) handlers.onMove(e.clientX - g.x);
  }

  function end(e) {
    if (!g || e.pointerId !== g.id) return;
    g = null;
    zone.releasePointerCapture?.(e.pointerId);
    handlers.onMoveEnd();
  }

  zone.addEventListener('pointerdown', down);
  zone.addEventListener('pointermove', move);
  zone.addEventListener('pointerup', end);
  zone.addEventListener('pointercancel', end);
  return {
    detach() {
      zone.removeEventListener('pointerdown', down);
      zone.removeEventListener('pointermove', move);
      zone.removeEventListener('pointerup', end);
      zone.removeEventListener('pointercancel', end);
      g = null;
    },
  };
}
