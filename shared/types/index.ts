// Meeting status flow: open → assigning → assigned → recording → tournament → closed
export type MeetingStatus = 'open' | 'assigning' | 'assigned' | 'recording' | 'tournament' | 'closed';

// 경기 유형 (개인전/단체전)
export type MatchType = 'individual' | 'team';

// 단체전 경기 형식
export type TeamMatchFormat = 'dd' | 'ddd' | 'ddb' | 'dddb';

// 단체전 개별 경기 종류
export type GameType = 'singles' | 'doubles';

export interface Club {
  id: number;
  name: string;
  created_at: Date;
}

export interface Member {
  id: number;
  club_id: number;
  name: string;
  busu: number; // 부수 (skill level 1-8)
  gender: 'M' | 'F';
  birth_year: number;
  spouse_id: number | null; // 배우자 ID (같은 조 회피용)
  is_pimple: boolean; // 핌플 여부
  is_active: boolean;
  created_at: Date;
}

export interface MonthlyMeeting {
  id: number;
  club_id: number;
  year: number;
  month: number;
  group_count: number; // 조 수
  advance_rate: number; // 진출률 (예: 0.5 = 50%)
  match_type: MatchType; // 경기 유형 (개인전/단체전)
  team_size: number; // 단체전 팀당 인원
  team_match_format: TeamMatchFormat; // 단체전 경기 형식
  status: MeetingStatus;
  created_at: Date;
  updated_at: Date;
}

export interface MeetingApplicant {
  id: number;
  meeting_id: number;
  member_id: number;
  applied_at: Date;
  is_late: boolean; // 늦은 참가자 여부
}

export interface MeetingGroup {
  id: number;
  meeting_id: number;
  group_num: number; // 조 번호 (1, 2, 3...)
  member_id: number;
  order_in_group: number; // 조 내 순서
}

export interface MeetingMatch {
  id: number;
  meeting_id: number;
  group_num: number;
  player1_id: number;
  player2_id: number;
  player1_sets: number; // 플레이어1이 이긴 세트 수
  player2_sets: number; // 플레이어2가 이긴 세트 수
  recorded_at: Date;
}

export interface MeetingTournament {
  id: number;
  meeting_id: number;
  round: number; // 라운드 (1=결승, 2=준결승, 4=4강, 8=8강...)
  match_order: number; // 해당 라운드 내 경기 순서
  player1_id: number | null;
  player2_id: number | null;
  winner_id: number | null;
  player1_from_group: number | null; // 선수1 원래 조
  player2_from_group: number | null; // 선수2 원래 조
  is_bye: boolean; // 부전승 여부
}

// API Response types
export interface GroupRanking {
  rank: number;
  member_id: number;
  member_name: string;
  wins: number;
  losses: number;
  sets_won: number;
  sets_lost: number;
  is_advanced: boolean; // 토너먼트 진출 여부
}

export interface GroupWithMembers {
  group_num: number;
  members: (Member & { order_in_group: number })[];
}

export interface TournamentBracket {
  rounds: TournamentRound[];
}

export interface TournamentRound {
  round: number;
  matches: TournamentMatchDisplay[];
}

export interface TournamentMatchDisplay {
  id: number;
  match_order: number;
  player1: {
    id: number | null;
    name: string | null;
    from_group: number | null;
  };
  player2: {
    id: number | null;
    name: string | null;
    from_group: number | null;
  };
  winner_id: number | null;
  is_bye: boolean;
}

// Request types
export interface CreateMeetingRequest {
  year: number;
  month: number;
  group_count: number;
  advance_rate: number;
}

export interface ApplyMeetingRequest {
  member_id: number;
  is_late?: boolean;
}

export interface RecordMatchRequest {
  group_num: number;
  player1_id: number;
  player2_id: number;
  player1_sets: number;
  player2_sets: number;
}

export interface SetTournamentWinnerRequest {
  winner_id: number;
}

// Applicant with member info for display
export interface ApplicantWithMember extends MeetingApplicant {
  member: Member;
}

// 단체전 팀 대 팀 경기 기록
export interface MeetingTeamMatch {
  id: number;
  meeting_id: number;
  team1_num: number;
  team2_num: number;
  team1_score: number;
  team2_score: number;
  recorded_at: Date;
}

// 단체전 개별 경기 기록
export interface MeetingTeamMatchGame {
  id: number;
  meeting_id: number;
  team1_num: number;
  team2_num: number;
  game_order: number;
  game_type: GameType;
  team1_player1_id: number | null;
  team1_player2_id: number | null;
  team2_player1_id: number | null;
  team2_player2_id: number | null;
  winner_team: number | null;
  recorded_at: Date;
}

export interface TeamRanking {
  team_num: number;
  wins: number;
  draws: number;
  losses: number;
  score_diff: number;
}
