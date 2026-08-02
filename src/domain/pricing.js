import {
  DEFAULT_EXCHANGE_RATE,
  resolveOptionPrices,
} from './defaults';

export function formatMoney(value) {
  if (value == null || Number.isNaN(Number(value))) return '0';
  return Number(value).toLocaleString();
}

export function isEnglishLang(lang) {
  return String(lang || '').toUpperCase() === 'EN';
}

/**
 * KO: KRW first (₩… / $…)
 * EN: USD first ($… / ₩…)
 */
export function formatPricePair(lang, priceKRW, priceUSD) {
  const krw = `₩${formatMoney(priceKRW)}`;
  const usd = `$${formatMoney(priceUSD)}`;
  return isEnglishLang(lang) ? `${usd} / ${krw}` : `${krw} / ${usd}`;
}

/** Primary currency only (KO=₩, EN=$). */
export function formatPriceLabel(lang, priceKRW, priceUSD) {
  if (isEnglishLang(lang)) return `$${formatMoney(priceUSD)}`;
  return `₩${formatMoney(priceKRW)}`;
}

export function roomNightlyRates(roomType, roomTypes = [], guestCount = 1) {
  if (!roomType || roomType === 'NONE') {
    return { krw: 0, usd: 0, shareKrw: 0, shareUsd: 0 };
  }
  const cfg = (roomTypes || []).find((r) => r.id === roomType);
  const krw = Number(cfg?.priceKRW) || 0;
  const usd = Number(cfg?.priceUSD) || 0;
  const n = Math.max(1, Number(guestCount) || 1);
  return {
    krw,
    usd,
    shareKrw: Math.round(krw / n),
    shareUsd: Math.round(usd / n),
  };
}

/** Popup copy when early/late stay option auto-applies. */
export function buildStayOptionAutoAlert({
  lang,
  kind, // 'early' | 'late'
  time,
  roomType,
  roomTypes,
  guestCount,
  t,
}) {
  const rates = roomNightlyRates(roomType, roomTypes, guestCount);
  const money = formatPriceLabel(lang, rates.krw, rates.usd);
  const share = formatPriceLabel(lang, rates.shareKrw, rates.shareUsd);

  if (kind === 'early') {
    const title = t('⏰ [얼리체크인 자동 선택]', '⏰ [Early Check-in Auto-selected]');
    const cond = t(
      '조건: 체크인 시간이 12:00 이전(00:00~11:00)이면 얼리체크인(+1박)이 적용됩니다.',
      'Condition: Check-in before 12:00 (00:00–11:00) applies Early Check-in (+1 night).',
    );
    const selected = t(`선택 시간: ${time}`, `Selected time: ${time}`);
    const fee =
      rates.krw > 0 || rates.usd > 0
        ? t(
            `추가 금액: ${money} (객실 1박) · 1인 분담 약 ${share}`,
            `Extra charge: ${money} (1 room night) · ~${share} per person`,
          )
        : t(
            '추가 금액: 객실 미사용(다이빙만)인 경우 숙박 추가금 없음',
            'Extra charge: none when No Room (diving only) is selected',
          );
    return `${title}\n${cond}\n${selected}\n${fee}`;
  }

  const title = t(
    '⏰ [레이트 체크아웃 자동 선택]',
    '⏰ [Late Check-out Auto-selected]',
  );
  const cond = t(
    '조건: 체크아웃 시간이 13:00 이후이면 레이트 체크아웃(+1박)이 적용됩니다.',
    'Condition: Check-out at 13:00 or later applies Late Check-out (+1 night).',
  );
  const selected = t(`선택 시간: ${time}`, `Selected time: ${time}`);
  const fee =
    rates.krw > 0 || rates.usd > 0
      ? t(
          `추가 금액: ${money} (객실 1박) · 1인 분담 약 ${share}`,
          `Extra charge: ${money} (1 room night) · ~${share} per person`,
        )
      : t(
          '추가 금액: 객실 미사용(다이빙만)인 경우 숙박 추가금 없음',
          'Extra charge: none when No Room (diving only) is selected',
        );
  return `${title}\n${cond}\n${selected}\n${fee}`;
}

function nightsBetween(startDate, endDate) {
  if (!startDate || !endDate) return 0;
  const start = new Date(startDate);
  const end = new Date(endDate);
  return Math.max(0, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));
}

