import fs from 'fs';

const s = fs.readFileSync('_live-bundle.js', 'utf8');

function around(needle, before = 40, after = 800) {
  const i = s.indexOf(needle);
  if (i < 0) return null;
  return { i, text: s.slice(Math.max(0, i - before), i + after) };
}

const needles = [
  'id:`TWIN`',
  'id:`MAX_60`',
  'Qw={TRANSFER',
  '$w={TRANSFER',
  'priceKRW:12e4',
  'priceKRW:15e4',
  'useState(1450',
  'DAWN',
  'dawnCheckIn',
  'roomShareCost',
];

for (const n of needles) {
  const hit = around(n);
  console.log('\n====', n, hit?.i ?? 'NOT FOUND');
  if (hit) console.log(hit.text.replace(/\n/g, ' ').slice(0, 900));
}
