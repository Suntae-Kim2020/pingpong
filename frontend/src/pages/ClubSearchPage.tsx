import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { clubsApi, regionsApi, Club, Region, CheckNameResult } from '../api/clubs';

import '../styles/ClubSearchPage.css';

export default function ClubSearchPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  // 검색 상태
  const [keyword, setKeyword] = useState('');
  const [selectedRegionId, setSelectedRegionId] = useState<number | null>(null);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 지역 선택 상태
  const [provinces, setProvinces] = useState<Region[]>([]);
  const [cities, setCities] = useState<Region[]>([]);
  const [districts, setDistricts] = useState<Region[]>([]);
  const [selectedProvince, setSelectedProvince] = useState<number | null>(null);
  const [selectedCity, setSelectedCity] = useState<number | null>(null);

  // 클럽 생성 모달 상태
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    description: '',
    address: '',
    joinType: 'approval' as 'open' | 'approval' | 'invite',
  });
  const [checkResult, setCheckResult] = useState<CheckNameResult | null>(null);
  const [creating, setCreating] = useState(false);

  // 초기 지역 로드 (시/도)
  useEffect(() => {
    regionsApi.getByLevel('province').then(setProvinces).catch(console.error);
    // 초기 인기 클럽 로드
    handleSearch();
  }, []);

  // 시/도 선택 시 시/군/구 로드
  useEffect(() => {
    if (selectedProvince) {
      regionsApi.getChildren(selectedProvince).then((data) => {
        setCities(data);
        setDistricts([]);
        setSelectedCity(null);
        setSelectedRegionId(selectedProvince);
      });
    } else {
      setCities([]);
      setDistricts([]);
      setSelectedCity(null);
      setSelectedRegionId(null);
    }
  }, [selectedProvince]);

  // 시/군/구 선택 시 구/동 로드
  useEffect(() => {
    if (selectedCity) {
      regionsApi.getChildren(selectedCity).then(setDistricts);
      setSelectedRegionId(selectedCity);
    } else {
      setDistricts([]);
      if (selectedProvince) {
        setSelectedRegionId(selectedProvince);
      }
    }
  }, [selectedCity, selectedProvince]);

  const handleSearch = async () => {
    setLoading(true);
    setError(null);
    try {
      const results = await clubsApi.search({
        keyword: keyword || undefined,
        regionId: selectedRegionId || undefined,
      });
      setClubs(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  // 클럽 이름 중복 확인
  const handleCheckName = async () => {
    if (!createForm.name || !selectedRegionId) {
      alert('클럽명과 지역을 먼저 선택해주세요.');
      return;
    }

    try {
      const result = await clubsApi.checkName(createForm.name, selectedRegionId);
      setCheckResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Check failed');
    }
  };

  // 클럽 생성
  const handleCreate = async () => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    if (!createForm.name || !selectedRegionId) {
      alert('클럽명과 지역을 선택해주세요.');
      return;
    }

    setCreating(true);
    try {
      const club = await clubsApi.create({
        name: createForm.name,
        regionId: selectedRegionId,
        description: createForm.description || undefined,
        address: createForm.address || undefined,
        joinType: createForm.joinType,
      });

      alert(`"${club.name}" 클럽이 생성되었습니다!`);
      setShowCreateModal(false);
      setCreateForm({ name: '', description: '', address: '', joinType: 'approval' });
      setCheckResult(null);
      handleSearch();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setCreating(false);
    }
  };

  // 클럽 가입
  const handleJoin = async (club: Club) => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    try {
      const result = await clubsApi.join(club.id);
      alert(result.message);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Join failed');
    }
  };

  return (
    <div>
      <div className="container">
        {/* 검색 영역 */}
        <div className="card search-card">
          <div className="search-row">
            <input
              type="text"
              className="form-control search-input"
              placeholder="클럽명으로 검색"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <button className="btn btn-primary" onClick={handleSearch}>
              검색
            </button>
          </div>

          <div className="region-select-row">
            <select
              className="form-control"
              value={selectedProvince || ''}
              onChange={(e) => setSelectedProvince(e.target.value ? parseInt(e.target.value) : null)}
            >
              <option value="">시/도 전체</option>
              {provinces.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>

            {cities.length > 0 && (
              <select
                className="form-control"
                value={selectedCity || ''}
                onChange={(e) => setSelectedCity(e.target.value ? parseInt(e.target.value) : null)}
              >
                <option value="">시/군/구 전체</option>
                {cities.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            )}

            {districts.length > 0 && (
              <select
                className="form-control"
                value={selectedRegionId === selectedCity ? '' : selectedRegionId || ''}
                onChange={(e) => setSelectedRegionId(e.target.value ? parseInt(e.target.value) : selectedCity)}
              >
                <option value="">구/동 전체</option>
                {districts.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* 클럽 생성 버튼 */}
        <div className="create-club-section">
          <span>찾는 클럽이 없나요?</span>
          <button
            className="btn btn-success"
            onClick={() => {
              if (!isAuthenticated) {
                navigate('/login');
                return;
              }
              setShowCreateModal(true);
            }}
          >
            새 클럽 만들기
          </button>
        </div>

        {/* 에러 메시지 */}
        {error && <div className="error">{error}</div>}

        {/* 검색 결과 */}
        <div className="club-list">
          {loading ? (
            <div className="loading">검색 중...</div>
          ) : clubs.length === 0 ? (
            <div className="empty-state">
              <p>검색 결과가 없습니다.</p>
              <p>새로운 클럽을 만들어보세요!</p>
            </div>
          ) : (
            clubs.map((club) => (
              <div key={club.id} className="club-card">
                <div className="club-info">
                  <h3 className="club-name">{club.name}</h3>
                  {club.region_name && (
                    <span className="club-region">{club.region_name}</span>
                  )}
                  {club.description && (
                    <p className="club-description">{club.description}</p>
                  )}
                  <div className="club-meta">
                    <span>회원 {club.member_count}명</span>
                    <span className={`join-type ${club.join_type}`}>
                      {club.join_type === 'open' ? '자유가입' :
                       club.join_type === 'approval' ? '승인제' : '초대제'}
                    </span>
                  </div>
                </div>
                <div className="club-actions">
                  <button
                    className="btn btn-primary"
                    onClick={() => handleJoin(club)}
                  >
                    가입하기
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 클럽 생성 모달 */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>새 클럽 만들기</h2>

            <div className="form-group">
              <label>클럽명 *</label>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input
                  type="text"
                  className="form-control"
                  value={createForm.name}
                  onChange={(e) => {
                    setCreateForm({ ...createForm, name: e.target.value });
                    setCheckResult(null);
                  }}
                  placeholder="클럽명을 입력하세요"
                />
                <button
                  className="btn btn-secondary"
                  onClick={handleCheckName}
                  disabled={!createForm.name || !selectedRegionId}
                >
                  중복확인
                </button>
              </div>
            </div>

            {/* 중복 확인 결과 */}
            {checkResult && (
              <div className={`check-result ${checkResult.exactMatch ? 'warning' : 'success'}`}>
                {checkResult.exactMatch ? (
                  <>
                    <strong>동일한 이름의 클럽이 이미 있습니다:</strong>
                    <ul>
                      {checkResult.exactMatches.map((c) => (
                        <li key={c.id}>{c.name} ({c.region_name})</li>
                      ))}
                    </ul>
                  </>
                ) : checkResult.similarClubs.length > 0 ? (
                  <>
                    <strong>비슷한 이름의 클럽:</strong>
                    <ul>
                      {checkResult.similarClubs.map((c) => (
                        <li key={c.id}>{c.name} ({c.region_name})</li>
                      ))}
                    </ul>
                    <p style={{ color: '#2d6a4f', marginTop: '8px' }}>
                      위 클럽이 아니라면 새로 만들 수 있습니다.
                    </p>
                  </>
                ) : (
                  <p style={{ color: '#2d6a4f' }}>사용 가능한 클럽명입니다!</p>
                )}
              </div>
            )}

            <div className="form-group">
              <label>지역 *</label>
              <p style={{ fontSize: '13px', color: '#666', margin: '4px 0 8px' }}>
                위 검색 영역에서 지역을 선택해주세요.
                {selectedRegionId && provinces.find(p => p.id === selectedProvince) && (
                  <strong style={{ color: '#333' }}>
                    {' '}선택됨: {provinces.find(p => p.id === selectedProvince)?.name}
                    {selectedCity && cities.find(c => c.id === selectedCity) && ` > ${cities.find(c => c.id === selectedCity)?.name}`}
                  </strong>
                )}
              </p>
            </div>

            <div className="form-group">
              <label>클럽 소개</label>
              <textarea
                className="form-control"
                value={createForm.description}
                onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                placeholder="클럽 소개를 입력하세요"
                rows={3}
              />
            </div>

            <div className="form-group">
              <label>활동 장소</label>
              <input
                type="text"
                className="form-control"
                value={createForm.address}
                onChange={(e) => setCreateForm({ ...createForm, address: e.target.value })}
                placeholder="예: OO탁구장, OO체육관"
              />
            </div>

            <div className="form-group">
              <label>가입 방식</label>
              <select
                className="form-control"
                value={createForm.joinType}
                onChange={(e) => setCreateForm({ ...createForm, joinType: e.target.value as any })}
              >
                <option value="open">자유가입 (누구나 즉시 가입)</option>
                <option value="approval">승인제 (관리자 승인 필요)</option>
                <option value="invite">초대제 (초대받은 사람만)</option>
              </select>
            </div>

            <div className="modal-actions">
              <button
                className="btn btn-secondary"
                onClick={() => setShowCreateModal(false)}
              >
                취소
              </button>
              <button
                className="btn btn-primary"
                onClick={handleCreate}
                disabled={creating || !createForm.name || !selectedRegionId}
              >
                {creating ? '생성 중...' : '클럽 만들기'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
