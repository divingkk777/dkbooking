/** Shared IDA × DOUBLE K brand lockup for header / footer / quotes. */

/** Cache-bust so browsers pick up regenerated transparent PNGs. */
const ASSET_V = '20260802a';

export const BRAND_ASSETS = {
  ida: `/brand/ida.png?v=${ASSET_V}`,
  doubleK: `/brand/logo-horizontal-black.png?v=${ASSET_V}`,
  doubleKVertical: `/brand/logo-vertical-black.png?v=${ASSET_V}`,
  kakaoId: 'freedivingkk',
  /** Opens KakaoTalk app to add friend by ID */
  kakaoAppHref: 'kakaotalk://addfriend?id=freedivingkk',
  whatsappName: 'Angelic',
  whatsappDisplay: '+63 998 917 1548',
  whatsappNumber: '639989171548',
};

export function whatsappHref(lang = 'KO') {
  const isEN = String(lang || '').toUpperCase() === 'EN';
  const text = isEN
    ? 'Hello Angelic, I have a question about my IDA x DOUBLE K freediving booking.'
    : '안녕하세요 Angelic님, IDA x DOUBLE K 프리다이빙 예약 문의드립니다.';
  return `https://wa.me/${BRAND_ASSETS.whatsappNumber}?text=${encodeURIComponent(text)}`;
}

export function openKakaoTalk() {
  const href = BRAND_ASSETS.kakaoAppHref;
  // Try native app scheme; if it fails silently, user can still copy ID.
  window.location.href = href;
}

/**
 * @param {'header'|'footer'|'quote'} variant
 */
export default function BrandLockup({
  variant = 'header',
  showTagline = true,
  className = '',
}) {
  const isFooter = variant === 'footer';
  return (
    <div
      className={`brand-lockup brand-lockup-${variant} ${className}`.trim()}
    >
      <img
        className="brand-logo brand-logo-ida"
        src={BRAND_ASSETS.ida}
        alt="IDA International Diving Association"
        crossOrigin="anonymous"
      />
      <span className="brand-lockup-x" aria-hidden>
        ×
      </span>
      <img
        className="brand-logo brand-logo-dk"
        src={BRAND_ASSETS.doubleK}
        alt="DOUBLE K Premium Diving Gear"
        crossOrigin="anonymous"
      />
      {showTagline && isFooter ? (
        <div className="brand-lockup-tag">IDA CEBU × DOUBLE K FREEDIVING</div>
      ) : null}
    </div>
  );
}
