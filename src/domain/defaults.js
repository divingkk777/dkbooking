export const DEFAULT_EXCHANGE_RATE = 1450;

export const DEFAULT_ROOM_TYPES = [
  { id: 'TWIN', nameKO: '트윈룸', nameEN: 'Twin Room', priceKRW: 60000, priceUSD: 42, isActive: true },
  { id: 'DELUXE', nameKO: '디럭스룸', nameEN: 'Deluxe Room', priceKRW: 80000, priceUSD: 55, isActive: true },
  { id: 'DELUXE_TWIN', nameKO: '디럭스 트윈', nameEN: 'Deluxe Twin', priceKRW: 90000, priceUSD: 62, isActive: true },
];

/** King+Single → 3, other rooms → 2, diving-only (NONE) → 4 */
export function maxGuestsForRoomType(roomType, roomTypes = []) {
  if (!roomType) return 2;
  if (roomType === 'NONE') return 4;
  const cfg = (roomTypes || []).find((r) => r.id === roomType);
  const blob = [roomType, cfg?.id, cfg?.nameKO, cfg?.nameEN, cfg?.name]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .replace(/\s+/g, '');
  const isKingSingle =
    blob.includes('킹+싱글') ||
    blob.includes('킹싱글') ||
    blob.includes('king+single') ||
    blob.includes('kingsingle') ||
    /king.?single/.test(blob) ||
    roomType === 'KING_SINGLE' ||
    roomType === 'KING+SINGLE';
  return isKingSingle ? 3 : 2;
}

export const DEFAULT_TRAINING_TYPES = [
  { id: 'MAX_60', name: 'MAX 60', priceKRW: 80000, priceUSD: 60, isActive: true, isSelfTraining: false },
  { id: 'MAX_90', name: 'MAX 90', priceKRW: 120000, priceUSD: 80, isActive: true, isSelfTraining: false },
  { id: 'MAX_130', name: 'MAX 130', priceKRW: 150000, priceUSD: 100, isActive: true, isSelfTraining: false },
  { id: 'SELF_60', name: 'SELF 60', priceKRW: 50000, priceUSD: 30, isActive: true, isSelfTraining: true },
];

export const OPTION_PRICES_KRW = {
  TRANSFER: 10000,
  VIDEO_PER_DAY: 10000,
  HOPPING: 50000,
  FUN_DIVING: 30000,
};

export const OPTION_PRICES_USD = {
  TRANSFER: 10,
  VIDEO_PER_DAY: 10,
  HOPPING: 50,
  FUN_DIVING: 30,
};

/**
 * Admin-managed options catalog (Settings → 옵션 설정).
 * uiType: 'transfer' = airport pickup/dropoff checkboxes; 'count' = qty input.
 */
export const DEFAULT_OPTIONS_CATALOG = [
  {
    id: 'TRANSFER',
    nameKO: '공항 픽업/드롭오프',
    nameEN: 'Airport Transfer',
    priceKRW: OPTION_PRICES_KRW.TRANSFER,
    priceUSD: OPTION_PRICES_USD.TRANSFER,
    unitKO: '회',
    unitEN: 'x',
    isActive: true,
    uiType: 'transfer',
    guideKey: '',
  },
  {
    id: 'VIDEO',
    nameKO: '영상 촬영',
    nameEN: 'Video',
    priceKRW: OPTION_PRICES_KRW.VIDEO_PER_DAY,
    priceUSD: OPTION_PRICES_USD.VIDEO_PER_DAY,
    unitKO: '회',
    unitEN: 'x',
    isActive: true,
    uiType: 'count',
    guideKey: 'video',
  },
  {
    id: 'HOPPING',
    nameKO: '아일랜드 호핑',
    nameEN: 'Island Hopping',
    priceKRW: OPTION_PRICES_KRW.HOPPING,
    priceUSD: OPTION_PRICES_USD.HOPPING,
    unitKO: '회',
    unitEN: 'x',
    isActive: true,
    uiType: 'count',
    guideKey: 'hopping',
  },
  {
    id: 'FUN_DIVING',
    nameKO: '펀다이빙',
    nameEN: 'Fun Diving',
    priceKRW: OPTION_PRICES_KRW.FUN_DIVING,
    priceUSD: OPTION_PRICES_USD.FUN_DIVING,
    unitKO: '회',
    unitEN: 'x',
    isActive: true,
    uiType: 'count',
    guideKey: 'fundiving',
  },
];

