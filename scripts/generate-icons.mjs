// Generates the PWA icons (Home-Screen icon for iPad, manifest icons, favicon) from one SVG.
// Run with: npm run icons
import { mkdirSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';

const BG = '#1c2740';
const RING = '#ffffff';
const CHECK = '#8fb0e8';

const glyph = `
  <circle cx="256" cy="256" r="146" fill="none" stroke="${RING}" stroke-width="30"/>
  <path d="M188 262l50 50 92-112" fill="none" stroke="${CHECK}" stroke-width="38" stroke-linecap="round" stroke-linejoin="round"/>`;

const svg = (rounded) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" ${rounded ? 'rx="112"' : ''} fill="${BG}"/>${glyph}
</svg>`;

mkdirSync('public/icons', { recursive: true });
writeFileSync('public/favicon.svg', svg(true));

const jobs = [
  ['public/icons/icon-192.png', 192, true],
  ['public/icons/icon-512.png', 512, true],
  ['public/icons/maskable-512.png', 512, false], // full-bleed, glyph inside the safe zone
  ['public/icons/apple-touch-icon.png', 180, false], // iOS applies its own rounded mask
];
for (const [file, size, rounded] of jobs) {
  await sharp(Buffer.from(svg(rounded))).resize(size, size).png().toFile(file);
  console.log('wrote', file);
}
