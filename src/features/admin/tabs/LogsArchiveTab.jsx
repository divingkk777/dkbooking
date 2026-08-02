import { useMemo, useState } from 'react';
import {
  LIVE_LOG_LIMIT,
  LOG_CATEGORY_META,
  resolveLogCategory,
} from '../../../data/logsRepo';

const FILTERS = ['ALL', 'NEW', 'CANCEL', 'EDIT', 'MAIL', 'PROMO', 'OTHER'];

export default function LogsArchiveTab({
  mode,
  t,
  logs,
  trashed,
  onToggleRead,
  onMarkRead,
  onMarkAllRead,
  onRestore,
  onEmptyTrash,
}) {
  const [category, setCategory] = useState('ALL');
  const [markingAll, setMarkingAll] = useState(false);
  const items = logs || [];

  const filtered = useMemo(() => {
    if (category === 'ALL') return items;
    return items.filter((log) => resolveLogCategory(log) === category);
  }, [items, category]);

  const unreadCount = items.filter((l) => !l.isRead).length;

  const toggleRead = (log) => {
    if (onToggleRead) {
      onToggleRead(log.id, !log.isRead);
      return;
    }
    if (!log.isRead) onMarkRead?.(log.id);
  };

  const markAllRead = async () => {
    if (!onMarkAllRead || unreadCount === 0 || markingAll) return;
    setMarkingAll(true);
    try {
      await onMarkAllRead(
        items.filter((l) => !l.isRead).map((l) => l.id),
      );
    } finally {
      setMarkingAll(false);
    }
  };

  if (mode === 'ARCHIVE') {
    const trashItems = trashed || [];
    return (
      <div className="card">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 12,
          }}
        >
          <h3 style={{ margin: 0 }}>{t('휴지통', 'Trash')}</h3>
          <button
            type="button"
            className="btn-danger"
            onClick={onEmptyTrash}
            disabled={trashItems.length === 0}
          >
            {t('휴지통 비우기', 'Empty Trash')}
          </button>
        </div>
        <p style={{ margin: '0 0 12px', fontSize: 12, color: 'var(--muted)' }}>
          {t(
            '삭제된 예약은 휴지통에 보관되며, 보관 30일 후 자동 폐기됩니다.',
            'Deleted bookings stay in trash and are auto-purged after 30 days.',
          )}
        </p>

        {trashItems.length === 0 && (
          <p style={{ color: 'var(--muted)' }}>
            {t('휴지통이 비어 있습니다.', 'Trash is empty.')}
          </p>
        )}

        {trashItems.map((item) => (
          <div key={item.id} className="sub-card">
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <div>
                <strong>{item.repName}</strong>
                <div style={{ color: 'var(--muted)', fontSize: 12 }}>
                  {item.bookingInstructor} · {t('삭제일', 'Trashed at')}:{' '}
                  {item.trashedAt}
                </div>
              </div>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => onRestore?.(item)}
              >
                {t('복구', 'Restore')}
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="card">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <h3 style={{ margin: 0 }}>
          {t('알림 로그', 'Activity Logs')}
          {unreadCount > 0 && (
            <span className="badge badge-new" style={{ marginLeft: 8 }}>
              {unreadCount}
            </span>
          )}
        </h3>
        <button
          type="button"
          className="btn-secondary"
          style={{ width: 'auto', minWidth: 96 }}
          disabled={unreadCount === 0 || markingAll || !onMarkAllRead}
          onClick={markAllRead}
        >
          {markingAll
            ? t('처리 중…', 'Working…')
            : t('모두읽음', 'Mark all read')}
        </button>
      </div>
      <p style={{ margin: '0 0 12px', fontSize: 12, color: 'var(--muted)' }}>
        {t(
          `최근 ${LIVE_LOG_LIMIT}건만 표시합니다. 초과분은 묶음 보관소로 옮기며 화면에는 불러오지 않습니다.`,
          `Showing the latest ${LIVE_LOG_LIMIT} only. Older logs are bundled into archive storage and not loaded here.`,
        )}
      </p>

      <div className="log-filter-row">
        {FILTERS.map((key) => {
          const meta = LOG_CATEGORY_META[key];
          const count =
            key === 'ALL'
              ? items.length
              : items.filter((l) => resolveLogCategory(l) === key).length;
          if (key !== 'ALL' && count === 0) return null;
          return (
            <button
              key={key}
              type="button"
              className={
                category === key ? 'log-filter-chip active' : 'log-filter-chip'
              }
              onClick={() => setCategory(key)}
            >
              {t(meta.ko, meta.en)}
              <span className="log-filter-count">{count}</span>
            </button>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <p style={{ color: 'var(--muted)' }}>
          {t('로그가 없습니다.', 'No logs.')}
        </p>
      )}

      {filtered.map((log) => {
        const cat = resolveLogCategory(log);
        const catMeta = LOG_CATEGORY_META[cat] || LOG_CATEGORY_META.OTHER;
        const unread = !log.isRead;
        return (
          <div key={log.id} className="log-card">
            <div className="log-card-main">
              <button
                type="button"
                className={unread ? 'log-new-btn active' : 'log-new-btn'}
                title={
                  unread
                    ? t('클릭하면 읽음 처리', 'Click to mark as read')
                    : t('클릭하면 NEW로 다시 표시', 'Click to mark as NEW again')
                }
                onClick={() => toggleRead(log)}
              >
                NEW
              </button>
              <div className="log-card-body">
                <div className="log-card-message">{log.message}</div>
                <div className="log-card-meta">
                  <span className="log-cat-pill">
                    {t(catMeta.ko, catMeta.en)}
                  </span>
                  <span>
                    {log.actor ? `${log.actor} · ` : ''}
                    {log.type || '-'} · {log.createdAt}
                  </span>
                </div>
              </div>
            </div>
            <button
              type="button"
              className="btn-secondary log-read-btn"
              onClick={() => toggleRead(log)}
            >
              {unread
                ? t('읽음 처리', 'Mark Read')
                : t('NEW로 표시', 'Mark NEW')}
            </button>
          </div>
        );
      })}
    </div>
  );
}
