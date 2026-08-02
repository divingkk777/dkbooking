export const DEFAULT_EXCHANGE_RATE = 1450;

export const DEFAULT_ROOM_TYPES = [
  { id: 'TWIN', nameKO: '트윈룸', nameEN: 'Twin Room', priceKRW: 60000, priceUSD: 42, isActive: true },
  { id: 'DELUXE', nameKO: '디럭스룸', nameEN: 'Deluxe Room', priceKRW: 80000, priceUSD: 55, isActive: true },
  { id: 'DELUXE_TWIN', nameKO: '디럭스 트윈', nameEN: 'Deluxe Twin', priceKRW: 90000, priceUSD: 62, isActive: true },
];

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

export const DIVER_LEVELS = ['LEVEL_1', 'LEVEL_2', 'LEVEL_3', 'LEVEL_4', 'INSTRUCTOR'];

/** Freediving disciplines selectable in booking step 2 */
export const DISCIPLINES = ['CWT', 'CWTB', 'FIM', 'CNF'];

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
    checkInTime: '14:00',
    checkOutTime: '11:00',
    dawnCheckIn: false,
    lateCheckOut: false,
    restDays: 0,
    trainingCounts: { ...EMPTY_TRAINING_COUNTS },
    trainingDiscounts: { ...EMPTY_TRAINING_DISCOUNTS },
    discipline: 'CWT',
    targetDepth: '',
    safetyInstructor: '',
    agreeSelf60: false,
    needsVideo: false,
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
  };
}

export const STORAGE_KEYS = {
  lastBookingInstructor: 'dk_last_booking_instructor',
  lastAdminUsername: 'dk_last_admin_username',
};

export const DEFAULT_GROUP_PIN = '1111';

export function createEmptyRoom(id = 1) {
  return {
    id,
    roomType: '',
    guestCount: 1,
    guests: [createEmptyGuest()],
  };
}

export const BOOTSTRAP_ADMINS = {
  adminId1: 'admin1',
  adminPassword1: '7777',
  adminId2: 'admin2',
  adminPassword2: '9999',
};

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
  { id: 'acc1', name: 'IDA', isActive: true },
  { id: 'acc2', name: 'CASABLUE', isActive: true },
  { id: 'acc3', name: 'CEBU', isActive: true },
];

export const HOTEL_INFO = {
  name: 'Hotel Casablu',
  address: '267 Pajac-Maribago Rd, Maribago, Lapu-Lapu, 6015 Cebu',
  tel: '+63 32 407 7247',
};
