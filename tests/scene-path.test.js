// The ball's drawn path (js/ui/scene) for the Phase 4 bowling inputs.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { deliveryPath } from '../js/ui/scene/scene.js';

const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;
const base = { line: 'off', length: 'good', travelMs: 900, extra: null };
const tAt = (path, z) => (path(0).z - z) / path.vz;

test('presets without a variation travel in a straight line, as in v1.0.0', () => {
  const path = deliveryPath(base, -1);
  const [a, m, b] = [path(0), path(path.T / 2), path(path.T)];
  assert.ok(near(m.x, (a.x + b.x) / 2));
});

test('delivery.pitch sets the bounce, mirrored for a left-hander', () => {
  for (const off of [-1, 1]) {
    const path = deliveryPath({ ...base, pitch: { x: 0.3, z: 4 } }, off);
    assert.ok(near(path.bounce.x, 0.3 * -off) && near(path.bounce.z, 4));
    const p = path(tAt(path, 4));
    assert.ok(near(p.x, 0.3 * -off, 1e-4) && p.y < 0.05);
  }
});

test('swing bends the path in the air; the ball still lands on the spot', () => {
  const pitch = { x: 0, z: 6 };
  const plain = deliveryPath({ ...base, pitch }, -1);
  const swung = deliveryPath({ ...base, pitch, variation: 'in', swingX: 0.35 }, -1);
  const tb = tAt(swung, 6);
  assert.ok(near(swung(tb).x, plain(tb).x, 1e-4));
  assert.ok(Math.abs(swung(tb / 2).x - plain(tb / 2).x) > 0.01, 'curve in the air');
  assert.ok(near(swung(swung.T).x - plain(plain.T).x, 0.35, 0.05), 'moves about swingX toward leg');
});

test('turn only changes direction after the bounce', () => {
  const pitch = { x: -0.1, z: 5 };
  const plain = deliveryPath({ ...base, pitch, spinner: true }, -1);
  const turned = deliveryPath({ ...base, pitch, spinner: true, variation: 'out', swingX: -0.3 }, -1);
  const tb = tAt(turned, 5);
  for (const t of [0, tb / 3, tb]) assert.ok(near(turned(t).x, plain(t).x, 1e-6));
  assert.ok(near(turned(turned.T).x - plain(plain.T).x, -0.3, 1e-6));
});

test('a slower ball takes longer over the same path', () => {
  const stock = deliveryPath(base, -1);
  const slow = deliveryPath({ ...base, travelMs: 900 * 1.25, variation: 'slower' }, -1);
  assert.ok(near(slow.T, stock.T * 1.25));
  assert.ok(near(slow(slow.T).x, stock(stock.T).x));
});

// SPEC 14.2: swing happens in the air and the ball stays on the pitch.
const LENGTH_Z = { yorker: 1.5, full: 3.8, good: 6.4, short: 9.5 };
const LINE_X = { off: -0.2, middle: 0, leg: 0.2 };
const cases = [];
for (const length of Object.keys(LENGTH_Z)) {
  for (const variation of ['stock', 'in', 'out']) {
    for (const off of [-1, 1]) {
      const swingX = { stock: 0, in: 0.4, out: -0.4 }[variation];
      for (const line of Object.keys(LINE_X)) {
        cases.push({ off, delivery: { ...base, line, length, variation, swingX } });
        cases.push({ off, delivery: { ...base, line, length, variation, swingX, pitch: { x: LINE_X[line], z: LENGTH_Z[length] } } });
      }
      // The widest legal spots on the off and leg side.
      for (const x of [-0.9, 0.6]) cases.push({ off, delivery: { ...base, length, variation, swingX, pitch: { x, z: LENGTH_Z[length] } } });
      cases.push({ off, delivery: { ...base, length, variation, swingX, pitch: { x: -0.9, z: 12 } } });
    }
  }
}
const samples = (path, from = 0, to = path.T) => Array.from({ length: 50 }, (_, i) => from + ((to - from) * i) / 49);

test('every length, swing and hand stays on the pitch', () => {
  for (const { off, delivery } of cases) {
    const path = deliveryPath(delivery, off);
    for (const t of samples(path)) {
      const { x } = path(t);
      assert.ok(Math.abs(x) <= 1.52 + 1e-9, `${delivery.length} ${delivery.variation} ${off} x=${x.toFixed(2)} at t=${t.toFixed(2)}`);
    }
  }
});

