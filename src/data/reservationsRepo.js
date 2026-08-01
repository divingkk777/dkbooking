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
