import emailjs from '@emailjs/browser';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  createEmptyRoom,
  DEFAULT_GROUP_PIN,
  HOTEL_INFO,
  STORAGE_KEYS,
} from '../../domain/defaults';
import {
  buildPricingExtras,
  formatPricePair,
  processRoomsData,
} from '../../domain/pricing';
import { addAdminLog } from '../../data/logsRepo';
import { createReservation } from '../../data/reservationsRepo';
import { createTranslator } from '../../i18n/t';
import BrandLockup from '../../components/BrandLockup';
import RollingBanner from '../../components/RollingBanner';
import {
  clearGuestSession,
  continueAsGuest,
  consumeGoogleRedirect,
  getCurrentAuthUser,
  loadGuestSession,
  persistGuestUser,
  signInWithGoogle,
  signOutGuest,
  watchGuestAuth,
} from '../../lib/guestAuth';
import RoomsDiversForm from '../booking/RoomsDiversForm';
import GuestBillingSummary from './GuestBillingSummary';
import StepIndicator from '../../ui/StepIndicator';
import StickyActionBar from '../../ui/StickyActionBar';
import { useToast } from '../../ui/ToastContext';

export default function GuestApp({ settings }) {
  const toast = useToast();
  const [lang, setLang] = useState(
    () => localStorage.getItem('guest_lang') || 'KO',
  );
  const t = useMemo(() => createTranslator(lang), [lang]);
  const [session, setSession] = useState(loadGuestSession);
  const [authBusy, setAuthBusy] = useState(false);
  const [showEmailGate, setShowEmailGate] = useState(false);
  const [gateEmail, setGateEmail] = useState('');
  const [gateName, setGateName] = useState('');
  const [step, setStep] = useState(1);
  const [maxReached, setMaxReached] = useState(1);
  const [repName, setRepName] = useState(session.repName || '');
  const [repEmail, setRepEmail] = useState(
    () =>
      session.email ||
      localStorage.getItem(STORAGE_KEYS.lastBookingInstructor) ||
      '',
  );
  const [groupPin, setGroupPin] = useState(DEFAULT_GROUP_PIN);
  /** Login ID = voucher email (same value). */
  const bookingInstructor = repEmail.trim();
  const [roomCount, setRoomCount] = useState(1);
  const [roomsData, setRoomsData] = useState([createEmptyRoom(1)]);
  const [agreed, setAgreed] = useState(false);
  const [consents, setConsents] = useState({
    privacy: false,
    marketing: false,
    portrait: false,
  });
  const [escortCode, setEscortCode] = useState('');
  const [drawing, setDrawing] = useState(false);
  const canvasRef = useRef(null);
  const hasStroke = useRef(false);

  useEffect(() => {
    localStorage.setItem('guest_lang', lang);
  }, [lang]);

  useEffect(() => {
    emailjs.init(import.meta.env.VITE_EMAILJS_PUBLIC_KEY);
  }, []);

  useEffect(() => {
    let alive = true;

    const applyUser = (user, notify = false) => {
      if (!user || !alive) return;
      const next = persistGuestUser(user);
      setRepEmail(next.email);
      setRepName(next.repName);
      setSession(next);
      if (notify) toast.success(t('로그인되었습니다.', 'Signed in.'));
    };

    (async () => {
      try {
        const redirected = await consumeGoogleRedirect();
        if (redirected) {
          applyUser(redirected, true);
          return;
        }
        const current = getCurrentAuthUser();
        if (current) applyUser(current, false);
      } catch (err) {
        if (!alive) return;
        toast.error(
          err?.message ||
            t(
              '구글 로그인에 실패했습니다. 팝업 차단을 해제한 뒤 다시 시도하세요.',
              'Google sign-in failed. Allow popups and retry.',
            ),
        );
      }
    })();

    const unsub = watchGuestAuth((user) => {
      if (!alive) return;
      if (user) applyUser(user, false);
    });

    return () => {
      alive = false;
      unsub();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setRoomsData((prev) => {
      const next = [...prev];
      while (next.length < roomCount) {
        next.push(createEmptyRoom(next.length + 1));
      }
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
        settings.optionsCatalogConfig || settings.optionPricesConfig,
        buildPricingExtras(settings, escortCode),
      ),
    [roomsData, settings, escortCode],
  );

  const enterBooking = (next) => {
    setRepEmail(next.email);
    setRepName(next.repName);
    setSession(next);
    toast.success(
      t('로그인되었습니다. 예약을 시작하세요.', 'Signed in. Start booking.'),
    );
  };

  const loginGoogle = async () => {
    if (authBusy) return;
    try {
      if (window.location.hostname === '127.0.0.1') {
        const url = new URL(window.location.href);
        url.hostname = 'localhost';
        window.location.replace(url.toString());
        return;
      }
      setAuthBusy(true);
      const result = await signInWithGoogle();
      enterBooking(persistGuestUser(result.user));
    } catch (err) {
      console.error(err);
      toast.error(
        err?.message ||
          t(
            '구글 로그인 실패. 아래 이메일로 예약을 시작할 수 있습니다.',
            'Google sign-in failed. You can start with email below.',
          ),
      );
      setShowEmailGate(true);
    } finally {
      setAuthBusy(false);
    }
  };

  const loginWithEmail = () => {
    if (!gateEmail.trim() || !gateEmail.includes('@')) {
      toast.warn(t('이메일을 입력하세요.', 'Enter a valid email.'));
      return;
    }
    if (!gateName.trim()) {
      toast.warn(t('이름을 입력하세요.', 'Enter your name.'));
      return;
    }
    enterBooking(
      continueAsGuest({ email: gateEmail.trim(), name: gateName.trim() }),
    );
  };

  const logout = async () => {
    await signOutGuest();
    clearGuestSession();
    setSession(loadGuestSession());
  };

  const goStep = (n) => {
    setStep(n);
    setMaxReached((m) => Math.max(m, n));
  };

  const seedDiver1FromRep = () => {
    const name = repName.trim().toUpperCase();
    if (!name) return;
    setRoomsData((prev) =>
      prev.map((room, ri) => {
        if (ri !== 0) return room;
        const guests = [...(room.guests || [])];
        if (!guests[0]) return room;
        guests[0] = {
          ...guests[0],
          name: guests[0].name?.trim() ? guests[0].name : name,
        };
        return { ...room, guests };
      }),
    );
  };

  const validateStep1 = () => {
    if (!repName.trim()) {
      toast.warn(t('예약자명을 입력하세요.', 'Enter holder name.'));
      return false;
    }
    if (!repEmail.trim() || !repEmail.includes('@')) {
      toast.warn(t('이메일을 입력하세요.', 'Enter a valid email.'));
      return false;
    }
    if (!/^\d{4}$/.test(groupPin)) {
      toast.warn(t('4자리 PIN을 입력하세요.', 'Enter 4-digit PIN.'));
      return false;
    }
    if (!consents.privacy) {
      toast.warn(
        t(
          '개인정보 수집·이용 동의는 필수입니다.',
          'Privacy consent is required.',
        ),
      );
      return false;
    }
    localStorage.setItem(
      STORAGE_KEYS.lastBookingInstructor,
      bookingInstructor,
    );
    seedDiver1FromRep();
    return true;
  };

  const collectStep2Errors = (rooms) => {
    const errors = {};
    const messages = [];
    const mark = (key, msg) => {
      errors[key] = true;
      if (msg) messages.push(msg);
    };

    for (let ri = 0; ri < rooms.length; ri += 1) {
      const room = rooms[ri];
      if (!room.roomType) {
        mark(
          `room:${ri}:roomType`,
          t(`객실 ${ri + 1} 타입을 선택하세요.`, `Select room ${ri + 1} type.`),
        );
      }
      for (let gi = 0; gi < (room.guests || []).length; gi += 1) {
        const g = room.guests[gi];
        const d = gi + 1;
        const gk = (field) => `guest:${ri}:${gi}:${field}`;

        let basicMissing = false;
        if (!String(g.name || '').trim()) {
          mark(gk('name'));
          basicMissing = true;
        }
        if (!String(g.nationality || '').trim()) {
          mark(gk('nationality'));
          basicMissing = true;
        }
        if (!g.startDate) {
          mark(gk('startDate'));
          basicMissing = true;
        }
        if (!g.endDate) {
          mark(gk('endDate'));
          basicMissing = true;
        }
        if (basicMissing) {
          messages.push(
            t(
              `다이버 ${d} 필수 정보를 입력하세요.`,
              `Fill required fields for diver ${d}.`,
            ),
          );
        }

        let diveMissing = false;
        if (!g.discipline) {
          mark(gk('discipline'));
          diveMissing = true;
        }
        if (g.targetDepth === '' || g.targetDepth == null) {
          mark(gk('targetDepth'));
          diveMissing = true;
        }
        if (diveMissing) {
          messages.push(
            t(
              `다이버 ${d} 종목과 목표수심을 입력하세요.`,
              `Select discipline and target depth for diver ${d}.`,
            ),
          );
        }

        const counts = g.trainingCounts || {};
        const totalTrain = Object.values(counts).reduce(
          (a, b) => a + (Number(b) || 0),
          0,
        );
        const funQty =
          Number(g.funDiving) || Number(g.optionCounts?.FUN_DIVING) || 0;
        if (totalTrain <= 0 && funQty <= 0) {
          mark(
            gk('training'),
            t(
              `다이버 ${d} 트레이닝/펀다이빙을 선택하세요.`,
              `Select training/fun diving for diver ${d}.`,
            ),
          );
        }
        if ((counts.SELF_60 || 0) > 0) {
          if (!g.safetyInstructor?.trim()) {
            mark(
              gk('safetyInstructor'),
              t(
                `다이버 ${d} 세이프티 강사명을 입력하세요.`,
                `Safety instructor required for diver ${d}.`,
              ),
            );
          }
          if (!g.agreeSelf60) {
            mark(
              gk('agreeSelf60'),
              t(
                `다이버 ${d} 셀프 트레이닝 동의에 체크하세요.`,
                `Check self-training agreement for diver ${d}.`,
              ),
            );
          }
        }
        if (g.airportPickup && !String(g.pickupFlight || '').trim()) {
          mark(
            gk('pickupFlight'),
            t(
              `다이버 ${d} 픽업 항공편명을 입력하세요.`,
              `Enter pickup flight for diver ${d}.`,
            ),
          );
        }
        if (g.airportDropoff && !String(g.dropoffFlight || '').trim()) {
          mark(
            gk('dropoffFlight'),
            t(
              `다이버 ${d} 드롭오프 항공편명을 입력하세요.`,
              `Enter dropoff flight for diver ${d}.`,
            ),
          );
        }
      }
    }
    return { errors, messages };
  };

  const validateStep2 = () => {
    const { errors, messages } = collectStep2Errors(roomsData);
    const keys = Object.keys(errors);
    if (keys.length === 0) return true;

    const uniqueMsgs = [...new Set(messages.filter(Boolean))];
    toast.warn(
      uniqueMsgs[0] +
        (keys.length > 1
          ? t(` (미입력 ${keys.length}건)`, ` (${keys.length} missing)`)
          : ''),
    );
    requestAnimationFrame(() => {
      document
        .querySelector('[data-field-error="1"]')
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    return false;
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasStroke.current = false;
  };

  const pointerPos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const src = e.touches ? e.touches[0] : e;
    return {
      x: ((src.clientX - rect.left) / rect.width) * canvas.width,
      y: ((src.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const startDraw = (e) => {
    e.preventDefault();
    const ctx = canvasRef.current.getContext('2d');
    const p = pointerPos(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    setDrawing(true);
  };

  const moveDraw = (e) => {
    if (!drawing) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext('2d');
    const p = pointerPos(e);
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#111';
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    hasStroke.current = true;
  };

  const endDraw = () => setDrawing(false);

  const submit = async () => {
    if (!agreed || !hasStroke.current) {
      toast.warn(
        t('약관 동의 및 서명이 필요합니다.', 'Agreement & Signature required.'),
      );
      return;
    }
    try {
      const submittedAt = new Date().toISOString();
      const payload = {
        bookingInstructor: bookingInstructor.trim(),
        repName: repName.trim().toUpperCase(),
        repEmail: repEmail.trim(),
        groupPin,
        roomCount,
        roomsData: processed.processedRooms,
        grandTotalKRW: processed.grandTotalKRW,
        grandTotalUSD: processed.grandTotalUSD,
        appliedExchangeRate: settings.exchangeRate,
        paymentStatus: '대기',
        voucherStatus: '미전달',
        assignedRoomNumbers: '',
        hotelPaymentStatus: '미정산',
        cancelStatus: '',
        cancelIsNew: false,
        adminMemo: '',
        signatureData: canvasRef.current.toDataURL(),
        submittedAt,
        consents: { ...consents },
        escortCode: String(escortCode || '')
          .trim()
          .toUpperCase(),
      };
      await createReservation(payload);
      await addAdminLog({
        type: 'NEW',
        message: `[신규 예약] ${payload.repName} 그룹 예약 접수 (예약자: ${payload.bookingInstructor})`,
      });

      const body = [
        `🔐 [${t('예약 로그인 계정 정보', 'Login Credentials')}]`,
        `- ${t('예약자 ID / 성명', 'Holder ID / Name')}: ${payload.bookingInstructor}`,
        `- ${t('조회용 비밀번호', 'PIN')}: ${groupPin}`,
        '',
        `🏨 [${t('호텔 안내', 'Hotel Info')}]`,
        `- ${t('주소', 'Address')}: ${HOTEL_INFO.name}, ${HOTEL_INFO.address}`,
        '',
        `${t('합계', 'Total')}: ${formatPricePair(lang, payload.grandTotalKRW, payload.grandTotalUSD)}`,
      ].join('\n');

      try {
        await emailjs.send(
          import.meta.env.VITE_EMAILJS_SERVICE_ID,
          import.meta.env.VITE_EMAILJS_TEMPLATE_ID,
          {
            to_email: payload.repEmail,
            to_name: payload.repName,
            message: body,
          },
        );
      } catch {
        /* email is best-effort */
      }

      toast.success(
        t(
          '예약이 접수되었습니다. 이메일을 확인하세요.',
          'Booking submitted. Check your email.',
        ),
      );
      setStep(1);
      setMaxReached(1);
      setRoomsData([createEmptyRoom(1)]);
      setRoomCount(1);
      setGroupPin('');
      setAgreed(false);
      setConsents({ privacy: false, marketing: false, portrait: false });
      setEscortCode('');
      clearCanvas();
    } catch (err) {
      toast.error(err.message || t('저장 실패', 'Submit failed'));
    }
  };

  if (!session.loggedIn) {
    return (
      <div className="app-shell">
        <RollingBanner ads={settings.adsConfig} />
        <div className="lang-switch">
          <button
            type="button"
            className={lang === 'KO' ? 'active btn-ghost' : 'btn-ghost'}
            onClick={() => setLang('KO')}
          >
            KOR
          </button>
          <button
            type="button"
            className={lang === 'EN' ? 'active btn-ghost' : 'btn-ghost'}
            onClick={() => setLang('EN')}
          >
            ENG
          </button>
        </div>
        <div className="card login-card">
          <h1>IDA x DOUBLE K FREEDIVING</h1>
          <p>
            {t(
              '프리다이빙 연합 예약 시스템에 오신 것을 환영합니다.',
              'Welcome to the Freediving Federation Reservation System.',
            )}
          </p>
          <button
            type="button"
            className="google-btn"
            onClick={loginGoogle}
            disabled={authBusy}
          >
            <img
              alt="Google"
              src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
            />
            {authBusy
              ? t('로그인 중…', 'Signing in…')
              : t('구글 계정으로 시작하기', 'Start with Google')}
          </button>

          <button
            type="button"
            className="btn-secondary"
            style={{ width: '100%', marginTop: 10 }}
            onClick={() => setShowEmailGate((v) => !v)}
          >
            {t('이메일로 예약 시작', 'Start with email')}
          </button>

          {showEmailGate && (
            <div style={{ marginTop: 14, textAlign: 'left' }}>
              <label className="label-text">
                {t('예약자명 (여권 영문)', 'Name (Passport)')}
              </label>
              <input
                className="input-field"
                value={gateName}
                onChange={(e) =>
                  setGateName(
                    e.target.value.replace(/[^a-zA-Z\s]/g, '').toUpperCase(),
                  )
                }
                placeholder="HONG GILDONG"
              />
              <label className="label-text" style={{ marginTop: 10 }}>
                {t('이메일', 'Email')}
              </label>
              <input
                className="input-field"
                type="email"
                value={gateEmail}
                onChange={(e) => setGateEmail(e.target.value)}
                placeholder="you@email.com"
              />
              <button
                type="button"
                className="btn-primary"
                style={{ marginTop: 12 }}
                onClick={loginWithEmail}
              >
                {t('예약 시작하기', 'Start booking')}
              </button>
            </div>
          )}

          <div style={{ marginTop: 16 }}>
            <Link to="/admin" className="btn-ghost">
              {t('강사 / 관리자 포털', 'Instructor / Admin Portal')}
            </Link>
          </div>
        </div>
        <footer className="site-brand-footer">
          <BrandLockup variant="footer" showTagline={false} />
        </footer>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <RollingBanner ads={settings.adsConfig} />
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
        }}
      >
        <strong style={{ fontSize: 13, color: '#4e5968' }}>
          {t(
            '당신의 다이빙 여정을 계획 해보세요',
            'Plan your diving journey',
          )}
        </strong>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div className="lang-switch">
            <button
              type="button"
              className={lang === 'KO' ? 'active btn-ghost' : 'btn-ghost'}
              onClick={() => setLang('KO')}
            >
              KOR
            </button>
            <button
              type="button"
              className={lang === 'EN' ? 'active btn-ghost' : 'btn-ghost'}
              onClick={() => setLang('EN')}
            >
              ENG
            </button>
          </div>
          <Link to="/admin" className="btn-secondary">
            {t('관리자', 'Admin')}
          </Link>
          <button type="button" className="btn-ghost" onClick={logout}>
            {t('로그아웃', 'Logout')}
          </button>
        </div>
      </div>

      <StepIndicator
        step={step}
        maxReached={maxReached}
        onJump={goStep}
        t={t}
      />

      {step === 1 && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>
            1. {t('대표 정보 및 비밀번호 설정', 'Representative Info & PIN')}
          </h3>
          <div className="grid-2">
            <div>
              <label className="label-text">
                {t('예약자명 (여권 영문)', 'Holder Name (Passport)')}
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
              <label className="label-text">
                {t(
                  '바우처 수신 이메일 (= 로그인 ID)',
                  'Voucher Email (= Login ID)',
                )}
                <span className="required-star"> *</span>
              </label>
              <input
                className="input-field"
                type="email"
                value={repEmail}
                onChange={(e) => setRepEmail(e.target.value.trim())}
                placeholder="name@example.com"
              />
              <small style={{ color: 'var(--muted)' }}>
                {t(
                  '이 이메일이 바우처 수신 주소이자 예약 조회 로그인 ID입니다.',
                  'This email is both the voucher address and login ID.',
                )}
              </small>
            </div>
            <div>
              <label className="label-text">
                {t('조회용 비밀번호 (4자리)', '4-digit PIN')}
                <span className="required-star"> *</span>
              </label>
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

          <div
            className="sub-card"
            style={{ marginTop: 16, marginBottom: 0, fontSize: 13 }}
          >
            <label className="check-label" style={{ marginTop: 0, fontWeight: 800 }}>
              <input
                type="checkbox"
                checked={
                  !!consents.privacy &&
                  !!consents.marketing &&
                  !!consents.portrait
                }
                onChange={(e) => {
                  const on = e.target.checked;
                  setConsents({
                    privacy: on,
                    marketing: on,
                    portrait: on,
                  });
                }}
              />
              {t('모두 동의합니다', 'I agree to all')}
              <span className="required-star"> *</span>
            </label>
            <ul
              style={{
                margin: '10px 0 0',
                paddingLeft: 22,
                color: '#6b7684',
                lineHeight: 1.55,
              }}
            >
              <li>
                {t(
                  '(필수) 개인정보 수집·이용에 동의합니다.',
                  '(Required) I agree to the collection and use of personal information.',
                )}
              </li>
              <li>
                {t(
                  '마케팅 정보 수신에 동의합니다.',
                  'I agree to receive marketing information.',
                )}
              </li>
              <li>
                {t(
                  '사진·영상 등 초상권 활용에 동의합니다.',
                  'I agree to the use of my likeness in photos/videos.',
                )}
              </li>
            </ul>
            <div
              style={{
                marginTop: 10,
                color: '#f04452',
                fontWeight: 700,
                fontSize: 12,
                lineHeight: 1.45,
              }}
            >
              {t(
                '미동의시 서비스 사항에 제한이 있을 수 있습니다. 현장에서 동의 하지 않음을 메니저에게 요청 하세요',
                'Service may be limited if you do not agree. Please ask the manager on-site if you do not consent.',
              )}
            </div>
          </div>
        </div>
      )}

      {step === 2 && (
        <RoomsDiversForm
          t={t}
          lang={lang}
          repName={repName}
          roomsData={roomsData}
          setRoomsData={setRoomsData}
          roomTypes={settings.roomTypesConfig}
          trainingTypes={settings.trainingTypesConfig}
          optionPrices={settings.optionPricesConfig}
          optionsCatalog={settings.optionsCatalogConfig}
          safetyInstructors={(settings.safetyInstructorsConfig || []).map(
            (s) => s.name || s,
          )}
          processed={processed}
        />
      )}

      {step === 3 && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>
            3. {t('취소 규정 및 서명', 'Policy & Signature')}
          </h3>
          <div className="sub-card" style={{ fontSize: 13, lineHeight: 1.55 }}>
            <strong>
              {t('취소 및 환불 규정', 'Cancellation & Refund Policy')}
            </strong>
            <p>
              {t(
                '예약 완료 시점 기준 24시간 이내 취소 시 패널티 없이 100% 무료 취소가 가능합니다.',
                'Cancellations within 24 hours of booking incur no penalty.',
              )}
            </p>
            <p>
              {t(
                '체크인 8일 전까지: 무료 취소 가능',
                'Up to 8 days before check-in: free cancellation available',
              )}
            </p>
            <p>
              {t(
                '7일 전부터: 룸에 대한 금액 환불·취소 불가',
                'From 7 days before check-in: room charges are non-refundable / non-cancellable',
              )}
            </p>
            <p>
              {t(
                '다이빙 당일 취소: 취소 불가 (100% 차감 적용)',
                'Same-day diving cancellation: not allowed (100% charged)',
              )}
            </p>
            <label
              className="check-label"
              style={{
                marginTop: 12,
                marginBottom: 0,
                padding: '10px 12px',
                borderRadius: 10,
                border: agreed
                  ? '1.5px solid #0ca678'
                  : '1.5px solid var(--line)',
                background: agreed ? '#e6fcf5' : '#fff',
              }}
            >
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
              />
              {t(
                '위 취소 및 환불 규정에 동의합니다.',
                'I agree to the cancellation and refund policy above.',
              )}
              <span className="required-star"> *</span>
            </label>
          </div>

          <GuestBillingSummary
            t={t}
            lang={lang}
            processed={processed}
            roomsData={roomsData}
            setRoomsData={setRoomsData}
            settings={settings}
            escortCode={escortCode}
            setEscortCode={setEscortCode}
          />

          <div className="label-text">{t('전자 서명', 'Signature')}</div>
          <canvas
            ref={canvasRef}
            width={640}
            height={220}
            style={{
              width: '100%',
              height: 180,
              border: '1.5px solid var(--line)',
              borderRadius: 12,
              background: '#fff',
              touchAction: 'none',
            }}
            onMouseDown={startDraw}
            onMouseMove={moveDraw}
            onMouseUp={endDraw}
            onMouseLeave={endDraw}
            onTouchStart={startDraw}
            onTouchMove={moveDraw}
            onTouchEnd={endDraw}
          />
          <button
            type="button"
            className="btn-secondary"
            style={{ marginTop: 8 }}
            onClick={clearCanvas}
          >
            {t('서명 지우기', 'Clear Signature')}
          </button>
        </div>
      )}

      <StickyActionBar
        hideLeft={step === 1}
        leftLabel={t('이전', 'Back')}
        onLeft={() => goStep(Math.max(1, step - 1))}
        rightLabel={
          step === 1
            ? t('다음 단계로 이동 (객실/다이버 입력) →', 'Next Step →')
            : step === 2
              ? t('다음 단계로 이동 (약관 동의 및 전자 서명) →', 'Next Step →')
              : t('예약 제출', 'Submit Booking')
        }
        onRight={() => {
          if (step === 1) {
            if (validateStep1()) goStep(2);
            return;
          }
          if (step === 2) {
            if (validateStep2()) goStep(3);
            return;
          }
          submit();
        }}
      />

      <footer className="site-brand-footer">
        <BrandLockup variant="footer" showTagline={false} />
      </footer>
    </div>
  );
}
