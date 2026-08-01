import { useEffect, useMemo, useState } from 'react';
import { createEmptyRoom } from '../../domain/defaults';
import { processRoomsData } from '../../domain/pricing';
import { updateReservation } from '../../data/reservationsRepo';
import { addAdminLog } from '../../data/logsRepo';
import { useToast } from '../../ui/ToastContext';
import RoomsDiversForm from '../booking/RoomsDiversForm';

export default function EditReservationModal({
  t,
  reservation,
  settings,
  onClose,
  onSaved,
}) {
  const toast = useToast();
  const [bookingInstructor, setBookingInstructor] = useState(
    reservation?.bookingInstructor || '',
  );
  const [repName, setRepName] = useState(reservation?.repName || '');
  const [repEmail, setRepEmail] = useState(reservation?.repEmail || '');
  const [groupPin, setGroupPin] = useState(reservation?.groupPin || '');
  const [roomCount, setRoomCount] = useState(
    reservation?.roomCount || reservation?.roomsData?.length || 1,
  );
  const [roomsData, setRoomsData] = useState(() =>
    structuredClone(reservation?.roomsData || []),
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!reservation) return;
    setBookingInstructor(reservation.bookingInstructor || '');
    setRepName(reservation.repName || '');
    setRepEmail(reservation.repEmail || '');
    setGroupPin(reservation.groupPin || '');
    setRoomCount(reservation.roomCount || reservation.roomsData?.length || 1);
    setRoomsData(structuredClone(reservation.roomsData || []));
  }, [reservation]);

  useEffect(() => {
    setRoomsData((prev) => {
      const next = [...prev];
      while (next.length < roomCount) next.push(createEmptyRoom(next.length + 1));
      while (next.length > roomCount) next.pop();
      return next.map((r, i) => ({ ...r, id: i + 1 }));
    });
  }, [roomCount]);

  const processed = useMemo(
    () =>
      processRoomsData(
        roomsData,
        settings.exchangeRate,
        settings.roomTypesConfig,
        settings.trainingTypesConfig,
      ),
    [roomsData, settings],
  );

  if (!reservation) return null;

  const save = async () => {
    if (!repName.trim() || !bookingInstructor.trim()) {
      toast.warn(t('필수 정보를 입력하세요.', 'Fill required fields.'));
      return;
    }
    setSaving(true);
    try {
      const next = processRoomsData(
        roomsData,
        settings.exchangeRate,
        settings.roomTypesConfig,
        settings.trainingTypesConfig,
      );
      await updateReservation(reservation.id, {
        bookingInstructor: bookingInstructor.trim(),
        repName: repName.trim().toUpperCase(),
        repEmail: repEmail.trim(),
        groupPin,
        roomCount,
        roomsData: next.processedRooms,
        grandTotalKRW: next.grandTotalKRW,
        grandTotalUSD: next.grandTotalUSD,
      });
      await addAdminLog({
        type: 'EDIT',
        message: `[예약 수정] ${repName.trim().toUpperCase()} 그룹 예약이 수정되었습니다.`,
      });
      toast.success(t('예약이 저장되었습니다.', 'Reservation saved.'));
      onSaved?.();
      onClose();
    } catch (err) {
      toast.error(err.message || t('저장 실패', 'Save failed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 12,
            marginBottom: 12,
          }}
        >
          <h3 style={{ margin: 0 }}>{t('예약 수정', 'Edit Reservation')}</h3>
          <button type="button" className="btn-ghost" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0 }}>
            {t('대표 정보', 'Representative Info')}
          </h3>
          <div className="grid-2">
            <div>
              <label className="label-text">
                {t('예약자명', 'Holder Name')}
                <span className="required-star"> *</span>
              </label>
              <input
                className="input-field"
                value={repName}
                onChange={(e) =>
                  setRepName(
                    e.target.value.replace(/[^a-zA-Z\s]/g, '').toUpperCase(),
                  )
                }
              />
            </div>
            <div>
              <label className="label-text">{t('이메일', 'Email')}</label>
              <input
                className="input-field"
                type="email"
                value={repEmail}
                onChange={(e) => setRepEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="label-text">
                {t('강사명', 'Instructor')}
                <span className="required-star"> *</span>
              </label>
              <input
                className="input-field"
                value={bookingInstructor}
                onChange={(e) => setBookingInstructor(e.target.value)}
              />
            </div>
            <div>
              <label className="label-text">{t('PIN (4자리)', 'PIN (4-digit)')}</label>
              <input
                className="input-field"
                inputMode="numeric"
                maxLength={4}
                value={groupPin}
                onChange={(e) =>
                  setGroupPin(e.target.value.replace(/\D/g, '').slice(0, 4))
                }
              />
            </div>
            <div>
              <label className="label-text">{t('객실 수', 'Room Count')}</label>
              <select
                className="input-field"
                value={roomCount}
                onChange={(e) => setRoomCount(Number(e.target.value))}
              >
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <RoomsDiversForm
          t={t}
          roomsData={roomsData}
          setRoomsData={setRoomsData}
          roomTypes={settings.roomTypesConfig}
          trainingTypes={settings.trainingTypesConfig}
          safetyInstructors={(settings.safetyInstructorsConfig || []).map(
            (s) => s.name || s,
          )}
          processed={processed}
        />

        <div className="sub-card">
          <strong>
            {t('합계', 'Total')}: ₩
            {processed.grandTotalKRW.toLocaleString()} / $
            {processed.grandTotalUSD.toLocaleString()}
          </strong>
        </div>

        <div className="sticky-action-bar-inner" style={{ marginTop: 16 }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={onClose}
            disabled={saving}
          >
            {t('취소', 'Cancel')}
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={save}
            disabled={saving}
          >
            {t('저장', 'Save')}
          </button>
        </div>
      </div>
    </div>
  );
}
