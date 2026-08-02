import {
  DEFAULT_EXCHANGE_RATE,
  getGuestOptionQty,
  resolveOptionPrices,
  resolveOptionsCatalog,
  resolvePromoCode,
  resolvePromoCodesConfig,
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

/** Popup copy when early/late stay option applies (auto or manual). */
export function buildStayOptionAutoAlert({
  lang,
  kind, // 'early' | 'late'
  time,
  roomType,
  roomTypes,
  guestCount,
  t,
  auto = true,
}) {
  const rates = roomNightlyRates(roomType, roomTypes, guestCount);
  const money = formatPricePair(lang, rates.krw, rates.usd);
  const share = formatPricePair(lang, rates.shareKrw, rates.shareUsd);
  const n = Math.max(1, Number(guestCount) || 1);

  if (kind === 'early') {
    const title = auto
      ? t('⏰ [얼리체크인 자동 선택]', '⏰ [Early Check-in Auto-selected]')
      : t('⏰ [얼리체크인 안내]', '⏰ [Early Check-in Notice]');
    const cond = t(
      '조건: 체크인 시간이 12:00 이전(00:00~11:00)이면 얼리체크인(+1박)이 적용됩니다.',
      'Condition: Check-in before 12:00 (00:00–11:00) applies Early Check-in (+1 night).',
    );
    const how = t(
      '추가 방식: 숙박 박수에 +1박이 더해지며, 객실 1박 정가가 추가 청구됩니다.',
      'How charged: +1 night is added to stay nights, billed at the room’s nightly rate.',
    );
    const selected = time
      ? t(`선택 시간: ${time}`, `Selected time: ${time}`)
      : '';
    const fee =
      rates.krw > 0 || rates.usd > 0
        ? t(
            `추가 금액: ${money} (객실 1박 정가)\n룸쉐어(${n}인): 1인 약 ${share}`,
            `Extra: ${money} (1 room night)\nRoom-share (${n} pax): ~${share} each`,
          )
        : t(
            '추가 금액: 객실 미사용(다이빙만)인 경우 숙박 추가금 없음',
            'Extra charge: none when No Room (diving only) is selected',
          );
    return [title, cond, how, selected, fee].filter(Boolean).join('\n');
  }

  const title = auto
    ? t('⏰ [레이트 체크아웃 자동 선택]', '⏰ [Late Check-out Auto-selected]')
    : t('⏰ [레이트 체크아웃 안내]', '⏰ [Late Check-out Notice]');
  const cond = t(
    '조건: 체크아웃 시간이 13:00 이후이면 레이트 체크아웃(+1박)이 적용됩니다.',
    'Condition: Check-out at 13:00 or later applies Late Check-out (+1 night).',
  );
  const how = t(
    '추가 방식: 숙박 박수에 +1박이 더해지며, 객실 1박 정가가 추가 청구됩니다.',
    'How charged: +1 night is added to stay nights, billed at the room’s nightly rate.',
  );
  const selected = time
    ? t(`선택 시간: ${time}`, `Selected time: ${time}`)
    : '';
  const fee =
    rates.krw > 0 || rates.usd > 0
      ? t(
          `추가 금액: ${money} (객실 1박 정가)\n룸쉐어(${n}인): 1인 약 ${share}`,
          `Extra: ${money} (1 room night)\nRoom-share (${n} pax): ~${share} each`,
        )
      : t(
          '추가 금액: 객실 미사용(다이빙만)인 경우 숙박 추가금 없음',
          'Extra charge: none when No Room (diving only) is selected',
        );
  return [title, cond, how, selected, fee].filter(Boolean).join('\n');
}

/** Popup when video session count is selected. */
export function buildVideoGuideAlert({ lang, count, optionPrices, t }) {
  const n = Math.max(0, Number(count) || 0);
  const unitKrw = Number(optionPrices?.VIDEO_PER_DAY?.krw) || 0;
  const unitUsd = Number(optionPrices?.VIDEO_PER_DAY?.usd) || 0;
  const total = formatPricePair(lang, unitKrw * n, unitUsd * n);
  const unit = formatPricePair(lang, unitKrw, unitUsd);

  const title = t('🎥 [영상 촬영 안내]', '🎥 [Video Filming Notice]');
  const rule = t(
    '촬영은 1일 1인 1회입니다.',
    'Filming is limited to 1 session per person per day.',
  );
  const note = t(
    '별도 요청이 없을 경우 촬영자가 선택적으로 촬영하며, 필요 촬영에 대해 현장에서 조율 가능합니다.',
    'Without a special request, the videographer films selectively. Needed shots can be coordinated on site.',
  );
  const fee =
    n > 0
      ? t(
          `선택 횟수: ${n}회\n1회 요금: ${unit}\n합계: ${total}`,
          `Selected: ${n} session(s)\nPer session: ${unit}\nTotal: ${total}`,
        )
      : t('선택 횟수: 0회 (미신청)', 'Selected: 0 (not requested)');
  return `${title}\n${rule}\n${note}\n${fee}`;
}

/** Popup when diver count is selected. */
export function buildRoomShareAlert({ lang, guestCount, roomType, roomTypes, t }) {
  const n = Math.max(1, Number(guestCount) || 1);
  const rates = roomNightlyRates(roomType, roomTypes, n);
  const money = formatPricePair(lang, rates.krw, rates.usd);
  const share = formatPricePair(lang, rates.shareKrw, rates.shareUsd);

  const title = t('🛏️ [룸쉐어 요금 안내]', '🛏️ [Room-share Pricing Notice]');
  const body = t(
    '룸쉐어 시 1/n으로 룸가격이 나눠지며, 1인실이 되는날은 1인실 가격으로 청구됩니다.',
    'For room-share, the room rate is split 1/n. Days that become a single room are charged at the single-room rate.',
  );
  const detail =
    rates.krw > 0 || rates.usd > 0
      ? t(
          `현재 선택: ${n}명\n객실 1박 정가: ${money}\n1인 분담(1/${n}): 약 ${share}`,
          `Selected: ${n} divers\nRoom night: ${money}\nPer person (1/${n}): ~${share}`,
        )
      : t(`현재 선택: ${n}명`, `Selected: ${n} divers`);
  return `${title}\n${body}\n${detail}`;
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
  const lines = [];

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
        lines.push({
          kind: 'training',
          id: t.id,
          nameKO: t.name || t.id,
          nameEN: t.name || t.id,
          qty,
          unitKRW,
          unitUSD,
          amountKRW: lineKRW,
          amountUSD: lineUSD,
        });
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
      lines.push({
        kind: 'training',
        id,
        nameKO: id.replace('_', ' '),
        nameEN: id.replace('_', ' '),
        qty,
        unitKRW: krw,
        unitUSD: usd,
        amountKRW: lineKRW,
        amountUSD: lineUSD,
      });
    });
  }

  return {
    divingDays,
    costKRW,
    costUSD,
    discountedKRW,
    discountedUSD,
    lines,
  };
}

