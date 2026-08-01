export default function LogsArchiveTab({
  mode,
  t,
  logs,
  trashed,
  onMarkRead,
  onRestore,
  onEmptyTrash,
}) {
  if (mode === 'ARCHIVE') {
    const items = trashed || [];
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
            disabled={items.length === 0}
          >
            {t('휴지통 비우기', 'Empty Trash')}
          </button>
        </div>

        {items.length === 0 && (
          <p style={{ color: 'var(--muted)' }}>
            {t('휴지통이 비어 있습니다.', 'Trash is empty.')}
          </p>
        )}

        {items.map((item) => (
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

  const items = logs || [];
  const unreadCount = items.filter((l) => !l.isRead).length;

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
        <h3 style={{ margin: 0 }}>
          {t('알림 로그', 'Activity Logs')}
          {unreadCount > 0 && (
            <span className="badge badge-new" style={{ marginLeft: 8 }}>
              {unreadCount}
            </span>
          )}
        </h3>
      </div>

      {items.length === 0 && (
        <p style={{ color: 'var(--muted)' }}>{t('로그가 없습니다.', 'No logs.')}</p>
      )}

      {items.map((log) => (
        <div
          key={log.id}
          className="sub-card"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div>
            {!log.isRead && (
              <span className="badge badge-new" style={{ marginRight: 8 }}>
                NEW
              </span>
            )}
            <span>{log.message}</span>
            <div style={{ color: 'var(--muted)', fontSize: 12 }}>
              {log.type} · {log.createdAt}
            </div>
          </div>
          {!log.isRead && (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => onMarkRead?.(log.id)}
            >
              {t('읽음 처리', 'Mark Read')}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
