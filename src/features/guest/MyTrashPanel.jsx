import {
  dateSpan,
  formatTrashDate,
  guestSummary,
  trashDaysRemaining,
} from './myReservationUtils';

function formatMoney(n) {
  return Math.round(Number(n) || 0).toLocaleString('en-US');
}

/** Guest My trash list (deleted bookings, 30-day retention). */
export default function MyTrashPanel({
  t,
  items,
  restoringId,
  onRestore,
  onClose,
}) {
  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="modal-sheet"
        style={{ width: 'min(720px, 100%)' }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={t('휴지통', 'Trash')}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 12,
            marginBottom: 12,
          }}
        >
          <div>
            <h3 style={{ margin: 0 }}>🗑️ {t('휴지통', 'Trash')}</h3>
            <p
              style={{
                margin: '6px 0 0',
                fontSize: 12,
                color: '#8b95a1',
              }}
            >
              {t(
                '삭제된 예약은 30일간 보관 후 자동 폐기됩니다. 복구하면 다시 예약 목록에 표시됩니다.',
                'Deleted bookings are kept for 30 days then auto-purged. Restore to show them in your list again.',
              )}
            </p>
          </div>
          <button
            type="button"
            className="btn-secondary"
            style={{ width: 'auto', flexShrink: 0 }}
            onClick={onClose}
          >
            {t('닫기', 'Close')}
          </button>
        </div>

        {items.length === 0 ? (
          <p style={{ color: '#8b95a1', fontSize: 13 }}>
            {t('휴지통이 비어 있습니다.', 'Trash is empty.')}
          </p>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {items.map((item) => {
              const guests = guestSummary(item);
              const daysLeft = trashDaysRemaining(item.trashedAt, 30);
              return (
                <div key={item.id} className="sub-card" style={{ margin: 0 }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 12,
                      flexWrap: 'wrap',
                      alignItems: 'flex-start',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 900, fontSize: 15 }}>
                        {item.repName || '—'}
                      </div>
                      <div
                        style={{
                          fontSize: 13,
                          color: '#6b7684',
                          marginTop: 4,
                        }}
                      >
                        {dateSpan(guests)} · {guests.length}
                        {t('명', ' pax')} ·{' '}
                        {item.paymentStatus || t('대기', 'Pending')}
                      </div>
                      <div
                        style={{
                          fontWeight: 800,
                          marginTop: 6,
                          color: '#191f28',
                        }}
                      >
                        ₩{formatMoney(item.grandTotalKRW)} / $
                        {formatMoney(item.grandTotalUSD)}
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: '#8b95a1',
                          marginTop: 6,
                        }}
                      >
                        {t('삭제일', 'Trashed')}:{' '}
                        {formatTrashDate(item.trashedAt)}
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 800,
                          color: daysLeft <= 7 ? '#f04452' : '#f09433',
                          marginTop: 2,
                        }}
                      >
                        {t(
                          `자동 폐기까지 ${daysLeft}일`,
                          `${daysLeft} day(s) until auto-purge`,
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{ width: 'auto' }}
                      disabled={restoringId === item.id}
                      onClick={() => onRestore(item)}
                    >
                      {restoringId === item.id
                        ? t('복구 중…', 'Restoring…')
                        : t('복구', 'Restore')}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
