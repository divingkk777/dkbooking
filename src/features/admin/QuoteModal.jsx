import html2canvas from 'html2canvas';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  EMPTY_TRAINING_COUNTS,
  EMPTY_TRAINING_DISCOUNTS,
  getGuestOptionQty,
  resolveOptionsCatalog,
} from '../../domain/defaults';
import { requestedTrainingCount } from '../../domain/listModel';
import {
  formatMoney,
  formatPricePair,
  buildPricingExtras,
  computeBilledNights,
  processRoomsData,
} from '../../domain/pricing';
import { updateReservation } from '../../data/reservationsRepo';
import { useToast } from '../../ui/ToastContext';
import {
  OfficialQuoteContacts,
  OfficialQuoteHeader,
} from './OfficialQuoteSheet';

function buildOptionCountsFromGuest(guest, catalog) {
  const next = {};
  (catalog || []).forEach((opt) => {
    if (opt.uiType === 'transfer') return;
    next[opt.id] = getGuestOptionQty(guest, opt.id);
  });
  return next;
}

function applyOptionCountsToGuest(guest, optionCounts) {
  const counts = { ...(optionCounts || {}) };
  const videoQty = Math.max(
    0,
    Number(counts.VIDEO ?? counts.VIDEO_PER_DAY) || 0,
  );
  return {
    ...guest,
    optionCounts: counts,
    videoCount: videoQty,
    needsVideo: videoQty > 0,
    islandHopping: Math.max(0, Number(counts.HOPPING) || 0),
    funDiving: Math.max(0, Number(counts.FUN_DIVING) || 0),
  };
}

