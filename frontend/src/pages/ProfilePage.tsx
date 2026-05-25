import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { profileApi } from '../api/profile';
import { api } from '../api/client';
import { clubsApi, ClubMembership, InviteInfo } from '../api/clubs';
import { triggerInstallPrompt } from '../components/InstallPrompt';
import { orgsApi, OrgMembership } from '../api/orgs';
import type { Member, PimpleType } from '../types';
import { ORG_TYPE_LABELS } from '../types';

const PROVIDER_LABELS: Record<string, string> = {
  kakao: '카카오',
  naver: '네이버',
  google: '구글',
};

export default function ProfilePage() {
  const { user, isAuthenticated, isLoading: authLoading, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isWelcome = searchParams.get('welcome') === '1';
  const inviteToken = searchParams.get('invite');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null);

  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');
  const [phone, setPhone] = useState('');
  const [birthYear, setBirthYear] = useState<number | ''>('');
  const [gender, setGender] = useState<'M' | 'F' | ''>('');

  const [clubs, setClubs] = useState<ClubMembership[]>([]);
  const [orgs, setOrgs] = useState<OrgMembership[]>([]);
  const [leavingClubId, setLeavingClubId] = useState<number | null>(null);
  const [leavingOrgId, setLeavingOrgId] = useState<number | null>(null);
  const [myMemberId, setMyMemberId] = useState<number | null>(null);
  const [localBusu, setLocalBusu] = useState<number | ''>('');
  const [openBusu, setOpenBusu] = useState<number | ''>('');
  const [pimpleType, setPimpleType] = useState<PimpleType>('none');
  const [spouseId, setSpouseId] = useState<number | ''>('');
  const [clubMembers, setClubMembers] = useState<Member[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      const redirectPath = inviteToken ? `/clubs/invite/${inviteToken}` : '/profile';
      navigate(`/login?redirect=${encodeURIComponent(redirectPath)}`);
      return;
    }
  }, [isAuthenticated, authLoading, inviteToken]);

  // 초대 토큰이 있으면 클럽 정보 미리 로드 (배너 표시용)
  useEffect(() => {
    if (!inviteToken) return;
    clubsApi.resolveInvite(inviteToken)
      .then((info) => setInviteInfo(info))
      .catch((err: any) => setError(err?.message || '초대 링크가 유효하지 않습니다.'));
  }, [inviteToken]);

  useEffect(() => {
    if (!user) return;
    setName(user.name || '');
    setNickname(user.nickname || '');
    setPhone(user.phone || '');
    setBirthYear(user.birth_year || '');
    setGender(user.gender || '');

    clubsApi.getMyClubs().then((list) => {
      setClubs(list);
      const primary = list.find(c => c.status === 'approved' && c.member_id);
      if (primary?.member_id) {
        setMyMemberId(primary.member_id);
        api.get<Member>(`/members/${primary.member_id}`).then((m) => {
          setLocalBusu(m.local_busu ?? '');
          setOpenBusu(m.open_busu ?? '');
          setPimpleType(m.pimple_type || 'none');
          setSpouseId(m.spouse_id ?? '');
        }).catch(() => {});
        // 같은 클럽 회원 목록 (배우자 선택용)
        if (primary.club_id) {
          api.get<Member[]>(`/members?club_id=${primary.club_id}`)
            .then((list) => setClubMembers(list))
            .catch(() => {});
        }
      }
    }).catch(() => {});

    orgsApi.getMyOrgs().then((list) => {
      setOrgs(list);
    }).catch(() => {});
  }, [user]);

  const handleLeaveClub = async (clubId: number, clubName: string) => {
    if (!confirm(`정말 "${clubName}" 클럽에서 탈퇴하시겠습니까?`)) return;
    try {
      setLeavingClubId(clubId);
      const result = await clubsApi.leave(clubId);
      if (result.success) {
        setClubs(prev => prev.filter(c => c.club_id !== clubId));
        setSuccess(result.message);
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err: any) {
      setError(err.message || '탈퇴에 실패했습니다.');
    } finally {
      setLeavingClubId(null);
    }
  };

  const handleLeaveOrg = async (orgId: number, orgName: string) => {
    if (!confirm(`정말 "${orgName}" 단체에서 탈퇴하시겠습니까?`)) return;
    try {
      setLeavingOrgId(orgId);
      const result = await orgsApi.leave(orgId);
      if (result.success) {
        setOrgs(prev => prev.filter(o => o.org_id !== orgId));
        setSuccess(result.message);
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err: any) {
      setError(err.message || '탈퇴에 실패했습니다.');
    } finally {
      setLeavingOrgId(null);
    }
  };

  const handleSave = async () => {
    if (inviteToken && !name.trim()) {
      setError('실명을 입력해주세요. 클럽 가입에 사용됩니다.');
      return;
    }
    try {
      setSaving(true);
      setError('');
      await profileApi.updateMe({
        name: name || undefined,
        nickname: nickname || undefined,
        phone: phone || null,
        birth_year: birthYear || null,
        gender: gender || null,
      });
      if (myMemberId) {
        await api.put(`/members/${myMemberId}`, {
          local_busu: localBusu === '' ? null : localBusu,
          open_busu: openBusu === '' ? null : openBusu,
          pimple_type: pimpleType,
        });
        // 배우자(부부) 양방향 설정
        await api.put(`/members/${myMemberId}/spouse`, {
          spouse_id: spouseId === '' ? null : spouseId,
        });
      }
      await refreshUser();

      // 초대 토큰이 있으면 자동 클럽 가입
      if (inviteToken) {
        try {
          const result = await clubsApi.joinViaInvite(inviteToken, name.trim());
          setSuccess(result.message || '클럽에 가입되었습니다!');
          // 가입 직후 PWA 설치 안내 표시 (이미 설치/dismiss됐으면 무시됨)
          setTimeout(() => triggerInstallPrompt(), 600);
          setTimeout(() => navigate('/my-clubs'), 1800);
          return;
        } catch (joinErr: any) {
          // 이미 가입한 경우는 무시하고 my-clubs로 이동
          if (joinErr?.message?.includes('이미 가입')) {
            setSuccess('이미 가입된 클럽입니다.');
            setTimeout(() => navigate('/my-clubs'), 1200);
            return;
          }
          setError(joinErr?.message || '클럽 가입에 실패했습니다.');
          return;
        }
      }

      if (isWelcome) {
        setSearchParams({});
        navigate('/');
        return;
      }
      setSuccess('저장되었습니다.');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploading(true);
      setError('');
      await profileApi.uploadMyPhoto(file);
      await refreshUser();
      setSuccess('사진이 변경되었습니다.');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || '사진 업로드에 실패했습니다.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (authLoading || !user) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>로딩 중...</div>;
  }

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '20px' }}>
      <h1 style={{ fontSize: '22px', marginBottom: '24px' }}>
        {inviteToken ? '클럽 가입 — 본인 정보 입력' : isWelcome ? '회원가입 완료' : '내 프로필'}
      </h1>

      {inviteToken && inviteInfo && (
        <div style={{
          padding: '16px', background: '#fff3e0', color: '#e65100', borderRadius: '8px',
          marginBottom: '16px', fontSize: '14px', lineHeight: '1.6', border: '1px solid #ffe0b2',
        }}>
          🎾 <strong>{inviteInfo.club_name}</strong> 클럽 초대장입니다.<br />
          본인 정보(<strong>실명 필수</strong>)를 입력하고 저장하시면 자동으로 가입됩니다.
        </div>
      )}

      {isWelcome && !inviteToken && (
        <div style={{
          padding: '16px', background: '#e3f2fd', color: '#1565c0', borderRadius: '8px',
          marginBottom: '16px', fontSize: '14px', lineHeight: '1.6',
        }}>
          환영합니다! 추가 정보를 입력하시면 더 나은 서비스를 이용하실 수 있습니다.<br />
          모든 항목은 선택사항이며, 나중에 프로필에서 수정할 수 있습니다.
        </div>
      )}

      {error && <div style={{ padding: '10px 16px', background: '#fff3f3', color: '#d32f2f', borderRadius: '8px', marginBottom: '12px' }}>{error}</div>}
      {success && <div style={{ padding: '10px 16px', background: '#e8f5e9', color: '#2e7d32', borderRadius: '8px', marginBottom: '12px' }}>{success}</div>}

      {/* 프로필 사진 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
        {user.profile_image ? (
          <img
            src={user.profile_image}
            alt={user.name}
            style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #e0e0e0' }}
          />
        ) : (
          <div style={{
            width: '80px', height: '80px', borderRadius: '50%', background: '#e0e0e0',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '28px', color: '#999', border: '2px solid #e0e0e0',
          }}>
            {(user.nickname || user.name).charAt(0)}
          </div>
        )}
        <div>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            style={{
              background: '#1976d2', color: 'white', border: 'none',
              padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px',
              opacity: uploading ? 0.7 : 1,
            }}
          >
            {uploading ? '업로드 중...' : '사진 변경'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            onChange={handlePhotoChange}
            style={{ display: 'none' }}
          />
        </div>
      </div>

      {/* 소셜 로그인 정보 (읽기전용) */}
      <div style={{
        background: '#f5f5f5', borderRadius: '8px', padding: '12px 16px', marginBottom: '20px',
        fontSize: '14px', color: '#666',
      }}>
        <span style={{ fontWeight: '600' }}>소셜 로그인: </span>
        {PROVIDER_LABELS[user.provider] || user.provider}
        {user.email && <span> ({user.email})</span>}
      </div>

      {/* 수정 가능 필드 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '24px' }}>
        <FieldRow label="이름">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={inputStyle}
          />
        </FieldRow>
        <FieldRow label="닉네임">
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            style={inputStyle}
          />
        </FieldRow>
        <FieldRow label="전화번호">
          <input
            type="text"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="010-1234-5678"
            style={inputStyle}
          />
        </FieldRow>
        <FieldRow label="출생년도">
          <input
            type="number"
            value={birthYear}
            onChange={(e) => setBirthYear(e.target.value ? parseInt(e.target.value) : '')}
            placeholder="1990"
            style={inputStyle}
          />
        </FieldRow>
        <FieldRow label="성별">
          <select
            value={gender}
            onChange={(e) => setGender(e.target.value as 'M' | 'F' | '')}
            style={inputStyle}
          >
            <option value="">선택안함</option>
            <option value="M">남성</option>
            <option value="F">여성</option>
          </select>
        </FieldRow>
        {myMemberId && (
          <>
            <FieldRow label="지역부수">
              <input
                type="number"
                value={localBusu}
                onChange={(e) => setLocalBusu(e.target.value ? parseInt(e.target.value) : '')}
                placeholder="미입력"
                style={inputStyle}
              />
            </FieldRow>
            <FieldRow label="오픈부수">
              <input
                type="number"
                value={openBusu}
                onChange={(e) => setOpenBusu(e.target.value ? parseInt(e.target.value) : '')}
                placeholder="미입력"
                style={inputStyle}
              />
            </FieldRow>
            <FieldRow label="핌플">
              <select
                value={pimpleType}
                onChange={(e) => setPimpleType(e.target.value as PimpleType)}
                style={inputStyle}
              >
                <option value="none">없음 (일반)</option>
                <option value="short">숏핌플</option>
                <option value="long">롱핌플</option>
              </select>
            </FieldRow>
            <FieldRow label="배우자(부부)">
              <select
                value={spouseId}
                onChange={(e) => setSpouseId(e.target.value ? parseInt(e.target.value) : '')}
                style={inputStyle}
              >
                <option value="">없음</option>
                {clubMembers
                  .filter((m) => m.id !== myMemberId)
                  .map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
              </select>
            </FieldRow>
          </>
        )}
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        style={{
          background: '#1976d2', color: 'white', border: 'none',
          padding: '12px 32px', borderRadius: '8px', cursor: 'pointer', fontSize: '15px',
          fontWeight: '600', opacity: saving ? 0.7 : 1, width: '100%',
        }}
      >
        {saving ? '처리 중...' : inviteToken ? '저장하고 클럽 가입하기' : isWelcome ? '저장하고 시작하기' : '저장'}
      </button>

      {isWelcome && (
        <button
          onClick={() => navigate('/')}
          style={{
            background: 'transparent', color: '#999', border: 'none',
            padding: '12px 32px', cursor: 'pointer', fontSize: '14px',
            width: '100%', marginTop: '8px',
          }}
        >
          건너뛰기
        </button>
      )}

      {/* 연결된 클럽 정보 */}
      {clubs.filter(c => c.status === 'approved').length > 0 && (
        <div style={{ marginTop: '32px' }}>
          <h2 style={{ fontSize: '18px', marginBottom: '12px' }}>내 클럽</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {clubs.filter(c => c.status === 'approved').map((c) => (
              <div key={c.id} style={{
                border: '1px solid #e0e0e0', borderRadius: '8px', padding: '12px 16px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                background: 'white',
              }}>
                <div>
                  <span style={{ fontWeight: '600' }}>{c.club_name}</span>
                  <span style={{ marginLeft: '8px', fontSize: '12px', color: '#999' }}>
                    {c.role === 'leader' ? '리더' : c.role === 'admin' ? '관리자' : '회원'}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '12px', color: '#999' }}>
                    {new Date(c.joined_at).toLocaleDateString('ko-KR')}
                  </span>
                  {c.role !== 'leader' && (
                    <button
                      onClick={() => handleLeaveClub(c.club_id, c.club_name)}
                      disabled={leavingClubId === c.club_id}
                      style={{
                        background: 'none', border: '1px solid #ef5350', color: '#ef5350',
                        padding: '4px 10px', borderRadius: '4px', cursor: 'pointer',
                        fontSize: '12px', opacity: leavingClubId === c.club_id ? 0.5 : 1,
                      }}
                    >
                      {leavingClubId === c.club_id ? '처리중...' : '탈퇴'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 연결된 조직(협회) 정보 */}
      {orgs.filter(o => o.status === 'approved').length > 0 && (
        <div style={{ marginTop: '32px' }}>
          <h2 style={{ fontSize: '18px', marginBottom: '12px' }}>내 단체(협회)</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {orgs.filter(o => o.status === 'approved').map((o) => (
              <div key={o.id} style={{
                border: '1px solid #e0e0e0', borderRadius: '8px', padding: '12px 16px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                background: 'white',
              }}>
                <div>
                  <span style={{ fontWeight: '600' }}>{o.org_name}</span>
                  <span style={{ marginLeft: '8px', fontSize: '11px', color: '#1976d2', background: '#e3f2fd', padding: '2px 6px', borderRadius: '4px' }}>
                    {ORG_TYPE_LABELS[o.org_type] || o.org_type}
                  </span>
                  <span style={{ marginLeft: '6px', fontSize: '12px', color: '#999' }}>
                    {o.role === 'leader' ? '리더' : o.role === 'admin' ? '관리자' : '회원'}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '12px', color: '#999' }}>
                    {new Date(o.joined_at).toLocaleDateString('ko-KR')}
                  </span>
                  {o.role !== 'leader' && (
                    <button
                      onClick={() => handleLeaveOrg(o.org_id, o.org_name)}
                      disabled={leavingOrgId === o.org_id}
                      style={{
                        background: 'none', border: '1px solid #ef5350', color: '#ef5350',
                        padding: '4px 10px', borderRadius: '4px', cursor: 'pointer',
                        fontSize: '12px', opacity: leavingOrgId === o.org_id ? 0.5 : 1,
                      }}
                    >
                      {leavingOrgId === o.org_id ? '처리중...' : '탈퇴'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="profile-field-row" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
      <label className="profile-field-label" style={{ width: '80px', fontSize: '14px', fontWeight: '600', color: '#333', flexShrink: 0 }}>
        {label}
      </label>
      <div className="profile-field-value" style={{ flex: 1 }}>{children}</div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  border: '1px solid #ddd',
  borderRadius: '8px',
  fontSize: '14px',
  boxSizing: 'border-box',
};
