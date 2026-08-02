import { Fragment, useMemo, useState } from 'react';
import { shiftDate, toLocalISODate } from '../../../domain/dateUtils';
import {
  bookingSeqMap,
  formatRoomTypeLabel,
  patchGuestInRooms,
  unitLabel,
} from '../../../domain/listModel';
import { buildPricingExtras, processRoomsData } from '../../../domain/pricing';
import AdminMemo from '../AdminMemo';
import { TransportModal } from '../AssignModals';

function isRoleInstructor(role) {
  return String(role || '').toUpperCase() === 'INSTRUCTOR';
}

function roomTypeLabel(roomType, roomTypes = []) {
  if (!roomType || roomType === 'NONE') return '';
  const cfg = (roomTypes || []).find((r) => r.id === roomType);
  if (cfg?.nameEN || cfg?.nameKO || cfg?.name) {
    return cfg.nameEN || cfg.name || cfg.nameKO;
  }
  return formatRoomTypeLabel(roomType) || roomType;
}

function flattenBoatRows(reservations, date) {
  const seq = bookingSeqMap(reservations);
  const rows = [];
  (reservations || []).forEach((res) => {
    (res.roomsData || []).forEach((room, roomIdx) => {
      (room.guests || []).forEach((guest, guestIdx) => {
        if (!guest?.startDate || !guest?.endDate) return;
        if (date < guest.startDate || date > guest.endDate) return;
        rows.push({
          ...guest,
          resId: res.id,
          reservation: res,
          roomIdx,
          guestIdx,
          roomType: room.roomType || 'NONE',
          bookingSeq: seq[res.id] || '0001',
          bookingInstructor: res.bookingInstructor || res.repName || '',
          adminMemo: res.adminMemo || '',
          assignedLine: guest.assignedLine || '',
        });
      });
    });
  });
  return rows;
}

function groupByUnit(rows, t) {
  const map = {};
  const unassigned = t('미배정 유닛', 'Unassigned Unit');
  rows.forEach((row) => {
    const key = row.assignedLine || unassigned;
    if (!map[key]) map[key] = [];
    map[key].push(row);
  });
  return map;
}

