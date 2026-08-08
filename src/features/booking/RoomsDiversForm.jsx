import {
  Children,
  cloneElement,
  isValidElement,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  copyGuestDetailsFrom,
  createEmptyGuest,
  DISCIPLINES,
  getGuestOptionQty,
  HOUR_OPTIONS,
  maxGuestsForRoomType,
  normalizeHourTime,
  resolveOptionPrices,
  resolveOptionsCatalog,
} from '../../domain/defaults';
import { toLocalISODate } from '../../domain/dateUtils';
import {
  buildRoomShareAlert,
  buildStayOptionAutoAlert,
  buildVideoGuideAlert,
  formatPricePair,
} from '../../domain/pricing';
import { useToast } from '../../ui/ToastContext';
import { buildStep2FieldLights } from './step2FieldLights';

function Field({ label, required, error, onActivate, children }) {
  const bindActivate = (child) => {
    if (!isValidElement(child)) return child;
    const wrap = (handler) => (e) => {
      onActivate?.();
      handler?.(e);
    };
    if (child.type === 'input' || child.type === 'select') {
      return cloneElement(child, {
        className: [child.props.className, error ? 'input-field-error' : '']
          .filter(Boolean)
          .join(' '),
        'data-field-error': error ? '1' : undefined,
        onFocus: wrap(child.props.onFocus),
        onClick: wrap(child.props.onClick),
      });
    }
    if (child.type === HourSelect) {
      return cloneElement(child, {
        error,
        onActivate,
      });
    }
    return child;
  };

  return (
    <div className={`field${error ? ' field--error' : ''}`}>
      <label className="label-text">
        {label}
        {required ? <span className="required-star"> *</span> : null}
      </label>
      {Children.map(children, (child) => {
        if (!isValidElement(child)) return child;
        return bindActivate(child);
      })}
    </div>
  );
}

function HourSelect({
  value,
  fallback,
  onChange,
  error,
  onActivate,
  allowEmpty = false,
  emptyLabel = 'Select',
}) {
  const hasValue = !!(value && String(value).trim());
  const display = hasValue
    ? normalizeHourTime(value, fallback)
    : allowEmpty
      ? ''
      : normalizeHourTime(value, fallback);
  return (
    <select
      className={`input-field${error ? ' input-field-error' : ''}`}
      value={display}
      onChange={onChange}
      onFocus={() => onActivate?.()}
      onClick={() => onActivate?.()}
      data-field-error={error ? '1' : undefined}
    >
      {allowEmpty ? <option value="">{emptyLabel}</option> : null}
      {HOUR_OPTIONS.map((h) => (
        <option key={h} value={h}>
          {h}
        </option>
      ))}
    </select>
  );
}

function guestModeKey(roomIdx, guestIdx) {
  return `${roomIdx}-${guestIdx}`;
}

