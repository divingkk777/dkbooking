import { useMemo } from 'react';
import { shiftDate } from '../../../domain/dateUtils';

function trainingSummary(guest) {
  const counts = guest.trainingCounts || {};
  const parts = Object.entries(counts)
    .filter(([, v]) => Number(v) > 0)
    .map(([k, v]) => `${k}×${v}`);
  return parts.length ? parts.join(', ') : '-';
}

function flattenGuestsForDate(reservations, date) {
  const rows = [];
  (reservations || []).forEach((res) => {
    (res.roomsData || []).forEach((room, roomIdx) => {
      (room.guests || []).forEach((guest, guestIdx) => {
        if (!guest?.startDate || !guest?.endDate) return;
        if (date >= guest.startDate && date <= guest.endDate) {
          rows.push({ res, room, roomIdx, guest, guestIdx });
        }
      });
    });
  });
  return rows;
}

export default function ManifestTab({
  t,
  mode = 'boat',
  reservations,
  date,
  setDate,
}) {
  const rows = useMemo(
    () => flattenGuestsForDate(reservations, date),
    [reservations, date],
  );

  const handlePrint = () => window.print();
  const isTransport = mode === 'transport';
  const printId = isTransport
    ? 'printable-transport-manifest'
    : 'printable-boat-manifest';

  return (
    <div className="card">
      <div className="tabs-row">
        <div className="date-nav">
          <button type="button" onClick={() => setDate(shiftDate(date, -1))}>
            ◀
          </button>
          <input
            type="date"
            className="input-field"
            style={{ maxWidth: 200 }}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <button type="button" onClick={() => setDate(shiftDate(date, 1))}>
            ▶
          </button>
        </div>
        <button type="button" className="btn-secondary" onClick={handlePrint}>
          {isTransport
            ? t('랜드행 명부 인쇄 (A4)', 'Print Transport')
            : t('승선 명부 인쇄 (A4)', 'Print Manifest')}
        </button>
      </div>

      <div className="table-wrap" id={printId}>
        <h3>
          {isTransport
            ? t('랜드행 명부', 'Transport Manifest')
            : t('보트 승선자 명단', 'Boat Manifest')}{' '}
          — {date}
        </h3>
        <table className="data-table">
          <thead>
            <tr>
              <th>{t('이름', 'Name')}</th>
              <th>{t('국적', 'Nationality')}</th>
              <th>{t('레벨', 'Level')}</th>
              <th>{t('트레이닝', 'Training')}</th>
              <th>{t('강사', 'Instructor')}</th>
              <th>{t('객실', 'Room')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ res, room, guest }, idx) => (
              <tr key={`${res.id}-${idx}`}>
                <td>{guest.name}</td>
                <td>{guest.nationality}</td>
                <td>{guest.level}</td>
                <td>{trainingSummary(guest)}</td>
                <td>{res.bookingInstructor}</td>
                <td>{res.assignedRoomNumbers || room.roomType || '-'}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  style={{ textAlign: 'center', color: 'var(--muted)' }}
                >
                  {t(
                    '해당 날짜에 다이버가 없습니다.',
                    'No divers for this date.',
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