export default function ManifestTab({
  t,
  lang = 'KO',
  mode = 'boat',
  reservations,
  date,
  setDate,
  role,
  settings,
  onUpdateReservation,
}) {
  const isTransport = mode === 'transport';
  const instructorLocked = isRoleInstructor(role);
  const [openMemoKey, setOpenMemoKey] = useState('');
  const [transportAssign, setTransportAssign] = useState(null);

  const safetyInstructors = (settings?.safetyInstructorsConfig || []).filter(
    (s) => s && s.isActive !== false,
  );

  const boatRows = useMemo(
    () => flattenBoatRows(reservations, date),
    [reservations, date],
  );

  const byUnit = useMemo(
    () => groupByUnit(boatRows, t),
    [boatRows, t],
  );

  const pickupRows = useMemo(() => {
    const seq = bookingSeqMap(reservations);
    const list = [];
    (reservations || []).forEach((res) => {
      (res.roomsData || []).forEach((room, roomIdx) => {
        (room.guests || []).forEach((guest, guestIdx) => {
          if (!guest?.airportPickup || guest.startDate !== date) return;
          list.push({
            res,
            room,
            roomIdx,
            guest,
            guestIdx,
            bookingSeq: seq[res.id] || '0001',
          });
        });
      });
    });
    return list.sort((a, b) =>
      String(a.guest.pickupTime || '').localeCompare(
        String(b.guest.pickupTime || ''),
      ),
    );
  }, [reservations, date]);

  const dropoffRows = useMemo(() => {
    const seq = bookingSeqMap(reservations);
    const list = [];
    (reservations || []).forEach((res) => {
      (res.roomsData || []).forEach((room, roomIdx) => {
        (room.guests || []).forEach((guest, guestIdx) => {
          if (!guest?.airportDropoff || guest.endDate !== date) return;
          list.push({
            res,
            room,
            roomIdx,
            guest,
            guestIdx,
            bookingSeq: seq[res.id] || '0001',
          });
        });
      });
    });
    return list.sort((a, b) =>
      String(a.guest.dropoffTime || '').localeCompare(
        String(b.guest.dropoffTime || ''),
      ),
    );
  }, [reservations, date]);

  const patchGuest = async (row, patch) => {
    if (!onUpdateReservation) return;
    const rooms = patchGuestInRooms(
      row.reservation.roomsData,
      row.roomIdx,
      row.guestIdx,
      patch,
    );
    await onUpdateReservation(row.resId, { roomsData: rooms });
  };

  const setSafety = async (row, value) => {
    if (instructorLocked) return;
    await patchGuest(row, { safetyInstructor: value });
  };

  const toggleAttendance = async (row) => {
    const isAbsent = (Number(row.restDays) || 0) > 0;
    const today = toLocalISODate();
    if (!isAbsent && date === today) {
      window.alert(
        t(
          '🚨 다이버의 다이빙이 이미 준비 되었습니다. 취소불가 합니다. 현장 매니저에게 문의 바랍니다.',
          '🚨 Dive already prepared. Cannot cancel. Contact the on-site manager.',
        ),
      );
      return;
    }

    const ok = window.confirm(
      isAbsent
        ? t(
            `[${row.name}] 다이버를 다시 '정상 참가' 상태로 복구하시겠습니까?\n\n- 차감되었던 트레이닝 1회가 복구되며 견적 금액이 정상 반영됩니다.`,
            `Restore [${row.name}] back to Attending?\n\n- 1 deducted training session will be restored.`,
          )
        : t(
            `⚠️ [당일 불참/취소 및 패널티 규정 안내]\n\n[${row.name}] 다이버의 오늘 다이빙을 '불참' 처리하시겠습니까?\n\n• 트레이닝 1회가 차감 정산됩니다.\n• 규정에 따라 당일 불참 시 패널티가 적용될 수 있습니다.`,
            `⚠️ Mark [${row.name}] absent for today's dive?\n\n• 1 training session will be deducted.\n• Same-day absence may incur a penalty.`,
          ),
    );
    if (!ok) return;

    const nextRest = isAbsent
      ? Math.max(0, (Number(row.restDays) || 0) - 1)
      : (Number(row.restDays) || 0) + 1;

    const rooms = patchGuestInRooms(
      row.reservation.roomsData,
      row.roomIdx,
      row.guestIdx,
      { restDays: nextRest },
    );
    const processed = processRoomsData(
      rooms,
      settings?.exchangeRate,
      settings?.roomTypesConfig,
      settings?.trainingTypesConfig,
      settings?.optionsCatalogConfig || settings?.optionPricesConfig,
      buildPricingExtras(settings, row.reservation?.escortCode),
    );
    await onUpdateReservation(row.resId, {
      roomsData: processed.processedRooms,
      grandTotalKRW: processed.grandTotalKRW,
      grandTotalUSD: processed.grandTotalUSD,
    });
    window.alert(
      isAbsent
        ? t(
            `✅ [${row.name}] '정상 참가'로 복구되었습니다.`,
            `✅ [${row.name}] restored to Attending.`,
          )
        : t(
            `✅ [${row.name}] '불참/차감' 처리되었습니다.`,
            `✅ [${row.name}] marked Absent.`,
          ),
    );
  };

  if (isTransport) {
    const colCount = instructorLocked ? 6 : 7;
    const renderTransportTable = (rows, kind) => {
      const isPickup = kind === 'pickup';
      const headBg = isPickup ? '#e8f3ff' : '#fff0f0';
      const headColor = isPickup ? '#1b64da' : '#e03131';
      const timeColor = isPickup ? '#3182f6' : '#e03131';
      return (
        <table className="data-table">
          <thead>
            <tr style={{ backgroundColor: headBg, color: headColor }}>
              <th>No.</th>
              <th>{t('시각 / 항공편', 'Time / Flight')}</th>
              <th>{t('다이버 성명 (국적)', 'Diver (Nationality)')}</th>
              <th>{t('예약자(Holder)', 'Holder')}</th>
              <th>{t('배정 차량', 'Vehicle')}</th>
              <th>{t('담당 드라이버', 'Driver')}</th>
              {!instructorLocked && (
                <th className="no-print" style={{ textAlign: 'center' }}>
                  {t('배정 관리', 'Assign')}
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={colCount}
                  style={{ textAlign: 'center', color: '#8b95a1' }}
                >
                  {isPickup
                    ? t(
                        '예정된 공항 픽업이 없습니다.',
                        'No airport pickups scheduled.',
                      )
                    : t(
                        '예정된 공항 드랍이 없습니다.',
                        'No airport dropoffs scheduled.',
                      )}
                </td>
              </tr>
            ) : (
              rows.map((row, idx) => {
                const g = row.guest;
                const time = isPickup
                  ? g.pickupTime || '00:00'
                  : g.dropoffTime || '00:00';
                const flight = isPickup
                  ? g.pickupFlight || 'N/A'
                  : g.dropoffFlight || 'N/A';
                return (
                  <tr
                    key={`${kind}-${row.res.id}-${row.roomIdx}-${row.guestIdx}`}
                  >
                    <td>{idx + 1}</td>
                    <td style={{ fontWeight: 700, color: timeColor }}>
                      ⏰ {time} / ✈️ {flight}
                    </td>
                    <td>
                      <b>
                        [{row.bookingSeq}]{' '}
                        {String(g.name || '')
                          .trim()
                          .toUpperCase()}
                      </b>{' '}
                      ({g.nationality || '-'})
                    </td>
                    <td>
                      {row.res.bookingInstructor || row.res.repName || '-'}
                    </td>
                    <td>
                      🚐 {g.assignedVehicle || t('미배정', 'Unassigned')}
                    </td>
                    <td>
                      👤 {g.assignedDriver || t('미배정', 'Unassigned')}
                    </td>
                    {!instructorLocked && (
                      <td className="no-print" style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          className="status-btn"
                          style={{
                            backgroundColor: '#20c997',
                            padding: '4px 8px',
                          }}
                          onClick={() =>
                            setTransportAssign({
                              resId: row.res.id,
                              roomIdx: row.roomIdx,
                              guestIdx: row.guestIdx,
                              name: g.name,
                              assignedVehicle: g.assignedVehicle || '',
                              assignedDriver: g.assignedDriver || '',
                              reservation: row.res,
                            })
                          }
                        >
                          {t('배정', 'Assign')}
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      );
    };

    return (
      <div>
        <div
          className="no-print"
          style={{
            backgroundColor: '#f9fafb',
            padding: '16px 20px',
            borderRadius: 16,
            border: '1px solid #e5e8eb',
            marginBottom: 24,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontWeight: 800, fontSize: 15 }}>
              📅 {t('수송 기준 날짜:', 'Transport Date:')}
            </span>
            <div className="date-nav">
              <button
                type="button"
                onClick={() => setDate(shiftDate(date, -1))}
                aria-label={t('하루 전', 'Previous day')}
              >
                ◀
              </button>
              <input
                type="date"
                className="input-field"
                style={{ width: 180, padding: '8px 12px' }}
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setDate(shiftDate(date, 1))}
                aria-label={t('하루 후', 'Next day')}
              >
                ▶
              </button>
            </div>
          </div>
          <button
            type="button"
            className="btn-primary"
            style={{
              width: 'auto',
              padding: '10px 20px',
              backgroundColor: '#20c997',
            }}
            onClick={() => window.print()}
          >
            🖨️ {t('픽드랍 명부 인쇄 (A4)', 'Print Transport')}
          </button>
        </div>

        <div
          id="printable-transport-manifest"
          className="card"
          style={{ padding: '32px 28px', border: '2px solid #20c997' }}
        >
          <h2 style={{ margin: 0, color: '#0ca678' }}>
            🚐 DAILY TRANSPORT MANIFEST ({date})
          </h2>
          <p
            style={{
              color: '#6b7684',
              fontSize: 13,
              marginBottom: 20,
            }}
          >
            IDA CEBU x DOUBLE K FREEDIVING CENTER
          </p>

          <div style={{ marginBottom: 28 }}>
            <h4 style={{ color: '#3182f6', marginBottom: 8 }}>
              🛬{' '}
              {t(
                `공항 픽업 (Airport Pickup: ${pickupRows.length}명)`,
                `Airport Pickup: ${pickupRows.length}`,
              )}
            </h4>
            <div className="table-wrap">
              {renderTransportTable(pickupRows, 'pickup')}
            </div>
          </div>

          <div>
            <h4 style={{ color: '#e03131', marginBottom: 8 }}>
              🛫{' '}
              {t(
                `공항 드랍 (Airport Dropoff: ${dropoffRows.length}명)`,
                `Airport Dropoff: ${dropoffRows.length}`,
              )}
            </h4>
            <div className="table-wrap">
              {renderTransportTable(dropoffRows, 'dropoff')}
            </div>
          </div>
        </div>

        {transportAssign && (
          <TransportModal
            t={t}
            row={transportAssign}
            vehicles={settings?.vehiclesConfig || []}
            drivers={settings?.driversConfig || []}
            onClose={() => setTransportAssign(null)}
            onSave={async (vehicle, driver) => {
              const rooms = patchGuestInRooms(
                transportAssign.reservation.roomsData,
                transportAssign.roomIdx,
                transportAssign.guestIdx,
                {
                  assignedVehicle: vehicle,
                  assignedDriver: driver,
                },
              );
              await onUpdateReservation(transportAssign.resId, {
                roomsData: rooms,
              });
              setTransportAssign(null);
            }}
          />
        )}
      </div>
    );
  }

  // Boat manifest
  return (
    <div>
      <div
        className="no-print"
        style={{
          backgroundColor: '#f9fafb',
          padding: '16px 20px',
          borderRadius: 16,
          border: '1px solid #e5e8eb',
          marginBottom: 24,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 800, fontSize: 15 }}>
            📅 {t('출항 날짜 선택:', 'Manifest Date:')}
          </span>
          <div className="date-nav">
            <button
              type="button"
              onClick={() => setDate(shiftDate(date, -1))}
              aria-label={t('하루 전', 'Previous day')}
            >
              ◀
            </button>
            <input
              type="date"
              className="input-field"
              style={{ width: 180, padding: '8px 12px' }}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
            <button
              type="button"
              onClick={() => setDate(shiftDate(date, 1))}
              aria-label={t('하루 후', 'Next day')}
            >
              ▶
            </button>
          </div>
          <span
            className="badge"
            style={{
              backgroundColor: '#e8f3ff',
              color: '#3182f6',
              fontSize: 13,
              padding: '6px 12px',
            }}
          >
            {t(
              `오늘 탑승 총 ${boatRows.length}명`,
              `Total ${boatRows.length} Divers`,
            )}
          </span>
        </div>
        <button
          type="button"
          className="btn-primary"
          style={{
            width: 'auto',
            padding: '10px 20px',
            backgroundColor: '#333d4b',
          }}
          onClick={() => window.print()}
        >
          🖨️ {t('승선 명부 인쇄 (A4)', 'Print Manifest')}
        </button>
      </div>

      <div
        id="printable-boat-manifest"
        className="card"
        style={{ padding: '32px 28px', border: '2px solid #333d4b' }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            borderBottom: '3px solid #191f28',
            paddingBottom: 14,
            marginBottom: 20,
          }}
        >
          <h1
            style={{
              margin: 0,
              fontSize: 24,
              color: '#191f28',
              fontWeight: 900,
            }}
          >
            🚢 {t('다이버 리스트', 'Diver List')}
          </h1>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#f04452' }}>
            DATE: {date}
          </div>
        </div>

        {Object.keys(byUnit).length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#8b95a1' }}>
            {t('탑승 예정인 다이버가 없습니다.', 'No divers.')}
          </div>
        ) : (
          Object.keys(byUnit).map((unitKey) => (
            <div key={unitKey} style={{ marginBottom: 28 }}>
              <div
                style={{
                  backgroundColor: '#191f28',
                  color: '#ffffff',
                  padding: '8px 16px',
                  borderRadius: '8px 8px 0 0',
                  fontWeight: 800,
                }}
              >
                <span>
                  🚢 {unitLabel(unitKey, lang) || unitKey}
                </span>{' '}
                (
                {t(
                  `${byUnit[unitKey].length}명`,
                  `${byUnit[unitKey].length} pax`,
                )}
                )
              </div>
              <div className="table-wrap">
                <table className="data-table" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th>No.</th>
                      <th>{t('다이버 성명', 'Diver Name')}</th>
                      <th style={{ width: 72, textAlign: 'center' }}>
                        {t('메모', 'Memo')}
                      </th>
                      <th>{t('숙박/구분', 'Stay/Type')}</th>
                      <th>{t('국적/레벨', 'Nat./Level')}</th>
                      <th>{t('종목/수심', 'Disc./Depth')}</th>
                      <th>{t('예약자', 'Holder')}</th>
                      <th style={{ width: 130 }}>
                        {t('세이프티 강사', 'Safety Inst.')}
                      </th>
                      <th style={{ textAlign: 'center' }}>
                        {t('출석 관리 (패널티)', 'Attendance')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {byUnit[unitKey].map((row, idx) => {
                      const isAbsent = (Number(row.restDays) || 0) > 0;
                      const divingOnly = row.roomType === 'NONE';
                      const memoKey = `${row.resId}-${row.roomIdx}-${row.guestIdx}`;
                      const memoOpen = openMemoKey === memoKey;
                      return (
                        <Fragment key={memoKey}>
                          <tr
                            style={{
                              backgroundColor: isAbsent ? '#fff8f9' : '#ffffff',
                            }}
                          >
                            <td>{idx + 1}</td>
                            <td>
                              <b>
                                [{row.bookingSeq}]{' '}
                                {String(row.name || '')
                                  .trim()
                                  .toUpperCase()}
                              </b>
                            </td>
                            <td style={{ textAlign: 'center' }} className="no-print">
                              <button
                                type="button"
                                className="status-btn"
                                style={{
                                  backgroundColor: row.adminMemo
                                    ? '#3182f6'
                                    : '#8b95a1',
                                  padding: '5px 8px',
                                  fontSize: 11,
                                }}
                                onClick={() =>
                                  setOpenMemoKey(memoOpen ? '' : memoKey)
                                }
                              >
                                {memoOpen
                                  ? t('접기', 'Hide')
                                  : t('메모', 'Memo')}
                              </button>
                            </td>
                            <td>
                              {divingOnly ? (
                                <span
                                  style={{
                                    fontSize: 11,
                                    color: '#e64980',
                                    fontWeight: 800,
                                    backgroundColor: '#fff0f6',
                                    padding: '3px 8px',
                                    borderRadius: 6,
                                    border: '1px solid #ffdeeb',
                                  }}
                                >
                                  🤿 {t('다이빙만', 'Diving Only')}
                                </span>
                              ) : (
                                <span
                                  style={{
                                    fontSize: 11,
                                    color: '#3182f6',
                                    fontWeight: 700,
                                  }}
                                >
                                  🏨{' '}
                                  {roomTypeLabel(
                                    row.roomType,
                                    settings?.roomTypesConfig,
                                  )}
                                </span>
                              )}
                            </td>
                            <td>
                              {row.nationality} | {row.level}
                            </td>
                            <td>
                              {row.discipline || '-'} ({row.targetDepth || 0}m)
                            </td>
                            <td>{row.bookingInstructor}</td>
                            <td className="no-print">
                              <select
                                disabled={instructorLocked}
                                className="input-field"
                                style={{
                                  padding: '4px 6px',
                                  fontSize: 11,
                                  width: '100%',
                                  margin: 0,
                                  fontWeight: 700,
                                  backgroundColor: instructorLocked
                                    ? '#f2f4f6'
                                    : '#ffffff',
                                }}
                                value={row.safetyInstructor || ''}
                                onChange={(e) =>
                                  setSafety(row, e.target.value)
                                }
                              >
                                <option value="">
                                  -- {t('미지정', 'None')} --
                                </option>
                                {safetyInstructors.map((s) => (
                                  <option
                                    key={s.id || s.name}
                                    value={s.name}
                                  >
                                    {s.name}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td
                              style={{ textAlign: 'center' }}
                              className="no-print"
                            >
                              <button
                                type="button"
                                className="status-btn"
                                style={{
                                  backgroundColor: isAbsent
                                    ? '#f04452'
                                    : '#04c09e',
                                  fontSize: 12,
                                  padding: '6px 14px',
                                  fontWeight: 700,
                                }}
                                onClick={() => toggleAttendance(row)}
                              >
                                {isAbsent
                                  ? t(
                                      '🚫 불참 (클릭시 복구)',
                                      '🚫 Absent (Restore)',
                                    )
                                  : t(
                                      '✅ 참가 (클릭시 불참)',
                                      '✅ Attending (Absent)',
                                    )}
                              </button>
                            </td>
                          </tr>
                          {memoOpen && (
                            <tr
                              className="no-print"
                              style={{ backgroundColor: '#f8fafc' }}
                            >
                              <td colSpan={9} style={{ padding: '12px 16px' }}>
                                <AdminMemo
                                  t={t}
                                  value={row.adminMemo}
                                  startOpen
                                  hideToggle
                                  onCollapse={() => setOpenMemoKey('')}
                                  onSave={async (draft) => {
                                    await onUpdateReservation(row.resId, {
                                      adminMemo: draft,
                                    });
                                  }}
                                />
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