test('swing never strays more than |swingX| from the straight release-to-spot line', () => {
  for (const { off, delivery } of cases) {
    const path = deliveryPath(delivery, off);
    const tb = tAt(path, path.bounce.z);
    const x0 = path(0).x;
    const straight = (t) => x0 + ((path.bounce.x - x0) * t) / tb;
    // From the far corner spots the straight line itself runs off the pitch;
    // there the arrival is pulled in (on-pitch test), so check the air only.
    const end = Math.abs(straight(path.T)) > 1.52 ? tb : path.T;
    for (const t of samples(path, 0, end)) {
      const d = Math.abs(path(t).x - straight(t));
      assert.ok(d <= Math.abs(delivery.swingX) + 0.05, `${delivery.length} ${delivery.variation} strays ${d.toFixed(2)} m`);
    }
  }
});

test('the yorker outswinger curves gently and lands on the spot', () => {
  const pitch = { x: -0.1, z: 1.5 };
  for (const off of [-1, 1]) {
    const path = deliveryPath({ ...base, length: 'yorker', pitch, variation: 'out', swingX: -0.4 }, off);
    const tb = tAt(path, 1.5);
    assert.ok(near(path(tb).x, -0.1 * -off, 1e-4));
    const xs = samples(path, 0, tb).map((t) => path(t).x);
    assert.ok(Math.max(...xs) - Math.min(...xs) < 1.5, 'no big detour');
  }
});

test('after the bounce the path is straight', () => {
  for (const { off, delivery } of cases) {
    const path = deliveryPath(delivery, off);
    const tb = tAt(path, path.bounce.z);
    const [a, b] = [path(tb), path(path.T)];
    for (const t of samples(path, tb, path.T)) {
      const want = a.x + ((b.x - a.x) * (t - tb)) / (path.T - tb);
      assert.ok(near(path(t).x, want, 1e-6), `${delivery.length} ${delivery.variation} bends after the bounce`);
    }
  }
});

test('a wide may finish off the pitch', () => {
  const path = deliveryPath({ ...base, extra: 'wide', line: 'off', length: 'short', pitch: { x: -1, z: 12 }, swingX: -0.4, variation: 'out' }, -1);
  assert.ok(Math.abs(path(path.T).x) > 1.52);
});

// SPEC 15: release from over/around the wicket, arrival from the engine.
import { prepareDelivery } from '../js/engine/outcomes.js';
import { createRng } from '../js/engine/rng.js';

test('the ball leaves from releaseX, mirrored for a left-hander, and arrives at arrivalX', () => {
  for (const off of [-1, 1]) {
    const bats = off === -1 ? 'R' : 'L';
    for (const side of ['over', 'around']) {
      for (const pitch of [undefined, { x: 0.05, z: 5 }]) {
        const d = prepareDelivery({ line: 'middle', length: 'good', accuracy: 0.8, side, pitch }, { bowling: 70 }, createRng(9), { bats });
        const path = deliveryPath(d, off);
        assert.ok(near(path(0).x, d.releaseX * -off));
        assert.ok(near(path(path.T).x, d.arrivalX * -off, 0.01));
        // Over stays on the same side of the stumps in world x for both hands.
        assert.ok(side === 'over' ? path(0).x < 0 : path(0).x > 0);
      }
    }
  }
});

test('from around the wicket every length and swing still stays on the pitch', () => {
  for (const off of [-1, 1]) for (const length of ['yorker', 'full', 'good', 'short']) for (const variation of ['stock', 'in', 'out']) {
    for (let i = 0; i < 40; i++) {
      const d = prepareDelivery({ line: 'off', length, variation, side: 'around', accuracy: 0.7 }, { bowling: 70 }, createRng(i + 1), { bats: off === -1 ? 'R' : 'L' });
      if (d.extra === 'wide') continue;
      const path = deliveryPath(d, off);
      for (let k = 0; k < 50; k++) assert.ok(Math.abs(path((path.T * k) / 49).x) <= 1.52 + 1e-9);
    }
  }
});
