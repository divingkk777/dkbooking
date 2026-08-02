import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { subscribeSettings } from '../data/settingsRepo';
import AdminApp from '../features/admin/AdminApp';
import GuestApp from '../features/guest/GuestApp';
import { ToastProvider } from '../ui/ToastContext';
import {
  BOOTSTRAP_ADMINS,
  DEFAULT_ACCOUNTS,
  DEFAULT_DRIVERS,
  DEFAULT_EXCHANGE_RATE,
  DEFAULT_OPTION_PRICES,
  DEFAULT_ROOM_TYPES,
  DEFAULT_TRAINING_TYPES,
  DEFAULT_UNITS,
  DEFAULT_VEHICLES,
  resolveOptionPrices,
} from '../domain/defaults';

const FALLBACK_SETTINGS = {
  exchangeRate: DEFAULT_EXCHANGE_RATE,
  optionPricesConfig: resolveOptionPrices(DEFAULT_OPTION_PRICES),
  roomTypesConfig: DEFAULT_ROOM_TYPES,
  trainingTypesConfig: DEFAULT_TRAINING_TYPES,
  unitsConfig: DEFAULT_UNITS,
  vehiclesConfig: DEFAULT_VEHICLES,
  driversConfig: DEFAULT_DRIVERS,
  safetyInstructorsConfig: [],
  accountsConfig: DEFAULT_ACCOUNTS,
  adsConfig: [],
  ...BOOTSTRAP_ADMINS,
};

/**
 * Headless-ready booking app shell.
 * Future platform plugins can mount this via sdk/mount.jsx.
 */
export function BookingApp({
  initialRoute,
  locale,
  features = {
    guestBooking: true,
    adminPortal: true,
  },
} = {}) {
  const [settings, setSettings] = useState(FALLBACK_SETTINGS);

  useEffect(() => {
    return subscribeSettings(setSettings, () => setSettings(FALLBACK_SETTINGS));
  }, []);

  useEffect(() => {
    if (locale === 'EN' || locale === 'KO') {
      localStorage.setItem('guest_lang', locale);
      localStorage.setItem('admin_lang', locale);
    }
  }, [locale]);

  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          {features.guestBooking !== false && (
            <Route path="/" element={<GuestApp settings={settings} />} />
          )}
          {features.adminPortal !== false && (
            <Route path="/admin" element={<AdminApp settings={settings} />} />
          )}
          <Route
            path="*"
            element={<Navigate to={initialRoute || '/'} replace />}
          />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}

export default BookingApp;