function roomShareFallback(roomType, guestCount, billedNights) {
  const c = billedNights;
  const l = guestCount;
  if (roomType === 'TWIN' || roomType === 'DELUXE') {
    return l === 1
      ? { krw: c * 80000, usd: c * 60 }
      : { krw: c * 40000, usd: c * 30 };
  }
  if (roomType === 'DELUXE_TWIN') {
    if (l === 1) return { krw: c * 116000, usd: c * 80 };
    if (l === 2) return { krw: c * 58000, usd: c * 40 };
    return { krw: c * 38660, usd: c * 27 };
  }
  return { krw: 0, usd: 0 };
}

function trainingCostForGuest(guest, trainingTypes) {
  const counts = guest.trainingCounts || {};
  const discounts = guest.trainingDiscounts || {};
  let divingDays = 0;
  let costKRW = 0;
  let costUSD = 0;
  let discountedKRW = 0;
  let discountedUSD = 0;

  if (Array.isArray(trainingTypes) && trainingTypes.length > 0) {
    trainingTypes
      .filter((t) => t.isActive !== false)
      .forEach((t) => {
        const qty = Number(counts[t.id]) || 0;
        if (qty <= 0) return;
        divingDays += qty;
        const unitKRW = Number(t.priceKRW) || 0;
        const unitUSD = Number(t.priceUSD) || 0;
        const lineKRW = qty * unitKRW;
        const lineUSD = qty * unitUSD;
        costKRW += lineKRW;
        costUSD += lineUSD;
        const pct =
          Number(discounts[t.id]) ||
          Number(guest.trainingDiscount) ||
          0;
        discountedKRW += lineKRW * (1 - pct / 100);
        discountedUSD += lineUSD * (1 - pct / 100);
      });
  } else {
    const map = [
      ['MAX_60', 80000, 60],
      ['MAX_90', 120000, 80],
      ['MAX_130', 150000, 100],
      ['SELF_60', 50000, 30],
    ];
    map.forEach(([id, krw, usd]) => {
      const qty = Number(counts[id]) || 0;
      if (qty <= 0) return;
      divingDays += qty;
      const lineKRW = qty * krw;
      const lineUSD = qty * usd;
      costKRW += lineKRW;
      costUSD += lineUSD;
      const pct =
        Number(discounts[id]) || Number(guest.trainingDiscount) || 0;
      discountedKRW += lineKRW * (1 - pct / 100);
      discountedUSD += lineUSD * (1 - pct / 100);
    });
  }

  return { divingDays, costKRW, costUSD, discountedKRW, discountedUSD };
}

/**
 * Process rooms/guests into billed totals.
 * Supports Rv19 per-training-type discounts via guest.trainingDiscounts.
 * Falls back to guest.trainingDiscount for legacy docs.
 */
