import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { crc32, createZip, readZip } from '../js/zip.js';

test('crc32 matches the standard check value', () => {
  assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926);
});

test('zip round trip keeps text and binary entries intact', async () => {
  const binary = new Uint8Array(5000).map((_, i) => (i * 37) % 256);
  const blob = await createZip([
    { name: 'data.json', data: '{"hello":"wörld"}' },
    { name: 'photos/a.jpg', data: new Blob([binary]) },
  ]);
  const entries = await readZip(blob);
  assert.equal(new TextDecoder().decode(entries.get('data.json')), '{"hello":"wörld"}');
  assert.deepEqual(entries.get('photos/a.jpg'), binary);
});

test('zip opens with the standard unzip tool', async (t) => {
  try { execFileSync('unzip', ['-v'], { stdio: 'ignore' }); } catch { t.skip('unzip not installed'); return; }
  const dir = mkdtempSync(join(tmpdir(), 'gn-'));
  const blob = await createZip([{ name: 'photos/x.txt', data: 'bed 7' }]);
  writeFileSync(join(dir, 'b.zip'), new Uint8Array(await blob.arrayBuffer()));
  execFileSync('unzip', ['-q', '-t', join(dir, 'b.zip')]);
  execFileSync('unzip', ['-q', join(dir, 'b.zip'), '-d', join(dir, 'out')]);
  assert.equal(readFileSync(join(dir, 'out/photos/x.txt'), 'utf8'), 'bed 7');
});

test('reads a deflated zip made by another tool', async (t) => {
  try { execFileSync('zip', ['-v'], { stdio: 'ignore' }); } catch { t.skip('zip not installed'); return; }
  const dir = mkdtempSync(join(tmpdir(), 'gn-'));
  writeFileSync(join(dir, 'data.json'), JSON.stringify({ text: 'comfrey '.repeat(200) }));
  execFileSync('zip', ['-q', '-9', 'c.zip', 'data.json'], { cwd: dir });
  const entries = await readZip(readFileSync(join(dir, 'c.zip')));
  assert.equal(JSON.parse(new TextDecoder().decode(entries.get('data.json'))).text, 'comfrey '.repeat(200));
});

test('rejects files that are not zips, and damaged zips', async () => {
  await assert.rejects(readZip(new TextEncoder().encode('not a zip at all, just text')), /not a zip/);
  const bytes = new Uint8Array(await (await createZip([{ name: 'a.txt', data: 'hello' }])).arrayBuffer());
  bytes[30 + 5] ^= 0xff; // flip a byte of the file contents
  await assert.rejects(readZip(bytes), /damaged/);
});
