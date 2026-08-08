import {
  actualTrainingCount,
  formatRoomTypeLabel,
  isPaidStatus,
  requestedTrainingCount,
} from '../../domain/listModel';

function formatMoney(n) {
  return Math.round(Number(n) || 0).toLocaleString('en-US');
}

/** Admin-list-style guest row for My page (guest-scoped actions). */
export default function MyGuestRowCard({
  t,
  row,
  settings,
  editing,
  saving,
  selected,
  onToggleSelect,
  onPay,
  onQuote,
  onQuoteDiscount,
  onApprovalMail,
  onTransport,
  onEdit,
  onDelete,
  hasDiscount,
  children,
}) {
  const paid = isPaidStatus(row.paymentStatus, settings?.accountsConfig);
  const paymentClaimed = !paid && !!row.guestPaymentClaimed;
  const selfCount = Number(row.trainingCounts?.SELF_60) || 0;
  const baseTotal = Number(row.baseTotalKRW) || 0;
  const finalTotal = Number(row.individualTotalKRW) || 0;
  const savedAmount = baseTotal - finalTotal;
  const hasSaved = baseTotal > 0 && savedAmount > 0;
  const discountPct = hasSaved
    ? Math.round((savedAmount / baseTotal) * 100)
    : 0;
  const isNoRoom = row.roomType === 'NONE' || !row.roomType;
  const roomLabel = formatRoomTypeLabel(row.roomType);
  const transportOn = !!(row.assignedVehicle || row.assignedDriver);

  return (
    <div
      id={`my-guest-${row.resId}_r${row.roomIdx}_g${row.guestIdx}`}
      className="sub-card"
      style={{ marginBottom: 0, padding: 14 }}
    >
      <div className="my-guest-grid">
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 4,
            }}
          >
            <input
              type="checkbox"
              checked={!!selected}
              onChange={onToggleSelect}
              style={{
                width: 18,
                height: 18,
                cursor: 'pointer',
                accentColor: '#3182f6',
              }}
              aria-label={t('예약 선택', 'Select booking')}
            />
            <span className="seq-badge">[#{row.bookingSeq || '0001'}]</span>
          </div>
          <b
            className="list-name"
            style={{ display: 'block', fontSize: 15, marginTop: 6 }}
          >
            {String(row.name || '').toUpperCase() || '—'}
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
            {row.nationality || ''}
            {row.nationality || row.level ? ' | ' : ''}
            {row.level || ''}
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
            {requestedTrainingCount(row) !== actualTrainingCount(row) ? (
              <span style={{ color: '#8b95a1', fontWeight: 700 }}>
                {' '}
                ({t('신청', 'Applied')} {requestedTrainingCount(row)}
                {t('회', 'x')}
                {(Number(row.restDays) || 0) > 0
                  ? ` · ${t('불참', 'Absent')} ${Number(row.restDays)}${t('회', 'x')}`
                  : ''}
                )
              </span>
            ) : null}
          </div>
          <div style={{ fontSize: 11, color: '#8b95a1', marginTop: 4 }}>
            {t('예약자', 'Holder')}: {row.repName || '—'}
          </div>
        </div>

        <div>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#191f28' }}>
            {row.startDate || '—'} ({row.checkInTime || '14:00'}) ~{' '}
            {row.endDate || '—'} ({row.checkOutTime || '11:00'})
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
              {row.dawnCheckIn ? (
                <span className="red-option-box">
                  ✈️ {t('얼리체크인', 'Early-in')}
                </span>
              ) : null}
              {row.lateCheckOut ? (
                <span className="red-option-box">
                  ✈️ {t('레이트아웃', 'Late-out')}
                </span>
              ) : null}
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
            🌙 {t('숙박(일정):', 'Stay (dates):')} {row.billedNights || 0}
            {t('박', 'n')}{' '}
            {isNoRoom ? `(${t('방안씀', 'No Room')})` : `[${roomLabel}]`}
          </div>
        </div>

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
            style={{
              alignSelf: 'flex-start',
              background: transportOn ? '#d3f9d8' : undefined,
              borderColor: transportOn ? '#40c057' : undefined,
            }}
          >
            👤 {row.assignedDriver || t('기사미배정', 'No Driver')}
            {' · '}
            🚐 {row.assignedVehicle || t('차량미배정', 'No Vehicle')}
          </span>
          {row.airportPickup ? (
            <span style={{ color: '#3182f6', fontWeight: 700 }}>
              🛬 {t('픽업', 'Pickup')} {row.pickupTime || '--:--'}
              {row.pickupFlight ? ` (${row.pickupFlight})` : ''}
            </span>
          ) : (
            <span style={{ color: '#8b95a1', fontWeight: 600 }}>
              🛬 {t('픽업 없음', 'No pickup')}
            </span>
          )}
          {row.airportDropoff ? (
            <span style={{ color: '#e03131', fontWeight: 700 }}>
              🛫 {t('드랍', 'Dropoff')} {row.dropoffTime || '--:--'}
              {row.dropoffFlight ? ` (${row.dropoffFlight})` : ''}
            </span>
          ) : (
            <span style={{ color: '#8b95a1', fontWeight: 600 }}>
              🛫 {t('드랍 없음', 'No dropoff')}
            </span>
          )}
        </div>

        <div style={{ textAlign: 'right' }}>
          {hasSaved ? (
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
          <div style={{ fontWeight: 800, color: '#191f28', fontSize: 15 }}>
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
          {hasSaved ? (
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
          {(Number(row.penaltyFee) || 0) > 0 ? (
            <div
              style={{
                fontSize: 11,
                color: '#e03131',
                fontWeight: 800,
                marginTop: 2,
              }}
            >
              ⚠️ {t('패널티', 'Penalty')} ₩
              {formatMoney(row.penaltyFee)}
            </div>
          ) : null}
        </div>

        <div className="action-btn-wrapper" style={{ justifyContent: 'flex-start' }}>
          <button
            type="button"
            className={`status-btn${paymentClaimed ? ' payment-confirm-alert' : ''}`}
            style={{
              margin: 0,
              backgroundColor: paid
                ? '#04c09e'
                : paymentClaimed
                  ? '#f04452'
                  : '#8b95a1',
            }}
            onClick={onPay}
          >
            {paid
              ? `✅ ${row.paymentStatus}`
              : paymentClaimed
                ? t('💳 승인 대기', 'Awaiting confirm')
                : t('💳 결제하기', 'Payment')}
          </button>
          <button
            type="button"
            className="status-btn"
            style={{ margin: 0, backgroundColor: '#f09433' }}
            onClick={onQuote}
          >
            🧾 {t('견적서', 'Quote')}
          </button>
          {hasDiscount ? (
            <button
              type="button"
              className="status-btn"
              style={{ margin: 0, backgroundColor: '#fab005' }}
              onClick={onQuoteDiscount}
            >
              🧾 {t('할인 견적서', 'Disc. quote')}
            </button>
          ) : null}
          <button
            type="button"
            className="status-btn"
            style={{ margin: 0, backgroundColor: '#10b981' }}
            onClick={onApprovalMail}
          >
            ✉️ {t('승인메일 요청', 'Request approval mail')}
          </button>
          <button
            type="button"
            className="status-btn"
            style={{
              margin: 0,
              backgroundColor: transportOn ? '#20c997' : '#8b95a1',
            }}
            onClick={onTransport}
          >
            🚐 {t('차량/기사', 'Transport')}
          </button>
          <button
            type="button"
            className="status-btn"
            style={{
              margin: 0,
              backgroundColor: editing ? '#3182f6' : '#6c757d',
            }}
            disabled={saving}
            onClick={onEdit}
          >
            ✏️ {editing ? t('수정 중', 'Editing') : t('수정', 'Edit')}
          </button>
          <button
            type="button"
            className="status-btn"
            style={{ margin: 0, backgroundColor: '#f04452' }}
            disabled={saving}
            onClick={onDelete}
          >
            🗑️ {t('삭제', 'Delete')}
          </button>
        </div>
      </div>

      {children ? <div style={{ marginTop: 14 }}>{children}</div> : null}
    </div>
  );
}
