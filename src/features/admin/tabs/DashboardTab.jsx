import emailjs from '@emailjs/browser';
import html2canvas from 'html2canvas';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  computeDashboardStats,
  downloadReservationsCsv,
} from '../../../domain/analytics';
import { toLocalISODate } from '../../../domain/dateUtils';
import { formatMoney, formatPricePair } from '../../../domain/pricing';
import { addAdminLog } from '../../../data/logsRepo';
import { useToast } from '../../../ui/ToastContext';

const won = (n) => `₩${formatMoney(n)}`;
const usd = (n) => `$${formatMoney(n)}`;

function shiftDays(iso, delta) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + delta);
  return toLocalISODate(d);
}

function monthsAgo(iso, months) {
  const d = new Date(`${iso}T12:00:00`);
  d.setMonth(d.getMonth() - Number(months));
  return toLocalISODate(d);
}

function quarterRange(year, quarter) {
  const q = Number(quarter);
  const starts = ['01-01', '04-01', '07-01', '10-01'];
  const ends = ['03-31', '06-30', '09-30', '12-31'];
  const i = Math.min(4, Math.max(1, q)) - 1;
  return {
    from: `${year}-${starts[i]}`,
    to: `${year}-${ends[i]}`,
  };
}

function yearRange(year) {
  const y = String(year);
  return { from: `${y}-01-01`, to: `${y}-12-31` };
}

/** Earliest/latest guest startDate across reservations (data-existing span). */
function dataDateSpan(reservations) {
  let min = '';
  let max = '';
  (reservations || []).forEach((res) => {
    (res.roomsData || []).forEach((room) => {
      (room.guests || []).forEach((g) => {
        const s = g?.startDate || '';
        if (!/^\d{4}-\d{2}-\d{2}/.test(s)) return;
        if (!min || s < min) min = s;
        if (!max || s > max) max = s;
      });
    });
  });
  return { min, max };
}

function yearsWithData(reservations) {
  const years = new Set();
  (reservations || []).forEach((res) => {
    (res.roomsData || []).forEach((room) => {
      (room.guests || []).forEach((g) => {
        const s = g?.startDate || '';
        if (/^\d{4}-/.test(s)) years.add(s.slice(0, 4));
      });
    });
  });
  const cur = String(new Date().getFullYear());
  years.add(cur);
  return [...years].sort((a, b) => Number(b) - Number(a));
}

function ScoreCard({ title, value, color, icon }) {
  return (
    <div className="dash-score-card" style={{ borderTopColor: color }}>
      <div className="dash-score-icon" style={{ background: `${color}18`, color }}>
        {icon}
      </div>
      <div className="dash-score-label">{title}</div>
      <div className="dash-score-value" style={{ color }}>
        {value}
      </div>
    </div>
  );
}