/** @deprecated use DEFAULT_OPTIONS_CATALOG — kept for older imports */
export const DEFAULT_OPTION_PRICES = Object.fromEntries(
  DEFAULT_OPTIONS_CATALOG.map((o) => [
    o.id === 'VIDEO' ? 'VIDEO_PER_DAY' : o.id,
    {
      id: o.id === 'VIDEO' ? 'VIDEO_PER_DAY' : o.id,
      nameKO: o.nameKO,
      nameEN: o.nameEN,
      krw: o.priceKRW,
      usd: o.priceUSD,
      unitKO: o.unitKO,
      unitEN: o.unitEN,
    },
  ]),
);

function normalizeOptionRow(row = {}, fallback = {}) {
  const id = String(row.id || fallback.id || `OPT_${Date.now()}`).trim();
  const uiType =
    row.uiType === 'transfer' || id === 'TRANSFER' ? 'transfer' : 'count';
  return {
    id,
    nameKO: row.nameKO || row.name || fallback.nameKO || id,
    nameEN: row.nameEN || row.name || fallback.nameEN || id,
    priceKRW: Number(row.priceKRW ?? row.krw ?? fallback.priceKRW) || 0,
    priceUSD: Number(row.priceUSD ?? row.usd ?? fallback.priceUSD) || 0,
    unitKO: row.unitKO || fallback.unitKO || '회',
    unitEN: row.unitEN || fallback.unitEN || 'x',
    isActive: row.isActive !== false,
    uiType,
    guideKey: row.guideKey || fallback.guideKey || '',
  };
}

/** Accepts array catalog or legacy object map. */
export function resolveOptionsCatalog(config) {
  if (Array.isArray(config) && config.length) {
    return config.map((row) => normalizeOptionRow(row));
  }
  if (config && typeof config === 'object' && !Array.isArray(config)) {
    const fromLegacy = DEFAULT_OPTIONS_CATALOG.map((def) => {
      const legacyKey = def.id === 'VIDEO' ? 'VIDEO_PER_DAY' : def.id;
      const row = config[def.id] || config[legacyKey] || {};
      return normalizeOptionRow(
        {
          ...def,
          priceKRW: row.krw ?? row.priceKRW ?? def.priceKRW,
          priceUSD: row.usd ?? row.priceUSD ?? def.priceUSD,
          nameKO: row.nameKO || def.nameKO,
          nameEN: row.nameEN || def.nameEN,
        },
        def,
      );
    });
    return fromLegacy;
  }
  return DEFAULT_OPTIONS_CATALOG.map((o) => ({ ...o }));
}

/** Map for transfer/legacy lookups: TRANSFER, VIDEO, VIDEO_PER_DAY, … */
export function resolveOptionPrices(config) {
  const catalog = resolveOptionsCatalog(config);
  const out = {};
  for (const o of catalog) {
    const entry = {
      id: o.id,
      nameKO: o.nameKO,
      nameEN: o.nameEN,
      krw: o.priceKRW,
      usd: o.priceUSD,
      unitKO: o.unitKO,
      unitEN: o.unitEN,
      isActive: o.isActive,
      uiType: o.uiType,
      guideKey: o.guideKey,
    };
    out[o.id] = entry;
    if (o.id === 'VIDEO') out.VIDEO_PER_DAY = { ...entry, id: 'VIDEO_PER_DAY' };
  }
  for (const def of DEFAULT_OPTIONS_CATALOG) {
    if (!out[def.id]) {
      out[def.id] = {
        id: def.id,
        nameKO: def.nameKO,
        nameEN: def.nameEN,
        krw: def.priceKRW,
        usd: def.priceUSD,
        unitKO: def.unitKO,
        unitEN: def.unitEN,
        isActive: def.isActive,
        uiType: def.uiType,
        guideKey: def.guideKey,
      };
    }
  }
  if (out.VIDEO && !out.VIDEO_PER_DAY) {
    out.VIDEO_PER_DAY = { ...out.VIDEO, id: 'VIDEO_PER_DAY' };
  }
  return out;
}

