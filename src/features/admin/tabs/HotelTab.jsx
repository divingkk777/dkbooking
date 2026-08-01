import { useMemo, useState } from 'react';
import AdminMemo from '../AdminMemo';

const CANCEL_STATUSES = ['취소', '취소완료'];

function isRoleAdmin(role) {
  return String(role || '').toUpperCase() === 'ADMIN';
}

function isGuestCancelled(res, guest) {
  if (CANCEL_STATUSES.includes(guest?.cancelStatus)) return true;
  if (CANCEL_STATUSES.includes(res?.cancelStatus)) return true;
  if (String(res?.paymentStatus || '').includes('취소')) return true;
  return false;
}

function flattenRows(reservations) {
  const rows = [];
  (reservations || []).forEach((res) => {
    (res.roomsData || []).forEach((room, roomIdx) => {
      (room.guests || []).forEach((guest, guestIdx) => {
        rows.push({ res, room, roomIdx, guest, guestIdx });
      });
    });
  });
  return rows;
}

function groupByReservation(rows) {
  const map = new Map();
  rows.forEach((row) => {
    if (!map.has(row.res.id)) map.set(row.res.id, { res: row.res, rows: [] });
    map.get(row.res.id).rows.push(row);
  });
  return Array.from(map.values());
}

function patchGuestField(res, roomIdx, guestIdx, patch) {
  const rooms = structuredClone(res.roomsData || []);
  if (!rooms[roomIdx]?.guests?.[guestIdx]) return rooms;
  rooms[roomIdx].guests[guestIdx] = {
    ...rooms[roomIdx].guests[guestIdx],
    ...patch,
  };
  return rooms;
}

