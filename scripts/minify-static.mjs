/**
 * scripts/minify-static.mjs
 *
 * Postbuild step that minifies the static JS bundles in dist/static/.
 *
 * Why this exists:
 *   - public/static/landing.js is hand-written (no Vite bundling) and is
 *     ~221 KB unminified. After esbuild minify it shrinks to ~80 KB, and
 *     Cloudflare's automatic Brotli compression takes that down further to
 *     ~25-30 KB on the wire — a 7x reduction in JS download size.
 *   - We minify in dist/ (not public/) so the source file stays editable
 *     and readable for debugging in the IDE.
 *
 * IMPORTANT: We use esbuild's `transform` API (not `build`) so the script
 * is treated as a plain top-level <script> rather than an ES module / IIFE.
 * This preserves global-scope `function submitForm()`, `function toggleFaq()`,
 * etc. that are referenced from inline `onclick=` handlers in the SSR HTML.
 *
 * Run automatically via `npm run build` (see package.json scripts).
 */

import { transform } from 'esbuild';
import { readFile, writeFile, stat, readdir } from 'fs/promises';
import { join } from 'path';

const DIST_STATIC = './dist/static';
const DIST_CSS = './dist/static/css';

// JS files to minify. Add more here if new static bundles appear.
const JS_TARGETS = ['landing.js', 'editor.js'];

function fmtKb(bytes) {
  return (bytes / 1024).toFixed(1) + ' KB';
}

async function minifyFile(filePath, loader) {
  let before;
  try {
    before = (await stat(filePath)).size;
  } catch {
    return null;
  }

  const source = await readFile(filePath, 'utf8');

  // transform() (vs build()) preserves global declarations and never
  // wraps the file in IIFE/ESM scaffolding — landing.js stays a plain
  // <script> so inline `onclick=submitForm(...)` handlers still work.
  const result = await transform(source, {
    minify: true,
    target: 'es2018',
    legalComments: 'none',
    loader,
  });

  await writeFile(filePath, result.code, 'utf8');

  const after = (await stat(filePath)).size;
  return { before, after };
}

async function minifyAll(dir, files, loader) {
  let entries;
  try {
    entries = await readdir(dir);
  } catch {
    return;
  }
  const present = files === null
    ? entries.filter((f) => f.endsWith('.css'))
    : files.filter((t) => entries.includes(t));
  if (present.length === 0) return;
  for (const name of present) {
    const filePath = join(dir, name);
    const r = await minifyFile(filePath, loader);
    if (!r) continue;
    const saved = r.before - r.after;
    const pct = r.before > 0 ? ((saved / r.before) * 100).toFixed(0) : '0';
    console.log(`  ✓ ${name.padEnd(28)} ${fmtKb(r.before).padStart(10)} → ${fmtKb(r.after).padStart(10)}  (-${pct}%)`);
  }
}

console.log('\n📦 Minifying static bundles...\n');

try {
  console.log('  -- JS --');
  await minifyAll(DIST_STATIC, JS_TARGETS, 'js');
  console.log('\n  -- CSS --');
  await minifyAll(DIST_CSS, null, 'css');
  console.log('\n✅ Done.\n');
} catch (e) {
  console.error('  ✗ Minify failed:', e.message);
  process.exit(1);
}
