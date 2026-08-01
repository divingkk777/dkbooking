/** Local YYYY-MM-DD (never use toISOString for calendar days — UTC+9 breaks ±1). */
export function toLocalISODate(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseLocalISODate(dateStr) {
  const base = dateStr || toLocalISODate();
  const [y, m, d] = base.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function shiftDate(dateStr, delta) {
  const dt = parseLocalISODate(dateStr);
  dt.setDate(dt.getDate() + delta);
  return toLocalISODate(dt);
}