export function processRoomsData(
  roomsData,
  exchangeRate = DEFAULT_EXCHANGE_RATE,
  roomTypes = [],
  trainingTypes = [],
  optionPricesConfig,
) {
  if (!Array.isArray(roomsData)) {
    return { processedRooms: [], grandTotalKRW: 0, grandTotalUSD: 0 };
  }

  let grandTotalKRW = 0;
  let grandTotalUSD = 0;
  const rate = Number(exchangeRate) || DEFAULT_EXCHANGE_RATE;
  const optionPrices = resolveOptionPrices(optionPricesConfig);

  const processedRooms = roomsData.map((room) => {
    const roomType = room.roomType || 'NONE';
    const guests = Array.isArray(room.guests) ? room.guests : [];
    const guestCount = guests.length;
    const roomCfg = Array.isArray(roomTypes)
      ? roomTypes.find((r) => r.id === roomType)
      : null;

    const processedGuests = guests
      .map((guest) => {
        if (!guest) return null;

        let billedNights = nightsBetween(guest.startDate, guest.endDate);
        if (guest.dawnCheckIn) billedNights += 1;
        if (guest.lateCheckOut) billedNights += 1;

        let roomShareCost = 0;
        let roomShareCostUSD = 0;
        if (roomType !== 'NONE' && guestCount > 0) {
          if (roomCfg && roomCfg.priceKRW !== undefined) {
            roomShareCost =
              (billedNights * (Number(roomCfg.priceKRW) || 0)) / guestCount;
            roomShareCostUSD =
              (billedNights * (Number(roomCfg.priceUSD) || 0)) / guestCount;
          } else {
            const fb = roomShareFallback(roomType, guestCount, billedNights);
            roomShareCost = fb.krw;
            roomShareCostUSD = fb.usd;
          }
        }

        const training = trainingCostForGuest(guest, trainingTypes);
        let optionsCost = 0;
        let optionsCostUSD = 0;
        if (guest.airportPickup) {
          optionsCost += optionPrices.TRANSFER.krw;
          optionsCostUSD += optionPrices.TRANSFER.usd;
        }
        if (guest.airportDropoff) {
          optionsCost += optionPrices.TRANSFER.krw;
          optionsCostUSD += optionPrices.TRANSFER.usd;
        }
        if (guest.needsVideo) {
          optionsCost += optionPrices.VIDEO_PER_DAY.krw * training.divingDays;
          optionsCostUSD +=
            optionPrices.VIDEO_PER_DAY.usd * training.divingDays;
        }
        if ((guest.islandHopping || 0) > 0) {
          optionsCost += optionPrices.HOPPING.krw * guest.islandHopping;
          optionsCostUSD += optionPrices.HOPPING.usd * guest.islandHopping;
        }
        if ((guest.funDiving || 0) > 0) {
          optionsCost += optionPrices.FUN_DIVING.krw * guest.funDiving;
          optionsCostUSD += optionPrices.FUN_DIVING.usd * guest.funDiving;
        }

        const penaltyFee = Number(guest.penaltyFee) || 0;
        const penaltyUSD = Math.round(penaltyFee / rate);
        const roomDiscount = Number(guest.roomDiscount) || 0;
        const optionsDiscount = Number(guest.optionsDiscount) || 0;
        const customTotalKRW = Number(guest.customTotalKRW) || 0;

        const baseTotalKRW =
          roomShareCost + training.costKRW + optionsCost + penaltyFee;
        const baseTotalUSD =
          roomShareCostUSD + training.costUSD + optionsCostUSD + penaltyUSD;

        const hasPerTypeDiscount = Object.values(
          guest.trainingDiscounts || {},
        ).some((v) => Number(v) > 0);

        const trainingAfterDiscount = hasPerTypeDiscount
          ? training.discountedKRW
          : training.costKRW *
            (1 - (Number(guest.trainingDiscount) || 0) / 100);
        const trainingAfterDiscountUSD = hasPerTypeDiscount
          ? training.discountedUSD
          : training.costUSD *
            (1 - (Number(guest.trainingDiscount) || 0) / 100);

        const individualTotalKRW =
          customTotalKRW > 0
            ? customTotalKRW
            : Math.round(
                roomShareCost * (1 - roomDiscount / 100) +
                  trainingAfterDiscount +
                  optionsCost * (1 - optionsDiscount / 100) +
                  penaltyFee,
              );

        const individualTotalUSD =
          customTotalKRW > 0
            ? Math.round(customTotalKRW / rate)
            : Math.round(
                roomShareCostUSD * (1 - roomDiscount / 100) +
                  trainingAfterDiscountUSD +
                  optionsCostUSD * (1 - optionsDiscount / 100) +
                  penaltyUSD,
              );

        grandTotalKRW += individualTotalKRW;
        grandTotalUSD += individualTotalUSD;

        return {
          ...guest,
          billedNights,
          divingDays: training.divingDays,
          trainingDaysCount: training.divingDays,
          singleRoomNights: guestCount === 1 ? billedNights : 0,
          doubleRoomNights: guestCount === 2 ? billedNights : 0,
          tripleRoomNights: guestCount >= 3 ? billedNights : 0,
          roomShareCost,
          roomShareCostUSD,
          trainingCost: training.costKRW,
          trainingCostUSD: training.costUSD,
          optionsCost,
          optionsCostUSD,
          baseTotalKRW,
          baseTotalUSD,
          individualTotalKRW,
          individualTotalUSD,
        };
      })
      .filter(Boolean);

    return { ...room, guests: processedGuests };
  });

  return { processedRooms, grandTotalKRW, grandTotalUSD };
}
