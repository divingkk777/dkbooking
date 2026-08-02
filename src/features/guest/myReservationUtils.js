import { parseLocalISODate, toLocalISODate } from '../../domain/dateUtils';
import {
  buildPricingExtras,
  formatPricePair,
  processRoomsData,
} from '../../domain/pricing';

function daysUntilCheckIn(dateStr) {
  if (!dateStr) return 999;
  const today = parseLocalISODate(toLocalISODate());
  const checkIn = parseLocalISODate(dateStr);
  return Math.round((checkIn - today) / 86400000);
}

export function guestSummary(res) {
  const guests = [];
  (res.roomsData || []).forEach((room, roomIdx) => {
    (room.guests || []).forEach((g, guestIdx) => {
      if (g) guests.push({ ...g, __roomIdx: roomIdx, __guestIdx: guestIdx });
    });
  });
  return guests;
}

export function dateSpan(guests) {
  const starts = guests.map((g) => g.startDate).filter(Boolean).sort();
  const ends = guests.map((g) => g.endDate).filter(Boolean).sort();
  if (!starts.length) return '—';
  const a = starts[0];
  const b = ends[ends.length - 1] || a;
  return a === b ? a : `${a} ~ ${b}`;
}

/** Quote PNG name: HolderName_YY-MM-DD.png (earliest guest start date). */
export function buildQuoteFileName(res) {
  const rawName = String(res?.repName || res?.bookingInstructor || 'quote')
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  const name = rawName || 'quote';
  const starts = guestSummary(res)
    .map((g) => g.startDate)
    .filter(Boolean)
    .sort();
  const start = starts[0] || '';
  if (/^\d{4}-\d{2}-\d{2}/.test(start)) {
    const yy = start.slice(2, 4);
    const mm = start.slice(5, 7);
    const dd = start.slice(8, 10);
    return `${name}_${yy}-${mm}-${dd}.png`;
  }
  return `${name}.png`;
}

export function stripDiscountsFromRooms(roomsData) {
  return (roomsData || []).map((room) => ({
    ...room,
    guests: (room.guests || []).map((g) => ({
      ...g,
      roomDiscount: 0,
      optionsDiscount: 0,
      trainingDiscount: 0,
      trainingDiscounts: {},
      customTotalKRW: 0,
    })),
  }));
}

export function repriceReservation(res, settings, { withDiscount = true } = {}) {
  const raw = withDiscount
    ? structuredClone(res.roomsData || [])
    : stripDiscountsFromRooms(structuredClone(res.roomsData || []));
  return processRoomsData(
    raw,
    settings.exchangeRate,
    settings.roomTypesConfig,
    settings.trainingTypesConfig,
    settings.optionsCatalogConfig || settings.optionPricesConfig,
    buildPricingExtras(settings, withDiscount ? res.escortCode : ''),
  );
}

/**
 * Estimate change penalty from cancellation policy:
 * - within 24h of booking: free
 * - 8+ days before check-in: free
 * - within 7 days: room reduction non-refundable
 * - check-in day or past: 100% of reduced room+training
 */
