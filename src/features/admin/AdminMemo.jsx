import { useState } from 'react';

export default function AdminMemo({ t, value, onSave }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value || '');

  return (
    <div>
      <button
        type="button"
        className="memo-chip"
        onClick={() => {
          setDraft(value || '');
          setOpen((v) => !v);
        }}
      >
        {open
          ? t('메모 접기', 'Collapse memo')
          : value
            ? t('메모 보기', 'View memo')
            : t('메모 추가', 'Add memo')}
      </button>
      {open && (
        <div className="memo-panel">
          <textarea
            className="textarea-field"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t('관리자 메모', 'Admin memo')}
          />
          <div className="action-row" style={{ marginTop: 8 }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setOpen(false)}
            >
              {t('취소', 'Cancel')}
            </button>
            <button
              type="button"
              className="btn-primary"
              style={{ width: 'auto', minWidth: 120 }}
              onClick={async () => {
                await onSave(draft);
                setOpen(false);
              }}
            >
              {t('메모 저장', 'Save memo')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
