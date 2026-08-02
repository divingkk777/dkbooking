import emailjs from '@emailjs/browser';
import { useEffect, useMemo, useState } from 'react';
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
        return (
          <div key={label} className="dash-bar-row">
            <div className="dash-bar-label">{label}</div>
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

export default function DashboardTab({ t, lang = 'KO', reservations }) {
  const toast = useToast();
  const today = toLocalISODate();
  const [fromDate, setFromDate] = useState(() => shiftDays(today, -30));
  const [toDate, setToDate] = useState(today);
  const [subTab, setSubTab] = useState('overview');
  const [searchQ, setSearchQ] = useState('');
  const [selected, setSelected] = useState(() => new Set());
  const [promoSubject, setPromoSubject] = useState('');
  const [promoBody, setPromoBody] = useState('');
  const [sending, setSending] = useState(false);

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
      title: t('총 방문 일자 (투숙 숙박 수)', 'Stay Nights'),
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
      title: t('총 트레이닝 진행 횟수', 'Training Sessions'),
      value: `${stats.totalSessions}${t('회', '')}`,
      color: '#e64980',
      icon: '🏊',
    },
    {
      title: t('1인당 평균 트레이닝 횟수', 'Avg Sessions / Person'),
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
    { id: 'yearly', ko: '연간 차트', en: 'Yearly' },
    { id: 'monthly', ko: '월간 차트', en: 'Monthly' },
    { id: 'promo', ko: '프로모션 메일', en: 'Promo Mail' },
  ];

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
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="date"
              className="input-field"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              style={{ width: 150 }}
            />
            <span>~</span>
            <input
              type="date"
              className="input-field"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              style={{ width: 150 }}
            />
          </div>
        </div>
        <button
          type="button"
          className="btn-primary"
          style={{ background: '#0ca678' }}
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
  );
}
