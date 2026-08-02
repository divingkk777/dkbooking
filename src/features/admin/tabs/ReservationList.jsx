import emailjs from '@emailjs/browser';
import { useEffect, useMemo, useState } from 'react';
import { formatMoney, formatPricePair } from '../../../domain/pricing';
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

function buildInvoiceDetails(row, t, lang = 'KO') {
  return [
    `${row.name} (${row.nationality || ''} ${row.level || ''})`.trim(),
    `${row.startDate || ''} ~ ${row.endDate || ''}`,
    `${t('객실', 'Room')}: ${formatPricePair(lang, row.roomShareCost, row.roomShareCostUSD)}`,
    `${t('트레이닝', 'Training')}: ${formatPricePair(lang, row.trainingCost, row.trainingCostUSD)}`,
    `${t('옵션', 'Options')}: ${formatPricePair(lang, row.optionsCost, row.optionsCostUSD)}`,
    `${t('합계', 'Total')}: ${formatPricePair(lang, row.individualTotalKRW, row.individualTotalUSD)}`,
  ].join('\n');
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

  const filtered = useMemo(
    () => rows.filter((row) => matchesSearch(row, search)),
    [rows, search],
  );

  const displayRows = useMemo(() => {
    const colorByGroup = filtered.reduce((acc, row) => {
      const groupKey = `${row.resId}_r${row.roomIdx}`;
      if (acc.map[groupKey] === undefined) {
        acc.map[groupKey] = STRIPE_COLORS[acc.count % STRIPE_COLORS.length];
        acc.count += 1;
      }
      return acc;
    }, { map: {}, count: 0 }).map;
    return filtered.map((row) => ({
      ...row,
      __stripe: colorByGroup[`${row.resId}_r${row.roomIdx}`] || '#ffffff',
    }));
  }, [filtered]);

  const allKeys = useMemo(() => displayRows.map(rowKey), [displayRows]);
  const allSelected = allKeys.length > 0 && allKeys.every((k) => selectedKeys.has(k));

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
        onUpdateReservation(row.resId, { paymentStatus: '대기' });
      }
      return;
    }
    setPaymentRow(row);
  };

  const handlePaymentPick = (name) => {
    if (paymentRow) onUpdateReservation(paymentRow.resId, { paymentStatus: name });
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
      await emailjs.send(serviceId, templateId, {
        to_email: row.repEmail,
        to_name: row.repName,
        message: buildInvoiceDetails(row, t, lang),
        invoice_details: buildInvoiceDetails(row, t, lang),
      });
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
    // Live: free toggle (🆕 신규 ↔ ✅ 확인)
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
    <div>
      <div className="tabs-row">
        <input
          className="input-field"
          style={{ maxWidth: 320 }}
          placeholder={t(
            '이름/강사/국적 검색',
            'Search name/instructor/nationality',
          )}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {selectedKeys.size > 0 && (
        <div className="selection-banner">
          <strong>
            {t(`${selectedKeys.size}건 선택됨`, `${selectedKeys.size} selected`)}
          </strong>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="btn-primary"
              style={{ width: 'auto' }}
              onClick={() => setInvoiceOpen(true)}
            >
              {t('선택 항목 통합 견적서 열기', 'Open Combined Invoice')}
            </button>
            <button type="button" className="btn-ghost" onClick={clearSelection}>
              {t('선택 해제', 'Clear')}
            </button>
          </div>
        </div>
      )}

      {displayRows.length === 0 && (
        <p style={{ color: 'var(--muted)' }}>
          {t('예약이 없습니다.', 'No reservations.')}
        </p>
      )}

      {displayRows.length > 0 && (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 32, textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th>{t('고객정보', 'Guest Info')}</th>
                <th>{t('일정/숙박', 'Dates / Stay')}</th>
                <th>{t('다이빙/랜드행', 'Diving / Transport')}</th>
                <th style={{ textAlign: 'right' }}>{t('금액', 'Amount')}</th>
                <th style={{ minWidth: 230, textAlign: 'center' }}>
                  {t('액션', 'Actions')}
                </th>
              </tr>
            </thead>
            <tbody>
              {displayRows.map((row) => {
                const key = rowKey(row);
                const selected = selectedKeys.has(key);
                const paid = isPaidStatus(row.paymentStatus, settings.accountsConfig);
                const selfCount = Number(row.trainingCounts?.SELF_60) || 0;
                const baseTotal = Number(row.baseTotalKRW) || 0;
                const finalTotal = Number(row.individualTotalKRW) || 0;
                const savedAmount = baseTotal - finalTotal;
                const hasDiscount = baseTotal > 0 && savedAmount > 0;
                const discountPct = hasDiscount
                  ? Math.round((savedAmount / baseTotal) * 100)
                  : 0;
                const isNoRoom = row.roomType === 'NONE' || !row.roomType;

                return (
                  <tr
                    key={key}
                    className={row.__stripe === '#d0e8ff' ? 'guest-row-alt' : ''}
                  >
                    <td style={{ textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleSelect(key)}
                      />
                    </td>

                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span className="seq-badge">[#{row.bookingSeq}]</span>
                        {admin && (
                          <button
                            type="button"
                            className="btn-ghost"
                            style={{ padding: '2px 6px', minHeight: 'auto', fontSize: 11 }}
                            title={t('예약 전체 삭제', 'Delete entire booking')}
                            onClick={() => handleDeleteReservation(row)}
                          >
                            🗑
                          </button>
                        )}
                      </div>
                      <div className="list-name" style={{ fontSize: 14, marginTop: 2 }}>
                        {String(row.name || '').toUpperCase()}
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: row.assignedRoomNumbers ? '#1d4ed8' : 'var(--muted)',
                          marginTop: 2,
                        }}
                      >
                        🏨 RM: {row.assignedRoomNumbers || t('미배정', 'Unassigned')}
                        {isNoRoom ? '' : ` [${formatRoomTypeLabel(row.roomType)}]`}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                        {row.nationality || '-'} | {row.level || '-'}
                      </div>
                      {selfCount > 0 && (
                        <div style={{ color: '#e03131', fontWeight: 900, fontSize: 12, marginTop: 2 }}>
                          🔴 Self 60
                        </div>
                      )}
                      <div style={{ fontSize: 11, color: '#e03131', fontWeight: 700, marginTop: 4 }}>
                        🎯 {t('실제 트레이닝', 'Actual training')}: {actualTrainingCount(row)}
                        {t('회', 'x')}
                      </div>
                    </td>

                    <td>
                      <div style={{ fontSize: 13, fontWeight: 800 }}>
                        {row.startDate} ({row.checkInTime || '14:00'}) ~ {row.endDate} (
                        {row.checkOutTime || '11:00'})
                      </div>
                      {(row.dawnCheckIn || row.lateCheckOut) && (
                        <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
                          {row.dawnCheckIn && (
                            <span className="red-option-box">
                              ⏰ {t('얼리체크인', 'Early Check-in')}
                            </span>
                          )}
                          {row.lateCheckOut && (
                            <span className="red-option-box">
                              ⏰ {t('레이트아웃', 'Late Check-out')}
                            </span>
                          )}
                        </div>
                      )}
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6, fontWeight: 700 }}>
                        🛏 {t('숙박', 'Stay')}: {row.billedNights || 0}
                        {t('박', 'n')}{' '}
                        {isNoRoom
                          ? `(${t('방 없음', 'No Room')})`
                          : `[${formatRoomTypeLabel(row.roomType)}]`}
                      </div>
                    </td>

                    <td>
                      <div>
                        <b>
                          {row.discipline || '-'} ({row.targetDepth || 0}m)
                        </b>
                        {row.assignedLine && (
                          <span className="unit-pill" style={{ marginLeft: 6 }}>
                            {unitLabel(row.assignedLine, lang)}
                          </span>
                        )}
                      </div>
                      <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 2, fontSize: 11 }}>
                        {row.airportPickup && (
                          <span style={{ color: '#3182f6', fontWeight: 700 }}>
                            🛫 {t('픽업', 'Pickup')}: {row.pickupFlight || 'N/A'} (
                            {row.pickupTime || '--:--'})
                          </span>
                        )}
                        {row.airportDropoff && (
                          <span style={{ color: '#e03131', fontWeight: 700 }}>
                            🛬 {t('드롭오프', 'Dropoff')}: {row.dropoffFlight || 'N/A'} (
                            {row.dropoffTime || '--:--'})
                          </span>
                        )}
                        {(row.assignedVehicle || row.assignedDriver) && (
                          <span className="transport-chip">
                            🚐 {row.assignedVehicle || t('차량 미배정', 'No Vehicle')} | 👤{' '}
                            {row.assignedDriver || t('기사 미배정', 'No Driver')}
                          </span>
                        )}
                      </div>
                    </td>

                    <td style={{ textAlign: 'right' }}>
                      {hasDiscount && (
                        <div
                          style={{
                            textDecoration: 'line-through',
                            color: 'var(--muted)',
                            fontSize: 11,
                          }}
                        >
                          ₩{formatMoney(baseTotal)}
                        </div>
                      )}
                      <div style={{ fontWeight: 800, fontSize: 15 }}>
                        {formatPricePair(
                          lang,
                          finalTotal,
                          row.individualTotalUSD,
                        )}
                      </div>
                      {Number(row.customTotalKRW) > 0 ? (
                        <div style={{ fontSize: 11, color: '#e64980', fontWeight: 700, margin: '2px 0' }}>
                          🖊 {t('수동지정 적용', 'Manual override')}
                        </div>
                      ) : hasDiscount ? (
                        <div style={{ fontSize: 11, color: '#f09433', fontWeight: 700, margin: '2px 0' }}>
                          🔥 -₩{formatMoney(savedAmount)} ({discountPct}% {t('할인', 'Off')})
                        </div>
                      ) : null}
                    </td>

                    <td>
                      <div className="action-btn-grid">
                        {/* Live parity: payment/cancel/unit visible to non-guest roles;
                            instructor: hide approval mail + transport + confirm;
                            unit click denied for instructor. */}
                        {!instructor && (
                          <button
                            type="button"
                            className="status-btn"
                            style={{ background: paid ? '#04c09e' : '#8b95a1' }}
                            onClick={() => handlePaymentClick(row)}
                          >
                            {paid
                              ? `✅ ${row.paymentStatus}`
                              : `💰 ${t('결제하기', 'Payment')}`}
                          </button>
                        )}

                        <button
                          type="button"
                          className="status-btn"
                          style={{ background: '#f09433' }}
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
                            style={{ background: '#10b981' }}
                            title={t(
                              '예약자에게 최종 확정 메일을 발송합니다.',
                              'Send the final approval email.',
                            )}
                            onClick={() => handleApprovalEmail(row)}
                          >
                            📧 {t('승인메일', 'Approval Mail')}
                          </button>
                        )}

                        <button
                          type="button"
                          className="status-btn"
                          style={{
                            background: row.assignedRoomNumbers
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
                            background: row.assignedLine ? '#7950f2' : '#8b95a1',
                          }}
                          onClick={() => {
                            if (instructor) {
                              toast.warn(
                                t('강사님 권한이 없습니다.', 'Denied.'),
                              );
                              return;
                            }
                            setUnitRow(row);
                          }}
                        >
                          🎯 {t('유닛', 'Unit')}
                          {row.assignedLine
                            ? ` (${unitLabel(row.assignedLine, lang)})`
                            : ''}
                        </button>

                        {!instructor && (
                          <button
                            type="button"
                            className="status-btn"
                            style={{
                              background:
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
                          style={{ background: '#6c757d' }}
                          onClick={() => onOpenEdit?.(row.reservation)}
                        >
                          ✏️ {t('수정', 'Edit')}
                        </button>

                        {!instructor && (
                          <button
                            type="button"
                            className="status-btn"
                            style={{
                              background: row.isNew ? '#ec4899' : '#e5e8eb',
                              color: row.isNew ? '#fff' : '#6b7684',
                            }}
                            onClick={() => handleConfirmNew(row)}
                          >
                            {row.isNew
                              ? `🆕 ${t('신규', 'New')}`
                              : `✅ ${t('확인', 'Checked')}`}
                          </button>
                        )}

                        {!instructor && (
                          <button
                            type="button"
                            className="status-btn"
                            style={{
                              background: paid ? '#a0a0a0' : '#868e96',
                            }}
                            onClick={() => handleCancelGuest(row)}
                          >
                            🗑️ {t('취소', 'Cancel')}
                          </button>
                        )}
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
          rows={selectedRows}
          exchangeRate={settings.exchangeRate}
          onClose={() => setInvoiceOpen(false)}
        />
      )}
    </div>
  );
}
