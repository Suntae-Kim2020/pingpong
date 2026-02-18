import type { SetScore, MatchFormat } from '../types';
import { MATCH_FORMAT_WINS } from '../types';

/**
 * ITTF 국제탁구연맹 규칙
 * - 게임: 11점 선취, 10-10 이후 2점차 승리
 * - 경기: 3판2선승, 5판3선승, 7판4선승
 */

// 단일 세트 점수 유효성 검사
export function isValidSetScore(p1: number, p2: number): boolean {
  // 최소 0점
  if (p1 < 0 || p2 < 0) return false;

  // 11점 이상 득점한 선수가 승자
  const winner = Math.max(p1, p2);
  const loser = Math.min(p1, p2);

  // 일반 승리: 11점 이상 & 2점 이상 차이
  if (winner >= 11 && winner - loser >= 2) {
    // 듀스가 아닌 경우 정확히 11점이어야 함
    if (loser < 10 && winner !== 11) return false;
    return true;
  }

  return false;
}

// 세트 승자 판정
export function getSetWinner(p1: number, p2: number): 1 | 2 | null {
  if (!isValidSetScore(p1, p2)) return null;
  return p1 > p2 ? 1 : 2;
}

// 전체 경기 결과 계산
export function calculateMatchResult(
  setScores: SetScore[],
  matchFormat: MatchFormat
): { player1Sets: number; player2Sets: number; isComplete: boolean; winner: 1 | 2 | null } {
  const winsNeeded = MATCH_FORMAT_WINS[matchFormat];
  let player1Sets = 0;
  let player2Sets = 0;

  for (const set of setScores) {
    if (set.p1 === null || set.p2 === null) continue;

    const setWinner = getSetWinner(set.p1, set.p2);
    if (setWinner === 1) player1Sets++;
    else if (setWinner === 2) player2Sets++;
  }

  const isComplete = player1Sets >= winsNeeded || player2Sets >= winsNeeded;
  let winner: 1 | 2 | null = null;

  if (player1Sets >= winsNeeded) winner = 1;
  else if (player2Sets >= winsNeeded) winner = 2;

  return { player1Sets, player2Sets, isComplete, winner };
}

// 경기 완료 여부 확인
export function isMatchComplete(
  setScores: SetScore[],
  matchFormat: MatchFormat
): boolean {
  return calculateMatchResult(setScores, matchFormat).isComplete;
}

// 최대 세트 수
export function getMaxSets(matchFormat: MatchFormat): number {
  switch (matchFormat) {
    case 'best_of_3': return 3;
    case 'best_of_5': return 5;
    case 'best_of_7': return 7;
    default: return 5;
  }
}

// 세트 점수 입력 검증 메시지
export function getSetScoreError(p1: number | null, p2: number | null): string | null {
  if (p1 === null || p2 === null) return null;
  if (p1 < 0 || p2 < 0) return '점수는 0 이상이어야 합니다';

  const winner = Math.max(p1, p2);
  const loser = Math.min(p1, p2);

  if (winner < 11) return '승자는 최소 11점 이상이어야 합니다';
  if (winner - loser < 2) return '2점 이상 차이로 이겨야 합니다';
  if (loser < 10 && winner !== 11) return '듀스가 아닌 경우 11점에서 승리해야 합니다';

  return null;
}

// 초기 세트 점수 배열 생성
export function createEmptySetScores(matchFormat: MatchFormat): SetScore[] {
  const maxSets = getMaxSets(matchFormat);
  return Array.from({ length: maxSets }, () => ({ p1: null, p2: null }));
}
