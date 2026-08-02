import { useEffect, useMemo, useState } from 'react';
import {
  AD_IMAGE_MAX_BYTES,
  uploadAdImage,
} from '../../../data/adsStorage';
import { adMatchesLang, normalizeAdLang } from '../../../components/RollingBanner';
import { useToast } from '../../../ui/ToastContext';

export default function AdsTab({ t, lang = 'KO', settings, onPatchSettings }) {
  const toast = useToast();
  const ads = Array.isArray(settings.adsConfig) ? settings.adsConfig : [];
  const headerLang = normalizeAdLang(lang);
  const [title, setTitle] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [adLang, setAdLang] = useState(headerLang);
  const [listFilter, setListFilter] = useState(headerLang); // KO | ENG | ALL
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Follow admin header KOR/ENG for list + default publish language.
  useEffect(() => {
    setListFilter(headerLang);
    setAdLang(headerLang);
  }, [headerLang]);

  const visibleAds = useMemo(() => {
    const sorted = [...ads].sort(
      (a, b) => (Number(a.order) || 0) - (Number(b.order) || 0),
    );
    if (listFilter === 'ALL') return sorted;
    return sorted.filter((a) => adMatchesLang(a, listFilter));
  }, [ads, listFilter]);

  const saveAds = async (next) => {
    setSaving(true);
    try {
      await onPatchSettings({ adsConfig: next });
      toast.success(t('광고가 저장되었습니다.', 'Ads saved.'));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const addAd = async () => {
    if (!imageUrl.trim() && !title.trim()) {
      toast.warn(
        t('이미지 또는 제목을 입력하세요.', 'Enter an image or title.'),
      );
      return;
    }
    const lang = normalizeAdLang(adLang);
    const item = {
      id: `ad_${Date.now()}`,
      title: title.trim(),
      linkUrl: linkUrl.trim(),
      imageUrl: imageUrl.trim(),
      lang,
      isActive: true,
      order: ads.length,
    };
    await saveAds([...ads, item]);
    setTitle('');
    setLinkUrl('');
    setImageUrl('');
    setListFilter(lang);
  };

  const onPickImage = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!String(file.type || '').startsWith('image/')) {
      toast.warn(t('이미지 파일만 업로드할 수 있습니다.', 'Image files only.'));
      return;
    }
    if (file.size > AD_IMAGE_MAX_BYTES) {
      toast.warn(
        t(
          '이미지는 50MB 이하로 올려주세요.',
          'Please upload an image under 50MB.',
        ),
      );
      return;
    }
    setUploading(true);
    try {
      const url = await uploadAdImage(file);
      setImageUrl(url);
      if (String(url).startsWith('data:')) {
        toast.success(
          t(
            '이미지를 준비했습니다. (Storage 미사용 · 압축 저장) 「광고 추가」를 눌러 저장하세요.',
            'Image ready (compressed, no Storage). Click Add Ad to save.',
          ),
        );
      } else {
        toast.success(t('이미지를 업로드했습니다.', 'Image uploaded.'));
      }
    } catch (err) {
      if (err?.message === 'FILE_TOO_LARGE') {
        toast.warn(
          t(
            '이미지는 50MB 이하로 올려주세요.',
            'Please upload an image under 50MB.',
          ),
        );
      } else if (err?.message === 'STORAGE_OR_SIZE') {
        toast.error(
          t(
            '업로드 실패. Firebase Storage를 켜거나 더 작은 이미지를 사용해 주세요.',
            'Upload failed. Enable Firebase Storage or use a smaller image.',
          ),
        );
      } else {
        toast.error(
          err?.message ||
            t(
              '업로드 실패. Storage를 콘솔에서 활성화했는지 확인해 주세요.',
              'Upload failed. Enable Storage in Firebase console.',
            ),
        );
      }
    } finally {
      setUploading(false);
    }
  };

  const langLabel = (lang) => {
    const n = normalizeAdLang(lang);
    return n === 'ENG' ? 'ENG' : 'KOR';
  };

  return (
    <div>
      <div className="card">
        <h3 style={{ marginTop: 0 }}>
          {t('광고 대시보드 (롤링 배너)', 'Ads Dashboard (Rolling Banner)')}
        </h3>
        <p style={{ color: 'var(--muted)', fontSize: 13 }}>
          {t(
            '게스트 화면 언어(KOR/ENG)에 맞는 광고만 롤링 배너로 표시됩니다. 올릴 때 언어를 선택하세요.',
            'Guest banners follow the site language (KOR/ENG). Choose a language when uploading.',
          )}
        </p>

        <div style={{ marginBottom: 14 }}>
          <label className="label-text">
            {t('게시 언어', 'Publish language')}
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            {['KO', 'ENG'].map((code) => (
              <button
                key={code}
                type="button"
                className={
                  normalizeAdLang(adLang) === normalizeAdLang(code)
                    ? 'btn-primary'
                    : 'btn-secondary'
                }
                style={{ width: 'auto', minWidth: 88 }}
                onClick={() => setAdLang(normalizeAdLang(code))}
              >
                {code === 'KO' ? 'KOR' : 'ENG'}
              </button>
            ))}
          </div>
        </div>

        <div className="grid-2">
          <div>
            <label className="label-text">{t('제목', 'Title')}</label>
            <input
              className="input-field"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('예: 시즌 프로모션', 'e.g. Season promo')}
            />
          </div>
          <div>
            <label className="label-text">{t('링크 URL', 'Link URL')}</label>
            <input
              className="input-field"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://"
            />
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <label className="label-text">
            {t('이미지 URL 또는 업로드', 'Image URL or upload')}
          </label>
          <input
            className="input-field"
            value={imageUrl.startsWith('data:') ? '' : imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://... or upload below"
          />
          <input
            type="file"
            accept="image/*"
            style={{ marginTop: 8 }}
            disabled={uploading || saving}
            onChange={onPickImage}
          />
          {uploading ? (
            <div style={{ marginTop: 8, fontSize: 13, color: '#3182f6' }}>
              {t(
                '업로드 중… (최대 약 12초, 실패 시 압축 저장으로 전환)',
                'Uploading… (≈12s timeout, then compressed fallback)',
              )}
            </div>
          ) : null}
          {imageUrl ? (
            <img
              src={imageUrl}
              alt="preview"
              style={{
                marginTop: 12,
                width: '100%',
                maxHeight: 160,
                objectFit: 'cover',
                borderRadius: 12,
                border: '1.5px solid var(--line)',
              }}
            />
          ) : null}
        </div>

        <button
          type="button"
          className="btn-primary"
          style={{ marginTop: 16 }}
          disabled={saving || uploading}
          onClick={addAd}
        >
          {uploading
            ? t('업로드 중…', 'Uploading…')
            : t(
                `${langLabel(adLang)} 광고 추가`,
                `Add ${langLabel(adLang)} Ad`,
              )}
        </button>
      </div>

      <div
        className="card"
        style={{
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap',
          alignItems: 'center',
          padding: '12px 16px',
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 700, marginRight: 4 }}>
          {t('목록 필터', 'List filter')}
        </span>
        {[
          { id: 'KO', label: 'KOR' },
          { id: 'ENG', label: 'ENG' },
          { id: 'ALL', label: t('전체', 'All') },
        ].map((opt) => (
          <button
            key={opt.id}
            type="button"
            className={
              listFilter === opt.id ? 'btn-primary' : 'btn-secondary'
            }
            style={{ width: 'auto', minWidth: 72 }}
            onClick={() => setListFilter(opt.id)}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {visibleAds.map((ad) => {
        const idx = ads.findIndex((a) => a.id === ad.id);
        return (
          <div key={ad.id} className="card">
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 12,
                alignItems: 'flex-start',
              }}
            >
              <div style={{ flex: 1 }}>
                <strong>
                  #{(Number(ad.order) || 0) + 1}{' '}
                  {ad.title || t('(제목 없음)', '(Untitled)')}
                  <span
                    style={{
                      marginLeft: 8,
                      fontSize: 11,
                      fontWeight: 800,
                      padding: '2px 8px',
                      borderRadius: 999,
                      background:
                        normalizeAdLang(ad.lang || 'KO') === 'ENG'
                          ? '#dbe4ff'
                          : '#fff3bf',
                      color:
                        normalizeAdLang(ad.lang || 'KO') === 'ENG'
                          ? '#364fc7'
                          : '#e67700',
                    }}
                  >
                    {ad.lang ? langLabel(ad.lang) : t('공통(구)', 'Legacy')}
                  </span>
                </strong>
                <div
                  style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}
                >
                  {ad.linkUrl || '-'}
                </div>
                {ad.imageUrl ? (
                  <img
                    src={ad.imageUrl}
                    alt={ad.title || 'ad'}
                    style={{
                      marginTop: 10,
                      width: '100%',
                      maxHeight: 120,
                      objectFit: 'cover',
                      borderRadius: 10,
                    }}
                  />
                ) : null}
              </div>
              <div className="action-row">
                <div
                  style={{ display: 'flex', gap: 4 }}
                  title={t(
                    '클릭한 언어 모드에서만 게스트에게 표시',
                    'Shown to guests only in the selected language',
                  )}
                >
                  {['KO', 'ENG'].map((code) => {
                    const selected =
                      ad.lang != null &&
                      String(ad.lang).trim() !== '' &&
                      normalizeAdLang(ad.lang) === normalizeAdLang(code);
                    return (
                      <button
                        key={code}
                        type="button"
                        className={selected ? 'btn-primary' : 'btn-secondary'}
                        style={{ width: 'auto', minWidth: 52, padding: '6px 10px' }}
                        onClick={() => {
                          const nextLang = normalizeAdLang(code);
                          if (selected) return;
                          saveAds(
                            ads.map((a) =>
                              a.id === ad.id ? { ...a, lang: nextLang } : a,
                            ),
                          );
                        }}
                      >
                        {code === 'KO' ? 'KOR' : 'ENG'}
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() =>
                    saveAds(
                      ads.map((a) =>
                        a.id === ad.id ? { ...a, isActive: !a.isActive } : a,
                      ),
                    )
                  }
                >
                  {ad.isActive !== false
                    ? t('활성', 'Active')
                    : t('비활성', 'Off')}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={idx <= 0}
                  onClick={() => {
                    if (idx <= 0) return;
                    const next = [...ads];
                    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
                    saveAds(next.map((a, i) => ({ ...a, order: i })));
                  }}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={idx < 0 || idx >= ads.length - 1}
                  onClick={() => {
                    if (idx < 0 || idx >= ads.length - 1) return;
                    const next = [...ads];
                    [next[idx + 1], next[idx]] = [next[idx], next[idx + 1]];
                    saveAds(next.map((a, i) => ({ ...a, order: i })));
                  }}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="btn-danger"
                  onClick={() => {
                    if (
                      !window.confirm(
                        t('이 광고를 삭제할까요?', 'Delete this ad?'),
                      )
                    ) {
                      return;
                    }
                    saveAds(ads.filter((a) => a.id !== ad.id));
                  }}
                >
                  {t('삭제', 'Delete')}
                </button>
              </div>
            </div>
          </div>
        );
      })}

      {!visibleAds.length && (
        <p style={{ color: 'var(--muted)' }}>
          {t('등록된 광고가 없습니다.', 'No ads yet.')}
        </p>
      )}
    </div>
  );
}
