import { useEffect, useState } from 'react';

function isRoleAdmin(role) {
  return String(role || '').toUpperCase() === 'ADMIN';
}

export default function SettingsTab({
  t,
  settings,
  onPatchSettings,
  role = 'ADMIN',
}) {
  const [exchangeRate, setExchangeRate] = useState(settings.exchangeRate);
  const [roomTypes, setRoomTypes] = useState(() =>
    structuredClone(settings.roomTypesConfig || []),
  );
  const [trainingTypes, setTrainingTypes] = useState(() =>
    structuredClone(settings.trainingTypesConfig || []),
  );
  const [adminId1, setAdminId1] = useState(settings.adminId1 || '');
  const [adminPassword1, setAdminPassword1] = useState(
    settings.adminPassword1 || '',
  );
  const [adminId2, setAdminId2] = useState(settings.adminId2 || '');
  const [adminPassword2, setAdminPassword2] = useState(
    settings.adminPassword2 || '',
  );
  const [accounts, setAccounts] = useState(() =>
    structuredClone(settings.accountsConfig || []),
  );

  useEffect(() => {
    setExchangeRate(settings.exchangeRate);
    setRoomTypes(structuredClone(settings.roomTypesConfig || []));
    setTrainingTypes(structuredClone(settings.trainingTypesConfig || []));
    setAdminId1(settings.adminId1 || '');
    setAdminPassword1(settings.adminPassword1 || '');
    setAdminId2(settings.adminId2 || '');
    setAdminPassword2(settings.adminPassword2 || '');
    setAccounts(structuredClone(settings.accountsConfig || []));
  }, [settings]);

  const updateRoomType = (idx, patch) => {
    setRoomTypes((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)),
    );
  };

  const addRoomType = () => {
    setRoomTypes((prev) => [
      ...prev,
      {
        id: `ROOM_${Date.now()}`,
        nameKO: '',
        nameEN: '',
        priceKRW: 0,
        priceUSD: 0,
        isActive: true,
      },
    ]);
  };

  const removeRoomType = (idx) => {
    setRoomTypes((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateTrainingType = (idx, patch) => {
    setTrainingTypes((prev) =>
      prev.map((tt, i) => (i === idx ? { ...tt, ...patch } : tt)),
    );
  };

  const addTrainingType = () => {
    setTrainingTypes((prev) => [
      ...prev,
      {
        id: `TRAIN_${Date.now()}`,
        name: '',
        priceKRW: 0,
        priceUSD: 0,
        isActive: true,
        isSelfTraining: false,
      },
    ]);
  };

  const removeTrainingType = (idx) => {
    setTrainingTypes((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateAccount = (idx, patch) => {
    setAccounts((prev) =>
      prev.map((a, i) => (i === idx ? { ...a, ...patch } : a)),
    );
  };

  const addAccount = () => {
    setAccounts((prev) => [
      ...prev,
      { bankName: '', accountNumber: '', holder: '' },
    ]);
  };

  const removeAccount = (idx) => {
    setAccounts((prev) => prev.filter((_, i) => i !== idx));
  };

  return (
    <div>
      <div className="card">
        <h3 style={{ marginTop: 0 }}>{t('환율', 'Exchange Rate')}</h3>
        <div className="grid-2">
          <div>
            <label className="label-text">
              {t('원/달러 환율', 'KRW/USD Rate')}
            </label>
            <input
              type="number"
              className="input-field"
              value={exchangeRate}
              onChange={(e) => setExchangeRate(Number(e.target.value) || 0)}
            />
          </div>
        </div>
        <div className="action-row" style={{ marginTop: 12 }}>
          <button
            type="button"
            className="btn-primary"
            style={{ width: 'auto' }}
            onClick={() =>
              onPatchSettings({ exchangeRate: Number(exchangeRate) || 0 })
            }
          >
            {t('환율 저장', 'Save Rate')}
          </button>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>{t('객실 타입', 'Room Types')}</h3>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('한글명', 'Name (KO)')}</th>
                <th>{t('영문명', 'Name (EN)')}</th>
                <th>{t('가격(원)', 'Price (KRW)')}</th>
                <th>{t('가격($)', 'Price (USD)')}</th>
                <th>{t('활성', 'Active')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {roomTypes.map((r, idx) => (
                <tr key={r.id || idx}>
                  <td>
                    <input
                      className="input-field"
                      value={r.nameKO || ''}
                      onChange={(e) =>
                        updateRoomType(idx, { nameKO: e.target.value })
                      }
                    />
                  </td>
                  <td>
                    <input
                      className="input-field"
                      value={r.nameEN || ''}
                      onChange={(e) =>
                        updateRoomType(idx, { nameEN: e.target.value })
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      className="input-field"
                      value={r.priceKRW || 0}
                      onChange={(e) =>
                        updateRoomType(idx, {
                          priceKRW: Number(e.target.value) || 0,
                        })
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      className="input-field"
                      value={r.priceUSD || 0}
                      onChange={(e) =>
                        updateRoomType(idx, {
                          priceUSD: Number(e.target.value) || 0,
                        })
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      checked={r.isActive !== false}
                      onChange={(e) =>
                        updateRoomType(idx, { isActive: e.target.checked })
                      }
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn-danger"
                      onClick={() => removeRoomType(idx)}
                    >
                      {t('삭제', 'Remove')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="action-row" style={{ marginTop: 12 }}>
          <button type="button" className="btn-secondary" onClick={addRoomType}>
            {t('객실 타입 추가', 'Add Room Type')}
          </button>
          <button
            type="button"
            className="btn-primary"
            style={{ width: 'auto' }}
            onClick={() => onPatchSettings({ roomTypesConfig: roomTypes })}
          >
            {t('객실 타입 저장', 'Save Room Types')}
          </button>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>{t('트레이닝 타입', 'Training Types')}</h3>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('이름', 'Name')}</th>
                <th>{t('가격(원)', 'Price (KRW)')}</th>
                <th>{t('가격($)', 'Price (USD)')}</th>
                <th>{t('셀프', 'Self')}</th>
                <th>{t('활성', 'Active')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {trainingTypes.map((tr, idx) => (
                <tr key={tr.id || idx}>
                  <td>
                    <input
                      className="input-field"
                      value={tr.name || ''}
                      onChange={(e) =>
                        updateTrainingType(idx, { name: e.target.value })
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      className="input-field"
                      value={tr.priceKRW || 0}
                      onChange={(e) =>
                        updateTrainingType(idx, {
                          priceKRW: Number(e.target.value) || 0,
                        })
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      className="input-field"
                      value={tr.priceUSD || 0}
                      onChange={(e) =>
                        updateTrainingType(idx, {
                          priceUSD: Number(e.target.value) || 0,
                        })
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      checked={!!tr.isSelfTraining}
                      onChange={(e) =>
                        updateTrainingType(idx, {
                          isSelfTraining: e.target.checked,
                        })
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      checked={tr.isActive !== false}
                      onChange={(e) =>
                        updateTrainingType(idx, { isActive: e.target.checked })
                      }
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn-danger"
                      onClick={() => removeTrainingType(idx)}
                    >
                      {t('삭제', 'Remove')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="action-row" style={{ marginTop: 12 }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={addTrainingType}
          >
            {t('트레이닝 타입 추가', 'Add Training Type')}
          </button>
          <button
            type="button"
            className="btn-primary"
            style={{ width: 'auto' }}
            onClick={() =>
              onPatchSettings({ trainingTypesConfig: trainingTypes })
            }
          >
            {t('트레이닝 타입 저장', 'Save Training Types')}
          </button>
        </div>
      </div>

      {isRoleAdmin(role) && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>{t('관리자 계정', 'Admin Accounts')}</h3>
          <div className="grid-2">
            <div>
              <label className="label-text">{t('관리자1 ID', 'Admin1 ID')}</label>
              <input
                className="input-field"
                value={adminId1}
                onChange={(e) => setAdminId1(e.target.value)}
              />
            </div>
            <div>
              <label className="label-text">
                {t('관리자1 비밀번호', 'Admin1 Password')}
              </label>
              <input
                className="input-field"
                value={adminPassword1}
                onChange={(e) => setAdminPassword1(e.target.value)}
              />
            </div>
            <div>
              <label className="label-text">{t('관리자2 ID', 'Admin2 ID')}</label>
              <input
                className="input-field"
                value={adminId2}
                onChange={(e) => setAdminId2(e.target.value)}
              />
            </div>
            <div>
              <label className="label-text">
                {t('관리자2 비밀번호', 'Admin2 Password')}
              </label>
              <input
                className="input-field"
                value={adminPassword2}
                onChange={(e) => setAdminPassword2(e.target.value)}
              />
            </div>
          </div>
          <div className="action-row" style={{ marginTop: 12 }}>
            <button
              type="button"
              className="btn-primary"
              style={{ width: 'auto' }}
              onClick={() =>
                onPatchSettings({
                  adminId1,
                  adminPassword1,
                  adminId2,
                  adminPassword2,
                })
              }
            >
              {t('계정 저장', 'Save Accounts')}
            </button>
          </div>
        </div>
      )}

      <div className="card">
        <h3 style={{ marginTop: 0 }}>{t('입금 계좌', 'Payment Accounts')}</h3>
        {accounts.map((a, idx) => (
          <div key={idx} className="sub-card grid-2">
            <div>
              <label className="label-text">{t('은행명', 'Bank')}</label>
              <input
                className="input-field"
                value={a.bankName || ''}
                onChange={(e) => updateAccount(idx, { bankName: e.target.value })}
              />
            </div>
            <div>
              <label className="label-text">{t('계좌번호', 'Account No.')}</label>
              <input
                className="input-field"
                value={a.accountNumber || ''}
                onChange={(e) =>
                  updateAccount(idx, { accountNumber: e.target.value })
                }
              />
            </div>
            <div>
              <label className="label-text">{t('예금주', 'Holder')}</label>
              <input
                className="input-field"
                value={a.holder || ''}
                onChange={(e) => updateAccount(idx, { holder: e.target.value })}
              />
            </div>
            <div style={{ alignSelf: 'end' }}>
              <button
                type="button"
                className="btn-danger"
                onClick={() => removeAccount(idx)}
              >
                {t('삭제', 'Remove')}
              </button>
            </div>
          </div>
        ))}
        <div className="action-row" style={{ marginTop: 12 }}>
          <button type="button" className="btn-secondary" onClick={addAccount}>
            {t('계좌 추가', 'Add Account')}
          </button>
          <button
            type="button"
            className="btn-primary"
            style={{ width: 'auto' }}
            onClick={() => onPatchSettings({ accountsConfig: accounts })}
          >
            {t('계좌 저장', 'Save Accounts')}
          </button>
        </div>
      </div>
    </div>
  );
}
