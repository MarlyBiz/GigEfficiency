// shareApp: native share, cancel, fallback to copying the link. Run: npx tsx test/share.test.ts
import assert from 'node:assert/strict';
import { shareApp, APP_URL, SHARE_DATA } from '../src/utils/share';
let copied = '';
const clip = { writeText: async (t: string) => { copied = t; } };
let got: any = null;
assert.equal(await shareApp({ share: async (d: any) => { got = d; }, clipboard: clip } as any), 'shared');
assert.equal(got.url, 'https://gig.marlylabs.app'); assert.equal(got.title, SHARE_DATA.title); assert.ok(got.text);
assert.equal(await shareApp({ share: async () => { throw Object.assign(new Error('x'), { name: 'AbortError' }); }, clipboard: clip } as any), 'cancelled');
assert.equal(copied, '', 'cancel does not copy');
assert.equal(await shareApp({ clipboard: clip } as any), 'copied'); assert.equal(copied, APP_URL);
assert.equal(await shareApp({ share: async () => { throw Object.assign(new Error('x'), { name: 'NotAllowedError' }); }, clipboard: clip } as any), 'copied');
assert.equal(await shareApp({ clipboard: { writeText: async () => { throw new Error('no'); } } } as any), 'failed');
console.log('share tests: PASS');
