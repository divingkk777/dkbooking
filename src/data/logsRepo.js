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
