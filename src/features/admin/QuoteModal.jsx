import html2canvas from 'html2canvas';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  EMPTY_TRAINING_DISCOUNTS,
} from '../../domain/defaults';
import { formatMoney, processRoomsData } from '../../domain/pricing';
import { updateReservation } from '../../data/reservationsRepo';
import { useToast } from '../../ui/ToastContext';

export default function QuoteModal({
  t,
  target,
  reservations,
  settings,
  onClose,
  onSaved,
}) {
  const toast = useToast();
  const sheetRef = useRef(null);
  const res = reservations.find((r) => r.id === target.resId);
  const guest = res?.roomsData?.[target.roomIdx]?.guests?.[target.guestIdx];

  const [roomDiscount, setRoomDiscount] = useState(0);
  const [optionsDiscount, setOptionsDiscount] = useState(0);
  const [trainingDiscounts, setTrainingDiscounts] = useState({
    ...EMPTY_TRAINING_DISCOUNTS,
  });
  const [customTotalKRW, setCustomTotalKRW] = useState(0);
  const [showDiscounted, setShowDiscounted] = useState(true);

  useEffect(() => {
    if (!guest) return;
    setRoomDiscount(Number(guest.roomDiscount) || 0);
    setOptionsDiscount(Number(guest.optionsDiscount) || 0);
    setCustomTotalKRW(Number(guest.customTotalKRW) || 0);
    setTrainingDiscounts({
      ...EMPTY_TRAINING_DISCOUNTS,
      ...(guest.trainingDiscounts || {}),
      // migrate legacy single trainingDiscount onto all types if no per-type set
      ...(!guest.trainingDiscounts && guest.trainingDiscount
        ? {
            MAX_60: Number(guest.trainingDiscount) || 0,
            MAX_90: Number(guest.trainingDiscount) || 0,
            MAX_130: Number(guest.trainingDiscount) || 0,
            SELF_60: Number(guest.trainingDiscount) || 0,
          }
        : {}),
    });
  }, [guest]);

  const previewGuest = useMemo(() => {
    if (!guest) return null;
    return {
      ...guest,
      roomDiscount: showDiscounted ? roomDiscount : 0,
      optionsDiscount: showDiscounted ? optionsDiscount : 0,
      trainingDiscounts: showDiscounted
        ? trainingDiscounts
        : { ...EMPTY_TRAINING_DISCOUNTS },
      trainingDiscount: 0,
      customTotalKRW: showDiscounted ? customTotalKRW : 0,
    };
  }, [
    guest,
    roomDiscount,
    optionsDiscount,
    trainingDiscounts,
    customTotalKRW,
    showDiscounted,
  ]);

  const preview = useMemo(() => {
    if (!res || !previewGuest) return null;
    const rooms = structuredClone(res.roomsData || []);
    rooms[target.roomIdx].guests[target.guestIdx] = previewGuest;
    return processRoomsData(
      rooms,
      settings.exchangeRate,
      settings.roomTypesConfig,
      settings.trainingTypesConfig,
    );
  }, [res, previewGuest, target, settings]);

  if (!guest || !preview) return null;
  const pg = preview.processedRooms[target.roomIdx].guests[target.guestIdx];

  const applyQuote = async () => {
    try {
      const rooms = structuredClone(res.roomsData || []);
      rooms[target.roomIdx].guests[target.guestIdx] = {
        ...rooms[target.roomIdx].guests[target.guestIdx],
        roomDiscount: Number(roomDiscount) || 0,
        optionsDiscount: Number(optionsDiscount) || 0,
        trainingDiscounts: { ...trainingDiscounts },
        trainingDiscount: 0,
        customTotalKRW: Number(customTotalKRW) || 0,
      };
      const next = processRoomsData(
        rooms,
        settings.exchangeRate,
        settings.roomTypesConfig,
        settings.trainingTypesConfig,
      );
      await updateReservation(res.id, {
        roomsData: next.processedRooms,
        grandTotalKRW: next.grandTotalKRW,
        grandTotalUSD: next.grandTotalUSD,
      });
      toast.success(t('견적이 적용되었습니다.', 'Quote applied.'));
      onSaved?.();
      onClose();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const downloadPng = async () => {
    if (!sheetRef.current) return;
    const canvas = await html2canvas(sheetRef.current, { scale: 2 });
    const a = document.createElement('a');
    a.download = `${guest.name || 'quote'}_견적서.png`;
    a.href = canvas.toDataURL('image/png');
    a.click();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-sheet"
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
          <h3 style={{ margin: 0 }}>{t('견적서', 'Invoice / Quote')}</h3>
          <button type="button" className="btn-ghost" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="grid-2">
          <div>
            <label className="label-text">{t('객실 할인 %', 'Room discount %')}</label>
            <input
              type="number"
              className="input-field"
              value={roomDiscount}
              onChange={(e) => setRoomDiscount(e.target.value)}
            />
          </div>
          <div>
            <label className="label-text">
              {t('옵션 할인 %', 'Options discount %')}
            </label>
            <input
              type="number"
              className="input-field"
              value={optionsDiscount}
              onChange={(e) => setOptionsDiscount(e.target.value)}
            />
          </div>
        </div>

        <div className="sub-card">
          <div className="label-text">
            {t('트레이닝 종류별 할인 %', 'Per-training discount %')}
          </div>
          <div className="grid-2">
            {settings.trainingTypesConfig.map((tr) => (
              <div key={tr.id}>
                <label className="label-text">{tr.name}</label>
                <input
                  type="number"
                  className="input-field"
                  value={trainingDiscounts[tr.id] || 0}
                  onChange={(e) =>
                    setTrainingDiscounts((prev) => ({
                      ...prev,
                      [tr.id]: Number(e.target.value) || 0,
                    }))
                  }
                />
              </div>
            ))}
          </div>
        </div>

        <div>
          <label className="label-text">
            {t('수동 지정 합계 (KRW, 0=자동)', 'Custom total KRW (0=auto)')}
          </label>
          <input
            type="number"
            className="input-field"
            value={customTotalKRW}
            onChange={(e) => setCustomTotalKRW(e.target.value)}
          />
        </div>

        <div className="tabs-row" style={{ marginTop: 12 }}>
          <button
            type="button"
            className={`tab ${showDiscounted ? 'active' : ''}`}
            onClick={() => setShowDiscounted(true)}
          >
            {t('할인 적용가 보기', 'Show Discounted')}
          </button>
          <button
            type="button"
            className={`tab ${!showDiscounted ? 'active' : ''}`}
            onClick={() => setShowDiscounted(false)}
          >
            {t('할인 미적용(원금) 보기', 'Show Original')}
          </button>
        </div>

        <div ref={sheetRef} className="sub-card" style={{ background: '#fff' }}>
          <strong>
            {guest.name} · {guest.nationality} · {guest.level}
          </strong>
          <p>
            {guest.startDate} ~ {guest.endDate}
          </p>
          <p>
            {t('객실', 'Room')}: ₩{formatMoney(pg.roomShareCost)}
          </p>
          <p>
            {t('트레이닝', 'Training')}: ₩{formatMoney(pg.trainingCost)}
          </p>
          <p>
            {t('옵션', 'Options')}: ₩{formatMoney(pg.optionsCost)}
          </p>
          {pg.penaltyFee > 0 && (
            <p style={{ color: 'var(--danger)' }}>
              {t('패널티', 'Penalty')}: ₩{formatMoney(pg.penaltyFee)}
            </p>
          )}
          <p style={{ fontWeight: 900, fontSize: 18 }}>
            {t('최종', 'Total')}: ₩{formatMoney(pg.individualTotalKRW)} / $
            {formatMoney(pg.individualTotalUSD)}
          </p>
        </div>

        <div className="sticky-action-bar-inner" style={{ marginTop: 16 }}>
          <button type="button" className="btn-secondary" onClick={downloadPng}>
            {t('견적서 이미지 저장', 'Download quote image')}
          </button>
          <button type="button" className="btn-primary" onClick={applyQuote}>
            {t('견적 적용', 'Apply Quote')}
          </button>
        </div>
      </div>
    </div>
  );
}
