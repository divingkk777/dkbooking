import fs from 'fs';

const s = fs.readFileSync(new URL('../_live-bundle.js', import.meta.url), 'utf8');

function dump(needle, before = 80, after = 2000, max = 3) {
  let idx = 0;
  let c = 0;
  console.log('\n======== ' + String(needle).slice(0, 80));
  while (c < max) {
    const i = s.indexOf(needle, idx);
    if (i < 0) {
      if (c === 0) console.log('NOT FOUND');
      break;
    }
    console.log('---', i);
    console.log(s.slice(Math.max(0, i - before), i + after));
    idx = i + Math.max(String(needle).length, 1);
    c++;
  }
}

console.log('\n===== ROW PRICE+ACTIONS @1114300');
console.log(s.slice(1114300, 1114300 + 6500));

dump('2 BEDS', 120, 500, 8);
dump('BEDS)', 80, 400, 10);
dump('TWIN(', 40, 250, 8);
dump('nameEN', 40, 300, 5);

dump('Zt(e)', 60, 200, 5);
dump('onClick:()=>{Zt', 40, 300, 3);
dump('Gn=async', 40, 800, 2);
dump('Kn=async', 40, 800, 2);
dump('qn=', 40, 600, 5);
dump('xn=', 40, 800, 5);
dump('zn=async', 40, 900, 2);

dump("r(`확인`", 120, 600, 10);
dump("r(`취소`", 120, 500, 10);
dump("r(`수정`", 120, 600, 8);
dump("r(`유닛`", 80, 500, 5);
dump('isNew:!i', 80, 500, 3);
dump('e.isNew', 80, 500, 8);

dump('Open Combined Invoice', 200, 800, 2);
dump('nn=', 40, 500, 5);
dump('Sn.includes', 80, 300, 5);
dump('full-merged-invoice', 80, 500, 3);

dump('CASABLUE', 100, 500, 6);
dump('hotelPaymentStatus', 80, 400, 5);
dump('casablue', 40, 300, 5);
dump('Casablu', 40, 400, 5);
dump('window.open', 40, 300, 10);

dump('Fn=async', 40, 700, 1);
dump('In=async', 40, 500, 1);
dump('Ln=async', 40, 400, 1);
dump('Rn=async', 40, 500, 2);
dump('_n=', 40, 400, 5);
dump('vn=', 40, 400, 5);
dump('[gn,', 40, 300, 3);
dump('[vn,', 40, 300, 3);
dump('[Xt,', 40, 300, 3);
dump('[$t,', 40, 300, 3);

// Room type display helpers
dump('roomTypesConfig', 40, 400, 3);
dump('Ue.find', 40, 400, 5);
dump('(2 ', 40, 200, 10);
dump('beds', 40, 200, 10);
dump('Beds', 40, 200, 10);
