import { api } from './client';

export interface CumulativeMatchRecord {
  id: number;
  club_id: number;
  recorder_member_id: number;
  player1_id: number;
  player2_id: number;
  player1_score: number;
  player2_score: number;
  match_date: string;
  memo: string | null;
  created_at: string;
  player1_name: string;
  player2_name: string;
  recorder_name: string;
}

export interface CumulativeMatchStats {
  opponent_id: number;
  opponent_name: string;
  wins: number;
  losses: number;
}

export const cumulativeMatchApi = {
  getHistory: (clubId: number, memberId?: number, opponentId?: number) => {
    const params = new URLSearchParams({ clubId: clubId.toString() });
    if (memberId) params.set('memberId', memberId.toString());
    if (opponentId) params.set('opponentId', opponentId.toString());
    return api.get<{ success: boolean; matches: CumulativeMatchRecord[] }>(`/cumulative-matches?${params}`);
  },

  getHeadToHead: (clubId: number, player1Id: number, player2Id: number) =>
    api.get<{ success: boolean; wins: number; losses: number; matches: CumulativeMatchRecord[] }>(
      `/cumulative-matches/head-to-head?clubId=${clubId}&player1Id=${player1Id}&player2Id=${player2Id}`
    ),

  getStats: (clubId: number, memberId: number) =>
    api.get<{ success: boolean; stats: CumulativeMatchStats[]; overall: { wins: number; losses: number } }>(
      `/cumulative-matches/stats?clubId=${clubId}&memberId=${memberId}`
    ),

  create: (data: {
    clubId: number;
    player1Id: number;
    player2Id: number;
    player1Score: number;
    player2Score: number;
    matchDate: string;
    memo?: string;
  }) => api.post<{ success: boolean; matchId: number }>('/cumulative-matches', data),

  delete: (matchId: number, clubId: number) =>
    api.delete<{ success: boolean }>(`/cumulative-matches/${matchId}?clubId=${clubId}`),
};