/**
 * Process rooms/guests into billed totals.
 * Supports Rv19 per-training-type discounts via guest.trainingDiscounts.
 * Falls back to guest.trainingDiscount for legacy docs.
 */
function applyEscortTrainingPromo(training, promo, guest) {
  if (!promo || !training) {
    return {
      ...training,
      escortDiscountKRW: 0,
      escortDiscountUSD: 0,
      escortCode: '',
    };
  }
  const scope = promo.trainingScope;
  const all =
    !scope || scope === 'ALL' || (Array.isArray(scope) && scope.length === 0);
  const discounts = guest?.trainingDiscounts || {};
  const guestPct = Number(guest?.trainingDiscount) || 0;
  let scopedKRW = 0;
  let scopedUSD = 0;
  (training.lines || []).forEach((l) => {
    if (!all && !(Array.isArray(scope) && scope.includes(l.id))) return;
    const pct = Number(discounts[l.id]) || guestPct || 0;
    scopedKRW += (Number(l.amountKRW) || 0) * (1 - pct / 100);
    scopedUSD += (Number(l.amountUSD) || 0) * (1 - pct / 100);
  });
  scopedKRW = Math.round(scopedKRW);
  scopedUSD = Math.round(scopedUSD);
  let discountKRW = 0;
  let discountUSD = 0;
  if (promo.discountType === 'amount') {
    discountKRW = Math.min(scopedKRW, Number(promo.discountValue) || 0);
    discountUSD = Math.min(scopedUSD, Number(promo.discountUSD) || 0);
    if (discountUSD <= 0 && discountKRW > 0 && scopedKRW > 0) {
      discountUSD = Math.round((discountKRW / scopedKRW) * scopedUSD);
    }
  } else {
    const pct = Math.min(100, Math.max(0, Number(promo.discountValue) || 0));
    discountKRW = Math.round(scopedKRW * (pct / 100));
    discountUSD = Math.round(scopedUSD * (pct / 100));
  }
  return {
    ...training,
    discountedKRW: Math.max(
      0,
      (Number(training.discountedKRW) || Number(training.costKRW) || 0) -
        discountKRW,
    ),
    discountedUSD: Math.max(
      0,
      (Number(training.discountedUSD) || Number(training.costUSD) || 0) -
        discountUSD,
    ),
    escortDiscountKRW: discountKRW,
    escortDiscountUSD: discountUSD,
    escortCode: promo.code || '',
  };
}

