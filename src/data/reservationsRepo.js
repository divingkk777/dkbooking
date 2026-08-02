import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { COLLECTIONS, db } from '../lib/firebase';

export function subscribeReservations(onData, onError) {
  return onSnapshot(
    collection(db, COLLECTIONS.reservations),
    (snap) => {
      onData(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    },
    onError,
  );
}

export function subscribeTrashed(onData, onError) {
  const q = query(
    collection(db, COLLECTIONS.trashed),
    orderBy('trashedAt', 'desc'),
  );
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    },
    onError,
  );
}

function matchesGuestLogin(res, email, pin) {
  const e = String(email || '')
    .trim()
    .toLowerCase();
  const p = String(pin || '').trim();
  if (!e || !/^\d{4}$/.test(p)) return false;
  const login = String(res.bookingInstructor || res.repEmail || '')
    .trim()
    .toLowerCase();
  return login === e && String(res.groupPin || '') === p;
}

function sortGuestReservations(list) {
  return [...list].sort((a, b) =>
    String(b.submittedAt || '').localeCompare(String(a.submittedAt || '')),
  );
}

/** Guest My lookup: email (= bookingInstructor / repEmail) + 4-digit PIN */
export async function findReservationsByGuestLogin(email, pin) {
  const snap = await getDocs(collection(db, COLLECTIONS.reservations));
  return sortGuestReservations(
    snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((r) => matchesGuestLogin(r, email, pin)),
  );
}

/** One-shot trash lookup for My login (same email + PIN). */
export async function findTrashedByGuestLogin(email, pin) {
  const snap = await getDocs(collection(db, COLLECTIONS.trashed));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((r) => matchesGuestLogin(r, email, pin))
    .sort((a, b) =>
      String(b.trashedAt || '').localeCompare(String(a.trashedAt || '')),
    );
}

/**
 * Live sync for My page: when admin moves a booking to trash (deleted from
 * reservations), it disappears here automatically.
 */
export function subscribeReservationsByGuestLogin(email, pin, onData, onError) {
  const e = String(email || '')
    .trim()
    .toLowerCase();
  const p = String(pin || '').trim();
  if (!e || !/^\d{4}$/.test(p)) {
    onData([]);
    return () => {};
  }
  return onSnapshot(
    collection(db, COLLECTIONS.reservations),
    (snap) => {
      onData(
        sortGuestReservations(
          snap.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .filter((r) => matchesGuestLogin(r, e, p)),
        ),
      );
    },
    onError,
  );
}

/** Guest My trash: deleted bookings for this email + PIN (30-day retention). */
export function subscribeTrashedByGuestLogin(email, pin, onData, onError) {
  const e = String(email || '')
    .trim()
    .toLowerCase();
  const p = String(pin || '').trim();
  if (!e || !/^\d{4}$/.test(p)) {
    onData([]);
    return () => {};
  }
  const q = query(
    collection(db, COLLECTIONS.trashed),
    orderBy('trashedAt', 'desc'),
  );
  return onSnapshot(
    q,
    (snap) => {
      onData(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((r) => matchesGuestLogin(r, e, p)),
      );
    },
    onError,
  );
}

export async function createReservation(payload) {
  return addDoc(collection(db, COLLECTIONS.reservations), payload);
}

export async function updateReservation(id, partial) {
  await updateDoc(doc(db, COLLECTIONS.reservations, id), partial);
}

export async function moveToTrash(reservation) {
  const { id, ...data } = reservation;
  await addDoc(collection(db, COLLECTIONS.trashed), {
    ...data,
    originalResId: id,
    trashedAt: new Date().toISOString(),
  });
  await deleteDoc(doc(db, COLLECTIONS.reservations, id));
}

/**
 * Records a lightweight, restorable stub for a single cancelled guest
 * (as opposed to trashing the whole booking). Restoring it recreates a
 * standalone one-guest reservation via restoreFromTrash.
 */
export async function trashGuestStub(reservation, guestSnapshot, roomType) {
  await addDoc(collection(db, COLLECTIONS.trashed), {
    bookingInstructor: reservation.bookingInstructor || '',
    repName: reservation.repName || '',
    repEmail: reservation.repEmail || '',
    groupPin: reservation.groupPin || '',
    roomCount: 1,
    roomsData: [
      {
        id: 1,
        roomType: roomType || 'NONE',
        guestCount: 1,
        guests: [guestSnapshot],
      },
    ],
    grandTotalKRW: guestSnapshot?.individualTotalKRW || 0,
    grandTotalUSD: guestSnapshot?.individualTotalUSD || 0,
    originalResId: `${reservation.id}_guest_${Date.now()}`,
    trashedAt: new Date().toISOString(),
  });
}

export async function restoreFromTrash(trashedItem) {
  const { id, originalResId, trashedAt, ...data } = trashedItem;
  const targetId = originalResId || id;
  await setDoc(doc(db, COLLECTIONS.reservations, targetId), data);
  await deleteDoc(doc(db, COLLECTIONS.trashed, id));
}

export async function emptyTrash() {
  const snap = await getDocs(collection(db, COLLECTIONS.trashed));
  if (snap.empty) return 0;
  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
  return snap.size;
}

/** Permanently delete trash items older than `days` (default 30). */
export async function purgeExpiredTrash(days = 30) {
  const snap = await getDocs(collection(db, COLLECTIONS.trashed));
  if (snap.empty) return 0;
  const cutoff = Date.now() - Math.max(1, days) * 86400000;
  const expired = snap.docs.filter((d) => {
    const at = new Date(d.data()?.trashedAt || 0).getTime();
    return !Number.isNaN(at) && at < cutoff;
  });
  if (!expired.length) return 0;
  // Firestore batch max 500
  for (let i = 0; i < expired.length; i += 450) {
    const chunk = expired.slice(i, i + 450);
    const batch = writeBatch(db);
    chunk.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
  return expired.length;
}
