import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { meetingsApi } from '../api/meetings';
import type { MonthlyMeeting, TournamentBracket, TournamentStanding } from '../types';
import TournamentBracketComponent from '../components/TournamentBracket';

const ROUND_LABELS: Record<number, string> = {
  1: '결승',
  2: '4강',
  4: '8강',
  8: '16강',
  16: '32강',
};

function TournamentPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const meetingId = parseInt(id || '0');

  const [meeting, setMeeting] = useState<MonthlyMeeting | null>(null);
  const [upperBracket, setUpperBracket] = useState<TournamentBracket | null>(null);
  const [lowerBracket, setLowerBracket] = useState<TournamentBracket | null>(null);
  const [upperStandings, setUpperStandings] = useState<TournamentStanding[]>([]);
  const [lowerStandings, setLowerStandings] = useState<TournamentStanding[]>([]);
  const [showStandings, setShowStandings] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [meetingId]);

  const loadData = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      const [meetingData, bracketData] = await Promise.all([
        meetingsApi.getById(meetingId),
        meetingsApi.getTournament(meetingId),
      ]);
      setMeeting(meetingData);
      setUpperBracket(bracketData.upper);
      setLowerBracket(bracketData.lower);

      // 순위 데이터 로드
      try {
        const standingsData = await meetingsApi.getTournamentStandings(meetingId);
        setUpperStandings(standingsData.upper);
        setLowerStandings(standingsData.lower);
      } catch {
        // 순위 데이터 로드 실패해도 무시
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const handleSetWinner = async (matchId: number, winnerId: number) => {
    try {
      await meetingsApi.setTournamentWinner(meetingId, matchId, { winner_id: winnerId });
      await loadData(false); // 로딩 표시 없이 데이터만 갱신
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set winner');
    }
  };

  const handleCloseMeeting = async () => {
    try {
      await meetingsApi.updateStatus(meetingId, 'closed');
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to close meeting');
    }
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  if (!meeting || !upperBracket) {
    return <div className="error">Tournament not found</div>;
  }

  return (
    <div>
      <header className="header">
        <h1 style={{ margin: 0 }}>
          {meeting.name || `${meeting.year}년 ${meeting.month}월 경기`} - 토너먼트
        </h1>
      </header>

      <div className="container">
        {error && <div className="error">{error}</div>}

        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <button
                className="btn btn-secondary"
                onClick={() => navigate(`/meeting/${meetingId}/result`)}
                style={{ marginRight: '10px' }}
              >
                예선 결과
              </button>
            </div>
            {meeting.status === 'tournament' && (
              <button className="btn btn-danger" onClick={handleCloseMeeting}>
                경기 종료
              </button>
            )}
          </div>
        </div>

        <div className="card">
          <h2 className="card-title">🏆 본선 토너먼트 (예선 진출자)</h2>
          <TournamentBracketComponent
            bracket={upperBracket}
            onSetWinner={meeting.status === 'tournament' ? handleSetWinner : undefined}
          />
        </div>

        {lowerBracket && lowerBracket.rounds.length > 0 && (
          <div className="card" style={{ marginTop: '20px' }}>
            <h2 className="card-title">🎯 패자부 토너먼트 (예선 탈락자)</h2>
            <TournamentBracketComponent
              bracket={lowerBracket}
              onSetWinner={meeting.status === 'tournament' ? handleSetWinner : undefined}
            />
          </div>
        )}

        {/* 최종 순위 */}
        {upperStandings.length > 0 && (
          <div className="card" style={{ marginTop: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h2 className="card-title" style={{ margin: 0 }}>🏅 최종 순위</h2>
              <button
                className="btn btn-secondary"
                onClick={() => setShowStandings(!showStandings)}
                style={{ fontSize: '12px', padding: '4px 8px' }}
              >
                {showStandings ? '접기' : '펼치기'}
              </button>
            </div>

            {showStandings && (
              <>
                <h3 style={{ fontSize: '16px', marginBottom: '10px', color: '#1976d2' }}>본선 토너먼트</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
                  <thead>
                    <tr style={{ background: '#f5f5f5' }}>
                      <th style={{ padding: '8px', textAlign: 'center', width: '60px' }}>순위</th>
                      <th style={{ padding: '8px', textAlign: 'left' }}>선수</th>
                      <th style={{ padding: '8px', textAlign: 'center' }}>예선</th>
                      <th style={{ padding: '8px', textAlign: 'center' }}>탈락</th>
                    </tr>
                  </thead>
                  <tbody>
                    {upperStandings.map((s) => (
                      <tr key={s.member_id} style={{ borderBottom: '1px solid #eee', background: s.rank <= 3 ? '#fff8e1' : 'transparent' }}>
                        <td style={{ padding: '8px', textAlign: 'center', fontWeight: s.rank <= 3 ? 'bold' : 'normal' }}>
                          {s.rank === 1 ? '🥇' : s.rank === 2 ? '🥈' : s.rank === 3 ? '🥉' : s.rank + '위'}
                        </td>
                        <td style={{ padding: '8px' }}>{s.member_name}</td>
                        <td style={{ padding: '8px', textAlign: 'center', color: '#666', fontSize: '13px' }}>
                          {s.from_group}조 {s.group_rank}위
                        </td>
                        <td style={{ padding: '8px', textAlign: 'center', color: '#666', fontSize: '13px' }}>
                          {s.eliminated_round === null ? '우승' : (ROUND_LABELS[s.eliminated_round] || s.eliminated_round + '강') + ' 탈락'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {lowerStandings.length > 0 && (
                  <>
                    <h3 style={{ fontSize: '16px', marginBottom: '10px', color: '#7b1fa2' }}>패자부 토너먼트</h3>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: '#f5f5f5' }}>
                          <th style={{ padding: '8px', textAlign: 'center', width: '60px' }}>순위</th>
                          <th style={{ padding: '8px', textAlign: 'left' }}>선수</th>
                          <th style={{ padding: '8px', textAlign: 'center' }}>예선</th>
                          <th style={{ padding: '8px', textAlign: 'center' }}>탈락</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lowerStandings.map((s) => (
                          <tr key={s.member_id} style={{ borderBottom: '1px solid #eee', background: s.rank <= 3 ? '#f3e5f5' : 'transparent' }}>
                            <td style={{ padding: '8px', textAlign: 'center', fontWeight: s.rank <= 3 ? 'bold' : 'normal' }}>
                              {s.rank === 1 ? '🥇' : s.rank === 2 ? '🥈' : s.rank === 3 ? '🥉' : s.rank + '위'}
                            </td>
                            <td style={{ padding: '8px' }}>{s.member_name}</td>
                            <td style={{ padding: '8px', textAlign: 'center', color: '#666', fontSize: '13px' }}>
                              {s.from_group}조 {s.group_rank}위
                            </td>
                            <td style={{ padding: '8px', textAlign: 'center', color: '#666', fontSize: '13px' }}>
                              {s.eliminated_round === null ? '우승' : (ROUND_LABELS[s.eliminated_round] || s.eliminated_round + '강') + ' 탈락'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default TournamentPage;
