// Run: npx tsx test/offset.test.ts
import assert from 'node:assert/strict';
const { formatOffset } = await import('../src/components/ManualTimeModal');
assert.equal(formatOffset(0), '+0m'); assert.equal(formatOffset(300), '+5m'); assert.equal(formatOffset(-600), '\u221210m');
assert.equal(formatOffset(65 * 60), '+1h 05m'); assert.equal(formatOffset(-90 * 60), '\u22121h 30m'); assert.equal(formatOffset(59 * 60), '+59m');
console.log('offset format tests: PASS');
