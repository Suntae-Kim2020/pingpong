import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { meetingsApi, membersApi } from '../api/meetings';
import type { MonthlyMeeting, Member, ApplicantWithMember, GroupWithMembers, MatchFormat, BusuType, MatchType, TeamMatchFormat } from '../types';
import { MATCH_FORMAT_LABELS, BUSU_TYPE_LABELS, TEAM_MATCH_FORMAT_LABELS } from '../types';
import ApplicantList from '../components/ApplicantList';
import GroupCard from '../components/GroupCard';

const STATUS_LABELS: Record<string, string> = {
  open: '신청 중',
  assigning: '조편성 중',
  assigned: '조편성 완료',
  recording: '경기 기록 중',
  tournament: '토너먼트 진행 중',
  closed: '종료',
};

function MeetingPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const meetingId = parseInt(id || '0');

  const [meeting, setMeeting] = useState<MonthlyMeeting | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [applicants, setApplicants] = useState<ApplicantWithMember[]>([]);
  const [groups, setGroups] = useState<GroupWithMembers[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showOptionsEditor, setShowOptionsEditor] = useState(false);
  const [editingOptions, setEditingOptions] = useState<{
    group_count: number;
    advance_rate: number;
    separate_spouses: boolean;
    use_detailed_score: boolean;
    match_format: MatchFormat;
    busu_type: BusuType;
    has_lower_tournament: boolean;
    match_type: MatchType;
    team_size: number;
    team_match_format: TeamMatchFormat;
  } | null>(null);

  useEffect(() => {
    loadData();
  }, [meetingId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [meetingData, membersData, applicantsData] = await Promise.all([
        meetingsApi.getById(meetingId),
        membersApi.getAll(),
        meetingsApi.getApplicants(meetingId),
      ]);
      setMeeting(meetingData);
      setMembers(membersData);
      setApplicants(applicantsData);

      if (meetingData.status !== 'open') {
        const groupsData = await meetingsApi.getGroups(meetingId);
        setGroups(groupsData);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async (memberId: number, isLate: boolean = false) => {
    try {
      const result = await meetingsApi.apply(meetingId, { member_id: memberId, is_late: isLate });
      await loadData();

      // 늦참자 자동 배정 결과 알림
      if (result.assigned_group) {
        const member = members.find(m => m.id === memberId);
        alert(`${member?.name || '회원'}님이 ${result.assigned_group}조에 자동 배정되었습니다.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply');
    }
  };

  const handleApplyBulk = async (memberIds: number[], isLate: boolean = false) => {
    try {
      const result = await meetingsApi.applyBulk(meetingId, { member_ids: memberIds, is_late: isLate });
      await loadData();

      // 늦참자 자동 배정 결과 알림
      if (result.assigned_groups && result.assigned_groups.length > 0) {
        const assignments = result.assigned_groups.map((a: { member_id: number; group: number }) => {
          const member = members.find(m => m.id === a.member_id);
          return `${member?.name || '회원'} → ${a.group}조`;
        });
        alert(`늦참자 자동 배정 완료:\n${assignments.join('\n')}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply');
    }
  };

  const handleCancelApply = async (memberId: number) => {
    try {
      await meetingsApi.cancelApply(meetingId, memberId);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel');
    }
  };

  const handleAssignGroups = async () => {
    try {
      await meetingsApi.assignGroups(meetingId);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign groups');
    }
  };

  const handleCompleteAssignment = async () => {
    try {
      await meetingsApi.completeAssignment(meetingId);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete assignment');
    }
  };

  const handleReassign = async (memberId: number, newGroup: number) => {
    try {
      await meetingsApi.reassignMember(meetingId, memberId, newGroup);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reassign');
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    try {
      await meetingsApi.updateStatus(meetingId, newStatus);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status');
    }
  };

  const handleOpenOptionsEditor = () => {
    if (meeting) {
      setEditingOptions({
        group_count: meeting.group_count,
        advance_rate: meeting.advance_rate,
        separate_spouses: meeting.separate_spouses,
        use_detailed_score: meeting.use_detailed_score,
        match_format: meeting.match_format,
        busu_type: meeting.busu_type,
        has_lower_tournament: meeting.has_lower_tournament,
        match_type: meeting.match_type || 'individual',
        team_size: meeting.team_size || 3,
        team_match_format: meeting.team_match_format || 'dd',
      });
      setShowOptionsEditor(true);
    }
  };

  const handleUpdateOptions = async () => {
    if (!editingOptions) return;
    try {
      await meetingsApi.updateOptions(meetingId, editingOptions);
      setShowOptionsEditor(false);
      setEditingOptions(null);
      await loadData();
      alert('옵션이 변경되었습니다. 조편성이 다시 실행되었습니다.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update options');
    }
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  if (!meeting) {
    return <div className="error">Meeting not found</div>;
  }

  const appliedMemberIds = new Set(applicants.map((a) => a.member_id));
  const availableMembers = members.filter((m) => m.is_active && !appliedMemberIds.has(m.id));

  return (
    <div>
      <header className="header">
        <h1 style={{ margin: 0 }}>
          {meeting.name || `${meeting.year}년 ${meeting.month}월 경기`}
        </h1>
      </header>

      <div className="container">
        {error && <div className="error">{error}</div>}

        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span className={`badge badge-primary`} style={{ marginRight: '10px' }}>
                {STATUS_LABELS[meeting.status]}
              </span>
              <span>
                {meeting.match_type === 'team'
                  ? `팀 ${meeting.group_count}개 | 팀당 ${meeting.team_size}명 | ${TEAM_MATCH_FORMAT_LABELS[meeting.team_match_format] || meeting.team_match_format}`
                  : `조 ${meeting.group_count}개 | 진출률 ${meeting.advance_rate * 100}%`
                }
              </span>
              <div style={{ marginTop: '5px', fontSize: '13px', color: '#666' }}>
                {meeting.match_type === 'team'
                  ? <span className="badge badge-primary" style={{ marginRight: '5px' }}>단체전</span>
                  : <span className="badge badge-success" style={{ marginRight: '5px' }}>개인전</span>
                }
                {meeting.match_type === 'individual' && !!meeting.separate_spouses && <span className="badge badge-success" style={{ marginRight: '5px' }}>부부 다른 조</span>}
                {meeting.match_type === 'individual' && !!meeting.has_lower_tournament && <span className="badge badge-warning">패자부 토너먼트</span>}
              </div>
            </div>
            <div>
              {meeting.status === 'recording' && (
                <button
                  className="btn btn-primary"
                  onClick={() => navigate(`/meeting/${meetingId}/result`)}
                >
                  경기 기록
                </button>
              )}
            </div>
          </div>
        </div>

        {meeting.status === 'open' && (
          <>
            <ApplicantList
              applicants={applicants}
              availableMembers={availableMembers}
              allMembers={members}
              onApply={handleApply}
              onApplyBulk={handleApplyBulk}
              onCancel={handleCancelApply}
            />
            <div className="card">
              <button
                className="btn btn-primary"
                onClick={handleAssignGroups}
                disabled={applicants.length < meeting.group_count * 2}
              >
                조편성 시작
              </button>
            </div>
          </>
        )}

        {(meeting.status === 'assigning' || meeting.status === 'assigned') && (
          <>
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h2 className="card-title" style={{ margin: 0 }}>조편성</h2>
                <button className="btn btn-secondary" onClick={handleOpenOptionsEditor}>
                  옵션 변경
                </button>
              </div>
              <div className="flex flex-wrap gap-4">
                {groups.map((group) => (
                  <GroupCard
                    key={group.group_num}
                    group={group}
                    allGroups={groups}
                    onReassign={meeting.status === 'assigning' ? handleReassign : undefined}
                    busuType={meeting.busu_type}
                  />
                ))}
              </div>
            </div>
            {meeting.status === 'assigning' && (
              <div className="card">
                <button className="btn btn-success" onClick={handleCompleteAssignment}>
                  조편성 확정
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={handleAssignGroups}
                  style={{ marginLeft: '10px' }}
                >
                  다시 배정
                </button>
              </div>
            )}
            {meeting.status === 'assigned' && (
              <div className="card">
                <button className="btn btn-primary" onClick={() => handleStatusChange('recording')}>
                  경기 기록 시작
                </button>
              </div>
            )}
          </>
        )}

        {/* 옵션 편집 모달 */}
        {showOptionsEditor && editingOptions && (
          <div className="modal-overlay" style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
          }}>
            <div className="modal-content card" style={{
              backgroundColor: 'white',
              padding: '20px',
              borderRadius: '8px',
              minWidth: '400px',
              maxWidth: '500px',
            }}>
              <h2 className="card-title">경기 옵션 변경</h2>
              <p style={{ color: '#666', fontSize: '13px', marginBottom: '15px' }}>
                옵션 변경 시 조편성이 자동으로 다시 실행됩니다.
              </p>

              <div className="form-group" style={{ marginBottom: '15px' }}>
                <label>경기 유형</label>
                <div style={{ display: 'flex', gap: '20px', marginTop: '5px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <input
                      type="radio"
                      checked={editingOptions.match_type === 'individual'}
                      onChange={() => setEditingOptions({ ...editingOptions, match_type: 'individual' })}
                    />
                    개인전
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <input
                      type="radio"
                      checked={editingOptions.match_type === 'team'}
                      onChange={() => setEditingOptions({ ...editingOptions, match_type: 'team', team_size: editingOptions.team_size || 3 })}
                    />
                    단체전 (팀 대항전)
                  </label>
                </div>
              </div>

              {editingOptions.match_type === 'team' && (
                <>
                  <div className="form-group" style={{ marginBottom: '15px' }}>
                    <label>팀당 인원</label>
                    <select
                      value={editingOptions.team_size}
                      onChange={(e) => setEditingOptions({ ...editingOptions, team_size: parseInt(e.target.value) })}
                      style={{ width: '100%', padding: '8px' }}
                    >
                      {[2, 3, 4, 5].map((n) => (
                        <option key={n} value={n}>{n}명</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group" style={{ marginBottom: '15px' }}>
                    <label>대항전 형식</label>
                    <select
                      value={editingOptions.team_match_format}
                      onChange={(e) => setEditingOptions({ ...editingOptions, team_match_format: e.target.value as TeamMatchFormat })}
                      style={{ width: '100%', padding: '8px' }}
                    >
                      {Object.entries(TEAM_MATCH_FORMAT_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              <div className="form-group" style={{ marginBottom: '15px' }}>
                <label>{editingOptions.match_type === 'team' ? '팀 수' : '조 개수'}</label>
                <select
                  value={editingOptions.group_count}
                  onChange={(e) => setEditingOptions({ ...editingOptions, group_count: parseInt(e.target.value) })}
                  style={{ width: '100%', padding: '8px' }}
                  disabled={editingOptions.match_type === 'team'}
                >
                  {[2, 3, 4, 5, 6, 7, 8].map((n) => (
                    <option key={n} value={n}>{n}개</option>
                  ))}
                </select>
                {editingOptions.match_type === 'team' && (
                  <p style={{ fontSize: '12px', color: '#999', marginTop: '3px' }}>단체전에서는 참가 인원에 따라 자동 계산됩니다.</p>
                )}
              </div>

              <div className="form-group" style={{ marginBottom: '15px' }}>
                <label>진출률</label>
                <select
                  value={editingOptions.advance_rate}
                  onChange={(e) => setEditingOptions({ ...editingOptions, advance_rate: parseFloat(e.target.value) })}
                  style={{ width: '100%', padding: '8px' }}
                >
                  <option value={0.25}>25% (조당 1명)</option>
                  <option value={0.33}>33% (조당 1~2명)</option>
                  <option value={0.5}>50% (조당 2명)</option>
                  <option value={0.67}>67% (조당 2~3명)</option>
                  <option value={0.75}>75% (조당 3명)</option>
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: '15px' }}>
                <label>부수 기준</label>
                <select
                  value={editingOptions.busu_type}
                  onChange={(e) => setEditingOptions({ ...editingOptions, busu_type: e.target.value as BusuType })}
                  style={{ width: '100%', padding: '8px' }}
                >
                  {Object.entries(BUSU_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: '15px' }}>
                <label>경기 방식</label>
                <select
                  value={editingOptions.match_format}
                  onChange={(e) => setEditingOptions({ ...editingOptions, match_format: e.target.value as MatchFormat })}
                  style={{ width: '100%', padding: '8px' }}
                >
                  {Object.entries(MATCH_FORMAT_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: '15px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <input
                    type="checkbox"
                    checked={editingOptions.separate_spouses}
                    onChange={(e) => setEditingOptions({ ...editingOptions, separate_spouses: e.target.checked })}
                  />
                  부부 다른 조
                </label>
              </div>

              <div className="form-group" style={{ marginBottom: '15px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <input
                    type="checkbox"
                    checked={editingOptions.use_detailed_score}
                    onChange={(e) => setEditingOptions({ ...editingOptions, use_detailed_score: e.target.checked })}
                  />
                  세트별 점수 입력
                </label>
              </div>

              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <input
                    type="checkbox"
                    checked={editingOptions.has_lower_tournament}
                    onChange={(e) => setEditingOptions({ ...editingOptions, has_lower_tournament: e.target.checked })}
                  />
                  패자부 토너먼트
                </label>
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowOptionsEditor(false);
                    setEditingOptions(null);
                  }}
                >
                  취소
                </button>
                <button className="btn btn-primary" onClick={handleUpdateOptions}>
                  변경 및 조편성 다시하기
                </button>
              </div>
            </div>
          </div>
        )}

        {meeting.status === 'recording' && (
          <div className="card">
            <h2 className="card-title">조편성 완료</h2>
            <div className="flex flex-wrap gap-4">
              {groups.map((group) => (
                <GroupCard key={group.group_num} group={group} allGroups={groups} busuType={meeting.busu_type} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default MeetingPage;
