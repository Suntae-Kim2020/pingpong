import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useState, useEffect, useRef } from 'react';
import { notificationsApi } from '../api/notifications';
import { triggerInstallPrompt, canShowInstall } from './InstallPrompt';

type MenuLink = { key: string; label: string; active: boolean; onClick: () => void };

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
  const [openMenu, setOpenMenu] = useState<string | null>(null);      // 데스크톱 드롭다운
  const [openSection, setOpenSection] = useState<string | null>(null); // 모바일 아코디언
  const [unreadCount, setUnreadCount] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const navRef = useRef<HTMLElement>(null);

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

  // 라우트 변경 시 열린 메뉴 닫기
  useEffect(() => { setOpenMenu(null); }, [location.pathname]);

  // 바깥 클릭 시 데스크톱 드롭다운 닫기
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setOpenMenu(null);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const isActive = (path: string) => location.pathname === path;
  const has = (frag: string) => location.pathname.includes(frag);

  const handleNav = (path: string) => {
    navigate(path);
    setMobileOpen(false);
    setOpenMenu(null);
  };

  const handleLogout = () => {
    logout();
    setMobileOpen(false);
    setOpenMenu(null);
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

  const brandText = activeEntity?.name || '탁구인 플랫폼';
  const totalEntities = approvedClubs.length + approvedOrgs.length;
  const entityValue = activeEntity ? `${activeEntity.type}:${activeEntity.id}` : '';

  // ===== 메뉴 그룹 정의 =====
  // 글로벌: 둘러보기
  const discoverItems: MenuLink[] = [
    { key: 'search', label: '클럽·단체 찾기', active: isActive('/search'), onClick: () => handleNav('/search') },
    { key: 'ranking', label: '전체 랭킹', active: isActive('/ranking'), onClick: () => handleNav('/ranking') },
    { key: 'roulette', label: '룰렛', active: isActive('/roulette'), onClick: () => handleNav('/roulette') },
  ];
  const discoverActive = discoverItems.some((i) => i.active);

  // 클럽: 경기
  const matchItems: MenuLink[] = [
    { key: 'meetings', label: '대회', active: isActive('/meetings') || location.pathname.startsWith('/meeting/'), onClick: () => handleNav('/meetings') },
    { key: 'record', label: '경기기록', active: isActive('/game-record') || has('/cumulative-matches') || has('/monthly-record'), onClick: () => handleNav('/game-record') },
    { key: 'rooms', label: '게임방', active: has('/game-rooms'), onClick: () => handleNav(`/clubs/${entityId}/game-rooms`) },
    { key: 'awards', label: '이달의 상', active: has('/monthly-awards'), onClick: () => handleNav(`/clubs/${entityId}/monthly-awards`) },
  ];
  const matchActive = matchItems.some((i) => i.active);

  // 클럽: 운영 (관리자)
  const clubOpsItems: MenuLink[] = [
    { key: 'manage', label: '클럽 관리', active: has(`/clubs/${entityId}/manage`), onClick: () => handleNav(`/clubs/${entityId}/manage`) },
    { key: 'fees', label: '회비', active: has('/fees'), onClick: () => handleNav(`/clubs/${entityId}/fees`) },
    { key: 'videos', label: '영상 관리', active: isActive('/admin/videos'), onClick: () => handleNav('/admin/videos') },
  ];
  const clubOpsActive = clubOpsItems.some((i) => i.active);

  // 조직: 운영 (관리자)
  const orgOpsItems: MenuLink[] = [
    { key: 'org-manage', label: '단체 관리', active: has(`/orgs/${entityId}/manage`), onClick: () => handleNav(`/orgs/${entityId}/manage`) },
    { key: 'org-fees', label: '회비', active: has(`/orgs/${entityId}/fees`), onClick: () => handleNav(`/orgs/${entityId}/fees`) },
  ];
  const orgOpsActive = orgOpsItems.some((i) => i.active);

  const showClubWorkspace = isAuthenticated && isClubActive;
  const showOrgWorkspace = isAuthenticated && isOrgActive && isEntityAdmin;

  // 엔티티 선택 드롭다운(공용)
  const renderEntitySelect = (full: boolean) => (
    <select
      value={entityValue}
      onChange={handleEntitySwitch}
      style={full ? {
        width: '100%', background: 'rgba(255,255,255,0.15)', color: 'white',
        border: '1px solid rgba(255,255,255,0.3)', borderRadius: '6px',
        padding: '8px 10px', fontSize: '14px', cursor: 'pointer',
      } : {
        background: 'rgba(255,255,255,0.2)', color: 'white',
        border: '1px solid rgba(255,255,255,0.4)', borderRadius: '4px',
        padding: '4px 6px', fontSize: '13px', cursor: 'pointer', maxWidth: '160px',
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
  );

  return (
    <nav ref={navRef} style={{
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
          style={{ fontWeight: 'bold', fontSize: '18px', cursor: 'pointer', whiteSpace: 'nowrap' }}
        >
          {brandText}
        </div>

        {/* Desktop Menu */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }} className="nav-desktop">
          {/* 글로벌 */}
          <NavItem label="홈" active={isActive('/')} onClick={() => handleNav('/')} />
          <NavDropdown id="discover" label="둘러보기" active={discoverActive} openMenu={openMenu} setOpenMenu={setOpenMenu} items={discoverItems} />
          {isAuthenticated && (
            <NavItem label="내 클럽" active={isActive('/my-clubs')} onClick={() => handleNav('/my-clubs')} />
          )}

          {/* 클럽 워크스페이스 */}
          {(showClubWorkspace || showOrgWorkspace) && (
            <div style={{ width: '1px', height: '24px', background: 'rgba(255,255,255,0.3)', margin: '0 6px' }} />
          )}
          {showClubWorkspace && (
            <>
              <NavDropdown id="match" label="경기" active={matchActive} openMenu={openMenu} setOpenMenu={setOpenMenu} items={matchItems} />
              <NavItem label="출석" active={has('/attendance')} onClick={() => handleNav(`/clubs/${entityId}/attendance`)} />
              {isEntityAdmin && (
                <NavDropdown id="club-ops" label="운영" active={clubOpsActive} openMenu={openMenu} setOpenMenu={setOpenMenu} items={clubOpsItems} />
              )}
            </>
          )}
          {/* 조직 워크스페이스 */}
          {showOrgWorkspace && (
            <NavDropdown id="org-ops" label="운영" active={orgOpsActive} openMenu={openMenu} setOpenMenu={setOpenMenu} items={orgOpsItems} />
          )}

          <div style={{ width: '1px', height: '24px', background: 'rgba(255,255,255,0.3)', margin: '0 8px' }} />

          {/* 계정 */}
          {isAuthenticated && (
            <button
              onClick={() => handleNav('/notifications')}
              style={{
                background: isActive('/notifications') ? 'rgba(255,255,255,0.15)' : 'transparent',
                border: 'none', color: 'white', cursor: 'pointer', padding: '6px 10px',
                borderRadius: '4px', fontSize: '16px', position: 'relative',
              }}
              title="알림"
            >
              &#128276;
              {unreadCount > 0 && (
                <span style={{
                  position: 'absolute', top: '2px', right: '2px',
                  background: '#f44336', color: 'white', fontSize: '10px',
                  borderRadius: '50%', width: '16px', height: '16px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700',
                }}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
          )}

          {isAuthenticated && user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {totalEntities > 1 && renderEntitySelect(false)}
              {totalEntities === 1 && activeEntity && (
                <span style={{
                  fontSize: '12px', background: 'rgba(255,255,255,0.2)',
                  padding: '3px 8px', borderRadius: '10px', whiteSpace: 'nowrap',
                }}>
                  {activeEntity.name}
                </span>
              )}

              {/* 아바타 드롭다운 */}
              <div style={{ position: 'relative' }}>
                <div
                  onClick={() => setOpenMenu(openMenu === 'account' ? null : 'account')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer',
                    padding: '4px 6px', borderRadius: '20px',
                    background: openMenu === 'account' ? 'rgba(255,255,255,0.15)' : 'transparent',
                  }}
                  title="내 계정"
                >
                  {user.profile_image ? (
                    <img src={user.profile_image} alt={user.name}
                      style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover' }} />
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
                  <span style={{ fontSize: '10px' }}>&#9662;</span>
                </div>
                {openMenu === 'account' && (
                  <DropdownPanel align="right">
                    <DropdownItem label="내 프로필" active={isActive('/profile')} onClick={() => handleNav('/profile')} />
                    {user?.role === 'super_admin' && (
                      <DropdownItem label="관리자 콘솔" active={isActive('/admin/console')} onClick={() => handleNav('/admin/console')} />
                    )}
                    {canShowInstall() && (
                      <DropdownItem label="앱 설치" onClick={() => { setOpenMenu(null); triggerInstallPrompt(true); }} />
                    )}
                    <div style={{ height: '1px', background: '#eee', margin: '4px 0' }} />
                    <DropdownItem label="로그아웃" onClick={handleLogout} />
                  </DropdownPanel>
                )}
              </div>
            </div>
          ) : (
            <>
              <NavItem label="로그인" onClick={() => handleNav('/login')} />
              <NavItem label="회원가입" onClick={() => handleNav('/signup')} highlight />
            </>
          )}
        </div>

        {/* Mobile Hamburger */}
        <button
          className="nav-mobile-toggle"
          onClick={() => setMobileOpen(!mobileOpen)}
          style={{ display: 'none', background: 'none', border: 'none', color: 'white', fontSize: '24px', cursor: 'pointer', padding: '4px' }}
        >
          {mobileOpen ? '✕' : '☰'}
        </button>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileOpen && (
        <div className="nav-mobile-menu" style={{ background: '#1565c0', padding: '8px 20px 12px' }}>
          {isAuthenticated && totalEntities > 1 && (
            <div style={{ padding: '6px 0 10px' }}>{renderEntitySelect(true)}</div>
          )}

          {/* 글로벌 */}
          <MobileNavItem label="홈" active={isActive('/')} onClick={() => handleNav('/')} />
          <MobileSection title="둘러보기" open={openSection === 'discover'} active={discoverActive}
            onToggle={() => setOpenSection(openSection === 'discover' ? null : 'discover')} items={discoverItems} />
          {isAuthenticated && (
            <MobileNavItem label="내 클럽" active={isActive('/my-clubs')} onClick={() => handleNav('/my-clubs')} />
          )}

          {/* 클럽 워크스페이스 */}
          {showClubWorkspace && (
            <>
              <div style={{ height: '1px', background: 'rgba(255,255,255,0.2)', margin: '6px 0' }} />
              <MobileSection title="경기" open={openSection === 'match'} active={matchActive}
                onToggle={() => setOpenSection(openSection === 'match' ? null : 'match')} items={matchItems} />
              <MobileNavItem label="출석" active={has('/attendance')} onClick={() => handleNav(`/clubs/${entityId}/attendance`)} />
              {isEntityAdmin && (
                <MobileSection title="운영" open={openSection === 'club-ops'} active={clubOpsActive}
                  onToggle={() => setOpenSection(openSection === 'club-ops' ? null : 'club-ops')} items={clubOpsItems} />
              )}
            </>
          )}
          {showOrgWorkspace && (
            <>
              <div style={{ height: '1px', background: 'rgba(255,255,255,0.2)', margin: '6px 0' }} />
              <MobileSection title="운영" open={openSection === 'org-ops'} active={orgOpsActive}
                onToggle={() => setOpenSection(openSection === 'org-ops' ? null : 'org-ops')} items={orgOpsItems} />
            </>
          )}

          {/* 계정 */}
          <div style={{ height: '1px', background: 'rgba(255,255,255,0.2)', margin: '6px 0' }} />
          {isAuthenticated && user ? (
            <>
              <MobileNavItem label={`알림${unreadCount > 0 ? ` (${unreadCount})` : ''}`} active={isActive('/notifications')} onClick={() => handleNav('/notifications')} />
              <div style={{ padding: '8px 8px 4px', fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>
                {user.profile_image && (
                  <img src={user.profile_image} alt={user.name}
                    style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover', marginRight: '8px', verticalAlign: 'middle' }} />
                )}
                {user.nickname || user.name}
                {totalEntities === 1 && activeEntity && (
                  <span style={{ fontSize: '12px', background: 'rgba(255,255,255,0.2)', padding: '2px 8px', borderRadius: '10px', marginLeft: '8px' }}>
                    {activeEntity.name}
                  </span>
                )}
              </div>
              <MobileNavItem label="내 프로필" active={isActive('/profile')} onClick={() => handleNav('/profile')} />
              {user?.role === 'super_admin' && (
                <MobileNavItem label="관리자 콘솔" active={isActive('/admin/console')} onClick={() => handleNav('/admin/console')} />
              )}
              {canShowInstall() && (
                <MobileNavItem label="📱 홈 화면에 추가 (앱 설치)" onClick={() => { setMobileOpen(false); triggerInstallPrompt(true); }} />
              )}
              <MobileNavItem label="로그아웃" onClick={handleLogout} />
            </>
          ) : (
            <>
              <MobileNavItem label="로그인" onClick={() => handleNav('/login')} />
              <MobileNavItem label="회원가입" onClick={() => handleNav('/signup')} />
            </>
          )}
        </div>
      )}
    </nav>
  );
}

// ===== 데스크톱 단일 항목 =====
function NavItem({ label, active, onClick, highlight }: {
  label: string; active?: boolean; onClick: () => void; highlight?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        background: highlight ? 'rgba(255,255,255,0.2)' : (active ? 'rgba(255,255,255,0.15)' : 'transparent'),
        border: highlight ? '1px solid rgba(255,255,255,0.5)' : 'none',
        color: 'white', padding: '6px 14px', borderRadius: '4px', cursor: 'pointer',
        fontSize: '14px', fontWeight: active ? '600' : '400', whiteSpace: 'nowrap', transition: 'background 0.15s',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.2)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = highlight ? 'rgba(255,255,255,0.2)' : (active ? 'rgba(255,255,255,0.15)' : 'transparent'))}
    >
      {label}
    </button>
  );
}

// ===== 데스크톱 드롭다운 =====
function NavDropdown({ id, label, active, openMenu, setOpenMenu, items }: {
  id: string; label: string; active?: boolean;
  openMenu: string | null; setOpenMenu: (v: string | null) => void; items: MenuLink[];
}) {
  const open = openMenu === id;
  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpenMenu(open ? null : id)}
        style={{
          background: (active || open) ? 'rgba(255,255,255,0.15)' : 'transparent',
          border: 'none', color: 'white', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer',
          fontSize: '14px', fontWeight: active ? '600' : '400', whiteSpace: 'nowrap',
          display: 'flex', alignItems: 'center', gap: '4px',
        }}
      >
        {label}<span style={{ fontSize: '10px' }}>&#9662;</span>
      </button>
      {open && (
        <DropdownPanel>
          {items.map((it) => (
            <DropdownItem key={it.key} label={it.label} active={it.active} onClick={it.onClick} />
          ))}
        </DropdownPanel>
      )}
    </div>
  );
}

function DropdownPanel({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <div style={{
      position: 'absolute', top: 'calc(100% + 6px)', [align]: 0,
      background: 'white', borderRadius: '8px', boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
      padding: '6px', minWidth: '170px', zIndex: 1100,
    } as React.CSSProperties}>
      {children}
    </div>
  );
}

function DropdownItem({ label, active, onClick }: { label: string; active?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'block', width: '100%', textAlign: 'left',
        background: active ? '#e3f0fb' : 'transparent', border: 'none',
        color: active ? '#1565c0' : '#333', padding: '9px 12px', borderRadius: '6px',
        cursor: 'pointer', fontSize: '14px', fontWeight: active ? '600' : '400', whiteSpace: 'nowrap',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = active ? '#e3f0fb' : '#f3f4f6')}
      onMouseLeave={(e) => (e.currentTarget.style.background = active ? '#e3f0fb' : 'transparent')}
    >
      {label}
    </button>
  );
}

