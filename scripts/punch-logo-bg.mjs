import sharp from 'sharp';
import fs from 'fs';

/**
 * Make near-white (or near-black) background pixels transparent.
 * mode: 'white' | 'black' | 'auto'
 */
async function punch(src, dest, mode = 'auto', threshold = 245) {
  const { data, info } = await sharp(src)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  let white = 0;
  let black = 0;
  let transp = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    if (a < 10) transp++;
    else if (r > 240 && g > 240 && b > 240) white++;
    else if (r < 25 && g < 25 && b < 25) black++;
  }

  let use = mode;
  if (mode === 'auto') {
    // Prefer punching the dominant corner-like bg color
    use = white >= black ? 'white' : 'black';
  }

  const out = Buffer.from(data);
  let punched = 0;
  for (let i = 0; i < out.length; i += 4) {
    const r = out[i];
    const g = out[i + 1];
    const b = out[i + 2];
    if (use === 'white') {
      // Soft edge: luminance near white → alpha
      const minc = Math.min(r, g, b);
      if (minc >= threshold) {
        out[i + 3] = 0;
        punched++;
      } else if (minc >= threshold - 25) {
        // feather
        const t = (threshold - minc) / 25;
        out[i + 3] = Math.round(out[i + 3] * t);
        punched++;
      }
    } else {
      // black bg: only punch very dark near-neutral pixels (keep dark logo fills that aren't pure bg)
      const maxc = Math.max(r, g, b);
      const chroma = maxc - Math.min(r, g, b);
      if (maxc <= 255 - threshold && chroma < 18) {
        out[i + 3] = 0;
        punched++;
      }
    }
  }

  await sharp(out, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toFile(dest);

  console.log(
    `${src} → ${dest} | before w/b/t ${white}/${black}/${transp} | punch=${use} removed≈${punched}`,
  );
}

const jobs = [
  // Preferred sources with white bg → transparent assets used by app
  ['public/brand/ida-logo-ai.png', 'public/brand/ida.png', 'white', 242],
  [
    'public/brand/logo-horizontal-black.png',
    'public/brand/logo-horizontal-black.png',
    'auto',
    242,
  ],
];

// If horizontal logo is black-on-black, try KakaoTalk source with white punch after invert? analyze first
for (const [src, dest, mode, thr] of jobs) {
  if (!fs.existsSync(src)) {
    console.warn('missing', src);
    continue;
  }
  await punch(src, dest, mode, thr);
}

// Re-analyze outputs
for (const f of [
  'public/brand/ida.png',
  'public/brand/logo-horizontal-black.png',
]) {
  const { data, info } = await sharp(f)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let white = 0;
  let black = 0;
  let transp = 0;
  let other = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    if (a < 10) transp++;
    else if (r > 240 && g > 240 && b > 240) white++;
    else if (r < 25 && g < 25 && b < 25) black++;
    else other++;
  }
  const c0 = [data[0], data[1], data[2], data[3]];
  console.log(
    'RESULT',
    f,
    `${info.width}x${info.height}`,
    { white, black, transp, other, corner: c0 },
  );
}