export function estimateEditPenalty({
  baselineGuest,
  nextGuest,
  submittedAt,
}) {
  const empty = { amountKRW: 0, amountUSD: 0, reasonsKO: [], reasonsEN: [] };
  if (!baselineGuest || !nextGuest) return empty;

  if (submittedAt) {
    const submittedMs = new Date(submittedAt).getTime();
    if (
      !Number.isNaN(submittedMs) &&
      Date.now() - submittedMs <= 24 * 3600 * 1000
    ) {
      return empty;
    }
  }

  const checkIn = baselineGuest.startDate || nextGuest.startDate;
  const days = daysUntilCheckIn(checkIn);
  if (days >= 8) return empty;

  const oldRoom = Number(baselineGuest.roomShareCost) || 0;
  const newRoom = Number(nextGuest.roomShareCost) || 0;
  const roomDrop = Math.max(0, Math.round(oldRoom - newRoom));
  const oldRoomUsd = Number(baselineGuest.roomShareCostUSD) || 0;
  const newRoomUsd = Number(nextGuest.roomShareCostUSD) || 0;
  const roomDropUsd = Math.max(0, Math.round(oldRoomUsd - newRoomUsd));

  const oldTrain = Number(baselineGuest.trainingCost) || 0;
  const newTrain = Number(nextGuest.trainingCost) || 0;
  const trainDrop = Math.max(0, Math.round(oldTrain - newTrain));
  const oldTrainUsd = Number(baselineGuest.trainingCostUSD) || 0;
  const newTrainUsd = Number(nextGuest.trainingCostUSD) || 0;
  const trainDropUsd = Math.max(0, Math.round(oldTrainUsd - newTrainUsd));

  const reasonsKO = [];
  const reasonsEN = [];
  let amountKRW = 0;
  let amountUSD = 0;

  if (days <= 0) {
    if (roomDrop > 0 || trainDrop > 0) {
      amountKRW = roomDrop + trainDrop;
      amountUSD = roomDropUsd + trainDropUsd;
      reasonsKO.push(
        '다이빙 당일(또는 지난) 일정 축소: 객실·트레이닝 차감분 100% 패널티',
      );
      reasonsEN.push(
        'Same-day (or past) schedule reduction: 100% penalty on reduced room & training',
      );
    }
  } else if (roomDrop > 0) {
    amountKRW = roomDrop;
    amountUSD = roomDropUsd;
    reasonsKO.push('체크인 7일 이내 변경: 객실 금액 환불·취소 불가 (패널티)');
    reasonsEN.push(
      'Within 7 days of check-in: room portion is non-refundable (penalty)',
    );
  }

  return { amountKRW, amountUSD, reasonsKO, reasonsEN };
}

/** Days left until trash auto-purge (default 30-day retention). */
export function trashDaysRemaining(trashedAt, retentionDays = 30) {
  if (!trashedAt) return retentionDays;
  const at = new Date(trashedAt).getTime();
  if (Number.isNaN(at)) return retentionDays;
  const elapsed = Math.floor((Date.now() - at) / 86400000);
  return Math.max(0, retentionDays - elapsed);
}

export function formatTrashDate(trashedAt) {
  if (!trashedAt) return '—';
  return String(trashedAt).slice(0, 19).replace('T', ' ');
}

/**
 * Guest self-delete rules:
 * - blocked if room number assigned
 * - blocked if in penalty window (check-in within 7 days), unless within 24h of booking
 */
export function getReservationDeleteBlock(res) {
  const reasonsKO = [];
  const reasonsEN = [];
  if (!res) {
    return { blocked: true, reasonsKO: ['예약 없음'], reasonsEN: ['No booking'] };
  }

  if (String(res.assignedRoomNumbers || '').trim()) {
    reasonsKO.push('객실 번호가 배정되어 삭제할 수 없습니다.');
    reasonsEN.push('A room number is already assigned — cannot delete.');
  }

  let freeCancelWindow = false;
  if (res.submittedAt) {
    const submittedMs = new Date(res.submittedAt).getTime();
    if (
      !Number.isNaN(submittedMs) &&
      Date.now() - submittedMs <= 24 * 3600 * 1000
    ) {
      freeCancelWindow = true;
    }
  }

  if (!freeCancelWindow) {
    const starts = guestSummary(res)
      .map((g) => g.startDate)
      .filter(Boolean)
      .sort();
    const earliest = starts[0];
    if (earliest && daysUntilCheckIn(earliest) < 8) {
      reasonsKO.push(
        '패널티 구간(체크인 7일 이내)에는 삭제할 수 없습니다.',
      );
      reasonsEN.push(
        'Cannot delete during the penalty window (within 7 days of check-in).',
      );
    }
  }

  return {
    blocked: reasonsKO.length > 0,
    reasonsKO,
    reasonsEN,
  };
}

/** True when guest % discounts or escort promo actually change the quote total. */
export function reservationHasAppliedDiscount(res, settings) {
  if (!res) return false;
  const fromStored = guestSummary(res).some((g) => {
    if ((Number(g.roomDiscount) || 0) > 0) return true;
    if ((Number(g.optionsDiscount) || 0) > 0) return true;
    if ((Number(g.trainingDiscount) || 0) > 0) return true;
    if ((Number(g.escortDiscountKRW) || 0) > 0) return true;
    return Object.values(g.trainingDiscounts || {}).some((v) => Number(v) > 0);
  });
  if (fromStored) return true;
  if (!settings) return Boolean(String(res.escortCode || '').trim());
  const withDisc = repriceReservation(res, settings, { withDiscount: true });
  const noDisc = repriceReservation(res, settings, { withDiscount: false });
  return (
    Math.round(Number(withDisc.grandTotalKRW) || 0) !==
      Math.round(Number(noDisc.grandTotalKRW) || 0) ||
    Math.round(Number(withDisc.grandTotalUSD) || 0) !==
      Math.round(Number(noDisc.grandTotalUSD) || 0)
  );
}

