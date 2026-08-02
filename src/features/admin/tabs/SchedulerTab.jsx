import { useMemo, useState } from 'react';
import { toLocalISODate } from '../../../domain/dateUtils';
import { bookingSeqMap, flattenGuestRows } from '../../../domain/listModel';

const BADGE_H = 22;
const BADGE_GAP = 3;

function colorFromId(id) {
  if (!id) return '#3182f6';
  let hash = 0;
  const s = String(id);
  for (let i = 0; i < s.length; i += 1) {
    hash = s.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hex = (hash & 0xffffff).toString(16).toUpperCase();
  return `#${`00000${hex}`.slice(-6)}`;
}

function guestKey(row) {
  return `${row.resId}_r${row.roomIdx}_g${row.guestIdx}`;
}

function badgeLabel(row) {
  const name = String(row.name || '')
    .trim()
    .toUpperCase();
  const seq = row.bookingSeq || '0001';
  const extras = [];
  if ((Number(row.funDiving) || 0) > 0) extras.push('PAX SCUBA');
  if ((Number(row.islandHopping) || 0) > 0) extras.push('PAX HOPPING');
  const suffix = extras.length ? ` ${extras.join(' ')}` : '';
  return `[${seq}] ${name}${suffix}`;
}

/** Assign stable horizontal lanes so each guest stays on one row across dates. */
function assignLanes(guests) {
  const sorted = [...guests].sort((a, b) => {
    const as = a.startDate || '';
    const bs = b.startDate || '';
    if (as !== bs) return as.localeCompare(bs);
    const ae = a.endDate || '';
    const be = b.endDate || '';
    if (ae !== be) return ae.localeCompare(be);
    return String(a.bookingSeq || '').localeCompare(String(b.bookingSeq || ''));
  });

  const lanes = new Map();
  const laneEndDates = [];

  sorted.forEach((g) => {
    const key = guestKey(g);
    const start = g.startDate || '';
    const end = g.endDate || start;
    let lane = laneEndDates.findIndex((endDate) => !endDate || endDate < start);
    if (lane < 0) {
      lane = laneEndDates.length;
      laneEndDates.push(end);
    } else {
      laneEndDates[lane] = end;
    }
    lanes.set(key, lane);
  });

  return { lanes, laneCount: laneEndDates.length };
}

function MonthCalendar({
  year,
  month,
  guests,
  today,
  t,
  lang = 'KO',
  onOpenGuest,
}) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startWeekday = new Date(year, month, 1).getDay();
  const monthStart = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const monthEnd = `${year}-${String(month + 1).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

  const monthGuests = useMemo(
    () =>
      guests.filter(
        (g) =>
          g.startDate &&
          g.endDate &&
          g.startDate <= monthEnd &&
          g.endDate >= monthStart,
      ),
    [guests, monthStart, monthEnd],
  );

  const { lanes, laneCount } = useMemo(
    () => assignLanes(monthGuests),
    [monthGuests],
  );

  const cells = [];
  for (let i = 0; i < startWeekday; i += 1) {
    cells.push({ isBlank: true, key: `blank-${year}-${month}-${i}` });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    cells.push({ isBlank: false, day, dateStr, key: dateStr });
  }

  const trackH =
    laneCount > 0
      ? laneCount * BADGE_H + Math.max(0, laneCount - 1) * BADGE_GAP
      : 0;

  return (
    <div className="talk-calendar" style={{ marginBottom: 28 }}>
      <div
        style={{
          padding: '14px 20px',
          fontWeight: 800,
          fontSize: 18,
          backgroundColor: '#f9fafb',
          borderRadius: '16px 16px 0 0',
        }}
      >
        📅 {year}
        {t('년 ', '. ')}
        {month + 1}
        {t('월', '')}
      </div>
      <div className="talk-cal-weekdays">
        {(lang === 'EN'
          ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
          : ['일', '월', '화', '수', '목', '금', '토']
        ).map((d) => (
          <div key={d} className="talk-cal-weekday">
            {d}
          </div>
        ))}
      </div>
      <div className="talk-cal-grid">
        {cells.map((cell) => {
          if (cell.isBlank) {
            return <div key={cell.key} className="talk-cal-cell-blank" />;
          }

          const dayGuests = monthGuests.filter(
            (g) =>
              cell.dateStr >= g.startDate && cell.dateStr <= g.endDate,
          );
          const byLane = new Map();
          dayGuests.forEach((g) => {
            byLane.set(lanes.get(guestKey(g)) ?? 0, g);
          });

          return (
            <div key={cell.key} className="talk-cal-cell">
              <div className="talk-cal-dayhead">
                <span className="talk-cal-daynum">{cell.day}</span>
                <span className="talk-cal-count">
                  {t(
                    `총 ${dayGuests.length}명`,
                    `Total ${dayGuests.length}`,
                  )}
                </span>
              </div>
              <div
                className="talk-cal-badges talk-cal-lanes"
                style={{ minHeight: trackH || undefined }}
              >
                {Array.from({ length: laneCount }, (_, lane) => {
                  const g = byLane.get(lane);
                  if (!g) {
                    return (
                      <div
                        key={`empty-${cell.dateStr}-${lane}`}
                        className="talk-cal-lane-slot"
                        aria-hidden
                      />
                    );
                  }
                  const key = guestKey(g);
                  const past = cell.dateStr < today;
                  return (
                    <div
                      key={`${key}-${cell.dateStr}`}
                      className="talk-cal-badge talk-cal-lane-slot"
                      style={{
                        backgroundColor: past
                          ? '#8b95a1'
                          : colorFromId(key),
                      }}
                      title={`${badgeLabel(g)}\n${g.startDate} ~ ${g.endDate}`}
                      onClick={() => onOpenGuest?.(g)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          onOpenGuest?.(g);
                        }
                      }}
                    >
                      {badgeLabel(g)}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function SchedulerTab({
  t,
  lang = 'KO',
  reservations,
  onOpenQuote,
}) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const today = toLocalISODate();

  const guests = useMemo(() => {
    const seq = bookingSeqMap(reservations);
    return flattenGuestRows(reservations).map((row) => ({
      ...row,
      bookingSeq: seq[row.resId] || row.bookingSeq || '0001',
    }));
  }, [reservations]);

  const prevMonth = () => {
    setMonth((m) => {
      if (m === 0) {
        setYear((y) => y - 1);
        return 11;
      }
      return m - 1;
    });
  };

  const nextMonth = () => {
    setMonth((m) => {
      if (m === 11) {
        setYear((y) => y + 1);
        return 0;
      }
      return m + 1;
    });
  };

  const goToday = () => {
    const d = new Date();
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  };

  const months = [0, 1, 2].map((offset) => {
    let m = month + offset;
    let y = year + Math.floor(m / 12);
    m %= 12;
    if (m < 0) {
      m += 12;
      y -= 1;
    }
    return { year: y, month: m };
  });

  return (
    <div>
      <div
        style={{
          marginBottom: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button type="button" className="btn-secondary" onClick={prevMonth}>
            ◀
          </button>
          <h3 style={{ margin: 0 }}>
            {year}
            {t('년 ', '. ')}
            {month + 1}
            {t('월', '')}
          </h3>
          <button type="button" className="btn-secondary" onClick={nextMonth}>
            ▶
          </button>
        </div>
        <button
          type="button"
          className="btn-secondary"
          style={{ color: '#3182f6' }}
          onClick={goToday}
        >
          {t('오늘', 'Today')}
        </button>
      </div>

      {months.map(({ year: y, month: m }) => (
        <MonthCalendar
          key={`${y}-${m}`}
          year={y}
          month={m}
          guests={guests}
          today={today}
          t={t}
          lang={lang}
          onOpenGuest={(row) =>
            onOpenQuote?.({
              resId: row.resId,
              roomIdx: row.roomIdx,
              guestIdx: row.guestIdx,
              readOnly: true,
            })
          }
        />
      ))}
    </div>
  );
}
