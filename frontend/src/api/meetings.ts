import { api } from './client';
import type {
  MonthlyMeeting,
  Member,
  GroupWithMembers,
  GroupRanking,
  TournamentBracket,
  TournamentStanding,
  ApplicantWithMember,
  CreateMeetingRequest,
  ApplyMeetingRequest,
  ApplyMeetingBulkRequest,
  RecordMatchRequest,
  SetTournamentWinnerRequest,
  MeetingTeamMatch,
  MeetingTeamMatchGame,
  TeamRanking,
  MatchType,
  TeamMatchFormat,
} from '../types';

export const meetingsApi = {
  // Meeting management
  getCurrent: () => api.get<MonthlyMeeting | null>('/meetings/current'),
  getClosed: () => api.get<MonthlyMeeting[]>('/meetings/closed'),
  getById: (id: number) => api.get<MonthlyMeeting>(`/meetings/${id}`),
  create: (data: CreateMeetingRequest) => api.post<MonthlyMeeting>('/meetings', data),
  updateStatus: (id: number, status: string) =>
    api.patch<MonthlyMeeting>(`/meetings/${id}/status`, { status }),
  updateOptions: (id: number, options: {
    group_count?: number;
    advance_rate?: number;
    separate_spouses?: boolean;
    use_detailed_score?: boolean;
    match_format?: string;
    busu_type?: string;
    has_lower_tournament?: boolean;
    match_type?: MatchType;
    team_size?: number;
    team_match_format?: TeamMatchFormat;
  }) => api.patch<MonthlyMeeting>(`/meetings/${id}/options`, options),
  delete: (id: number) => api.delete<void>(`/meetings/${id}`),

  // Applicants
  getApplicants: (id: number) => api.get<ApplicantWithMember[]>(`/meetings/${id}/applicants`),
  apply: (id: number, data: ApplyMeetingRequest) =>
    api.post<{ success: boolean; assigned_group: number | null }>(`/meetings/${id}/apply`, data),
  applyBulk: (id: number, data: ApplyMeetingBulkRequest) =>
    api.post<{ success: boolean; count: number; assigned_groups: { member_id: number; group: number }[] }>(`/meetings/${id}/apply-bulk`, data),
  cancelApply: (id: number, memberId: number) =>
    api.delete<void>(`/meetings/${id}/apply/${memberId}`),

  // Group assignment
  getGroups: (id: number) => api.get<GroupWithMembers[]>(`/meetings/${id}/groups`),
  assignGroups: (id: number) => api.post<GroupWithMembers[]>(`/meetings/${id}/assign`),
  completeAssignment: (id: number) => api.patch<void>(`/meetings/${id}/assign/complete`),
  reassignMember: (id: number, memberId: number, newGroup: number) =>
    api.put<void>(`/meetings/${id}/groups/${memberId}`, { group_num: newGroup }),

  // Match recording
  getMatches: (id: number, groupNum: number) =>
    api.get<any[]>(`/meetings/${id}/groups/${groupNum}/matches`),
  recordMatch: (id: number, data: RecordMatchRequest) =>
    api.post<void>(`/meetings/${id}/matches`, data),
  deleteMatch: (id: number, player1Id: number, player2Id: number) =>
    api.delete<void>(`/meetings/${id}/matches?player1=${player1Id}&player2=${player2Id}`),

  // Ranking
  getGroupRanking: (id: number, groupNum: number) =>
    api.get<GroupRanking[]>(`/meetings/${id}/groups/${groupNum}/ranking`),

  // Tournament
  getTournament: (id: number) => api.get<{ upper: TournamentBracket; lower: TournamentBracket | null }>(`/meetings/${id}/tournament`),
  getTournamentStandings: (id: number) => api.get<{
    meeting_id: number;
    meeting_name: string;
    upper: TournamentStanding[];
    lower: TournamentStanding[];
  }>(`/meetings/${id}/tournament/standings`),
  createTournament: (id: number) => api.post<{ upper: TournamentBracket; lower: TournamentBracket | null }>(`/meetings/${id}/tournament`),
  setTournamentWinner: (id: number, matchId: number, data: SetTournamentWinnerRequest) =>
    api.patch<void>(`/meetings/${id}/tournament/${matchId}/winner`, data),

  // Team Matches (단체전)
  getTeamMatches: (id: number) =>
    api.get<MeetingTeamMatch[]>(`/meetings/${id}/team-matches`),
  recordTeamMatch: (id: number, data: { team1_num: number; team2_num: number; team1_score: number; team2_score: number }) =>
    api.post<void>(`/meetings/${id}/team-matches`, data),
  deleteTeamMatch: (id: number, team1Num: number, team2Num: number) =>
    api.delete<void>(`/meetings/${id}/team-matches?team1=${team1Num}&team2=${team2Num}`),
  getTeamMatchGames: (id: number, team1Num?: number, team2Num?: number) => {
    let url = `/meetings/${id}/team-matches/games`;
    if (team1Num !== undefined && team2Num !== undefined) {
      url += `?team1=${team1Num}&team2=${team2Num}`;
    }
    return api.get<MeetingTeamMatchGame[]>(url);
  },
  recordTeamMatchGame: (id: number, data: {
    team1_num: number; team2_num: number; game_order: number; game_type: string;
    team1_player1_id?: number; team1_player2_id?: number;
    team2_player1_id?: number; team2_player2_id?: number;
    winner_team?: number;
  }) => api.post<void>(`/meetings/${id}/team-matches/games`, data),
  deleteTeamMatchGame: (id: number, team1Num: number, team2Num: number, gameOrder: number) =>
    api.delete<void>(`/meetings/${id}/team-matches/games?team1=${team1Num}&team2=${team2Num}&game_order=${gameOrder}`),
  getTeamRanking: (id: number) =>
    api.get<TeamRanking[]>(`/meetings/${id}/team-ranking`),
};

export const membersApi = {
  getAll: () => api.get<Member[]>('/members'),
  getById: (id: number) => api.get<Member>(`/members/${id}`),
  create: (data: Omit<Member, 'id' | 'created_at'>) => api.post<Member>('/members', data),
  update: (id: number, data: Partial<Member>) => api.put<Member>(`/members/${id}`, data),
};
