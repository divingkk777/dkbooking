import fs from 'fs';

const s = fs.readFileSync('_live-bundle.js', 'utf8');

const needles = [
  'CASABLUE',
  'Casablu',
  '승인메일',
  'Approval',
  '바우처',
  '유닛',
  '차량/기사',
  '얼리체크인',
  '실제 트레이닝',
  '수동 지정',
  'assignedRoomNumbers',
  'assignedLine',
  'assignedVehicle',
  'assignedDriver',
  'targetDepth',
  'pickupFlight',
  'dropoffFlight',
  'isNew',
  '견적',
  '확인',
  '취소',
  'RM:',
  '트라이마란',
  'unitsConfig',
  'vehiclesConfig',
  'driversConfig',
  'combined',
  'Sn.length',
  'checkbox',
];

for (const n of needles) {
  let idx = 0;
  let count = 0;
  console.log('\n========', n);
  while (count < 3) {
    const i = s.indexOf(n, idx);
    if (i < 0) break;
    console.log('---', i);
    console.log(s.slice(Math.max(0, i - 120), i + 350).replace(/\n/g, ' '));
    idx = i + n.length;
    count += 1;
  }
  if (count === 0) console.log('NOT FOUND');
}
