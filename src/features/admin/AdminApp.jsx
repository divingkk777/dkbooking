import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  emptyTrash,
  moveToTrash,
  purgeExpiredTrash,
  restoreFromTrash,
  subscribeReservations,
  subscribeTrashed,
  trashGuestStub,
  updateReservation,
} from '../../data/reservationsRepo';
import {
  addAdminLog,
  archiveOverflowLogs,
  setLogRead,
  markLogsReadByIds,
  subscribeLogs,
} from '../../data/logsRepo';
import BrandLockup from '../../components/BrandLockup';
import { patchSettings } from '../../data/settingsRepo';
import {
  ADMIN_ROLES,
  canAccessSettings,
  findGeneralAdmin,
  isInstructorRole,
  isStaffAdmin,
  isSuperAdmin,
  isSuperAdminIdentity,
  SUPER_ADMIN_EMAIL,
} from '../../domain/adminRoles';
// canAccessSettings = staff (settings tab); admin-account manager stays super-only in SettingsTab
import { STORAGE_KEYS } from '../../domain/defaults';
import { toLocalISODate } from '../../domain/dateUtils';
import { removeGuestFromRooms } from '../../domain/listModel';
import { buildPricingExtras, processRoomsData } from '../../domain/pricing';
import { createTranslator } from '../../i18n/t';
import { useToast } from '../../ui/ToastContext';
import EditReservationModal from './EditReservationModal';
import QuoteModal from './QuoteModal';
import AdsTab from './tabs/AdsTab';
import DashboardTab from './tabs/DashboardTab';
import HotelTab from './tabs/HotelTab';
import LogsArchiveTab from './tabs/LogsArchiveTab';
import ManifestTab from './tabs/ManifestTab';
import ReservationList from './tabs/ReservationList';
import SchedulerTab from './tabs/SchedulerTab';
import SettingsTab from './tabs/SettingsTab';

const TABS = [
  { id: 'LIST', emoji: '📋', ko: '예약 목록', en: 'Reservations' },
  { id: 'MANIFEST', emoji: '🚤', ko: '승선 명부', en: 'Boat Manifest' },
  { id: 'TRANSPORT', emoji: '🚐', ko: '픽업/드랍', en: 'Pickup/Drop' },
  { id: 'HOTEL', emoji: '🏨', ko: '호텔 부킹', en: 'Hotel Booking' },
  { id: 'SCHEDULER', emoji: '🗓️', ko: '스케줄러', en: 'Scheduler' },
  { id: 'DASHBOARD', emoji: '📊', ko: '통계', en: 'Statistics' },
  { id: 'ADS', emoji: '📢', ko: '광고', en: 'Ads' },
  { id: 'LOGS', emoji: '📝', ko: '로그', en: 'Logs' },
  { id: 'ARCHIVE', emoji: '🗑️', ko: '휴지통', en: 'Trash' },
  { id: 'SETTINGS', emoji: '⚙️', ko: '설정', en: 'Settings' },
];

const TAB_IDS = new Set(TABS.map((x) => x.id));

function todayISO() {
  return toLocalISODate();
}

function parseAdminTab(raw) {
  const id = String(raw || '').toUpperCase();
  return TAB_IDS.has(id) ? id : 'LIST';
}

