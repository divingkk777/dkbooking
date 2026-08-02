/** Fixed super-admin login id (email). */
export const SUPER_ADMIN_EMAIL = 'doublek777@gmail.com';

export const ADMIN_ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  INSTRUCTOR: 'INSTRUCTOR',
};

export function normalizeRole(role) {
  const r = String(role || '')
    .toUpperCase()
    .trim();
  if (r === 'ADMIN_TIER1') return ADMIN_ROLES.ADMIN; // legacy session
  if (r === 'ADMIN' || r === 'SUPER_ADMIN' || r === 'INSTRUCTOR') return r;
  return r;
}

export function isSuperAdminIdentity(actor) {
  const a = String(actor || '')
    .trim()
    .toLowerCase();
  return (
    a === SUPER_ADMIN_EMAIL.toLowerCase() ||
    a === 'admin1' // legacy bootstrap id
  );
}

/** Highest admin — settings + admin creation. */
export function isSuperAdmin(role, actor) {
  if (normalizeRole(role) === ADMIN_ROLES.SUPER_ADMIN) return true;
  // Recover if session role was downgraded but login id is still super
  return isSuperAdminIdentity(actor);
}

/** Admin-account manager inside Settings (super only). */
export function canManageAdminAccounts(role, actor) {
  return isSuperAdmin(role, actor);
}

/** Settings dashboard tab — all staff admins. */
export function canAccessSettings(role) {
  return isStaffAdmin(role);
}

/** Super + general admin (not instructor). Same ops access; settings only for super. */
export function isStaffAdmin(role) {
  const r = normalizeRole(role);
  return r === ADMIN_ROLES.SUPER_ADMIN || r === ADMIN_ROLES.ADMIN;
}

export function isInstructorRole(role) {
  return normalizeRole(role) === ADMIN_ROLES.INSTRUCTOR;
}

export function resolveAdminsConfig(raw, legacy = {}) {
  const fromRaw = Array.isArray(raw)
    ? raw
        .map((row, idx) => {
          const username = String(row?.username || row?.id || '').trim();
          const pin = String(row?.pin || row?.password || '').trim();
          if (!username || !/^\d{4}$/.test(pin)) return null;
          if (username.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) {
            return null;
          }
          return {
            id: String(row?.id || `ADM_${idx}_${username}`),
            username,
            pin,
            isActive: row?.isActive !== false,
            createdAt: row?.createdAt || '',
          };
        })
        .filter(Boolean)
    : [];

  if (fromRaw.length) return fromRaw;

  const legacyUser = String(legacy.adminId2 || '').trim();
  const legacyPin = String(legacy.adminPassword2 || '').trim();
  if (
    legacyUser &&
    /^\d{4}$/.test(legacyPin) &&
    legacyUser.toLowerCase() !== SUPER_ADMIN_EMAIL.toLowerCase()
  ) {
    return [
      {
        id: 'legacy_admin2',
        username: legacyUser,
        pin: legacyPin,
        isActive: true,
        createdAt: '',
      },
    ];
  }
  return [];
}

export function findGeneralAdmin(adminsConfig, username, pin) {
  const u = String(username || '').trim().toLowerCase();
  const p = String(pin || '');
  return (adminsConfig || []).find(
    (row) =>
      row.isActive !== false &&
      String(row.username || '')
        .trim()
        .toLowerCase() === u &&
      String(row.pin || '') === p,
  );
}
