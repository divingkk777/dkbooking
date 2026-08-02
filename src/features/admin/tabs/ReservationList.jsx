import emailjs from '@emailjs/browser';
import { useEffect, useMemo, useState } from 'react';
import { formatMoney } from '../../../domain/pricing';
import { addAdminLog } from '../../../data/logsRepo';
import { useToast } from '../../../ui/ToastContext';
import {
  actualTrainingCount,
  flattenGuestRows,
  formatRoomTypeLabel,
  isPaidStatus,
  patchGuestInRooms,
  rowKey,
  unitLabel,
} from '../../../domain/listModel';
import {
  CombinedInvoiceModal,
  PaymentModal,
  TransportModal,
  UnitModal,
  VoucherModal,
} from '../AssignModals';
import {
  buildProfessionalReservationEmail,
  toEmailJsParams,
} from '../../../lib/emailTemplates';

const STRIPE_COLORS = ['#ffffff', '#d0e8ff'];

function isRoleAdmin(role) {
  return String(role || '').toUpperCase() === 'ADMIN';
}

function isRoleInstructor(role) {
  return String(role || '').toUpperCase() === 'INSTRUCTOR';
}

function matchesSearch(row, term) {
  if (!term) return true;
  const needle = term.trim().toLowerCase();
  const haystack = [
    row.name,
    row.nationality,
    row.level,
    row.repName,
    row.bookingInstructor,
    row.bookingSeq,
    row.discipline,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(needle);
}

export default function ReservationList({
  t,
  reservations,
  role,
  settings,
  lang,
  onOpenQuote,
  onOpenEdit,
  onUpdateReservation,
  onTrashReservation,
  onTrashGuest,
}) {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('submittedDesc');
  const [selectedKeys, setSelectedKeys] = useState(() => new Set());
  const [paymentRow, setPaymentRow] = useState(null);
  const [voucherRow, setVoucherRow] = useState(null);
  const [unitRow, setUnitRow] = useState(null);
  const [transportRow, setTransportRow] = useState(null);
  const [invoiceOpen, setInvoiceOpen] = useState(false);

  const instructor = isRoleInstructor(role);
  const admin = isRoleAdmin(role);

  useEffect(() => {
    const key = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;
    if (key) emailjs.init(key);
  }, []);

  const rows = useMemo(() => flattenGuestRows(reservations), [reservations]);

  const filtered = useMemo(() => {
    let list = rows.filter((row) => matchesSearch(row, search));
    if (sortBy === 'paymentPendingOnly') {
      list = list.filter(
        (row) => !isPaidStatus(row.paymentStatus, settings.accountsConfig),
      );
    }
    const sorted = [...list];
    sorted.sort((a, b) => {
      if (sortBy === 'submittedAsc') {
        return (
          new Date(a.submittedAt || 0) - new Date(b.submittedAt || 0) ||
          String(a.bookingSeq || '').localeCompare(String(b.bookingSeq || ''))
        );
      }
      if (sortBy === 'startDate') {
        return String(a.startDate || '').localeCompare(String(b.startDate || ''));
      }
      return (
        new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0) ||
        String(b.bookingSeq || '').localeCompare(String(a.bookingSeq || ''))
      );
    });
    return sorted;
  }, [rows, search, sortBy, settings.accountsConfig]);

  const displayRows = useMemo(() => {
    const colorByGroup = filtered.reduce(
      (acc, row) => {
        const groupKey = `${row.resId}_r${row.roomIdx}`;
        if (acc.map[groupKey] === undefined) {
          acc.map[groupKey] = STRIPE_COLORS[acc.count % STRIPE_COLORS.length];
          acc.count += 1;
        }
        return acc;
      },
      { map: {}, count: 0 },
    ).map;
    return filtered.map((row, idx) => {
      const groupKey = `${row.resId}_r${row.roomIdx}`;
      const next = filtered[idx + 1];
      const nextKey = next ? `${next.resId}_r${next.roomIdx}` : '';
      return {
        ...row,
        __stripe: colorByGroup[groupKey] || '#ffffff',
        __groupBorder: nextKey === groupKey ? 'none' : '2.5px solid #333d4b',
      };
    });
  }, [filtered]);

  const allKeys = useMemo(() => displayRows.map(rowKey), [displayRows]);
  const allSelected =
    allKeys.length > 0 && allKeys.every((k) => selectedKeys.has(k));

  const selectedRows = useMemo(
    () => displayRows.filter((row) => selectedKeys.has(rowKey(row))),
    [displayRows, selectedKeys],
  );

  const toggleSelect = (key) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedKeys(allSelected ? new Set() : new Set(allKeys));
  };

  const clearSelection = () => setSelectedKeys(new Set());

  const patchGuest = (row, patch) => {
    const rooms = patchGuestInRooms(
      row.reservation.roomsData,
      row.roomIdx,
      row.guestIdx,
      patch,
    );
    onUpdateReservation(row.resId, { roomsData: rooms });
  };

  const handlePaymentClick = (row) => {
    if (isPaidStatus(row.paymentStatus, settings.accountsConfig)) {
      if (
        window.confirm(
          t(
            '결제 대기 상태로 되돌리시겠습니까?',
            'Revert this payment to pending?',
          ),
        )
      ) {
        onUpdateReservation(row.resId, {
          paymentStatus: '대기',
          guestPaymentClaimed: false,
          guestPaymentClaimedAt: '',
        });
      }
      return;
    }
    if (row.guestPaymentClaimed) {
      if (
        !window.confirm(
          t(
            '예약자가 결제 완료를 신고했습니다. 입금·결제를 더블체크한 뒤 결제 수단을 선택하세요.',
            'Guest reported payment complete. Double-check the payment, then pick the method.',
          ),
        )
      ) {
        return;
      }
    }
    setPaymentRow(row);
  };

  const handlePaymentPick = (name) => {
    if (paymentRow) {
      onUpdateReservation(paymentRow.resId, {
        paymentStatus: name,
        guestPaymentClaimed: false,
        guestPaymentClaimedAt: '',
      });
    }
    setPaymentRow(null);
  };

  const handleApprovalEmail = async (row) => {
    if (
      !window.confirm(
        t('승인 메일을 발송하시겠습니까?', 'Send the approval email?'),
      )
    ) {
      return;
    }
    try {
      const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID;
      const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
      const res = row.reservation || {
        repName: row.repName,
        repEmail: row.repEmail,
        bookingInstructor: row.bookingInstructor,
        paymentStatus: row.paymentStatus,
        voucherStatus: row.voucherStatus,
        roomsData: row.reservation?.roomsData,
        grandTotalKRW: row.individualTotalKRW,
        grandTotalUSD: row.individualTotalUSD,
      };
      const built = buildProfessionalReservationEmail({
        kind: 'approval',
        t,
        lang,
        res,
        settings,
        extraNote: t(
          `승인 대상 다이버: ${row.name || '—'}`,
          `Approved diver: ${row.name || '—'}`,
        ),
      });
      built.to_email = row.repEmail || built.to_email;
      built.to_name = row.repName || built.to_name;
      await emailjs.send(serviceId, templateId, toEmailJsParams(built));
      await addAdminLog({
        type: 'EDIT',
        message: `[승인메일 발송] ${row.name} (${row.repName}) 승인 메일이 발송되었습니다.`,
      });
      toast.success(t('승인 메일이 발송되었습니다.', 'Approval email sent.'));
    } catch (err) {
      toast.error(err?.message || t('메일 발송 실패', 'Failed to send email'));
    }
  };

  const handleVoucherSave = (roomNumbers) => {
    if (!voucherRow) return;
    const trimmed = String(roomNumbers || '').trim();
    const rooms = structuredClone(voucherRow.reservation.roomsData || []);
    rooms.forEach((room) => {
      (room.guests || []).forEach((g) => {
        g.isNew = !(trimmed !== '');
      });
    });
    onUpdateReservation(voucherRow.resId, {
      assignedRoomNumbers: trimmed,
      roomsData: rooms,
      voucherStatus: trimmed ? '전달' : '미전달',
    });
    setVoucherRow(null);
  };

  const handleUnitPick = (lineLabel) => {
    if (!unitRow) return;
    patchGuest(unitRow, { assignedLine: lineLabel });
    setUnitRow(null);
  };

  const handleTransportSave = (vehicle, driver) => {
    if (!transportRow) return;
    patchGuest(transportRow, {
      assignedVehicle: vehicle,
      assignedDriver: driver,
    });
    setTransportRow(null);
  };

  const handleConfirmNew = (row) => {
    patchGuest(row, { isNew: !row.isNew });
  };

  const handleCancelGuest = (row) => {
    if (isPaidStatus(row.paymentStatus, settings.accountsConfig)) {
      window.alert(
        t(
          '결제가 완료된 예약입니다. 먼저 결제를 대기 상태로 되돌린 후 취소하세요.',
          'This booking is already paid. Revert payment to pending before cancelling.',
        ),
      );
      return;
    }
    if (
      !window.confirm(
        t(`${row.name} 게스트를 취소하시겠습니까?`, `Cancel guest ${row.name}?`),
      )
    ) {
      return;
    }
    onTrashGuest?.({
      reservation: row.reservation,
      roomIdx: row.roomIdx,
      guestIdx: row.guestIdx,
      guestName: row.name,
    });
  };

  const handleDeleteReservation = (row) => {
    if (
      !window.confirm(
        t(
          `${row.repName} 그룹 예약 전체를 휴지통으로 이동하시겠습니까?`,
          `Move the entire ${row.repName} booking to trash?`,
        ),
      )
    ) {
      return;
    }
    onTrashReservation?.(row.reservation);
  };

  return (
    <div style={{ overflowX: 'auto' }}>
      {selectedKeys.size > 0 && (
        <div className="selection-banner">
          <span style={{ fontWeight: 800, fontSize: 15 }}>
            ✅{' '}
            {t(
              `${selectedKeys.size}명의 견적서가 선택되었습니다`,
              `${selectedKeys.size} items selected`,
            )}
          </span>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              className="btn-primary"
              onClick={() => setInvoiceOpen(true)}
            >
              🧾 {t('선택 항목 통합 견적서 열기', 'Open Combined Invoice')}
            </button>
            <button type="button" className="btn-ghost" onClick={clearSelection}>
              {t('선택 해제', 'Clear')}
            </button>
          </div>
        </div>
      )}

      <div
        className="tabs-row"
        style={{ justifyContent: 'space-between', marginBottom: 16 }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'wrap',
          }}
        >
          <span className="label-text" style={{ margin: 0 }}>
            🔎 {t('검색:', 'Search:')}
          </span>
          <input
            className="input-field"
            style={{ maxWidth: 280, padding: '10px 12px' }}
            placeholder={t(
              '이름, 예약자, 국적 검색...',
              'Search name, holder, nationality...',
            )}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'wrap',
          }}
        >
          <span className="label-text" style={{ margin: 0 }}>
            🗂️ {t('집계 정렬:', 'Sort By:')}
          </span>
          <select
            className="input-field"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            style={{
              width: 'auto',
              padding: 10,
              fontWeight: 700,
              color: '#1b64da',
            }}
          >
            <option value="submittedDesc">
              ⏱️ {t('최신 접수순', 'Latest First')}
            </option>
            <option value="submittedAsc">
              ⏳ {t('오래된 접수순 (0001번부터)', 'Oldest First')}
            </option>
            <option value="paymentPendingOnly">
              🔴 {t('결제 대기만 보기', 'Pending Only')}
            </option>
            <option value="startDate">
              📅 {t('체크인 날짜순', 'Check-in Date')}
            </option>
          </select>
        </div>
      </div>

      {displayRows.length === 0 && (
        <p style={{ color: 'var(--muted)' }}>
          {t('예약이 없습니다.', 'No reservations.')}
        </p>
      )}

      {displayRows.length > 0 && (
        <div className="table-wrap">
          <table className="table-custom">
            <thead>
              <tr>
                <th style={{ width: 60, textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    style={{
                      width: 18,
                      height: 18,
                      cursor: 'pointer',
                      accentColor: '#3182f6',
                    }}
                  />
                </th>
                <th>{t('고객 정보 & 상세 내역', 'Guest Info & Details')}</th>
                <th>{t('일정/숙박', 'Schedule/Stay')}</th>
                <th>{t('기사/픽드랍', 'Driver/Transport')}</th>
                <th style={{ textAlign: 'right' }}>
                  {t('총 정산금액', 'Total Invoice')}
                </th>
                <th style={{ textAlign: 'center', minWidth: 280 }}>
                  {t('상태 및 내역 관리', 'Actions & Status')}
                </th>
              </tr>
            </thead>
            <tbody>
              {displayRows.map((row) => {
                const key = rowKey(row);
                const selected = selectedKeys.has(key);
                const paid = isPaidStatus(
                  row.paymentStatus,
                  settings.accountsConfig,
                );
                const selfCount = Number(row.trainingCounts?.SELF_60) || 0;
                const baseTotal = Number(row.baseTotalKRW) || 0;
                const finalTotal = Number(row.individualTotalKRW) || 0;
                const savedAmount = baseTotal - finalTotal;
                const hasDiscount = baseTotal > 0 && savedAmount > 0;
                const discountPct = hasDiscount
                  ? Math.round((savedAmount / baseTotal) * 100)
                  : 0;
                const isNoRoom = row.roomType === 'NONE' || !row.roomType;
                const borderBottom = row.__groupBorder || '2.5px solid #333d4b';
                const roomLabel = formatRoomTypeLabel(row.roomType);

                return (
                  <tr
                    key={key}
                    style={{
                      backgroundColor: row.__stripe || '#ffffff',
                      transition: '0.2s',
                    }}
                  >
                    <td
                      style={{
                        textAlign: 'center',
                        verticalAlign: 'middle',
                        borderBottom,
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleSelect(key)}
                          style={{
                            width: 18,
                            height: 18,
                            cursor: 'pointer',
                            accentColor: '#3182f6',
                          }}
                        />
                        <span className="seq-badge">
                          [#{row.bookingSeq || '0001'}]
                        </span>
                        {admin ? (
                          <button
                            type="button"
                            className="btn-ghost"
                            style={{
                              padding: '2px 6px',
                              minHeight: 'auto',
                              fontSize: 11,
                            }}
                            title={t('예약 전체 삭제', 'Delete entire booking')}
                            onClick={() => handleDeleteReservation(row)}
                          >
                            🗑
                          </button>
                        ) : null}
                      </div>
                    </td>

                    <td style={{ borderBottom }}>
                      <b
                        className="list-name"
                        style={{
                          fontSize: 15,
                          display: 'block',
                          marginBottom: 2,
                        }}
                      >
                        {String(row.name || '').toUpperCase()}
                      </b>
                      <div
                        style={{
                          fontSize: row.assignedRoomNumbers ? 12 : 11,
                          fontWeight: row.assignedRoomNumbers ? 800 : 400,
                          color: row.assignedRoomNumbers ? '#3182f6' : '#8b95a1',
                          marginTop: 3,
                        }}
                      >
                        🚪 RM:{' '}
                        {row.assignedRoomNumbers || t('미배정', 'Unassigned')}
                        {isNoRoom ? '' : ` [${roomLabel}]`}
                      </div>
                      {selfCount > 0 ? (
                        <div
                          style={{
                            fontSize: 12,
                            fontWeight: 900,
                            color: '#f04452',
                            marginTop: 2,
                          }}
                        >
                          🚨 Self 60
                        </div>
                      ) : null}
                      <span
                        style={{
                          color: '#6b7684',
                          fontSize: 12,
                          display: 'block',
                          marginTop: 2,
                        }}
                      >
                        {row.nationality || ''} | {row.level || ''}
                      </span>
                      <div
                        style={{
                          fontSize: 11,
                          color: '#f04452',
                          fontWeight: 700,
                          marginTop: 4,
                        }}
                      >
                        🔥 {t('실제 트레이닝:', 'Actual Training:')}{' '}
                        {actualTrainingCount(row)}
                        {t('회', 'x')}
                      </div>
                    </td>

                    <td style={{ borderBottom }}>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 800,
                          color: '#191f28',
                        }}
                      >
                        {row.startDate} ({row.checkInTime || '14:00'}) ~{' '}
                        {row.endDate} ({row.checkOutTime || '11:00'})
                      </div>
                      {(row.dawnCheckIn || row.lateCheckOut) && (
                        <div
                          style={{
                            display: 'flex',
                            gap: 4,
                            marginTop: 6,
                            flexWrap: 'wrap',
                          }}
                        >
                          {row.dawnCheckIn && (
                            <span className="red-option-box">
                              ✈️ {t('얼리체크인', 'Early-in')}
                            </span>
                          )}
                          {row.lateCheckOut && (
                            <span className="red-option-box">
                              ✈️ {t('레이트아웃', 'Late-out')}
                            </span>
                          )}
                        </div>
                      )}
                      <div
                        style={{
                          fontSize: 11,
                          color: '#6b7684',
                          marginTop: 6,
                          fontWeight: 700,
                        }}
                      >
                        🌙 {t('숙박:', 'Stay:')} {row.billedNights || 0}
                        {t('박', 'n')}{' '}
                        {isNoRoom
                          ? `(${t('방안씀', 'No Room')})`
                          : `[${roomLabel}]`}
                      </div>
                    </td>

                    <td style={{ borderBottom }}>
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 4,
                          fontSize: 12,
                        }}
                      >
                        <span
                          className="transport-chip"
                          style={{ alignSelf: 'flex-start' }}
                        >
                          👤{' '}
                          {row.assignedDriver || t('기사미배정', 'No Driver')}
                          {' · '}
                          🚐{' '}
                          {row.assignedVehicle ||
                            t('차량미배정', 'No Vehicle')}
                        </span>
                        {row.airportPickup ? (
                          <span style={{ color: '#3182f6', fontWeight: 700 }}>
                            🛬 {t('픽업', 'Pickup')}{' '}
                            {row.pickupTime || '--:--'}
                            {row.pickupFlight
                              ? ` (${row.pickupFlight})`
                              : ''}
                          </span>
                        ) : (
                          <span style={{ color: '#8b95a1', fontWeight: 600 }}>
                            🛬 {t('픽업 없음', 'No pickup')}
                          </span>
                        )}
                        {row.airportDropoff ? (
                          <span style={{ color: '#e03131', fontWeight: 700 }}>
                            🛫 {t('드랍', 'Dropoff')}{' '}
                            {row.dropoffTime || '--:--'}
                            {row.dropoffFlight
                              ? ` (${row.dropoffFlight})`
                              : ''}
                          </span>
                        ) : (
                          <span style={{ color: '#8b95a1', fontWeight: 600 }}>
                            🛫 {t('드랍 없음', 'No dropoff')}
                          </span>
                        )}
                      </div>
                    </td>

                    <td style={{ textAlign: 'right', borderBottom }}>
                      {hasDiscount ? (
                        <div
                          style={{
                            textDecoration: 'line-through',
                            color: '#8b95a1',
                            fontSize: 11,
                          }}
                        >
                          ₩{formatMoney(baseTotal)}
                        </div>
                      ) : null}
                      <div
                        style={{
                          fontWeight: 800,
                          color: '#191f28',
                          fontSize: 15,
                        }}
                      >
                        ₩{formatMoney(finalTotal)}
                      </div>
                      <div
                        style={{
                          fontWeight: 800,
                          color: '#1b64da',
                          fontSize: 15,
                          marginTop: 2,
                        }}
                      >
                        ${formatMoney(row.individualTotalUSD || 0)}
                      </div>
                      {Number(row.customTotalKRW) > 0 ? (
                        <div
                          style={{
                            fontSize: 11,
                            color: '#e64980',
                            fontWeight: 700,
                            margin: '2px 0',
                          }}
                        >
                          ✍️ {t('수동 지정 적용', 'Manual override')}
                        </div>
                      ) : hasDiscount ? (
                        <div
                          style={{
                            fontSize: 11,
                            color: '#f09433',
                            fontWeight: 700,
                            margin: '2px 0',
                          }}
                        >
                          🔥 -₩{formatMoney(savedAmount)} ({discountPct}%{' '}
                          {t('할인', 'Off')})
                        </div>
                      ) : null}
                    </td>

                    <td
                      style={{
                        textAlign: 'center',
                        verticalAlign: 'middle',
                        borderBottom,
                      }}
                    >
                      <div className="action-btn-wrapper">
                        <button
                          type="button"
                          className={`status-btn${
                            !paid && row.guestPaymentClaimed
                              ? ' payment-confirm-alert'
                              : ''
                          }`}
                          style={{
                            margin: 0,
                            backgroundColor: paid
                              ? '#04c09e'
                              : row.guestPaymentClaimed
                                ? '#f04452'
                                : '#8b95a1',
                            cursor: instructor ? 'default' : 'pointer',
                          }}
                          title={
                            !paid && row.guestPaymentClaimed
                              ? t(
                                  '예약자 결제완료 신고 — 더블체크 후 확인',
                                  'Guest claimed paid — double-check then confirm',
                                )
                              : undefined
                          }
                          onClick={() => {
                            if (instructor) return;
                            handlePaymentClick(row);
                          }}
                        >
                          {paid
                            ? `✅ ${row.paymentStatus}`
                            : row.guestPaymentClaimed
                              ? t('💳 결제확인', 'Confirm pay')
                              : t('💳 결제하기', 'Payment')}
                        </button>

                        <button
                          type="button"
                          className="status-btn"
                          style={{ margin: 0, backgroundColor: '#f09433' }}
                          onClick={() =>
                            onOpenQuote?.({
                              resId: row.resId,
                              roomIdx: row.roomIdx,
                              guestIdx: row.guestIdx,
                            })
                          }
                        >
                          🧾 {t('견적', 'Invoice')}
                        </button>

                        {!instructor && (
                          <button
                            type="button"
                            className="status-btn"
                            style={{ margin: 0, backgroundColor: '#10b981' }}
                            title={t(
                              '손님에게 최종 예약 승인 메일 발송',
                              'Send approval email',
                            )}
                            onClick={() => handleApprovalEmail(row)}
                          >
                            ✉️ {t('승인메일', 'Approval Mail')}
                          </button>
                        )}

                        <button
                          type="button"
                          className="status-btn"
                          style={{
                            margin: 0,
                            backgroundColor: row.assignedRoomNumbers
                              ? '#3182f6'
                              : '#8b95a1',
                          }}
                          onClick={() => setVoucherRow(row)}
                        >
                          🎫 {t('바우처', 'Voucher')}
                        </button>

                        <button
                          type="button"
                          className="status-btn"
                          style={{
                            margin: 0,
                            backgroundColor: row.assignedLine
                              ? '#7950f2'
                              : '#8b95a1',
                          }}
                          onClick={() => {
                            if (instructor) {
                              toast.warn(
                                t(
                                  '⚠️ 강사는 권한이 없습니다.',
                                  '⚠️ Denied.',
                                ),
                              );
                              return;
                            }
                            setUnitRow(row);
                          }}
                        >
                          🎯 {t('유닛', 'Unit')}
                          {row.assignedLine
                            ? `(${unitLabel(row.assignedLine, lang)})`
                            : ''}
                        </button>

                        {!instructor && (
                          <button
                            type="button"
                            className="status-btn"
                            style={{
                              margin: 0,
                              backgroundColor:
                                row.assignedVehicle || row.assignedDriver
                                  ? '#20c997'
                                  : '#8b95a1',
                            }}
                            onClick={() => setTransportRow(row)}
                          >
                            🚐 {t('차량/기사', 'Transport')}
                          </button>
                        )}

                        <button
                          type="button"
                          className="status-btn"
                          style={{ margin: 0, backgroundColor: '#6c757d' }}
                          onClick={() => onOpenEdit?.(row.reservation)}
                        >
                          ✏️ {t('수정', 'Edit')}
                        </button>

                        {!instructor && (
                          <button
                            type="button"
                            className="status-btn"
                            style={{
                              margin: 0,
                              backgroundColor: row.isNew
                                ? '#ec4899'
                                : '#e5e8eb',
                              color: row.isNew ? '#fff' : '#6b7684',
                            }}
                            onClick={() => handleConfirmNew(row)}
                          >
                            {row.isNew
                              ? t('🆕 신규', '🆕 New')
                              : t('✅ 확인', '✅ Checked')}
                          </button>
                        )}

                        <button
                          type="button"
                          className="status-btn"
                          style={{
                            margin: 0,
                            backgroundColor: paid ? '#a0a0a0' : '#f04452',
                          }}
                          onClick={() => handleCancelGuest(row)}
                        >
                          🗑️ {t('취소', 'Delete')}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {paymentRow && (
        <PaymentModal
          t={t}
          row={paymentRow}
          accounts={settings.accountsConfig}
          onClose={() => setPaymentRow(null)}
          onPick={handlePaymentPick}
        />
      )}

      {voucherRow && (
        <VoucherModal
          t={t}
          row={voucherRow}
          role={role}
          onClose={() => setVoucherRow(null)}
          onSave={handleVoucherSave}
        />
      )}

      {unitRow && (
        <UnitModal
          t={t}
          row={unitRow}
          units={settings.unitsConfig}
          onClose={() => setUnitRow(null)}
          onPick={handleUnitPick}
        />
      )}

      {transportRow && (
        <TransportModal
          t={t}
          row={transportRow}
          vehicles={settings.vehiclesConfig}
          drivers={settings.driversConfig}
          onClose={() => setTransportRow(null)}
          onSave={handleTransportSave}
        />
      )}

      {invoiceOpen && (
        <CombinedInvoiceModal
          t={t}
          lang={lang}
          rows={selectedRows}
          exchangeRate={settings.exchangeRate}
          onClose={() => setInvoiceOpen(false)}
        />
      )}
    </div>
  );
}
