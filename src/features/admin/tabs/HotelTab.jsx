import { Fragment, useMemo, useState } from 'react';
import { isStaffAdmin } from '../../../domain/adminRoles';
import {
  bookingSeqMap,
  formatRoomTypeLabel,
} from '../../../domain/listModel';
import { computeBilledNights } from '../../../domain/pricing';
import AdminMemo from '../AdminMemo';

const CANCEL_STATUSES = ['취소', '취소완료'];

function isRoleAdmin(role) {
  return isStaffAdmin(role);
}

function isGuestCancelled(res, guest) {
  if (CANCEL_STATUSES.includes(guest?.cancelStatus)) return true;
  if (CANCEL_STATUSES.includes(res?.cancelStatus)) return true;
  if (String(res?.paymentStatus || '').includes('취소')) return true;
  return false;
}

/** Lodging nights only — always from dates (+ early/late), never training. */
function guestBilledNights(guest) {
  return computeBilledNights(guest);
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

/** One hotel row per room (live-app parity) for sharing with the hotel. */
function buildHotelTableRows(reservations) {
  const seq = bookingSeqMap(reservations);
  const out = [];
  (reservations || []).forEach((res) => {
    (res.roomsData || []).forEach((room, roomIdx) => {
      const roomType = room.roomType || 'NONE';
      if (roomType === 'NONE') return;
      const guests = (room.guests || []).filter(
        (g) => g && !isGuestCancelled(res, g),
      );
      if (!guests.length) return;
      const first = guests[0] || {};
      out.push({
        key: `${res.id}-${roomIdx}`,
        resId: res.id,
        bookingSeq: seq[res.id] || '0001',
        bookingInstructor: String(res.bookingInstructor || res.repName || ''),
        roomIdx,
        roomType: formatRoomTypeLabel(roomType) || roomType,
        guestNames: guests
          .map((g) => g.name)
          .filter(Boolean)
          .join(', '),
        checkIn: `${first.startDate || 'N/A'} (${first.checkInTime || '14:00'})`,
        checkOut: `${first.endDate || 'N/A'} (${first.checkOutTime || '11:00'})`,
        rawCheckIn: first.startDate || '',
        rawCheckOut: first.endDate || '',
        billedNights: guestBilledNights(first),
        assignedRoomNumbers: String(res.assignedRoomNumbers || ''),
        voucherStatus: String(res.voucherStatus || '미전달'),
        hotelPaymentStatus: String(res.hotelPaymentStatus || '미정산'),
        adminMemo: String(res.adminMemo || ''),
      });
    });
  });
  return out.sort((a, b) => {
    if (a.rawCheckIn !== b.rawCheckIn) {
      return String(a.rawCheckIn).localeCompare(String(b.rawCheckIn));
    }
    return String(a.bookingSeq).localeCompare(String(b.bookingSeq));
  });
}

export default function HotelTab({
  t,
  reservations,
  role,
  onUpdateReservation,
  onOpenQuote,
  onOpenEdit,
}) {
  const [viewMode, setViewMode] = useState('table');
  const [activeTab, setActiveTab] = useState('active');
  const [search, setSearch] = useState('');
  const [checkInFrom, setCheckInFrom] = useState('');
  const [checkInTo, setCheckInTo] = useState('');
  const [voucherFilter, setVoucherFilter] = useState('ALL');
  const [roomFilter, setRoomFilter] = useState('ALL');
  const [settlementFilter, setSettlementFilter] = useState('ALL');
  const [sortDesc, setSortDesc] = useState(true);
  const [openMenuKey, setOpenMenuKey] = useState('');
  const [openMemoKey, setOpenMemoKey] = useState('');

  const resetFilters = () => {
    setSearch('');
    setCheckInFrom('');
    setCheckInTo('');
    setVoucherFilter('ALL');
    setRoomFilter('ALL');
    setSettlementFilter('ALL');
  };

  const allRows = useMemo(() => flattenRows(reservations), [reservations]);

  const hotelTableRows = useMemo(() => {
    const rows = buildHotelTableRows(reservations);
    return rows.filter((row) => {
      if (
        voucherFilter === 'PENDING' &&
        row.voucherStatus === '전달완료'
      ) {
        return false;
      }
      if (
        voucherFilter === 'COMPLETED' &&
        row.voucherStatus !== '전달완료'
      ) {
        return false;
      }
      const hasRoom = !!(row.assignedRoomNumbers || '').trim();
      if (roomFilter === 'UNASSIGNED' && hasRoom) return false;
      if (roomFilter === 'ASSIGNED' && !hasRoom) return false;
      if (
        settlementFilter === 'UNPAID' &&
        row.hotelPaymentStatus === '정산완료'
      ) {
        return false;
      }
      if (
        settlementFilter === 'PAID' &&
        row.hotelPaymentStatus !== '정산완료'
      ) {
        return false;
      }
      if (checkInFrom && row.rawCheckIn && row.rawCheckIn < checkInFrom) {
        return false;
      }
      if (checkInTo && row.rawCheckIn && row.rawCheckIn > checkInTo) {
        return false;
      }
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return (
        String(row.guestNames || '')
          .toLowerCase()
          .includes(q) ||
        String(row.bookingInstructor || '')
          .toLowerCase()
          .includes(q) ||
        String(row.assignedRoomNumbers || '')
          .toLowerCase()
          .includes(q) ||
        String(row.bookingSeq || '').includes(q)
      );
    });
  }, [
    reservations,
    search,
    checkInFrom,
    checkInTo,
    voucherFilter,
    roomFilter,
    settlementFilter,
  ]);

  const activeGroups = useMemo(() => {
    const rows = allRows.filter((r) => !isGuestCancelled(r.res, r.guest));
    const groups = groupByReservation(rows);
    return groups.filter(({ res }) => {
      if (voucherFilter === 'PENDING' && res.voucherStatus === '전달완료')
        return false;
      if (voucherFilter === 'COMPLETED' && res.voucherStatus !== '전달완료')
        return false;
      if (
        settlementFilter === 'UNPAID' &&
        res.hotelPaymentStatus === '정산완료'
      )
        return false;
      if (
        settlementFilter === 'PAID' &&
        res.hotelPaymentStatus !== '정산완료'
      )
        return false;
      const hasRoom = !!(res.assignedRoomNumbers || '').trim();
      if (roomFilter === 'UNASSIGNED' && hasRoom) return false;
      if (roomFilter === 'ASSIGNED' && !hasRoom) return false;
      const q = search.trim().toLowerCase();
      if (q) {
        const hit =
          String(res.repName || '')
            .toLowerCase()
            .includes(q) ||
          String(res.bookingInstructor || '')
            .toLowerCase()
            .includes(q) ||
          String(res.assignedRoomNumbers || '')
            .toLowerCase()
            .includes(q) ||
          String(bookingSeqMap(reservations)[res.id] || '').includes(q) ||
          (res.roomsData || []).some((room) =>
            (room.guests || []).some((g) =>
              String(g?.name || '')
                .toLowerCase()
                .includes(q),
            ),
          );
        if (!hit) return false;
      }
      if (checkInFrom || checkInTo) {
        const starts = (res.roomsData || []).flatMap((room) =>
          (room.guests || []).map((g) => g?.startDate).filter(Boolean),
        );
        if (!starts.length) return false;
        const minStart = starts.slice().sort()[0];
        if (checkInFrom && minStart < checkInFrom) return false;
        if (checkInTo && minStart > checkInTo) return false;
      }
      return true;
    });
  }, [
    allRows,
    voucherFilter,
    settlementFilter,
    roomFilter,
    search,
    checkInFrom,
    checkInTo,
    reservations,
  ]);

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

  const toggleVoucher = (resOrId, currentStatus) => {
    const id = typeof resOrId === 'string' ? resOrId : resOrId.id;
    const status =
      typeof resOrId === 'string'
        ? currentStatus
        : resOrId.voucherStatus;
    const next = status === '전달완료' ? '미전달' : '전달완료';
    onUpdateReservation(id, { voucherStatus: next });
  };

  const toggleSettlement = (resOrId, currentStatus) => {
    const id = typeof resOrId === 'string' ? resOrId : resOrId.id;
    const status =
      typeof resOrId === 'string'
        ? currentStatus
        : resOrId.hotelPaymentStatus;
    const next = status === '정산완료' ? '미정산' : '정산완료';
    onUpdateReservation(id, { hotelPaymentStatus: next });
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

  const filterBar = (
    <div
      style={{
        backgroundColor: '#f9fafb',
        padding: '16px 20px',
        borderRadius: 16,
        border: '1px solid #e5e8eb',
        marginBottom: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <h3 style={{ margin: 0, color: '#3182f6', fontSize: 18 }}>
          🏨{' '}
          {t(
            '호텔 부킹 및 통합 정산 대시보드',
            'Hotel Booking & Settlement Dashboard',
          )}
        </h3>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn-secondary"
            style={{ padding: '6px 12px', fontSize: 12, width: 'auto' }}
            onClick={resetFilters}
          >
            🔄 {t('필터 초기화', 'Reset Filters')}
          </button>
          <button
            type="button"
            className={viewMode === 'table' ? 'btn-primary' : 'btn-secondary'}
            style={{ padding: '6px 12px', fontSize: 12, width: 'auto' }}
            onClick={() => setViewMode('table')}
          >
            📋 {t('표로 보기', 'Table view')}
          </button>
          <button
            type="button"
            className={viewMode === 'cards' ? 'btn-primary' : 'btn-secondary'}
            style={{ padding: '6px 12px', fontSize: 12, width: 'auto' }}
            onClick={() => setViewMode('cards')}
          >
            🗂️ {t('카드로 보기', 'Card view')}
          </button>
          {viewMode === 'table' && (
            <button
              type="button"
              className="btn-secondary"
              style={{ padding: '6px 12px', fontSize: 12, width: 'auto' }}
              onClick={() => window.print()}
            >
              🖨️ {t('인쇄 / 공유', 'Print / Share')}
            </button>
          )}
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          gap: 10,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <input
          type="text"
          className="input-field"
          placeholder={t(
            '고객명, 고유번호, 룸번호 검색...',
            'Search name, seq, room...',
          )}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ padding: '8px 12px', width: 220 }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#6b7684' }}>
            📅 {t('체크인 날짜:', 'Check-in:')}
          </span>
          <input
            type="date"
            className="input-field"
            value={checkInFrom}
            onChange={(e) => setCheckInFrom(e.target.value)}
            style={{ padding: '6px 10px', fontSize: 12, width: 135 }}
          />
          <span style={{ fontSize: 12, color: '#8b95a1' }}>~</span>
          <input
            type="date"
            className="input-field"
            value={checkInTo}
            onChange={(e) => setCheckInTo(e.target.value)}
            style={{ padding: '6px 10px', fontSize: 12, width: 135 }}
          />
        </div>
        <select
          className="input-field"
          value={voucherFilter}
          onChange={(e) => setVoucherFilter(e.target.value)}
          style={{
            padding: '8px 12px',
            width: 'auto',
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          <option value="ALL">🎫 {t('바우처: 전체', 'Voucher: All')}</option>
          <option value="PENDING">
            ⬜ {t('바우처 미전달', 'Voucher Pending')}
          </option>
          <option value="COMPLETED">
            ✅ {t('바우처 전달완료', 'Voucher Sent')}
          </option>
        </select>
        <select
          className="input-field"
          value={roomFilter}
          onChange={(e) => setRoomFilter(e.target.value)}
          style={{
            padding: '8px 12px',
            width: 'auto',
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          <option value="ALL">🚪 {t('룸번호: 전체', 'Room No: All')}</option>
          <option value="UNASSIGNED">
            ❌ {t('룸번호 미배정', 'Unassigned Room')}
          </option>
          <option value="ASSIGNED">
            🚪 {t('룸번호 배정완료', 'Assigned Room')}
          </option>
        </select>
        <select
          className="input-field"
          value={settlementFilter}
          onChange={(e) => setSettlementFilter(e.target.value)}
          style={{
            padding: '8px 12px',
            width: 'auto',
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          <option value="ALL">
            💳 {t('호텔정산: 전체', 'Settlement: All')}
          </option>
          <option value="UNPAID">❌ {t('정산 미완료', 'Unsettled')}</option>
          <option value="PAID">💳 {t('정산 완료', 'Settled')}</option>
        </select>
      </div>
    </div>
  );

  return (
    <div className="card">
      {filterBar}

      {viewMode === 'table' ? (
        <div className="table-wrap" id="hotel-table-print">
          <table className="data-table">
            <thead>
              <tr style={{ backgroundColor: '#e8f3ff', color: '#1b64da' }}>
                <th style={{ width: 40, textAlign: 'center' }}>No.</th>
                <th>
                  {t(
                    '고유번호 [4자리] & 투숙 고객명',
                    'Ref Seq & Guests',
                  )}
                </th>
                <th style={{ width: 88, textAlign: 'center' }}>
                  {t('메모', 'Memo')}
                </th>
                <th>{t('룸 타입', 'Room Type')}</th>
                <th>{t('체크인 시간', 'Check-in Time')}</th>
                <th>{t('체크아웃 시간', 'Check-out Time')}</th>
                <th style={{ textAlign: 'center' }}>{t('숙박', 'Nights')}</th>
                <th style={{ width: 120 }}>{t('룸 번호', 'Room No.')}</th>
                <th style={{ textAlign: 'center', width: 130 }}>
                  {t('바우처 전달', 'Voucher')}
                </th>
                <th style={{ textAlign: 'center', width: 130 }}>
                  {t('호텔 정산 관리', 'Hotel Settlement')}
                </th>
              </tr>
            </thead>
            <tbody>
              {hotelTableRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={10}
                    style={{
                      textAlign: 'center',
                      padding: 40,
                      color: '#8b95a1',
                    }}
                  >
                    {t(
                      '조회 조건과 일치하는 호텔 부킹 내역이 없습니다.',
                      'No matching hotel records.',
                    )}
                  </td>
                </tr>
              ) : (
                hotelTableRows.map((row, idx) => {
                  const memoOpen = openMemoKey === row.key;
                  return (
                    <Fragment key={row.key}>
                      <tr
                        style={{
                          backgroundColor:
                            row.hotelPaymentStatus === '정산완료'
                              ? '#e6fcf5'
                              : row.voucherStatus === '전달완료'
                                ? '#ffffff'
                                : '#fff8f1',
                        }}
                      >
                        <td style={{ textAlign: 'center', fontWeight: 700 }}>
                          {idx + 1}
                        </td>
                        <td style={{ fontWeight: 800, fontSize: 13 }}>
                          <span
                            style={{
                              color: '#f04452',
                              backgroundColor: '#ffe3e3',
                              padding: '2px 6px',
                              borderRadius: 6,
                              marginRight: 6,
                              fontWeight: 900,
                            }}
                          >
                            [#{row.bookingSeq}]
                          </span>
                          {row.guestNames}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            type="button"
                            className="status-btn"
                            style={{
                              backgroundColor: row.adminMemo
                                ? '#3182f6'
                                : '#8b95a1',
                              padding: '6px 10px',
                              fontSize: 11,
                              width: '100%',
                            }}
                            onClick={() =>
                              setOpenMemoKey(memoOpen ? '' : row.key)
                            }
                          >
                            {memoOpen
                              ? t('접기', 'Hide')
                              : row.adminMemo
                                ? t('메모', 'Memo')
                                : t('메모+', 'Memo+')}
                          </button>
                        </td>
                        <td style={{ fontWeight: 700, color: '#3182f6' }}>
                          {row.roomType}
                        </td>
                        <td style={{ fontWeight: 700 }}>📅 {row.checkIn}</td>
                        <td style={{ fontWeight: 700 }}>📅 {row.checkOut}</td>
                        <td
                          style={{
                            textAlign: 'center',
                            fontWeight: 800,
                            color: '#f09433',
                          }}
                        >
                          {row.billedNights}
                          {t('박', 'n')}
                        </td>
                        <td>
                          <input
                            type="text"
                            className="input-field"
                            placeholder={t('룸번호', 'Room#')}
                            value={row.assignedRoomNumbers}
                            onChange={(e) =>
                              onUpdateReservation(row.resId, {
                                assignedRoomNumbers: e.target.value,
                              })
                            }
                            style={{
                              padding: '6px 8px',
                              fontSize: 12,
                              fontWeight: 700,
                              color: '#3182f6',
                            }}
                          />
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            type="button"
                            className="status-btn"
                            style={{
                              backgroundColor:
                                row.voucherStatus === '전달완료'
                                  ? '#04c09e'
                                  : '#8b95a1',
                              padding: '6px 10px',
                              fontSize: 11,
                              width: '100%',
                            }}
                            onClick={() =>
                              toggleVoucher(row.resId, row.voucherStatus)
                            }
                          >
                            {row.voucherStatus === '전달완료'
                              ? t('✅ 전달완료', '✅ Sent')
                              : t('⬜ 미전달', '⬜ Pending')}
                          </button>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            type="button"
                            className="status-btn"
                            style={{
                              backgroundColor:
                                row.hotelPaymentStatus === '정산완료'
                                  ? '#7950f2'
                                  : '#e03131',
                              padding: '6px 10px',
                              fontSize: 11,
                              width: '100%',
                            }}
                            onClick={() =>
                              toggleSettlement(
                                row.resId,
                                row.hotelPaymentStatus,
                              )
                            }
                          >
                            {row.hotelPaymentStatus === '정산완료'
                              ? t('💳 정산완료', '💳 Paid')
                              : t('❌ 미정산', '❌ Unsettled')}
                          </button>
                        </td>
                      </tr>
                      {memoOpen && (
                        <tr style={{ backgroundColor: '#f8fafc' }}>
                          <td colSpan={10} style={{ padding: '12px 16px' }}>
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
                })
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <>
          <div className="tabs-row" style={{ marginBottom: 12 }}>
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
            {activeTab === 'cancelled' && (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setSortDesc((v) => !v)}
              >
                {sortDesc
                  ? t('최신순 ↓', 'Newest ↓')
                  : t('오래된순 ↑', 'Oldest ↑')}
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
                          {activeTab === 'cancelled' &&
                            row.guest.cancelIsNew && (
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
                                  res.voucherStatus === '전달완료'
                                    ? 'done'
                                    : ''
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
                                onChange={(e) =>
                                  updatePenalty(row, e.target.value)
                                }
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
                onSave={(draft) =>
                  onUpdateReservation(res.id, { adminMemo: draft })
                }
              />
            </div>
          ))}
        </>
      )}
    </div>
  );
}
