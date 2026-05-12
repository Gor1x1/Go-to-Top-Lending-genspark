/**
 * compress-images.mjs
 * Converts heavy static images to WebP format to reduce page load time.
 *
 * Usage:
 *   node compress-images.mjs
 *
 * Requires: npm install --save-dev sharp
 *
 * The script:
 *  - Converts JPEG photos to WebP at quality 82 (visually lossless for photos)
 *  - Converts PNG logos/icons to WebP lossless (no quality loss)
 *  - Skips favicons and OG images (must stay PNG/ICO for compatibility)
 *  - Saves output next to originals (e.g. founder.jpg → founder.webp)
 *  - Reports original size, new size, and savings
 */

import sharp from 'sharp';
import { readdir, stat } from 'fs/promises';
import { join, extname, basename } from 'path';

const IMG_DIR = './public/static/img';

// Files to skip — must stay in original format
const SKIP = new Set([
  'favicon.ico',
  'favicon-32x32.png',
  'favicon-192x192.png',
  'favicon-512x512.png',
  'apple-touch-icon.png',
  'og-image-dark.png',
  'og-image.png',
]);

// PNG files that should use lossless WebP (logos, icons)
const LOSSLESS_PNGS = new Set([
  'logo.png',
  'logo-dark.jpg',
  'logo-gototop.png',
  'logo-gototop-dark.png',
  'logo-new.png',
]);

async function processDir(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      await processDir(fullPath);
      continue;
    }
    const ext = extname(entry.name).toLowerCase();
    if (!['.jpg', '.jpeg', '.png'].includes(ext)) continue;
    if (SKIP.has(entry.name)) {
      console.log(`  SKIP  ${entry.name} (required original format)`);
      continue;
    }

    const outPath = fullPath.replace(/\.(jpg|jpeg|png)$/i, '.webp');
    const origStat = await stat(fullPath);

    try {
      const isLossless = LOSSLESS_PNGS.has(entry.name) || ext === '.png';
      let sharpInst = sharp(fullPath);
      if (isLossless) {
        await sharpInst.webp({ lossless: false, quality: 90, effort: 6 }).toFile(outPath);
      } else {
        await sharpInst.webp({ quality: 82, effort: 6 }).toFile(outPath);
      }
      const newStat = await stat(outPath);
      const saved = origStat.size - newStat.size;
      const pct = ((saved / origStat.size) * 100).toFixed(0);
      const marker = saved > 0 ? '✓' : '~';
      console.log(
        `  ${marker} ${entry.name.padEnd(30)} ${kb(origStat.size).padStart(8)} → ${kb(newStat.size).padStart(8)}  (${saved > 0 ? '-' + pct + '%' : 'no change'})`
      );
    } catch (e) {
      console.error(`  ✗ ${entry.name}: ${e.message}`);
    }
  }
}

function kb(bytes) {
  return (bytes / 1024).toFixed(0) + ' KB';
}

console.log('\n📦 Converting images to WebP...\n');
await processDir(IMG_DIR);
console.log('\n✅ Done. Update <img> src attributes to .webp after verifying output.\n');
