/** formatHM / parseHM: hours-and-minutes display, never decimals. Run: npx tsx test/formatHM.test.ts */
import assert from 'node:assert/strict';
import { formatHM, parseHM } from '../src/utils/calculations';
assert.equal(formatHM(0), '0m');
assert.equal(formatHM(29), '0m');
assert.equal(formatHM(30), '1m');
assert.equal(formatHM(45 * 60), '45m');
assert.equal(formatHM(2 * 3600), '2h');
assert.equal(formatHM(2.25, { unit: 'hours' }), '2h 15m');
assert.equal(formatHM(3599.6), '1h', 'rounds to nearest minute, carrying into hours');
assert.equal(formatHM(NaN), '0m'); assert.equal(formatHM(-5), '0m');
assert.equal(parseHM('2h 15m'), 8100); assert.equal(parseHM('45m'), 2700); assert.equal(parseHM('2h'), 7200);
assert.equal(parseHM('2:15'), 8100); assert.equal(parseHM('2.25'), 8100); assert.equal(parseHM(''), null); assert.equal(parseHM('abc'), null);
assert.equal(parseHM(formatHM(5 * 3600 + 7 * 60)), 5 * 3600 + 7 * 60, 'round-trips');
console.log('formatHM/parseHM tests: PASS');
