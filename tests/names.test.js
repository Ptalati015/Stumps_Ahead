import { test } from 'node:test';
import assert from 'node:assert/strict';

import { NATIONS, NATION_CODES } from '../js/data/nations.js';
import { generateTeam, generateFixture, surnamePool } from '../js/data/names.js';
import { DENYLIST, isDenied } from '../js/data/denylist.js';

// Seeded stand-in with the same shape as js/engine/rng.js.
function testRng(seed) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return { next, int: (min, max) => min + Math.floor(next() * (max - min + 1)), pick: (arr) => arr[Math.floor(next() * arr.length)] };
}

const surnameOf = (name) => name.slice(name.indexOf(' ') + 1);

test('seven nations with names and two colours', () => {
  assert.deepEqual(NATION_CODES.sort(), ['AUS', 'ENG', 'IND', 'NZ', 'SA', 'SL', 'WI']);
  for (const n of Object.values(NATIONS)) {
    assert.ok(n.name);
    assert.match(n.colors.primary, /^#[0-9a-f]{6}$/i);
    assert.match(n.colors.secondary, /^#[0-9a-f]{6}$/i);
  }
});

test('denylist has at least 100 real surnames', () => {
  assert.ok(DENYLIST.size >= 100, `only ${DENYLIST.size}`);
  assert.ok(isDenied('Root') && isDenied('  KOHLI ') && isDenied('de Villiers'));
});

test('no surname in any pool is on the denylist', () => {
  for (const code of NATION_CODES) {
    const pool = surnamePool(code);
    assert.ok(pool.length >= 40, `${code} pool too small: ${pool.length}`);
    for (const s of pool) assert.ok(!isDenied(s), `${code} pool contains real surname ${s}`);
  }
});

test('squad shape matches SPEC section 5', () => {
  for (const code of NATION_CODES) {
    const team = generateTeam(code, testRng(7));
    assert.equal(team.code, code);
    assert.equal(team.name, NATIONS[code].name);
    assert.equal(team.players.length, 11);
    const roles = team.players.map((p) => p.role);
    assert.deepEqual(roles, ['BAT', 'BAT', 'BAT', 'BAT', 'WK', 'AR', 'AR', 'BOWL', 'BOWL', 'BOWL', 'BOWL']);
    team.players.forEach((p, i) => {
      assert.equal(p.id, `${code}-${i + 1}`);
      assert.match(p.name, /^\S+ \S.*$/);
      for (const r of [p.batting, p.bowling]) assert.ok(Number.isInteger(r) && r >= 1 && r <= 100);
      if (p.role === 'BAT' || p.role === 'WK') {
        assert.ok(p.batting >= 60 && p.batting <= 95);
        assert.equal(p.bowlType, null);
      } else {
        assert.ok(['pace', 'spin'].includes(p.bowlType));
      }
      if (p.role === 'BOWL') {
        assert.ok(p.bowling >= 55 && p.bowling <= 95);
        assert.ok(p.batting >= 10 && p.batting <= 40);
      }
    });
    const spinners = team.players.filter((p) => p.role === 'BOWL' && p.bowlType === 'spin').length;
    assert.equal(spinners, NATIONS[code].spinBias);
  }
});

test('many fixtures: no real surnames, no duplicate names within a match', () => {
  for (let seed = 1; seed <= 300; seed++) {
    const rng = testRng(seed);
    const u = rng.pick(NATION_CODES);
    const ai = rng.pick(NATION_CODES.filter((c) => c !== u));
    const { userTeam, aiTeam } = generateFixture(u, ai, rng);
    const names = [...userTeam.players, ...aiTeam.players].map((p) => p.name);
    assert.equal(new Set(names).size, 22, `duplicate in seed ${seed}`);
    for (const n of names) assert.ok(!isDenied(surnameOf(n)), `real surname in ${n}`);
  }
});

test('same seed gives the same squad; reroll gives a different one', () => {
  const a = generateTeam('IND', testRng(42));
  const b = generateTeam('IND', testRng(42));
  assert.deepEqual(a, b);
  const rng = testRng(42);
  const first = generateTeam('IND', rng).players.map((p) => p.name);
  const second = generateTeam('IND', rng).players.map((p) => p.name);
  assert.notDeepEqual(first, second);
});

test('fixture rejects the same nation twice', () => {
  assert.throws(() => generateFixture('AUS', 'AUS', testRng(1)));
});