export function getGuestOptionQty(guest, optionId) {
  if (!guest) return 0;
  const counts = guest.optionCounts || {};
  if (counts[optionId] != null) return Math.max(0, Number(counts[optionId]) || 0);
  if (optionId === 'VIDEO' || optionId === 'VIDEO_PER_DAY') {
    if (Number(guest.videoCount) > 0) return Number(guest.videoCount);
    return guest.needsVideo ? 1 : 0;
  }
  if (optionId === 'HOPPING') return Math.max(0, Number(guest.islandHopping) || 0);
  if (optionId === 'FUN_DIVING') return Math.max(0, Number(guest.funDiving) || 0);
  return 0;
}

export const DIVER_LEVELS = ['LEVEL_1', 'LEVEL_2', 'LEVEL_3', 'LEVEL_4', 'INSTRUCTOR'];

/** Freediving disciplines selectable in booking step 2 */
export const DISCIPLINES = ['CWT', 'CWTB', 'FIM', 'CNF'];

/** Booker grade asked on booking step 1 */
export const BOOKER_GRADES = [
  { id: 'NON_DIVER', ko: '비다이버(처음)', en: 'Non-diver (first time)' },
  { id: 'LEVEL_DIVER', ko: '레벨 다이버(1-4)', en: 'Level diver (1–4)' },
  { id: 'INSTRUCTOR', ko: '강사', en: 'Instructor' },
  { id: 'TRAINER', ko: '트레이너', en: 'Trainer' },
  { id: 'OTHER', ko: '기타', en: 'Other' },
];

/** 24h clock, 1-hour steps only (HH:00) */
export const HOUR_OPTIONS = Array.from({ length: 24 }, (_, h) => {
  const hh = String(h).padStart(2, '0');
  return `${hh}:00`;
});

export function normalizeHourTime(value, fallback = '14:00') {
  if (!value || typeof value !== 'string') return fallback;
  const hour = Number(value.split(':')[0]);
  if (!Number.isFinite(hour) || hour < 0 || hour > 23) return fallback;
  return `${String(hour).padStart(2, '0')}:00`;
}

export const EMPTY_TRAINING_COUNTS = {
  MAX_60: 0,
  MAX_90: 0,
  MAX_130: 0,
  SELF_60: 0,
};

export const EMPTY_TRAINING_DISCOUNTS = {
  MAX_60: 0,
  MAX_90: 0,
  MAX_130: 0,
  SELF_60: 0,
};

export function createEmptyGuest() {
  return {
    name: '',
    nationality: '',
    level: 'LEVEL_1',
    startDate: '',
    endDate: '',
    checkInTime: '',
    checkOutTime: '',
    dawnCheckIn: false,
    lateCheckOut: false,
    // restDays = training absences (불참 횟수), NOT lodging rest nights
    restDays: 0,
    // trainingCounts independent of stay dates / billedNights
    trainingCounts: { ...EMPTY_TRAINING_COUNTS },
    trainingDiscounts: { ...EMPTY_TRAINING_DISCOUNTS },
    optionCounts: {},
    discipline: 'CWT',
    targetDepth: '',
    safetyInstructor: '',
    agreeSelf60: false,
    needsVideo: false,
    videoCount: 0,
    airportPickup: false,
    pickupFlight: '',
    pickupTime: '00:00',
    airportDropoff: false,
    dropoffFlight: '',
    dropoffTime: '00:00',
    islandHopping: 0,
    funDiving: 0,
    penaltyFee: 0,
    assignedLine: '',
    assignedVehicle: '',
    assignedDriver: '',
    roomDiscount: 0,
    trainingDiscount: 0,
    optionsDiscount: 0,
    customTotalKRW: 0,
    adminMemo: '',
    cancelStatus: '',
    cancelIsNew: false,
    isNew: true,
  };
}

