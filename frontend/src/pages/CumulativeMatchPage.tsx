import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { clubsApi } from '../api/clubs';
import { cumulativeMatchApi, CumulativeMatchRecord, CumulativeMatchStats } from '../api/cumulativeMatch';
import type { MembershipWithUser } from '../types';

type Tab = 'input' | 'mystats' | 'history';

export default function CumulativeMatchPage() {
  const { clubId: clubIdParam } = useParams<{ clubId: string }>();
  const clubId = parseInt(clubIdParam || '0');
  const { user } = useAuth();

  const [tab, setTab] = useState<Tab>('input');
  const [members, setMembers] = useState<MembershipWithUser[]>([]);
  const [myMemberId, setMyMemberId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clubId) return;
    clubsApi.getMembers(clubId, 'approved').then((data) => {
      setMembers(data);
      if (user) {
        const me = data.find((m) => m.user_id === user.id);
        setMyMemberId(me?.member_id ?? null);
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [clubId, user]);

  if (loading) return <div style={{ textAlign: 'center', padding: '40px' }}>로딩 중...</div>;
  if (!myMemberId) return <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>클럽 회원만 이용할 수 있습니다.</div>;

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto', padding: '20px' }}>
      <h2 style={{ textAlign: 'center', marginBottom: '20px' }}>누적경기기록</h2>

      {/* 탭 */}
      <div style={{ display: 'flex', borderBottom: '2px solid #e0e0e0', marginBottom: '20px' }}>
        {([['input', '기록입력'], ['mystats', '내 전적'], ['history', '전체 기록']] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              flex: 1,
              padding: '12px',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              fontSize: '15px',
              fontWeight: tab === key ? '600' : '400',
              color: tab === key ? '#1976d2' : '#666',
              borderBottom: tab === key ? '2px solid #1976d2' : '2px solid transparent',
              marginBottom: '-2px',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'input' && <InputTab clubId={clubId} myMemberId={myMemberId} members={members} />}
      {tab === 'mystats' && <MyStatsTab clubId={clubId} myMemberId={myMemberId} />}
      {tab === 'history' && <HistoryTab clubId={clubId} myMemberId={myMemberId} members={members} />}
    </div>
  );
}

// ============================
// 기록입력 탭
// ============================
function InputTab({ clubId, myMemberId, members }: { clubId: number; myMemberId: number; members: MembershipWithUser[] }) {
  const [player1Id, setPlayer1Id] = useState<number>(myMemberId);
  const [player2Id, setPlayer2Id] = useState<number>(0);
  const [player1Score, setPlayer1Score] = useState<number>(3);
  const [player2Score, setPlayer2Score] = useState<number>(0);
  const [matchDate, setMatchDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [memo, setMemo] = useState('');
  const [saving, setSaving] = useState(false);
  const [recentMatches, setRecentMatches] = useState<CumulativeMatchRecord[]>([]);

  const loadRecent = useCallback(() => {
    cumulativeMatchApi.getHistory(clubId, myMemberId).then((data) => {
      setRecentMatches(data.matches.slice(0, 5));
    }).catch(() => {});
  }, [clubId, myMemberId]);

  useEffect(() => { loadRecent(); }, [loadRecent]);

  const scoreOptions = [
    [3, 0], [3, 1], [3, 2],
    [0, 3], [1, 3], [2, 3],
    [2, 0], [2, 1],
    [0, 2], [1, 2],
  ];

  const handleSubmit = async () => {
    if (!player2Id) { alert('상대를 선택해주세요.'); return; }
    if (player1Id === player2Id) { alert('같은 선수끼리는 기록할 수 없습니다.'); return; }
    setSaving(true);
    try {
      await cumulativeMatchApi.create({
        clubId, player1Id, player2Id, player1Score, player2Score, matchDate, memo: memo || undefined,
      });
      alert('기록되었습니다.');
      setPlayer2Id(0);
      setPlayer1Score(3);
      setPlayer2Score(0);
      setMemo('');
      loadRecent();
    } catch (e: any) {
      alert(e.message || '기록 실패');
    } finally { setSaving(false); }
  };

  return (
    <div>
      <div style={formGroupStyle}>
        <label style={labelStyle}>선수1 (나)</label>
        <select
          value={player1Id}
          onChange={(e) => setPlayer1Id(Number(e.target.value))}
          style={selectStyle}
        >
          {members.filter(m => m.member_id).map((m) => (
            <option key={m.member_id} value={m.member_id!}>
              {m.display_name || m.user_name}
            </option>
          ))}
        </select>
      </div>

      <div style={formGroupStyle}>
        <label style={labelStyle}>상대 선수</label>
        <select
          value={player2Id}
          onChange={(e) => setPlayer2Id(Number(e.target.value))}
          style={selectStyle}
        >
          <option value={0}>-- 선택 --</option>
          {members.filter(m => m.member_id && m.member_id !== player1Id).map((m) => (
            <option key={m.member_id} value={m.member_id!}>
              {m.display_name || m.user_name}
            </option>
          ))}
        </select>
      </div>

      <div style={formGroupStyle}>
        <label style={labelStyle}>스코어</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {scoreOptions.map(([s1, s2]) => (
            <button
              key={`${s1}-${s2}`}
              onClick={() => { setPlayer1Score(s1); setPlayer2Score(s2); }}
              style={{
                padding: '8px 16px',
                border: player1Score === s1 && player2Score === s2 ? '2px solid #1976d2' : '1px solid #ccc',
                borderRadius: '8px',
                background: player1Score === s1 && player2Score === s2 ? '#e3f2fd' : 'white',
                cursor: 'pointer',
                fontWeight: player1Score === s1 && player2Score === s2 ? '600' : '400',
                fontSize: '14px',
              }}
            >
              {s1} : {s2}
            </button>
          ))}
        </div>
      </div>

      <div style={formGroupStyle}>
        <label style={labelStyle}>경기 날짜</label>
        <input
          type="date"
          value={matchDate}
          onChange={(e) => setMatchDate(e.target.value)}
          style={inputStyle}
        />
      </div>

      <div style={formGroupStyle}>
        <label style={labelStyle}>메모 (선택)</label>
        <input
          type="text"
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="예: 연습경기, 대회 등"
          maxLength={200}
          style={inputStyle}
        />
      </div>

      <button
        onClick={handleSubmit}
        disabled={saving}
        style={{
          width: '100%',
          padding: '14px',
          background: '#1976d2',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          fontSize: '16px',
          fontWeight: '600',
          cursor: saving ? 'not-allowed' : 'pointer',
          opacity: saving ? 0.7 : 1,
        }}
      >
        {saving ? '기록 중...' : '기록하기'}
      </button>

      {recentMatches.length > 0 && (
        <div style={{ marginTop: '32px' }}>
          <h3 style={{ fontSize: '16px', marginBottom: '12px', color: '#333' }}>최근 내 기록</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {recentMatches.map((m) => (
              <div key={m.id} style={recordRowStyle}>
                <span style={{ color: '#888', fontSize: '13px', minWidth: '80px' }}>{m.match_date}</span>
                <span style={{ fontWeight: '500' }}>
                  {m.player1_name} {m.player1_score} : {m.player2_score} {m.player2_name}
                </span>
                {m.memo && <span style={{ color: '#999', fontSize: '12px' }}>({m.memo})</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================
// 내 전적 탭
// ============================
function MyStatsTab({ clubId, myMemberId }: { clubId: number; myMemberId: number }) {
  const [stats, setStats] = useState<CumulativeMatchStats[]>([]);
  const [overall, setOverall] = useState<{ wins: number; losses: number }>({ wins: 0, losses: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    cumulativeMatchApi.getStats(clubId, myMemberId).then((data) => {
      setStats(data.stats);
      setOverall(data.overall);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [clubId, myMemberId]);

  if (loading) return <div style={{ textAlign: 'center', padding: '20px' }}>로딩 중...</div>;

  const totalGames = overall.wins + overall.losses;
  const winRate = totalGames > 0 ? ((overall.wins / totalGames) * 100).toFixed(1) : '0.0';

  return (
    <div>
      {/* 전체 요약 */}
      <div style={{
        background: '#f5f5f5', borderRadius: '12px', padding: '20px', marginBottom: '24px', textAlign: 'center',
      }}>
        <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>전체 전적</div>
        <div style={{ fontSize: '28px', fontWeight: '700' }}>
          <span style={{ color: '#1976d2' }}>{overall.wins}</span>
          <span style={{ color: '#999', margin: '0 8px' }}>승</span>
          <span style={{ color: '#d32f2f' }}>{overall.losses}</span>
          <span style={{ color: '#999', margin: '0 8px' }}>패</span>
        </div>
        <div style={{ fontSize: '14px', color: '#666', marginTop: '4px' }}>
          총 {totalGames}경기 | 승률 {winRate}%
        </div>
      </div>

      {/* 상대별 테이블 */}
      {stats.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#999', padding: '20px' }}>기록된 경기가 없습니다.</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e0e0e0' }}>
              <th style={thStyle}>상대</th>
              <th style={{ ...thStyle, textAlign: 'center' }}>승</th>
              <th style={{ ...thStyle, textAlign: 'center' }}>패</th>
              <th style={{ ...thStyle, textAlign: 'center' }}>승률</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((s) => {
              const total = s.wins + s.losses;
              const wr = total > 0 ? ((s.wins / total) * 100).toFixed(1) : '0.0';
              return (
                <tr key={s.opponent_id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td style={tdStyle}>{s.opponent_name}</td>
                  <td style={{ ...tdStyle, textAlign: 'center', color: '#1976d2', fontWeight: '600' }}>{s.wins}</td>
                  <td style={{ ...tdStyle, textAlign: 'center', color: '#d32f2f', fontWeight: '600' }}>{s.losses}</td>
                  <td style={{ ...tdStyle, textAlign: 'center', color: '#666' }}>{wr}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ============================
// 전체 기록 탭
// ============================
function HistoryTab({ clubId, myMemberId, members }: { clubId: number; myMemberId: number; members: MembershipWithUser[] }) {
  const [matches, setMatches] = useState<CumulativeMatchRecord[]>([]);
  const [filterMemberId, setFilterMemberId] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  const loadMatches = useCallback(() => {
    setLoading(true);
    const memberId = filterMemberId || undefined;
    cumulativeMatchApi.getHistory(clubId, memberId).then((data) => {
      setMatches(data.matches);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [clubId, filterMemberId]);

  useEffect(() => { loadMatches(); }, [loadMatches]);

  const handleDelete = async (matchId: number) => {
    if (!confirm('이 기록을 삭제하시겠습니까?')) return;
    try {
      await cumulativeMatchApi.delete(matchId, clubId);
      loadMatches();
    } catch (e: any) {
      alert(e.message || '삭제 실패');
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '16px' }}>
        <select
          value={filterMemberId}
          onChange={(e) => setFilterMemberId(Number(e.target.value))}
          style={selectStyle}
        >
          <option value={0}>전체 회원</option>
          {members.filter(m => m.member_id).map((m) => (
            <option key={m.member_id} value={m.member_id!}>
              {m.display_name || m.user_name}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '20px' }}>로딩 중...</div>
      ) : matches.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#999', padding: '20px' }}>기록된 경기가 없습니다.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {matches.map((m) => {
            const isWinP1 = m.player1_score > m.player2_score;
            const canDelete = m.recorder_member_id === myMemberId;
            return (
              <div key={m.id} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px',
                background: 'white',
                border: '1px solid #e0e0e0',
                borderRadius: '8px',
                flexWrap: 'wrap',
              }}>
                <span style={{ color: '#888', fontSize: '13px', minWidth: '80px' }}>{m.match_date}</span>
                <span style={{ flex: 1, fontWeight: '500' }}>
                  <span style={{ color: isWinP1 ? '#1976d2' : '#666' }}>{m.player1_name}</span>
                  {' '}
                  <strong>{m.player1_score} : {m.player2_score}</strong>
                  {' '}
                  <span style={{ color: !isWinP1 ? '#1976d2' : '#666' }}>{m.player2_name}</span>
                </span>
                {m.memo && <span style={{ color: '#999', fontSize: '12px' }}>({m.memo})</span>}
                {canDelete && (
                  <button
                    onClick={() => handleDelete(m.id)}
                    style={{
                      padding: '4px 10px',
                      border: '1px solid #f44336',
                      borderRadius: '4px',
                      background: 'white',
                      color: '#f44336',
                      cursor: 'pointer',
                      fontSize: '12px',
                    }}
                  >
                    삭제
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================
// 스타일
// ============================
const formGroupStyle: React.CSSProperties = { marginBottom: '16px' };
const labelStyle: React.CSSProperties = { display: 'block', marginBottom: '6px', fontWeight: '500', fontSize: '14px', color: '#333' };
const selectStyle: React.CSSProperties = { width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '8px', fontSize: '14px' };
const inputStyle: React.CSSProperties = { width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' };
const recordRowStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '12px', padding: '10px', background: '#fafafa', borderRadius: '6px', flexWrap: 'wrap',
};
const thStyle: React.CSSProperties = { padding: '10px 8px', textAlign: 'left', fontSize: '13px', color: '#666', fontWeight: '600' };
const tdStyle: React.CSSProperties = { padding: '10px 8px', fontSize: '14px' };