export default function HotelTab({
  t,
  reservations,
  role,
  onUpdateReservation,
  onOpenQuote,
  onOpenEdit,
}) {
  const [activeTab, setActiveTab] = useState('active');
  const [voucherFilter, setVoucherFilter] = useState('ALL');
  const [settlementFilter, setSettlementFilter] = useState('ALL');
  const [sortDesc, setSortDesc] = useState(true);
  const [openMenuKey, setOpenMenuKey] = useState('');

  const allRows = useMemo(() => flattenRows(reservations), [reservations]);

  const activeGroups = useMemo(() => {
    const rows = allRows.filter((r) => !isGuestCancelled(r.res, r.guest));
    const groups = groupByReservation(rows);
    return groups.filter(({ res }) => {
      if (voucherFilter === 'PENDING' && res.voucherStatus !== '미전달')
        return false;
      if (voucherFilter === 'COMPLETED' && res.voucherStatus !== '전달완료')
        return false;
      if (
        settlementFilter === 'UNPAID' &&
        res.hotelPaymentStatus !== '미정산'
      )
        return false;
      if (
        settlementFilter === 'PAID' &&
        res.hotelPaymentStatus !== '정산완료'
      )
        return false;
      return true;
    });
  }, [allRows, voucherFilter, settlementFilter]);

  const cancelledGroups = useMemo(() => {
    const rows = allRows.filter((r) => isGuestCancelled(r.res, r.guest));
    const groups = groupByReservation(rows);
    groups.sort((a, b) => {
      const aTime = new Date(a.res.submittedAt || 0).getTime();
      const bTime = new Date(b.res.submittedAt || 0).getTime();
      return sortDesc ? bTime - aTime : aTime - bTime;
    });
    return groups;
  }, [allRows, sortDesc]);

  const toggleVoucher = (res) => {
    const next = res.voucherStatus === '전달완료' ? '미전달' : '전달완료';
    onUpdateReservation(res.id, { voucherStatus: next });
  };

  const toggleSettlement = (res) => {
    const next = res.hotelPaymentStatus === '정산완료' ? '미정산' : '정산완료';
    onUpdateReservation(res.id, { hotelPaymentStatus: next });
  };

  const toggleCancelLight = (row) => {
    const next = row.guest.cancelStatus === '취소완료' ? '취소' : '취소완료';
    onUpdateReservation(row.res.id, {
      roomsData: patchGuestField(row.res, row.roomIdx, row.guestIdx, {
        cancelStatus: next,
      }),
    });
  };

  const clearCancelNew = (row) => {
    onUpdateReservation(row.res.id, {
      roomsData: patchGuestField(row.res, row.roomIdx, row.guestIdx, {
        cancelIsNew: false,
      }),
    });
  };

  const updatePenalty = (row, value) => {
    const fee = Math.max(0, Number(value) || 0);
    onUpdateReservation(row.res.id, {
      roomsData: patchGuestField(row.res, row.roomIdx, row.guestIdx, {
        penaltyFee: fee,
      }),
    });
  };

  const markCancel = (row) => {
    onUpdateReservation(row.res.id, {
      roomsData: patchGuestField(row.res, row.roomIdx, row.guestIdx, {
        cancelStatus: '취소',
        cancelIsNew: true,
      }),
    });
    setOpenMenuKey('');
  };

  const rowKey = (row) => `${row.res.id}-${row.roomIdx}-${row.guestIdx}`;

  const renderMoreMenu = (row) => {
    const key = rowKey(row);
    return (
      <div className="more-menu">
        <button
          type="button"
          className="btn-ghost"
          onClick={() => setOpenMenuKey(openMenuKey === key ? '' : key)}
        >
          ⋯
        </button>
        {openMenuKey === key && (
          <div className="more-menu-panel">
            <button
              type="button"
              onClick={() => {
                setOpenMenuKey('');
                onOpenEdit?.(row.res);
              }}
            >
              {t('수정', 'Edit')}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpenMenuKey('');
                onOpenQuote?.({
                  resId: row.res.id,
                  roomIdx: row.roomIdx,
                  guestIdx: row.guestIdx,
                });
              }}
            >
              {t('견적서', 'Quote')}
            </button>
            {activeTab === 'active' && isRoleAdmin(role) && (
              <button type="button" onClick={() => markCancel(row)}>
                {t('취소 처리', 'Mark Cancel')}
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  const groups = activeTab === 'active' ? activeGroups : cancelledGroups;

  return (
    <div className="card">
      <div className="tabs-row">
        <button
          type="button"
          className={`tab ${activeTab === 'active' ? 'active' : ''}`}
          onClick={() => setActiveTab('active')}
        >
          {t('진행중', 'Active')}
        </button>
        <button
          type="button"
          className={`tab ${activeTab === 'cancelled' ? 'active' : ''}`}
          onClick={() => setActiveTab('cancelled')}
        >
          {t('취소', 'Cancelled')}
        </button>

        {activeTab === 'active' ? (
          <>
            <select
              className="input-field"
              style={{ maxWidth: 170, minHeight: 40 }}
              value={voucherFilter}
              onChange={(e) => setVoucherFilter(e.target.value)}
            >
              <option value="ALL">{t('바우처: 전체', 'Voucher: All')}</option>
              <option value="PENDING">
                {t('바우처: 미전달', 'Voucher: Pending')}
              </option>
              <option value="COMPLETED">
                {t('바우처: 전달완료', 'Voucher: Done')}
              </option>
            </select>
            <select
              className="input-field"
              style={{ maxWidth: 170, minHeight: 40 }}
              value={settlementFilter}
              onChange={(e) => setSettlementFilter(e.target.value)}
            >
              <option value="ALL">{t('정산: 전체', 'Settlement: All')}</option>
              <option value="UNPAID">
                {t('정산: 미정산', 'Settlement: Unpaid')}
              </option>
              <option value="PAID">
                {t('정산: 정산완료', 'Settlement: Paid')}
              </option>
            </select>
          </>
        ) : (
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setSortDesc((v) => !v)}
          >
            {sortDesc ? t('최신순 ↓', 'Newest ↓') : t('오래된순 ↑', 'Oldest ↑')}
          </button>
        )}
      </div>

      {groups.length === 0 && (
        <p style={{ color: 'var(--muted)' }}>
          {t('표시할 예약이 없습니다.', 'No reservations to show.')}
        </p>
      )}

      {groups.map(({ res, rows }) => (
        <div key={res.id} className="sub-card">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 8,
            }}
          >
            <strong>
              {res.repName} · {res.bookingInstructor}
            </strong>
          </div>

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('다이버', 'Guest')}</th>
                  <th>{t('기간', 'Dates')}</th>
                  <th>{t('객실', 'Room#')}</th>
                  {activeTab === 'active' ? (
                    <>
                      <th>{t('바우처', 'Voucher')}</th>
                      <th>{t('정산', 'Settlement')}</th>
                    </>
                  ) : (
                    <>
                      <th>{t('취소 상태', 'Cancel Status')}</th>
                      <th>{t('패널티', 'Penalty')}</th>
                    </>
                  )}
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={rowKey(row)}>
                    <td>
                      {row.guest.name}
                      {activeTab === 'cancelled' && row.guest.cancelIsNew && (
                        <button
                          type="button"
                          className="badge badge-new"
                          style={{
                            marginLeft: 6,
                            border: 'none',
                            cursor: 'pointer',
                          }}
                          onClick={() => clearCancelNew(row)}
                        >
                          NEW
                        </button>
                      )}
                    </td>
                    <td>
                      {row.guest.startDate} ~ {row.guest.endDate}
                    </td>
                    <td>
                      <input
                        className="input-field"
                        style={{ minHeight: 32, padding: '4px 8px' }}
                        value={res.assignedRoomNumbers || ''}
                        onChange={(e) =>
                          onUpdateReservation(res.id, {
                            assignedRoomNumbers: e.target.value,
                          })
                        }
                      />
                    </td>
                    {activeTab === 'active' ? (
                      <>
                        <td>
                          <button
                            type="button"
                            className={`status-light ${
                              res.voucherStatus === '전달완료' ? 'done' : ''
                            }`}
                            onClick={() => toggleVoucher(res)}
                          >
                            {res.voucherStatus === '전달완료'
                              ? t('전달완료', 'Delivered')
                              : t('미전달', 'Pending')}
                          </button>
                        </td>
                        <td>
                          <button
                            type="button"
                            className={`status-light ${
                              res.hotelPaymentStatus === '정산완료'
                                ? 'done'
                                : ''
                            }`}
                            onClick={() => toggleSettlement(res)}
                          >
                            {res.hotelPaymentStatus === '정산완료'
                              ? t('정산완료', 'Paid')
                              : t('미정산', 'Unpaid')}
                          </button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td>
                          <button
                            type="button"
                            className={`status-light ${
                              row.guest.cancelStatus === '취소완료'
                                ? 'done'
                                : 'on'
                            }`}
                            onClick={() => toggleCancelLight(row)}
                          >
                            {row.guest.cancelStatus || '취소'}
                          </button>
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            className="input-field"
                            style={{
                              minHeight: 32,
                              padding: '4px 8px',
                              maxWidth: 120,
                            }}
                            value={row.guest.penaltyFee || 0}
                            onChange={(e) => updatePenalty(row, e.target.value)}
                          />
                        </td>
                      </>
                    )}
                    <td>{renderMoreMenu(row)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <AdminMemo
            t={t}
            value={res.adminMemo}
            onSave={(draft) => onUpdateReservation(res.id, { adminMemo: draft })}
          />
        </div>
      ))}
    </div>
  );
}
