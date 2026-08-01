import html2canvas from 'html2canvas';
import { useRef, useState } from 'react';
import { formatMoney } from '../../domain/pricing';

const FIXED_ACCOUNT_NAMES = ['IDA', 'CASABLUE', 'CEBU', '카카오', 'OTHER'];

function ModalShell({ title, onClose, children, width }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-sheet"
        style={width ? { width } : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 12,
            marginBottom: 12,
          }}
        >
          <h3 style={{ margin: 0 }}>{title}</h3>
          <button type="button" className="btn-ghost" onClick={onClose}>
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function PaymentModal({ t, row, accounts, onClose, onPick }) {
  const names = [
    ...FIXED_ACCOUNT_NAMES,
    ...(accounts || [])
      .filter((a) => a.isActive !== false)
      .map((a) => a.name)
      .filter((n) => n && !FIXED_ACCOUNT_NAMES.includes(n)),
  ];

  return (
    <ModalShell
      title={t('결제 계정 선택', 'Select Payment Account')}
      onClose={onClose}
      width="min(480px, 100%)"
    >
      <p style={{ color: 'var(--muted)', marginTop: 0 }}>
        {row?.name} — {t('입금 확인 계정을 선택하세요.', 'Choose the account that received payment.')}
      </p>
      <div className="account-pick-grid">
        {names.map((name) => (
          <button
            key={name}
            type="button"
            className="unit-pick-btn"
            onClick={() => onPick(name)}
          >
            ✅ {name}
          </button>
        ))}
      </div>
    </ModalShell>
  );
}

export function VoucherModal({ t, row, role, onClose, onSave }) {
  const [roomNumbers, setRoomNumbers] = useState(row?.assignedRoomNumbers || '');

  return (
    <ModalShell
      title={t('바우처 / 객실 배정', 'Voucher / Room Assignment')}
      onClose={onClose}
      width="min(480px, 100%)"
    >
      <p style={{ color: 'var(--muted)', marginTop: 0 }}>
        {row?.repName} · {row?.name}
      </p>
      <label className="label-text">
        {t('배정 객실 번호', 'Assigned Room Number(s)')}
      </label>
      <input
        className="input-field"
        value={roomNumbers}
        onChange={(e) => setRoomNumbers(e.target.value)}
        placeholder={t('예: 101, 102', 'e.g. 101, 102')}
      />
      {String(role || '').toUpperCase() === 'INSTRUCTOR' && (
        <p style={{ color: 'var(--muted)', fontSize: 12 }}>
          {t(
            '강사는 조회만 가능하며 저장 시 관리자에게 전달됩니다.',
            'Instructors can view; saving will notify admin.',
          )}
        </p>
      )}
      <div className="sticky-action-bar-inner" style={{ marginTop: 16 }}>
        <button type="button" className="btn-secondary" onClick={onClose}>
          {t('취소', 'Cancel')}
        </button>
        <button
          type="button"
          className="btn-primary"
          onClick={() => onSave(roomNumbers)}
        >
          {t('저장', 'Save')}
        </button>
      </div>
    </ModalShell>
  );
}

export function UnitModal({ t, row, units, onClose, onPick }) {
  const activeUnits = (units || []).filter((u) => u.isActive !== false);

  return (
    <ModalShell
      title={t('유닛(보트) 배정', 'Assign Unit (Boat)')}
      onClose={onClose}
      width="min(560px, 100%)"
    >
      <p style={{ color: 'var(--muted)', marginTop: 0 }}>{row?.name}</p>
      {activeUnits.map((unit) => (
        <div key={unit.id} className="sub-card">
          <div className="label-text">{unit.nameKO}</div>
          <div className="unit-pick-grid">
            {Array.from({ length: Number(unit.lines) || 0 }, (_, i) => i + 1).map(
              (n) => {
                const label = `${unit.nameKO} ${n}`;
                return (
                  <button
                    key={n}
                    type="button"
                    className="unit-pick-btn"
                    onClick={() => onPick(label)}
                  >
                    {unit.nameKO} {n}
                  </button>
                );
              },
            )}
          </div>
        </div>
      ))}
      {activeUnits.length === 0 && (
        <p style={{ color: 'var(--muted)' }}>
          {t('등록된 유닛이 없습니다.', 'No units configured.')}
        </p>
      )}
      <div className="sticky-action-bar-inner" style={{ marginTop: 16 }}>
        <button type="button" className="btn-secondary" onClick={onClose}>
          {t('취소', 'Cancel')}
        </button>
        <button type="button" className="btn-danger" onClick={() => onPick('')}>
          {t('배정 해제', 'Unassign')}
        </button>
      </div>
    </ModalShell>
  );
}