function BarList({ rows, lang, t, valueKey = 'krw' }) {
  const max = Math.max(1, ...rows.map(([, v]) => Number(v[valueKey]) || 0));
  if (!rows.length) {
    return (
      <div style={{ color: 'var(--muted)', padding: 24, textAlign: 'center' }}>
        {t('해당 기간 데이터가 없습니다.', 'No data for this period.')}
      </div>
    );
  }
  return (
    <div className="dash-bar-list">
      {rows.map(([label, v]) => {
        const val = Number(v[valueKey]) || 0;
        const pct = Math.round((val / max) * 100);
        const displayLabel =
          lang === 'EN' && v.nameEN ? v.nameEN : label;
        return (
          <div key={v.id || label} className="dash-bar-row">
            <div className="dash-bar-label">
              {displayLabel}
              {v.qty > 0 ? (
                <span style={{ color: '#8b95a1', fontWeight: 600 }}>
                  {' '}
                  · {v.qty}
                  {t('건', 'x')}
                </span>
              ) : null}
            </div>
            <div className="dash-bar-track">
              <div
                className="dash-bar-fill"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="dash-bar-val">
              {valueKey === 'pax'
                ? `${v.pax}${t('명', '')}`
                : formatPricePair(lang, v.krw, v.usd)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CategoryRevenueBlock({ title, bucket, lang, t, color }) {
  return (
    <div className="sub-card" style={{ marginTop: 0, borderTop: `3px solid ${color}` }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
          alignItems: 'baseline',
          marginBottom: 10,
        }}
      >
        <strong style={{ color }}>{title}</strong>
        <span style={{ fontWeight: 900, fontSize: 15 }}>
          {formatPricePair(lang, bucket?.totalKRW, bucket?.totalUSD)}
        </span>
      </div>
      <BarList rows={bucket?.rows || []} lang={lang} t={t} />
    </div>
  );
}

export default function DashboardTab({ t, lang = 'KO', reservations }) {
  const toast = useToast();
  const captureRef = useRef(null);
  const today = toLocalISODate();
  const [fromDate, setFromDate] = useState(() => shiftDays(today, -30));
  const [toDate, setToDate] = useState(today);
  const [monthPreset, setMonthPreset] = useState('');
  const [quarterPreset, setQuarterPreset] = useState('');
  const [yearPreset, setYearPreset] = useState('');
  const [allTimePreset, setAllTimePreset] = useState(false);
  const [subTab, setSubTab] = useState('overview');
  const [searchQ, setSearchQ] = useState('');
  const [selected, setSelected] = useState(() => new Set());
  const [promoSubject, setPromoSubject] = useState('');
  const [promoBody, setPromoBody] = useState('');
  const [sending, setSending] = useState(false);
  const [captureBusy, setCaptureBusy] = useState(false);
  const [capturePreview, setCapturePreview] = useState(null);

  const clearPresets = () => {
    setMonthPreset('');
    setQuarterPreset('');
    setYearPreset('');
    setAllTimePreset(false);
  };

  const availableYears = useMemo(
    () => yearsWithData(reservations),
    [reservations],
  );

  const applyAllTime = () => {
    const span = dataDateSpan(reservations);
    clearPresets();
    setAllTimePreset(true);
    if (span.min && span.max) {
      setFromDate(span.min);
      setToDate(span.max);
    } else {
      const end = toLocalISODate();
      setFromDate(monthsAgo(end, 12));
      setToDate(end);
      toast.warn(
        t(
          '데이터가 없어 기본 기간(최근 1년)을 표시합니다.',
          'No data found — showing last 1 year by default.',
        ),
      );
    }
  };

  const applyRecentMonths = (months) => {
    if (months === 'all') {
      applyAllTime();
      return;
    }
    const n = Number(months);
    if (!n) {
      setMonthPreset('');
      return;
    }
    const end = toLocalISODate();
    clearPresets();
    setMonthPreset(String(n));
    setToDate(end);
    setFromDate(monthsAgo(end, n));
  };

  const applyQuarter = (quarter) => {
    const q = Number(quarter);
    if (!q) {
      setQuarterPreset('');
      return;
    }
    const year = Number(yearPreset || String(toLocalISODate()).slice(0, 4));
    const range = quarterRange(year, q);
    clearPresets();
    setQuarterPreset(String(q));
    setYearPreset(String(year));
    setFromDate(range.from);
    setToDate(range.to);
  };

  const applyYear = (year) => {
    if (!year) {
      setYearPreset('');
      return;
    }
    const range = yearRange(year);
    clearPresets();
    setYearPreset(String(year));
    setFromDate(range.from);
    setToDate(range.to);
  };

  const captureDashboard = async () => {
    if (!captureRef.current) return;
    setCaptureBusy(true);
    try {
      await new Promise((r) => setTimeout(r, 40));
      const canvas = await html2canvas(captureRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
      });
      setCapturePreview({
        dataUrl: canvas.toDataURL('image/png'),
        fileName: `Stats_${fromDate}_${toDate}.png`,
      });
    } catch (err) {
      toast.error(err?.message || t('캡처 실패', 'Capture failed'));
    } finally {
      setCaptureBusy(false);
    }
  };

  const saveCapturePreview = async () => {
    if (!capturePreview?.dataUrl) return;
    const fileName = capturePreview.fileName || 'Stats.png';
    try {
      const blob = await (await fetch(capturePreview.dataUrl)).blob();
      if (typeof window.showSaveFilePicker === 'function') {
        try {
          const handle = await window.showSaveFilePicker({
            suggestedName: fileName,
            types: [
              {
                description: 'PNG Image',
                accept: { 'image/png': ['.png'] },
              },
            ],
          });
          const writable = await handle.createWritable();
          await writable.write(blob);
          await writable.close();
          toast.success(t('이미지를 저장했습니다.', 'Image saved.'));
          return;
        } catch (err) {
          if (err?.name === 'AbortError') return;
        }
      }
      const a = document.createElement('a');
      a.download = fileName;
      a.href = capturePreview.dataUrl;
      a.click();
      toast.success(
        t(
          '저장을 시작했습니다. 저장 위치를 선택해 주세요.',
          'Save started — choose the download location if prompted.',
        ),
      );
    } catch (err) {
      toast.error(err?.message || t('저장 실패', 'Save failed'));
    }
  };

  useEffect(() => {
    const key = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;
    if (key) emailjs.init(key);
  }, []);

  const stats = useMemo(
    () => computeDashboardStats(reservations, fromDate, toDate),
    [reservations, fromDate, toDate],
  );

  const bookers = useMemo(() => {
    const map = new Map();
    (stats.rows || []).forEach((r) => {
      const email = String(r.repEmail || '').trim().toLowerCase();
      if (!email) return;
      if (!map.has(email)) {
        map.set(email, {
          email: r.repEmail,
          repName: r.repName || '',
          bookingInstructor: r.bookingInstructor || '',
          marketing: !!r.consents?.marketing,
          portrait: !!r.consents?.portrait,
          privacy: !!r.consents?.privacy,
          resIds: new Set([r.resId]),
        });
      } else {
        map.get(email).resIds.add(r.resId);
      }
    });
    const q = searchQ.trim().toLowerCase();
    return [...map.values()]
      .filter((b) => {
        if (!q) return true;
        return (
          b.email.toLowerCase().includes(q) ||
          b.repName.toLowerCase().includes(q) ||
          b.bookingInstructor.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => a.repName.localeCompare(b.repName));
  }, [stats.rows, searchQ]);

  const toggleSelect = (email) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });
  };

  const selectMarketingOnly = () => {
    setSelected(
      new Set(bookers.filter((b) => b.marketing).map((b) => b.email.toLowerCase())),
    );
  };

  const sendPromo = async () => {
    const targets = bookers.filter((b) =>
      selected.has(b.email.toLowerCase()),
    );
    if (!targets.length) {
      toast.warn(t('수신자를 선택하세요.', 'Select recipients.'));
      return;
    }
    const blocked = targets.filter((b) => !b.marketing);
    if (blocked.length) {
      toast.warn(
        t(
          '마케팅 미동의 예약자가 포함되어 있습니다. 동의자만 선택하세요.',
          'Some selected bookers did not consent to marketing.',
        ),
      );
      return;
    }
    if (!promoSubject.trim() || !promoBody.trim()) {
      toast.warn(
        t('제목과 본문을 입력하세요.', 'Enter subject and message body.'),
      );
      return;
    }
    if (
      !window.confirm(
        t(
          `${targets.length}명에게 프로모션 메일을 발송할까요?`,
          `Send promo email to ${targets.length} recipients?`,
        ),
      )
    ) {
      return;
    }
    setSending(true);
    const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID;
    const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
    let ok = 0;
    let fail = 0;
    try {
      for (const b of targets) {
        try {
          await emailjs.send(serviceId, templateId, {
            to_email: b.email,
            to_name: b.repName || b.bookingInstructor || 'Guest',
            subject: promoSubject.trim(),
            message: `${promoSubject.trim()}\n\n${promoBody.trim()}`,
            invoice_details: promoBody.trim(),
          });
          ok += 1;
        } catch {
          fail += 1;
        }
      }
      await addAdminLog({
        type: 'EDIT',
        message: `[프로모션 메일] ${ok}건 발송 (실패 ${fail}) — ${promoSubject.trim()}`,
      });
      if (ok) {
        toast.success(
          t(
            `프로모션 메일 ${ok}건 발송 완료`,
            `Promo email sent: ${ok}`,
          ),
        );
      }
      if (fail) {
        toast.error(
          t(`발송 실패 ${fail}건`, `${fail} sends failed`),
        );
      }
    } finally {
      setSending(false);
    }
  };

  const cards = [
    {
      title: t('기간별 매출 총액 (원화)', 'Period Sales (KRW)'),
      value: won(stats.totalSalesKRW),
      color: '#3182f6',
      icon: '₩',
    },
    {
      title: t('기간별 매출 총액 (달러 기준)', 'Period Sales (USD)'),
      value: usd(stats.totalSalesUSD),
      color: '#3182f6',
      icon: '$',
    },
    {
      title: t('방문자 숫자 (다이버 수)', 'Visitors (Divers)'),
      value: `${stats.totalDivers}${t('명', '')}`,
      color: '#0ca678',
      icon: '👤',
    },
    {
      title: t('총 숙박 박수 (일정 기준)', 'Stay Nights (from dates)'),
      value: `${stats.totalStayNights}${t('박', '')}`,
      color: '#f59f00',
      icon: '🌙',
    },
    {
      title: t('1인당 평균 단가 (ARPU)', 'ARPU'),
      value: won(stats.avgArpuKRW),
      color: '#7048e8',
      icon: '◎',
    },
    {
      title: t('총 실제 트레이닝 횟수', 'Actual Training Sessions'),
      value: `${stats.totalSessions}${t('회', '')}`,
      color: '#e64980',
      icon: '🏊',
    },
    {
      title: t('1인당 평균 실제 트레이닝', 'Avg Actual Training / Person'),
      value: `${stats.avgSessions}${t('회', '')}`,
      color: '#0ca678',
      icon: '∑',
    },
    {
      title: t('다이버 평균 목표 수심', 'Avg Target Depth'),
      value: `${stats.avgDepth}m`,
      color: '#f59f00',
      icon: '↓',
    },
  ];

  const subTabs = [
    { id: 'overview', ko: '종합 요약', en: 'Overview' },
    { id: 'revenue', ko: '매출 분류', en: 'Revenue' },
    { id: 'yearly', ko: '연간 차트', en: 'Yearly' },
    { id: 'monthly', ko: '월간 차트', en: 'Monthly' },
    { id: 'promo', ko: '프로모션 메일', en: 'Promo Mail' },
  ];

  const cats = stats.categories || {};

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>{t('통계', 'Statistics')}</h3>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
          alignItems: 'flex-end',
          marginBottom: 16,
        }}
      >
        <div>
          <div className="label-text">{t('조회 기간 설정', 'Date Range')}</div>
          <div
            style={{
              display: 'flex',
              gap: 8,
              alignItems: 'center',
              flexWrap: 'wrap',
            }}
          >
            <input
              type="date"
              className="input-field"
              value={fromDate}
              onChange={(e) => {
                clearPresets();
                setFromDate(e.target.value);
              }}
              style={{ width: 150 }}
            />
            <span>~</span>
            <input
              type="date"
              className="input-field"
              value={toDate}
              onChange={(e) => {
                clearPresets();
                setToDate(e.target.value);
              }}
              style={{ width: 150 }}
            />
            <select
              className="input-field"
              value={allTimePreset ? 'all' : monthPreset}
              onChange={(e) => applyRecentMonths(e.target.value)}
              style={{ width: 160 }}
              aria-label={t('최근 개월 / 전체', 'Recent months / All')}
            >
              <option value="">
                {t('최근 1-6개월', 'Recent 1–6 months')}
              </option>
              <option value="all">
                {t('전체 (데이터 전 기간)', 'All (full data range)')}
              </option>
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>
                  {t(`최근 ${n}개월`, `Last ${n} month(s)`)}
                </option>
              ))}
            </select>
            <select
              className="input-field"
              value={yearPreset}
              onChange={(e) => applyYear(e.target.value)}
              style={{ width: 130 }}
              aria-label={t('연도', 'Year')}
            >
              <option value="">{t('연도(1년)', 'Year (1yr)')}</option>
              {availableYears.map((y) => (
                <option key={y} value={y}>
                  {t(`${y}년`, `${y}`)}
                </option>
              ))}
            </select>
            <select
              className="input-field"
              value={quarterPreset}
              onChange={(e) => applyQuarter(e.target.value)}
              style={{ width: 150 }}
              aria-label={t('분기', 'Quarter')}
            >
              <option value="">{t('1-4분기', 'Q1–Q4')}</option>
              {[1, 2, 3, 4].map((q) => {
                const y = yearPreset || String(new Date().getFullYear());
                return (
                  <option key={q} value={q}>
                    {t(`${y}년 ${q}분기`, `${y} Q${q}`)}
                  </option>
                );
              })}
            </select>
          </div>
        </div>
        <button
          type="button"
          className="btn-primary"
          style={{ background: '#0ca678', width: 'auto' }}
          onClick={() =>
            downloadReservationsCsv(
              stats.rows,
              t,
              `Reservations_${fromDate}_${toDate}.csv`,
            )
          }
        >
          📥 {t('엑셀/CSV 데이터 다운로드', 'Download Excel/CSV')}
        </button>
        <button
          type="button"
          className="btn-secondary"
          style={{ width: 'auto' }}
          disabled={captureBusy}
          onClick={captureDashboard}
        >
          {captureBusy
            ? t('캡처 중…', 'Capturing…')
            : t('📷 화면 캡처', 'Capture screen')}
        </button>
      </div>

      <div ref={captureRef} className="dash-capture-root">
        <div
          style={{
            fontSize: 12,
            color: '#6b7684',
            fontWeight: 700,
            marginBottom: 10,
          }}
        >
          {t('조회 기간', 'Period')}: {fromDate} ~ {toDate}
          {allTimePreset
            ? ` · ${t('전체', 'All')}`
            : yearPreset
              ? ` · ${t(`${yearPreset}년`, yearPreset)}`
              : ''}{' '}
          ·{' '}
          {t(
            subTabs.find((s) => s.id === subTab)?.ko || '',
            subTabs.find((s) => s.id === subTab)?.en || '',
          )}
        </div>

      <div className="dash-subtabs">
        {subTabs.map((s) => (
          <button
            key={s.id}
            type="button"
            className={subTab === s.id ? 'dash-subtab active' : 'dash-subtab'}
            onClick={() => setSubTab(s.id)}
          >
            {t(s.ko, s.en)}
          </button>
        ))}
      </div>

      {subTab === 'overview' && (
        <div className="dash-grid">
          {cards.map((c) => (
            <ScoreCard key={c.title} {...c} />
          ))}
        </div>
      )}

      {subTab === 'revenue' && (
        <div style={{ display: 'grid', gap: 14, marginTop: 12 }}>
          <div
            className="sub-card"
            style={{
              margin: 0,
              display: 'flex',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 10,
              alignItems: 'center',
              background: '#f1f3f5',
            }}
          >
            <div>
              <div style={{ fontWeight: 900, fontSize: 16 }}>
                {t('카테고리 매출 총합', 'Category revenue total')}
              </div>
              <div style={{ fontSize: 12, color: '#6b7684', marginTop: 4 }}>
                {t(
                  '기간 내 객실·트레이닝·옵션·프로모·패널티 항목 합계입니다.',
                  'Sum of room, training, options, promo, and penalty in range.',
                )}
              </div>
            </div>
            <div style={{ fontWeight: 900, fontSize: 18, color: '#3182f6' }}>
              {formatPricePair(
                lang,
                stats.categoryTotalKRW,
                stats.categoryTotalUSD,
              )}
            </div>
          </div>

          <div className="dash-grid">
            <ScoreCard
              title={t('객실 매출 통합', 'Room sales total')}
              value={formatPricePair(
                lang,
                cats.room?.totalKRW,
                cats.room?.totalUSD,
              )}
              color="#f59f00"
              icon="🏨"
            />
            <ScoreCard
              title={t('트레이닝 매출 통합', 'Training sales total')}
              value={formatPricePair(
                lang,
                cats.training?.totalKRW,
                cats.training?.totalUSD,
              )}
              color="#e64980"
              icon="🏊"
            />
            <ScoreCard
              title={t('옵션 매출 통합', 'Options sales total')}
              value={formatPricePair(
                lang,
                cats.option?.totalKRW,
                cats.option?.totalUSD,
              )}
              color="#7048e8"
              icon="🧩"
            />
            <ScoreCard
              title={t('프로모/패널티', 'Promo / Penalty')}
              value={formatPricePair(
                lang,
                (cats.promo?.totalKRW || 0) + (cats.penalty?.totalKRW || 0),
                (cats.promo?.totalUSD || 0) + (cats.penalty?.totalUSD || 0),
              )}
              color="#f04452"
              icon="±"
            />
          </div>

          <CategoryRevenueBlock
            title={t('룸 매출 · 항목별', 'Room sales by item')}
            bucket={cats.room}
            lang={lang}
            t={t}
            color="#f59f00"
          />
          <CategoryRevenueBlock
            title={t('트레이닝 별 매출', 'Training sales by type')}
            bucket={cats.training}
            lang={lang}
            t={t}
            color="#e64980"
          />
          <CategoryRevenueBlock
            title={t('옵션 별 매출', 'Option sales by type')}
            bucket={cats.option}
            lang={lang}
            t={t}
            color="#7048e8"
          />
          {(cats.promo?.rows?.length || 0) > 0 ? (
            <CategoryRevenueBlock
              title={t('프로모/할인 항목', 'Promo / discount items')}
              bucket={cats.promo}
              lang={lang}
              t={t}
              color="#7950f2"
            />
          ) : null}
          {(cats.penalty?.rows?.length || 0) > 0 ? (
            <CategoryRevenueBlock
              title={t('패널티 항목', 'Penalty items')}
              bucket={cats.penalty}
              lang={lang}
              t={t}
              color="#f04452"
            />
          ) : null}
        </div>
      )}

      {subTab === 'yearly' && (
        <div className="sub-card" style={{ marginTop: 12 }}>
          <strong>{t('연간 매출 / 방문자', 'Yearly Sales / Visitors')}</strong>
          <BarList rows={stats.yearlyData} lang={lang} t={t} />
        </div>
      )}

      {subTab === 'monthly' && (
        <div className="sub-card" style={{ marginTop: 12 }}>
          <strong>{t('월간 매출 / 방문자', 'Monthly Sales / Visitors')}</strong>
          <BarList rows={stats.monthlyData} lang={lang} t={t} />
        </div>
      )}

      {subTab === 'promo' && (
        <div className="sub-card" style={{ marginTop: 12 }}>
          <strong>
            {t('예약자 검색 · 프로모션 메일', 'Search Bookers · Promo Email')}
          </strong>
          <p style={{ fontSize: 12, color: '#6b7684', margin: '8px 0 14px' }}>
            {t(
              '마케팅 정보 활용에 동의한 예약자에게만 발송할 수 있습니다.',
              'Only bookers who consented to marketing can receive promo emails.',
            )}
          </p>

          <div className="grid-2" style={{ marginBottom: 12 }}>
            <div>
              <label className="label-text">
                {t('예약자 검색 (이름/이메일)', 'Search (name/email)')}
              </label>
              <input
                className="input-field"
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                placeholder={t('이름 또는 이메일', 'Name or email')}
              />
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={selectMarketingOnly}
              >
                {t('마케팅 동의자 전체 선택', 'Select all marketing-ok')}
              </button>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setSelected(new Set())}
              >
                {t('선택 해제', 'Clear')}
              </button>
            </div>
          </div>

          <div
            style={{
              maxHeight: 260,
              overflow: 'auto',
              border: '1px solid var(--line)',
              borderRadius: 12,
              marginBottom: 14,
            }}
          >
            <table className="data-table" style={{ margin: 0 }}>
              <thead>
                <tr>
                  <th style={{ width: 40 }} />
                  <th>{t('예약자명', 'Holder')}</th>
                  <th>{t('이메일', 'Email')}</th>
                  <th>{t('마케팅', 'Marketing')}</th>
                  <th>{t('초상권', 'Portrait')}</th>
                </tr>
              </thead>
              <tbody>
                {bookers.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', color: '#8b95a1' }}>
                      {t('검색 결과 없음', 'No results')}
                    </td>
                  </tr>
                ) : (
                  bookers.map((b) => {
                    const key = b.email.toLowerCase();
                    return (
                      <tr key={key}>
                        <td>
                          <input
                            type="checkbox"
                            checked={selected.has(key)}
                            disabled={!b.marketing}
                            onChange={() => toggleSelect(key)}
                          />
                        </td>
                        <td>{b.repName || b.bookingInstructor || '-'}</td>
                        <td>{b.email}</td>
                        <td style={{ color: b.marketing ? '#0ca678' : '#f04452' }}>
                          {b.marketing ? t('동의', 'Yes') : t('미동의', 'No')}
                        </td>
                        <td style={{ color: b.portrait ? '#0ca678' : '#8b95a1' }}>
                          {b.portrait ? t('동의', 'Yes') : t('미동의', 'No')}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="grid-2">
            <div>
              <label className="label-text">{t('메일 제목', 'Subject')}</label>
              <input
                className="input-field"
                value={promoSubject}
                onChange={(e) => setPromoSubject(e.target.value)}
              />
            </div>
            <div>
              <label className="label-text">{t('메일 본문', 'Body')}</label>
              <textarea
                className="input-field"
                rows={4}
                value={promoBody}
                onChange={(e) => setPromoBody(e.target.value)}
              />
            </div>
          </div>
          <button
            type="button"
            className="btn-primary"
            style={{ marginTop: 12 }}
            disabled={sending}
            onClick={sendPromo}
          >
            {sending
              ? t('발송 중…', 'Sending…')
              : t(
                  `선택 ${selected.size}명에게 프로모션 메일 발송`,
                  `Send promo to ${selected.size} selected`,
                )}
          </button>
        </div>
      )}
      </div>

      {capturePreview ? (
        <div
          className="modal-backdrop"
          onClick={() => setCapturePreview(null)}
          role="presentation"
        >
          <div
            className="modal-sheet"
            style={{ width: 'min(900px, 100%)' }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 10,
                marginBottom: 12,
              }}
            >
              <h3 style={{ margin: 0 }}>
                {t('통계 화면 캡처', 'Stats screen capture')}
              </h3>
              <button
                type="button"
                className="btn-secondary"
                style={{ width: 'auto' }}
                onClick={() => setCapturePreview(null)}
              >
                {t('닫기', 'Close')}
              </button>
            </div>
            <div
              style={{
                maxHeight: '65vh',
                overflow: 'auto',
                border: '1.5px solid var(--line)',
                borderRadius: 12,
                background: '#f8fafc',
              }}
            >
              <img
                src={capturePreview.dataUrl}
                alt={t('통계 캡처 미리보기', 'Stats capture preview')}
                style={{ display: 'block', width: '100%', height: 'auto' }}
              />
            </div>
            <button
              type="button"
              className="btn-primary"
              style={{ width: '100%', marginTop: 14 }}
              onClick={saveCapturePreview}
            >
              {t('저장하기', 'Save')}
            </button>
            <p
              style={{
                margin: '8px 0 0',
                fontSize: 12,
                color: '#8b95a1',
                textAlign: 'center',
              }}
            >
              {capturePreview.fileName}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
