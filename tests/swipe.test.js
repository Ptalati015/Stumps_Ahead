import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dragToOffset, clampOffset, attachDrag } from '../js/ui/input/swipe.js';

test('drag moves toward the off side for screen right (right-hander) and clamps at 0.6 m', () => {
  assert.ok(dragToOffset(0, 30, 'R') < 0);
  assert.ok(dragToOffset(0, 30, 'L') > 0);
  assert.equal(dragToOffset(0, 1000, 'R'), -0.6);
  assert.equal(dragToOffset(0, -1000, 'R'), 0.6);
  assert.equal(clampOffset(0.149), 0.15);
});

// Minimal pointer events on a plain EventTarget.
function pointer(type, x, y) {
  const e = new Event(type);
  Object.assign(e, { pointerId: 1, button: 0, clientX: x, clientY: y });
  return e;
}

function setup(enabled = () => true) {
  const zone = new EventTarget();
  const log = { moves: [], moveEnds: 0 };
  const input = attachDrag(zone, {
    enabled,
    onMove: (dx) => log.moves.push(dx),
    onMoveEnd: () => log.moveEnds++,
  });
  return { zone, log, input };
}

test('attachDrag reports the horizontal distance from the touch, then the end', () => {
  const { zone, log } = setup();
  zone.dispatchEvent(pointer('pointerdown', 100, 300));
  zone.dispatchEvent(pointer('pointermove', 140, 310));
  zone.dispatchEvent(pointer('pointermove', 90, 320));
  zone.dispatchEvent(pointer('pointerup', 90, 320));
  zone.dispatchEvent(pointer('pointerup', 90, 320));
  assert.deepEqual(log.moves, [40, -10]);
  assert.equal(log.moveEnds, 1);
});

test('attachDrag: a drag after release does nothing; detach removes listeners', () => {
  let on = true;
  const { zone, log, input } = setup(() => on);
  on = false;
  zone.dispatchEvent(pointer('pointerdown', 0, 0));
  zone.dispatchEvent(pointer('pointermove', 50, 0));
  zone.dispatchEvent(pointer('pointerup', 50, 0));
  assert.deepEqual(log.moves, []);
  assert.equal(log.moveEnds, 0);

  // Release mid-drag: the drag stops moving the batter.
  on = true;
  zone.dispatchEvent(pointer('pointerdown', 0, 0));
  zone.dispatchEvent(pointer('pointermove', 20, 0));
  on = false;
  zone.dispatchEvent(pointer('pointermove', 60, 0));
  zone.dispatchEvent(pointer('pointerup', 60, 0));
  assert.deepEqual(log.moves, [20]);
  assert.equal(log.moveEnds, 1);

  input.detach();
  on = true;
  zone.dispatchEvent(pointer('pointerdown', 0, 0));
  zone.dispatchEvent(pointer('pointermove', 30, 0));
  assert.deepEqual(log.moves, [20]);
});
