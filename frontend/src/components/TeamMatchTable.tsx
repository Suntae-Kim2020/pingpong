import { useState, useRef, useEffect, useCallback } from 'react';
import type { GroupWithMembers, MeetingTeamMatch } from '../types';

interface TeamMatchTableProps {
  groups: GroupWithMembers[];
  teamMatches: MeetingTeamMatch[];
  onRecordMatch?: (team1Num: number, team2Num: number, team1Score: number, team2Score: number) => Promise<void>;
  onDeleteMatch?: (team1Num: number, team2Num: number) => Promise<void>;
  disabled?: boolean;
}

interface ScoreRowProps {
  t1: number;
  t2: number;
  match: MeetingTeamMatch | undefined;
  onRecordMatch?: (team1Num: number, team2Num: number, team1Score: number, team2Score: number) => Promise<void>;
  onDeleteMatch?: (team1Num: number, team2Num: number) => Promise<void>;
  disabled?: boolean;
  groups: GroupWithMembers[];
}

function ScoreRow({ t1, t2, match, onRecordMatch, onDeleteMatch, disabled, groups }: ScoreRowProps) {
  const [s1, setS1] = useState<string>(match ? String(match.team1_score) : '');
  const [s2, setS2] = useState<string>(match ? String(match.team2_score) : '');
  const rowRef = useRef<HTMLDivElement>(null);
  const savedRef = useRef({ s1: match ? String(match.team1_score) : '', s2: match ? String(match.team2_score) : '' });

  // 외부에서 teamMatches가 갱신되면 반영
  useEffect(() => {
    const newS1 = match ? String(match.team1_score) : '';
    const newS2 = match ? String(match.team2_score) : '';
    setS1(newS1);
    setS2(newS2);
    savedRef.current = { s1: newS1, s2: newS2 };
  }, [match?.team1_score, match?.team2_score, match]);

  const trySave = useCallback(async () => {
    if (!onRecordMatch) return;
    const num1 = parseInt(s1) || 0;
    const num2 = parseInt(s2) || 0;
    // 둘 다 비어있거나 둘 다 0이고 기존 기록도 없으면 저장 안 함
    if (s1 === '' && s2 === '') return;
    // 변경 없으면 저장 안 함
    if (s1 === savedRef.current.s1 && s2 === savedRef.current.s2) return;
    savedRef.current = { s1, s2 };
    await onRecordMatch(t1, t2, num1, num2);
  }, [s1, s2, t1, t2, onRecordMatch]);

  // 행 전체에서 포커스가 빠져나가면 자동 저장
  useEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    const handleFocusOut = (e: FocusEvent) => {
      // relatedTarget이 이 행 안에 있으면 무시 (같은 행 내 탭 이동)
      if (e.relatedTarget && row.contains(e.relatedTarget as Node)) return;
      trySave();
    };
    row.addEventListener('focusout', handleFocusOut);
    return () => row.removeEventListener('focusout', handleFocusOut);
  }, [trySave]);

  // Enter 키로도 저장
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      (e.target as HTMLInputElement).blur();
      trySave();
    }
  };

  const handleDelete = async () => {
    if (!onDeleteMatch) return;
    if (confirm('이 경기 기록을 삭제하시겠습니까?')) {
      await onDeleteMatch(t1, t2);
    }
  };

  const getTeamMembers = (teamNum: number): string => {
    const group = groups.find(g => g.group_num === teamNum);
    if (!group) return '';
    return group.members.map(m => m.name).join(', ');
  };

  const getResultBadge = (teamNum: number) => {
    if (!match) return null;
    const isTeam1 = teamNum === match.team1_num;
    const myScore = isTeam1 ? match.team1_score : match.team2_score;
    const otherScore = isTeam1 ? match.team2_score : match.team1_score;

    if (myScore > otherScore) return <span className="badge badge-success">승</span>;
    if (myScore < otherScore) return <span className="badge badge-danger" style={{ backgroundColor: '#ef4444', color: 'white' }}>패</span>;
    if (myScore === otherScore && (match.team1_score > 0 || match.team2_score > 0)) {
      return <span className="badge badge-warning">무</span>;
    }
    return null;
  };

  const editable = !!onRecordMatch;
  const inputStyle: React.CSSProperties = {
    width: '44px',
    textAlign: 'center',
    padding: '6px 4px',
    fontSize: '18px',
    fontWeight: 'bold',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    outline: 'none',
    background: disabled ? '#f3f4f6' : '#fff',
  };

  return (
    <div
      ref={rowRef}
      style={{
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        padding: '12px 16px',
        backgroundColor: match ? '#f8fafc' : 'white',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
        {/* Team 1 */}
        <div style={{ flex: 1, minWidth: '120px' }}>
          <div style={{ fontWeight: 'bold', fontSize: '15px' }}>
            {t1}팀 {getResultBadge(t1)}
          </div>
          <div style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>
            {getTeamMembers(t1)}
          </div>
        </div>

        {/* Score */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
          {editable ? (
            <>
              <input
                type="number"
                min={0}
                value={s1}
                onChange={(e) => setS1(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={(e) => e.target.select()}
                style={inputStyle}
                disabled={disabled}
                placeholder="0"
              />
              <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#9ca3af' }}>:</span>
              <input
                type="number"
                min={0}
                value={s2}
                onChange={(e) => setS2(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={(e) => e.target.select()}
                style={inputStyle}
                disabled={disabled}
                placeholder="0"
              />
              {match && onDeleteMatch && (
                <button
                  className="btn btn-secondary"
                  onClick={handleDelete}
                  disabled={disabled}
                  style={{ padding: '4px 8px', fontSize: '11px', color: '#ef4444', marginLeft: '4px' }}
                >
                  삭제
                </button>
              )}
            </>
          ) : (
            <span style={{
              fontSize: '20px',
              fontWeight: 'bold',
              color: match ? '#1a1a1a' : '#ccc',
            }}>
              {match ? `${match.team1_score} : ${match.team2_score}` : '- : -'}
            </span>
          )}
        </div>

        {/* Team 2 */}
        <div style={{ flex: 1, minWidth: '120px', textAlign: 'right' }}>
          <div style={{ fontWeight: 'bold', fontSize: '15px' }}>
            {getResultBadge(t2)} {t2}팀
          </div>
          <div style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>
            {getTeamMembers(t2)}
          </div>
        </div>
      </div>
    </div>
  );
}

function TeamMatchTable({ groups, teamMatches, onRecordMatch, onDeleteMatch, disabled }: TeamMatchTableProps) {
  // 모든 팀 조합 생성 (라운드로빈)
  const teamPairs: [number, number][] = [];
  const teamNums = groups.map(g => g.group_num).sort((a, b) => a - b);
  for (let i = 0; i < teamNums.length; i++) {
    for (let j = i + 1; j < teamNums.length; j++) {
      teamPairs.push([teamNums[i], teamNums[j]]);
    }
  }

  const getMatch = (t1: number, t2: number): MeetingTeamMatch | undefined => {
    const [a, b] = t1 < t2 ? [t1, t2] : [t2, t1];
    return teamMatches.find(m => m.team1_num === a && m.team2_num === b);
  };

  if (teamPairs.length === 0) {
    return <p style={{ color: '#666', textAlign: 'center' }}>팀이 편성되지 않았습니다.</p>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {teamPairs.map(([t1, t2]) => (
        <ScoreRow
          key={`${t1}-${t2}`}
          t1={t1}
          t2={t2}
          match={getMatch(t1, t2)}
          onRecordMatch={onRecordMatch}
          onDeleteMatch={onDeleteMatch}
          disabled={disabled}
          groups={groups}
        />
      ))}
    </div>
  );
}

export default TeamMatchTable;