export default function RoomsDiversForm({
  t,
  lang = 'KO',
  repName = '',
  roomCount = 1,
  setRoomCount,
  roomsData,
  setRoomsData,
  roomTypes,
  trainingTypes,
  optionPrices: optionPricesProp,
  optionsCatalog: optionsCatalogProp,
  safetyInstructors = [],
  processed,
}) {
  const toast = useToast();
  const today = toLocalISODate();
  const optionsCatalog = resolveOptionsCatalog(
    optionsCatalogProp || optionPricesProp,
  );
  const optionPrices = resolveOptionPrices(optionsCatalog);
  const countOptions = optionsCatalog.filter(
    (o) => o.uiType !== 'transfer' && o.isActive !== false,
  );
  const transferOption = optionsCatalog.find(
    (o) => o.uiType === 'transfer' && o.isActive !== false,
  );
  const price = (krw, usd) => formatPricePair(lang, krw, usd);
  const [sameMode, setSameMode] = useState({});
  const [detailsOpen, setDetailsOpen] = useState({});
  const [touched, setTouched] = useState({});
  const touch = (key) => {
    if (!key) return;
    setTouched((prev) => (prev[key] ? prev : { ...prev, [key]: true }));
  };
  const fieldLights = useMemo(
    () =>
      buildStep2FieldLights({
        roomsData,
        trainingTypes,
        countOptions,
        touched,
      }),
    [roomsData, trainingTypes, countOptions, touched],
  );
  const err = (key) => !!fieldLights[key];
  const guestErr = (roomIdx, guestIdx, field) =>
    err(`guest:${roomIdx}:${guestIdx}:${field}`);
  const guestKey = (roomIdx, guestIdx, field) =>
    `guest:${roomIdx}:${guestIdx}:${field}`;

  const setOptionCount = (roomIdx, guestIdx, option, rawValue) => {
    const next = Math.max(0, Number(rawValue) || 0);
    const prevGuest = roomsData[roomIdx]?.guests?.[guestIdx];
    const prevQty =
      Number(
        prevGuest?.optionCounts?.[option.id] ??
          (option.id === 'FUN_DIVING' ? prevGuest?.funDiving : 0) ??
          0,
      ) || 0;
    touch(guestKey(roomIdx, guestIdx, `opt:${option.id}`));

    setRoomsData((prev) =>
      prev.map((room, i) => {
        if (i !== roomIdx) return room;
        const guests = [...(room.guests || [])];
        const g = { ...guests[guestIdx] };
        g.optionCounts = { ...(g.optionCounts || {}), [option.id]: next };
        if (option.id === 'VIDEO' || option.id === 'VIDEO_PER_DAY') {
          g.videoCount = next;
          g.needsVideo = next > 0;
        }
        if (option.id === 'HOPPING') g.islandHopping = next;
        if (option.id === 'FUN_DIVING') g.funDiving = next;
        guests[guestIdx] = g;
        return { ...room, guests };
      }),
    );

    const guide = option.guideKey || '';
    if (guide === 'video') {
      window.alert(
        buildVideoGuideAlert({
          lang,
          count: next,
          optionPrices: {
            VIDEO_PER_DAY: {
              krw: option.priceKRW,
              usd: option.priceUSD,
            },
          },
          t,
        }),
      );
    } else if (guide === 'hopping' && next > 0 && prevQty <= 0) {
      window.alert(
        t(
          '🏝️ [아일랜드 호핑 안내]\n신청자 4인 이하일 경우 추가 요금이 발생 할 수 있습니다.',
          '🏝️ [Island Hopping Notice]\nAdditional fees may apply when there are 4 or fewer applicants.',
        ),
      );
    } else if (
      (guide === 'fundiving' || option.id === 'FUN_DIVING') &&
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

  useEffect(() => {
    const name = String(repName || '')
      .replace(/[^a-zA-Z\s]/g, '')
      .trim()
      .toUpperCase();
    if (!name) return;
    setRoomsData((prev) => {
      const g0 = prev[0]?.guests?.[0];
      if (!g0 || (g0.name || '').trim()) return prev;
      return prev.map((room, ri) => {
        if (ri !== 0) return room;
        const guests = [...(room.guests || [])];
        guests[0] = { ...guests[0], name };
        return { ...room, guests };
      });
    });
  }, [repName, setRoomsData]);

  useEffect(() => {
    setSameMode((prev) => {
      let changed = false;
      const next = { ...prev };
      roomsData.forEach((room, ri) => {
        const n = room.guests?.length || 0;
        (room.guests || []).forEach((_, gi) => {
          const key = guestModeKey(ri, gi);
          if (gi > 0 && n >= 2 && !next[key]) {
            next[key] = 'ask';
            changed = true;
          }
        });
      });
      return changed ? next : prev;
    });
  }, [roomsData]);

  const applySameAsFirst = (roomIdx, guestIdx) => {
    const first = roomsData[roomIdx]?.guests?.[0];
    if (!first?.startDate || !first?.endDate) {
      toast.warn(
        t(
          '먼저 다이버 1의 일정을 입력해 주세요.',
          'Please fill Diver 1 schedule first.',
        ),
      );
      return;
    }
    const key = guestModeKey(roomIdx, guestIdx);
    setRoomsData((prev) =>
      prev.map((room, i) => {
        if (i !== roomIdx) return room;
        const guests = [...(room.guests || [])];
        guests[guestIdx] = copyGuestDetailsFrom(room.guests[0], {
          name: guests[guestIdx]?.name || '',
        });
        return { ...room, guests };
      }),
    );
    setSameMode((m) => ({ ...m, [key]: 'same' }));
    setDetailsOpen((m) => ({ ...m, [key]: false }));
  };

  const updateRoom = (roomIdx, patch) => {
    setRoomsData((prev) =>
      prev.map((room, i) => (i === roomIdx ? { ...room, ...patch } : room)),
    );
  };

  const updateGuest = (roomIdx, guestIdx, key, value) => {
    const roomSnapshot = roomsData[roomIdx];
    const prevGuest = roomSnapshot?.guests?.[guestIdx];
    let autoAlert = null;
    touch(guestKey(roomIdx, guestIdx, key));

    setRoomsData((prev) =>
      prev.map((room, i) => {
        if (i !== roomIdx) return room;
        const guests = [...(room.guests || [])];
        let nextVal = value;
        if (
          [
            'islandHopping',
            'funDiving',
            'penaltyFee',
            'videoCount',
            'restDays',
          ].includes(key)
        ) {
          nextVal = Math.max(0, Number(value) || 0);
        }
        if (key === 'name') {
          nextVal = String(value).replace(/[^a-zA-Z\s]/g, '').toUpperCase();
        }
        if (
          key === 'checkInTime' ||
          key === 'checkOutTime' ||
          key === 'pickupTime' ||
          key === 'dropoffTime'
        ) {
          if (value === '' || value == null) {
            nextVal = '';
          } else {
            const fallback =
              key === 'checkOutTime'
                ? '11:00'
                : key === 'checkInTime'
                  ? '14:00'
                  : '00:00';
            nextVal = normalizeHourTime(value, fallback);
          }
        }
        const nextGuest = { ...guests[guestIdx], [key]: nextVal };
        if (key === 'videoCount') {
          nextGuest.needsVideo = nextVal > 0;
        }
        if (key === 'needsVideo') {
          nextGuest.needsVideo = !!value;
          nextGuest.videoCount = value
            ? Math.max(1, Number(guests[guestIdx].videoCount) || 1)
            : 0;
        }

        // Live parity: early 00:00–11:00, late 13:00+
        if (key === 'checkInTime') {
          if (!nextVal) {
            nextGuest.dawnCheckIn = false;
          } else {
            const hour = Number(String(nextVal).split(':')[0] || 14);
            const shouldEarly = hour >= 0 && hour <= 11;
            if (shouldEarly) {
              if (!prevGuest?.dawnCheckIn) {
                nextGuest.dawnCheckIn = true;
                autoAlert = { kind: 'early', time: nextVal, room };
              } else {
                nextGuest.dawnCheckIn = true;
              }
            } else {
              nextGuest.dawnCheckIn = false;
            }
          }
        }
        if (key === 'checkOutTime') {
          if (!nextVal) {
            nextGuest.lateCheckOut = false;
          } else {
            const hour = Number(String(nextVal).split(':')[0] || 11);
            const shouldLate = hour >= 13;
            if (shouldLate) {
              if (!prevGuest?.lateCheckOut) {
                nextGuest.lateCheckOut = true;
                autoAlert = { kind: 'late', time: nextVal, room };
              } else {
                nextGuest.lateCheckOut = true;
              }
            } else {
              nextGuest.lateCheckOut = false;
            }
          }
        }

        guests[guestIdx] = nextGuest;
        return { ...room, guests };
      }),
    );

    if (autoAlert) {
      const msg = buildStayOptionAutoAlert({
        lang,
        kind: autoAlert.kind,
        time: autoAlert.time,
        roomType: autoAlert.room?.roomType,
        roomTypes,
        guestCount: autoAlert.room?.guests?.length || 1,
        t,
      });
      window.alert(msg);
    }
  };

  const updateTrainingCount = (roomIdx, guestIdx, trainingId, value) => {
    touch(guestKey(roomIdx, guestIdx, `train:${trainingId}`));
    setRoomsData((prev) =>
      prev.map((room, i) => {
        if (i !== roomIdx) return room;
        const guests = [...(room.guests || [])];
        const g = { ...guests[guestIdx] };
        g.trainingCounts = {
          ...(g.trainingCounts || {}),
          [trainingId]: Math.max(0, Number(value) || 0),
        };
        guests[guestIdx] = g;
        return { ...room, guests };
      }),
    );
  };

  const setGuestCount = (
    roomIdx,
    count,
    roomTypeOverride,
    { notifyShare = false } = {},
  ) => {
    const room = roomsData[roomIdx];
    const roomType =
      roomTypeOverride !== undefined ? roomTypeOverride : room?.roomType;
    const max = maxGuestsForRoomType(roomType, roomTypes);
    const n = Math.max(1, Math.min(max, Number(count) || 1));

    setRoomsData((prev) =>
      prev.map((r, i) => {
        if (i !== roomIdx) return r;
        const guests = [...(r.guests || [])];
        while (guests.length < n) guests.push(createEmptyGuest());
        while (guests.length > n) guests.pop();
        return { ...r, roomType, guestCount: n, guests };
      }),
    );

    if (notifyShare) {
      window.alert(
        buildRoomShareAlert({
          lang,
          guestCount: n,
          roomType,
          roomTypes,
          t,
        }),
      );
    }
  };

  const changeRoomType = (roomIdx, nextType) => {
    touch(`room:${roomIdx}:roomType`);
    const max = maxGuestsForRoomType(nextType, roomTypes);
    const current = roomsData[roomIdx]?.guests?.length || 1;
    if (current > max) {
      toast.warn(
        t(
          `이 객실은 최대 ${max}명까지 가능합니다.`,
          `This room allows up to ${max} guests.`,
        ),
      );
    }
    setGuestCount(roomIdx, Math.min(current, max), nextType, {
      notifyShare: false,
    });
  };

  const notifyStayOption = (kind, roomIdx, time, auto = true) => {
    const room = roomsData[roomIdx];
    window.alert(
      buildStayOptionAutoAlert({
        lang,
        kind,
        time,
        roomType: room?.roomType,
        roomTypes,
        guestCount: room?.guests?.length || 1,
        t,
        auto,
      }),
    );
  };

  return (
    <div>
      <div className="card" style={{ marginBottom: 12 }}>
        <h3 style={{ marginTop: 0 }}>
          2. {t('객실 · 다이버 정보', 'Rooms & Divers')}
        </h3>
        <div style={{ maxWidth: 280 }}>
          <Field label={t('객실 수', 'Room Count')} required>
            <select
              className="input-field"
              value={roomCount}
              onChange={(e) => setRoomCount?.(Number(e.target.value) || 1)}
            >
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>
                  {n}
                  {t('개', '')}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <p style={{ margin: '8px 0 0', fontSize: 12, color: '#8b95a1' }}>
          {t(
            '객실 수를 선택하면 아래 객실 카드가 맞춰집니다.',
            'Changing room count updates the room cards below.',
          )}
        </p>
      </div>

      {roomsData.map((room, roomIdx) => {
        const processedRoom = processed?.processedRooms?.[roomIdx];
        const maxGuests = maxGuestsForRoomType(room.roomType, roomTypes);
        const guestOptions = Array.from({ length: maxGuests }, (_, i) => i + 1);
        return (
          <div key={room.id || roomIdx} className="card">
            <h3 style={{ marginTop: 0 }}>
              {t(`객실 ${roomIdx + 1}`, `Room ${roomIdx + 1}`)}
            </h3>
            <div className="pair-row">
              <Field
                label={t('객실 타입', 'Room Type')}
                required
                error={err(`room:${roomIdx}:roomType`)}
                onActivate={() => touch(`room:${roomIdx}:roomType`)}
              >
                <select
                  className="input-field"
                  value={room.roomType || ''}
                  onChange={(e) => changeRoomType(roomIdx, e.target.value)}
                >
                  <option value="">{t('선택', 'Select')}</option>
                  <option value="NONE">
                    {t('방 사용 안함 (다이빙만)', 'No Room (Diving Only)')}
                  </option>
                  {roomTypes
                    .filter((r) => r.isActive !== false)
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        {t(r.nameKO || r.name, r.nameEN || r.name)} (
                        {price(r.priceKRW, r.priceUSD)})
                      </option>
                    ))}
                </select>
              </Field>
              <Field
                label={`${t('다이버 수', 'Diver Count')} (max ${maxGuests})`}
                required
                error={err(`room:${roomIdx}:guestCount`)}
                onActivate={() => touch(`room:${roomIdx}:guestCount`)}
              >
                <select
                  className="input-field"
                  value={Math.min(
                    room.guestCount || room.guests?.length || 1,
                    maxGuests,
                  )}
                  onChange={(e) => {
                    touch(`room:${roomIdx}:guestCount`);
                    setGuestCount(roomIdx, e.target.value, undefined, {
                      notifyShare: true,
                    });
                  }}
                >
                  {guestOptions.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            {(room.guests || []).map((guest, guestIdx) => {
              const pg = processedRoom?.guests?.[guestIdx];
              const selfCount = Number(guest.trainingCounts?.SELF_60) || 0;
              const guestCount = room.guests?.length || 1;
              const offerSame = guestIdx > 0 && guestCount >= 2;
              const modeKey = guestModeKey(roomIdx, guestIdx);
              const mode = sameMode[modeKey] || (offerSame ? 'ask' : 'custom');
              const showDetails = mode !== 'same' || !!detailsOpen[modeKey];
              const firstGuest = room.guests?.[0];

              if (mode === 'ask') {
                return (
                  <div key={guestIdx} className="sub-card same-ask-card">
                    <h4 style={{ marginTop: 0 }}>
                      {t(`다이버 ${guestIdx + 1}`, `Diver ${guestIdx + 1}`)}
                    </h4>
                    <p style={{ margin: '0 0 14px', fontSize: 14, color: 'var(--ink-2)' }}>
                      {t(
                        '다이버 1과 일정이 동일합니까? 동일하면 이름만 입력하면 됩니다.',
                        'Same schedule as Diver 1? If yes, you only need to enter the name.',
                      )}
                    </p>
                    <div className="action-row left">
                      <button
                        type="button"
                        className="btn-primary"
                        style={{ width: 'auto', background: 'var(--success)' }}
                        onClick={() => applySameAsFirst(roomIdx, guestIdx)}
                      >
                        {t('다이버 1과 동일', 'Same as Diver 1')}
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() =>
                          setSameMode((m) => ({ ...m, [modeKey]: 'custom' }))
                        }
                      >
                        {t('다르게 입력', 'Enter separately')}
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div key={guestIdx} className="sub-card">
                  <h4 style={{ marginTop: 0 }}>
                    {t(`다이버 ${guestIdx + 1}`, `Diver ${guestIdx + 1}`)}
                    {pg ? (
                      <span className="badge badge-brand" style={{ marginLeft: 8 }}>
                        {price(pg.individualTotalKRW, pg.individualTotalUSD)}
                      </span>
                    ) : null}
                  </h4>

                  {mode === 'same' && (
                    <div className="same-schedule-banner">
                      <div style={{ fontWeight: 800, marginBottom: 8 }}>
                        {t(
                          '다이버 1과 동일 일정 적용됨 — 이름만 확인/입력하세요.',
                          'Same as Diver 1 applied — enter name only.',
                        )}
                      </div>
                      <div className="same-schedule-summary">
                        {firstGuest?.startDate || '—'} ~ {firstGuest?.endDate || '—'}
                        {' · '}
                        {firstGuest?.discipline || 'CWT'}
                        {firstGuest?.targetDepth
                          ? ` ${firstGuest.targetDepth}m`
                          : ''}
                        {' · '}
                        {firstGuest?.level || ''}
                      </div>
                      <Field
                        label={t('영문 성명', 'Name (Passport)')}
                        required
                        error={guestErr(roomIdx, guestIdx, 'name')}
                        onActivate={() => touch(guestKey(roomIdx, guestIdx, 'name'))}
                      >
                        <input
                          className="input-field"
                          value={guest.name || ''}
                          onChange={(e) =>
                            updateGuest(roomIdx, guestIdx, 'name', e.target.value)
                          }
                          placeholder="HONG GILDONG"
                          autoFocus
                        />
                      </Field>
                      <div className="action-row left" style={{ marginTop: 10 }}>
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() =>
                            setDetailsOpen((m) => ({
                              ...m,
                              [modeKey]: !m[modeKey],
                            }))
                          }
                        >
                          {showDetails
                            ? t('세부 내역 접기', 'Hide details')
                            : t('세부 내역 수정', 'Edit details')}
                        </button>
                        <button
                          type="button"
                          className="btn-ghost"
                          onClick={() => applySameAsFirst(roomIdx, guestIdx)}
                        >
                          {t('다시 동일 적용', 'Re-apply same')}
                        </button>
                      </div>
                    </div>
                  )}

                  {showDetails ? (
                  <>
                  <div className="diver-split">
                    <div className="diver-split-pane">
                      <div className="label-text" style={{ marginBottom: 10 }}>
                        {t('기본 정보', 'Basic Info')}
                      </div>
                      <div className="pair-row">
                        <Field
                          label={t('영문 성명', 'Name (Passport)')}
                          required
                          error={guestErr(roomIdx, guestIdx, 'name')}
                          onActivate={() => touch(guestKey(roomIdx, guestIdx, 'name'))}
                        >
                          <input
                            className="input-field"
                            value={guest.name || ''}
                            onChange={(e) =>
                              updateGuest(roomIdx, guestIdx, 'name', e.target.value)
                            }
                            placeholder="HONG GILDONG"
                          />
                        </Field>
                        <Field
                          label={t('국적', 'Nationality')}
                          required
                          error={guestErr(roomIdx, guestIdx, 'nationality')}
                          onActivate={() => touch(guestKey(roomIdx, guestIdx, 'nationality'))}
                        >
                          <input
                            className="input-field"
                            value={guest.nationality || ''}
                            onChange={(e) =>
                              updateGuest(
                                roomIdx,
                                guestIdx,
                                'nationality',
                                e.target.value,
                              )
                            }
                          />
                        </Field>
                      </div>
                      <div className="pair-row">
                        <Field
                          label={t('레벨', 'Level')}
                          required
                          error={guestErr(roomIdx, guestIdx, 'level')}
                          onActivate={() => touch(guestKey(roomIdx, guestIdx, 'level'))}
                        >
                          <select
                            className="input-field"
                            value={guest.level || 'LEVEL_1'}
                            onChange={(e) =>
                              updateGuest(roomIdx, guestIdx, 'level', e.target.value)
                            }
                          >
                            {[
                              'LEVEL_1',
                              'LEVEL_2',
                              'LEVEL_3',
                              'LEVEL_4',
                              'INSTRUCTOR',
                            ].map((lv) => (
                              <option key={lv} value={lv}>
                                {lv}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <Field
                          label={t('종목', 'Discipline')}
                          required
                          error={guestErr(roomIdx, guestIdx, 'discipline')}
                          onActivate={() => touch(guestKey(roomIdx, guestIdx, 'discipline'))}
                        >
                          <select
                            className="input-field"
                            value={
                              DISCIPLINES.includes(guest.discipline)
                                ? guest.discipline
                                : 'CWT'
                            }
                            onChange={(e) =>
                              updateGuest(
                                roomIdx,
                                guestIdx,
                                'discipline',
                                e.target.value,
                              )
                            }
                          >
                            {DISCIPLINES.map((d) => (
                              <option key={d} value={d}>
                                {d}
                              </option>
                            ))}
                          </select>
                        </Field>
                      </div>
                      <Field
                        label={t('목표수심 (m)', 'Target Depth (m)')}
                        required
                        error={guestErr(roomIdx, guestIdx, 'targetDepth')}
                        onActivate={() => touch(guestKey(roomIdx, guestIdx, 'targetDepth'))}
                      >
                        <input
                          type="number"
                          min="0"
                          step="1"
                          className="input-field"
                          value={guest.targetDepth ?? ''}
                          placeholder="40"
                          onChange={(e) =>
                            updateGuest(
                              roomIdx,
                              guestIdx,
                              'targetDepth',
                              e.target.value === ''
                                ? ''
                                : Math.max(0, Number(e.target.value) || 0),
                            )
                          }
                        />
                      </Field>
                    </div>
                  </div>

                  <div className="diver-split">
                    <div className="diver-split-pane">
                      <div className="label-text" style={{ marginBottom: 10 }}>
                        {t('일정 / 숙박', 'Schedule / Stay')}
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: '#6b7684',
                          marginBottom: 8,
                          fontWeight: 600,
                        }}
                      >
                        {t(
                          '숙박 박수는 체크인·체크아웃(+얼리/레이트)으로만 계산됩니다. 트레이닝 횟수와 무관합니다.',
                          'Stay nights come only from check-in/out (+ early/late). Independent of training counts.',
                        )}
                      </div>
                      <div className="pair-row">
                        <Field
                          label={t('시작일', 'Start Date')}
                          required
                          error={guestErr(roomIdx, guestIdx, 'startDate')}
                          onActivate={() => touch(guestKey(roomIdx, guestIdx, 'startDate'))}
                        >
                          <input
                            type="date"
                            className="input-field"
                            min={today}
                            value={guest.startDate || ''}
                            onChange={(e) => {
                              const nextStart = e.target.value;
                              if (nextStart && nextStart < today) return;
                              setRoomsData((prev) =>
                                prev.map((room, i) => {
                                  if (i !== roomIdx) return room;
                                  const guests = [...(room.guests || [])];
                                  const g = { ...guests[guestIdx], startDate: nextStart };
                                  if (g.endDate && nextStart && g.endDate < nextStart) {
                                    g.endDate = nextStart;
                                  }
                                  guests[guestIdx] = g;
                                  return { ...room, guests };
                                }),
                              );
                            }}
                          />
                        </Field>
                        <Field
                          label={t('종료일', 'End Date')}
                          required
                          error={guestErr(roomIdx, guestIdx, 'endDate')}
                          onActivate={() => touch(guestKey(roomIdx, guestIdx, 'endDate'))}
                        >
                          <input
                            type="date"
                            className="input-field"
                            min={guest.startDate || today}
                            value={guest.endDate || ''}
                            onChange={(e) =>
                              updateGuest(
                                roomIdx,
                                guestIdx,
                                'endDate',
                                e.target.value,
                              )
                            }
                          />
                        </Field>
                      </div>
                      <div className="pair-row">
                        <Field
                          label={t('체크인 시간', 'Check-in')}
                          required
                          error={guestErr(roomIdx, guestIdx, 'checkInTime')}
                          onActivate={() => touch(guestKey(roomIdx, guestIdx, 'checkInTime'))}
                        >
                          <HourSelect
                            value={guest.checkInTime}
                            fallback="14:00"
                            allowEmpty
                            emptyLabel={t('선택', 'Select')}
                            onChange={(e) =>
                              updateGuest(
                                roomIdx,
                                guestIdx,
                                'checkInTime',
                                e.target.value,
                              )
                            }
                          />
                        </Field>
                        <Field
                          label={t('체크아웃 시간', 'Check-out')}
                          required
                          error={guestErr(roomIdx, guestIdx, 'checkOutTime')}
                          onActivate={() => touch(guestKey(roomIdx, guestIdx, 'checkOutTime'))}
                        >
                          <HourSelect
                            value={guest.checkOutTime}
                            fallback="11:00"
                            allowEmpty
                            emptyLabel={t('선택', 'Select')}
                            onChange={(e) =>
                              updateGuest(
                                roomIdx,
                                guestIdx,
                                'checkOutTime',
                                e.target.value,
                              )
                            }
                          />
                        </Field>
                      </div>
                      <div className="pair-row" style={{ marginTop: 4 }}>
                        <label
                          className={`check-label${
                            guest.dawnCheckIn ? ' red-option-box' : ''
                          }${
                            guestErr(roomIdx, guestIdx, 'dawnCheckIn')
                              ? ' check-label-error'
                              : ''
                          }`}
                          data-field-error={
                            guestErr(roomIdx, guestIdx, 'dawnCheckIn')
                              ? '1'
                              : undefined
                          }
                        >
                          <input
                            type="checkbox"
                            checked={!!guest.dawnCheckIn}
                            onClick={() =>
                              touch(guestKey(roomIdx, guestIdx, 'dawnCheckIn'))
                            }
                            onChange={(e) => {
                              const on = e.target.checked;
                              updateGuest(
                                roomIdx,
                                guestIdx,
                                'dawnCheckIn',
                                on,
                              );
                              if (on) {
                                notifyStayOption(
                                  'early',
                                  roomIdx,
                                  guest.checkInTime,
                                  false,
                                );
                              }
                            }}
                          />
                          {t('얼리체크인 (+1박)', 'Early Check-in (+1n)')}
                        </label>
                        <label
                          className={`check-label${
                            guest.lateCheckOut ? ' red-option-box' : ''
                          }${
                            guestErr(roomIdx, guestIdx, 'lateCheckOut')
                              ? ' check-label-error'
                              : ''
                          }`}
                          data-field-error={
                            guestErr(roomIdx, guestIdx, 'lateCheckOut')
                              ? '1'
                              : undefined
                          }
                        >
                          <input
                            type="checkbox"
                            checked={!!guest.lateCheckOut}
                            onClick={() =>
                              touch(guestKey(roomIdx, guestIdx, 'lateCheckOut'))
                            }
                            onChange={(e) => {
                              const on = e.target.checked;
                              updateGuest(
                                roomIdx,
                                guestIdx,
                                'lateCheckOut',
                                on,
                              );
                              if (on) {
                                notifyStayOption(
                                  'late',
                                  roomIdx,
                                  guest.checkOutTime,
                                  false,
                                );
                              }
                            }}
                          />
                          {t('레이트 체크아웃 (+1박)', 'Late Check-out (+1n)')}
                        </label>
                      </div>
                    </div>

                    <div
                      className={`diver-split-pane${
                        guestErr(roomIdx, guestIdx, 'training')
                          ? ' field-block-error'
                          : ''
                      }`}
                      data-field-error={
                        guestErr(roomIdx, guestIdx, 'training') ? '1' : undefined
                      }
                    >
                      <div className="label-text">
                        {t(
                          '신청 트레이닝 종류별 횟수 선택',
                          'Select Training Sessions by Type',
                        )}
                        <span className="required-star"> *</span>
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: '#6b7684',
                          marginBottom: 8,
                          fontWeight: 600,
                        }}
                      >
                        {t(
                          '「실제 트레이닝」= 신청 − 불참(차감). 숙박 박수와 자동 연동되지 않습니다.',
                          '“Actual training” = applied − absences. Not auto-linked to stay nights.',
                        )}
                      </div>
                      {guestErr(roomIdx, guestIdx, 'training') ? (
                        <div className="field-error-hint">
                          {t(
                            '트레이닝 또는 펀다이빙을 1회 이상 선택하세요.',
                            'Select at least one training or fun diving session.',
                          )}
                        </div>
                      ) : null}
                      <div className="grid-2 grid-2-dense">
                        {trainingTypes
                          .filter((tr) => tr.isActive !== false)
                          .map((tr) => (
                            <Field
                              key={tr.id}
                              label={`${tr.name} (${price(tr.priceKRW, tr.priceUSD)})`}
                              error={guestErr(
                                roomIdx,
                                guestIdx,
                                `train:${tr.id}`,
                              )}
                              onActivate={() =>
                                touch(
                                  guestKey(roomIdx, guestIdx, `train:${tr.id}`),
                                )
                              }
                            >
                              <input
                                type="number"
                                min="0"
                                className="input-field"
                                value={guest.trainingCounts?.[tr.id] || 0}
                                onChange={(e) =>
                                  updateTrainingCount(
                                    roomIdx,
                                    guestIdx,
                                    tr.id,
                                    e.target.value,
                                  )
                                }
                              />
                            </Field>
                          ))}
                      </div>
                      <div style={{ marginTop: 12, maxWidth: 220 }}>
                        <Field
                          label={t('🚫 불참(차감)', '🚫 Absent (deduct)')}
                          error={guestErr(roomIdx, guestIdx, 'restDays')}
                          onActivate={() =>
                            touch(guestKey(roomIdx, guestIdx, 'restDays'))
                          }
                        >
                          <input
                            type="number"
                            min="0"
                            className="input-field"
                            value={guest.restDays || 0}
                            onChange={(e) =>
                              updateGuest(
                                roomIdx,
                                guestIdx,
                                'restDays',
                                e.target.value,
                              )
                            }
                            style={{
                              color: '#f09433',
                              fontWeight: 900,
                              textAlign: 'center',
                            }}
                          />
                        </Field>
                      </div>
                    </div>
                  </div>

                  {selfCount > 0 && (
                    <div className="pair-row" style={{ marginTop: 12 }}>
                      <Field
                        label={t('세이프티 강사', 'Safety Instructor')}
                        required
                        error={guestErr(roomIdx, guestIdx, 'safetyInstructor')}
                        onActivate={() => touch(guestKey(roomIdx, guestIdx, 'safetyInstructor'))}
                      >
                        <input
                          className="input-field"
                          list="safety-instructor-list"
                          value={guest.safetyInstructor || ''}
                          onChange={(e) =>
                            updateGuest(
                              roomIdx,
                              guestIdx,
                              'safetyInstructor',
                              e.target.value,
                            )
                          }
                        />
                        <datalist id="safety-instructor-list">
                          {safetyInstructors.map((s) => (
                            <option key={s} value={s} />
                          ))}
                        </datalist>
                      </Field>
                      <label
                        className={`check-label${
                          guestErr(roomIdx, guestIdx, 'agreeSelf60')
                            ? ' check-label-error'
                            : ''
                        }`}
                        style={{ marginTop: 28 }}
                        data-field-error={
                          guestErr(roomIdx, guestIdx, 'agreeSelf60')
                            ? '1'
                            : undefined
                        }
                      >
                        <input
                          type="checkbox"
                          checked={!!guest.agreeSelf60}
                          onClick={() =>
                            touch(guestKey(roomIdx, guestIdx, 'agreeSelf60'))
                          }
                          onChange={(e) =>
                            updateGuest(
                              roomIdx,
                              guestIdx,
                              'agreeSelf60',
                              e.target.checked,
                            )
                          }
                        />
                        {t('셀프 트레이닝 면책 동의', 'Self-training agreement')}
                      </label>
                    </div>
                  )}

                  {transferOption ? (
                  <div className="pair-row" style={{ marginTop: 12 }}>
                    <div className="diver-split-pane">
                      <label
                        className={`check-label${
                          guestErr(roomIdx, guestIdx, 'airportPickup')
                            ? ' check-label-error'
                            : ''
                        }`}
                        data-field-error={
                          guestErr(roomIdx, guestIdx, 'airportPickup')
                            ? '1'
                            : undefined
                        }
                      >
                        <input
                          type="checkbox"
                          checked={!!guest.airportPickup}
                          onClick={() =>
                            touch(guestKey(roomIdx, guestIdx, 'airportPickup'))
                          }
                          onChange={(e) =>
                            updateGuest(
                              roomIdx,
                              guestIdx,
                              'airportPickup',
                              e.target.checked,
                            )
                          }
                        />
                        {t('공항 픽업', 'Airport Pickup')} (
                        {price(
                          transferOption.priceKRW,
                          transferOption.priceUSD,
                        )}
                        )
                      </label>
                      {guest.airportPickup && (
                        <>
                          <Field
                            label={t('항공편명', 'Flight No.')}
                            required
                            error={guestErr(roomIdx, guestIdx, 'pickupFlight')}
                            onActivate={() => touch(guestKey(roomIdx, guestIdx, 'pickupFlight'))}
                          >
                            <input
                              className="input-field"
                              value={guest.pickupFlight || ''}
                              placeholder="7C2113"
                              onChange={(e) =>
                                updateGuest(
                                  roomIdx,
                                  guestIdx,
                                  'pickupFlight',
                                  e.target.value.toUpperCase(),
                                )
                              }
                            />
                          </Field>
                          <Field
                            label={t('도착시간', 'Arrival time')}
                            required
                            error={guestErr(roomIdx, guestIdx, 'pickupTime')}
                            onActivate={() => touch(guestKey(roomIdx, guestIdx, 'pickupTime'))}
                          >
                            <HourSelect
                              value={guest.pickupTime}
                              fallback="00:00"
                              onChange={(e) =>
                                updateGuest(
                                  roomIdx,
                                  guestIdx,
                                  'pickupTime',
                                  e.target.value,
                                )
                              }
                            />
                          </Field>
                        </>
                      )}
                    </div>

                    <div className="diver-split-pane">
                      <label
                        className={`check-label${
                          guestErr(roomIdx, guestIdx, 'airportDropoff')
                            ? ' check-label-error'
                            : ''
                        }`}
                        data-field-error={
                          guestErr(roomIdx, guestIdx, 'airportDropoff')
                            ? '1'
                            : undefined
                        }
                      >
                        <input
                          type="checkbox"
                          checked={!!guest.airportDropoff}
                          onClick={() =>
                            touch(guestKey(roomIdx, guestIdx, 'airportDropoff'))
                          }
                          onChange={(e) =>
                            updateGuest(
                              roomIdx,
                              guestIdx,
                              'airportDropoff',
                              e.target.checked,
                            )
                          }
                        />
                        {t('공항 드롭오프', 'Airport Dropoff')} (
                        {price(
                          transferOption.priceKRW,
                          transferOption.priceUSD,
                        )}
                        )
                      </label>
                      {guest.airportDropoff && (
                        <>
                          <Field
                            label={t('항공편명', 'Flight No.')}
                            required
                            error={guestErr(roomIdx, guestIdx, 'dropoffFlight')}
                            onActivate={() => touch(guestKey(roomIdx, guestIdx, 'dropoffFlight'))}
                          >
                            <input
                              className="input-field"
                              value={guest.dropoffFlight || ''}
                              placeholder="7C2114"
                              onChange={(e) =>
                                updateGuest(
                                  roomIdx,
                                  guestIdx,
                                  'dropoffFlight',
                                  e.target.value.toUpperCase(),
                                )
                              }
                            />
                          </Field>
                          <Field
                            label={t('출발시간', 'Departure time')}
                            required
                            error={guestErr(roomIdx, guestIdx, 'dropoffTime')}
                            onActivate={() => touch(guestKey(roomIdx, guestIdx, 'dropoffTime'))}
                          >
                            <HourSelect
                              value={guest.dropoffTime}
                              fallback="00:00"
                              onChange={(e) =>
                                updateGuest(
                                  roomIdx,
                                  guestIdx,
                                  'dropoffTime',
                                  e.target.value,
                                )
                              }
                            />
                          </Field>
                        </>
                      )}
                    </div>
                  </div>
                  ) : null}

                  <div className="grid-2" style={{ marginTop: 12 }}>
                    {countOptions.map((opt) => (
                      <Field
                        key={opt.id}
                        label={`${t(opt.nameKO, opt.nameEN)} (${price(
                          opt.priceKRW,
                          opt.priceUSD,
                        )}/${t(opt.unitKO || '회', opt.unitEN || 'x')})`}
                        error={guestErr(roomIdx, guestIdx, `opt:${opt.id}`)}
                        onActivate={() => touch(guestKey(roomIdx, guestIdx, `opt:${opt.id}`))}
                      >
                        <input
                          type="number"
                          min="0"
                          className="input-field"
                          value={getGuestOptionQty(guest, opt.id)}
                          onChange={(e) =>
                            setOptionCount(
                              roomIdx,
                              guestIdx,
                              opt,
                              e.target.value,
                            )
                          }
                        />
                      </Field>
                    ))}
                  </div>
                  </>
                  ) : null}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