export default function AdminApp({ settings }) {
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [lang, setLang] = useState(
    () => localStorage.getItem('admin_lang') || 'KO',
  );
  const t = useMemo(() => createTranslator(lang), [lang]);
  const [rememberLogin, setRememberLogin] = useState(
    () => localStorage.getItem(STORAGE_KEYS.adminRemember) === '1',
  );
  const [username, setUsername] = useState(() => {
    if (localStorage.getItem(STORAGE_KEYS.adminRemember) === '1') {
      return localStorage.getItem(STORAGE_KEYS.lastAdminUsername) || '';
    }
    return '';
  });
  const [pin, setPin] = useState(() => {
    if (localStorage.getItem(STORAGE_KEYS.adminRemember) === '1') {
      return localStorage.getItem(STORAGE_KEYS.adminPin) || '';
    }
    return '';
  });
  const [actor, setActor] = useState(
    () => sessionStorage.getItem('dk_admin_actor') || '',
  );
  const [role, setRole] = useState(() => {
    const stored = sessionStorage.getItem('dk_admin_role') || '';
    const storedActor = sessionStorage.getItem('dk_admin_actor') || '';
    if (isSuperAdminIdentity(storedActor)) {
      return ADMIN_ROLES.SUPER_ADMIN;
    }
    if (stored === 'ADMIN_TIER1') return ADMIN_ROLES.ADMIN;
    if (stored === 'ADMIN') return ADMIN_ROLES.ADMIN;
    if (stored === 'SUPER_ADMIN') return ADMIN_ROLES.SUPER_ADMIN;
    return stored;
  });
  const tab = role ? parseAdminTab(searchParams.get('tab')) : 'LIST';
  const selectTab = (id, { replace = false } = {}) => {
    const next = parseAdminTab(id);
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        p.set('tab', next);
        return p;
      },
      { replace },
    );
  };
  const [reservations, setReservations] = useState([]);
  const [trashed, setTrashed] = useState([]);
  const [logs, setLogs] = useState([]);
  const [manifestDate, setManifestDate] = useState(todayISO);
  const [quoteTarget, setQuoteTarget] = useState(null);
  const [editTarget, setEditTarget] = useState(null);

  useEffect(() => {
    localStorage.setItem('admin_lang', lang);
  }, [lang]);

  useEffect(() => {
    // Always subscribe so instructor PIN login can match bookingInstructor+groupPin.
    const u1 = subscribeReservations(setReservations, (e) =>
      toast.error(e.message),
    );
    return () => u1();
  }, [toast]);

  useEffect(() => {
    if (!role) return undefined;
    const u2 = subscribeTrashed(setTrashed, (e) => toast.error(e.message));
    const u3 = subscribeLogs(setLogs, (e) => toast.error(e.message));
    return () => {
      u2();
      u3();
    };
  }, [role, toast]);

  useEffect(() => {
    if (!role) return;
    purgeExpiredTrash(30).catch(() => {
      /* best-effort auto-purge */
    });
    // Keep live logs ≤ 300; older bundles go to admin_logs_archive (not loaded).
    archiveOverflowLogs().catch(() => {
      /* best-effort */
    });
  }, [role]);

  const login = () => {
    const pw1 = String(settings.adminPassword1 || '');
    const u = username.trim();
    const persistRemember = () => {
      if (rememberLogin && u) {
        localStorage.setItem(STORAGE_KEYS.adminRemember, '1');
        localStorage.setItem(STORAGE_KEYS.lastAdminUsername, u);
        localStorage.setItem(STORAGE_KEYS.adminPin, String(pin || ''));
      } else {
        localStorage.removeItem(STORAGE_KEYS.adminRemember);
        localStorage.removeItem(STORAGE_KEYS.lastAdminUsername);
        localStorage.removeItem(STORAGE_KEYS.adminPin);
      }
    };
    const enter = (nextRole, labelKo, labelEn) => {
      persistRemember();
      setRole(nextRole);
      setActor(u);
      sessionStorage.setItem('dk_admin_role', nextRole);
      sessionStorage.setItem('dk_admin_actor', u);
      toast.success(t(labelKo, labelEn));
    };

    // Super admin: fixed email (or legacy admin1) + PIN from settings
    if (isSuperAdminIdentity(u) && String(pin) === pw1) {
      enter(
        ADMIN_ROLES.SUPER_ADMIN,
        '최고 관리자 로그인',
        'Super Admin Mode',
      );
      return;
    }

    const general = findGeneralAdmin(settings.adminsConfig, u, pin);
    if (general) {
      enter(ADMIN_ROLES.ADMIN, '관리자 로그인', 'Admin Mode');
      return;
    }

    // Legacy single admin2 slot (until migrated into adminsConfig)
    const id2 = String(settings.adminId2 || '').trim();
    const pw2 = String(settings.adminPassword2 || '');
    if (
      id2 &&
      u.toLowerCase() === id2.toLowerCase() &&
      String(pin) === pw2 &&
      id2.toLowerCase() !== SUPER_ADMIN_EMAIL.toLowerCase()
    ) {
      enter(ADMIN_ROLES.ADMIN, '관리자 로그인', 'Admin Mode');
      return;
    }

    const instructorHit = reservations.find(
      (r) =>
        (r.bookingInstructor || '').trim() === u &&
        String(r.groupPin || '') === pin,
    );
    if (instructorHit) {
      enter(
        ADMIN_ROLES.INSTRUCTOR,
        '강사/예약자 보기',
        'Holder View',
      );
      return;
    }
    toast.error(t('로그인 정보가 올바르지 않습니다.', 'Invalid credentials.'));
  };

  const logout = () => {
    setRole('');
    setActor('');
    sessionStorage.removeItem('dk_admin_role');
    sessionStorage.removeItem('dk_admin_actor');
  };

  const visibleReservations = useMemo(() => {
    if (isInstructorRole(role)) {
      return reservations.filter(
        (r) => (r.bookingInstructor || '').trim() === actor,
      );
    }
    return reservations;
  }, [reservations, role, actor]);

  useEffect(() => {
    if (!role) return;
    // Keep role aligned with super-admin identity (settings tab depends on this)
    if (
      isSuperAdminIdentity(actor) &&
      role !== ADMIN_ROLES.SUPER_ADMIN
    ) {
      setRole(ADMIN_ROLES.SUPER_ADMIN);
      sessionStorage.setItem('dk_admin_role', ADMIN_ROLES.SUPER_ADMIN);
      return;
    }
    if (!searchParams.get('tab')) {
      selectTab('LIST', { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only seed URL once per login
  }, [role, actor]);

  if (!role) {
    return (
      <div className="admin-shell">
        <div className="lang-switch">
          <button
            type="button"
            className={lang === 'KO' ? 'active btn-ghost' : 'btn-ghost'}
            onClick={() => setLang('KO')}
          >
            KOR
          </button>
          <button
            type="button"
            className={lang === 'EN' ? 'active btn-ghost' : 'btn-ghost'}
            onClick={() => setLang('EN')}
          >
            ENG
          </button>
        </div>
        <div className="card login-card">
          <h1>{t('강사 / 관리자 포털', 'Instructor / Admin Portal')}</h1>
          <p>
            {t(
              '아이디와 4자리 PIN으로 로그인하세요. (최고 관리자: doublek777@gmail.com)',
              'Sign in with ID and 4-digit PIN. (Super admin: doublek777@gmail.com)',
            )}
          </p>
          <div style={{ textAlign: 'left' }}>
            <label className="label-text">{t('아이디', 'Username')}</label>
            <input
              className="input-field"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
            <label className="label-text" style={{ marginTop: 12 }}>
              {t('PIN', 'PIN')}
            </label>
            <input
              className="input-field"
              inputMode="numeric"
              maxLength={4}
              value={pin}
              onChange={(e) =>
                setPin(e.target.value.replace(/\D/g, '').slice(0, 4))
              }
            />
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginTop: 12,
                fontSize: 13,
                color: '#4e5968',
                cursor: 'pointer',
                userSelect: 'none',
              }}
            >
              <input
                type="checkbox"
                checked={rememberLogin}
                onChange={(e) => {
                  const on = e.target.checked;
                  setRememberLogin(on);
                  if (!on) {
                    localStorage.removeItem(STORAGE_KEYS.adminRemember);
                    localStorage.removeItem(STORAGE_KEYS.lastAdminUsername);
                    localStorage.removeItem(STORAGE_KEYS.adminPin);
                  }
                }}
              />
              {t(
                '아이디·비밀번호 기억 (이 브라우저)',
                'Remember ID & PIN (this browser)',
              )}
            </label>
          </div>
          <button
            type="button"
            className="btn-primary"
            style={{ marginTop: 16 }}
            onClick={login}
          >
            {t('로그인', 'Login')}
          </button>
          <div style={{ marginTop: 12 }}>
            <Link to="/" className="btn-ghost">
              {t('게스트 예약으로', 'Guest booking')}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-shell">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 12,
          alignItems: 'center',
          marginBottom: 12,
        }}
      >
        <div>
          <strong>
            {isSuperAdmin(role, actor)
              ? t('최고 관리자 모드', 'Super Admin Mode')
              : isStaffAdmin(role)
                ? t('관리자 모드', 'Admin Mode')
                : `[${actor}] ${t('예약자 뷰', 'Holder View')}`}
          </strong>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div className="lang-switch">
            <button
              type="button"
              className={lang === 'KO' ? 'active btn-ghost' : 'btn-ghost'}
              onClick={() => setLang('KO')}
            >
              KOR
            </button>
            <button
              type="button"
              className={lang === 'EN' ? 'active btn-ghost' : 'btn-ghost'}
              onClick={() => setLang('EN')}
            >
              ENG
            </button>
          </div>
          <Link to="/" className="btn-secondary">
            {t('게스트', 'Guest')}
          </Link>
          <button type="button" className="btn-ghost" onClick={logout}>
            {t('로그아웃', 'Logout')}
          </button>
        </div>
      </div>

      <nav className="admin-nav">
        {TABS.filter((item) => {
          if (isInstructorRole(role)) {
            return ['LIST', 'MANIFEST', 'HOTEL'].includes(item.id);
          }
          // Settings dashboard: all staff admins (account manager is super-only inside tab)
          if (item.id === 'SETTINGS' && !canAccessSettings(role)) {
            return false;
          }
          return true;
        }).map((item) => {
          const isTrash = item.id === 'ARCHIVE';
          const trashCount = trashed?.length || 0;
          const classes = [
            tab === item.id ? 'active' : '',
            isTrash ? 'nav-trash' : '',
            isTrash && trashCount > 0 ? 'has-items' : '',
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <button
              key={item.id}
              type="button"
              className={classes}
              onClick={() => selectTab(item.id)}
            >
              {item.emoji} {t(item.ko, item.en)}
              {isTrash ? ` (${trashCount})` : ''}
            </button>
          );
        })}
      </nav>

      {tab === 'LIST' && (
        <ReservationList
          t={t}
          reservations={visibleReservations}
          role={role}
          settings={settings}
          lang={lang}
          onOpenQuote={setQuoteTarget}
          onOpenEdit={setEditTarget}
          onUpdateReservation={async (id, partial) => {
            await updateReservation(id, partial);
          }}
          onTrashReservation={async (res) => {
            try {
              await moveToTrash(res);
              toast.success(t('휴지통으로 이동', 'Moved to trash'));
            } catch (e) {
              toast.error(e.message);
            }
          }}
          onTrashGuest={async ({ reservation, roomIdx, guestIdx, guestName }) => {
            try {
              const guestSnapshot = reservation.roomsData?.[roomIdx]?.guests?.[guestIdx];
              const roomType = reservation.roomsData?.[roomIdx]?.roomType;
              const { rooms, empty } = removeGuestFromRooms(
                reservation.roomsData,
                roomIdx,
                guestIdx,
              );
              if (empty) {
                await moveToTrash(reservation);
              } else {
                const next = processRoomsData(
                  rooms,
                  settings.exchangeRate,
                  settings.roomTypesConfig,
                  settings.trainingTypesConfig,
                  settings.optionsCatalogConfig || settings.optionPricesConfig,
                  buildPricingExtras(settings, reservation.escortCode),
                );
                await updateReservation(reservation.id, {
                  roomsData: next.processedRooms,
                  grandTotalKRW: next.grandTotalKRW,
                  grandTotalUSD: next.grandTotalUSD,
                });
                if (guestSnapshot) {
                  await trashGuestStub(reservation, guestSnapshot, roomType);
                }
              }
              await addAdminLog({
                type: 'DELETE',
                actor,
                message: `[예약 취소] ${guestName || ''} 다이버의 예약이 휴지통으로 이동되었습니다.`,
              });
              toast.success(t('게스트가 취소되었습니다.', 'Guest cancelled.'));
            } catch (e) {
              toast.error(e.message);
            }
          }}
        />
      )}

      {(tab === 'MANIFEST' || tab === 'TRANSPORT') && (
        <ManifestTab
          t={t}
          lang={lang}
          mode={tab === 'TRANSPORT' ? 'transport' : 'boat'}
          reservations={visibleReservations}
          date={manifestDate}
          setDate={setManifestDate}
          role={role}
          settings={settings}
          onUpdateReservation={async (id, partial) => {
            await updateReservation(id, partial);
          }}
        />
      )}

      {tab === 'HOTEL' && (
        <HotelTab
          t={t}
          reservations={visibleReservations}
          role={role}
          onUpdateReservation={async (id, partial) => {
            await updateReservation(id, partial);
          }}
          onOpenQuote={setQuoteTarget}
          onOpenEdit={setEditTarget}
        />
      )}

      {tab === 'SCHEDULER' && (
        <SchedulerTab
          t={t}
          lang={lang}
          reservations={visibleReservations}
          onOpenQuote={setQuoteTarget}
        />
      )}

      {tab === 'DASHBOARD' && (
        <DashboardTab
          t={t}
          lang={lang}
          reservations={visibleReservations}
        />
      )}

      {tab === 'ADS' && isStaffAdmin(role) && (
        <AdsTab
          t={t}
          lang={lang}
          settings={settings}
          onPatchSettings={async (partial) => {
            await patchSettings(partial);
          }}
        />
      )}

      {(tab === 'LOGS' || tab === 'ARCHIVE') && (
        <LogsArchiveTab
          mode={tab}
          t={t}
          logs={logs}
          trashed={trashed}
          onToggleRead={async (id, isRead) => {
            await setLogRead(id, isRead);
          }}
          onMarkAllRead={async (ids) => {
            const n = await markLogsReadByIds(ids);
            toast.success(
              n
                ? t(`모두 읽음 처리 (${n})`, `Marked all read (${n})`)
                : t('읽을 알림이 없습니다', 'Nothing to mark'),
            );
          }}
          onRestore={async (item) => {
            await restoreFromTrash(item);
            toast.success(t('복구되었습니다', 'Restored'));
          }}
          onEmptyTrash={async () => {
            const n = await emptyTrash();
            toast.success(
              n
                ? t('휴지통을 비웠습니다', 'Trash emptied')
                : t('휴지통이 비어 있습니다', 'Trash already empty'),
            );
          }}
        />
      )}

      {tab === 'SETTINGS' && canAccessSettings(role) && (
        <SettingsTab
          t={t}
          settings={settings}
          role={
            isSuperAdmin(role, actor)
              ? ADMIN_ROLES.SUPER_ADMIN
              : ADMIN_ROLES.ADMIN
          }
          onPatchSettings={async (partial) => {
            await patchSettings(partial);
          }}
        />
      )}

      {quoteTarget && (
        <QuoteModal
          t={t}
          lang={lang}
          target={quoteTarget}
          reservations={reservations}
          settings={settings}
          onClose={() => setQuoteTarget(null)}
        />
      )}

      {editTarget && (
        <EditReservationModal
          t={t}
          lang={lang}
          reservation={editTarget}
          settings={settings}
          onClose={() => setEditTarget(null)}
          onSaved={() => setEditTarget(null)}
        />
      )}

      <footer className="site-brand-footer">
        <BrandLockup variant="footer" showTagline={false} />
      </footer>
    </div>
  );
}
