import { useMemo, useState } from 'react';
import { shiftDate } from '../../../domain/dateUtils';
import { formatMoney } from '../../../domain/pricing';

function patchGuest(res, roomIdx, guestIdx, patch) {
  const rooms = structuredClone(res.roomsData || []);
  rooms[roomIdx].guests[guestIdx] = {
    ...rooms[roomIdx].guests[guestIdx],
    ...patch,
  };
  return rooms;
}

export default function SchedulerTab({
  t,
  reservations,
  date,
  setDate,
  onUpdateReservation,
}) {
  const [sortDesc, setSortDesc] = useState(false);

  const rows = useMemo(() => {
    const list = [];
    (reservations || []).forEach((res) => {
      (res.roomsData || []).forEach((room, roomIdx) => {
        (room.guests || []).forEach((guest, guestIdx) => {
          if (!guest?.startDate || !guest?.endDate) return;
          if (date < guest.startDate || date > guest.endDate) return;
          list.push({ res, room, roomIdx, guest, guestIdx });
        });
      });
    });
    list.sort((a, b) => {
      const an = (a.guest.name || '').localeCompare(b.guest.name || '');
      return sortDesc ? -an : an;
    });
    return list;
  }, [reservations, date, sortDesc]);

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
        <button
          type="button"
          className="btn-secondary"
          onClick={() => setSortDesc((v) => !v)}
        >
          {t('집계 정렬', 'Sort')}
        </button>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>{t('이름', 'Name')}</th>
              <th>{t('강사', 'Instructor')}</th>
              <th>{t('라인/차량', 'Line/Vehicle')}</th>
              <th>{t('출석 관리(패널티)', 'Attendance')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center', color: 'var(--muted)' }}>
                  {t('해당 날짜 스케줄 없음', 'No schedule for this date')}
                </td>
              </tr>
            ) : (
              rows.map(({ res, guest, roomIdx, guestIdx }) => (
                <tr key={`${res.id}-${roomIdx}-${guestIdx}`}>
                  <td>
                    <strong>{guest.name}</strong>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                      {guest.level} · {guest.nationality}
                    </div>
                  </td>
                  <td>{res.bookingInstructor}</td>
                  <td>
                    <input
                      className="input-field"
                      style={{ marginBottom: 6 }}
                      placeholder={t('라인', 'Line')}
                      value={guest.assignedLine || ''}
                      onChange={(e) =>
                        onUpdateReservation(res.id, {
                          roomsData: patchGuest(res, roomIdx, guestIdx, {
                            assignedLine: e.target.value,
                          }),
                        })
                      }
                    />
                    <input
                      className="input-field"
                      placeholder={t('차량', 'Vehicle')}
                      value={guest.assignedVehicle || ''}
                      onChange={(e) =>
                        onUpdateReservation(res.id, {
                          roomsData: patchGuest(res, roomIdx, guestIdx, {
                            assignedVehicle: e.target.value,
                          }),
                        })
                      }
                    />
                  </td>
                  <td>
                    <div className="label-text" style={{ color: 'var(--danger)' }}>
                      {t('패널티 금액', 'Penalty')}: ₩
                      {formatMoney(guest.penaltyFee || 0)}
                    </div>
                    <input
                      type="number"
                      min="0"
                      step="1000"
                      className="input-field"
                      value={guest.penaltyFee || 0}
                      onChange={(e) =>
                        onUpdateReservation(res.id, {
                          roomsData: patchGuest(res, roomIdx, guestIdx, {
                            penaltyFee: Math.max(0, Number(e.target.value) || 0),
                          }),
                        })
                      }
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
