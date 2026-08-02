import {
  addDoc,
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  startAfter,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { COLLECTIONS, db } from '../lib/firebase';

/** Live log window shown in admin UI (newest first). */
export const LIVE_LOG_LIMIT = 300;
/** How many overflow rows to pack into one archive document. */
const ARCHIVE_CHUNK = 50;
/** Max archive rounds per run (50 * 20 = 1000 old rows). */
const ARCHIVE_MAX_ROUNDS = 20;

let archiveInFlight = null;

export function subscribeLogs(onData, onError) {
  const q = query(
    collection(db, COLLECTIONS.logs),
    orderBy('createdAt', 'desc'),
    limit(LIVE_LOG_LIMIT),
  );
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    },
    onError,
  );
}

export async function addAdminLog({ type, message, actor }) {
  await addDoc(collection(db, COLLECTIONS.logs), {
    type,
    message,
    actor: actor ? String(actor) : '',
    isRead: false,
    createdAt: new Date().toISOString(),
  });
  // Best-effort: keep live collection at ~300; do not block UI on archive.
  archiveOverflowLogs().catch((err) => {
    console.warn('log archive skipped', err);
  });
}

/**
 * If live logs exceed LIVE_LOG_LIMIT, move older ones into
 * admin_logs_archive as bundled docs (not subscribed / not loaded in UI).
 */
export async function archiveOverflowLogs() {
  if (archiveInFlight) return archiveInFlight;
  archiveInFlight = (async () => {
    const col = collection(db, COLLECTIONS.logs);
    const keepSnap = await getDocs(
      query(col, orderBy('createdAt', 'desc'), limit(LIVE_LOG_LIMIT)),
    );
    if (keepSnap.size < LIVE_LOG_LIMIT) return { archived: 0 };

    const oldestKept = keepSnap.docs[keepSnap.docs.length - 1];
    let archived = 0;

    for (let round = 0; round < ARCHIVE_MAX_ROUNDS; round += 1) {
      const oldSnap = await getDocs(
        query(
          col,
          orderBy('createdAt', 'desc'),
          startAfter(oldestKept),
          limit(ARCHIVE_CHUNK),
        ),
      );
      if (oldSnap.empty) break;

      // Store oldest→newest inside the bundle for readability
      const rows = oldSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .reverse();
      const from = rows[0]?.createdAt || '';
      const to = rows[rows.length - 1]?.createdAt || '';

      await addDoc(collection(db, COLLECTIONS.logsArchive), {
        kind: 'bundle',
        count: rows.length,
        from,
        to,
        archivedAt: new Date().toISOString(),
        logs: rows,
      });

      // Firestore batch max 500; chunk is 50
      const batch = writeBatch(db);
      oldSnap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
      archived += oldSnap.size;
    }

    return { archived };
  })().finally(() => {
    archiveInFlight = null;
  });

  return archiveInFlight;
}

export async function markLogRead(id) {
  await updateDoc(doc(db, COLLECTIONS.logs, id), { isRead: true });
}

export async function setLogRead(id, isRead) {
  await updateDoc(doc(db, COLLECTIONS.logs, id), { isRead: !!isRead });
}

/** Mark many live logs as read (Firestore batch max 500; live window ≤ 300). */
export async function markLogsReadByIds(ids) {
  const unique = [...new Set((ids || []).filter(Boolean))];
  if (!unique.length) return 0;
  const batch = writeBatch(db);
  unique.forEach((id) => {
    batch.update(doc(db, COLLECTIONS.logs, id), { isRead: true });
  });
  await batch.commit();
  return unique.length;
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
