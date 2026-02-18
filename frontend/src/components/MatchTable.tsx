import { useState } from 'react';
import type { Member, MeetingMatch, SetScore, MatchFormat, BusuType } from '../types';
import { MATCH_FORMAT_WINS } from '../types';
import DetailedScoreInput from './DetailedScoreInput';

interface MatchTableProps {
  members: (Member & { order_in_group: number })[];
  matches: MeetingMatch[];
  onRecordMatch?: (player1Id: number, player2Id: number, player1Sets: number, player2Sets: number, setScores?: SetScore[]) => void;
  onDeleteMatch?: (player1Id: number, player2Id: number) => void;
  disabled?: boolean;
  useDetailedScore?: boolean;
  matchFormat?: MatchFormat;
  busuType?: BusuType;
}

function MatchTable({
  members,
  matches,
  onRecordMatch,
  onDeleteMatch,
  disabled,
  useDetailedScore = false,
  matchFormat = 'best_of_5',
  busuType = 'local',
}: MatchTableProps) {
  const [editingMatch, setEditingMatch] = useState<{ p1: number; p2: number } | null>(null);
  const [scores, setScores] = useState<{ p1: number; p2: number }>({ p1: 0, p2: 0 });
  const [showDetailedInput, setShowDetailedInput] = useState(false);

  const sortedMembers = [...members].sort((a, b) => a.order_in_group - b.order_in_group);
  const maxSets = MATCH_FORMAT_WINS[matchFormat];

  // 부수 표시 헬퍼 함수
  const getBusuDisplay = (member: Member): string => {
    const busu = busuType === 'open'
      ? (member.open_busu || member.local_busu)  // 오픈부수가 없으면 지역부수 사용
      : member.local_busu;
    const label = busuType === 'open' ? '오픈' : '지역';
    return busu ? `(${label}${busu}부)` : '';
  };

  const getMatch = (player1Id: number, player2Id: number): MeetingMatch | undefined => {
    return matches.find(
      (m) =>
        (m.player1_id === player1Id && m.player2_id === player2Id) ||
        (m.player1_id === player2Id && m.player2_id === player1Id)
    );
  };

  const getScore = (player1Id: number, player2Id: number): { p1: number; p2: number } | null => {
    const match = getMatch(player1Id, player2Id);
    if (!match) return null;

    if (match.player1_id === player1Id) {
      return { p1: match.player1_sets, p2: match.player2_sets };
    } else {
      return { p1: match.player2_sets, p2: match.player1_sets };
    }
  };

  const handleCellClick = (p1Id: number, p2Id: number) => {
    if (!onRecordMatch || disabled) return;

    const existingScore = getScore(p1Id, p2Id);
    if (existingScore) {
      setScores(existingScore);
    } else {
      setScores({ p1: 0, p2: 0 });
    }
    setEditingMatch({ p1: p1Id, p2: p2Id });

    if (useDetailedScore) {
      setShowDetailedInput(true);
    }
  };

  const handleSimpleSave = () => {
    if (editingMatch && onRecordMatch) {
      onRecordMatch(editingMatch.p1, editingMatch.p2, scores.p1, scores.p2);
      setEditingMatch(null);
    }
  };

  const handleDetailedSave = (setScores: SetScore[], player1Sets: number, player2Sets: number) => {
    if (editingMatch && onRecordMatch) {
      onRecordMatch(editingMatch.p1, editingMatch.p2, player1Sets, player2Sets, setScores);
      setEditingMatch(null);
      setShowDetailedInput(false);
    }
  };

  const handleDelete = () => {
    if (editingMatch && onDeleteMatch) {
      onDeleteMatch(editingMatch.p1, editingMatch.p2);
      setEditingMatch(null);
      setShowDetailedInput(false);
    }
  };

  const handleCancel = () => {
    setEditingMatch(null);
    setShowDetailedInput(false);
  };

  // Get player names for detailed input
  const getPlayerName = (playerId: number): string => {
    const member = members.find((m) => m.id === playerId);
    return member?.name || 'Unknown';
  };

  return (
    <div className="match-table">
      {/* Detailed score input modal */}
      {showDetailedInput && editingMatch && useDetailedScore && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) handleCancel();
          }}
        >
          <DetailedScoreInput
            player1Name={getPlayerName(editingMatch.p1)}
            player2Name={getPlayerName(editingMatch.p2)}
            matchFormat={matchFormat}
            onSave={handleDetailedSave}
            onCancel={handleCancel}
            onDelete={getScore(editingMatch.p1, editingMatch.p2) ? handleDelete : undefined}
          />
        </div>
      )}

      <table>
        <thead>
          <tr>
            <th></th>
            {sortedMembers.map((m) => (
              <th key={m.id}>
                {m.name}
                <span style={{ fontSize: '10px', color: '#666', display: 'block' }}>
                  {getBusuDisplay(m)}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedMembers.map((rowMember) => (
            <tr key={rowMember.id}>
              <td className="player-cell">
                {rowMember.name}
                <span style={{ fontSize: '10px', color: '#666', display: 'block' }}>
                  {getBusuDisplay(rowMember)}
                </span>
              </td>
              {sortedMembers.map((colMember) => {
                if (rowMember.id === colMember.id) {
                  return <td key={colMember.id} className="diagonal"></td>;
                }

                const score = getScore(rowMember.id, colMember.id);
                const isEditing =
                  editingMatch &&
                  !showDetailedInput &&
                  ((editingMatch.p1 === rowMember.id && editingMatch.p2 === colMember.id) ||
                    (editingMatch.p1 === colMember.id && editingMatch.p2 === rowMember.id));

                // Simple inline editing (when not using detailed score)
                if (isEditing && editingMatch?.p1 === rowMember.id && !useDetailedScore) {
                  return (
                    <td key={colMember.id} style={{ padding: '5px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', alignItems: 'center' }}>
                        <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                          <input
                            type="number"
                            value={scores.p1}
                            onChange={(e) => setScores({ ...scores, p1: parseInt(e.target.value) || 0 })}
                            min={0}
                            max={maxSets}
                            style={{ width: '40px' }}
                          />
                          <span>:</span>
                          <input
                            type="number"
                            value={scores.p2}
                            onChange={(e) => setScores({ ...scores, p2: parseInt(e.target.value) || 0 })}
                            min={0}
                            max={maxSets}
                            style={{ width: '40px' }}
                          />
                        </div>
                        <div style={{ display: 'flex', gap: '3px' }}>
                          <button
                            className="btn btn-success"
                            onClick={handleSimpleSave}
                            style={{ padding: '2px 6px', fontSize: '11px' }}
                          >
                            저장
                          </button>
                          {score && (
                            <button
                              className="btn btn-danger"
                              onClick={handleDelete}
                              style={{ padding: '2px 6px', fontSize: '11px' }}
                            >
                              삭제
                            </button>
                          )}
                          <button
                            className="btn btn-secondary"
                            onClick={handleCancel}
                            style={{ padding: '2px 6px', fontSize: '11px' }}
                          >
                            취소
                          </button>
                        </div>
                      </div>
                    </td>
                  );
                }

                if (isEditing && !useDetailedScore) {
                  return <td key={colMember.id}></td>;
                }

                return (
                  <td
                    key={colMember.id}
                    onClick={() => handleCellClick(rowMember.id, colMember.id)}
                    style={{
                      cursor: onRecordMatch && !disabled ? 'pointer' : 'default',
                      backgroundColor: score
                        ? score.p1 > score.p2
                          ? '#e8f5e9'
                          : score.p1 < score.p2
                          ? '#ffebee'
                          : '#fff'
                        : '#fff',
                    }}
                  >
                    {score ? `${score.p1}:${score.p2}` : '-'}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default MatchTable;