/** Copy diver details for “same schedule” — keeps target name (or blank). */
export function copyGuestDetailsFrom(source, { name = '' } = {}) {
  const base = createEmptyGuest();
  if (!source) return { ...base, name };
  const cloned = structuredClone(source);
  return {
    ...base,
    ...cloned,
    name: name || '',
    assignedLine: '',
    assignedVehicle: '',
    assignedDriver: '',
    roomDiscount: 0,
    trainingDiscount: 0,
    optionsDiscount: 0,
    customTotalKRW: 0,
    adminMemo: '',
    cancelStatus: '',
    cancelIsNew: false,
    isNew: true,
    trainingCounts: {
      ...EMPTY_TRAINING_COUNTS,
      ...(cloned.trainingCounts || {}),
    },
    trainingDiscounts: {
      ...EMPTY_TRAINING_DISCOUNTS,
      ...(cloned.trainingDiscounts || {}),
    },
    optionCounts: { ...(cloned.optionCounts || {}) },
  };
}

export const STORAGE_KEYS = {
  lastBookingInstructor: 'dk_last_booking_instructor',
  lastAdminUsername: 'dk_last_admin_username',
  /** Admin/instructor portal: remember username + PIN (same browser). */
  adminRemember: 'dk_admin_remember',
  adminPin: 'dk_admin_pin',
  /** My page: remember login email + PIN (same browser/origin). */
  myRemember: 'dk_my_remember',
  myEmail: 'dk_my_email',
  myPin: 'dk_my_pin',
  /** Guest email-gate on home (name + email). */
  guestGateRemember: 'dk_guest_gate_remember',
  guestGateEmail: 'dk_guest_gate_email',
  guestGateName: 'dk_guest_gate_name',
};

export const DEFAULT_GROUP_PIN = '1111';

/** Live input filter: strip Hangul/symbols, keep spaces while typing. */
export function filterPassportEnglishInput(value) {
  return String(value || '')
    .replace(/[^a-zA-Z\s]/g, '')
    .toUpperCase();
}

/** Normalized passport English name (letters + single spaces). */
export function toPassportEnglishName(value) {
  return filterPassportEnglishInput(value).replace(/\s+/g, ' ').trim();
}

export function createEmptyRoom(id = 1) {
  return {
    id,
    roomType: '',
    guestCount: 1,
    guests: [createEmptyGuest()],
  };
}

/** @deprecated use SUPER_ADMIN_EMAIL from adminRoles — kept for settingsRepo import. */
export const BOOTSTRAP_ADMINS = {
  adminId1: 'doublek777@gmail.com',
  adminPassword1: '7777',
  adminId2: 'admin2',
  adminPassword2: '9999',
  adminsConfig: [],
};

const WEAK_PINS = new Set([
  '0000',
  '1111',
  '2222',
  '3333',
  '4444',
  '5555',
  '6666',
  '7777',
  '8888',
  '9999',
  '1234',
  '4321',
  '0123',
  '9876',
]);

function randomInt(max) {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0] % max;
  }
  return Math.floor(Math.random() * max);
}

/** Random 4-digit PIN (avoids trivial sequences). */
export function generateFourDigitPin() {
  for (let i = 0; i < 40; i += 1) {
    const pin = String(randomInt(10000)).padStart(4, '0');
    if (!WEAK_PINS.has(pin)) return pin;
  }
  return String(1000 + randomInt(9000));
}

/**
 * Random login id, e.g. dk-a7f3k2.
 * @param {string} [prefix]
 * @param {string[]} [exclude]
 */
