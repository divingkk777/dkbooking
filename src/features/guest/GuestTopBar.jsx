import { Link } from 'react-router-dom';

/**
 * Header: slogan (center) · KOR / ENG / My · Logout|Book
 */
export default function GuestTopBar({
  t,
  lang,
  setLang,
  onLogout,
  showLogout = false,
  myActive = false,
}) {
  return (
    <div className="guest-topbar">
      <strong className="guest-topbar-slogan">
        {t(
          '당신의 다이빙 여정을 계획 해보세요',
          'Plan your diving journey',
        )}
      </strong>
      <div className="guest-topbar-right">
        <div className="lang-switch">
          <button
            type="button"
            className={lang === 'KO' ? 'active btn-ghost' : 'btn-ghost'}
            onClick={() => setLang('KO')}
          >
            KOR
          </button>
          <button
            type="button"
            className={lang === 'EN' ? 'active btn-ghost' : 'btn-ghost'}
            onClick={() => setLang('EN')}
          >
            ENG
          </button>
          <Link
            to="/my"
            className={`btn-ghost guest-topbar-my${myActive ? ' active' : ''}`}
          >
            My
          </Link>
        </div>
        {showLogout ? (
          <button type="button" className="btn-ghost" onClick={onLogout}>
            {t('로그아웃', 'Logout')}
          </button>
        ) : myActive ? (
          <Link to="/" className="btn-ghost">
            {t('예약하기', 'Book')}
          </Link>
        ) : null}
      </div>
    </div>
  );
}
