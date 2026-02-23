import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useState, useEffect, useRef } from 'react';
import { notificationsApi } from '../api/notifications';

export default function NavBar() {
  const {
    user, isAuthenticated,
    activeEntity, switchEntity,
    approvedClubs, approvedOrgs,
    logout,
  } = useAuth();
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

  const handleEntitySwitch = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    const [type, idStr] = val.split(':');
    if (type === 'club' || type === 'org') {
      switchEntity(type, parseInt(idStr));
      navigate('/');
    }
  };

  // 동적 메뉴 조건
  const isClubActive = activeEntity?.type === 'club';
  const isOrgActive = activeEntity?.type === 'org';
  const isEntityAdmin = activeEntity?.role === 'leader' || activeEntity?.role === 'admin';
  const entityId = activeEntity?.id;

  // 브랜드 텍스트
  const brandText = activeEntity?.name || '탁구인 플랫폼';

  // 통합 드롭다운 필요 여부
  const totalEntities = approvedClubs.length + approvedOrgs.length;
  const entityValue = activeEntity ? `${activeEntity.type}:${activeEntity.id}` : '';

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
          {brandText}
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
          <NavItem label="찾기" active={isActive('/search')} onClick={() => handleNav('/search')} />
          {isAuthenticated && (
            <NavItem label="내클럽" active={isActive('/my-clubs')} onClick={() => handleNav('/my-clubs')} />
          )}
          <NavItem label="랭킹" active={isActive('/ranking')} onClick={() => handleNav('/ranking')} />
          <NavItem label="룰렛" active={isActive('/roulette')} onClick={() => handleNav('/roulette')} />

          {/* 클럽 전용 메뉴 */}
          {isAuthenticated && isClubActive && (
            <NavItem
              label="월례회"
              active={isActive('/meetings') || location.pathname.startsWith('/meeting/')}
              onClick={() => handleNav('/meetings')}
            />
          )}
          {isAuthenticated && isClubActive && (
            <NavItem
              label="출석"
              active={location.pathname.includes('/attendance')}
              onClick={() => handleNav(`/clubs/${entityId}/attendance`)}
            />
          )}
          {isAuthenticated && isClubActive && (
            <NavItem
              label="게임기록"
              active={location.pathname === '/game-record' || location.pathname.includes('/cumulative-matches') || location.pathname.includes('/monthly-record')}
              onClick={() => handleNav('/game-record')}
            />
          )}
          {isAuthenticated && isClubActive && (
            <NavItem
              label="이달의상"
              active={location.pathname.includes('/monthly-awards')}
              onClick={() => handleNav(`/clubs/${entityId}/monthly-awards`)}
            />
          )}
          {isAuthenticated && isClubActive && (
            <NavItem
              label="상황판"
              active={location.pathname.includes('/game-rooms')}
              onClick={() => handleNav(`/clubs/${entityId}/game-rooms`)}
            />
          )}
          {isAuthenticated && isClubActive && isEntityAdmin && (
            <NavItem
              label="관리"
              active={location.pathname.includes(`/clubs/${entityId}/manage`) || location.pathname.includes('/fees') || isActive('/admin/videos')}
              onClick={() => handleNav(`/clubs/${entityId}/manage`)}
            />
          )}

          {/* 조직 전용 메뉴 */}
          {isAuthenticated && isOrgActive && isEntityAdmin && (
            <NavItem
              label="관리"
              active={location.pathname.includes(`/orgs/${entityId}/manage`)}
              onClick={() => handleNav(`/orgs/${entityId}/manage`)}
            />
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

              {/* 통합 드롭다운 */}
              {totalEntities > 1 && (
                <select
                  value={entityValue}
                  onChange={handleEntitySwitch}
                  style={{
                    background: 'rgba(255,255,255,0.2)',
                    color: 'white',
                    border: '1px solid rgba(255,255,255,0.4)',
                    borderRadius: '4px',
                    padding: '4px 6px',
                    fontSize: '13px',
                    cursor: 'pointer',
                    maxWidth: '160px',
                  }}
                >
                  {approvedClubs.length > 0 && (
                    <optgroup label="클럽" style={{ color: '#333', background: 'white' }}>
                      {approvedClubs.map((c) => (
                        <option key={`club:${c.club_id}`} value={`club:${c.club_id}`} style={{ color: '#333', background: 'white' }}>
                          {c.club_name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {approvedOrgs.length > 0 && (
                    <optgroup label="단체" style={{ color: '#333', background: 'white' }}>
                      {approvedOrgs.map((o) => (
                        <option key={`org:${o.org_id}`} value={`org:${o.org_id}`} style={{ color: '#333', background: 'white' }}>
                          {o.org_name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              )}
              {totalEntities === 1 && activeEntity && (
                <span style={{
                  fontSize: '12px',
                  background: 'rgba(255,255,255,0.2)',
                  padding: '3px 8px',
                  borderRadius: '10px',
                  whiteSpace: 'nowrap',
                }}>
                  {activeEntity.name}
                </span>
              )}

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
          {/* 모바일 통합 엔티티 선택 */}
          {isAuthenticated && totalEntities > 1 && (
            <div style={{ padding: '6px 0 10px' }}>
              <select
                value={entityValue}
                onChange={handleEntitySwitch}
                style={{
                  width: '100%',
                  background: 'rgba(255,255,255,0.15)',
                  color: 'white',
                  border: '1px solid rgba(255,255,255,0.3)',
                  borderRadius: '6px',
                  padding: '8px 10px',
                  fontSize: '14px',
                  cursor: 'pointer',
                }}
              >
                {approvedClubs.length > 0 && (
                  <optgroup label="클럽" style={{ color: '#333', background: 'white' }}>
                    {approvedClubs.map((c) => (
                      <option key={`club:${c.club_id}`} value={`club:${c.club_id}`} style={{ color: '#333', background: 'white' }}>
                        {c.club_name}
                      </option>
                    ))}
                  </optgroup>
                )}
                {approvedOrgs.length > 0 && (
                  <optgroup label="단체" style={{ color: '#333', background: 'white' }}>
                    {approvedOrgs.map((o) => (
                      <option key={`org:${o.org_id}`} value={`org:${o.org_id}`} style={{ color: '#333', background: 'white' }}>
                        {o.org_name}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>
          )}

          <MobileNavItem label="홈으로" active={isActive('/')} onClick={() => handleNav('/')} />
          <MobileNavItem label="찾기" active={isActive('/search')} onClick={() => handleNav('/search')} />
          {isAuthenticated && (
            <MobileNavItem label="내클럽" active={isActive('/my-clubs')} onClick={() => handleNav('/my-clubs')} />
          )}
          <MobileNavItem label="랭킹" active={isActive('/ranking')} onClick={() => handleNav('/ranking')} />
          <MobileNavItem label="룰렛" active={isActive('/roulette')} onClick={() => handleNav('/roulette')} />

          {/* 클럽 전용 메뉴 */}
          {isAuthenticated && isClubActive && (
            <MobileNavItem
              label="월례회"
              active={isActive('/meetings') || location.pathname.startsWith('/meeting/')}
              onClick={() => handleNav('/meetings')}
            />
          )}
          {isAuthenticated && isClubActive && (
            <MobileNavItem
              label="출석"
              active={location.pathname.includes('/attendance')}
              onClick={() => handleNav(`/clubs/${entityId}/attendance`)}
            />
          )}
          {isAuthenticated && isClubActive && (
            <MobileNavItem
              label="게임기록"
              active={location.pathname === '/game-record' || location.pathname.includes('/cumulative-matches') || location.pathname.includes('/monthly-record')}
              onClick={() => handleNav('/game-record')}
            />
          )}
          {isAuthenticated && isClubActive && (
            <MobileNavItem
              label="이달의상"
              active={location.pathname.includes('/monthly-awards')}
              onClick={() => handleNav(`/clubs/${entityId}/monthly-awards`)}
            />
          )}
          {isAuthenticated && isClubActive && (
            <MobileNavItem
              label="상황판"
              active={location.pathname.includes('/game-rooms')}
              onClick={() => handleNav(`/clubs/${entityId}/game-rooms`)}
            />
          )}
          {isAuthenticated && isClubActive && isEntityAdmin && (
            <MobileNavItem
              label="관리"
              active={location.pathname.includes(`/clubs/${entityId}/manage`) || location.pathname.includes('/fees') || isActive('/admin/videos')}
              onClick={() => handleNav(`/clubs/${entityId}/manage`)}
            />
          )}

          {/* 조직 전용 메뉴 */}
          {isAuthenticated && isOrgActive && isEntityAdmin && (
            <MobileNavItem
              label="관리"
              active={location.pathname.includes(`/orgs/${entityId}/manage`)}
              onClick={() => handleNav(`/orgs/${entityId}/manage`)}
            />
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
                {totalEntities === 1 && activeEntity && (
                  <span style={{
                    fontSize: '12px',
                    background: 'rgba(255,255,255,0.2)',
                    padding: '2px 8px',
                    borderRadius: '10px',
                    marginLeft: '8px',
                  }}>
                    {activeEntity.name}
                  </span>
                )}
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
