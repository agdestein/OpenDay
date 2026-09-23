import { build } from 'rolldown';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
const dir = await mkdtemp(join(tmpdir(), 'bounce-tests-'));
try {
  const file = join(dir, 'test.mjs');
  await build({ input: fileURLToPath(new URL('./bounce.test.ts', import.meta.url)), platform: 'node', output: { file, format: 'esm' } });
  await import(pathToFileURL(file).href);
} finally { await rm(dir, {recursive:true, force:true}); }
