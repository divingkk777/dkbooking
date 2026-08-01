import fs from 'fs';

const s = fs.readFileSync('_live-bundle.js', 'utf8');
const start = s.indexOf('aT=(e,t,n,r)');
const alt = s.indexOf('aT=');
const i = start >= 0 ? start : alt;
console.log('start', i);
console.log(s.slice(i, i + 3500));
