#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const ROOT = process.cwd();
const SCAN_DIRS = [
  path.join(ROOT, 'src'),
  path.join(ROOT, 'supabase', 'functions'),
];
const IGNORE_DIRS = new Set(['node_modules', 'dist', 'scratch', '.git']);

const duplicateJsFiles = [];

function walk(dir) {
  if (!fs.existsSync(dir)) return;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (IGNORE_DIRS.has(entry.name)) continue;
      walk(path.join(dir, entry.name));
      continue;
    }

    if (!entry.isFile() || !entry.name.endsWith('.js')) continue;

    const jsPath = path.join(dir, entry.name);
    const base = jsPath.slice(0, -3);
    const tsPath = `${base}.ts`;
    const tsxPath = `${base}.tsx`;

    if (fs.existsSync(tsPath) || fs.existsSync(tsxPath)) {
      duplicateJsFiles.push(path.relative(ROOT, jsPath).replace(/\\/g, '/'));
    }
  }
}

for (const scanDir of SCAN_DIRS) {
  walk(scanDir);
}

if (duplicateJsFiles.length === 0) {
  console.log('No JS duplicates with TS/TSX siblings found.');
  process.exit(0);
}

console.error('Found JS duplicates with TS/TSX siblings:');
for (const file of duplicateJsFiles.sort()) {
  console.error(`- ${file}`);
}
console.error(`Total: ${duplicateJsFiles.length}`);
process.exit(1);
