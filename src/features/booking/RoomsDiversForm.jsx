import {
  createEmptyGuest,
  DISCIPLINES,
  HOUR_OPTIONS,
  normalizeHourTime,
} from '../../domain/defaults';
import { toLocalISODate } from '../../domain/dateUtils';
import { formatMoney } from '../../domain/pricing';

function Field({ label, required, children }) {
  return (
    <div>
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

export default function RoomsDiversForm({
  t,
  roomsData,
  setRoomsData,
  roomTypes,
  trainingTypes,
  safetyInstructors = [],
  processed,
}) {
  const today = toLocalISODate();

  const updateRoom = (roomIdx, patch) => {
    setRoomsData((prev) =>
      prev.map((room, i) => (i === roomIdx ? { ...room, ...patch } : room)),
    );
  };

  const updateGuest = (roomIdx, guestIdx, key, value) => {
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
        guests[guestIdx] = { ...guests[guestIdx], [key]: nextVal };

        if (key === 'checkInTime') {
          const hour = Number(String(nextVal).split(':')[0] || 14);
          if (hour < 14) guests[guestIdx].dawnCheckIn = true;
        }
        if (key === 'checkOutTime') {
          const hour = Number(String(nextVal).split(':')[0] || 11);
          if (hour > 11) guests[guestIdx].lateCheckOut = true;
        }
        return { ...room, guests };
      }),
    );
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

  const setGuestCount = (roomIdx, count) => {
    const n = Math.max(1, Math.min(4, Number(count) || 1));
    setRoomsData((prev) =>
      prev.map((room, i) => {
        if (i !== roomIdx) return room;
        const guests = [...(room.guests || [])];
        while (guests.length < n) guests.push(createEmptyGuest());
        while (guests.length > n) guests.pop();
        return { ...room, guestCount: n, guests };
      }),
    );
  };

  return (
    <div>
      {roomsData.map((room, roomIdx) => {
        const processedRoom = processed?.processedRooms?.[roomIdx];
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
                  onChange={(e) => updateRoom(roomIdx, { roomType: e.target.value })}
                >
                  <option value="">{t('선택', 'Select')}</option>
                  <option value="NONE">
                    {t('방 사용 안함 (다이빙만)', 'No Room (Diving Only)')}
                  </option>
                  {roomTypes
                    .filter((r) => r.isActive !== false)
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        {t(r.nameKO || r.name, r.nameEN || r.name)} (₩
                        {formatMoney(r.priceKRW)})
                      </option>
                    ))}
                </select>
              </Field>
              <Field label={t('다이버 수', 'Diver Count')} required>
                <select
                  className="input-field"
                  value={room.guestCount || room.guests?.length || 1}
                  onChange={(e) => setGuestCount(roomIdx, e.target.value)}
                >
                  {[1, 2, 3, 4].map((n) => (
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
              return (
                <div key={guestIdx} className="sub-card">
                  <h4 style={{ marginTop: 0 }}>
                    {t(`다이버 ${guestIdx + 1}`, `Diver ${guestIdx + 1}`)}
                    {pg ? (
                      <span className="badge badge-brand" style={{ marginLeft: 8 }}>
                        ₩{formatMoney(pg.individualTotalKRW)}
                      </span>
                    ) : null}
                  </h4>

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
                        <label className="check-label">
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
                          {t('이른 체크인 (+1박)', 'Early Check-in (+1n)')}
                        </label>
                        <label className="check-label">
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
                    <div className="grid-2">
                      {trainingTypes
                        .filter((tr) => tr.isActive !== false)
                        .map((tr) => (
                          <Field
                            key={tr.id}
                            label={`${tr.name} (₩${formatMoney(tr.priceKRW)})`}
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
                        {t('공항 픽업', 'Airport Pickup')}
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
                        {t('공항 드롭오프', 'Airport Dropoff')}
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
                    <label className="check-label">
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
                      {t('영상 촬영', 'Video')}
                    </label>
                    <Field label={t('아일랜드 호핑 횟수', 'Island Hopping')}>
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
                    <Field label={t('펀다이빙 횟수', 'Fun Diving')}>
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
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
