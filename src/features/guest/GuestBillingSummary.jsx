import { useState } from 'react';
import {
  getGuestOptionQty,
  resolveOptionsCatalog,
} from '../../domain/defaults';
import { formatPricePair, isEnglishLang } from '../../domain/pricing';

function CategoryBox({ title, color, open, onToggle, children }) {
  return (
    <div
      style={{
        marginTop: 10,
        border: `1.5px solid ${color}`,
        borderRadius: 12,
        background: '#fff',
        overflow: 'hidden',
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: '100%',
          background: color,
          color: '#fff',
          fontWeight: 800,
          fontSize: 13,
          padding: '8px 12px',
          border: 'none',
          cursor: pointer,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 8,
          textAlign: 'left',
        }}
      >
        <span>{title}</span>
        <span style={{ fontSize: 11, opacity: 0.9 }} aria-hidden="true">
          {open ? '▲' : '▼'}
        </span>
      </button>
      {open ? (
        <div style={{ padding: 12, display: 'grid', gap: 8 }}>{children}</div>
      ) : null}
    </div>
  );
}

function QtyRow({
  label,
  amountLabel,
  qty,
  onQtyChange,
  editable = true,
  min = 0,
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto auto',
        gap: 10,
        alignItems: 'center',
        fontSize: 13,
      }}
    >
      <span style={{ lineHeight: 1.35 }}>{label}</span>
      {editable ? (
        <input
          type="number"
          min={min}
          className="input-field"
          value={qty}
          onChange={(e) =>
            onQtyChange(Math.max(min, Number(e.target.value) || 0))
          }
          style={{ width: 72, textAlign: 'center', padding: '6px 8px' }}
        />
      ) : (
        <span
          style={{
            width: 72,
            textAlign: 'center',
            fontWeight: 700,
            color: '#6b7684',
          }}
        >
          {qty}
        </span>
      )}
      <span
        style={{
          minWidth: 120,
          textAlign: 'right',
          whiteSpace: 'nowrap',
          fontWeight: 700,
        }}
      >
        {amountLabel}
      </span>
    </div>
  );
}

function BoolRow({ label, amountLabel, checked, onChange }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto auto',
        gap: 10,
        alignItems: 'center',
        fontSize: 13,
      }}
    >
      <label className="check-label" style={{ margin: 0 }}>
        <input
          type="checkbox"
          checked={!!checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        {label}
      </label>
      <span style={{ width: 72, textAlign: 'center', color: '#6b7684' }}>
        {checked ? 1 : 0}
      </span>
      <span
        style={{
          minWidth: 120,
          textAlign: 'right',
          whiteSpace: 'nowrap',
          fontWeight: 700,
        }}
      >
        {amountLabel}
      </span>
    </div>
  );
}