/** @deprecated Prefer buildProfessionalReservationEmail from lib/emailTemplates */
export function buildReservationEmailBody(res, t, lang) {
  const guests = guestSummary(res);
  const lines = [
    `IDA CEBU × DOUBLE K FREEDIVING`,
    t('예약 현황 · 견적 안내서', 'Booking Status & Quotation'),
    '',
    `${t('예약자', 'Holder')}: ${res.repName || '—'}`,
    `${t('이메일', 'Email')}: ${res.repEmail || res.bookingInstructor || '—'}`,
    `${t('일정', 'Dates')}: ${dateSpan(guests)}`,
    `${t('결제', 'Payment')}: ${res.paymentStatus || t('대기', 'Pending')}`,
    `${t('바우처', 'Voucher')}: ${res.voucherStatus || '—'}`,
    '',
  ];
  guests.forEach((g, i) => {
    lines.push(
      `—— ${t('다이버', 'Diver')} ${i + 1}: ${g.name || '—'} ——`,
      `${g.startDate || '—'} ~ ${g.endDate || '—'}`,
      `CI ${g.checkInTime || '—'} / CO ${g.checkOutTime || '—'}`,
      `${g.discipline || '—'} ${g.targetDepth ?? ''}m · ${g.level || ''}`,
    );
    (g.billingLines || []).forEach((line) => {
      const name =
        String(lang || '').toUpperCase() === 'EN'
          ? line.nameEN || line.nameKO || line.id
          : line.nameKO || line.nameEN || line.id;
      lines.push(
        `  · ${name}: ${formatPricePair(lang, line.amountKRW, line.amountUSD)}`,
      );
    });
    lines.push(
      `${t('소계', 'Subtotal')}: ${formatPricePair(lang, g.individualTotalKRW, g.individualTotalUSD)}`,
      '',
    );
  });
  lines.push(
    `${t('합계', 'Total')}: ${formatPricePair(lang, res.grandTotalKRW, res.grandTotalUSD)}`,
    '',
    `${t('카카오톡', 'KakaoTalk')}: freedivingkk`,
    `WhatsApp · Angelic: +63 998 917 1548`,
  );
  return lines.join('\n');
}

export function matchesDiverSearch(res, q) {
  const needle = String(q || '')
    .trim()
    .toLowerCase();
  if (!needle) return true;
  if (String(res.repName || '').toLowerCase().includes(needle)) return true;
  if (String(res.repEmail || '').toLowerCase().includes(needle)) return true;
  if (String(res.bookingInstructor || '').toLowerCase().includes(needle)) {
    return true;
  }
  if (String(res.paymentStatus || '').toLowerCase().includes(needle)) {
    return true;
  }
  return guestSummary(res).some((g) =>
    String(g.name || '')
      .toLowerCase()
      .includes(needle),
  );
}

export function sortReservations(list, sortBy) {
  const out = [...list];
  const startKey = (r) => {
    const g = guestSummary(r);
    return g.map((x) => x.startDate).filter(Boolean).sort()[0] || '';
  };
  const nameKey = (r) => {
    const g = guestSummary(r);
    return (
      g
        .map((x) => x.name || '')
        .filter(Boolean)
        .sort()[0] ||
      r.repName ||
      ''
    ).toLowerCase();
  };
  out.sort((a, b) => {
    if (sortBy === 'dateAsc') return startKey(a).localeCompare(startKey(b));
    if (sortBy === 'dateDesc') return startKey(b).localeCompare(startKey(a));
    if (sortBy === 'nameAsc') return nameKey(a).localeCompare(nameKey(b));
    if (sortBy === 'nameDesc') return nameKey(b).localeCompare(nameKey(a));
    if (sortBy === 'amountAsc') {
      return (Number(a.grandTotalKRW) || 0) - (Number(b.grandTotalKRW) || 0);
    }
    if (sortBy === 'amountDesc') {
      return (Number(b.grandTotalKRW) || 0) - (Number(a.grandTotalKRW) || 0);
    }
    // submittedDesc default
    return String(b.submittedAt || '').localeCompare(String(a.submittedAt || ''));
  });
  return out;
}
