import fs from 'fs';

const s = fs.readFileSync(new URL('../_live-bundle.js', import.meta.url), 'utf8');

const slices = [
  ['handlers_Pn_to_zn', 1058880, 1066000],
  ['handlers_qn_Jn_jr', 1069000, 1078000],
  ['approval_email_In', 1059800, 1064300],
  ['modal_unit_gn', 1148000, 1154000],
  ['modal_vehicle_vn', 1150000, 1155000],
  ['modal_edit_En', 1152000, 1165000],
  ['modal_voucher_Xt', 1164500, 1167500],
  ['modal_payment_bn', 1166200, 1167800],
  ['modal_combined_tn', 1167500, 1179000],
  ['modal_invoice_k', 1178000, 1192000],
  ['pricing_aT', 805500, 807200],
  ['guest_defaults_D', 813800, 814400],
];

for (const [name, a, b] of slices) {
  const out = `======== ${name} ${a}-${b}\n` + s.slice(a, b) + '\n\n';
  fs.appendFileSync(new URL('./_modals-out.txt', import.meta.url), out);
}

// Targeted searches with UTF8
const needles = [
  'jr=async',
  'Assign Room (Voucher)',
  'Assign Unit',
  'Transport assigned',
  'Select Payment Account',
  '미배정 유닛',
  'customTotalKRW',
  'roomDiscount',
  'Nn=t=>',
  'hotelPaymentStatus',
  'Ln=async',
  '전달완료',
  '정산완료',
  '미발급',
  '대기',
];

let report = '';
for (const n of needles) {
  report += `\n======== ${n}\n`;
  let idx = 0;
  let c = 0;
  while (c < 3) {
    const i = s.indexOf(n, idx);
    if (i < 0) {
      if (c === 0) report += 'NOT FOUND\n';
      break;
    }
    report += `--- ${i}\n` + s.slice(Math.max(0, i - 100), i + 900) + '\n';
    idx = i + n.length;
    c++;
  }
}
fs.writeFileSync(new URL('./_needles-utf8.txt', import.meta.url), report);
console.log('done', report.length);
