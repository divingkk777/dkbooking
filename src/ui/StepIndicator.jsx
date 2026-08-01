export default function StepIndicator({ step, maxReached, onJump, t }) {
  const items = [
    { n: 1, label: t('기본 정보', 'Info') },
    { n: 2, label: t('객실/다이버', 'Rooms/Divers') },
    { n: 3, label: t('서명/완료', 'Signature') },
  ];

  return (
    <div className="step-indicator">
      {items.map((item) => {
        const active = step === item.n;
        const done = maxReached >= item.n && !active;
        return (
          <button
            key={item.n}
            type="button"
            className={active ? 'active' : done ? 'done' : ''}
            onClick={() => {
              if (item.n <= maxReached) onJump?.(item.n);
            }}
          >
            {item.n}. {item.label}
          </button>
        );
      })}
    </div>
  );
}
