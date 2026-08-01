import { useEffect, useMemo, useState } from 'react';

export default function RollingBanner({ ads = [], intervalMs = 4000 }) {
  const slides = useMemo(
    () =>
      (ads || [])
        .filter((a) => a && a.isActive !== false && (a.imageUrl || a.title))
        .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0)),
    [ads],
  );
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [slides.length]);

  useEffect(() => {
    if (slides.length <= 1) return undefined;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % slides.length);
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [slides.length, intervalMs]);

  if (!slides.length) return null;
  const slide = slides[index];

  const inner = (
    <div className="rolling-banner-slide">
      {slide.imageUrl ? (
        <img src={slide.imageUrl} alt={slide.title || 'ad'} />
      ) : (
        <div className="rolling-banner-fallback">{slide.title}</div>
      )}
      {slide.title ? <div className="rolling-banner-caption">{slide.title}</div> : null}
    </div>
  );

  return (
    <div className="rolling-banner" aria-label="advertisement">
      {slide.linkUrl ? (
        <a href={slide.linkUrl} target="_blank" rel="noreferrer">
          {inner}
        </a>
      ) : (
        inner
      )}
      {slides.length > 1 && (
        <div className="rolling-banner-dots">
          {slides.map((s, i) => (
            <button
              key={s.id || i}
              type="button"
              className={i === index ? 'active' : ''}
              aria-label={`slide ${i + 1}`}
              onClick={() => setIndex(i)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