export default function GuestBillingSummary({
  t,
  lang,
  processed,
  roomsData,
  setRoomsData,
  settings,
  escortCode = '',
  setEscortCode,
}) {
  const trainingTypes = (settings.trainingTypesConfig || []).filter(
    (x) => x.isActive !== false,
  );
  const roomTypes = (settings.roomTypesConfig || []).filter(
    (x) => x.isActive !== false,
  );
  const optionsCatalog = resolveOptionsCatalog(
    settings.optionsCatalogConfig || settings.optionPricesConfig,
  );
  const countOptions = optionsCatalog.filter(
    (o) => o.uiType !== 'transfer' && o.isActive !== false,
  );
  const transferOption = optionsCatalog.find(
    (o) => o.uiType === 'transfer' && o.isActive !== false,
  );
  const en = isEnglishLang(lang);

  const [openMap, setOpenMap] = useState({});
  const isOpen = (key) => openMap[key] !== false;
  const toggle = (key) =>
    setOpenMap((prev) => ({ ...prev, [key]: !(prev[key] !== false) }));

  const patchGuest = (roomIdx, guestIdx, patchFn) => {
    setRoomsData((prev) =>
      prev.map((room, ri) => {
        if (ri !== roomIdx) return room;
        const guests = [...(room.guests || [])];
        const g = { ...(guests[guestIdx] || {}) };
        guests[guestIdx] = patchFn(g);
        return { ...room, guests };
      }),
    );
  };

  const patchRoom = (roomIdx, patch) => {
    setRoomsData((prev) =>
      prev.map((room, ri) => (ri === roomIdx ? { ...room, ...patch } : room)),
    );
  };

  const setTrainingQty = (roomIdx, guestIdx, trainingId, qty) => {
    patchGuest(roomIdx, guestIdx, (g) => ({
      ...g,
      trainingCounts: {
        ...(g.trainingCounts || {}),
        [trainingId]: Math.max(0, Number(qty) || 0),
      },
    }));
  };

  const setOptionQty = (roomIdx, guestIdx, option, qty) => {
    const next = Math.max(0, Number(qty) || 0);
    const prevQty =
      roomsData[roomIdx]?.guests?.[guestIdx]
        ? Number(
            roomsData[roomIdx].guests[guestIdx].optionCounts?.[option.id] ??
              roomsData[roomIdx].guests[guestIdx].funDiving ??
              0,
          ) || 0
        : 0;
    patchGuest(roomIdx, guestIdx, (g) => {
      const out = {
        ...g,
        optionCounts: { ...(g.optionCounts || {}), [option.id]: next },
      };
      if (option.id === 'VIDEO' || option.id === 'VIDEO_PER_DAY') {
        out.videoCount = next;
        out.needsVideo = next > 0;
      }
      if (option.id === 'HOPPING') out.islandHopping = next;
      if (option.id === 'FUN_DIVING') out.funDiving = next;
      return out;
    });
    if (
      (option.id === 'FUN_DIVING' || option.guideKey === 'fundiving') &&
      next > 0 &&
      prevQty <= 0
    ) {
      window.alert(
        t(
          '🤿 [펀다이빙 안내]\n펀다이빙 신청시 현장 담당 Angelica 에게 언제 펀다이빙을 진행 할지 협의 하고 진행 하세요.',
          '🤿 [Fun Diving Notice]\nWhen booking fun diving, please coordinate the schedule with on-site staff Angelica before proceeding.',
        ),
      );
    }
  };

  const setTransfer = (roomIdx, guestIdx, key, on) => {
    patchGuest(roomIdx, guestIdx, (g) => ({ ...g, [key]: !!on }));
  };

  const money = (krw, usd) => formatPricePair(lang, krw, usd);

  return (
    <div className="sub-card">
      <strong>{t('개별 청구 내역서', 'Individual Billing Summary')}</strong>

      {(processed.processedRooms || []).map((room, roomIdx) =>
        (room.guests || []).map((guest, guestIdx) => {
          const raw = roomsData[roomIdx]?.guests?.[guestIdx] || {};
          const roomLine = (guest.billingLines || []).find(
            (l) => l.kind === 'room',
          );
          const roomKey = `${roomIdx}-${guestIdx}-room`;
          const trainKey = `${roomIdx}-${guestIdx}-train`;
          const optKey = `${roomIdx}-${guestIdx}-opt`;

          return (
            <div
              key={`bill-${roomIdx}-${guestIdx}`}
              style={{
                marginTop: 16,
                paddingTop: roomIdx === 0 && guestIdx === 0 ? 0 : 14,
                borderTop:
                  roomIdx === 0 && guestIdx === 0
                    ? 'none'
                    : '1px solid var(--line)',
              }}
            >
              <div style={{ fontWeight: 800, marginBottom: 4 }}>
                {t('다이버', 'Diver')} {guestIdx + 1}
                {guest.name ? ` · ${guest.name}` : ''}
              </div>
              <div style={{ fontSize: 12, color: '#6b7684', marginBottom: 4 }}>
                {guest.startDate && guest.endDate
                  ? `${guest.startDate} ~ ${guest.endDate}`
                  : t('일정 미입력', 'Dates not set')}
              </div>

              <CategoryBox
                title={`🏨 ${t('객실', 'Room')}`}
                color="#3182f6"
                open={isOpen(roomKey)}
                onToggle={() => toggle(roomKey)}
              >
                <div>
                  <label className="label-text">
                    {t('객실 타입', 'Room type')}
                  </label>
                  <select
                    className="input-field"
                    value={roomsData[roomIdx]?.roomType || ''}
                    onChange={(e) =>
                      patchRoom(roomIdx, { roomType: e.target.value })
                    }
                  >
                    <option value="">
                      {t('객실 선택', 'Select room')}
                    </option>
                    {roomTypes.map((rt) => (
                      <option key={rt.id} value={rt.id}>
                        {en ? rt.nameEN || rt.nameKO : rt.nameKO || rt.nameEN}{' '}
                        ({money(rt.priceKRW, rt.priceUSD)}/{t('박', 'n')})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid-2">
                  <div>
                    <label className="label-text">
                      {t('체크인', 'Check-in')}
                    </label>
                    <input
                      type="date"
                      className="input-field"
                      value={raw.startDate || ''}
                      onChange={(e) =>
                        patchGuest(roomIdx, guestIdx, (g) => ({
                          ...g,
                          startDate: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label className="label-text">
                      {t('체크아웃', 'Check-out')}
                    </label>
                    <input
                      type="date"
                      className="input-field"
                      value={raw.endDate || ''}
                      onChange={(e) =>
                        patchGuest(roomIdx, guestIdx, (g) => ({
                          ...g,
                          endDate: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                  <label
                    className={`check-label${raw.dawnCheckIn ? ' red-option-box' : ''}`}
                    style={{ margin: 0 }}
                  >
                    <input
                      type="checkbox"
                      checked={!!raw.dawnCheckIn}
                      onChange={(e) =>
                        patchGuest(roomIdx, guestIdx, (g) => ({
                          ...g,
                          dawnCheckIn: e.target.checked,
                        }))
                      }
                    />
                    {t('얼리체크인 (+1박)', 'Early Check-in (+1n)')}
                  </label>
                  <label
                    className={`check-label${raw.lateCheckOut ? ' red-option-box' : ''}`}
                    style={{ margin: 0 }}
                  >
                    <input
                      type="checkbox"
                      checked={!!raw.lateCheckOut}
                      onChange={(e) =>
                        patchGuest(roomIdx, guestIdx, (g) => ({
                          ...g,
                          lateCheckOut: e.target.checked,
                        }))
                      }
                    />
                    {t('레이트체크아웃 (+1박)', 'Late Check-out (+1n)')}
                  </label>
                </div>

                <QtyRow
                  label={t(
                    guest.roomNameKO || room.roomType || '객실',
                    guest.roomNameEN || room.roomType || 'Room',
                  )}
                  qty={guest.billedNights || 0}
                  editable={false}
                  amountLabel={money(
                    roomLine?.amountKRW || guest.roomShareCost || 0,
                    roomLine?.amountUSD || guest.roomShareCostUSD || 0,
                  )}
                />
                <div style={{ fontSize: 11, color: '#8b95a1' }}>
                  {t(
                    '박수는 일정·얼리/레이트 체크인에 따라 자동 계산됩니다.',
                    'Nights are calculated from schedule and early/late options.',
                  )}
                </div>
              </CategoryBox>

              <CategoryBox
                title={`🏊 ${t('트레이닝', 'Training')}`}
                color="#0ca678"
                open={isOpen(trainKey)}
                onToggle={() => toggle(trainKey)}
              >
                {trainingTypes.length === 0 ? (
                  <div style={{ fontSize: 13, color: '#8b95a1' }}>
                    {t('등록된 트레이닝 없음', 'No training types')}
                  </div>
                ) : (
                  trainingTypes.map((tr) => {
                    const qty = Number(raw.trainingCounts?.[tr.id]) || 0;
                    return (
                      <QtyRow
                        key={tr.id}
                        label={`${tr.name} (${money(tr.priceKRW, tr.priceUSD)}/${t('회', 'x')})`}
                        qty={qty}
                        onQtyChange={(n) =>
                          setTrainingQty(roomIdx, guestIdx, tr.id, n)
                        }
                        amountLabel={money(
                          qty * (Number(tr.priceKRW) || 0),
                          qty * (Number(tr.priceUSD) || 0),
                        )}
                      />
                    );
                  })
                )}
                {(Number(guest.escortDiscountKRW) || 0) > 0 ? (
                  <QtyRow
                    label={`${t('인솔자코드 할인', 'Escort discount')} (${guest.escortCode || escortCode})`}
                    qty={1}
                    editable={false}
                    amountLabel={money(
                      -Math.round(guest.escortDiscountKRW),
                      -Math.round(guest.escortDiscountUSD || 0),
                    )}
                  />
                ) : null}
              </CategoryBox>

              <CategoryBox
                title={`✨ ${t('옵션', 'Options')}`}
                color="#f59f00"
                open={isOpen(optKey)}
                onToggle={() => toggle(optKey)}
              >
                {transferOption ? (
                  <>
                    <BoolRow
                      label={`${t('공항 픽업', 'Airport Pickup')} (${money(
                        transferOption.priceKRW,
                        transferOption.priceUSD,
                      )})`}
                      checked={!!raw.airportPickup}
                      onChange={(on) =>
                        setTransfer(roomIdx, guestIdx, 'airportPickup', on)
                      }
                      amountLabel={money(
                        raw.airportPickup ? transferOption.priceKRW : 0,
                        raw.airportPickup ? transferOption.priceUSD : 0,
                      )}
                    />
                    <BoolRow
                      label={`${t('공항 드롭오프', 'Airport Dropoff')} (${money(
                        transferOption.priceKRW,
                        transferOption.priceUSD,
                      )})`}
                      checked={!!raw.airportDropoff}
                      onChange={(on) =>
                        setTransfer(roomIdx, guestIdx, 'airportDropoff', on)
                      }
                      amountLabel={money(
                        raw.airportDropoff ? transferOption.priceKRW : 0,
                        raw.airportDropoff ? transferOption.priceUSD : 0,
                      )}
                    />
                  </>
                ) : null}
                {countOptions.map((opt) => {
                  const qty = getGuestOptionQty(raw, opt.id);
                  return (
                    <QtyRow
                      key={opt.id}
                      label={`${t(opt.nameKO, opt.nameEN)} (${money(
                        opt.priceKRW,
                        opt.priceUSD,
                      )}/${t(opt.unitKO || '회', opt.unitEN || 'x')})`}
                      qty={qty}
                      onQtyChange={(n) =>
                        setOptionQty(roomIdx, guestIdx, opt, n)
                      }
                      amountLabel={money(
                        qty * (Number(opt.priceKRW) || 0),
                        qty * (Number(opt.priceUSD) || 0),
                      )}
                    />
                  );
                })}
                {!transferOption && countOptions.length === 0 ? (
                  <div style={{ fontSize: 13, color: '#8b95a1' }}>
                    {t('등록된 옵션 없음', 'No options')}
                  </div>
                ) : null}
              </CategoryBox>

              {(guest.penaltyFee || 0) > 0 ? (
                <CategoryBox
                  title={`⚠️ ${t('패널티', 'Penalty')}`}
                  color="#f04452"
                  open={isOpen(`${roomIdx}-${guestIdx}-pen`)}
                  onToggle={() => toggle(`${roomIdx}-${guestIdx}-pen`)}
                >
                  <QtyRow
                    label={t('패널티', 'Penalty')}
                    qty={1}
                    editable={false}
                    amountLabel={money(
                      guest.penaltyFee,
                      Math.round(
                        (Number(guest.penaltyFee) || 0) /
                          (Number(settings.exchangeRate) || 1450),
                      ),
                    )}
                  />
                </CategoryBox>
              ) : null}

              <div
                style={{
                  marginTop: 12,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 12px',
                  borderRadius: 10,
                  background: '#fff1f0',
                  border: '1.5px solid #f04452',
                  fontWeight: 900,
                  fontSize: 15,
                }}
              >
                <span style={{ color: '#f04452' }}>
                  {t('다이버 소계', 'Diver subtotal')}
                </span>
                <span style={{ color: '#f04452', whiteSpace: 'nowrap' }}>
                  {money(
                    guest.individualTotalKRW,
                    guest.individualTotalUSD,
                  )}
                </span>
              </div>
            </div>
          );
        }),
      )}

      <div
        style={{
          marginTop: 16,
          padding: 12,
          borderRadius: 12,
          border: '1.5px solid #7048e8',
          background: '#f3f0ff',
        }}
      >
        <label className="label-text" style={{ marginBottom: 6 }}>
          {t('인솔자코드', 'Escort Code')}
        </label>
        <input
          className="input-field"
          value={escortCode}
          onChange={(e) =>
            setEscortCode?.(
              e.target.value.replace(/[^a-zA-Z0-9_-]/g, '').toUpperCase(),
            )
          }
          style={{ textTransform: 'uppercase', letterSpacing: 1 }}
        />
        {(processed.processedRooms || []).some((r) =>
          (r.guests || []).some((g) => (Number(g.escortDiscountKRW) || 0) > 0),
        ) ? (
          <div
            style={{
              marginTop: 8,
              fontWeight: 800,
              color: '#7048e8',
              fontSize: 13,
            }}
          >
            ✓{' '}
            {t(
              '인솔자코드 할인이 적용되었습니다.',
              'Escort code discount applied.',
            )}
          </div>
        ) : escortCode.trim() ? (
          <div style={{ marginTop: 8, fontSize: 12, color: '#f04452' }}>
            {t(
              '유효하지 않거나 적용 대상 트레이닝이 없습니다.',
              'Invalid code or no matching training in scope.',
            )}
          </div>
        ) : null}
      </div>

      <div
        style={{
          marginTop: 16,
          paddingTop: 14,
          borderTop: '2px solid #191f28',
          display: 'flex',
          justifyContent: 'space-between',
          gap: 12,
          fontWeight: 900,
          fontSize: 17,
        }}
      >
        <span>{t('통합 합계', 'Grand Total')}</span>
        <span>
          {money(processed.grandTotalKRW, processed.grandTotalUSD)}
        </span>
      </div>
    </div>
  );
}
