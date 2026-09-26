// Bundles and runs a TypeScript file: the Creature Lab tests by default, or the
// file given (`npm run train:creature` passes the trainer).
import { build } from 'rolldown';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
const input = process.argv[2] ? resolve(process.argv[2]) : fileURLToPath(new URL('./creature.test.ts', import.meta.url));
const dir = await mkdtemp(join(tmpdir(), 'creature-tests-'));
try {
  const file = join(dir, 'test.mjs');
  await build({ input, platform: 'node', output: { file, format: 'esm' } });
  await import(pathToFileURL(file).href);
} finally { await rm(dir, {recursive:true, force:true}); }
