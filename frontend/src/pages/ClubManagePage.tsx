import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { clubsApi, Club, ClubInvite } from '../api/clubs';
import { membersApi } from '../api/meetings';
import { orgsApi, Organization } from '../api/orgs';
import { notificationsApi } from '../api/notifications';
import { api } from '../api/client';
import { profileApi } from '../api/profile';
import type { MembershipWithUser, Member, PlayStyle, PimpleType } from '../types';
import AddressSearch from '../components/AddressSearch';

type Tab = 'pending' | 'members' | 'invites' | 'announcements' | 'affiliation';

const ROLE_LABELS: Record<string, string> = {
  leader: '리더',
  admin: '관리자',
  member: '회원',
};

export default function ClubManagePage() {
  const { id } = useParams<{ id: string }>();
  const clubId = parseInt(id!);
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [club, setClub] = useState<Club | null>(null);
  const [tab, setTab] = useState<Tab>('pending');
  const [pending, setPending] = useState<MembershipWithUser[]>([]);
  const [members, setMembers] = useState<MembershipWithUser[]>([]);
  const [invites, setInvites] = useState<ClubInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [editMember, setEditMember] = useState<MembershipWithUser | null>(null);
  const [editRosterMember, setEditRosterMember] = useState<Member | null>(null);
  const [roster, setRoster] = useState<Member[]>([]);
  const [editAddress, setEditAddress] = useState('');
  const [editingAddress, setEditingAddress] = useState(false);
  const [addressSaving, setAddressSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) { navigate('/login'); return; }
    loadClub();
  }, [isAuthenticated, authLoading, clubId]);

  useEffect(() => {
    if (!club) return;
    if (tab === 'pending') loadPending();
    else if (tab === 'members') { loadMembers(); loadRoster(); }
    else if (tab === 'invites') loadInvites();
  }, [tab, club]);

  const loadClub = async () => {
    try {
      const data = await clubsApi.getById(clubId);
      setClub(data);
    } catch {
      setError('클럽 정보를 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  };

  const loadPending = useCallback(async () => {
    try {
      const data = await clubsApi.getMembers(clubId, 'pending');
      setPending(data);
    } catch (err: any) {
      setError(err.message);
    }
  }, [clubId]);

  const loadMembers = useCallback(async () => {
    try {
      const data = await clubsApi.getMembers(clubId, 'approved');
      setMembers(data);
    } catch (err: any) {
      setError(err.message);
    }
  }, [clubId]);

  const loadRoster = useCallback(async () => {
    try {
      const data = await membersApi.getAll(clubId);
      setRoster(data.filter(m => m.is_active).sort((a, b) => a.name.localeCompare(b.name, 'ko')));
    } catch (err: any) {
      setError(err.message);
    }
  }, [clubId]);

  const loadInvites = useCallback(async () => {
    try {
      const data = await clubsApi.getInvites(clubId);
      setInvites(data);
    } catch (err: any) {
      setError(err.message);
    }
  }, [clubId]);

  const handleCreateInvite = async () => {
    try {
      setError('');
      await clubsApi.createInvite(clubId, { expiresInHours: 168 });
      setSuccess('초대 링크가 생성되었습니다.');
      loadInvites();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || '생성에 실패했습니다.');
    }
  };

  const handleDeactivateInvite = async (inviteId: number) => {
    try {
      setError('');
      await clubsApi.deactivateInvite(clubId, inviteId);
      setSuccess('초대 링크가 비활성화되었습니다.');
      loadInvites();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const copyInviteLink = (token: string) => {
    const link = `${window.location.origin}/clubs/invite/${token}`;
    navigator.clipboard.writeText(link).then(() => {
      setSuccess('링크가 복사되었습니다!');
      setTimeout(() => setSuccess(''), 2000);
    });
  };

  const handleRoleChange = async (membershipId: number, role: 'admin' | 'member') => {
    try {
      setActionLoading(membershipId);
      setError('');
      await clubsApi.updateMemberRole(clubId, membershipId, role);
      setSuccess(role === 'admin' ? '관리자로 지정되었습니다.' : '관리자 권한이 해제되었습니다.');
      loadMembers();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || '역할 변경에 실패했습니다.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleAddressSave = async () => {
    if (!editAddress.trim()) { setError('주소를 입력하세요.'); return; }
    try {
      setAddressSaving(true);
      setError('');
      await clubsApi.update(clubId, { address: editAddress });
      setClub((prev) => prev ? { ...prev, address: editAddress } : prev);
      setEditingAddress(false);
      setSuccess('주소가 변경되었습니다.');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || '주소 변경에 실패했습니다.');
    } finally {
      setAddressSaving(false);
    }
  };

  const handleAction = async (membershipId: number, status: 'approved' | 'rejected' | 'banned') => {
    try {
      setActionLoading(membershipId);
      setError('');
      await clubsApi.updateMemberStatus(clubId, membershipId, status);
      setSuccess(status === 'approved' ? '승인되었습니다.' : status === 'rejected' ? '거부되었습니다.' : '추방되었습니다.');
      if (tab === 'pending') loadPending();
      else loadMembers();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || '처리에 실패했습니다.');
    } finally {
      setActionLoading(null);
    }
  };

  // 비활동 회원 → 활동 재시작
  // member_id가 있으면 member.is_active=true로 복원, 없으면 createAndLinkMember 호출
  const handleReactivate = async (membership: MembershipWithUser) => {
    try {
      setActionLoading(membership.id);
      setError('');
      if (membership.member_id) {
        await api.put(`/members/${membership.member_id}`, { is_active: true });
      } else {
        await clubsApi.createAndLinkMember(clubId, membership.id);
      }
      setSuccess('활동이 재개되었습니다.');
      loadMembers();
      loadRoster();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || '활동 재시작에 실패했습니다.');
    } finally {
      setActionLoading(null);
    }
  };

  if (authLoading || loading) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>로딩 중...</div>;
  }

  if (!club) {
    return <div style={{ padding: '40px', textAlign: 'center', color: '#d32f2f' }}>클럽을 찾을 수 없습니다.</div>;
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'pending', label: `가입 신청 (${pending.length})` },
    { key: 'members', label: '회원 목록' },
    { key: 'invites', label: '초대 링크' },
    { key: 'announcements', label: '공지' },
    { key: 'affiliation', label: '소속 단체' },
  ];

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
        <button onClick={() => navigate('/my-clubs')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px' }}>
          &larr;
        </button>
        <h1 style={{ fontSize: '22px', margin: 0 }}>{club.name} 관리</h1>
      </div>

      {/* 관리 바로가기 */}
      <div style={{
        display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap',
      }}>
        <button
          onClick={() => navigate(`/clubs/${clubId}/fees`)}
          style={{
            background: '#fff3e0', color: '#e65100', border: '1px solid #ffcc80',
            padding: '8px 18px', borderRadius: '8px', cursor: 'pointer',
            fontSize: '14px', fontWeight: '600',
          }}
        >
          재무
        </button>
        <button
          onClick={() => navigate('/admin/videos')}
          style={{
            background: '#e8f5e9', color: '#2e7d32', border: '1px solid #a5d6a7',
            padding: '8px 18px', borderRadius: '8px', cursor: 'pointer',
            fontSize: '14px', fontWeight: '600',
          }}
        >
          영상관리
        </button>
      </div>

      {/* 주소 정보 */}
      <div style={{ background: '#f8f9fa', border: '1px solid #e0e0e0', borderRadius: '10px', padding: '14px 18px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: editingAddress ? '12px' : 0 }}>
          <div>
            <span style={{ fontWeight: '600', fontSize: '14px', color: '#333' }}>활동 장소: </span>
            <span style={{ fontSize: '14px', color: '#555' }}>{club.address || '미설정'}</span>
          </div>
          {!editingAddress && (
            <button
              onClick={() => { setEditAddress(club.address || ''); setEditingAddress(true); }}
              style={{
                background: '#1976d2', color: 'white', border: 'none',
                padding: '6px 14px', borderRadius: '6px', cursor: 'pointer',
                fontSize: '13px', fontWeight: '500',
              }}
            >
              주소 변경
            </button>
          )}
        </div>
        {editingAddress && (
          <div>
            <AddressSearch
              value={editAddress}
              onChange={setEditAddress}
              placeholder="새 주소를 검색하세요"
              detailPlaceholder="상세주소 (예: 3층 탁구장)"
            />
            <div style={{ display: 'flex', gap: '8px', marginTop: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setEditingAddress(false)}
                style={{
                  background: '#e0e0e0', color: '#333', border: 'none',
                  padding: '6px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px',
                }}
              >
                취소
              </button>
              <button
                onClick={handleAddressSave}
                disabled={addressSaving}
                style={{
                  background: '#1976d2', color: 'white', border: 'none',
                  padding: '6px 14px', borderRadius: '6px', cursor: 'pointer',
                  fontSize: '13px', fontWeight: '500', opacity: addressSaving ? 0.6 : 1,
                }}
              >
                {addressSaving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        )}
      </div>

      {error && <div style={{ padding: '10px 16px', background: '#fff3f3', color: '#d32f2f', borderRadius: '8px', marginBottom: '12px' }}>{error}</div>}
      {success && <div style={{ padding: '10px 16px', background: '#e8f5e9', color: '#2e7d32', borderRadius: '8px', marginBottom: '12px' }}>{success}</div>}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', borderBottom: '2px solid #e0e0e0', marginBottom: '20px' }}>
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '10px 20px', border: 'none', cursor: 'pointer',
              background: tab === t.key ? '#1976d2' : 'transparent',
              color: tab === t.key ? 'white' : '#666',
              borderRadius: '8px 8px 0 0', fontWeight: tab === t.key ? '600' : '400', fontSize: '14px',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Pending Tab */}
      {tab === 'pending' && (
        <div>
          {pending.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>대기 중인 가입 신청이 없습니다.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {pending.map((m) => (
                <MemberCard key={m.id} member={m} onAction={handleAction} actionLoading={actionLoading} showApproveReject />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Members Tab */}
      {tab === 'members' && (
        <div>
          {/* 회원 명부 (member 테이블) */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <div style={{ fontSize: '14px', color: '#666' }}>
              전체 {roster.length}명
            </div>
            <button
              onClick={async () => {
                if (!window.confirm('동일 이름의 중복 회원을 정리하시겠습니까?\n\n경기기록, 출석 등 모든 데이터가 하나로 통합됩니다.')) return;
                try {
                  const res = await clubsApi.deduplicateMembers(clubId);
                  if (res.removedCount > 0) {
                    setSuccess(`중복 회원 ${res.removedCount}건이 정리되었습니다.`);
                    setTimeout(() => setSuccess(''), 3000);
                    loadRoster();
                  } else {
                    setSuccess('중복 회원이 없습니다.');
                    setTimeout(() => setSuccess(''), 3000);
                  }
                } catch (err: any) {
                  setError(err.message || '중복 정리에 실패했습니다.');
                }
              }}
              style={{
                background: '#ff9800', color: 'white', border: 'none',
                padding: '6px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px',
              }}
            >
              중복 회원 정리
            </button>
          </div>
          {roster.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>등록된 회원이 없습니다.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {roster.map((m) => (
                <div key={m.id} className="member-card" style={{
                  border: '1px solid #e0e0e0', borderRadius: '10px', padding: '12px 16px',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white',
                }}>
                  <div className="member-card-info" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {m.profile_image ? (
                      <img src={m.profile_image} alt="" style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{
                        width: '40px', height: '40px', borderRadius: '50%', background: '#e0e0e0',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999', fontSize: '16px',
                      }}>
                        {m.name.charAt(0)}
                      </div>
                    )}
                    <div>
                      <div style={{ fontWeight: '600', fontSize: '15px' }}>
                        {m.name}
                        {m.role === 'leader' && (
                          <span style={{ fontSize: '11px', color: '#fff', background: '#d32f2f', padding: '1px 6px', borderRadius: '4px', marginLeft: '6px', fontWeight: '500' }}>리더</span>
                        )}
                        {m.role === 'admin' && (
                          <span style={{ fontSize: '11px', color: '#fff', background: '#1976d2', padding: '1px 6px', borderRadius: '4px', marginLeft: '6px', fontWeight: '500' }}>관리자</span>
                        )}
                        <span style={{ fontSize: '12px', color: '#999', fontWeight: '400', marginLeft: '8px' }}>
                          {m.gender === 'M' ? '남' : '여'}{m.birth_year ? ` · ${m.birth_year}년생` : ''}
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', color: '#888' }}>
                        {m.local_busu ? `지역 ${m.local_busu}부` : ''}{m.open_busu ? ` · 오픈 ${m.open_busu}부` : ''}
                        {m.play_style && m.play_style !== '올라운드' ? ` · ${m.play_style}` : ''}
                        {m.pimple_type === 'short' ? ' · 숏핌플' : m.pimple_type === 'long' ? ' · 롱핌플' : ''}
                      </div>
                    </div>
                  </div>
                  <div className="member-card-actions" style={{ display: 'flex', gap: '6px' }}>
                    {m.role !== 'leader' && (
                      <button
                        onClick={async () => {
                          const newRole = m.role === 'admin' ? 'member' : 'admin';
                          try {
                            await api.put(`/members/${m.id}`, { role: newRole });
                            loadRoster();
                          } catch (err: any) {
                            setError(err.message || '역할 변경에 실패했습니다.');
                          }
                        }}
                        style={{
                          background: m.role === 'admin' ? '#ff9800' : '#4caf50', color: 'white', border: 'none',
                          padding: '6px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px',
                        }}
                      >
                        {m.role === 'admin' ? '관리자 해제' : '관리자 지정'}
                      </button>
                    )}
                    <button
                      onClick={() => setEditRosterMember(m)}
                      style={{
                        background: '#1976d2', color: 'white', border: 'none',
                        padding: '6px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px',
                      }}
                    >
                      수정
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 비활동 회원 (앱 가입돼 있지만 명부 활동 안 함 또는 연결 안 됨) */}
          {(() => {
            const rosterMemberIds = new Set(roster.map(r => r.id));
            const unlinkedMembers = members.filter(m => !m.member_id || !rosterMemberIds.has(m.member_id));
            return unlinkedMembers.length > 0 ? (
              <div style={{ marginTop: '24px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: '600', color: '#666', marginBottom: '10px' }}>비활동 회원 ({unlinkedMembers.length}명)</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {unlinkedMembers.map((m) => (
                    <MemberCard
                      key={m.id}
                      member={m}
                      onAction={handleAction}
                      actionLoading={actionLoading}
                      showBan
                      onRoleChange={handleRoleChange}
                      onReactivate={() => handleReactivate(m)}
                    />
                  ))}
                </div>
              </div>
            ) : null;
          })()}
        </div>
      )}

      {/* Member Edit Modal (from club_membership) */}
      {editMember && (
        <MemberEditModal
          membership={editMember}
          onClose={() => setEditMember(null)}
          onSaved={() => {
            setEditMember(null);
            loadMembers();
            setSuccess('회원 정보가 수정되었습니다.');
            setTimeout(() => setSuccess(''), 3000);
          }}
        />
      )}

      {/* Roster Member Edit Modal (from member table) */}
      {editRosterMember && (
        <RosterMemberEditModal
          member={editRosterMember}
          onClose={() => setEditRosterMember(null)}
          onSaved={() => {
            setEditRosterMember(null);
            loadRoster();
            setSuccess('회원 정보가 수정되었습니다.');
            setTimeout(() => setSuccess(''), 3000);
          }}
        />
      )}

      {/* Invites Tab */}
      {tab === 'invites' && (
        <div>
          <div style={{ marginBottom: '16px' }}>
            <button
              onClick={handleCreateInvite}
              style={{
                background: '#1976d2', color: 'white', border: 'none',
                padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontSize: '14px',
              }}
            >
              + 새 초대 링크 생성
            </button>
          </div>
          {invites.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>초대 링크가 없습니다.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {invites.map((inv) => {
                const expired = new Date(inv.expires_at) < new Date();
                const maxReached = inv.max_uses !== null && inv.use_count >= inv.max_uses;
                const inactive = !inv.is_active || expired || maxReached;

                return (
                  <div key={inv.id} style={{
                    border: '1px solid #e0e0e0', borderRadius: '10px', padding: '14px 18px',
                    background: inactive ? '#f5f5f5' : 'white', opacity: inactive ? 0.7 : 1,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontFamily: 'monospace', fontSize: '13px', color: '#555', marginBottom: '6px' }}>
                          {inv.token.substring(0, 16)}...
                        </div>
                        <div style={{ fontSize: '12px', color: '#999' }}>
                          사용: {inv.use_count}{inv.max_uses ? `/${inv.max_uses}` : ''}회
                          &nbsp;&middot;&nbsp;
                          만료: {new Date(inv.expires_at).toLocaleString('ko-KR')}
                          {inactive && <span style={{ color: '#f44336', marginLeft: '8px' }}>(비활성)</span>}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {!inactive && (
                          <>
                            <button
                              onClick={() => copyInviteLink(inv.token)}
                              style={{
                                background: '#4caf50', color: 'white', border: 'none',
                                padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px',
                              }}
                            >
                              복사
                            </button>
                            <button
                              onClick={() => handleDeactivateInvite(inv.id)}
                              style={{
                                background: '#ff5722', color: 'white', border: 'none',
                                padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px',
                              }}
                            >
                              비활성화
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
      {/* Announcements Tab */}
      {tab === 'announcements' && (
        <AnnouncementSection clubId={clubId} />
      )}

      {/* Affiliation Tab */}
      {tab === 'affiliation' && club && (
        <AffiliationSection clubId={clubId} club={club} />
      )}
    </div>
  );
}

function AffiliationSection({ clubId, club }: { clubId: number; club: Club }) {
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchResults, setSearchResults] = useState<Organization[]>([]);
  const [searching, setSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [affiliationRequests, setAffiliationRequests] = useState<any[]>([]);
  const [memberRegistrations, setMemberRegistrations] = useState<any[]>([]);
  const [clubMembers, setClubMembers] = useState<MembershipWithUser[]>([]);
  const [selectedMember, setSelectedMember] = useState<number | null>(null);
  const [requestType, setRequestType] = useState<'new_registration' | 'transfer'>('new_registration');
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadAffiliationRequests();
    if (club.org_id) {
      loadMemberRegistrations();
      loadClubMembers();
    }
  }, [clubId, club.org_id]);

  const loadAffiliationRequests = async () => {
    try {
      const data = await clubsApi.getAffiliationRequest(clubId);
      setAffiliationRequests(data);
    } catch {}
  };

  const loadMemberRegistrations = async () => {
    try {
      const data = await clubsApi.getMemberRegistrations(clubId);
      setMemberRegistrations(data);
    } catch {}
  };

  const loadClubMembers = async () => {
    try {
      const data = await clubsApi.getMembers(clubId, 'approved');
      setClubMembers(data);
    } catch {}
  };

  const handleSearch = async () => {
    if (!searchKeyword.trim()) return;
    try {
      setSearching(true);
      setError('');
      const data = await orgsApi.search({ keyword: searchKeyword.trim() });
      setSearchResults(data);
    } catch (err: any) {
      setError(err.message || '검색에 실패했습니다.');
    } finally {
      setSearching(false);
    }
  };

  const handleAffiliationRequest = async (orgId: number) => {
    try {
      setActionLoading(true);
      setError('');
      await clubsApi.createAffiliationRequest(clubId, orgId);
      setSuccess('소속 신청이 완료되었습니다.');
      setShowSearch(false);
      setSearchResults([]);
      setSearchKeyword('');
      loadAffiliationRequests();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || '신청에 실패했습니다.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleMemberRegistration = async () => {
    if (!selectedMember) { setError('회원을 선택해주세요.'); return; }
    try {
      setActionLoading(true);
      setError('');
      await clubsApi.createMemberRegistration(clubId, {
        clubMembershipId: selectedMember,
        requestType,
      });
      setSuccess('회원 등록 신청이 완료되었습니다.');
      setSelectedMember(null);
      loadMemberRegistrations();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || '신청에 실패했습니다.');
    } finally {
      setActionLoading(false);
    }
  };

  const STATUS_LABELS: Record<string, { label: string; color: string }> = {
    pending: { label: '대기중', color: '#ff9800' },
    approved: { label: '승인', color: '#4caf50' },
    rejected: { label: '거부', color: '#f44336' },
  };

  const REQUEST_TYPE_LABELS: Record<string, string> = {
    new_registration: '신규등록',
    transfer: '소속변경',
  };

  return (
    <div style={{ maxWidth: '700px' }}>
      {error && <div style={{ padding: '8px 12px', background: '#fff3f3', color: '#d32f2f', borderRadius: '6px', marginBottom: '10px', fontSize: '13px' }}>{error}</div>}
      {success && <div style={{ padding: '8px 12px', background: '#e8f5e9', color: '#2e7d32', borderRadius: '6px', marginBottom: '10px', fontSize: '13px' }}>{success}</div>}

      {/* 현재 소속 표시 */}
      <div style={{ background: '#f8f9fa', border: '1px solid #e0e0e0', borderRadius: '10px', padding: '16px 20px', marginBottom: '20px' }}>
        <div style={{ fontSize: '14px', fontWeight: '600', color: '#333', marginBottom: '4px' }}>소속 단체</div>
        {club.org_id && club.org_name ? (
          <div style={{ fontSize: '16px', color: '#1976d2', fontWeight: '600' }}>{club.org_name}</div>
        ) : (
          <div style={{ fontSize: '14px', color: '#999' }}>소속 단체 없음</div>
        )}
      </div>

      {/* 소속이 없을 때: 소속 신청 */}
      {!club.org_id && (
        <div style={{ marginBottom: '24px' }}>
          {!showSearch ? (
            <button
              onClick={() => setShowSearch(true)}
              style={{
                background: '#1976d2', color: 'white', border: 'none',
                padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontSize: '14px',
              }}
            >
              소속 신청하기
            </button>
          ) : (
            <div style={{ border: '1px solid #e0e0e0', borderRadius: '10px', padding: '16px' }}>
              <h4 style={{ margin: '0 0 12px', fontSize: '15px' }}>단체 검색</h4>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                <input
                  type="text"
                  placeholder="단체명을 입력하세요"
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  style={{
                    flex: 1, padding: '8px 12px', border: '1px solid #ddd', borderRadius: '6px',
                    fontSize: '14px',
                  }}
                />
                <button
                  onClick={handleSearch}
                  disabled={searching}
                  style={{
                    background: '#1976d2', color: 'white', border: 'none',
                    padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '14px',
                  }}
                >
                  {searching ? '검색중...' : '검색'}
                </button>
                <button
                  onClick={() => { setShowSearch(false); setSearchResults([]); setSearchKeyword(''); }}
                  style={{
                    background: '#e0e0e0', color: '#333', border: 'none',
                    padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '14px',
                  }}
                >
                  취소
                </button>
              </div>
              {searchResults.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {searchResults.map((org) => (
                    <div key={org.id} style={{
                      border: '1px solid #e0e0e0', borderRadius: '8px', padding: '12px 16px',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    }}>
                      <div>
                        <div style={{ fontWeight: '600', fontSize: '14px' }}>{org.name}</div>
                        <div style={{ fontSize: '12px', color: '#999' }}>
                          {org.region_name || ''} &middot; 회원 {org.member_count}명
                        </div>
                      </div>
                      <button
                        onClick={() => handleAffiliationRequest(org.id)}
                        disabled={actionLoading}
                        style={{
                          background: '#4caf50', color: 'white', border: 'none',
                          padding: '6px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px',
                          opacity: actionLoading ? 0.6 : 1,
                        }}
                      >
                        소속 신청
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 소속 신청 내역 */}
      {affiliationRequests.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <h4 style={{ margin: '0 0 12px', fontSize: '15px' }}>소속 신청 내역</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {affiliationRequests.map((req: any) => (
              <div key={req.id} style={{
                border: '1px solid #e0e0e0', borderRadius: '8px', padding: '12px 16px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <div>
                  <div style={{ fontWeight: '600', fontSize: '14px' }}>{req.org_name}</div>
                  <div style={{ fontSize: '12px', color: '#999' }}>
                    {new Date(req.created_at).toLocaleDateString('ko-KR')}
                  </div>
                </div>
                <span style={{
                  padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: '600',
                  background: STATUS_LABELS[req.status]?.color + '20',
                  color: STATUS_LABELS[req.status]?.color,
                }}>
                  {STATUS_LABELS[req.status]?.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 소속이 있을 때: 회원 등록 신청 */}
      {club.org_id && (
        <>
          <div style={{ marginBottom: '24px' }}>
            <h4 style={{ margin: '0 0 12px', fontSize: '15px' }}>회원 등록 신청</h4>
            <div style={{ border: '1px solid #e0e0e0', borderRadius: '10px', padding: '16px' }}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#333', marginBottom: '6px' }}>회원 선택</label>
                <select
                  value={selectedMember ?? ''}
                  onChange={(e) => setSelectedMember(e.target.value ? parseInt(e.target.value) : null)}
                  style={{
                    width: '100%', padding: '8px 12px', border: '1px solid #ddd', borderRadius: '6px',
                    fontSize: '14px', boxSizing: 'border-box',
                  }}
                >
                  <option value="">회원을 선택하세요</option>
                  {clubMembers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.user_nickname || m.user_name} {m.display_name ? `(${m.display_name})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#333', marginBottom: '6px' }}>신청 유형</label>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '14px' }}>
                    <input
                      type="radio"
                      name="reg-type"
                      checked={requestType === 'new_registration'}
                      onChange={() => setRequestType('new_registration')}
                    />
                    신규등록
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '14px' }}>
                    <input
                      type="radio"
                      name="reg-type"
                      checked={requestType === 'transfer'}
                      onChange={() => setRequestType('transfer')}
                    />
                    소속변경
                  </label>
                </div>
              </div>
              <button
                onClick={handleMemberRegistration}
                disabled={actionLoading || !selectedMember}
                style={{
                  background: '#1976d2', color: 'white', border: 'none',
                  padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontSize: '14px',
                  opacity: actionLoading || !selectedMember ? 0.6 : 1,
                }}
              >
                {actionLoading ? '신청 중...' : '등록 신청'}
              </button>
            </div>
          </div>

          {/* 회원 등록 신청 내역 */}
          {memberRegistrations.length > 0 && (
            <div>
              <h4 style={{ margin: '0 0 12px', fontSize: '15px' }}>회원 등록 신청 내역</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {memberRegistrations.map((req: any) => (
                  <div key={req.id} style={{
                    border: '1px solid #e0e0e0', borderRadius: '8px', padding: '12px 16px',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {req.user_profile_image ? (
                        <img src={req.user_profile_image} alt="" style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#e0e0e0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', color: '#999' }}>
                          {(req.member_nickname || req.member_name || '?').charAt(0)}
                        </div>
                      )}
                      <div>
                        <div style={{ fontWeight: '600', fontSize: '14px' }}>{req.member_nickname || req.member_name}</div>
                        <div style={{ fontSize: '12px', color: '#999' }}>
                          {REQUEST_TYPE_LABELS[req.request_type]} &middot; {new Date(req.created_at).toLocaleDateString('ko-KR')}
                        </div>
                      </div>
                    </div>
                    <span style={{
                      padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: '600',
                      background: STATUS_LABELS[req.status]?.color + '20',
                      color: STATUS_LABELS[req.status]?.color,
                    }}>
                      {STATUS_LABELS[req.status]?.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function MemberCard({ member, onAction, actionLoading, showApproveReject, showBan, onEdit, onRoleChange, onReactivate }: {
  member: MembershipWithUser;
  onAction: (id: number, status: 'approved' | 'rejected' | 'banned') => void;
  actionLoading: number | null;
  showApproveReject?: boolean;
  showBan?: boolean;
  onEdit?: () => void;
  onRoleChange?: (id: number, role: 'admin' | 'member') => void;
  onReactivate?: () => void;
}) {
  const isLoading = actionLoading === member.id;

  return (
    <div className="member-card" style={{
      border: '1px solid #e0e0e0', borderRadius: '10px', padding: '14px 18px',
      display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white',
    }}>
      <div className="member-card-info" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {member.user_profile_image ? (
          <img
            src={member.user_profile_image} alt=""
            style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
          />
        ) : (
          <div style={{
            width: '40px', height: '40px', borderRadius: '50%', background: '#e0e0e0',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999', fontSize: '16px',
            flexShrink: 0,
          }}>
            {member.user_name.charAt(0)}
          </div>
        )}
        <div>
          <div style={{ fontWeight: '600', fontSize: '15px' }}>
            {member.display_name || member.user_name}
            {member.display_name && member.user_name && member.display_name !== member.user_name && (
              <span style={{ color: '#888', fontWeight: '400', fontSize: '13px' }}> · 계정명 {member.user_nickname || member.user_name}</span>
            )}
          </div>
          <div style={{ fontSize: '12px', color: '#999' }}>
            {ROLE_LABELS[member.role] || member.role} &middot; {new Date(member.joined_at).toLocaleDateString('ko-KR')}
          </div>
        </div>
      </div>
      <div className="member-card-actions" style={{ display: 'flex', gap: '6px' }}>
        {onEdit && (
          <button
            onClick={onEdit}
            style={{
              background: '#1976d2', color: 'white', border: 'none',
              padding: '6px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px',
            }}
          >
            수정
          </button>
        )}
        {showApproveReject && (
          <>
            <button
              onClick={() => onAction(member.id, 'approved')}
              disabled={isLoading}
              style={{
                background: '#4caf50', color: 'white', border: 'none',
                padding: '6px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px',
                opacity: isLoading ? 0.6 : 1,
              }}
            >
              승인
            </button>
            <button
              onClick={() => onAction(member.id, 'rejected')}
              disabled={isLoading}
              style={{
                background: '#f44336', color: 'white', border: 'none',
                padding: '6px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px',
                opacity: isLoading ? 0.6 : 1,
              }}
            >
              거부
            </button>
          </>
        )}
        {onRoleChange && member.role === 'member' && (
          <button
            onClick={() => onRoleChange(member.id, 'admin')}
            disabled={isLoading}
            style={{
              background: '#ff9800', color: 'white', border: 'none',
              padding: '6px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px',
              opacity: isLoading ? 0.6 : 1,
            }}
          >
            관리자 지정
          </button>
        )}
        {onRoleChange && member.role === 'admin' && (
          <button
            onClick={() => onRoleChange(member.id, 'member')}
            disabled={isLoading}
            style={{
              background: '#9e9e9e', color: 'white', border: 'none',
              padding: '6px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px',
              opacity: isLoading ? 0.6 : 1,
            }}
          >
            관리자 해제
          </button>
        )}
        {onReactivate && (
          <button
            onClick={onReactivate}
            disabled={isLoading}
            style={{
              background: '#4caf50', color: 'white', border: 'none',
              padding: '6px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px',
              opacity: isLoading ? 0.6 : 1,
            }}
          >
            활동 재시작
          </button>
        )}
        {showBan && member.role === 'member' && (
          <button
            onClick={() => {
              if (window.confirm(`${member.user_nickname || member.user_name}님을 추방하시겠습니까?`)) {
                onAction(member.id, 'banned');
              }
            }}
            disabled={isLoading}
            style={{
              background: '#ff5722', color: 'white', border: 'none',
              padding: '6px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px',
              opacity: isLoading ? 0.6 : 1,
            }}
          >
            추방
          </button>
        )}
      </div>
    </div>
  );
}

function AnnouncementSection({ clubId }: { clubId: number }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState('');
  const [error, setError] = useState('');

  const handleSend = async () => {
    if (!title.trim()) { setError('제목을 입력하세요.'); return; }
    try {
      setSending(true);
      setError('');
      const res = await notificationsApi.createAnnouncement(
        clubId,
        { title: title.trim(), body: body.trim() || undefined },
        file || undefined
      );
      setResult(res.message);
      setTitle('');
      setBody('');
      setFile(null);
      setTimeout(() => setResult(''), 4000);
    } catch (err: any) {
      setError(err.message || '발송에 실패했습니다.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{ maxWidth: '600px' }}>
      <h3 style={{ fontSize: '16px', marginBottom: '12px' }}>공지 작성</h3>
      {error && <div style={{ padding: '8px 12px', background: '#fff3f3', color: '#d32f2f', borderRadius: '6px', marginBottom: '10px', fontSize: '13px' }}>{error}</div>}
      {result && <div style={{ padding: '8px 12px', background: '#e8f5e9', color: '#2e7d32', borderRadius: '6px', marginBottom: '10px', fontSize: '13px' }}>{result}</div>}
      <input
        type="text"
        placeholder="공지 제목"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        style={{
          width: '100%', padding: '10px 12px', border: '1px solid #ddd', borderRadius: '8px',
          fontSize: '15px', marginBottom: '10px', boxSizing: 'border-box',
        }}
      />
      <textarea
        placeholder="공지 내용 (선택)"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={4}
        style={{
          width: '100%', padding: '10px 12px', border: '1px solid #ddd', borderRadius: '8px',
          fontSize: '14px', marginBottom: '10px', resize: 'vertical', boxSizing: 'border-box',
        }}
      />
      <div style={{ marginBottom: '12px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', color: '#555' }}>
          <span style={{ padding: '6px 12px', border: '1px solid #ddd', borderRadius: '6px', background: '#f5f5f5' }}>
            파일 첨부
          </span>
          <input
            type="file"
            accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx,.xls,.xlsx,.hwp"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            style={{ display: 'none' }}
          />
          {file && <span style={{ fontSize: '13px', color: '#1976d2' }}>{file.name}</span>}
        </label>
        {file && (
          <button
            onClick={() => setFile(null)}
            style={{ marginTop: '4px', background: 'none', border: 'none', color: '#999', cursor: 'pointer', fontSize: '12px' }}
          >
            첨부 취소
          </button>
        )}
      </div>
      <button
        onClick={handleSend}
        disabled={sending}
        style={{
          background: '#1976d2', color: 'white', border: 'none',
          padding: '10px 24px', borderRadius: '6px', cursor: 'pointer', fontSize: '14px',
          opacity: sending ? 0.7 : 1,
        }}
      >
        {sending ? '발송 중...' : '공지 발송'}
      </button>
    </div>
  );
}

const PLAY_STYLES: PlayStyle[] = ['양핸드전진속공', '드라이브', '커트', '펜홀더공격', '쉐이크공격', '수비', '올라운드'];
const PIMPLE_TYPES: { value: PimpleType; label: string }[] = [
  { value: 'none', label: '없음' },
  { value: 'short', label: '숏핌플' },
  { value: 'long', label: '롱핌플' },
];

function RosterMemberEditModal({ member, onClose, onSaved }: {
  member: Member;
  onClose: () => void;
  onSaved: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const [name, setName] = useState(member.name || '');
  const [birthYear, setBirthYear] = useState<number | ''>(member.birth_year || '');
  const [gender, setGender] = useState<'M' | 'F'>(member.gender || 'M');
  const [phone, setPhone] = useState(member.phone || '');
  const [localBusu, setLocalBusu] = useState<number | ''>(member.local_busu ?? '');
  const [openBusu, setOpenBusu] = useState<number | ''>(member.open_busu ?? '');
  const [playStyle, setPlayStyle] = useState<PlayStyle>(member.play_style || '올라운드');
  const [pimpleType, setPimpleType] = useState<PimpleType>(member.pimple_type || 'none');
  const [isActive, setIsActive] = useState(member.is_active !== false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(member.profile_image || null);
  const [spouseId, setSpouseId] = useState<number | ''>(member.spouse_id ?? '');
  const [clubMembers, setClubMembers] = useState<Member[]>([]);

  useEffect(() => {
    api.get<Member[]>(`/members?club_id=${member.club_id}`)
      .then((list) => setClubMembers(list))
      .catch(() => {});
  }, [member.club_id]);

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploading(true);
      setError('');
      const res = await profileApi.uploadMemberPhoto(member.id, file);
      setPhotoPreview(res.profile_image);
    } catch (err: any) {
      setError(err.message || '사진 업로드 실패');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError('');
      await api.put(`/members/${member.id}`, {
        name: name || undefined,
        birth_year: birthYear || undefined,
        gender,
        phone: phone || null,
        local_busu: localBusu === '' ? null : localBusu,
        open_busu: openBusu === '' ? null : openBusu,
        play_style: playStyle,
        pimple_type: pimpleType,
        is_active: isActive,
      });
      // 부부(배우자) 양방향 설정
      await api.put(`/members/${member.id}/spouse`, {
        spouse_id: spouseId === '' ? null : spouseId,
      });
      onSaved();
    } catch (err: any) {
      setError(err.message || '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const modalFieldStyle: React.CSSProperties = {
    width: '100%', padding: '8px 10px', border: '1px solid #ddd', borderRadius: '6px',
    fontSize: '14px', boxSizing: 'border-box',
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)', zIndex: 2000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px',
    }} onClick={onClose}>
      <div
        style={{
          background: 'white', borderRadius: '12px', padding: '24px',
          maxWidth: '500px', width: '100%', maxHeight: '90vh', overflowY: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ margin: 0, fontSize: '18px' }}>회원 정보 수정</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#999' }}>
            &times;
          </button>
        </div>

        {error && <div style={{ padding: '8px 12px', background: '#fff3f3', color: '#d32f2f', borderRadius: '6px', marginBottom: '12px', fontSize: '13px' }}>{error}</div>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Photo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
            {photoPreview ? (
              <img src={photoPreview} alt="" style={{ width: '60px', height: '60px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #e0e0e0' }} />
            ) : (
              <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: '#e0e0e0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', color: '#999' }}>
                {name.charAt(0) || '?'}
              </div>
            )}
            <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
              style={{ background: '#1976d2', color: 'white', border: 'none', padding: '6px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', opacity: uploading ? 0.7 : 1 }}>
              {uploading ? '업로드 중...' : '사진 변경'}
            </button>
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" onChange={handlePhotoChange} style={{ display: 'none' }} />
          </div>

          <ModalField label="이름">
            <input style={modalFieldStyle} value={name} onChange={e => setName(e.target.value)} />
          </ModalField>
          <div style={{ display: 'flex', gap: '10px' }}>
            <ModalField label="출생연도" flex={1}>
              <input style={modalFieldStyle} type="number" value={birthYear} onChange={e => setBirthYear(e.target.value ? parseInt(e.target.value) : '')} placeholder="예: 1980" />
            </ModalField>
            <ModalField label="성별" flex={1}>
              <select style={modalFieldStyle} value={gender} onChange={e => setGender(e.target.value as 'M' | 'F')}>
                <option value="M">남성</option>
                <option value="F">여성</option>
              </select>
            </ModalField>
          </div>
          <ModalField label="전화번호">
            <input style={modalFieldStyle} value={phone} onChange={e => setPhone(e.target.value)} placeholder="010-0000-0000" />
          </ModalField>
          <div style={{ display: 'flex', gap: '10px' }}>
            <ModalField label="지역부수" flex={1}>
              <input style={modalFieldStyle} type="number" min={1} max={20} value={localBusu} onChange={e => setLocalBusu(e.target.value ? parseInt(e.target.value) : '')} />
            </ModalField>
            <ModalField label="오픈부수" flex={1}>
              <input style={modalFieldStyle} type="number" min={1} max={20} value={openBusu} onChange={e => setOpenBusu(e.target.value ? parseInt(e.target.value) : '')} />
            </ModalField>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <ModalField label="전형" flex={1}>
              <select style={modalFieldStyle} value={playStyle} onChange={e => setPlayStyle(e.target.value as PlayStyle)}>
                {PLAY_STYLES.map(ps => <option key={ps} value={ps}>{ps}</option>)}
              </select>
            </ModalField>
            <ModalField label="핌플" flex={1}>
              <select style={modalFieldStyle} value={pimpleType} onChange={e => setPimpleType(e.target.value as PimpleType)}>
                {PIMPLE_TYPES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </ModalField>
          </div>
          <ModalField label="배우자(부부)">
            <select style={modalFieldStyle} value={spouseId} onChange={e => setSpouseId(e.target.value ? parseInt(e.target.value) : '')}>
              <option value="">없음</option>
              {clubMembers
                .filter((cm) => cm.id !== member.id)
                .map((cm) => <option key={cm.id} value={cm.id}>{cm.name}</option>)}
            </select>
          </ModalField>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} />
            <span style={{ fontSize: '14px' }}>활동 회원</span>
          </label>

          <button onClick={handleSave} disabled={saving}
            style={{ marginTop: '8px', width: '100%', padding: '12px', background: '#1976d2', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '15px', fontWeight: '600', opacity: saving ? 0.7 : 1 }}>
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}

function MemberEditModal({ membership, onClose, onSaved }: {
  membership: MembershipWithUser;
  onClose: () => void;
  onSaved: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [memberData, setMemberData] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  // form fields
  const [name, setName] = useState('');
  const [birthYear, setBirthYear] = useState<number | ''>('');
  const [gender, setGender] = useState<'M' | 'F'>('M');
  const [phone, setPhone] = useState('');
  const [localBusu, setLocalBusu] = useState<number | ''>('');
  const [openBusu, setOpenBusu] = useState<number | ''>('');
  const [playStyle, setPlayStyle] = useState<PlayStyle>('올라운드');
  const [pimpleType, setPimpleType] = useState<PimpleType>('none');
  const [isActive, setIsActive] = useState(true);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [spouseId, setSpouseId] = useState<number | ''>('');
  const [clubMembers, setClubMembers] = useState<Member[]>([]);

  useEffect(() => {
    api.get<Member[]>(`/members?club_id=${membership.club_id}`)
      .then((list) => setClubMembers(list))
      .catch(() => {});
  }, [membership.club_id]);

  useEffect(() => {
    const loadMember = async (memberId: number) => {
      const m = await api.get<Member>(`/members/${memberId}`);
      setMemberData(m);
      setName(m.name || '');
      setBirthYear(m.birth_year || '');
      setGender(m.gender || 'M');
      setPhone(m.phone || '');
      setLocalBusu(m.local_busu ?? '');
      setOpenBusu(m.open_busu ?? '');
      setPlayStyle(m.play_style || '올라운드');
      setPimpleType(m.pimple_type || 'none');
      setIsActive(m.is_active !== false);
      setPhotoPreview(m.profile_image || null);
      setSpouseId(m.spouse_id ?? '');
    };

    const init = async () => {
      try {
        let memberId = membership.member_id;
        if (!memberId) {
          // member_id가 없으면 자동 생성 후 연결
          const res = await clubsApi.createAndLinkMember(membership.club_id, membership.id);
          memberId = res.member_id;
          membership.member_id = memberId;
        }
        await loadMember(memberId);
      } catch (err: any) {
        setError(err.message || '회원 정보를 불러올 수 없습니다.');
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [membership]);

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !membership.member_id) return;
    try {
      setUploading(true);
      setError('');
      const res = await profileApi.uploadMemberPhoto(membership.member_id, file);
      setPhotoPreview(res.profile_image);
    } catch (err: any) {
      setError(err.message || '사진 업로드 실패');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    if (!membership.member_id) return;
    try {
      setSaving(true);
      setError('');
      await api.put(`/members/${membership.member_id}`, {
        name: name || undefined,
        birth_year: birthYear || undefined,
        gender,
        phone: phone || null,
        local_busu: localBusu === '' ? null : localBusu,
        open_busu: openBusu === '' ? null : openBusu,
        play_style: playStyle,
        pimple_type: pimpleType,
        is_active: isActive,
      });
      // 부부(배우자) 양방향 설정
      await api.put(`/members/${membership.member_id}/spouse`, {
        spouse_id: spouseId === '' ? null : spouseId,
      });
      onSaved();
    } catch (err: any) {
      setError(err.message || '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const modalFieldStyle: React.CSSProperties = {
    width: '100%', padding: '8px 10px', border: '1px solid #ddd', borderRadius: '6px',
    fontSize: '14px', boxSizing: 'border-box',
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)', zIndex: 2000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px',
    }} onClick={onClose}>
      <div
        style={{
          background: 'white', borderRadius: '12px', padding: '24px',
          maxWidth: '500px', width: '100%', maxHeight: '90vh', overflowY: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px' }}>회원 정보 수정</h2>
            <div style={{ fontSize: '13px', color: '#666', marginTop: '4px' }}>
              {membership.user_name}
              {membership.user_nickname && <span style={{ color: '#999' }}> (닉네임: {membership.user_nickname})</span>}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#999' }}>
            &times;
          </button>
        </div>

        {error && <div style={{ padding: '8px 12px', background: '#fff3f3', color: '#d32f2f', borderRadius: '6px', marginBottom: '12px', fontSize: '13px' }}>{error}</div>}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>로딩 중...</div>
        ) : !memberData ? (
          <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>회원 데이터를 불러올 수 없습니다.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Photo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
              {photoPreview ? (
                <img src={photoPreview} alt="" style={{ width: '60px', height: '60px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #e0e0e0' }} />
              ) : (
                <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: '#e0e0e0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', color: '#999' }}>
                  {name.charAt(0) || '?'}
                </div>
              )}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                style={{ background: '#1976d2', color: 'white', border: 'none', padding: '6px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', opacity: uploading ? 0.7 : 1 }}
              >
                {uploading ? '업로드 중...' : '사진 변경'}
              </button>
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" onChange={handlePhotoChange} style={{ display: 'none' }} />
            </div>

            <ModalField label="이름">
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} style={modalFieldStyle} />
            </ModalField>
            <ModalField label="출생년도">
              <input type="number" value={birthYear} onChange={(e) => setBirthYear(e.target.value ? parseInt(e.target.value) : '')} style={modalFieldStyle} />
            </ModalField>
            <ModalField label="성별">
              <select value={gender} onChange={(e) => setGender(e.target.value as 'M' | 'F')} style={modalFieldStyle}>
                <option value="M">남성</option>
                <option value="F">여성</option>
              </select>
            </ModalField>
            <ModalField label="전화번호">
              <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} style={modalFieldStyle} />
            </ModalField>
            <ModalField label="지역부수">
              <input type="number" value={localBusu} onChange={(e) => setLocalBusu(e.target.value ? parseInt(e.target.value) : '')} style={modalFieldStyle} />
            </ModalField>
            <ModalField label="오픈부수">
              <input type="number" value={openBusu} onChange={(e) => setOpenBusu(e.target.value ? parseInt(e.target.value) : '')} style={modalFieldStyle} />
            </ModalField>
            <ModalField label="전형">
              <select value={playStyle} onChange={(e) => setPlayStyle(e.target.value as PlayStyle)} style={modalFieldStyle}>
                {PLAY_STYLES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </ModalField>
            <ModalField label="핌플">
              <select value={pimpleType} onChange={(e) => setPimpleType(e.target.value as PimpleType)} style={modalFieldStyle}>
                {PIMPLE_TYPES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </ModalField>
            <ModalField label="배우자(부부)">
              <select value={spouseId} onChange={(e) => setSpouseId(e.target.value ? parseInt(e.target.value) : '')} style={modalFieldStyle}>
                <option value="">없음</option>
                {clubMembers
                  .filter((cm) => cm.id !== membership.member_id)
                  .map((cm) => <option key={cm.id} value={cm.id}>{cm.name}</option>)}
              </select>
            </ModalField>
            <ModalField label="활동 상태">
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px' }}>
                <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
                활동 중
              </label>
            </ModalField>

            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  flex: 1, background: '#1976d2', color: 'white', border: 'none',
                  padding: '10px', borderRadius: '8px', cursor: 'pointer', fontSize: '14px',
                  fontWeight: '600', opacity: saving ? 0.7 : 1,
                }}
              >
                {saving ? '저장 중...' : '저장'}
              </button>
              <button
                onClick={onClose}
                style={{
                  flex: 1, background: '#f5f5f5', color: '#333', border: '1px solid #ddd',
                  padding: '10px', borderRadius: '8px', cursor: 'pointer', fontSize: '14px',
                }}
              >
                닫기
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ModalField({ label, children, flex }: { label: string; children: React.ReactNode; flex?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex }}>
      <label style={{ width: '70px', fontSize: '13px', fontWeight: '600', color: '#333', flexShrink: 0 }}>{label}</label>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}
