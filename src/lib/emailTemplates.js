/**
 * Quote-sheet style emails (same look as on-screen 견적서).
 * EmailJS template must use unescaped HTML: {{{message}}}
 */

import { BRAND_ASSETS, whatsappHref } from '../components/BrandLockup';
import { HOTEL_INFO } from '../domain/defaults';
import { formatPricePair } from '../domain/pricing';
import {
  dateSpan,
  guestSummary,
  repriceReservation,
} from '../features/guest/myReservationUtils';

const FALLBACK_ORIGIN = 'https://dkbooking.web.app';

function absUrl(path) {
  const clean = String(path || '').split('?')[0];
  if (/^https?:\/\//i.test(clean)) return clean;
  let origin = FALLBACK_ORIGIN;
  if (typeof window !== 'undefined' && window.location?.origin) {
    const o = window.location.origin;
    // Email clients cannot load localhost image URLs
    if (!/localhost|127\.0\.0\.1/i.test(o)) origin = o;
  }
  return `${origin}${clean.startsWith('/') ? clean : `/${clean}`}`;
}

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function lineName(line, lang) {
  const isEN = String(lang || '').toUpperCase() === 'EN';
  return isEN
    ? line.nameEN || line.nameKO || line.id || '—'
    : line.nameKO || line.nameEN || line.id || '—';
}

function collectGuests(res, settings, withDiscount = true) {
  if (settings) {
    try {
      const priced = repriceReservation(res, settings, { withDiscount });
      const guests = [];
      (priced.processedRooms || []).forEach((room) => {
        (room.guests || []).forEach((g) => {
          if (g) guests.push(g);
        });
      });
      return {
        guests,
        grandTotalKRW: priced.grandTotalKRW,
        grandTotalUSD: priced.grandTotalUSD,
      };
    } catch {
      /* fall through */
    }
  }
  return {
    guests: guestSummary(res),
    grandTotalKRW: res.grandTotalKRW,
    grandTotalUSD: res.grandTotalUSD,
  };
}

function guestLinesHtml(g, lang, t, withDiscount) {
  const lines = Array.isArray(g.billingLines) ? g.billingLines : [];
  if (lines.length) {
    return lines
      .map((line) => {
        const neg =
          Number(line.amountKRW) < 0 || Number(line.amountUSD) < 0;
        return `<tr>
          <td style="padding:6px 0;font-size:13px;color:${neg ? '#7048e8' : '#191f28'};">• ${esc(lineName(line, lang))}</td>
          <td style="padding:6px 0;font-size:13px;text-align:right;white-space:nowrap;color:${neg ? '#7048e8' : '#191f28'};">${esc(formatPricePair(lang, line.amountKRW, line.amountUSD))}</td>
        </tr>`;
      })
      .join('');
  }
  const rows = [
    [t('객실', 'Room'), g.roomShareCost, g.roomShareCostUSD],
    [t('트레이닝', 'Training'), g.trainingCost, g.trainingCostUSD],
    [t('옵션', 'Options'), g.optionsCost, g.optionsCostUSD],
  ];
  let html = rows
    .map(
      ([label, krw, usd]) => `<tr>
        <td style="padding:6px 0;font-size:13px;color:#191f28;">• ${esc(label)}</td>
        <td style="padding:6px 0;font-size:13px;text-align:right;white-space:nowrap;">${esc(formatPricePair(lang, krw, usd))}</td>
      </tr>`,
    )
    .join('');
  if ((Number(g.escortDiscountKRW) || 0) > 0 && withDiscount) {
    html += `<tr>
      <td style="padding:6px 0;font-size:13px;color:#7048e8;">• ${esc(t('인솔자코드 할인', 'Escort discount'))}</td>
      <td style="padding:6px 0;font-size:13px;text-align:right;color:#7048e8;white-space:nowrap;">${esc(formatPricePair(lang, -Math.round(g.escortDiscountKRW), -Math.round(g.escortDiscountUSD || 0)))}</td>
    </tr>`;
  }
  return html;
}

/**
 * @param {'booking'|'approval'|'status'|'quote'} kind
 */
export function buildProfessionalReservationEmail({
  kind = 'booking',
  t,
  lang = 'KO',
  res,
  settings,
  groupPin,
  extraNote,
  withDiscount = true,
}) {
  const isEN = String(lang || '').toUpperCase() === 'EN';
  const { guests, grandTotalKRW, grandTotalUSD } = collectGuests(
    res,
    settings,
    withDiscount,
  );
  const idaLogo = absUrl(BRAND_ASSETS.ida);
  const dkLogo = absUrl(BRAND_ASSETS.doubleK);
  const wa = whatsappHref(lang, 'consult');

  const titles = {
    booking: {
      ko: '견적서',
      en: 'Quotation',
      subjectKo: `[IDA×DOUBLE K] ${res.repName || ''}님, 예약이 접수되었습니다.`,
      subjectEn: `[IDA×DOUBLE K] Reservation received — ${res.repName || 'Guest'}`,
    },
    approval: {
      ko: '승인 안내서',
      en: 'Approval Statement',
      subjectKo: `[IDA×DOUBLE K] ${res.repName || ''}님, 예약 승인 안내입니다.`,
      subjectEn: `[IDA×DOUBLE K] Booking approval — ${res.repName || 'Guest'}`,
    },
    status: {
      ko: '견적서',
      en: 'Quotation',
      subjectKo: `[IDA×DOUBLE K] ${res.repName || ''}님, 예약 현황 안내입니다.`,
      subjectEn: `[IDA×DOUBLE K] Booking status — ${res.repName || 'Guest'}`,
    },
    quote: {
      ko: '견적서',
      en: 'Quotation',
      subjectKo: `[IDA×DOUBLE K] ${res.repName || ''}님, 견적서입니다.`,
      subjectEn: `[IDA×DOUBLE K] Quotation — ${res.repName || 'Guest'}`,
    },
  };
  const meta = titles[kind] || titles.quote;
  const docTitle = isEN ? meta.en : meta.ko;
  const subject = isEN ? meta.subjectEn : meta.subjectKo;
  const dates = dateSpan(guests);
  const total = formatPricePair(lang, grandTotalKRW, grandTotalUSD);
  const hasPin = groupPin != null && String(groupPin).trim();

  const guestBlocks = guests
    .map((g, i) => {
      const name = String(
        g.name || `${t('다이버', 'Diver')} ${i + 1}`,
      ).toUpperCase();
      const stayNights = Number(g.billedNights) || 0;
      const metaLine = [
        `${g.startDate || '—'} ~ ${g.endDate || '—'}`,
        stayNights > 0
          ? `${t('숙박', 'Stay')} ${stayNights}${t('박', 'n')}`
          : '',
        g.checkInTime ? `CI ${g.checkInTime}` : '',
        g.checkOutTime ? `CO ${g.checkOutTime}` : '',
      ]
        .filter(Boolean)
        .join(' · ');
      return `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;padding-top:10px;border-top:${i ? '1px dashed #dbe7ff' : 'none'};">
          <tr><td style="font-size:15px;font-weight:900;color:#191f28;padding-bottom:4px;">👤 ${esc(name)}</td></tr>
          <tr><td style="font-size:12px;color:#6b7684;padding-bottom:6px;">${esc(metaLine)}</td></tr>
          <tr><td>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              ${guestLinesHtml(g, lang, t, withDiscount)}
              <tr>
                <td style="padding:8px 0 0;font-size:13px;font-weight:900;">${esc(t('다이버 소계', 'Diver subtotal'))}</td>
                <td style="padding:8px 0 0;font-size:13px;font-weight:900;text-align:right;white-space:nowrap;">${esc(formatPricePair(lang, g.individualTotalKRW, g.individualTotalUSD))}</td>
              </tr>
            </table>
          </td></tr>
        </table>`;
    })
    .join('');

  const pinHtml = hasPin
    ? `<div style="margin:12px 0;padding:12px 14px;background:#f2f7ff;border-radius:10px;font-size:13px;color:#191f28;line-height:1.55;">
        <strong>${esc(t('마이페이지 로그인', 'My Page Login'))}</strong><br/>
        ${esc(t('이메일(ID)', 'Email (ID)'))}: ${esc(res.repEmail || res.bookingInstructor || '—')}<br/>
        ${esc(t('조회용 비밀번호', 'PIN'))}: <strong>${esc(groupPin)}</strong>
      </div>`
    : '';

  const html = `<!DOCTYPE html>
<html lang="${isEN ? 'en' : 'ko'}">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#eef3fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef3fb;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;background:#ffffff;border:2.5px solid #3182f6;border-radius:16px;">
          <tr>
            <td style="padding:28px 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-bottom:2px solid #3182f6;padding-bottom:14px;margin-bottom:16px;">
                <tr>
                  <td align="center" style="padding-bottom:12px;">
                    <img src="${esc(idaLogo)}" alt="IDA" width="56" style="display:inline-block;vertical-align:middle;width:56px;height:auto;border:0;"/>
                    <span style="display:inline-block;vertical-align:middle;margin:0 10px;font-size:16px;font-weight:900;color:#3182f6;">×</span>
                    <img src="${esc(dkLogo)}" alt="DOUBLE K" width="140" style="display:inline-block;vertical-align:middle;width:140px;height:auto;border:0;"/>
                  </td>
                </tr>
                <tr>
                  <td align="center">
                    <div style="font-size:11px;font-weight:800;letter-spacing:0.08em;color:#8b95a1;">IDA × DOUBLE K FREEDIVING CENTER</div>
                    <div style="margin-top:6px;font-size:26px;font-weight:900;color:#191f28;">${esc(docTitle)}</div>
                    <div style="margin-top:4px;font-size:13px;color:#6b7684;">${esc(`${t('예약자', 'Holder')}: ${res.repName || res.bookingInstructor || '—'}`)}</div>
                  </td>
                </tr>
              </table>

              <div style="font-size:13px;color:#6b7684;margin-bottom:8px;">📅 ${esc(dates)} · ${guests.length}${esc(t('명', ' pax'))}</div>
              ${extraNote ? `<div style="font-size:13px;color:#3182f6;margin-bottom:10px;">${esc(extraNote)}</div>` : ''}
              ${pinHtml}
              ${guestBlocks}

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;border-top:2px solid #3182f6;">
                <tr>
                  <td style="padding:14px 0 0;font-size:16px;font-weight:900;color:#191f28;">${esc(t('최종 총 정산액', 'Grand Total'))}</td>
                  <td style="padding:14px 0 0;font-size:16px;font-weight:900;color:#3182f6;text-align:right;white-space:nowrap;">${esc(total)}</td>
                </tr>
              </table>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:18px;border-top:1px dashed #dbe7ff;padding-top:14px;">
                <tr><td style="font-size:13px;font-weight:800;color:#191f28;padding-bottom:8px;">💬 ${esc(t('고객 상담', 'Customer Support'))}</td></tr>
                <tr>
                  <td style="padding:10px 12px;background:#f2f7ff;border-radius:10px;font-size:13px;color:#191f28;line-height:1.55;">
                    <strong>${esc(t('카카오톡', 'KakaoTalk'))}</strong> ID:
                    <a href="${esc(BRAND_ASSETS.kakaoAppHref)}" style="color:#3182f6;font-weight:800;text-decoration:none;">${esc(BRAND_ASSETS.kakaoId)}</a><br/>
                    <strong>WhatsApp · ${esc(BRAND_ASSETS.whatsappName)}</strong>
                    <a href="${esc(wa)}" style="color:#3182f6;font-weight:800;text-decoration:none;"> ${esc(BRAND_ASSETS.whatsappDisplay)}</a>
                  </td>
                </tr>
                <tr>
                  <td style="padding-top:12px;font-size:12px;color:#6b7684;line-height:1.5;">
                    <strong>${esc(HOTEL_INFO.name)}</strong><br/>${esc(HOTEL_INFO.address)} · Tel ${esc(HOTEL_INFO.tel)}
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-top:16px;">
                    <img src="${esc(idaLogo)}" alt="IDA" width="40" style="display:inline-block;vertical-align:middle;width:40px;height:auto;border:0;"/>
                    <span style="display:inline-block;vertical-align:middle;margin:0 8px;font-weight:900;color:#3182f6;">×</span>
                    <img src="${esc(dkLogo)}" alt="DOUBLE K" width="110" style="display:inline-block;vertical-align:middle;width:110px;height:auto;border:0;"/>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const textLines = [
    'IDA × DOUBLE K FREEDIVING CENTER',
    docTitle,
    `${t('예약자', 'Holder')}: ${res.repName || res.bookingInstructor || '—'}`,
    `📅 ${dates} · ${guests.length}${t('명', ' pax')}`,
    '',
  ];
  if (hasPin) {
    textLines.push(
      `[${t('마이페이지 로그인', 'My Page Login')}]`,
      `${t('이메일(ID)', 'Email (ID)')}: ${res.repEmail || res.bookingInstructor || '—'}`,
      `${t('조회용 비밀번호', 'PIN')}: ${groupPin}`,
      '',
    );
  }
  guests.forEach((g, i) => {
    textLines.push(
      `—— ${t('다이버', 'Diver')} ${i + 1}: ${g.name || '—'} ——`,
      `${g.startDate || '—'} ~ ${g.endDate || '—'}`,
    );
    const lines = Array.isArray(g.billingLines) ? g.billingLines : [];
    if (lines.length) {
      lines.forEach((line) => {
        textLines.push(
          `  · ${lineName(line, lang)}: ${formatPricePair(lang, line.amountKRW, line.amountUSD)}`,
        );
      });
    } else {
      textLines.push(
        `  · ${t('객실', 'Room')}: ${formatPricePair(lang, g.roomShareCost, g.roomShareCostUSD)}`,
        `  · ${t('트레이닝', 'Training')}: ${formatPricePair(lang, g.trainingCost, g.trainingCostUSD)}`,
        `  · ${t('옵션', 'Options')}: ${formatPricePair(lang, g.optionsCost, g.optionsCostUSD)}`,
      );
    }
    textLines.push(
      `${t('소계', 'Subtotal')}: ${formatPricePair(lang, g.individualTotalKRW, g.individualTotalUSD)}`,
      '',
    );
  });
  textLines.push(
    `${t('최종 총 정산액', 'Grand Total')}: ${total}`,
    '',
    `${t('카카오톡', 'KakaoTalk')}: ${BRAND_ASSETS.kakaoId}`,
    `WhatsApp · ${BRAND_ASSETS.whatsappName}: ${BRAND_ASSETS.whatsappDisplay}`,
    `${HOTEL_INFO.name} · ${HOTEL_INFO.address}`,
  );

  return {
    subject,
    html,
    text: textLines.join('\n'),
    to_name: res.repName || 'Guest',
    to_email: res.repEmail || res.bookingInstructor || '',
  };
}

/** Plain-text fallback — do not put HTML in `message` (breaks text/plain templates). */
export function toEmailJsParams(built) {
  return {
    to_email: built.to_email,
    to_name: built.to_name,
    subject: built.subject,
    message: built.text,
    html_message: built.html,
    invoice_details: built.text,
    message_text: built.text,
  };
}

/**
 * Image-link email (+ optional EmailJS Variable Attachment named `content`).
 * Body is plain text so Gmail never shows raw HTML source.
 */
export function toEmailJsImageParams({
  to_email,
  to_name,
  subject,
  title,
  imageUrl,
  imageDataUrl,
  contactsNote,
}) {
  const note =
    contactsNote ||
    'KakaoTalk: freedivingkk · WhatsApp Angelic: +63 998 917 1548';
  const link = /^https?:\/\//i.test(String(imageUrl || ''))
    ? String(imageUrl)
    : '';
  const message = link
    ? [
        title || 'IDA × DOUBLE K',
        '',
        '아래 링크를 누르면 견적/승인 안내서 이미지가 바로 열립니다:',
        link,
        '',
        'Open the image statement here:',
        link,
        '',
        note,
      ].join('\n')
    : [
        title || 'IDA × DOUBLE K',
        '',
        '승인/견적 안내서 이미지가 첨부되어 있습니다. 첨부파일을 열어 확인해 주세요.',
        'The statement image is attached — open the attachment to view it.',
        '',
        note,
      ].join('\n');

  // Never put multi‑MB data-URLs into EmailJS — they hang/fail the request.
  const attach =
    typeof imageDataUrl === 'string' &&
    imageDataUrl.startsWith('data:') &&
    imageDataUrl.length < 45_000
      ? imageDataUrl
      : link || '';

  return {
    to_email,
    to_name: to_name || 'Guest',
    subject: subject || '[IDA×DOUBLE K] 예약 안내서 (이미지)',
    message,
    invoice_details: message,
    message_text: message,
    html_message: link
      ? `<div style="font-family:sans-serif;font-size:14px;line-height:1.6;color:#191f28;">
          <p><strong>${esc(title || 'IDA × DOUBLE K')}</strong></p>
          <p><a href="${esc(link)}" style="color:#3182f6;font-weight:700;">이미지로 바로 보기 / Open image</a></p>
          <p style="margin-top:16px;"><a href="${esc(link)}"><img src="${esc(link)}" alt="statement" width="640" style="max-width:100%;height:auto;border:2.5px solid #3182f6;border-radius:12px;"/></a></p>
          <p style="font-size:12px;color:#6b7684;">${esc(note)}</p>
        </div>`
      : message,
    /** Only small payloads or https URL — EmailJS Variable Attachment name: content */
    content: attach,
    quote_image: attach,
  };
}