export function generateLoginId(prefix = 'dk', exclude = []) {
  const alphabet = 'abcdefghijkmnpqrstuvwxyz23456789';
  const blocked = new Set(
    (exclude || []).map((x) => String(x || '').trim().toLowerCase()),
  );
  for (let attempt = 0; attempt < 30; attempt += 1) {
    let suffix = '';
    for (let i = 0; i < 6; i += 1) {
      suffix += alphabet[randomInt(alphabet.length)];
    }
    const id = `${prefix}-${suffix}`;
    if (!blocked.has(id.toLowerCase())) return id;
  }
  return `${prefix}-${Date.now().toString(36).slice(-6)}`;
}

export const DEFAULT_UNITS = [
  { id: 'u1', nameKO: '트라이마란', nameEN: 'Trimaran', lines: 4, isActive: true },
  { id: 'u2', nameKO: '방카', nameEN: 'Banca', lines: 4, isActive: true },
  { id: 'u3', nameKO: '카타마란', nameEN: 'Catamaran', lines: 4, isActive: true },
];

export const DEFAULT_VEHICLES = [
  { id: 'v1', nameKO: '스타렉스 1호', nameEN: 'Starex #1', capacity: 10, isActive: true },
  { id: 'v2', nameKO: '스타렉스 2호', nameEN: 'Starex #2', capacity: 10, isActive: true },
];

export const DEFAULT_DRIVERS = [
  { id: 'd1', name: 'Ramel', phone: 'N/A', isActive: true },
];

export const DEFAULT_ACCOUNTS = [
  { id: 'acc1', name: 'IDA bank', isActive: true },
  { id: 'acc2', name: 'IDA Wise', isActive: true },
  { id: 'acc3', name: 'IDA 현장', isActive: true },
  { id: 'acc4', name: 'CASABLUE', isActive: true },
  { id: 'acc5', name: 'OTHER', isActive: true },
];

/** Admin-created escort / promo codes applied to training on step 3. */
export const DEFAULT_PROMO_CODES = [];

export function resolvePromoCodesConfig(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((p) => p && String(p.code || '').trim())
    .map((p, i) => {
      let trainingScope = 'ALL';
      if (p.trainingScope === 'ALL' || p.trainingScope == null) {
        trainingScope = 'ALL';
      } else if (Array.isArray(p.trainingScope)) {
        trainingScope = p.trainingScope.map(String).filter(Boolean);
        if (!trainingScope.length) trainingScope = 'ALL';
      } else if (p.trainingScope === 'SELECTED' && Array.isArray(p.scopeIds)) {
        trainingScope = p.scopeIds.map(String).filter(Boolean);
        if (!trainingScope.length) trainingScope = 'ALL';
      }
      return {
        id: p.id || `PROMO_${i}_${String(p.code || '').trim().toUpperCase()}`,
        code: String(p.code || '')
          .trim()
          .toUpperCase(),
        nameKO: p.nameKO || p.name || p.code || '',
        nameEN: p.nameEN || p.nameKO || p.name || p.code || '',
        isActive: p.isActive !== false,
        discountType: p.discountType === 'amount' ? 'amount' : 'percent',
        discountValue: Number(p.discountValue) || 0,
        discountUSD: Number(p.discountUSD) || 0,
        trainingScope,
      };
    });
}

export function resolvePromoCode(promoCodes, code) {
  const needle = String(code || '')
    .trim()
    .toUpperCase();
  if (!needle) return null;
  const list = Array.isArray(promoCodes) ? promoCodes : [];
  return (
    list.find(
      (p) =>
        p &&
        p.isActive !== false &&
        String(p.code || '')
          .trim()
          .toUpperCase() === needle,
    ) || null
  );
}

export const HOTEL_INFO = {
  name: 'Hotel Casablu',
  address: '267 Pajac-Maribago Rd, Maribago, Lapu-Lapu, 6015 Cebu',
  tel: '+63 32 407 7247',
};
