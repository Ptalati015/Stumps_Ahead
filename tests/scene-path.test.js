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
