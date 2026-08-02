import { useEffect, useState } from 'react';
import {
  copyGuestDetailsFrom,
  createEmptyGuest,
  DISCIPLINES,
  HOUR_OPTIONS,
  maxGuestsForRoomType,
  normalizeHourTime,
  resolveOptionPrices,
} from '../../domain/defaults';
import { toLocalISODate } from '../../domain/dateUtils';
import {
  buildStayOptionAutoAlert,
  formatPricePair,
} from '../../domain/pricing';
import { useToast } from '../../ui/ToastContext';

function Field({ label, required, children }) {
  return (
    <div className="field">
      <label className="label-text">
        {label}
        {required ? <span className="required-star"> *</span> : null}
      </label>
      {children}
    </div>
  );
}

function HourSelect({ value, fallback, onChange }) {
  const normalized = normalizeHourTime(value, fallback);
  return (
    <select className="input-field" value={normalized} onChange={onChange}>
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
  roomsData,
  setRoomsData,
  roomTypes,
  trainingTypes,
  optionPrices: optionPricesProp,
  safetyInstructors = [],
  processed,
}) {
  const toast = useToast();
  const today = toLocalISODate();
  const optionPrices = resolveOptionPrices(optionPricesProp);
  const price = (krw, usd) => formatPricePair(lang, krw, usd);
  const [sameMode, setSameMode] = useState({});
  const [detailsOpen, setDetailsOpen] = useState({});

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

    setRoomsData((prev) =>
      prev.map((room, i) => {
        if (i !== roomIdx) return room;
        const guests = [...(room.guests || [])];
        let nextVal = value;
        if (['islandHopping', 'funDiving', 'restDays', 'penaltyFee'].includes(key)) {
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
          const fallback =
            key === 'checkOutTime'
              ? '11:00'
              : key === 'checkInTime'
                ? '14:00'
                : '00:00';
          nextVal = normalizeHourTime(value, fallback);
        }
        const nextGuest = { ...guests[guestIdx], [key]: nextVal };

        // Live parity: early 00:00–11:00, late 13:00+
        if (key === 'checkInTime') {
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
        if (key === 'checkOutTime') {
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

  const setGuestCount = (roomIdx, count, roomTypeOverride) => {
    setRoomsData((prev) =>
      prev.map((room, i) => {
        if (i !== roomIdx) return room;
        const roomType =
          roomTypeOverride !== undefined ? roomTypeOverride : room.roomType;
        const max = maxGuestsForRoomType(roomType, roomTypes);
        const n = Math.max(1, Math.min(max, Number(count) || 1));
        const guests = [...(room.guests || [])];
        while (guests.length < n) guests.push(createEmptyGuest());
        while (guests.length > n) guests.pop();
        return { ...room, roomType, guestCount: n, guests };
      }),
    );
  };

  const changeRoomType = (roomIdx, nextType) => {
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
    setGuestCount(roomIdx, Math.min(current, max), nextType);
  };

  return (
    <div>
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
              <Field label={t('객실 타입', 'Room Type')} required>
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
              >
                <select
                  className="input-field"
                  value={Math.min(
                    room.guestCount || room.guests?.length || 1,
                    maxGuests,
                  )}
                  onChange={(e) => setGuestCount(roomIdx, e.target.value)}
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
                      <Field label={t('영문 성명', 'Name (Passport)')} required>
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
                        <Field label={t('영문 성명', 'Name (Passport)')} required>
                          <input
                            className="input-field"
                            value={guest.name || ''}
                            onChange={(e) =>
                              updateGuest(roomIdx, guestIdx, 'name', e.target.value)
                            }
                            placeholder="HONG GILDONG"
                          />
                        </Field>
                        <Field label={t('국적', 'Nationality')} required>
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
                        <Field label={t('레벨', 'Level')} required>
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
                        <Field label={t('종목', 'Discipline')} required>
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
                      <Field label={t('목표수심 (m)', 'Target Depth (m)')} required>
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

                    <div className="diver-split-pane">
                      <div className="label-text" style={{ marginBottom: 10 }}>
                        {t('일정 / 숙박', 'Schedule / Stay')}
                      </div>
                      <div className="pair-row">
                        <Field label={t('시작일', 'Start Date')} required>
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
                        <Field label={t('종료일', 'End Date')} required>
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
                        <Field label={t('체크인 시간', 'Check-in')}>
                          <HourSelect
                            value={guest.checkInTime}
                            fallback="14:00"
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
                        <Field label={t('체크아웃 시간', 'Check-out')}>
                          <HourSelect
                            value={guest.checkOutTime}
                            fallback="11:00"
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
                          className={`check-label${guest.dawnCheckIn ? ' red-option-box' : ''}`}
                        >
                          <input
                            type="checkbox"
                            checked={!!guest.dawnCheckIn}
                            onChange={(e) =>
                              updateGuest(
                                roomIdx,
                                guestIdx,
                                'dawnCheckIn',
                                e.target.checked,
                              )
                            }
                          />
                          {t('얼리체크인 (+1박)', 'Early Check-in (+1n)')}
                        </label>
                        <label
                          className={`check-label${guest.lateCheckOut ? ' red-option-box' : ''}`}
                        >
                          <input
                            type="checkbox"
                            checked={!!guest.lateCheckOut}
                            onChange={(e) =>
                              updateGuest(
                                roomIdx,
                                guestIdx,
                                'lateCheckOut',
                                e.target.checked,
                              )
                            }
                          />
                          {t('레이트 체크아웃 (+1박)', 'Late Check-out (+1n)')}
                        </label>
                      </div>
                    </div>
                  </div>

                  <div style={{ marginTop: 16 }}>
                    <div className="label-text">
                      {t(
                        '신청 트레이닝 종류별 횟수 선택',
                        'Select Training Sessions by Type',
                      )}
                      <span className="required-star"> *</span>
                    </div>
                    <div className="grid-2 grid-2-dense">
                      {trainingTypes
                        .filter((tr) => tr.isActive !== false)
                        .map((tr) => (
                          <Field
                            key={tr.id}
                            label={`${tr.name} (${price(tr.priceKRW, tr.priceUSD)})`}
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
                  </div>

                  {selfCount > 0 && (
                    <div className="pair-row" style={{ marginTop: 12 }}>
                      <Field
                        label={t('세이프티 강사', 'Safety Instructor')}
                        required
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
                      <label className="check-label" style={{ marginTop: 28 }}>
                        <input
                          type="checkbox"
                          checked={!!guest.agreeSelf60}
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

                  <div className="pair-row" style={{ marginTop: 12 }}>
                    <div className="diver-split-pane">
                      <label className="check-label">
                        <input
                          type="checkbox"
                          checked={!!guest.airportPickup}
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
                          optionPrices.TRANSFER.krw,
                          optionPrices.TRANSFER.usd,
                        )}
                        )
                      </label>
                      {guest.airportPickup && (
                        <>
                          <Field
                            label={t('항공편명', 'Flight No.')}
                            required
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
                      <label className="check-label">
                        <input
                          type="checkbox"
                          checked={!!guest.airportDropoff}
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
                          optionPrices.TRANSFER.krw,
                          optionPrices.TRANSFER.usd,
                        )}
                        )
                      </label>
                      {guest.airportDropoff && (
                        <>
                          <Field
                            label={t('항공편명', 'Flight No.')}
                            required
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

                  <div className="grid-2" style={{ marginTop: 12 }}>
                    <label className="check-label" style={{ gridColumn: '1 / -1' }}>
                      <input
                        type="checkbox"
                        checked={!!guest.needsVideo}
                        onChange={(e) =>
                          updateGuest(
                            roomIdx,
                            guestIdx,
                            'needsVideo',
                            e.target.checked,
                          )
                        }
                      />
                      {t('영상 촬영', 'Video')} (
                      {price(
                        optionPrices.VIDEO_PER_DAY.krw,
                        optionPrices.VIDEO_PER_DAY.usd,
                      )}
                      /{t('일', 'day')})
                    </label>
                    <Field
                      label={`${t('아일랜드 호핑 횟수', 'Island Hopping')} (${price(
                        optionPrices.HOPPING.krw,
                        optionPrices.HOPPING.usd,
                      )}/${t('회', 'x')})`}
                    >
                      <input
                        type="number"
                        min="0"
                        className="input-field"
                        value={guest.islandHopping || 0}
                        onChange={(e) =>
                          updateGuest(
                            roomIdx,
                            guestIdx,
                            'islandHopping',
                            e.target.value,
                          )
                        }
                      />
                    </Field>
                    <Field
                      label={`${t('펀다이빙 횟수', 'Fun Diving')} (${price(
                        optionPrices.FUN_DIVING.krw,
                        optionPrices.FUN_DIVING.usd,
                      )}/${t('회', 'x')})`}
                    >
                      <input
                        type="number"
                        min="0"
                        className="input-field"
                        value={guest.funDiving || 0}
                        onChange={(e) =>
                          updateGuest(
                            roomIdx,
                            guestIdx,
                            'funDiving',
                            e.target.value,
                          )
                        }
                      />
                    </Field>
                    <Field label={t('휴식일', 'Rest Days')}>
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
                      />
                    </Field>
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