/** Settings + optional escort code for processRoomsData 6th arg. */
export function buildPricingExtras(settings, escortCode) {
  return {
    promoCodes: resolvePromoCodesConfig(settings?.promoCodesConfig),
    escortCode: String(escortCode || '')
      .trim()
      .toUpperCase(),
  };
}

export function processRoomsData(
  roomsData,
  exchangeRate = DEFAULT_EXCHANGE_RATE,
  roomTypes = [],
  trainingTypes = [],
  optionPricesConfig,
  pricingExtras = {},
) {
  if (!Array.isArray(roomsData)) {
    return { processedRooms: [], grandTotalKRW: 0, grandTotalUSD: 0 };
  }

  let grandTotalKRW = 0;
  let grandTotalUSD = 0;
  const rate = Number(exchangeRate) || DEFAULT_EXCHANGE_RATE;
  const optionPrices = resolveOptionPrices(optionPricesConfig);
  const optionsCatalog = resolveOptionsCatalog(optionPricesConfig);
  const promo = resolvePromoCode(
    pricingExtras.promoCodes,
    pricingExtras.escortCode,
  );

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

        let training = trainingCostForGuest(guest, trainingTypes);
        training = applyEscortTrainingPromo(training, promo, guest);
        let optionsCost = 0;
        let optionsCostUSD = 0;
        const optionLines = [];
        const transfer = optionPrices.TRANSFER || {
          krw: 0,
          usd: 0,
          isActive: true,
          nameKO: '공항 픽업/드롭오프',
          nameEN: 'Airport Transfer',
        };
        if (transfer.isActive !== false) {
          if (guest.airportPickup) {
            optionsCost += transfer.krw;
            optionsCostUSD += transfer.usd;
            optionLines.push({
              kind: 'option',
              id: 'TRANSFER_PICKUP',
              nameKO: '공항 픽업',
              nameEN: 'Airport Pickup',
              qty: 1,
              unitKRW: transfer.krw,
              unitUSD: transfer.usd,
              amountKRW: transfer.krw,
              amountUSD: transfer.usd,
            });
          }
          if (guest.airportDropoff) {
            optionsCost += transfer.krw;
            optionsCostUSD += transfer.usd;
            optionLines.push({
              kind: 'option',
              id: 'TRANSFER_DROPOFF',
              nameKO: '공항 드롭오프',
              nameEN: 'Airport Dropoff',
              qty: 1,
              unitKRW: transfer.krw,
              unitUSD: transfer.usd,
              amountKRW: transfer.krw,
              amountUSD: transfer.usd,
            });
          }
        }
        for (const opt of optionsCatalog) {
          if (opt.uiType === 'transfer') continue;
          if (opt.isActive === false) continue;
          const qty = getGuestOptionQty(guest, opt.id);
          if (qty <= 0) continue;
          const unitKRW = Number(opt.priceKRW) || 0;
          const unitUSD = Number(opt.priceUSD) || 0;
          const lineKRW = unitKRW * qty;
          const lineUSD = unitUSD * qty;
          optionsCost += lineKRW;
          optionsCostUSD += lineUSD;
          optionLines.push({
            kind: 'option',
            id: opt.id,
            nameKO: opt.nameKO,
            nameEN: opt.nameEN,
            qty,
            unitKRW,
            unitUSD,
            amountKRW: lineKRW,
            amountUSD: lineUSD,
          });
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
        const escortApplied = (Number(training.escortDiscountKRW) || 0) > 0;

        const trainingAfterDiscount = escortApplied
          ? training.discountedKRW
          : hasPerTypeDiscount
            ? training.discountedKRW
            : training.costKRW *
              (1 - (Number(guest.trainingDiscount) || 0) / 100);
        const trainingAfterDiscountUSD = escortApplied
          ? training.discountedUSD
          : hasPerTypeDiscount
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

        const roomNameKO =
          roomType === 'NONE'
            ? '객실 미사용 (다이빙만)'
            : roomCfg?.nameKO || roomCfg?.name || roomType;
        const roomNameEN =
          roomType === 'NONE'
            ? 'No room (diving only)'
            : roomCfg?.nameEN || roomCfg?.name || roomType;

        const billingLines = [];
        if (roomShareCost > 0 || roomShareCostUSD > 0 || billedNights > 0) {
          const extras = [];
          if (guest.dawnCheckIn) extras.push({ ko: '얼리체크인', en: 'Early CI' });
          if (guest.lateCheckOut) extras.push({ ko: '레이트체크아웃', en: 'Late CO' });
          const extraKO = extras.length
            ? ` (${extras.map((e) => e.ko).join(', ')})`
            : '';
          const extraEN = extras.length
            ? ` (${extras.map((e) => e.en).join(', ')})`
            : '';
          billingLines.push({
            kind: 'room',
            id: roomType || 'NONE',
            nameKO: `${roomNameKO} · ${billedNights}박 / ${guestCount}인${extraKO}`,
            nameEN: `${roomNameEN} · ${billedNights}n / ${guestCount}pax${extraEN}`,
            qty: billedNights,
            amountKRW: Math.round(roomShareCost),
            amountUSD: Math.round(roomShareCostUSD),
          });
        }
        billingLines.push(...training.lines);
        if ((Number(training.escortDiscountKRW) || 0) > 0) {
          billingLines.push({
            kind: 'promo',
            id: 'ESCORT',
            nameKO: `인솔자코드 할인 (${training.escortCode})`,
            nameEN: `Escort code discount (${training.escortCode})`,
            qty: 1,
            amountKRW: -Math.round(training.escortDiscountKRW),
            amountUSD: -Math.round(training.escortDiscountUSD || 0),
          });
        }
        billingLines.push(...optionLines);
        if (penaltyFee > 0) {
          billingLines.push({
            kind: 'penalty',
            id: 'PENALTY',
            nameKO: '패널티',
            nameEN: 'Penalty',
            qty: 1,
            amountKRW: penaltyFee,
            amountUSD: penaltyUSD,
          });
        }

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
          escortDiscountKRW: training.escortDiscountKRW || 0,
          escortDiscountUSD: training.escortDiscountUSD || 0,
          escortCode: training.escortCode || '',
          baseTotalKRW,
          baseTotalUSD,
          individualTotalKRW,
          individualTotalUSD,
          roomType,
          roomNameKO,
          roomNameEN,
          billingLines,
        };
      })
      .filter(Boolean);

    return { ...room, guests: processedGuests, roomType, guestCount };
  });

  return { processedRooms, grandTotalKRW, grandTotalUSD };
}
