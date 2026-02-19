import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useState, useEffect, useRef } from 'react';
import { notificationsApi } from '../api/notifications';

export default function NavBar() {
  const { user, isAuthenticated, isAdmin, activeClubId, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      setUnreadCount(0);
      return;
    }
    const fetchCount = () => {
      notificationsApi.getUnreadCount()
        .then((data) => setUnreadCount(data.count))
        .catch(() => {});
    };
    fetchCount();
    pollRef.current = setInterval(fetchCount, 60000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [isAuthenticated]);

  const isActive = (path: string) => location.pathname === path;

  const handleNav = (path: string) => {
    navigate(path);
    setMobileOpen(false);
  };

  const handleLogout = () => {
    logout();
    setMobileOpen(false);
    navigate('/');
  };

  return (
    <nav style={{
      background: '#1976d2',
      color: 'white',
      boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
      position: 'sticky',
      top: 0,
      zIndex: 1000,
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '0 20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        height: '52px',
      }}>
        {/* Logo / Brand */}
        <div
          onClick={() => handleNav('/')}
          style={{
            fontWeight: 'bold',
            fontSize: '18px',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          탁구인 플랫폼
        </div>

        {/* Desktop Menu */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
        }}
          className="nav-desktop"
        >
          <NavItem label="홈으로" active={isActive('/')} onClick={() => handleNav('/')} />
          <NavItem label="클럽찾기" active={isActive('/clubs')} onClick={() => handleNav('/clubs')} />
          {isAuthenticated && (
            <NavItem label="내클럽" active={isActive('/my-clubs')} onClick={() => handleNav('/my-clubs')} />
          )}
          <NavItem label="랭킹" active={isActive('/ranking')} onClick={() => handleNav('/ranking')} />
          <NavItem label="룰렛" active={isActive('/roulette')} onClick={() => handleNav('/roulette')} />
          {isAuthenticated && activeClubId && (
            <NavItem
              label="출석"
              active={location.pathname.includes('/attendance')}
              onClick={() => handleNav(`/clubs/${activeClubId}/attendance`)}
            />
          )}
          {isAuthenticated && activeClubId && (
            <NavItem
              label="게임기록"
              active={location.pathname === '/game-record' || location.pathname.includes('/cumulative-matches') || location.pathname.includes('/game-rooms')}
              onClick={() => handleNav('/game-record')}
            />
          )}
          {isAdmin && (
            <NavItem label="영상관리" active={isActive('/admin/videos')} onClick={() => handleNav('/admin/videos')} />
          )}

          {isAuthenticated && (
            <button
              onClick={() => handleNav('/notifications')}
              style={{
                background: isActive('/notifications') ? 'rgba(255,255,255,0.15)' : 'transparent',
                border: 'none', color: 'white', cursor: 'pointer', padding: '6px 10px',
                borderRadius: '4px', fontSize: '16px', position: 'relative',
              }}
            >
              &#128276;
              {unreadCount > 0 && (
                <span style={{
                  position: 'absolute', top: '2px', right: '2px',
                  background: '#f44336', color: 'white', fontSize: '10px',
                  borderRadius: '50%', width: '16px', height: '16px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: '700',
                }}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
          )}

          <div style={{ width: '1px', height: '24px', background: 'rgba(255,255,255,0.3)', margin: '0 8px' }} />

          {isAuthenticated && user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div
                onClick={() => handleNav('/profile')}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
                title="내 프로필"
              >
                {user.profile_image ? (
                  <img
                    src={user.profile_image}
                    alt={user.name}
                    style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover' }}
                  />
                ) : (
                  <div style={{
                    width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(255,255,255,0.3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px',
                  }}>
                    {(user.nickname || user.name).charAt(0)}
                  </div>
                )}
                <span style={{ fontSize: '14px', maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user.nickname || user.name}
                </span>
              </div>
              <NavItem label="로그아웃" onClick={handleLogout} />
            </div>
          ) : (
            <>
              <NavItem label="로그인" onClick={() => handleNav('/login')} />
              <NavItem label="회원가입" onClick={() => handleNav('/login')} highlight />
            </>
          )}
        </div>

        {/* Mobile Hamburger */}
        <button
          className="nav-mobile-toggle"
          onClick={() => setMobileOpen(!mobileOpen)}
          style={{
            display: 'none',
            background: 'none',
            border: 'none',
            color: 'white',
            fontSize: '24px',
            cursor: 'pointer',
            padding: '4px',
          }}
        >
          {mobileOpen ? '\u2715' : '\u2630'}
        </button>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileOpen && (
        <div
          className="nav-mobile-menu"
          style={{
            background: '#1565c0',
            padding: '8px 20px 12px',
          }}
        >
          <MobileNavItem label="홈으로" active={isActive('/')} onClick={() => handleNav('/')} />
          <MobileNavItem label="클럽찾기" active={isActive('/clubs')} onClick={() => handleNav('/clubs')} />
          {isAuthenticated && (
            <MobileNavItem label="내클럽" active={isActive('/my-clubs')} onClick={() => handleNav('/my-clubs')} />
          )}
          <MobileNavItem label="랭킹" active={isActive('/ranking')} onClick={() => handleNav('/ranking')} />
          <MobileNavItem label="룰렛" active={isActive('/roulette')} onClick={() => handleNav('/roulette')} />
          {isAuthenticated && activeClubId && (
            <MobileNavItem
              label="출석"
              active={location.pathname.includes('/attendance')}
              onClick={() => handleNav(`/clubs/${activeClubId}/attendance`)}
            />
          )}
          {isAuthenticated && activeClubId && (
            <MobileNavItem
              label="게임기록"
              active={location.pathname === '/game-record' || location.pathname.includes('/cumulative-matches') || location.pathname.includes('/game-rooms')}
              onClick={() => handleNav('/game-record')}
            />
          )}
          {isAdmin && (
            <MobileNavItem label="영상관리" active={isActive('/admin/videos')} onClick={() => handleNav('/admin/videos')} />
          )}
          {isAuthenticated && (
            <MobileNavItem
              label={`알림${unreadCount > 0 ? ` (${unreadCount})` : ''}`}
              active={isActive('/notifications')}
              onClick={() => handleNav('/notifications')}
            />
          )}
          <div style={{ height: '1px', background: 'rgba(255,255,255,0.2)', margin: '6px 0' }} />
          {isAuthenticated && user ? (
            <>
              <div style={{ padding: '8px 0', fontSize: '14px', color: 'rgba(255,255,255,0.8)' }}>
                {user.profile_image && (
                  <img
                    src={user.profile_image}
                    alt={user.name}
                    style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover', marginRight: '8px', verticalAlign: 'middle' }}
                  />
                )}
                {user.nickname || user.name}
              </div>
              <MobileNavItem label="내 정보" active={isActive('/profile')} onClick={() => handleNav('/profile')} />
              <MobileNavItem label="로그아웃" onClick={handleLogout} />
            </>
          ) : (
            <>
              <MobileNavItem label="로그인" onClick={() => handleNav('/login')} />
              <MobileNavItem label="회원가입" onClick={() => handleNav('/login')} />
            </>
          )}
        </div>
      )}
    </nav>
  );
}

function NavItem({ label, active, onClick, highlight }: {
  label: string;
  active?: boolean;
  onClick: () => void;
  highlight?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        background: highlight ? 'rgba(255,255,255,0.2)' : (active ? 'rgba(255,255,255,0.15)' : 'transparent'),
        border: highlight ? '1px solid rgba(255,255,255,0.5)' : 'none',
        color: 'white',
        padding: '6px 14px',
        borderRadius: '4px',
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: active ? '600' : '400',
        whiteSpace: 'nowrap',
        transition: 'background 0.15s',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.2)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = highlight ? 'rgba(255,255,255,0.2)' : (active ? 'rgba(255,255,255,0.15)' : 'transparent'))}
    >
      {label}
    </button>
  );
}

function MobileNavItem({ label, active, onClick }: {
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'block',
        width: '100%',
        textAlign: 'left',
        background: active ? 'rgba(255,255,255,0.1)' : 'transparent',
        border: 'none',
        color: 'white',
        padding: '10px 8px',
        borderRadius: '4px',
        cursor: 'pointer',
        fontSize: '15px',
        fontWeight: active ? '600' : '400',
      }}
    >
      {label}
    </button>
  );
}