export default function QuoteModal({
  t,
  lang = 'KO',
  target,
  reservations,
  settings,
  onClose,
  onSaved,
}) {
  const toast = useToast();
  const sheetRef = useRef(null);
  const readOnly = !!target?.readOnly;
  const res = reservations.find((r) => r.id === target.resId);
  const guest = res?.roomsData?.[target.roomIdx]?.guests?.[target.guestIdx];

  const optionsCatalog = useMemo(
    () =>
      resolveOptionsCatalog(
        settings.optionsCatalogConfig || settings.optionPricesConfig,
      ).filter((opt) => opt.isActive !== false),
    [settings.optionsCatalogConfig, settings.optionPricesConfig],
  );

  const [roomNightsQty, setRoomNightsQty] = useState(0);
  const [roomDiscount, setRoomDiscount] = useState(0);
  const [optionCountsEdit, setOptionCountsEdit] = useState({});
  const [airportPickup, setAirportPickup] = useState(false);
  const [airportDropoff, setAirportDropoff] = useState(false);
  const [optionsDiscount, setOptionsDiscount] = useState(0);
  const [trainingCountsEdit, setTrainingCountsEdit] = useState({
    ...EMPTY_TRAINING_COUNTS,
  });
  const [trainingDiscounts, setTrainingDiscounts] = useState({
    ...EMPTY_TRAINING_DISCOUNTS,
  });
  const [customTotalKRW, setCustomTotalKRW] = useState(0);
  const [showDiscounted, setShowDiscounted] = useState(true);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    const prevPaddingRight = document.body.style.paddingRight;
    const scrollbarGap =
      window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = 'hidden';
    if (scrollbarGap > 0) {
      document.body.style.paddingRight = `${scrollbarGap}px`;
    }
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.paddingRight = prevPaddingRight;
    };
  }, []);

  useEffect(() => {
    if (!guest) return;
    setRoomNightsQty(computeBilledNights(guest));
    setRoomDiscount(Number(guest.roomDiscount) || 0);
    setOptionsDiscount(Number(guest.optionsDiscount) || 0);
    setCustomTotalKRW(Number(guest.customTotalKRW) || 0);
    setOptionCountsEdit(buildOptionCountsFromGuest(guest, optionsCatalog));
    setAirportPickup(!!guest.airportPickup);
    setAirportDropoff(!!guest.airportDropoff);
    setTrainingCountsEdit({
      ...EMPTY_TRAINING_COUNTS,
      ...(guest.trainingCounts || {}),
    });
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
  }, [guest, optionsCatalog]);

  const previewGuest = useMemo(() => {
    if (!guest) return null;
    const withOptions = applyOptionCountsToGuest(guest, optionCountsEdit);
    return {
      ...withOptions,
      airportPickup,
      airportDropoff,
      billedNightsOverride: Math.max(0, Number(roomNightsQty) || 0),
      trainingCounts: {
        ...EMPTY_TRAINING_COUNTS,
        ...trainingCountsEdit,
      },
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
    roomNightsQty,
    roomDiscount,
    optionCountsEdit,
    airportPickup,
    airportDropoff,
    optionsDiscount,
    trainingCountsEdit,
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
      settings.optionsCatalogConfig || settings.optionPricesConfig,
      buildPricingExtras(settings, res.escortCode),
    );
  }, [res, previewGuest, target, settings]);

  if (!guest || !preview) return null;
  const pg = preview.processedRooms[target.roomIdx].guests[target.guestIdx];
  const roomNights = Number(pg.billedNights) || 0;
  const optionQty = (pg.billingLines || [])
    .filter((line) => line.kind === 'option')
    .reduce((sum, line) => sum + (Number(line.qty) || 0), 0);
  const appliedTraining = requestedTrainingCount(previewGuest);
  const restDays = Number(guest.restDays) || 0;
  const transferActive = optionsCatalog.some(
    (opt) => opt.uiType === 'transfer' || opt.id === 'TRANSFER',
  );
  const countableOptions = optionsCatalog.filter(
    (opt) => opt.uiType !== 'transfer',
  );

  const applyQuote = async () => {
    try {
      const rooms = structuredClone(res.roomsData || []);
      const baseGuest = rooms[target.roomIdx].guests[target.guestIdx];
      const withOptions = applyOptionCountsToGuest(baseGuest, optionCountsEdit);
      const nights = Math.max(0, Number(roomNightsQty) || 0);
      // Compare against date-based nights only (ignore any prior override).
      const dateBasis = { ...baseGuest };
      delete dateBasis.billedNightsOverride;
      const dateNights = computeBilledNights(dateBasis);
      // Drop override when it matches date-based nights so stay dates stay source of truth.
      const { billedNightsOverride: _drop, ...withoutOverride } = withOptions;
      void _drop;
      rooms[target.roomIdx].guests[target.guestIdx] = {
        ...withoutOverride,
        airportPickup,
        airportDropoff,
        trainingCounts: {
          ...EMPTY_TRAINING_COUNTS,
          ...trainingCountsEdit,
        },
        roomDiscount: Number(roomDiscount) || 0,
        optionsDiscount: Number(optionsDiscount) || 0,
        trainingDiscounts: { ...trainingDiscounts },
        trainingDiscount: 0,
        customTotalKRW: Number(customTotalKRW) || 0,
        ...(nights !== dateNights ? { billedNightsOverride: nights } : {}),
      };
      const next = processRoomsData(
        rooms,
        settings.exchangeRate,
        settings.roomTypesConfig,
        settings.trainingTypesConfig,
        settings.optionsCatalogConfig || settings.optionPricesConfig,
        buildPricingExtras(settings, res.escortCode),
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
    const canvas = await html2canvas(sheetRef.current, {
      scale: 2,
      backgroundColor: '#ffffff',
      useCORS: true,
    });
    const a = document.createElement('a');
    a.download = `${guest.name || 'quote'}_견적서.png`;
    a.href = canvas.toDataURL('image/png');
    a.click();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-sheet quote-modal-sheet"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="quote-modal-header">
          <h3 style={{ margin: 0 }}>
            {readOnly
              ? t('예약 내용 열람', 'Booking details (view only)')
              : t('견적서', 'Invoice / Quote')}
          </h3>
          <button type="button" className="btn-ghost" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="quote-modal-scroll">
          {readOnly ? (
            <p style={{ marginTop: 0, color: '#6b7684', fontSize: 13 }}>
              {t(
                '스케줄러에서는 열람만 가능합니다. 수정은 예약 목록에서 진행하세요.',
                'View only from Scheduler. Edit from Reservations list.',
              )}
            </p>
          ) : (
            <>
              <div className="grid-2">
                <div>
                  <label className="label-text">
                    {t('객실 박수', 'Room nights')}
                    <span className="quote-qty-hint">
                      {t('선택', 'Selected')} {roomNights}
                      {t('박', 'n')}
                    </span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    className="input-field"
                    value={roomNightsQty}
                    onChange={(e) =>
                      setRoomNightsQty(Math.max(0, Number(e.target.value) || 0))
                    }
                  />
                </div>
                <div>
                  <label className="label-text">
                    {t('객실 할인 %', 'Room discount %')}
                  </label>
                  <input
                    type="number"
                    className="input-field"
                    value={roomDiscount}
                    onChange={(e) => setRoomDiscount(e.target.value)}
                  />
                </div>
              </div>

              <div className="sub-card">
                <div className="label-text">
                  {t('옵션 수량 · 할인', 'Option qty · discount')}
                  <span className="quote-qty-hint">
                    {t('선택', 'Selected')} {optionQty}
                    {lang === 'KO' ? '개' : ''}
                  </span>
                </div>
                <div className="grid-2">
                  {countableOptions.map((opt) => (
                    <div key={opt.id}>
                      <label className="label-text">
                        {lang === 'KO' ? opt.nameKO : opt.nameEN || opt.nameKO}
                      </label>
                      <input
                        type="number"
                        min="0"
                        className="input-field"
                        value={optionCountsEdit[opt.id] ?? 0}
                        onChange={(e) => {
                          const next = Math.max(0, Number(e.target.value) || 0);
                          setOptionCountsEdit((prev) => ({
                            ...prev,
                            [opt.id]: next,
                          }));
                        }}
                      />
                    </div>
                  ))}
                  {transferActive && (
                    <>
                      <div>
                        <label className="label-text">
                          {t('공항 픽업', 'Airport pickup')}
                        </label>
                        <select
                          className="input-field"
                          value={airportPickup ? 1 : 0}
                          onChange={(e) =>
                            setAirportPickup(Number(e.target.value) === 1)
                          }
                        >
                          <option value={0}>{t('없음', 'None')}</option>
                          <option value={1}>{t('1회', '1x')}</option>
                        </select>
                      </div>
                      <div>
                        <label className="label-text">
                          {t('공항 드롭오프', 'Airport dropoff')}
                        </label>
                        <select
                          className="input-field"
                          value={airportDropoff ? 1 : 0}
                          onChange={(e) =>
                            setAirportDropoff(Number(e.target.value) === 1)
                          }
                        >
                          <option value={0}>{t('없음', 'None')}</option>
                          <option value={1}>{t('1회', '1x')}</option>
                        </select>
                      </div>
                    </>
                  )}
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
              </div>

              <div className="sub-card">
                <div className="label-text">
                  {t(
                    '트레이닝 종류별 수량 · 할인 %',
                    'Per-training qty · discount %',
                  )}
                  <span className="quote-qty-hint">
                    {t('신청', 'Applied')} {appliedTraining}
                    {t('회', 'x')}
                    {restDays > 0
                      ? ` · ${t('불참', 'Absent')} ${restDays}${t('회', 'x')}`
                      : ''}
                  </span>
                </div>
                <div className="quote-training-edit-list">
                  {settings.trainingTypesConfig.map((tr) => (
                    <div key={tr.id} className="quote-training-edit-row">
                      <div className="quote-training-edit-name">{tr.name}</div>
                      <div className="quote-training-edit-fields">
                        <label className="label-text">
                          {t('수량(회)', 'Qty')}
                          <input
                            type="number"
                            min="0"
                            className="input-field"
                            value={trainingCountsEdit[tr.id] || 0}
                            onChange={(e) =>
                              setTrainingCountsEdit((prev) => ({
                                ...prev,
                                [tr.id]: Math.max(
                                  0,
                                  Number(e.target.value) || 0,
                                ),
                              }))
                            }
                          />
                        </label>
                        <label className="label-text">
                          {t('할인 %', 'Disc. %')}
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
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="label-text">
                  {t(
                    '수동 지정 합계 (KRW, 0=자동)',
                    'Custom total KRW (0=auto)',
                  )}
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
            </>
          )}

          <div
            ref={sheetRef}
            id="full-invoice-card-node"
            className="quote-official-sheet"
          >
            <OfficialQuoteHeader
              t={t}
              lang={lang}
              subtitle={
                res?.bookingInstructor
                  ? `${t('예약자', 'Holder')}: ${res.bookingInstructor}`
                  : undefined
              }
            />

            <div className="quote-official-body">
              <div className="quote-official-guest">
                👤 {String(guest.name || '').toUpperCase()}
                {(guest.nationality || guest.level) && (
                  <span style={{ fontWeight: 700, color: '#4e5968' }}>
                    {' '}
                    ·{' '}
                    {[guest.nationality, guest.level]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                )}
              </div>
              <div className="quote-official-meta">
                📅 {guest.startDate} ~ {guest.endDate}
                {pg.billedNights != null
                  ? ` · ${t('숙박', 'Stay')} ${pg.billedNights}${t('박', 'n')}`
                  : ''}
                {appliedTraining > 0
                  ? ` · ${t('트레이닝', 'Training')} ${appliedTraining}${t('회', 'x')}`
                  : ''}
              </div>

              <div className="quote-official-line">
                <span>
                  • {t('객실(숙박)', 'Room (stay)')}
                  {roomNights > 0
                    ? ` (${roomNights}${t('박', 'n')})`
                    : ''}
                </span>
                <span>
                  {formatPricePair(lang, pg.roomShareCost, pg.roomShareCostUSD)}
                </span>
              </div>
              <div className="quote-official-line">
                <span>
                  • {t('트레이닝', 'Training')}
                  {appliedTraining > 0
                    ? ` (${t('신청', 'Applied')} ${appliedTraining}${t('회', 'x')}${
                        restDays > 0
                          ? ` · ${t('불참', 'Absent')} ${restDays}${t('회', 'x')}`
                          : ''
                      })`
                    : ''}
                </span>
                <span>
                  {formatPricePair(lang, pg.trainingCost, pg.trainingCostUSD)}
                </span>
              </div>
              <div className="quote-official-line">
                <span>
                  • {t('옵션', 'Options')}
                  {optionQty > 0
                    ? ` (${optionQty}${lang === 'KO' ? '개' : ''})`
                    : ''}
                </span>
                <span>
                  {formatPricePair(lang, pg.optionsCost, pg.optionsCostUSD)}
                </span>
              </div>
              {pg.penaltyFee > 0 && (
                <div className="quote-official-line" style={{ color: '#f04452' }}>
                  <span>• {t('패널티', 'Penalty')}</span>
                  <span>₩{formatMoney(pg.penaltyFee)}</span>
                </div>
              )}
              {(Number(guest.escortDiscountKRW) ||
                Number(pg.escortDiscountKRW) ||
                0) > 0 && (
                <div className="quote-official-line" style={{ color: '#7048e8' }}>
                  <span>
                    • {t('인솔자코드 할인', 'Escort discount')}
                    {(pg.escortCode || res?.escortCode)
                      ? ` (${pg.escortCode || res.escortCode})`
                      : ''}
                  </span>
                  <span>
                    {formatPricePair(
                      lang,
                      -(Number(pg.escortDiscountKRW) || 0),
                      -(Number(pg.escortDiscountUSD) || 0),
                    )}
                  </span>
                </div>
              )}

              <div className="quote-official-total">
                <span>{t('최종 총 정산액', 'Grand Total')}</span>
                <span>
                  {formatPricePair(
                    lang,
                    pg.individualTotalKRW,
                    pg.individualTotalUSD,
                  )}
                </span>
              </div>
            </div>

            <OfficialQuoteContacts t={t} lang={lang} />
          </div>
        </div>

        <div className="quote-modal-actions sticky-action-bar-inner">
          {readOnly ? (
            <button type="button" className="btn-primary" onClick={onClose}>
              {t('닫기', 'Close')}
            </button>
          ) : (
            <>
              <button
                type="button"
                className="btn-secondary"
                onClick={downloadPng}
              >
                {t('견적서 이미지 저장', 'Download quote image')}
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={applyQuote}
              >
                {t('견적 적용', 'Apply Quote')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
