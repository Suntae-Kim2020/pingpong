import { useState, useEffect } from 'react';
import type { SetScore, MatchFormat } from '../types';
import { MATCH_FORMAT_LABELS } from '../types';
import {
  isValidSetScore,
  getSetWinner,
  calculateMatchResult,
  getMaxSets,
  getSetScoreError,
  createEmptySetScores,
} from '../utils/ittfRules';

interface DetailedScoreInputProps {
  player1Name: string;
  player2Name: string;
  matchFormat: MatchFormat;
  initialSetScores?: SetScore[];
  onSave: (setScores: SetScore[], player1Sets: number, player2Sets: number) => void;
  onCancel: () => void;
  onDelete?: () => void;
}

function DetailedScoreInput({
  player1Name,
  player2Name,
  matchFormat,
  initialSetScores,
  onSave,
  onCancel,
  onDelete,
}: DetailedScoreInputProps) {
  const maxSets = getMaxSets(matchFormat);
  const [setScores, setSetScores] = useState<SetScore[]>(() =>
    initialSetScores && initialSetScores.length > 0
      ? initialSetScores
      : createEmptySetScores(matchFormat)
  );
  const [errors, setErrors] = useState<(string | null)[]>(Array(maxSets).fill(null));

  // Validate scores
  useEffect(() => {
    const newErrors = setScores.map((set) => {
      if (set.p1 === null || set.p2 === null) return null;
      return getSetScoreError(set.p1, set.p2);
    });
    setErrors(newErrors);
  }, [setScores]);

  const handleSetScoreChange = (setIndex: number, player: 'p1' | 'p2', value: string) => {
    const numValue = value === '' ? null : parseInt(value);
    const newScores = [...setScores];
    newScores[setIndex] = { ...newScores[setIndex], [player]: numValue };
    setSetScores(newScores);
  };

  // 빠른 입력용: 한 세트의 두 점수를 한꺼번에 업데이트
  const handleQuickScore = (setIndex: number, p1Score: number, p2Score: number) => {
    const newScores = [...setScores];
    newScores[setIndex] = { p1: p1Score, p2: p2Score };
    setSetScores(newScores);
  };

  const result = calculateMatchResult(setScores, matchFormat);
  const hasErrors = errors.some((e) => e !== null);
  const canSave = result.isComplete && !hasErrors;

  const handleSave = () => {
    if (canSave) {
      onSave(setScores, result.player1Sets, result.player2Sets);
    }
  };

  // Quick input buttons for common scores
  const quickScores = [
    { label: '11-0', p1: 11, p2: 0 },
    { label: '11-5', p1: 11, p2: 5 },
    { label: '11-7', p1: 11, p2: 7 },
    { label: '11-9', p1: 11, p2: 9 },
    { label: '듀스', p1: 12, p2: 10 },
  ];

  return (
    <div style={{ padding: '15px', background: '#fff', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
      <div style={{ marginBottom: '15px', fontWeight: '600', fontSize: '14px' }}>
        세트별 점수 입력 ({MATCH_FORMAT_LABELS[matchFormat]})
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontWeight: '600' }}>
        <span style={{ color: '#1976d2' }}>{player1Name}</span>
        <span>vs</span>
        <span style={{ color: '#d32f2f' }}>{player2Name}</span>
      </div>

      {/* Set score inputs */}
      <div style={{ marginBottom: '15px' }}>
        {setScores.slice(0, maxSets).map((set, index) => {
          const setWinner = set.p1 !== null && set.p2 !== null ? getSetWinner(set.p1, set.p2) : null;
          const isDisabled = result.isComplete && setWinner === null;

          return (
            <div key={index} style={{ marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '50px', fontSize: '13px' }}>{index + 1}세트</span>
                <input
                  type="number"
                  value={set.p1 ?? ''}
                  onChange={(e) => handleSetScoreChange(index, 'p1', e.target.value)}
                  disabled={isDisabled}
                  min={0}
                  style={{
                    width: '50px',
                    padding: '4px 8px',
                    textAlign: 'center',
                    border: `1px solid ${errors[index] ? '#d32f2f' : '#ddd'}`,
                    borderRadius: '4px',
                    backgroundColor: setWinner === 1 ? '#e3f2fd' : isDisabled ? '#f5f5f5' : '#fff',
                  }}
                />
                <span>:</span>
                <input
                  type="number"
                  value={set.p2 ?? ''}
                  onChange={(e) => handleSetScoreChange(index, 'p2', e.target.value)}
                  disabled={isDisabled}
                  min={0}
                  style={{
                    width: '50px',
                    padding: '4px 8px',
                    textAlign: 'center',
                    border: `1px solid ${errors[index] ? '#d32f2f' : '#ddd'}`,
                    borderRadius: '4px',
                    backgroundColor: setWinner === 2 ? '#ffebee' : isDisabled ? '#f5f5f5' : '#fff',
                  }}
                />
                {setWinner && (
                  <span style={{ fontSize: '12px', color: setWinner === 1 ? '#1976d2' : '#d32f2f' }}>
                    {setWinner === 1 ? player1Name : player2Name} 승
                  </span>
                )}
              </div>
              {errors[index] && (
                <div style={{ color: '#d32f2f', fontSize: '11px', marginLeft: '58px', marginTop: '2px' }}>
                  {errors[index]}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Quick score buttons */}
      <div style={{ marginBottom: '15px' }}>
        <div style={{ fontSize: '12px', color: '#666', marginBottom: '5px' }}>
          빠른 입력 (현재 세트에 적용)
          {result.isComplete && <span style={{ color: '#388e3c', marginLeft: '10px' }}>✓ 승부 결정</span>}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
          {quickScores.map((qs) => (
            <button
              key={qs.label}
              type="button"
              className="btn btn-secondary"
              style={{ padding: '2px 8px', fontSize: '11px', opacity: result.isComplete ? 0.5 : 1 }}
              disabled={result.isComplete}
              onClick={() => {
                // Find first incomplete set
                const incompleteIndex = setScores.findIndex(
                  (s) => s.p1 === null || s.p2 === null || !isValidSetScore(s.p1, s.p2)
                );
                if (incompleteIndex >= 0 && incompleteIndex < maxSets) {
                  handleQuickScore(incompleteIndex, qs.p1, qs.p2);
                }
              }}
            >
              {qs.label}
            </button>
          ))}
          {quickScores.map((qs) => (
            <button
              key={`rev-${qs.label}`}
              type="button"
              className="btn btn-secondary"
              style={{ padding: '2px 8px', fontSize: '11px', opacity: result.isComplete ? 0.5 : 1 }}
              disabled={result.isComplete}
              onClick={() => {
                const incompleteIndex = setScores.findIndex(
                  (s) => s.p1 === null || s.p2 === null || !isValidSetScore(s.p1, s.p2)
                );
                if (incompleteIndex >= 0 && incompleteIndex < maxSets) {
                  handleQuickScore(incompleteIndex, qs.p2, qs.p1);
                }
              }}
            >
              {qs.p2}-{qs.p1}
            </button>
          ))}
        </div>
      </div>

      {/* Result summary */}
      <div
        style={{
          padding: '10px',
          background: result.isComplete ? '#e8f5e9' : '#fff3e0',
          borderRadius: '4px',
          marginBottom: '15px',
          textAlign: 'center',
        }}
      >
        <div style={{ fontWeight: '600', fontSize: '16px' }}>
          {result.player1Sets} : {result.player2Sets}
        </div>
        {result.isComplete && result.winner && (
          <div style={{ fontSize: '13px', color: '#388e3c' }}>
            {result.winner === 1 ? player1Name : player2Name} 승리!
          </div>
        )}
        {!result.isComplete && (
          <div style={{ fontSize: '12px', color: '#f57c00' }}>
            경기 진행 중...
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
        <button
          className="btn btn-success"
          onClick={handleSave}
          disabled={!canSave}
        >
          저장
        </button>
        {onDelete && (
          <button className="btn btn-danger" onClick={onDelete}>
            삭제
          </button>
        )}
        <button className="btn btn-secondary" onClick={onCancel}>
          취소
        </button>
      </div>

      {/* ITTF Rule reminder */}
      <div style={{ marginTop: '10px', fontSize: '11px', color: '#666', textAlign: 'center' }}>
        ITTF 규칙: 11점 선취, 10-10 이후 2점차 승리
      </div>
    </div>
  );
}

export default DetailedScoreInput;
