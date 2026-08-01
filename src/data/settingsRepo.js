import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import {
  BOOTSTRAP_ADMINS,
  DEFAULT_ACCOUNTS,
  DEFAULT_DRIVERS,
  DEFAULT_EXCHANGE_RATE,
  DEFAULT_ROOM_TYPES,
  DEFAULT_TRAINING_TYPES,
  DEFAULT_UNITS,
  DEFAULT_VEHICLES,
} from '../domain/defaults';
import { COLLECTIONS, SETTINGS_DOC, db } from '../lib/firebase';

function normalizeSettings(data = {}) {
  return {
    exchangeRate: Number(data.exchangeRate) || DEFAULT_EXCHANGE_RATE,
    roomTypesConfig: Array.isArray(data.roomTypesConfig)
      ? data.roomTypesConfig
      : DEFAULT_ROOM_TYPES,
    trainingTypesConfig: Array.isArray(data.trainingTypesConfig)
      ? data.trainingTypesConfig
      : DEFAULT_TRAINING_TYPES,
    unitsConfig:
      Array.isArray(data.unitsConfig) && data.unitsConfig.length
        ? data.unitsConfig
        : DEFAULT_UNITS,
    vehiclesConfig:
      Array.isArray(data.vehiclesConfig) && data.vehiclesConfig.length
        ? data.vehiclesConfig
        : DEFAULT_VEHICLES,
    driversConfig:
      Array.isArray(data.driversConfig) && data.driversConfig.length
        ? data.driversConfig
        : DEFAULT_DRIVERS,
    safetyInstructorsConfig: Array.isArray(data.safetyInstructorsConfig)
      ? data.safetyInstructorsConfig
      : [],
    accountsConfig:
      Array.isArray(data.accountsConfig) && data.accountsConfig.length
        ? data.accountsConfig
        : DEFAULT_ACCOUNTS,
    adsConfig: Array.isArray(data.adsConfig) ? data.adsConfig : [],
    adminId1: data.adminId1 || BOOTSTRAP_ADMINS.adminId1,
    adminPassword1: data.adminPassword1 || BOOTSTRAP_ADMINS.adminPassword1,
    adminId2: data.adminId2 || BOOTSTRAP_ADMINS.adminId2,
    adminPassword2: data.adminPassword2 || BOOTSTRAP_ADMINS.adminPassword2,
  };
}

export function subscribeSettings(onData, onError) {
  const ref = doc(db, COLLECTIONS.settings, SETTINGS_DOC);
  return onSnapshot(
    ref,
    (snap) => {
      onData(normalizeSettings(snap.exists() ? snap.data() : {}));
    },
    onError,
  );
}

export async function patchSettings(partial) {
  const ref = doc(db, COLLECTIONS.settings, SETTINGS_DOC);
  await setDoc(ref, partial, { merge: true });
}
