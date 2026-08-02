import { useNavigate } from 'react-router-dom';
import BrandLockup from './BrandLockup';
import { clearGuestSession } from '../lib/guestAuth';

/** Footer logos → guest initial login (/). */
export default function SiteBrandFooter({ t, onBeforeHome }) {
  const navigate = useNavigate();

  const goHomeLogin = (e) => {
    e.preventDefault();
    try {
      onBeforeHome?.();
    } catch {
      /* ignore */
    }
    clearGuestSession();
    navigate('/', { replace: true });
  };

  return (
    <footer className="site-brand-footer">
      <a
        href="/"
        className="site-brand-footer-logo-link"
        onClick={goHomeLogin}
        aria-label={t ? t('홈 · 로그인', 'Home · Login') : 'Home'}
      >
        <BrandLockup variant="footer" showTagline={false} />
      </a>
    </footer>
  );
}
