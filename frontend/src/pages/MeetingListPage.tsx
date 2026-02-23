import { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { meetingsApi } from '../api/meetings';
import type { MonthlyMeeting, CreateMeetingRequest, MatchFormat, BusuType, TeamMatchFormat, MatchType } from '../types';
import { MATCH_FORMAT_LABELS, BUSU_TYPE_LABELS, TEAM_MATCH_FORMAT_LABELS } from '../types';

const STATUS_LABELS: Record<string, string> = {
  open: '신청 중',
  assigning: '조편성 중',
  assigned: '조편성 완료',
  recording: '경기 기록 중',
  tournament: '토너먼트 진행 중',
  closed: '종료',
};

const formatDateKorean = (dateStr: string | null): string => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
};

export default function MeetingListPage() {
  const navigate = useNavigate();
  const { activeClubId, isAuthenticated, activeEntity } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [meeting, setMeeting] = useState<MonthlyMeeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(searchParams.get('create') === '1');
  const [closedMeetings, setClosedMeetings] = useState<MonthlyMeeting[]>([]);
  const [showClosedMeetings, setShowClosedMeetings] = useState(false);
  const startDateRef = useRef<HTMLInputElement>(null);
  const endDateRef = useRef<HTMLInputElement>(null);
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

  const [formData, setFormData] = useState<CreateMeetingRequest>({
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    name: '',
    start_date: '',
    end_date: '',
    group_count: 4,
    advance_rate: 0.5,
    has_upper_tournament: true,
    has_lower_tournament: false,
    separate_spouses: true,
    use_detailed_score: false,
    match_format: 'best_of_5',
    busu_type: 'local',
    match_type: 'individual',
    team_size: 3,
    team_match_format: 'dd',
  });

  useEffect(() => {
    if (searchParams.get('create') === '1') {
      setShowCreateForm(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    loadCurrentMeeting();
  }, [activeClubId]);

  const loadCurrentMeeting = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await meetingsApi.getCurrent(activeClubId || undefined);
      setMeeting(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load meeting');
    } finally {
      setLoading(false);
    }
  };

  const loadClosedMeetings = async () => {
    try {
      const data = await meetingsApi.getClosed(activeClubId || undefined);
      setClosedMeetings(data);
      setShowClosedMeetings(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load closed meetings');
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError(null);
      setCreating(true);
      const startDate = formData.start_date ? new Date(formData.start_date) : new Date();
      const requestData = {
        ...formData,
        year: startDate.getFullYear(),
        month: startDate.getMonth() + 1,
      };
      const newMeeting = await meetingsApi.create(requestData);
      setMeeting(newMeeting);
      setShowCreateForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create meeting');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!meeting) return;
    const meetingName = meeting.name || `${meeting.year}년 ${meeting.month}월 경기`;
    if (!window.confirm(`"${meetingName}"를 삭제하시겠습니까?\n\n모든 신청자, 조편성, 경기 기록이 삭제됩니다.`)) return;
    try {
      setError(null);
      await meetingsApi.delete(meeting.id);
      setMeeting(null);
      setShowCreateForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete meeting');
    }
  };

  const handleDeleteClosed = async (meetingToDelete: MonthlyMeeting) => {
    const meetingName = meetingToDelete.name || `${meetingToDelete.year}년 ${meetingToDelete.month}월 경기`;
    if (!window.confirm(`"${meetingName}"를 삭제하시겠습니까?\n\n모든 신청자, 조편성, 경기 기록이 삭제됩니다.`)) return;
    try {
      setError(null);
      await meetingsApi.delete(meetingToDelete.id);
      setClosedMeetings(closedMeetings.filter(m => m.id !== meetingToDelete.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete meeting');
    }
  };

  const handleCloseMeeting = async () => {
    if (!meeting) return;
    const meetingName = meeting.name || `${meeting.year}년 ${meeting.month}월 경기`;
    if (!window.confirm(`"${meetingName}"를 종료하시겠습니까?`)) return;
    try {
      setError(null);
      await meetingsApi.updateStatus(meeting.id, 'closed');
      await loadCurrentMeeting();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to close meeting');
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
    if (!meeting || !editingOptions) return;
    try {
      setError(null);
      await meetingsApi.updateOptions(meeting.id, editingOptions);
      setShowOptionsEditor(false);
      setEditingOptions(null);
      await loadCurrentMeeting();
      alert('옵션이 변경되었습니다.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update options');
    }
  };

  if (!isAuthenticated || !activeClubId) {
    return (
      <div style={{ maxWidth: '600px', margin: '40px auto', padding: '0 20px', textAlign: 'center' }}>
        <h2 style={{ marginBottom: '16px' }}>월례회</h2>
        <p style={{ color: '#666' }}>
          {!isAuthenticated
            ? '로그인 후 이용할 수 있습니다.'
            : activeEntity?.type === 'org'
            ? '클럽을 선택해야 월례회를 이용할 수 있습니다.'
            : '클럽에 가입한 후 이용할 수 있습니다.'}
        </p>
      </div>
    );
  }

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  const renderCreateForm = () => (
    <div className="card">
      <h2 className="card-title">새 경기 개최</h2>
      {error && <div className="error" style={{ marginBottom: '15px' }}>{error}</div>}
      <form onSubmit={handleCreate}>
        <div className="form-group" style={{ marginBottom: '15px' }}>
          <label>경기명칭</label>
          <input
            type="text"
            className="form-control"
            value={formData.name || ''}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="예: 2월 정기모임, 신년회 등"
          />
        </div>
        <div style={{ display: 'flex', gap: '15px', marginBottom: '15px' }}>
          <div className="form-group" style={{ flex: '1' }}>
            <label>경기 시작일</label>
            <div
              className="form-control"
              style={{ background: '#fff', cursor: 'pointer' }}
              onClick={() => startDateRef.current?.showPicker()}
            >
              {formData.start_date ? formatDateKorean(formData.start_date) : '날짜 선택'}
            </div>
            <input
              ref={startDateRef}
              type="date"
              value={formData.start_date || ''}
              onChange={(e) => setFormData({ ...formData, start_date: e.target.value, end_date: e.target.value })}
              style={{ position: 'absolute', visibility: 'hidden' }}
            />
          </div>
          <div className="form-group" style={{ flex: '1' }}>
            <label>경기 종료일</label>
            <div
              className="form-control"
              style={{ background: '#fff', cursor: 'pointer' }}
              onClick={() => endDateRef.current?.showPicker()}
            >
              {formData.end_date ? formatDateKorean(formData.end_date) : '날짜 선택'}
            </div>
            <input
              ref={endDateRef}
              type="date"
              value={formData.end_date || ''}
              min={formData.start_date || ''}
              onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
              style={{ position: 'absolute', visibility: 'hidden' }}
            />
          </div>
        </div>
        {/* 경기 유형 선택 */}
        <div style={{ marginBottom: '15px', padding: '10px', background: '#fff3e0', borderRadius: '4px' }}>
          <div style={{ fontWeight: '600', marginBottom: '10px', color: '#e65100' }}>경기 유형</div>
          <div style={{ display: 'flex', gap: '20px', marginBottom: '10px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
              <input
                type="radio"
                checked={formData.match_type === 'individual'}
                onChange={() => setFormData({ ...formData, match_type: 'individual' })}
              />
              개인전
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
              <input
                type="radio"
                checked={formData.match_type === 'team'}
                onChange={() => setFormData({ ...formData, match_type: 'team', team_size: formData.team_size || 3 })}
              />
              단체전 (팀 대항전)
            </label>
          </div>
          {formData.match_type === 'team' && (
            <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
              <div className="form-group" style={{ flex: '1', minWidth: '120px', marginBottom: 0 }}>
                <label>팀당 인원</label>
                <select
                  className="form-control"
                  value={formData.team_size}
                  onChange={(e) => setFormData({ ...formData, team_size: parseInt(e.target.value) })}
                >
                  {[2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>{n}명</option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ flex: '1', minWidth: '180px', marginBottom: 0 }}>
                <label>대항전 형식</label>
                <select
                  className="form-control"
                  value={formData.team_match_format}
                  onChange={(e) => setFormData({ ...formData, team_match_format: e.target.value as TeamMatchFormat })}
                >
                  {Object.entries(TEAM_MATCH_FORMAT_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ flex: '1', minWidth: '80px' }}>
            <label>{formData.match_type === 'team' ? '팀 수' : '조 수'}</label>
            <input
              type="number"
              className="form-control"
              value={formData.group_count}
              onChange={(e) => setFormData({ ...formData, group_count: parseInt(e.target.value) })}
              min={2}
              max={10}
              disabled={formData.match_type === 'team'}
            />
            {formData.match_type === 'team' && (
              <span style={{ fontSize: '11px', color: '#999' }}>참가 인원에 따라 자동 계산</span>
            )}
          </div>
          <div className="form-group" style={{ flex: '1', minWidth: '100px' }}>
            <label>진출률 (%)</label>
            <input
              type="number"
              className="form-control"
              value={formData.advance_rate * 100}
              onChange={(e) => setFormData({ ...formData, advance_rate: parseInt(e.target.value) / 100 })}
              min={10}
              max={100}
              step={10}
              disabled={formData.match_type === 'team'}
            />
          </div>
        </div>

        {/* ITTF 규칙 옵션 */}
        <div style={{ marginBottom: '15px', padding: '10px', background: '#e3f2fd', borderRadius: '4px' }}>
          <div style={{ fontWeight: '600', marginBottom: '10px', color: '#1565c0' }}>경기 설정</div>
          <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', marginBottom: '10px' }}>
            <div className="form-group" style={{ flex: '1', minWidth: '150px', marginBottom: 0 }}>
              <label>부수 기준</label>
              <select
                className="form-control"
                value={formData.busu_type}
                onChange={(e) => setFormData({ ...formData, busu_type: e.target.value as BusuType })}
              >
                <option value="local">지역부수</option>
                <option value="open">오픈부수</option>
              </select>
            </div>
            <div className="form-group" style={{ flex: '1', minWidth: '150px', marginBottom: 0 }}>
              <label>경기 형식</label>
              <select
                className="form-control"
                value={formData.match_format}
                onChange={(e) => setFormData({ ...formData, match_format: e.target.value as MatchFormat })}
              >
                <option value="best_of_3">3판 2선승</option>
                <option value="best_of_5">5판 3선승</option>
                <option value="best_of_7">7판 4선승</option>
              </select>
            </div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={formData.use_detailed_score ?? false}
              onChange={(e) => setFormData({ ...formData, use_detailed_score: e.target.checked })}
            />
            <span>세트별 상세 점수 입력 (11점제, 듀스 규칙 적용)</span>
          </label>
        </div>

        {/* 기타 옵션 */}
        <div style={{ marginBottom: '15px', padding: '10px', background: '#f9f9f9', borderRadius: '4px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={formData.separate_spouses ?? true}
              onChange={(e) => setFormData({ ...formData, separate_spouses: e.target.checked })}
            />
            <span>부부 다른 조에 편성</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={formData.has_lower_tournament ?? false}
              onChange={(e) => setFormData({ ...formData, has_lower_tournament: e.target.checked })}
            />
            <span>패자부 토너먼트 개최</span>
          </label>
        </div>

        <button type="submit" className="btn btn-primary" style={{ marginRight: '10px' }} disabled={creating}>
          {creating ? '생성 중...' : '생성'}
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => setShowCreateForm(false)} disabled={creating}>
          취소
        </button>
      </form>
    </div>
  );

  return (
    <div>
      <div className="container">
        {error && <div className="error">{error}</div>}

        {meeting ? (
          <>
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h2 className="card-title" style={{ marginBottom: '10px' }}>
                    {meeting.name || `${meeting.year}년 ${meeting.month}월 경기`}
                  </h2>
                  <div style={{ marginBottom: '10px' }}>
                    <span className={`badge badge-${meeting.status === 'closed' ? 'secondary' : 'primary'}`}>
                      {STATUS_LABELS[meeting.status] || meeting.status}
                    </span>
                  </div>
                  {meeting.match_type === 'team' ? (
                    <>
                      <p>경기 유형: 단체전 (팀 대항전)</p>
                      <p>팀 수: {meeting.group_count}개 | 팀당 {meeting.team_size}명</p>
                      <p>대항전 형식: {TEAM_MATCH_FORMAT_LABELS[meeting.team_match_format] || meeting.team_match_format}</p>
                    </>
                  ) : (
                    <>
                      <p>조 수: {meeting.group_count}개</p>
                      <p>진출률: {meeting.advance_rate * 100}%</p>
                    </>
                  )}
                  <p>부수 기준: {BUSU_TYPE_LABELS[meeting.busu_type] || '지역부수'}</p>
                  <p>경기 형식: {MATCH_FORMAT_LABELS[meeting.match_format] || meeting.match_format}</p>
                  {(meeting.start_date || meeting.end_date) && (
                    <p>경기 기간: {formatDateKorean(meeting.start_date)}{meeting.start_date && meeting.end_date ? ' ~ ' : ''}{formatDateKorean(meeting.end_date)}</p>
                  )}
                  <div style={{ marginTop: '10px' }}>
                    {!!meeting.separate_spouses && <span className="badge badge-success" style={{ marginRight: '5px' }}>부부 다른 조</span>}
                    {!!meeting.has_lower_tournament && <span className="badge badge-warning" style={{ marginRight: '5px' }}>패자부 토너먼트</span>}
                    {!!meeting.use_detailed_score && <span className="badge badge-primary">세트별 점수 입력</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  {meeting.status !== 'closed' && (
                    <button
                      className="btn btn-secondary"
                      onClick={handleCloseMeeting}
                      style={{ fontSize: '12px', padding: '4px 8px' }}
                    >
                      경기 종료
                    </button>
                  )}
                  <button
                    className="btn btn-danger"
                    onClick={handleDelete}
                    style={{ fontSize: '12px', padding: '4px 8px' }}
                  >
                    삭제
                  </button>
                </div>
              </div>

              <div style={{ marginTop: '20px', borderTop: '1px solid #eee', paddingTop: '15px' }}>
                {meeting.status !== 'closed' && (
                  <button
                    className="btn btn-secondary"
                    onClick={handleOpenOptionsEditor}
                    style={{ marginRight: '10px' }}
                  >
                    옵션 변경
                  </button>
                )}
                <button
                  className="btn btn-primary"
                  onClick={() => navigate(`/meeting/${meeting.id}`)}
                  style={{ marginRight: '10px' }}
                >
                  경기 관리
                </button>
                {(meeting.status === 'recording' || meeting.status === 'tournament' || meeting.status === 'closed') && (
                  <button
                    className="btn btn-secondary"
                    onClick={() => navigate(`/meeting/${meeting.id}/result`)}
                    style={{ marginRight: '10px' }}
                  >
                    예선 결과
                  </button>
                )}
                {(meeting.status === 'tournament' || meeting.status === 'closed') && (
                  <button
                    className="btn btn-secondary"
                    onClick={() => navigate(`/meeting/${meeting.id}/tournament`)}
                  >
                    토너먼트
                  </button>
                )}
              </div>
            </div>

            {!showCreateForm ? (
              <div className="card">
                <button className="btn btn-success" onClick={() => setShowCreateForm(true)}>
                  새 경기 생성
                </button>
                <span style={{ marginLeft: '10px', color: '#666', fontSize: '13px' }}>
                  (현재 경기와 별도로 새로운 경기를 생성합니다)
                </span>
              </div>
            ) : (
              renderCreateForm()
            )}
          </>
        ) : (
          <>
            {!showCreateForm ? (
              <div className="card">
                <h2 className="card-title">진행 중인 경기가 없습니다</h2>
                <button className="btn btn-primary" onClick={() => setShowCreateForm(true)}>
                  새 경기 생성
                </button>
              </div>
            ) : (
              renderCreateForm()
            )}
          </>
        )}

        {/* 이전 경기 목록 */}
        <div className="card" style={{ marginTop: '20px' }}>
          {!showClosedMeetings ? (
            <button className="btn btn-secondary" onClick={loadClosedMeetings}>
              이전 경기 목록 보기
            </button>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h2 className="card-title" style={{ margin: 0 }}>이전 경기 목록</h2>
                <button className="btn btn-secondary" onClick={() => setShowClosedMeetings(false)} style={{ fontSize: '12px', padding: '4px 8px' }}>
                  닫기
                </button>
              </div>
              {closedMeetings.length === 0 ? (
                <p style={{ color: '#666' }}>종료된 경기가 없습니다.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {closedMeetings.map((m) => (
                    <div
                      key={m.id}
                      style={{
                        padding: '12px',
                        background: '#f9f9f9',
                        borderRadius: '4px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div>
                        <strong>{m.name || `${m.year}년 ${m.month}월 경기`}</strong>
                        {(m.start_date || m.end_date) && (
                          <span style={{ marginLeft: '10px', color: '#666', fontSize: '13px' }}>
                            {formatDateKorean(m.start_date)}{m.start_date && m.end_date ? ' ~ ' : ''}{formatDateKorean(m.end_date)}
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '5px' }}>
                        <button
                          className="btn btn-secondary"
                          onClick={() => navigate(`/meeting/${m.id}/result`)}
                          style={{ fontSize: '12px', padding: '4px 8px' }}
                        >
                          예선 결과
                        </button>
                        <button
                          className="btn btn-secondary"
                          onClick={() => navigate(`/meeting/${m.id}/tournament`)}
                          style={{ fontSize: '12px', padding: '4px 8px' }}
                        >
                          토너먼트
                        </button>
                        <button
                          className="btn btn-danger"
                          onClick={() => handleDeleteClosed(m)}
                          style={{ fontSize: '12px', padding: '4px 8px' }}
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
        {/* 옵션 편집 모달 */}
        {showOptionsEditor && editingOptions && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            zIndex: 1000,
          }}>
            <div className="card" style={{
              backgroundColor: 'white', padding: '20px', borderRadius: '8px',
              minWidth: '400px', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto',
            }}>
              <h2 className="card-title">경기 옵션 변경</h2>

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
                  onClick={() => { setShowOptionsEditor(false); setEditingOptions(null); }}
                >
                  취소
                </button>
                <button className="btn btn-primary" onClick={handleUpdateOptions}>
                  변경 저장
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
