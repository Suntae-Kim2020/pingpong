import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useState } from 'react';

export default function NavBar() {
  const { user, isAuthenticated, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

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
          <NavItem label="새경기생성" onClick={() => handleNav('/?create=1')} />
          {isAdmin && (
            <NavItem label="영상관리" active={isActive('/admin/videos')} onClick={() => handleNav('/admin/videos')} />
          )}

          <div style={{ width: '1px', height: '24px', background: 'rgba(255,255,255,0.3)', margin: '0 8px' }} />

          {isAuthenticated && user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {user.profile_image && (
                <img
                  src={user.profile_image}
                  alt={user.name}
                  style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover' }}
                />
              )}
              <span style={{ fontSize: '14px', maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user.nickname || user.name}
              </span>
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
          <MobileNavItem label="새경기생성" onClick={() => handleNav('/?create=1')} />
          {isAdmin && (
            <MobileNavItem label="영상관리" active={isActive('/admin/videos')} onClick={() => handleNav('/admin/videos')} />
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
