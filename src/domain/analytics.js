import { bookingSeqMap } from './listModel';
import { formatMoney } from './pricing';

function guestSessions(guest) {
  const counts = guest.trainingCounts || {};
  return Object.values(counts).reduce((s, v) => s + (Number(v) || 0), 0);
}

function emptyBucket() {
  return { totalKRW: 0, totalUSD: 0, items: {} };
}

function addLine(bucket, line, langHint = 'KO') {
  const id = String(line.id || line.nameKO || line.nameEN || 'OTHER');
  const nameKO = line.nameKO || line.nameEN || id;
  const nameEN = line.nameEN || line.nameKO || id;
  const krw = Number(line.amountKRW) || 0;
  const usd = Number(line.amountUSD) || 0;
  const qty = Number(line.qty) || 0;
  bucket.totalKRW += krw;
  bucket.totalUSD += usd;
  if (!bucket.items[id]) {
    bucket.items[id] = {
      id,
      nameKO,
      nameEN,
      krw: 0,
      usd: 0,
      qty: 0,
    };
  }
  bucket.items[id].krw += krw;
  bucket.items[id].usd += usd;
  bucket.items[id].qty += qty;
  void langHint;
}

function itemsToSortedRows(items) {
  return Object.values(items || {})
    .map((it) => [
      it.nameKO || it.id,
      {
        krw: it.krw,
        usd: it.usd,
        qty: it.qty,
        nameKO: it.nameKO,
        nameEN: it.nameEN,
        id: it.id,
      },
    ])
    .sort((a, b) => (Number(b[1].krw) || 0) - (Number(a[1].krw) || 0));
}

