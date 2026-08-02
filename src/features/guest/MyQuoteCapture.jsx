import { forwardRef } from 'react';
import { formatPricePair } from '../../domain/pricing';
import {
  OfficialQuoteContacts,
  OfficialQuoteHeader,
} from '../admin/OfficialQuoteSheet';
import { dateSpan, guestSummary } from './myReservationUtils';

/** Quote sheet for guest preview (interactive) and PNG capture. */
const MyQuoteCapture = forwardRef(function MyQuoteCapture(
  {
    t,
    lang,
    res,
    processed,
    withDiscount,
    interactive = false,
    titleKO,
    titleEN,
    subtitle,
  },
  ref,
) {
  const guests = [];
  (processed?.processedRooms || []).forEach((room) => {
    (room.guests || []).forEach((g) => guests.push(g));
  });
  const rawGuests = guestSummary(res);

  return (
    <div
      ref={ref}
      className="quote-official-sheet"
      style={
        interactive
          ? {
              position: 'relative',
              left: 'auto',
              top: 'auto',
              width: '100%',
              maxWidth: 720,
              margin: '0 auto',
              background: '#fff',
              zIndex: 1,
            }
          : {
              position: 'fixed',
              left: -9999,
              top: 0,
              width: 720,
              background: '#fff',
              zIndex: -1,
            }
      }
    >
      <OfficialQuoteHeader
        t={t}
        lang={lang}
        titleKO={titleKO}
        titleEN={titleEN}
        subtitle={
          subtitle ||
          `${t('예약자', 'Holder')}: ${res.repName || res.bookingInstructor || '—'}`
        }
      />
      <div className="quote-official-body">
        <div className="quote-official-meta">
          📅 {dateSpan(rawGuests)} · {guests.length}
          {t('명', ' pax')}
        </div>
        {guests.map((g, i) => {
          const lines = Array.isArray(g.billingLines) ? g.billingLines : [];
          const useLines = lines.length > 0;
          return (
            <div
              key={`q-${i}`}
              style={{
                marginTop: 12,
                paddingTop: 10,
                borderTop: i ? '1px dashed #dbe7ff' : 'none',
              }}
            >
              <div className="quote-official-guest">
                👤{' '}
                {String(
                  g.name || `${t('다이버', 'Diver')} ${i + 1}`,
                ).toUpperCase()}
              </div>
              <div className="quote-official-meta">
                {g.startDate} ~ {g.endDate}
                {g.checkInTime ? ` · CI ${g.checkInTime}` : ''}
                {g.checkOutTime ? ` · CO ${g.checkOutTime}` : ''}
              </div>
              {useLines ? (
                lines.map((line, li) => {
                  const isEN = String(lang || '').toUpperCase() === 'EN';
                  const name = isEN
                    ? line.nameEN || line.nameKO || line.id
                    : line.nameKO || line.nameEN || line.id;
                  const neg =
                    Number(line.amountKRW) < 0 || Number(line.amountUSD) < 0;
                  return (
                    <div
                      key={`ql-${i}-${li}`}
                      className="quote-official-line"
                      style={neg ? { color: '#7048e8' } : undefined}
                    >
                      <span>• {name}</span>
                      <span>
                        {formatPricePair(
                          lang,
                          line.amountKRW,
                          line.amountUSD,
                        )}
                      </span>
                    </div>
                  );
                })
              ) : (
                <>
                  <div className="quote-official-line">
                    <span>• {t('객실', 'Room')}</span>
                    <span>
                      {formatPricePair(
                        lang,
                        g.roomShareCost,
                        g.roomShareCostUSD,
                      )}
                    </span>
                  </div>
                  <div className="quote-official-line">
                    <span>• {t('트레이닝', 'Training')}</span>
                    <span>
                      {formatPricePair(
                        lang,
                        g.trainingCost,
                        g.trainingCostUSD,
                      )}
                    </span>
                  </div>
                  <div className="quote-official-line">
                    <span>• {t('옵션', 'Options')}</span>
                    <span>
                      {formatPricePair(lang, g.optionsCost, g.optionsCostUSD)}
                    </span>
                  </div>
                  {(Number(g.penaltyFee) || 0) > 0 ? (
                    <div
                      className="quote-official-line"
                      style={{ color: '#e03131' }}
                    >
                      <span>
                        • {t('패널티', 'Penalty')}
                        {g.penaltyNote ? ` — ${g.penaltyNote}` : ''}
                      </span>
                      <span>
                        ₩
                        {Math.round(Number(g.penaltyFee) || 0).toLocaleString(
                          'en-US',
                        )}
                      </span>
                    </div>
                  ) : null}
                  {(Number(g.escortDiscountKRW) || 0) > 0 && withDiscount ? (
                    <div
                      className="quote-official-line"
                      style={{ color: '#7048e8' }}
                    >
                      <span>• {t('인솔자코드 할인', 'Escort discount')}</span>
                      <span>
                        {formatPricePair(
                          lang,
                          -Math.round(g.escortDiscountKRW),
                          -Math.round(g.escortDiscountUSD || 0),
                        )}
                      </span>
                    </div>
                  ) : null}
                </>
              )}
              <div className="quote-official-line" style={{ fontWeight: 900 }}>
                <span>{t('다이버 소계', 'Diver subtotal')}</span>
                <span>
                  {formatPricePair(
                    lang,
                    g.individualTotalKRW,
                    g.individualTotalUSD,
                  )}
                </span>
              </div>
            </div>
          );
        })}
        <div className="quote-official-total">
          <span>{t('최종 총 정산액', 'Grand Total')}</span>
          <span>
            {formatPricePair(
              lang,
              processed?.grandTotalKRW,
              processed?.grandTotalUSD,
            )}
          </span>
        </div>
      </div>
      <OfficialQuoteContacts t={t} lang={lang} />
    </div>
  );
});

export default MyQuoteCapture;
