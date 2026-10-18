const fs = require('node:fs');
const path = require('node:path');

// Use a locally installed sharp, or supply SHARP_MODULE for a bundled runtime.
const sharp = require(process.env.SHARP_MODULE || 'sharp');
const root = path.resolve(__dirname, '../..');
const source = path.join(__dirname, 'expenseapp-logo-v2.png');
const navy = '#011230';
let artwork;

async function render(relativePath, size, adaptive = false, round = false) {
  const contentSize = adaptive ? Math.round(size * 0.8) : size;
  const content = await sharp(artwork).resize(contentSize, contentSize).png().toBuffer();
  let image = sharp({ create: { width: size, height: size, channels: 4, background: navy } })
    .composite([{ input: content, gravity: 'centre' }]);
  if (round) {
    const square = await image.png().toBuffer();
    const mask = Buffer.from(`<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="white"/></svg>`);
    image = sharp(square).composite([{ input: mask, blend: 'dest-in' }]);
  }
  const target = path.join(root, relativePath);
  if (target.endsWith('.webp')) await image.webp({ lossless: true }).toFile(target);
  else await image.png().toFile(target);
  const metadata = await sharp(target).metadata();
  if (metadata.width !== size || metadata.height !== size) throw new Error(`Invalid dimensions: ${relativePath}`);
  console.log(`${relativePath}: ${size}x${size}`);
}

async function main() {
  if (!fs.existsSync(source)) throw new Error('Missing logo master');
  // Normalize the dark raster backdrop so adaptive padding has no visible seam.
  const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    if (data[i] < 35 && data[i + 1] < 65 && data[i + 2] < 95) data[i + 3] = 0;
  }
  artwork = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
  await render('assets/icon.png', 1024);
  await render('assets/adaptive-icon.png', 1024, true);
  await render('assets/splash-icon.png', 1024);
  await render('assets/favicon.png', 48);
  const densities = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
  for (const [density, scale] of Object.entries(densities)) {
    const base = `android/app/src/main/res/mipmap-${density}`;
    await render(`${base}/ic_launcher.webp`, 48 * scale);
    await render(`${base}/ic_launcher_round.webp`, 48 * scale, false, true);
    await render(`${base}/ic_launcher_foreground.webp`, 108 * scale, true);
    await render(`android/app/src/main/res/drawable-${density}/splashscreen_logo.png`, 288 * scale);
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
