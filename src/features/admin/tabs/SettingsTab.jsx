import { useEffect, useState } from 'react';
import { formatMoney } from '../../../domain/pricing';
import { useToast } from '../../../ui/ToastContext';

function StatusToggle({ on, onClick, onLabel, offLabel, color }) {
  return (
    <button
      type="button"
      className="status-btn"
      onClick={onClick}
      style={{
        backgroundColor: on ? color : '#8b95a1',
        fontSize: 11,
        padding: '5px 10px',
      }}
    >
      {on ? onLabel : offLabel}
    </button>
  );
}

function ManagerCard({ title, color, hint, children, addBar, footer }) {
  return (
    <div className="card" style={{ border: `2px solid ${color}` }}>
      <h4 style={{ marginTop: 0, color, fontSize: 17 }}>{title}</h4>
      {hint ? (
        <p style={{ fontSize: 12, color: '#6b7684', marginBottom: 16 }}>{hint}</p>
      ) : null}
      {addBar}
      {children}
      {footer}
    </div>
  );
}

export default function SettingsTab({
  t,
  settings,
  onPatchSettings,
  role = 'ADMIN',
}) {
  const toast = useToast();
  const isFullAdmin = String(role || '').toUpperCase() === 'ADMIN';

  const [exchangeRate, setExchangeRate] = useState(settings.exchangeRate);
  const [trainingTypes, setTrainingTypes] = useState(() =>
    structuredClone(settings.trainingTypesConfig || []),
  );
  const [roomTypes, setRoomTypes] = useState(() =>
    structuredClone(settings.roomTypesConfig || []),
  );
  const [accounts, setAccounts] = useState(() =>
    structuredClone(settings.accountsConfig || []),
  );
  const [units, setUnits] = useState(() =>
    structuredClone(settings.unitsConfig || []),
  );
  const [vehicles, setVehicles] = useState(() =>
    structuredClone(settings.vehiclesConfig || []),
  );
  const [drivers, setDrivers] = useState(() =>
    structuredClone(settings.driversConfig || []),
  );
  const [safety, setSafety] = useState(() =>
    structuredClone(settings.safetyInstructorsConfig || []),
  );

  const [adminId1, setAdminId1] = useState(settings.adminId1 || '');
  const [adminPassword1, setAdminPassword1] = useState(
    settings.adminPassword1 || '',
  );
  const [adminId2, setAdminId2] = useState(settings.adminId2 || '');
  const [adminPassword2, setAdminPassword2] = useState(
    settings.adminPassword2 || '',
  );

  const [newTraining, setNewTraining] = useState({
    name: '',
    priceKRW: '',
    priceUSD: '',
    isSelfTraining: false,
  });
  const [newRoom, setNewRoom] = useState({
    id: '',
    nameKO: '',
    nameEN: '',
    priceKRW: '',
    priceUSD: '',
  });
  const [newAccount, setNewAccount] = useState('');
  const [newUnit, setNewUnit] = useState({
    nameKO: '',
    nameEN: '',
    lines: 4,
  });
  const [newVehicle, setNewVehicle] = useState({
    nameKO: '',
    nameEN: '',
    capacity: 10,
  });
  const [newDriver, setNewDriver] = useState({ name: '', phone: '' });
  const [newSafety, setNewSafety] = useState({ name: '', phone: '' });

  useEffect(() => {
    setExchangeRate(settings.exchangeRate);
    setTrainingTypes(structuredClone(settings.trainingTypesConfig || []));
    setRoomTypes(structuredClone(settings.roomTypesConfig || []));
    setAccounts(structuredClone(settings.accountsConfig || []));
    setUnits(structuredClone(settings.unitsConfig || []));
    setVehicles(structuredClone(settings.vehiclesConfig || []));
    setDrivers(structuredClone(settings.driversConfig || []));
    setSafety(structuredClone(settings.safetyInstructorsConfig || []));
    setAdminId1(settings.adminId1 || '');
    setAdminPassword1(settings.adminPassword1 || '');
    setAdminId2(settings.adminId2 || '');
    setAdminPassword2(settings.adminPassword2 || '');
  }, [settings]);

  const save = async (partial, okMsg) => {
    try {
      await onPatchSettings(partial);
      if (okMsg) toast.success(okMsg);
    } catch (e) {
      toast.error(e.message || String(e));
    }
  };

  const moveTraining = (idx, dir) => {
    setTrainingTypes((prev) => {
      const next = [...prev];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });
  };

  const addTraining = () => {
    if (!newTraining.name.trim()) {
      toast.error(t('트레이닝 명칭을 입력해 주세요.', 'Training name required.'));
      return;
    }
    setTrainingTypes((prev) => [
      ...prev,
      {
        id: `TRAIN_${Date.now()}`,
        name: newTraining.name.trim(),
        priceKRW: Number(newTraining.priceKRW) || 0,
        priceUSD: Number(newTraining.priceUSD) || 0,
        isActive: true,
        isSelfTraining: !!newTraining.isSelfTraining,
      },
    ]);
    setNewTraining({
      name: '',
      priceKRW: '',
      priceUSD: '',
      isSelfTraining: false,
    });
  };

  const addRoom = async () => {
    const id = newRoom.id.trim().toUpperCase();
    if (!id || !newRoom.nameKO.trim()) {
      toast.error(
        t('룸 타입 ID와 한글명을 입력해 주세요.', 'Room ID and Korean name required.'),
      );
      return;
    }
    if (roomTypes.some((r) => r.id === id)) {
      toast.error(t('이미 존재하는 ID입니다.', 'Room ID already exists.'));
      return;
    }
    const next = [
      ...roomTypes,
      {
        id,
        nameKO: newRoom.nameKO.trim(),
        nameEN: newRoom.nameEN.trim() || newRoom.nameKO.trim(),
        priceKRW: Number(newRoom.priceKRW) || 0,
        priceUSD: Number(newRoom.priceUSD) || 0,
        isActive: true,
      },
    ];
    setRoomTypes(next);
    setNewRoom({
      id: '',
      nameKO: '',
      nameEN: '',
      priceKRW: '',
      priceUSD: '',
    });
    await save(
      { roomTypesConfig: next },
      t('룸 타입 설정이 저장되었습니다.', 'Saved room types config.'),
    );
  };

  const patchRooms = async (next) => {
    setRoomTypes(next);
    await save(
      { roomTypesConfig: next },
      t('룸 타입 설정이 저장되었습니다.', 'Saved room types config.'),
    );
  };

  const addAccount = async () => {
    const name = newAccount.trim().toUpperCase();
    if (!name) {
      toast.error(t('어카운트명을 입력해 주세요.', 'Account name required.'));
      return;
    }
    const next = [
      ...accounts,
      { id: `acc_${Date.now()}`, name, isActive: true },
    ];
    setAccounts(next);
    setNewAccount('');
    await save(
      { accountsConfig: next },
      t('결제 어카운트 설정이 저장되었습니다.', 'Saved payment accounts config.'),
    );
  };

  const patchAccounts = async (next) => {
    setAccounts(next);
    await save(
      { accountsConfig: next },
      t('결제 어카운트 설정이 저장되었습니다.', 'Saved payment accounts config.'),
    );
  };

  const addUnit = async () => {
    if (!newUnit.nameKO.trim()) {
      toast.error(t('유닛 한글명을 입력해 주세요.', 'Unit name required.'));
      return;
    }
    const next = [
      ...units,
      {
        id: `u_${Date.now()}`,
        nameKO: newUnit.nameKO.trim(),
        nameEN: newUnit.nameEN.trim() || newUnit.nameKO.trim(),
        lines: Math.max(1, Number(newUnit.lines) || 4),
        isActive: true,
      },
    ];
    setUnits(next);
    setNewUnit({ nameKO: '', nameEN: '', lines: 4 });
    await save(
      { unitsConfig: next },
      t('유닛 설정이 저장되었습니다.', 'Saved units config.'),
    );
  };

  const patchUnits = async (next) => {
    setUnits(next);
    await save(
      { unitsConfig: next },
      t('유닛 설정이 저장되었습니다.', 'Saved units config.'),
    );
  };

  const addVehicle = async () => {
    if (!newVehicle.nameKO.trim()) {
      toast.error(t('차량 한글명을 입력해 주세요.', 'Vehicle name required.'));
      return;
    }
    const next = [
      ...vehicles,
      {
        id: `v_${Date.now()}`,
        nameKO: newVehicle.nameKO.trim(),
        nameEN: newVehicle.nameEN.trim() || newVehicle.nameKO.trim(),
        capacity: Math.max(1, Number(newVehicle.capacity) || 10),
        isActive: true,
      },
    ];
    setVehicles(next);
    setNewVehicle({ nameKO: '', nameEN: '', capacity: 10 });
    await save(
      { vehiclesConfig: next },
      t('차량 설정이 저장되었습니다.', 'Saved vehicles config.'),
    );
  };

  const patchVehicles = async (next) => {
    setVehicles(next);
    await save(
      { vehiclesConfig: next },
      t('차량 설정이 저장되었습니다.', 'Saved vehicles config.'),
    );
  };

  const addDriver = async () => {
    if (!newDriver.name.trim()) {
      toast.error(t('드라이버 이름을 입력해 주세요.', 'Driver name required.'));
      return;
    }
    const next = [
      ...drivers,
      {
        id: `d_${Date.now()}`,
        name: newDriver.name.trim(),
        phone: newDriver.phone.trim() || 'N/A',
        isActive: true,
      },
    ];
    setDrivers(next);
    setNewDriver({ name: '', phone: '' });
    await save(
      { driversConfig: next },
      t('드라이버 설정이 저장되었습니다.', 'Saved drivers config.'),
    );
  };

  const patchDrivers = async (next) => {
    setDrivers(next);
    await save(
      { driversConfig: next },
      t('드라이버 설정이 저장되었습니다.', 'Saved drivers config.'),
    );
  };

  const addSafety = async () => {
    if (!newSafety.name.trim()) {
      toast.error(
        t('강사 이름을 입력해 주세요.', 'Safety instructor name required.'),
      );
      return;
    }
    const next = [
      ...safety,
      {
        id: `si_${Date.now()}`,
        name: newSafety.name.trim(),
        phone: newSafety.phone.trim() || 'N/A',
        isActive: true,
      },
    ];
    setSafety(next);
    setNewSafety({ name: '', phone: '' });
    await save(
      { safetyInstructorsConfig: next },
      t('세이프티 강사 설정이 저장되었습니다.', 'Saved safety instructors config.'),
    );
  };

  const patchSafety = async (next) => {
    setSafety(next);
    await save(
      { safetyInstructorsConfig: next },
      t('세이프티 강사 설정이 저장되었습니다.', 'Saved safety instructors config.'),
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div className="sub-card">
        <h4 style={{ marginTop: 0 }}>
          ⚙️ {t('기본 환경 설정', 'Basic Settings')}
        </h4>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <label className="label-text" style={{ margin: 0 }}>
            {t('USD 적용 환율 (₩):', 'USD Exchange Rate (₩):')}
          </label>
          <input
            className="input-field"
            type="number"
            value={exchangeRate}
            onChange={(e) => setExchangeRate(Number(e.target.value) || 0)}
            style={{ width: 140 }}
          />
          <button
            type="button"
            className="btn-primary"
            style={{ width: 'auto' }}
            onClick={() =>
              save(
                { exchangeRate: Number(exchangeRate) || 0 },
                t('환율이 저장되었습니다.', 'Exchange rate saved.'),
              )
            }
          >
            {t('환율 저장', 'Save Rate')}
          </button>
        </div>
      </div>

      <ManagerCard
        color="#0ca678"
        title={`🏊‍♂️ ${t('신청 트레이닝 종류 & 금액 설정 관리자', 'Training Type & Price Manager')}`}
        hint={t(
          '▲/▼ 버튼으로 예약창 출력 순서를 변경하고, 명칭이나 단가를 실시간 수정합니다. 셀프지정 시 세이프티 강사 작성이 필수입니다.',
          'Change order, rename titles, set prices, and toggle Self Mode.',
        )}
        addBar={
          <div
            style={{
              display: 'flex',
              gap: 8,
              flexWrap: 'wrap',
              marginBottom: 20,
              backgroundColor: '#e6fcf5',
              padding: 14,
              borderRadius: 12,
              border: '1px solid #96f2d7',
              alignItems: 'center',
            }}
          >
            <input
              className="input-field"
              placeholder={t('트레이닝 명칭 (예: MAX 150)', 'Training Name')}
              value={newTraining.name}
              onChange={(e) =>
                setNewTraining((p) => ({ ...p, name: e.target.value }))
              }
              style={{ width: 160 }}
            />
            <input
              type="number"
              className="input-field"
              placeholder={t('1회 정가(₩)', 'Price(KRW)')}
              value={newTraining.priceKRW}
              onChange={(e) =>
                setNewTraining((p) => ({ ...p, priceKRW: e.target.value }))
              }
              style={{ width: 120 }}
            />
            <input
              type="number"
              className="input-field"
              placeholder={t('1회 정가($)', 'Price(USD)')}
              value={newTraining.priceUSD}
              onChange={(e) =>
                setNewTraining((p) => ({ ...p, priceUSD: e.target.value }))
              }
              style={{ width: 100 }}
            />
            <label className="check-label" style={{ fontWeight: 700, color: '#f04452', margin: '0 6px' }}>
              <input
                type="checkbox"
                checked={newTraining.isSelfTraining}
                onChange={(e) =>
                  setNewTraining((p) => ({
                    ...p,
                    isSelfTraining: e.target.checked,
                  }))
                }
              />{' '}
              {t('셀프 지정', 'Self')}
            </label>
            <button
              type="button"
              className="btn-primary"
              style={{ width: 'auto', backgroundColor: '#0ca678' }}
              onClick={addTraining}
            >
              + {t('트레이닝 추가', 'Add Training')}
            </button>
          </div>
        }
        footer={
          <button
            type="button"
            className="btn-primary"
            style={{ marginTop: 14, backgroundColor: '#3182f6' }}
            onClick={() =>
              save(
                { trainingTypesConfig: trainingTypes },
                t(
                  '트레이닝 명칭 및 단가가 저장되었습니다.',
                  'Saved training changes.',
                ),
              )
            }
          >
            💾 {t('트레이닝 수정사항 DB에 최종 저장하기', 'Save Training Changes')}
          </button>
        }
      >
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr style={{ backgroundColor: '#e6fcf5', color: '#0ca678' }}>
                <th style={{ width: 90, textAlign: 'center' }}>
                  {t('순서', 'Order')}
                </th>
                <th>{t('트레이닝 명칭', 'Training Name')}</th>
                <th>{t('1회 수강료 (KRW / USD)', 'Price per Session')}</th>
                <th style={{ textAlign: 'center' }}>{t('셀프지정', 'Self')}</th>
                <th style={{ textAlign: 'center' }}>{t('가동여부', 'Status')}</th>
                <th style={{ textAlign: 'center' }}>{t('삭제', 'Delete')}</th>
              </tr>
            </thead>
            <tbody>
              {trainingTypes.map((tr, idx) => (
                <tr key={tr.id || idx}>
                  <td style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                      <button
                        type="button"
                        className="status-btn"
                        disabled={idx === 0}
                        onClick={() => moveTraining(idx, -1)}
                        style={{
                          backgroundColor: idx === 0 ? '#e5e8eb' : '#333d4b',
                          padding: '4px 8px',
                        }}
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        className="status-btn"
                        disabled={idx === trainingTypes.length - 1}
                        onClick={() => moveTraining(idx, 1)}
                        style={{
                          backgroundColor:
                            idx === trainingTypes.length - 1 ? '#e5e8eb' : '#333d4b',
                          padding: '4px 8px',
                        }}
                      >
                        ▼
                      </button>
                    </div>
                  </td>
                  <td>
                    <input
                      className="input-field"
                      value={tr.name || ''}
                      onChange={(e) =>
                        setTrainingTypes((prev) =>
                          prev.map((x, i) =>
                            i === idx ? { ...x, name: e.target.value } : x,
                          ),
                        )
                      }
                      style={{ fontWeight: 700, color: '#0ca678' }}
                    />
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>₩</span>
                      <input
                        type="number"
                        className="input-field"
                        value={tr.priceKRW ?? 0}
                        onChange={(e) =>
                          setTrainingTypes((prev) =>
                            prev.map((x, i) =>
                              i === idx
                                ? { ...x, priceKRW: Number(e.target.value) || 0 }
                                : x,
                            ),
                          )
                        }
                        style={{ width: 100, fontSize: 12 }}
                      />
                      <span>/ $</span>
                      <input
                        type="number"
                        className="input-field"
                        value={tr.priceUSD ?? 0}
                        onChange={(e) =>
                          setTrainingTypes((prev) =>
                            prev.map((x, i) =>
                              i === idx
                                ? { ...x, priceUSD: Number(e.target.value) || 0 }
                                : x,
                            ),
                          )
                        }
                        style={{ width: 80, fontSize: 12 }}
                      />
                    </div>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <StatusToggle
                      on={!!tr.isSelfTraining}
                      color="#f04452"
                      onLabel={t('셀프 (ON)', 'Self')}
                      offLabel={t('일반 (OFF)', 'Normal')}
                      onClick={() =>
                        setTrainingTypes((prev) =>
                          prev.map((x, i) =>
                            i === idx
                              ? { ...x, isSelfTraining: !x.isSelfTraining }
                              : x,
                          ),
                        )
                      }
                    />
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <StatusToggle
                      on={tr.isActive !== false}
                      color="#0ca678"
                      onLabel={t('활성', 'ON')}
                      offLabel={t('비활성', 'OFF')}
                      onClick={() =>
                        setTrainingTypes((prev) =>
                          prev.map((x, i) =>
                            i === idx ? { ...x, isActive: x.isActive === false } : x,
                          ),
                        )
                      }
                    />
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <button
                      type="button"
                      className="status-btn"
                      style={{ backgroundColor: '#f04452', fontSize: 11 }}
                      onClick={() => {
                        if (
                          !window.confirm(
                            t(
                              '정말 이 트레이닝 항목을 삭제하시겠습니까?',
                              'Delete this training type?',
                            ),
                          )
                        ) {
                          return;
                        }
                        setTrainingTypes((prev) => prev.filter((_, i) => i !== idx));
                      }}
                    >
                      {t('삭제', 'Delete')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ManagerCard>

      <ManagerCard
        color="#3182f6"
        title={`🏨 ${t('룸 타입(객실) 설정 관리자', 'Room Type Manager')}`}
        hint={t(
          '신규 객실 타입을 생성하고 1박당 가격(KRW/USD) 및 가동(ON/OFF) 여부를 관리합니다.',
          'Create room types, set prices (KRW/USD), and toggle active status.',
        )}
        addBar={
          <div
            style={{
              display: 'flex',
              gap: 8,
              flexWrap: 'wrap',
              marginBottom: 20,
              backgroundColor: '#f4f8ff',
              padding: 14,
              borderRadius: 12,
              border: '1px solid #e8f3ff',
            }}
          >
            <input
              className="input-field"
              placeholder="ID (예: TWIN)"
              value={newRoom.id}
              onChange={(e) => setNewRoom((p) => ({ ...p, id: e.target.value }))}
              style={{ width: 130 }}
            />
            <input
              className="input-field"
              placeholder={t('한글 객실명', 'Name KO')}
              value={newRoom.nameKO}
              onChange={(e) =>
                setNewRoom((p) => ({ ...p, nameKO: e.target.value }))
              }
              style={{ width: 130 }}
            />
            <input
              className="input-field"
              placeholder={t('영문 객실명', 'Name EN')}
              value={newRoom.nameEN}
              onChange={(e) =>
                setNewRoom((p) => ({ ...p, nameEN: e.target.value }))
              }
              style={{ width: 130 }}
            />
            <input
              type="number"
              className="input-field"
              placeholder={t('1박 정가(₩)', 'KRW')}
              value={newRoom.priceKRW}
              onChange={(e) =>
                setNewRoom((p) => ({ ...p, priceKRW: e.target.value }))
              }
              style={{ width: 120 }}
            />
            <input
              type="number"
              className="input-field"
              placeholder={t('1박 정가($)', 'USD')}
              value={newRoom.priceUSD}
              onChange={(e) =>
                setNewRoom((p) => ({ ...p, priceUSD: e.target.value }))
              }
              style={{ width: 100 }}
            />
            <button
              type="button"
              className="btn-primary"
              style={{ width: 'auto', backgroundColor: '#3182f6' }}
              onClick={addRoom}
            >
              + {t('룸 타입 추가', 'Add Room Type')}
            </button>
          </div>
        }
      >
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr style={{ backgroundColor: '#e8f3ff', color: '#1b64da' }}>
                <th>ID</th>
                <th>{t('객실 명칭 (한글 / 영문)', 'Room Name')}</th>
                <th>{t('1박 정가 (KRW / USD)', 'Nightly Rate')}</th>
                <th style={{ textAlign: 'center' }}>{t('가동 여부', 'Status')}</th>
                <th style={{ textAlign: 'center' }}>{t('삭제', 'Delete')}</th>
              </tr>
            </thead>
            <tbody>
              {roomTypes.map((r) => (
                <tr key={r.id}>
                  <td>
                    <b style={{ color: '#1b64da' }}>{r.id}</b>
                  </td>
                  <td>
                    <b>{r.nameKO}</b>{' '}
                    <span style={{ fontSize: 12, color: '#8b95a1' }}>
                      ({r.nameEN})
                    </span>
                  </td>
                  <td style={{ fontWeight: 700 }}>
                    ₩{formatMoney(r.priceKRW || 0)} / ${formatMoney(r.priceUSD || 0)}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <StatusToggle
                      on={r.isActive !== false}
                      color="#0ca678"
                      onLabel={t('활성 (ON)', 'Active')}
                      offLabel={t('비활성 (OFF)', 'Inactive')}
                      onClick={() =>
                        patchRooms(
                          roomTypes.map((x) =>
                            x.id === r.id
                              ? { ...x, isActive: x.isActive === false }
                              : x,
                          ),
                        )
                      }
                    />
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <button
                      type="button"
                      className="status-btn"
                      style={{ backgroundColor: '#f04452', fontSize: 11 }}
                      onClick={() => {
                        if (
                          !window.confirm(
                            t(
                              '정말 이 룸 타입을 삭제하시겠습니까?',
                              'Delete this room type?',
                            ),
                          )
                        ) {
                          return;
                        }
                        patchRooms(roomTypes.filter((x) => x.id !== r.id));
                      }}
                    >
                      {t('삭제', 'Delete')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ManagerCard>

      <ManagerCard
        color="#0ca678"
        title={`💳 ${t('입금/결제 어카운트 동적 관리자', 'Payment Account Manager')}`}
        hint={t(
          '결제 처리 시 사용할 어카운트 명칭을 추가하거나 활성(ON)/비활성(OFF) 상태를 설정합니다.',
          'Manage payment account names and ON/OFF toggle status.',
        )}
        addBar={
          <div
            style={{
              display: 'flex',
              gap: 10,
              marginBottom: 20,
              maxWidth: 420,
            }}
          >
            <input
              className="input-field"
              placeholder={t(
                '새 어카운트명 (예: KAKAO, CASH)',
                'New account name',
              )}
              value={newAccount}
              onChange={(e) => setNewAccount(e.target.value)}
            />
            <button
              type="button"
              className="btn-primary"
              style={{ width: 'auto', backgroundColor: '#0ca678', whiteSpace: 'nowrap' }}
              onClick={addAccount}
            >
              + {t('어카운트 추가', 'Add Account')}
            </button>
          </div>
        }
      >
        <div className="table-wrap">
          <table className="data-table" style={{ maxWidth: 600 }}>
            <thead>
              <tr style={{ backgroundColor: '#e6fcf5', color: '#0ca678' }}>
                <th>No.</th>
                <th>{t('어카운트 명칭', 'Account Name')}</th>
                <th style={{ textAlign: 'center' }}>{t('활성화 상태', 'Status')}</th>
                <th style={{ textAlign: 'center' }}>{t('삭제', 'Delete')}</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((a, idx) => (
                <tr key={a.id || idx}>
                  <td style={{ textAlign: 'center', fontWeight: 700 }}>{idx + 1}</td>
                  <td>
                    <b>💳 {a.name}</b>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <StatusToggle
                      on={a.isActive !== false}
                      color="#0ca678"
                      onLabel={t('활성 (ON)', 'Active')}
                      offLabel={t('비활성 (OFF)', 'Inactive')}
                      onClick={() =>
                        patchAccounts(
                          accounts.map((x) =>
                            x.id === a.id
                              ? { ...x, isActive: x.isActive === false }
                              : x,
                          ),
                        )
                      }
                    />
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <button
                      type="button"
                      className="status-btn"
                      style={{ backgroundColor: '#f04452', fontSize: 11 }}
                      onClick={() => {
                        if (
                          !window.confirm(
                            t(
                              '정말 이 어카운트를 삭제하시겠습니까?',
                              'Delete this account?',
                            ),
                          )
                        ) {
                          return;
                        }
                        patchAccounts(accounts.filter((x) => x.id !== a.id));
                      }}
                    >
                      {t('삭제', 'Delete')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ManagerCard>

      <ManagerCard
        color="#7950f2"
        title={`🚢 ${t('다이빙 유닛(배) 및 라인 관리자', 'Diving Boat & Line Manager')}`}
        addBar={
          <div
            style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}
          >
            <input
              className="input-field"
              placeholder={t('유닛 한글명 (예: 방카)', 'Unit KO')}
              value={newUnit.nameKO}
              onChange={(e) =>
                setNewUnit((p) => ({ ...p, nameKO: e.target.value }))
              }
              style={{ width: 150 }}
            />
            <input
              className="input-field"
              placeholder={t('유닛 영문명', 'Unit EN')}
              value={newUnit.nameEN}
              onChange={(e) =>
                setNewUnit((p) => ({ ...p, nameEN: e.target.value }))
              }
              style={{ width: 150 }}
            />
            <input
              type="number"
              className="input-field"
              placeholder={t('라인 수', 'Lines')}
              value={newUnit.lines}
              onChange={(e) =>
                setNewUnit((p) => ({ ...p, lines: e.target.value }))
              }
              style={{ width: 90 }}
            />
            <button
              type="button"
              className="btn-primary"
              style={{ width: 'auto', backgroundColor: '#7950f2' }}
              onClick={addUnit}
            >
              + {t('유닛 추가', 'Add Unit')}
            </button>
          </div>
        }
      >
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr style={{ backgroundColor: '#f3f0ff', color: '#5f3dc4' }}>
                <th>{t('유닛 명칭', 'Unit Name')}</th>
                <th>{t('운용 라인 수', 'Lines')}</th>
                <th style={{ textAlign: 'center' }}>{t('가동 상태', 'Status')}</th>
                <th style={{ textAlign: 'center' }}>{t('삭제', 'Delete')}</th>
              </tr>
            </thead>
            <tbody>
              {units.map((u) => (
                <tr key={u.id}>
                  <td>
                    <b>{u.nameKO}</b>{' '}
                    <span style={{ color: '#8b95a1', fontSize: 12 }}>
                      ({u.nameEN})
                    </span>
                  </td>
                  <td>
                    <b>
                      {u.lines}
                      {t('개 라인', ' Lines')}
                    </b>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <StatusToggle
                      on={u.isActive !== false}
                      color="#7950f2"
                      onLabel={t('활성 (ON)', 'Active')}
                      offLabel={t('비활성 (OFF)', 'Inactive')}
                      onClick={() =>
                        patchUnits(
                          units.map((x) =>
                            x.id === u.id
                              ? { ...x, isActive: x.isActive === false }
                              : x,
                          ),
                        )
                      }
                    />
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <button
                      type="button"
                      className="status-btn"
                      style={{ backgroundColor: '#f04452', fontSize: 11 }}
                      onClick={() => {
                        if (
                          !window.confirm(
                            t('정말 이 유닛을 삭제하시겠습니까?', 'Delete this unit?'),
                          )
                        ) {
                          return;
                        }
                        patchUnits(units.filter((x) => x.id !== u.id));
                      }}
                    >
                      {t('삭제', 'Delete')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ManagerCard>

      <ManagerCard
        color="#20c997"
        title={`🚐 ${t('수송 차량 관리자', 'Transport Vehicle Manager')}`}
        addBar={
          <div
            style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}
          >
            <input
              className="input-field"
              placeholder={t('차량 한글명', 'Vehicle KO')}
              value={newVehicle.nameKO}
              onChange={(e) =>
                setNewVehicle((p) => ({ ...p, nameKO: e.target.value }))
              }
              style={{ width: 150 }}
            />
            <input
              className="input-field"
              placeholder={t('차량 영문명', 'Vehicle EN')}
              value={newVehicle.nameEN}
              onChange={(e) =>
                setNewVehicle((p) => ({ ...p, nameEN: e.target.value }))
              }
              style={{ width: 150 }}
            />
            <input
              type="number"
              className="input-field"
              placeholder={t('탑승 정원', 'Capacity')}
              value={newVehicle.capacity}
              onChange={(e) =>
                setNewVehicle((p) => ({ ...p, capacity: e.target.value }))
              }
              style={{ width: 100 }}
            />
            <button
              type="button"
              className="btn-primary"
              style={{ width: 'auto', backgroundColor: '#20c997' }}
              onClick={addVehicle}
            >
              + {t('차량 추가', 'Add Vehicle')}
            </button>
          </div>
        }
      >
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr style={{ backgroundColor: '#e6fcf5', color: '#0ca678' }}>
                <th>{t('차량 명칭', 'Vehicle Name')}</th>
                <th>{t('탑승 정원', 'Capacity')}</th>
                <th style={{ textAlign: 'center' }}>{t('가동 상태', 'Status')}</th>
                <th style={{ textAlign: 'center' }}>{t('삭제', 'Delete')}</th>
              </tr>
            </thead>
            <tbody>
              {vehicles.map((v) => (
                <tr key={v.id}>
                  <td>
                    <b>{v.nameKO}</b>{' '}
                    <span style={{ color: '#8b95a1', fontSize: 12 }}>
                      ({v.nameEN})
                    </span>
                  </td>
                  <td>
                    <b>
                      {v.capacity}
                      {t('명', ' pax')}
                    </b>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <StatusToggle
                      on={v.isActive !== false}
                      color="#20c997"
                      onLabel={t('활성 (ON)', 'Active')}
                      offLabel={t('비활성 (OFF)', 'Inactive')}
                      onClick={() =>
                        patchVehicles(
                          vehicles.map((x) =>
                            x.id === v.id
                              ? { ...x, isActive: x.isActive === false }
                              : x,
                          ),
                        )
                      }
                    />
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <button
                      type="button"
                      className="status-btn"
                      style={{ backgroundColor: '#f04452', fontSize: 11 }}
                      onClick={() => {
                        if (
                          !window.confirm(
                            t(
                              '정말 이 차량을 삭제하시겠습니까?',
                              'Delete this vehicle?',
                            ),
                          )
                        ) {
                          return;
                        }
                        patchVehicles(vehicles.filter((x) => x.id !== v.id));
                      }}
                    >
                      {t('삭제', 'Delete')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ManagerCard>

      <ManagerCard
        color="#f09433"
        title={`👤 ${t('담당 드라이버 관리자', 'Driver Manager')}`}
        addBar={
          <div
            style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}
          >
            <input
              className="input-field"
              placeholder={t('드라이버 성명', 'Driver name')}
              value={newDriver.name}
              onChange={(e) =>
                setNewDriver((p) => ({ ...p, name: e.target.value }))
              }
              style={{ width: 160 }}
            />
            <input
              className="input-field"
              placeholder={t('연락처', 'Phone')}
              value={newDriver.phone}
              onChange={(e) =>
                setNewDriver((p) => ({ ...p, phone: e.target.value }))
              }
              style={{ width: 180 }}
            />
            <button
              type="button"
              className="btn-primary"
              style={{ width: 'auto', backgroundColor: '#f09433' }}
              onClick={addDriver}
            >
              + {t('드라이버 추가', 'Add Driver')}
            </button>
          </div>
        }
      >
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr style={{ backgroundColor: '#fff8f1', color: '#d97706' }}>
                <th>{t('드라이버 성명', 'Driver Name')}</th>
                <th>{t('연락처', 'Phone')}</th>
                <th style={{ textAlign: 'center' }}>{t('가동 상태', 'Status')}</th>
                <th style={{ textAlign: 'center' }}>{t('삭제', 'Delete')}</th>
              </tr>
            </thead>
            <tbody>
              {drivers.map((d) => (
                <tr key={d.id}>
                  <td>
                    <b>👤 {d.name}</b>
                  </td>
                  <td>{d.phone}</td>
                  <td style={{ textAlign: 'center' }}>
                    <StatusToggle
                      on={d.isActive !== false}
                      color="#f09433"
                      onLabel={t('활성 (ON)', 'Active')}
                      offLabel={t('비활성 (OFF)', 'Inactive')}
                      onClick={() =>
                        patchDrivers(
                          drivers.map((x) =>
                            x.id === d.id
                              ? { ...x, isActive: x.isActive === false }
                              : x,
                          ),
                        )
                      }
                    />
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <button
                      type="button"
                      className="status-btn"
                      style={{ backgroundColor: '#f04452', fontSize: 11 }}
                      onClick={() => {
                        if (
                          !window.confirm(
                            t(
                              '정말 이 드라이버를 삭제하시겠습니까?',
                              'Delete this driver?',
                            ),
                          )
                        ) {
                          return;
                        }
                        patchDrivers(drivers.filter((x) => x.id !== d.id));
                      }}
                    >
                      {t('삭제', 'Delete')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ManagerCard>

      <ManagerCard
        color="#e64980"
        title={`🤿 ${t('세이프티 강사 관리자', 'Safety Instructor Manager')}`}
        addBar={
          <div
            style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}
          >
            <input
              className="input-field"
              placeholder={t('강사 성명', 'Instructor name')}
              value={newSafety.name}
              onChange={(e) =>
                setNewSafety((p) => ({ ...p, name: e.target.value }))
              }
              style={{ width: 160 }}
            />
            <input
              className="input-field"
              placeholder={t('연락처', 'Phone')}
              value={newSafety.phone}
              onChange={(e) =>
                setNewSafety((p) => ({ ...p, phone: e.target.value }))
              }
              style={{ width: 180 }}
            />
            <button
              type="button"
              className="btn-primary"
              style={{ width: 'auto', backgroundColor: '#e64980' }}
              onClick={addSafety}
            >
              + {t('강사 추가', 'Add Instructor')}
            </button>
          </div>
        }
      >
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr style={{ backgroundColor: '#fff0f6', color: '#d6336c' }}>
                <th>{t('강사 성명', 'Instructor Name')}</th>
                <th>{t('연락처', 'Phone')}</th>
                <th style={{ textAlign: 'center' }}>{t('가동 상태', 'Status')}</th>
                <th style={{ textAlign: 'center' }}>{t('삭제', 'Delete')}</th>
              </tr>
            </thead>
            <tbody>
              {safety.map((s) => (
                <tr key={s.id}>
                  <td>
                    <b>🤿 {s.name}</b>
                  </td>
                  <td>{s.phone}</td>
                  <td style={{ textAlign: 'center' }}>
                    <StatusToggle
                      on={s.isActive !== false}
                      color="#e64980"
                      onLabel={t('활성 (ON)', 'Active')}
                      offLabel={t('비활성 (OFF)', 'Inactive')}
                      onClick={() =>
                        patchSafety(
                          safety.map((x) =>
                            x.id === s.id
                              ? { ...x, isActive: x.isActive === false }
                              : x,
                          ),
                        )
                      }
                    />
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <button
                      type="button"
                      className="status-btn"
                      style={{ backgroundColor: '#f04452', fontSize: 11 }}
                      onClick={() => {
                        if (
                          !window.confirm(
                            t(
                              '정말 이 세이프티 강사를 삭제하시겠습니까?',
                              'Delete this instructor?',
                            ),
                          )
                        ) {
                          return;
                        }
                        patchSafety(safety.filter((x) => x.id !== s.id));
                      }}
                    >
                      {t('삭제', 'Delete')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ManagerCard>

      {isFullAdmin && (
        <div className="card" style={{ border: '2px solid #495057' }}>
          <h4 style={{ marginTop: 0, color: '#495057', fontSize: 17 }}>
            🔐 {t('관리자 로그인 계정', 'Admin Login Accounts')}
          </h4>
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
                save(
                  {
                    adminId1,
                    adminPassword1,
                    adminId2,
                    adminPassword2,
                  },
                  t('관리자 계정이 저장되었습니다.', 'Admin accounts saved.'),
                )
              }
            >
              {t('계정 저장', 'Save Accounts')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