/** Dashboard / statistics for a date range (by guest startDate). */
export function computeDashboardStats(reservations, fromDate, toDate) {
  let totalSalesKRW = 0;
  let totalSalesUSD = 0;
  let totalDivers = 0;
  let totalStayNights = 0;
  let totalSessions = 0;
  let depthSum = 0;
  let depthCount = 0;
  const monthly = {};
  const yearly = {};
  const categories = {
    room: emptyBucket(),
    training: emptyBucket(),
    option: emptyBucket(),
    promo: emptyBucket(),
    penalty: emptyBucket(),
  };

  const seq = bookingSeqMap(reservations);
  const rows = [];

  (reservations || []).forEach((res) => {
    (res.roomsData || []).forEach((room, roomIdx) => {
      (room.guests || []).forEach((guest, guestIdx) => {
        if (!guest) return;
        const start = guest.startDate || '';
        if (fromDate && start && start < fromDate) return;
        if (toDate && start && start > toDate) return;

        const krw = Number(guest.individualTotalKRW) || 0;
        const usd = Number(guest.individualTotalUSD) || 0;
        const nights = Number(guest.billedNights) || 0;
        const sessions = guestSessions(guest);
        const depth = Number(guest.targetDepth) || 0;

        totalSalesKRW += krw;
        totalSalesUSD += usd;
        totalDivers += 1;
        totalStayNights += nights;
        totalSessions += sessions;
        if (depth > 0) {
          depthSum += depth;
          depthCount += 1;
        }

        if (start.length >= 7) {
          const ym = start.slice(0, 7);
          const y = start.slice(0, 4);
          monthly[ym] ||= { krw: 0, usd: 0, pax: 0 };
          yearly[y] ||= { krw: 0, usd: 0, pax: 0 };
          monthly[ym].krw += krw;
          monthly[ym].usd += usd;
          monthly[ym].pax += 1;
          yearly[y].krw += krw;
          yearly[y].usd += usd;
          yearly[y].pax += 1;
        }

        const lines = Array.isArray(guest.billingLines)
          ? guest.billingLines
          : null;
        if (lines && lines.length) {
          lines.forEach((line) => {
            const kind = line.kind || 'option';
            if (categories[kind]) addLine(categories[kind], line);
            else addLine(categories.option, line);
          });
        } else {
          // Fallback for older reservations without billingLines
          if ((Number(guest.roomShareCost) || 0) > 0) {
            addLine(categories.room, {
              id: room.roomType || guest.roomType || 'ROOM',
              nameKO: guest.roomNameKO || room.roomType || '객실',
              nameEN: guest.roomNameEN || room.roomType || 'Room',
              qty: nights || 1,
              amountKRW: guest.roomShareCost,
              amountUSD: guest.roomShareCostUSD,
            });
          }
          if ((Number(guest.trainingCost) || 0) > 0) {
            addLine(categories.training, {
              id: 'TRAINING',
              nameKO: '트레이닝',
              nameEN: 'Training',
              qty: sessions || 1,
              amountKRW: guest.trainingCost,
              amountUSD: guest.trainingCostUSD,
            });
          }
          if ((Number(guest.optionsCost) || 0) > 0) {
            addLine(categories.option, {
              id: 'OPTIONS',
              nameKO: '옵션',
              nameEN: 'Options',
              qty: 1,
              amountKRW: guest.optionsCost,
              amountUSD: guest.optionsCostUSD,
            });
          }
          if ((Number(guest.penaltyFee) || 0) > 0) {
            addLine(categories.penalty, {
              id: 'PENALTY',
              nameKO: '패널티',
              nameEN: 'Penalty',
              qty: 1,
              amountKRW: guest.penaltyFee,
              amountUSD: Math.round(
                (Number(guest.penaltyFee) || 0) /
                  Math.max(1, Number(res.appliedExchangeRate) || 1400),
              ),
            });
          }
        }

        rows.push({
          bookingSeq: seq[res.id] || '0001',
          bookingInstructor: res.bookingInstructor || '',
          repName: res.repName || '',
          repEmail: res.repEmail || '',
          bookerGrade: res.bookerGrade || '',
          name: guest.name || '',
          nationality: guest.nationality || '',
          level: guest.level || '',
          startDate: guest.startDate || '',
          endDate: guest.endDate || '',
          individualTotalKRW: krw,
          individualTotalUSD: usd,
          consents: res.consents || {},
          resId: res.id,
          roomIdx,
          guestIdx,
        });
      });
    });
  });

  const categorySummary = {
    room: {
      ...categories.room,
      rows: itemsToSortedRows(categories.room.items),
    },
    training: {
      ...categories.training,
      rows: itemsToSortedRows(categories.training.items),
    },
    option: {
      ...categories.option,
      rows: itemsToSortedRows(categories.option.items),
    },
    promo: {
      ...categories.promo,
      rows: itemsToSortedRows(categories.promo.items),
    },
    penalty: {
      ...categories.penalty,
      rows: itemsToSortedRows(categories.penalty.items),
    },
  };

  const categoryTotalKRW =
    categorySummary.room.totalKRW +
    categorySummary.training.totalKRW +
    categorySummary.option.totalKRW +
    categorySummary.promo.totalKRW +
    categorySummary.penalty.totalKRW;
  const categoryTotalUSD =
    categorySummary.room.totalUSD +
    categorySummary.training.totalUSD +
    categorySummary.option.totalUSD +
    categorySummary.promo.totalUSD +
    categorySummary.penalty.totalUSD;

  return {
    totalSalesKRW,
    totalSalesUSD,
    totalDivers,
    totalStayNights,
    avgArpuKRW: totalDivers > 0 ? Math.round(totalSalesKRW / totalDivers) : 0,
    avgArpuUSD: totalDivers > 0 ? Math.round(totalSalesUSD / totalDivers) : 0,
    totalSessions,
    avgSessions:
      totalDivers > 0 ? (totalSessions / totalDivers).toFixed(1) : '0.0',
    avgDepth: depthCount > 0 ? Math.round(depthSum / depthCount) : 0,
    monthlyData: Object.entries(monthly).sort((a, b) =>
      a[0].localeCompare(b[0]),
    ),
    yearlyData: Object.entries(yearly).sort((a, b) => a[0].localeCompare(b[0])),
    rows,
    categories: categorySummary,
    categoryTotalKRW,
    categoryTotalUSD,
  };
}

export function downloadReservationsCsv(rows, t, filename) {
  const headers = [
    t('고유번호', 'Seq No'),
    t('예약자', 'Holder'),
    t('예약자 등급', 'Booker grade'),
    t('다이버 성명', 'Diver Name'),
    t('국적', 'Nationality'),
    t('레벨', 'Level'),
    t('총합계(₩)', 'Total(KRW)'),
  ];
  const lines = (rows || []).map((r) => [
    `#${r.bookingSeq || '0001'}`,
    r.bookingInstructor || '',
    r.bookerGrade || '',
    r.name || '',
    r.nationality || '',
    r.level || '',
    r.individualTotalKRW || 0,
  ]);
  const csv =
    '\uFEFF' +
    [headers, ...lines]
      .map((row) =>
        row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','),
      )
      .join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename || `Reservations_${Date.now()}.csv`;
  a.click();
}

export { formatMoney };
export { resolvePromoCode } from './defaults';
