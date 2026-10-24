import { test } from 'node:test';
import assert from 'node:assert/strict';
import { swipeToAim, classifySwipe, dragToOffset, clampOffset, attachSwipe, SWIPE_THRESHOLD_PX } from '../js/ui/input/swipe.js';

test('swipeToAim: up is straight, right-hander off side is screen right', () => {
  assert.equal(swipeToAim(0, -100, 'R'), 0);
  assert.equal(swipeToAim(100, 0, 'R'), -90); // square on the off side
  assert.equal(swipeToAim(-100, 0, 'R'), 90); // square leg
  assert.equal(swipeToAim(70, -70, 'R'), -45); // cover
  assert.equal(swipeToAim(-70, 70, 'R'), 135); // fine leg
  assert.equal(Math.abs(swipeToAim(0, 100, 'R')), 180);
});

test('swipeToAim mirrors for a left-hander', () => {
  for (const [dx, dy] of [[100, 0], [70, -70], [-40, 90], [0, -50]]) {
    assert.equal(swipeToAim(dx, dy, 'L'), -swipeToAim(dx, dy, 'R') || 0);
  }
  assert.equal(swipeToAim(-100, 0, 'L'), -90); // screen left is a left-hander's off side
});

test('classifySwipe follows the SPEC 12.1 sector table', () => {
  const c = (dx, dy, extra = {}) => classifySwipe({ dx, dy, zoneHeight: 400, bats: 'R', ...extra });
  assert.deepEqual(c(2, 5), { shot: 'defend', aimDeg: 0, aerial: false }); // tap
  assert.equal(c(0, -80).shot, 'drive');
  assert.equal(c(60, -60).shot, 'drive'); // cover, -45
  assert.equal(c(80, -10).shot, 'cut'); // past -70
  assert.equal(c(-80, -20).shot, 'pull');
  assert.equal(c(50, 80).shot, 'cut'); // behind square, off
  assert.equal(c(-50, 80).shot, 'pull'); // behind square, leg
  assert.equal(c(0, -80, { loft: true }).shot, 'loft');
  const long = c(0, -170); // longer than 40% of 400
  assert.equal(long.shot, 'loft');
  assert.equal(long.aerial, true);
  assert.equal(c(0, -150).aerial, false);
  // Small zone on a phone: the floor keeps a normal swipe on the ground.
  assert.equal(classifySwipe({ dx: 0, dy: -90, zoneHeight: 100 }).aerial, false);
  assert.equal(classifySwipe({ dx: 0, dy: -130, zoneHeight: 100 }).aerial, true);
});

test('drag moves toward the off side for screen right (right-hander) and clamps at 0.6 m', () => {
  assert.ok(dragToOffset(0, 30, 'R') < 0);
  assert.ok(dragToOffset(0, 30, 'L') > 0);
  assert.equal(dragToOffset(0, 1000, 'R'), -0.6);
  assert.equal(dragToOffset(0, -1000, 'R'), 0.6);
  assert.equal(clampOffset(0.149), 0.15);
});

// Minimal pointer events on a plain EventTarget.
function pointer(type, x, y, t) {
  const e = new Event(type);
  Object.assign(e, { pointerId: 1, button: 0, clientX: x, clientY: y });
  Object.defineProperty(e, 'timeStamp', { value: t });
  return e;
}

function setup(mode = 'swipe') {
  const zone = new EventTarget();
  const log = { shots: [], aims: [], moves: [], moveEnds: 0 };
  const input = attachSwipe(zone, {
    mode: () => mode,
    onMove: (dx) => log.moves.push(dx),
    onMoveEnd: () => log.moveEnds++,
    onAim: (a) => log.aims.push(a),
    onShot: (s) => log.shots.push(s),
    zoneHeight: () => 400,
    loft: () => false,
    bats: () => 'R',
  });
  return { zone, log, input };
}

test('attachSwipe times a swipe when it passes the threshold, once per gesture', () => {
  const { zone, log } = setup();
  zone.dispatchEvent(pointer('pointerdown', 100, 300, 1000));
  zone.dispatchEvent(pointer('pointermove', 100, 290, 1010));
  zone.dispatchEvent(pointer('pointermove', 100, 300 - SWIPE_THRESHOLD_PX, 1040));
  zone.dispatchEvent(pointer('pointermove', 100, 200, 1080));
  zone.dispatchEvent(pointer('pointerup', 100, 200, 1100));
  zone.dispatchEvent(pointer('pointerup', 100, 200, 1110));
  assert.equal(log.shots.length, 1);
  assert.deepEqual(log.shots[0], { shot: 'drive', aimDeg: 0, aerial: false, atMs: 1040 });
  assert.ok(log.aims.some((a) => a && a.aimDeg === 0));
  assert.equal(log.aims.at(-1), null);
});

test('attachSwipe: a tap defends, timed at the touch', () => {
  const { zone, log } = setup();
  zone.dispatchEvent(pointer('pointerdown', 50, 50, 500));
  zone.dispatchEvent(pointer('pointerup', 52, 51, 560));
  assert.deepEqual(log.shots, [{ shot: 'defend', aimDeg: 0, aerial: false, atMs: 500 }]);
});

test('attachSwipe: flush resolves a swipe whose finger is still down', () => {
  const { zone, log, input } = setup();
  zone.dispatchEvent(pointer('pointerdown', 100, 300, 0));
  zone.dispatchEvent(pointer('pointermove', 160, 300, 30));
  input.flush();
  zone.dispatchEvent(pointer('pointerup', 160, 300, 80));
  assert.equal(log.shots.length, 1);
  assert.equal(log.shots[0].shot, 'cut');
});

test('attachSwipe: move mode drags instead of hitting; off mode ignores; detach removes listeners', () => {
  const m = setup('move');
  m.zone.dispatchEvent(pointer('pointerdown', 100, 300, 0));
  m.zone.dispatchEvent(pointer('pointermove', 140, 300, 10));
  m.zone.dispatchEvent(pointer('pointerup', 140, 300, 20));
  assert.deepEqual(m.log.moves, [40]);
  assert.equal(m.log.moveEnds, 1);
  assert.equal(m.log.shots.length, 0);

  const off = setup('off');
  off.zone.dispatchEvent(pointer('pointerdown', 0, 0, 0));
  off.zone.dispatchEvent(pointer('pointerup', 0, 0, 5));
  assert.equal(off.log.shots.length, 0);

  const d = setup();
  d.input.detach();
  d.zone.dispatchEvent(pointer('pointerdown', 0, 0, 0));
  d.zone.dispatchEvent(pointer('pointerup', 0, 0, 5));
  assert.equal(d.log.shots.length, 0);
});
