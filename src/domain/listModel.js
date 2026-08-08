import { toLocalISODate } from './dateUtils';

export function bookingSeqMap(reservations) {
  return Object.fromEntries(
    [...(reservations || [])]
      .sort(
        (a, b) =>
          new Date(a.submittedAt || 0) - new Date(b.submittedAt || 0),
      )
      .map((res, i) => [res.id, String(i + 1).padStart(4, '0')]),
  );
}

export function rowKey(row) {
  return `${row.resId}_r${row.roomIdx}_g${row.guestIdx}`;
}

export function formatRoomTypeLabel(roomType) {
  if (!roomType || roomType === 'NONE') return '';
  if (roomType === 'TWIN') return 'TWIN(2 BEDS)';
  if (roomType === 'DELUXE') return 'DELUXE';
  if (roomType === 'DELUXE_TWIN') return 'DELUXE TWIN';
  return roomType;
}

/**
 * Training counts — fully independent of lodging/nights.
 *
 * - 신청(requested) = sum(trainingCounts)
 * - 실제(actual) = max(0, 신청 − restDays)  // Manifest 불참/차감
 * - 숙박(billedNights) = dates + early/late only (see computeBilledNights)
 *
 * Field `divingDays` (legacy/persisted) means requested training sessions only.
 * Never treat divingDays as lodging nights; never sync nights ↔ training.
 */
export function requestedTrainingCount(guest) {
  const counts = guest?.trainingCounts;
  if (counts && typeof counts === 'object') {
    const sum = Object.values(counts).reduce(
      (s, v) => s + (Number(v) || 0),
      0,
    );
    if (sum > 0) return sum;
  }
  // Legacy: divingDays stored as training session count (not nights)
  return Math.max(0, Number(guest?.divingDays) || 0);
}

export function actualTrainingCount(guest) {
  return Math.max(
    0,
    requestedTrainingCount(guest) - (Number(guest?.restDays) || 0),
  );
}

export function flattenGuestRows(reservations, { today } = {}) {
  const day = today || toLocalISODate();
  const seq = bookingSeqMap(reservations);
  const rows = [];

  (reservations || []).forEach((res) => {
    const rooms = res.roomsData || [];
    const groupTotalGuests = rooms.reduce(
      (sum, room) => sum + (room.guests || []).length,
      0,
    );

    rooms.forEach((room, roomIdx) => {
      const guests = room.guests || [];
      guests.forEach((guest, guestIdx) => {
        if (!guest) return;
        // Keep past bookings too for admin; filter only if endDate missing.
        if (guest.endDate && guest.endDate < day) {
          // still include — admin often needs full list; mark expired
        }
        const roomMates = guests
          .map((g, i) => (i === guestIdx ? null : g?.name))
          .filter(Boolean);

        rows.push({
          ...guest,
          resId: res.id,
          reservation: res,
          repName: res.repName || '',
          bookingInstructor: res.bookingInstructor || '',
          paymentStatus: res.paymentStatus || '대기',
          guestPaymentClaimed: !!res.guestPaymentClaimed,
          guestPaymentClaimedAt: res.guestPaymentClaimedAt || '',
          voucherStatus: res.voucherStatus || '미전달',
          assignedRoomNumbers: res.assignedRoomNumbers || '',
          hotelPaymentStatus: res.hotelPaymentStatus || '미정산',
          groupPin: res.groupPin || '',
          repEmail: res.repEmail || '',
          roomType: room.roomType || 'NONE',
          roomIdx,
          guestIdx,
          roomNumberInGroup: roomIdx + 1,
          roomMates,
          roomGuestCount: room.guestCount || guests.length,
          groupTotalGuests,
          submittedAt: res.submittedAt || '',
          isNew: guest.isNew !== false,
          bookingSeq: seq[res.id] || '0001',
        });
      });
    });
  });

  return rows.sort((a, b) => {
    const as = a.startDate || '';
    const bs = b.startDate || '';
    if (as !== bs) return as.localeCompare(bs);
    return String(a.bookingSeq).localeCompare(String(b.bookingSeq));
  });
}

export function isPaidStatus(paymentStatus, accounts = []) {
  if (!paymentStatus || paymentStatus === '대기') return false;
  // Any selected account name counts as paid — including renamed/legacy labels
  // so renaming an account in settings does not flip old rows back to unpaid.
  const paidNames = new Set([
    'IDA bank',
    'IDA Wise',
    'IDA 현장',
    'CASABLUE',
    'OTHER',
    'IDA',
    'CEBU',
    '카카오',
    'IDA BA',
    'IDA CEBU',
    ...accounts.map((a) => a?.name).filter(Boolean),
  ]);
  if (paidNames.has(paymentStatus)) return true;
  // Fallback: paymentStatus is set to an account name when confirming payment
  return String(paymentStatus).trim().length > 0;
}

export function unitLabel(assignedLine, lang = 'KO') {
  if (!assignedLine) return '';
  if (lang !== 'EN') return assignedLine;
  return String(assignedLine)
    .replace(/트라이마란/g, 'Trimaran')
    .replace(/방카/g, 'Banca')
    .replace(/카타마란/g, 'Catamaran')
    .replace(/미배정 유닛/g, 'Unassigned Unit');
}

export function patchGuestInRooms(roomsData, roomIdx, guestIdx, patch) {
  const rooms = structuredClone(roomsData || []);
  if (!rooms[roomIdx]?.guests?.[guestIdx]) return rooms;
  rooms[roomIdx].guests[guestIdx] = {
    ...rooms[roomIdx].guests[guestIdx],
    ...patch,
  };
  return rooms;
}

export function removeGuestFromRooms(roomsData, roomIdx, guestIdx) {
  const rooms = structuredClone(roomsData || []);
  if (!rooms[roomIdx]?.guests) return { rooms, empty: true };
  rooms[roomIdx].guests.splice(guestIdx, 1);
  if (rooms[roomIdx].guests.length === 0) {
    rooms.splice(roomIdx, 1);
  } else {
    rooms[roomIdx].guestCount = rooms[roomIdx].guests.length;
  }
  return { rooms, empty: rooms.length === 0 };
}
