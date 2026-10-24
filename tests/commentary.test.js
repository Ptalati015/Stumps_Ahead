import { test } from 'node:test';
import assert from 'node:assert/strict';

import { COMMENTARY } from '../js/data/commentary.js';

// SPEC 16.2: every key the engine draws from, with at least 4 lines each.
const KEYS = [
  'dot_defend', 'dot_fielded', 'beaten', 'leave',
  'single', 'two', 'three', 'four', 'six',
  'bowled', 'caught', 'caught_behind', 'lbw', 'runout',
  'wide', 'noball',
  'fifty', 'hundred', 'threefor', 'fivefor', 'hattrick_ball', 'hattrick', 'maiden', 'partnership50',
  'last_over', 'won_it',
];

const PLACEHOLDERS = new Set(['batter', 'bowler', 'fielder', 'how', 'where', 'n']);

test('every commentary key has at least 4 lines', () => {
  for (const key of KEYS) {
    assert.ok(Array.isArray(COMMENTARY[key]), `missing key ${key}`);
    assert.ok(COMMENTARY[key].length >= 4, `${key} has ${COMMENTARY[key]?.length} lines`);
  }
  for (const key of Object.keys(COMMENTARY)) assert.ok(KEYS.includes(key), `unexpected key ${key}`);
});

test('lines are plain text with only the known placeholders', () => {
  for (const [key, lines] of Object.entries(COMMENTARY)) {
    for (const line of lines) {
      assert.equal(typeof line, 'string', `${key}: not a string`);
      assert.ok(line.trim().length > 0, `${key}: empty line`);
      assert.ok(!line.includes('<') && !line.includes('>'), `${key}: HTML in "${line}"`);
      // Every brace is part of a {placeholder} the engine knows how to fill.
      for (const [token, name] of line.matchAll(/\{([^}]*)\}/g)) {
        assert.ok(PLACEHOLDERS.has(name), `${key}: unknown placeholder ${token}`);
      }
      assert.ok(!line.replace(/\{[^}]*\}/g, '').includes('{'), `${key}: stray brace in "${line}"`);
      assert.ok(!line.replace(/\{[^}]*\}/g, '').includes('}'), `${key}: stray brace in "${line}"`);
    }
  }
});

test('no line repeats within a key', () => {
  for (const [key, lines] of Object.entries(COMMENTARY)) {
    assert.equal(new Set(lines).size, lines.length, `${key} has duplicate lines`);
  }
});
