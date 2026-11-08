// Produce a standalone entry point for Supabase's browser editor when CLI login is unavailable.
import { readFile, mkdir, writeFile } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const helpers = await Promise.all(['conversation.js', 'conversation-cost.js'].map(async name =>
  (await readFile(new URL(`supabase/functions/_shared/${name}`, root), 'utf8')).replace(/^export /gm, '')));
const entry = (await readFile(new URL('supabase/functions/generate-conversation/index.ts', root), 'utf8'))
  .replace(/^import .* from '\.\.\/_shared\/conversation(?:-cost)?\.js';\r?\n/gm, '');
await mkdir(new URL('tmp/', root), { recursive: true });
await writeFile(new URL('tmp/generate-conversation-standalone.ts', root), `${helpers.join('\n\n')}\n\n${entry}`);
console.log('Created tmp/generate-conversation-standalone.ts for the Supabase browser editor');
