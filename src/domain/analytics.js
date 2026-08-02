import { bookingSeqMap } from './listModel';
import { formatMoney } from './pricing';

function guestSessions(guest) {
  const counts = guest.trainingCounts || {};
  return Object.values(counts).reduce((s, v) => s + (Number(v) || 0), 0);
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

        rows.push({
          bookingSeq: seq[res.id] || '0001',
          bookingInstructor: res.bookingInstructor || '',
          repName: res.repName || '',
          repEmail: res.repEmail || '',
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
  };
}

export function downloadReservationsCsv(rows, t, filename) {
  const headers = [
    t('고유번호', 'Seq No'),
    t('예약자', 'Holder'),
    t('다이버 성명', 'Diver Name'),
    t('국적', 'Nationality'),
    t('레벨', 'Level'),
    t('총합계(₩)', 'Total(KRW)'),
  ];
  const lines = (rows || []).map((r) => [
    `#${r.bookingSeq || '0001'}`,
    r.bookingInstructor || '',
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
