#!/usr/bin/env node

const message = [
  '[test-guard] Use heap-safe commands for stability on Windows:',
  '  npm run test:safe:dashboard',
  '  npm run test:safe:trio',
  '  npm run test:safe:full',
  '[test-guard] Avoid raw: npx vitest run ... (can trigger worker OOM).',
].join('\n');

console.warn(message);