// ===== 모바일 단일 항목 =====
function MobileNavItem({ label, active, onClick }: { label: string; active?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'block', width: '100%', textAlign: 'left',
        background: active ? 'rgba(255,255,255,0.1)' : 'transparent', border: 'none',
        color: 'white', padding: '10px 8px', borderRadius: '4px', cursor: 'pointer',
        fontSize: '15px', fontWeight: active ? '600' : '400',
      }}
    >
      {label}
    </button>
  );
}

// ===== 모바일 아코디언 섹션 =====
function MobileSection({ title, open, active, onToggle, items }: {
  title: string; open: boolean; active?: boolean; onToggle: () => void; items: MenuLink[];
}) {
  return (
    <div>
      <button
        onClick={onToggle}
        style={{
          display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center',
          background: active ? 'rgba(255,255,255,0.1)' : 'transparent', border: 'none',
          color: 'white', padding: '10px 8px', borderRadius: '4px', cursor: 'pointer',
          fontSize: '15px', fontWeight: active ? '600' : '400',
        }}
      >
        <span>{title}</span>
        <span style={{ fontSize: '11px', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>&#9662;</span>
      </button>
      {open && (
        <div style={{ paddingLeft: '12px', borderLeft: '2px solid rgba(255,255,255,0.25)', marginLeft: '8px' }}>
          {items.map((it) => (
            <button
              key={it.key}
              onClick={it.onClick}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                background: it.active ? 'rgba(255,255,255,0.12)' : 'transparent', border: 'none',
                color: 'white', padding: '9px 8px', borderRadius: '4px', cursor: 'pointer',
                fontSize: '14px', fontWeight: it.active ? '600' : '400',
              }}
            >
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
