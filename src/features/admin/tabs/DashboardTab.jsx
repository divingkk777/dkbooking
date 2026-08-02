import { useMemo } from 'react';
import { formatPricePair } from '../../../domain/pricing';

export default function DashboardTab({ t, lang = 'KO', reservations }) {
  const stats = useMemo(() => {
    let guests = 0;
    let newGuests = 0;
    let cancelled = 0;
    let totalKRW = 0;
    let totalUSD = 0;
    (reservations || []).forEach((res) => {
      totalKRW += Number(res.grandTotalKRW) || 0;
      totalUSD += Number(res.grandTotalUSD) || 0;
      (res.roomsData || []).forEach((room) => {
        (room.guests || []).forEach((g) => {
          guests += 1;
          if (g.isNew) newGuests += 1;
          if (g.cancelStatus === '취소' || g.cancelStatus === '취소완료') {
            cancelled += 1;
          }
        });
      });
    });
    return {
      groups: (reservations || []).length,
      guests,
      newGuests,
      cancelled,
      totalKRW,
      totalUSD,
    };
  }, [reservations]);

  const cards = [
    { label: t('예약 그룹', 'Groups'), value: stats.groups },
    { label: t('다이버 수', 'Divers'), value: stats.guests },
    { label: t('신규 미확인', 'New unchecked'), value: stats.newGuests },
    { label: t('취소 건', 'Cancelled'), value: stats.cancelled },
    {
      label: t('합계', 'Total'),
      value: formatPricePair(lang, stats.totalKRW, stats.totalUSD),
    },
  ];

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>{t('현황 대시보드', 'Dashboard')}</h3>
      <div className="grid-2">
        {cards.map((c) => (
          <div key={c.label} className="sub-card">
            <div style={{ color: 'var(--muted)', fontSize: 13 }}>{c.label}</div>
            <div style={{ fontSize: 24, fontWeight: 900, marginTop: 6 }}>
              {c.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
