import { useState } from 'react';
import {
  AD_IMAGE_MAX_BYTES,
  uploadAdImage,
} from '../../../data/adsStorage';
import { useToast } from '../../../ui/ToastContext';

export default function AdsTab({ t, settings, onPatchSettings }) {
  const toast = useToast();
  const ads = Array.isArray(settings.adsConfig) ? settings.adsConfig : [];
  const [title, setTitle] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

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
    const item = {
      id: `ad_${Date.now()}`,
      title: title.trim(),
      linkUrl: linkUrl.trim(),
      imageUrl: imageUrl.trim(),
      isActive: true,
      order: ads.length,
    };
    await saveAds([...ads, item]);
    setTitle('');
    setLinkUrl('');
    setImageUrl('');
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
      // Upload to Storage (URL only in Firestore) — avoids 1MB settings doc limit.
      const url = await uploadAdImage(file);
      setImageUrl(url);
      toast.success(t('이미지를 업로드했습니다.', 'Image uploaded.'));
    } catch (err) {
      if (err?.message === 'FILE_TOO_LARGE') {
        toast.warn(
          t(
            '이미지는 50MB 이하로 올려주세요.',
            'Please upload an image under 50MB.',
          ),
        );
      } else {
        toast.error(
          err?.message ||
            t(
              '업로드 실패. Storage 규칙을 배포했는지 확인해 주세요.',
              'Upload failed. Deploy Storage rules if needed.',
            ),
        );
      }
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <div className="card">
        <h3 style={{ marginTop: 0 }}>
          {t('광고 대시보드 (롤링 배너)', 'Ads Dashboard (Rolling Banner)')}
        </h3>
        <p style={{ color: 'var(--muted)', fontSize: 13 }}>
          {t(
            '게스트 예약 화면 상단에 롤링 배너로 표시됩니다. 활성 광고만 노출됩니다. 이미지는 Firebase Storage에 업로드되며 최대 50MB까지 가능합니다.',
            'Shown as a rolling banner on the guest booking screen. Images upload to Firebase Storage (max 50MB).',
          )}
        </p>

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
              {t('업로드 중…', 'Uploading…')}
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
          disabled={saving}
          onClick={addAd}
        >
          {t('광고 추가', 'Add Ad')}
        </button>
      </div>

      {ads.map((ad, idx) => (
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
                #{idx + 1} {ad.title || t('(제목 없음)', '(Untitled)')}
              </strong>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
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
                disabled={idx === 0}
                onClick={() => {
                  if (idx === 0) return;
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
                disabled={idx === ads.length - 1}
                onClick={() => {
                  if (idx >= ads.length - 1) return;
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
      ))}

      {!ads.length && (
        <p style={{ color: 'var(--muted)' }}>
          {t('등록된 광고가 없습니다.', 'No ads yet.')}
        </p>
      )}
    </div>
  );
}
