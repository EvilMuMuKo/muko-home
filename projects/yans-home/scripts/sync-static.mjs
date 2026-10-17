// Keep this draft isolated from the existing muko-home homepage.
import { cp, rm, access } from 'node:fs/promises';
const output = new URL('../../../yans-home/', import.meta.url);
const dist = new URL('../dist/', import.meta.url);
// Require the containing repository layout before replacing its child output.
await access(new URL('../../../scripts/sync-static.mjs', import.meta.url));
await rm(output, { recursive: true, force: true });
await cp(dist, output, { recursive: true });
