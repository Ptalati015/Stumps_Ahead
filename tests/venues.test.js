import { test } from 'node:test';
import assert from 'node:assert/strict';

import { NATION_CODES } from '../js/data/nations.js';
import { VENUES, getVenue, venuesFor } from '../js/data/venues.js';

test('two venues per nation, unique ids and names', () => {
  for (const code of NATION_CODES) assert.equal(venuesFor(code).length, 2, code);
  assert.equal(VENUES.length, NATION_CODES.length * 2);
  assert.equal(new Set(VENUES.map((v) => v.id)).size, VENUES.length);
  assert.equal(new Set(VENUES.map((v) => v.name.toLowerCase())).size, VENUES.length);
});

test('every venue has a city, three stand colours and a sky tint', () => {
  for (const v of VENUES) {
    assert.ok(v.name && v.city && v.tagline, v.id);
    assert.ok(v.tagline.length <= 70 && !/["“”]/.test(v.tagline), `${v.id} tagline: one short line, no quotes`);
    assert.equal(v.stands.length, 3, v.id);
    for (const c of [...v.stands, v.sky]) assert.match(c, /^#[0-9a-f]{6}$/i, v.id);
    assert.equal(getVenue(v.id), v);
  }
  assert.equal(getVenue('nowhere'), null);
});
