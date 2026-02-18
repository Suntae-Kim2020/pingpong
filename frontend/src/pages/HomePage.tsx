import { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { meetingsApi } from '../api/meetings';
import YouTubeVideoSection from '../components/YouTubeVideoSection';
import type { MonthlyMeeting, CreateMeetingRequest, MatchFormat, BusuType, TeamMatchFormat } from '../types';
import { MATCH_FORMAT_LABELS, BUSU_TYPE_LABELS, TEAM_MATCH_FORMAT_LABELS } from '../types';

const STATUS_LABELS: Record<string, string> = {
  open: '신청 중',
  assigning: '조편성 중',
  assigned: '조편성 완료',
  recording: '경기 기록 중',
  tournament: '토너먼트 진행 중',
  closed: '종료',
};

// 날짜를 "2025년 2월 3일" 형식으로 변환
const formatDateKorean = (dateStr: string | null): string => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${year}년 ${month}월 ${day}일`;
};

function HomePage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [meeting, setMeeting] = useState<MonthlyMeeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(searchParams.get('create') === '1');
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
  const startDateRef = useRef<HTMLInputElement>(null);
  const endDateRef = useRef<HTMLInputElement>(null);
  const [closedMeetings, setClosedMeetings] = useState<MonthlyMeeting[]>([]);
  const [showClosedMeetings, setShowClosedMeetings] = useState(false);

  useEffect(() => {
    loadCurrentMeeting();
  }, []);

  // NavBar에서 ?create=1로 이동 시 폼 자동 오픈
  useEffect(() => {
    if (searchParams.get('create') === '1') {
      setShowCreateForm(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const loadClosedMeetings = async () => {
    try {
      const data = await meetingsApi.getClosed();
      setClosedMeetings(data);
      setShowClosedMeetings(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load closed meetings');
    }
  };

  const handleDeleteClosed = async (meetingToDelete: MonthlyMeeting) => {
    const meetingName = meetingToDelete.name || `${meetingToDelete.year}년 ${meetingToDelete.month}월 경기`;
    const confirmed = window.confirm(
      `"${meetingName}"를 삭제하시겠습니까?\n\n모든 신청자, 조편성, 경기 기록이 삭제됩니다.`
    );

    if (!confirmed) return;

    try {
      setError(null);
      await meetingsApi.delete(meetingToDelete.id);
      setClosedMeetings(closedMeetings.filter(m => m.id !== meetingToDelete.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete meeting');
    }
  };

  const loadCurrentMeeting = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await meetingsApi.getCurrent();
      setMeeting(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load meeting');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError(null);
      setCreating(true);
      // start_date에서 year, month 자동 추출
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
      const errorMessage = err instanceof Error ? err.message : 'Failed to create meeting';
      setError(errorMessage);
      console.error('Create meeting error:', err);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!meeting) return;

    const meetingName = meeting.name || `${meeting.year}년 ${meeting.month}월 경기`;
    const confirmed = window.confirm(
      `"${meetingName}"를 삭제하시겠습니까?\n\n모든 신청자, 조편성, 경기 기록이 삭제됩니다.`
    );

    if (!confirmed) return;

    try {
      setError(null);
      await meetingsApi.delete(meeting.id);
      setMeeting(null);
      setShowCreateForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete meeting');
    }
  };

  const handleCloseMeeting = async () => {
    if (!meeting) return;

    const meetingName = meeting.name || `${meeting.year}년 ${meeting.month}월 경기`;
    const confirmed = window.confirm(
      `"${meetingName}"를 종료하시겠습니까?`
    );

    if (!confirmed) return;

    try {
      setError(null);
      await meetingsApi.updateStatus(meeting.id, 'closed');
      await loadCurrentMeeting();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to close meeting');
    }
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  // 생성 폼 렌더링
  const renderCreateForm = () => (
    <div className="card">
      <h2 className="card-title">새 경기 개최</h2>
      {error && (
        <div className="error" style={{ marginBottom: '15px' }}>
          {error}
        </div>
      )}
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
              onChange={(e) => {
                const newStartDate = e.target.value;
                setFormData({
                  ...formData,
                  start_date: newStartDate,
                  end_date: newStartDate
                });
              }}
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

        <button
          type="submit"
          className="btn btn-primary"
          style={{ marginRight: '10px' }}
          disabled={creating}
        >
          {creating ? '생성 중...' : '생성'}
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => setShowCreateForm(false)}
          disabled={creating}
        >
          취소
        </button>
      </form>
    </div>
  );

  return (
    <div>
      <div className="container">
        <YouTubeVideoSection />
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

            {/* 새 경기 생성 버튼 또는 폼 */}
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
      </div>
    </div>
  );
}

export default HomePage;
