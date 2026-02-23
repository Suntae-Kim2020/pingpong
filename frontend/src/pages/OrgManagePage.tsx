import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { orgsApi, Organization, OrgInvite, OrgMembershipWithUser } from '../api/orgs';
import AddressSearch from '../components/AddressSearch';

type Tab = 'pending' | 'members' | 'invites' | 'announcements' | 'club-requests' | 'member-registrations';

const ROLE_LABELS: Record<string, string> = {
  leader: '리더',
  admin: '관리자',
  member: '회원',
};

export default function OrgManagePage() {
  const { id } = useParams<{ id: string }>();
  const orgId = parseInt(id!);
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [org, setOrg] = useState<Organization | null>(null);
  const [tab, setTab] = useState<Tab>('pending');
  const [pending, setPending] = useState<OrgMembershipWithUser[]>([]);
  const [members, setMembers] = useState<OrgMembershipWithUser[]>([]);
  const [invites, setInvites] = useState<OrgInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [editAddress, setEditAddress] = useState('');
  const [editingAddress, setEditingAddress] = useState(false);
  const [addressSaving, setAddressSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) { navigate('/login'); return; }
    loadOrg();
  }, [isAuthenticated, authLoading, orgId]);

  useEffect(() => {
    if (!org) return;
    if (tab === 'pending') loadPending();
    else if (tab === 'members') loadMembers();
    else if (tab === 'invites') loadInvites();
  }, [tab, org]);

  const loadOrg = async () => {
    try {
      const data = await orgsApi.getById(orgId);
      setOrg(data);
    } catch {
      setError('단체 정보를 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  };

  const loadPending = useCallback(async () => {
    try {
      const data = await orgsApi.getMembers(orgId, 'pending');
      setPending(data);
    } catch (err: any) {
      setError(err.message);
    }
  }, [orgId]);

  const loadMembers = useCallback(async () => {
    try {
      const data = await orgsApi.getMembers(orgId, 'approved');
      setMembers(data);
    } catch (err: any) {
      setError(err.message);
    }
  }, [orgId]);

  const loadInvites = useCallback(async () => {
    try {
      const data = await orgsApi.getInvites(orgId);
      setInvites(data);
    } catch (err: any) {
      setError(err.message);
    }
  }, [orgId]);

  const handleCreateInvite = async () => {
    try {
      setError('');
      await orgsApi.createInvite(orgId, { expiresInHours: 168 });
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
      await orgsApi.deactivateInvite(orgId, inviteId);
      setSuccess('초대 링크가 비활성화되었습니다.');
      loadInvites();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const copyInviteLink = (token: string) => {
    const link = `${window.location.origin}/orgs/invite/${token}`;
    navigator.clipboard.writeText(link).then(() => {
      setSuccess('링크가 복사되었습니다!');
      setTimeout(() => setSuccess(''), 2000);
    });
  };

  const handleRoleChange = async (membershipId: number, role: 'admin' | 'member') => {
    try {
      setActionLoading(membershipId);
      setError('');
      await orgsApi.updateMemberRole(orgId, membershipId, role);
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
      await orgsApi.update(orgId, { address: editAddress });
      setOrg((prev) => prev ? { ...prev, address: editAddress } : prev);
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
      await orgsApi.updateMemberStatus(orgId, membershipId, status);
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

  if (authLoading || loading) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>로딩 중...</div>;
  }

  if (!org) {
    return <div style={{ padding: '40px', textAlign: 'center', color: '#d32f2f' }}>단체를 찾을 수 없습니다.</div>;
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'pending', label: `가입 신청 (${pending.length})` },
    { key: 'members', label: '회원 목록' },
    { key: 'club-requests', label: '클럽 소속 신청' },
    { key: 'member-registrations', label: '회원 등록 신청' },
    { key: 'invites', label: '초대 링크' },
    { key: 'announcements', label: '공지' },
  ];

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        <button onClick={() => navigate('/orgs')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px' }}>
          &larr;
        </button>
        <h1 style={{ fontSize: '22px', margin: 0, flex: 1 }}>{org.name} 관리</h1>
        <button
          onClick={() => navigate(`/orgs/${orgId}/fees`)}
          style={{
            background: '#1976d2', color: 'white', border: 'none',
            padding: '8px 16px', borderRadius: '6px', cursor: 'pointer',
            fontSize: '13px', fontWeight: '600',
          }}
        >
          재무관리
        </button>
      </div>

      {/* 주소 정보 */}
      <div style={{ background: '#f8f9fa', border: '1px solid #e0e0e0', borderRadius: '10px', padding: '14px 18px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: editingAddress ? '12px' : 0 }}>
          <div>
            <span style={{ fontWeight: '600', fontSize: '14px', color: '#333' }}>주소/위치: </span>
            <span style={{ fontSize: '14px', color: '#555' }}>{org.address || '미설정'}</span>
          </div>
          {!editingAddress && (
            <button
              onClick={() => { setEditAddress(org.address || ''); setEditingAddress(true); }}
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
              detailPlaceholder="상세주소 입력"
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
                <OrgMemberCard key={m.id} member={m} onAction={handleAction} actionLoading={actionLoading} showApproveReject />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Members Tab */}
      {tab === 'members' && (
        <div>
          {members.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>회원이 없습니다.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {members.map((m) => (
                <OrgMemberCard key={m.id} member={m} onAction={handleAction} actionLoading={actionLoading} showBan onRoleChange={handleRoleChange} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Club Requests Tab */}
      {tab === 'club-requests' && (
        <OrgClubRequestsSection orgId={orgId} />
      )}

      {/* Member Registrations Tab */}
      {tab === 'member-registrations' && (
        <OrgMemberRegistrationsSection orgId={orgId} />
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
        <OrgAnnouncementSection orgId={orgId} orgType={org.org_type} />
      )}
    </div>
  );
}

function OrgMemberCard({ member, onAction, actionLoading, showApproveReject, showBan, onRoleChange }: {
  member: OrgMembershipWithUser;
  onAction: (id: number, status: 'approved' | 'rejected' | 'banned') => void;
  actionLoading: number | null;
  showApproveReject?: boolean;
  showBan?: boolean;
  onRoleChange?: (id: number, role: 'admin' | 'member') => void;
}) {
  const isLoading = actionLoading === member.id;

  return (
    <div style={{
      border: '1px solid #e0e0e0', borderRadius: '10px', padding: '14px 18px',
      display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {member.user_profile_image ? (
          <img
            src={member.user_profile_image} alt=""
            style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }}
          />
        ) : (
          <div style={{
            width: '40px', height: '40px', borderRadius: '50%', background: '#e0e0e0',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999', fontSize: '16px',
          }}>
            {(member.user_nickname || member.user_name).charAt(0)}
          </div>
        )}
        <div>
          <div style={{ fontWeight: '600', fontSize: '15px' }}>
            {member.user_nickname || member.user_name}
            {member.display_name && <span style={{ color: '#888', fontWeight: '400' }}> ({member.display_name})</span>}
          </div>
          <div style={{ fontSize: '12px', color: '#999' }}>
            {ROLE_LABELS[member.role] || member.role} &middot; {new Date(member.joined_at).toLocaleDateString('ko-KR')}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '6px' }}>
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

function OrgClubRequestsSection({ orgId }: { orgId: number }) {
  const [requests, setRequests] = useState<any[]>([]);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadRequests();
  }, [orgId]);

  const loadRequests = async () => {
    try {
      const data = await orgsApi.getAffiliationRequests(orgId);
      setRequests(data);
    } catch {}
  };

  const handleReview = async (requestId: number, status: 'approved' | 'rejected') => {
    try {
      setActionLoading(requestId);
      setError('');
      await orgsApi.reviewAffiliationRequest(orgId, requestId, status);
      setSuccess(status === 'approved' ? '승인되었습니다.' : '거부되었습니다.');
      loadRequests();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || '처리에 실패했습니다.');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div>
      {error && <div style={{ padding: '8px 12px', background: '#fff3f3', color: '#d32f2f', borderRadius: '6px', marginBottom: '10px', fontSize: '13px' }}>{error}</div>}
      {success && <div style={{ padding: '8px 12px', background: '#e8f5e9', color: '#2e7d32', borderRadius: '6px', marginBottom: '10px', fontSize: '13px' }}>{success}</div>}
      {requests.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>대기 중인 클럽 소속 신청이 없습니다.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {requests.map((req: any) => (
            <div key={req.id} style={{
              border: '1px solid #e0e0e0', borderRadius: '10px', padding: '14px 18px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white',
            }}>
              <div>
                <div style={{ fontWeight: '600', fontSize: '15px' }}>{req.club_name}</div>
                <div style={{ fontSize: '12px', color: '#999' }}>
                  회원 {req.club_member_count}명 &middot; 신청자: {req.requested_by_nickname || req.requested_by_name}
                  &nbsp;&middot;&nbsp;{new Date(req.created_at).toLocaleDateString('ko-KR')}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  onClick={() => handleReview(req.id, 'approved')}
                  disabled={actionLoading === req.id}
                  style={{
                    background: '#4caf50', color: 'white', border: 'none',
                    padding: '6px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px',
                    opacity: actionLoading === req.id ? 0.6 : 1,
                  }}
                >
                  승인
                </button>
                <button
                  onClick={() => handleReview(req.id, 'rejected')}
                  disabled={actionLoading === req.id}
                  style={{
                    background: '#f44336', color: 'white', border: 'none',
                    padding: '6px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px',
                    opacity: actionLoading === req.id ? 0.6 : 1,
                  }}
                >
                  거부
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function OrgMemberRegistrationsSection({ orgId }: { orgId: number }) {
  const [requests, setRequests] = useState<any[]>([]);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const REQUEST_TYPE_LABELS: Record<string, string> = {
    new_registration: '신규등록',
    transfer: '소속변경',
  };

  useEffect(() => {
    loadRequests();
  }, [orgId]);

  const loadRequests = async () => {
    try {
      const data = await orgsApi.getMemberRegistrations(orgId);
      setRequests(data);
    } catch {}
  };

  const handleReview = async (requestId: number, status: 'approved' | 'rejected') => {
    try {
      setActionLoading(requestId);
      setError('');
      await orgsApi.reviewMemberRegistration(orgId, requestId, status);
      setSuccess(status === 'approved' ? '승인되었습니다.' : '거부되었습니다.');
      loadRequests();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || '처리에 실패했습니다.');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div>
      {error && <div style={{ padding: '8px 12px', background: '#fff3f3', color: '#d32f2f', borderRadius: '6px', marginBottom: '10px', fontSize: '13px' }}>{error}</div>}
      {success && <div style={{ padding: '8px 12px', background: '#e8f5e9', color: '#2e7d32', borderRadius: '6px', marginBottom: '10px', fontSize: '13px' }}>{success}</div>}
      {requests.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>대기 중인 회원 등록 신청이 없습니다.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {requests.map((req: any) => (
            <div key={req.id} style={{
              border: '1px solid #e0e0e0', borderRadius: '10px', padding: '14px 18px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {req.user_profile_image ? (
                  <img src={req.user_profile_image} alt="" style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }} />
                ) : (
                  <div style={{
                    width: '40px', height: '40px', borderRadius: '50%', background: '#e0e0e0',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999', fontSize: '16px',
                  }}>
                    {(req.member_nickname || req.member_name || '?').charAt(0)}
                  </div>
                )}
                <div>
                  <div style={{ fontWeight: '600', fontSize: '15px' }}>{req.member_nickname || req.member_name}</div>
                  <div style={{ fontSize: '12px', color: '#999' }}>
                    {req.club_name} &middot; {REQUEST_TYPE_LABELS[req.request_type] || req.request_type}
                    &nbsp;&middot;&nbsp;{new Date(req.created_at).toLocaleDateString('ko-KR')}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  onClick={() => handleReview(req.id, 'approved')}
                  disabled={actionLoading === req.id}
                  style={{
                    background: '#4caf50', color: 'white', border: 'none',
                    padding: '6px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px',
                    opacity: actionLoading === req.id ? 0.6 : 1,
                  }}
                >
                  승인
                </button>
                <button
                  onClick={() => handleReview(req.id, 'rejected')}
                  disabled={actionLoading === req.id}
                  style={{
                    background: '#f44336', color: 'white', border: 'none',
                    padding: '6px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px',
                    opacity: actionLoading === req.id ? 0.6 : 1,
                  }}
                >
                  거부
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function OrgAnnouncementSection({ orgId, orgType }: { orgId: number; orgType: string }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [scope, setScope] = useState<'members' | 'children'>('members');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState('');
  const [error, setError] = useState('');

  const handleSend = async () => {
    if (!title.trim()) { setError('제목을 입력하세요.'); return; }
    if (scope === 'children') {
      if (!window.confirm('산하 단체 회원 전체에게 발송됩니다. 계속하시겠습니까?')) return;
    }
    try {
      setSending(true);
      setError('');
      const res = await orgsApi.createAnnouncement(
        orgId,
        { title: title.trim(), body: body.trim() || undefined, scope },
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
      {orgType !== 'city_district' && (
        <div style={{ display: 'flex', gap: '16px', marginBottom: '12px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '14px' }}>
            <input
              type="radio"
              name="announcement-scope"
              checked={scope === 'members'}
              onChange={() => setScope('members')}
            />
            소속 회원
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '14px' }}>
            <input
              type="radio"
              name="announcement-scope"
              checked={scope === 'children'}
              onChange={() => setScope('children')}
            />
            산하 단체 전체
          </label>
        </div>
      )}
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