export function TransportModal({ t, row, vehicles, drivers, onClose, onSave }) {
  const [vehicle, setVehicle] = useState(row?.assignedVehicle || '');
  const [driver, setDriver] = useState(row?.assignedDriver || '');

  return (
    <ModalShell
      title={t('차량 / 기사 배정', 'Assign Vehicle / Driver')}
      onClose={onClose}
      width="min(480px, 100%)"
    >
      <p style={{ color: 'var(--muted)', marginTop: 0 }}>{row?.name}</p>
      <div className="grid-2">
        <div>
          <label className="label-text">{t('차량', 'Vehicle')}</label>
          <select
            className="input-field"
            value={vehicle}
            onChange={(e) => setVehicle(e.target.value)}
          >
            <option value="">{t('선택 안 함', 'None')}</option>
            {(vehicles || [])
              .filter((v) => v.isActive !== false)
              .map((v) => (
                <option key={v.id} value={v.nameKO}>
                  {v.nameKO}
                </option>
              ))}
          </select>
        </div>
        <div>
          <label className="label-text">{t('기사', 'Driver')}</label>
          <select
            className="input-field"
            value={driver}
            onChange={(e) => setDriver(e.target.value)}
          >
            <option value="">{t('선택 안 함', 'None')}</option>
            {(drivers || [])
              .filter((d) => d.isActive !== false)
              .map((d) => (
                <option key={d.id} value={d.name}>
                  {d.name}
                </option>
              ))}
          </select>
        </div>
      </div>
      <div className="sticky-action-bar-inner" style={{ marginTop: 16 }}>
        <button type="button" className="btn-secondary" onClick={onClose}>
          {t('취소', 'Cancel')}
        </button>
        <button
          type="button"
          className="btn-primary"
          onClick={() => onSave(vehicle, driver)}
        >
          {t('저장', 'Save')}
        </button>
      </div>
    </ModalShell>
  );
}

export function CombinedInvoiceModal({ t, rows, exchangeRate, onClose }) {
  const sheetRef = useRef(null);
  const [showUSD, setShowUSD] = useState(false);

  const totalKRW = (rows || []).reduce(
    (sum, r) => sum + (Number(r.individualTotalKRW) || 0),
    0,
  );
  const totalUSD = (rows || []).reduce(
    (sum, r) => sum + (Number(r.individualTotalUSD) || 0),
    0,
  );

  const downloadPng = async () => {
    if (!sheetRef.current) return;
    const canvas = await html2canvas(sheetRef.current, { scale: 2 });
    const a = document.createElement('a');
    a.download = '통합_견적서.png';
    a.href = canvas.toDataURL('image/png');
    a.click();
  };

  return (
    <ModalShell
      title={t('선택 항목 통합 견적서', 'Combined Invoice')}
      onClose={onClose}
      width="min(720px, 100%)"
    >
      <div className="tabs-row">
        <button
          type="button"
          className={`tab ${!showUSD ? 'active' : ''}`}
          onClick={() => setShowUSD(false)}
        >
          KRW
        </button>
        <button
          type="button"
          className={`tab ${showUSD ? 'active' : ''}`}
          onClick={() => setShowUSD(true)}
        >
          USD
        </button>
      </div>

      <div ref={sheetRef} className="sub-card" style={{ background: '#fff' }}>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('이름', 'Name')}</th>
                <th>{t('일정', 'Dates')}</th>
                <th>{t('금액', 'Amount')}</th>
              </tr>
            </thead>
            <tbody>
              {(rows || []).map((r) => (
                <tr key={`${r.resId}_r${r.roomIdx}_g${r.guestIdx}`}>
                  <td>{r.name}</td>
                  <td>
                    {r.startDate} ~ {r.endDate}
                  </td>
                  <td>
                    {showUSD
                      ? `$${formatMoney(r.individualTotalUSD)}`
                      : `₩${formatMoney(r.individualTotalKRW)}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ fontWeight: 900, fontSize: 18, marginTop: 12 }}>
          {t('총 합계', 'Grand Total')}:{' '}
          {showUSD ? `$${formatMoney(totalUSD)}` : `₩${formatMoney(totalKRW)}`}
        </p>
        <p style={{ color: 'var(--muted)', fontSize: 12 }}>
          {t('적용 환율', 'Exchange rate')}: {formatMoney(exchangeRate)}
        </p>
      </div>

      <div className="sticky-action-bar-inner" style={{ marginTop: 16 }}>
        <button type="button" className="btn-secondary" onClick={downloadPng}>
          {t('이미지로 저장', 'Download image')}
        </button>
        <button type="button" className="btn-primary" onClick={onClose}>
          {t('닫기', 'Close')}
        </button>
      </div>
    </ModalShell>
  );
}
