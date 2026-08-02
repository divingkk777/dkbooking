import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  doc,
} from 'firebase/firestore';
import { COLLECTIONS, db } from '../lib/firebase';

export function subscribeLogs(onData, onError) {
  const q = query(
    collection(db, COLLECTIONS.logs),
    orderBy('createdAt', 'desc'),
  );
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    },
    onError,
  );
}

export async function addAdminLog({ type, message }) {
  await addDoc(collection(db, COLLECTIONS.logs), {
    type,
    message,
    isRead: false,
    createdAt: new Date().toISOString(),
  });
}

export async function markLogRead(id) {
  await updateDoc(doc(db, COLLECTIONS.logs, id), { isRead: true });
}

export async function setLogRead(id, isRead) {
  await updateDoc(doc(db, COLLECTIONS.logs, id), { isRead: !!isRead });
}

/** Normalize log into filter categories for the admin alert UI. */
export function resolveLogCategory(log) {
  const type = String(log?.type || '').toUpperCase();
  const msg = String(log?.message || '');
  if (type === 'NEW' || /신규\s*예약|\[NEW\]|신규 예약/.test(msg)) {
    return 'NEW';
  }
  if (
    type === 'DELETE' ||
    /취소|휴지통|삭제|DELETE|Cancel/i.test(msg)
  ) {
    return 'CANCEL';
  }
  if (/프로모션|promo/i.test(msg)) return 'PROMO';
  if (/메일|email|승인메일/i.test(msg)) return 'MAIL';
  if (type === 'EDIT' || /수정|EDIT/i.test(msg)) return 'EDIT';
  return 'OTHER';
}

export const LOG_CATEGORY_META = {
  ALL: { ko: '전체', en: 'All' },
  NEW: { ko: '신규예약', en: 'New booking' },
  CANCEL: { ko: '취소', en: 'Cancellation' },
  EDIT: { ko: '수정', en: 'Edits' },
  MAIL: { ko: '메일', en: 'Email' },
  PROMO: { ko: '프로모션', en: 'Promo' },
  OTHER: { ko: '기타', en: 'Other' },
};
