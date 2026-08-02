import BrandLockup, {
  BRAND_ASSETS,
  openKakaoTalk,
  openWhatsApp,
  whatsappHref,
} from '../../components/BrandLockup';

export const QUOTE_BRAND = {
  titleKO: '견적서',
  titleEN: 'Quotation',
  centerKO: 'IDA × DOUBLE K FREEDIVING CENTER',
  kakaoId: BRAND_ASSETS.kakaoId,
  whatsappName: BRAND_ASSETS.whatsappName,
  whatsappDisplay: BRAND_ASSETS.whatsappDisplay,
};

export function OfficialQuoteHeader({
  t,
  lang = 'KO',
  subtitle,
  titleKO,
  titleEN,
}) {
  const isEN = String(lang || '').toUpperCase() === 'EN';
  return (
    <div className="quote-official-header">
      <BrandLockup variant="footer" showTagline={false} />
      <div className="quote-official-titles">
        <div className="quote-official-eyebrow">{QUOTE_BRAND.centerKO}</div>
        <h2 className="quote-official-title">
          {t(titleKO || QUOTE_BRAND.titleKO, titleEN || QUOTE_BRAND.titleEN)}
        </h2>
        {subtitle ? (
          <div className="quote-official-subtitle">{subtitle}</div>
        ) : (
          <div className="quote-official-subtitle">
            {isEN
              ? 'Detailed booking quotation'
              : '예약 상세 견적 · 청구 안내'}
          </div>
        )}
      </div>
    </div>
  );
}

export function OfficialQuoteContacts({ t, lang = 'KO' }) {
  const isEN = String(lang || '').toUpperCase() === 'EN';
  const wa = whatsappHref(lang);

  return (
    <div className="quote-official-contacts">
      <div className="quote-official-contacts-title">
        💬 {t('고객 상담', 'Customer Support')}
      </div>
      <div className="quote-official-contacts-grid">
        <a
          className={
            isEN
              ? 'quote-contact-card quote-contact-link'
              : 'quote-contact-card quote-contact-link highlight'
          }
          href={BRAND_ASSETS.kakaoAppHref}
          onClick={(e) => {
            e.preventDefault();
            openKakaoTalk();
          }}
        >
          <div className="quote-contact-label">
            {t('한글 상담 · 카카오톡', 'KakaoTalk (Korean)')}
          </div>
          <div className="quote-contact-value">
            {BRAND_ASSETS.kakaoId}
            <span className="quote-contact-cta">
              {' '}
              · {t('앱 열기', 'Open app')}
            </span>
          </div>
          <div className="quote-contact-hint">
            {t(
              '탭하면 카카오톡 앱이 실행됩니다. (ID: freedivingkk)',
              'Tap to launch KakaoTalk (ID: freedivingkk)',
            )}
          </div>
        </a>

        <a
          className={
            isEN
              ? 'quote-contact-card quote-contact-link highlight'
              : 'quote-contact-card quote-contact-link'
          }
          href={wa}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => {
            e.preventDefault();
            openWhatsApp(lang, 'consult');
          }}
        >
          <div className="quote-contact-label">
            {t('ENG · WhatsApp', 'WhatsApp (English)')}
          </div>
          <div className="quote-contact-value">
            {BRAND_ASSETS.whatsappName} {BRAND_ASSETS.whatsappDisplay}
            <span className="quote-contact-cta">
              {' '}
              · {t('메시지 보내기', 'Send message')}
            </span>
          </div>
          <div className="quote-contact-hint">
            {t(
              '탭하면 WhatsApp이 열리고 문의 메시지가 준비됩니다.',
              'Tap to open WhatsApp with a ready-to-send message.',
            )}
          </div>
        </a>
      </div>

      <div className="quote-official-brand-footer">
        <BrandLockup variant="footer" showTagline={false} />
      </div>
    </div>
  );
}
