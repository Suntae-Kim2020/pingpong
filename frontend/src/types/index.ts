// Meeting status flow: open → assigning → assigned → recording → tournament → closed
export type MeetingStatus = 'open' | 'assigning' | 'assigned' | 'recording' | 'tournament' | 'closed';

// 전형 (플레이 스타일)
export type PlayStyle = '양핸드전진속공' | '드라이브' | '커트' | '펜홀더공격' | '쉐이크공격' | '수비' | '올라운드';

// 핌플 타입
export type PimpleType = 'none' | 'short' | 'long';

// 토너먼트 구분
export type TournamentDivision = 'upper' | 'lower';

// 경기 유형 (개인전/단체전)
export type MatchType = 'individual' | 'team';

// 단체전 경기 형식
export type TeamMatchFormat = 'dd' | 'ddd' | 'ddb' | 'dddb';

// 단체전 개별 경기 종류
export type GameType = 'singles' | 'doubles';

// 경기 형식 (ITTF 규칙)
export type MatchFormat = 'best_of_3' | 'best_of_5' | 'best_of_7';

// 부수 기준
export type BusuType = 'local' | 'open';

// 세트 승리 필요 수
export const MATCH_FORMAT_WINS: Record<MatchFormat, number> = {
  best_of_3: 2,
  best_of_5: 3,
  best_of_7: 4,
};

// 경기 형식 한글 라벨
export const MATCH_FORMAT_LABELS: Record<MatchFormat, string> = {
  best_of_3: '3판 2선승',
  best_of_5: '5판 3선승',
  best_of_7: '7판 4선승',
};

// 부수 기준 한글 라벨
export const BUSU_TYPE_LABELS: Record<BusuType, string> = {
  local: '지역부수',
  open: '오픈부수',
};

// 단체전 경기 형식 한글 라벨
export const TEAM_MATCH_FORMAT_LABELS: Record<TeamMatchFormat, string> = {
  dd: '단단 (단식2)',
  ddd: '단단단 (단식3)',
  ddb: '단단복 (단식2+복식1)',
  dddb: '단단단복 (단식3+복식1)',
};

// 세트 점수
export interface SetScore {
  p1: number | null;
  p2: number | null;
}

export interface Club {
  id: number;
  name: string;
  created_at: Date;
}

export interface Member {
  id: number;
  club_id: number;
  name: string;
  birth_year: number;
  gender: 'M' | 'F';
  phone: string | null;
  local_busu: number | null;  // 지역부수
  open_busu: number | null;   // 오픈부수
  play_style: PlayStyle;      // 전형
  pimple_type: PimpleType;    // 핌플 타입 (none, short, long)
  spouse_id: number | null;
  is_active: boolean;
  created_at: Date;
}

export interface MonthlyMeeting {
  id: number;
  club_id: number;
  year: number;
  month: number;
  name: string | null;            // 경기명칭
  start_date: string | null;      // 경기 시작일
  end_date: string | null;        // 경기 종료일
  group_count: number;
  advance_rate: number;
  has_upper_tournament: boolean;  // 상위부 토너먼트 여부
  has_lower_tournament: boolean;  // 하위부(예선탈락자) 토너먼트 여부
  separate_spouses: boolean;      // 부부 다른 조 편성 여부
  use_detailed_score: boolean;    // 세트별 상세 점수 입력 여부
  match_format: MatchFormat;      // 경기 형식 (3판2선승, 5판3선승, 7판4선승)
  busu_type: BusuType;            // 부수 기준 (지역부수/오픈부수)
  match_type: MatchType;          // 경기 유형 (개인전/단체전)
  team_size: number;              // 단체전 팀당 인원
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
  is_late: boolean;
}

export interface MeetingGroup {
  id: number;
  meeting_id: number;
  group_num: number;
  member_id: number;
  order_in_group: number;
}

export interface MeetingMatch {
  id: number;
  meeting_id: number;
  group_num: number;
  player1_id: number;
  player2_id: number;
  player1_sets: number;
  player2_sets: number;
  recorded_at: Date;
}

export interface MeetingTournament {
  id: number;
  meeting_id: number;
  division: TournamentDivision;
  round: number;
  match_order: number;
  player1_id: number | null;
  player2_id: number | null;
  winner_id: number | null;
  player1_from_group: number | null;
  player2_from_group: number | null;
  player1_sets: number;
  player2_sets: number;
  is_bye: boolean;
}

export interface GroupRanking {
  rank: number;
  member_id: number;
  member_name: string;
  wins: number;
  losses: number;
  sets_won: number;
  sets_lost: number;
  is_advanced: boolean;
}

export interface GroupWithMembers {
  group_num: number;
  members: (Member & { order_in_group: number })[];
}

export interface TournamentBracket {
  division: TournamentDivision;
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
    rank: number | null;
  };
  player2: {
    id: number | null;
    name: string | null;
    from_group: number | null;
    rank: number | null;
  };
  winner_id: number | null;
  player1_sets: number;
  player2_sets: number;
  is_bye: boolean;
}

export interface TournamentStanding {
  rank: number;
  member_id: number;
  member_name: string;
  eliminated_round: number | null;  // null이면 우승자
  from_group: number | null;
  group_rank: number | null;
}

export interface MeetingTeamMatch {
  id: number;
  meeting_id: number;
  team1_num: number;
  team2_num: number;
  team1_score: number;
  team2_score: number;
  recorded_at: Date;
}

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

export interface CreateMeetingRequest {
  year: number;
  month: number;
  name?: string;
  start_date?: string;
  end_date?: string;
  group_count: number;
  advance_rate: number;
  has_upper_tournament?: boolean;
  has_lower_tournament?: boolean;
  separate_spouses?: boolean;
  use_detailed_score?: boolean;
  match_format?: MatchFormat;
  busu_type?: BusuType;
  match_type?: MatchType;
  team_size?: number;
  team_match_format?: TeamMatchFormat;
}

export interface ApplyMeetingBulkRequest {
  member_ids: number[];
  is_late?: boolean;
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
  player1_sets?: number;
  player2_sets?: number;
}

export interface ApplicantWithMember extends MeetingApplicant {
  member: Member;
}

// 핌플 타입 표시용 헬퍼
export const PIMPLE_LABELS: Record<PimpleType, string> = {
  none: '',
  short: '숏핌플',
  long: '롱핌플',
};

export const PLAY_STYLE_LABELS: Record<PlayStyle, string> = {
  '양핸드전진속공': '양핸드전진속공',
  '드라이브': '드라이브',
  '커트': '커트',
  '펜홀더공격': '펜홀더공격',
  '쉐이크공격': '쉐이크공격',
  '수비': '수비',
  '올라운드': '올라운드',
};

// 시스템 역할
export type SystemRole = 'super_admin' | 'admin' | 'user';

// YouTube 영상
export type VideoType = 'shorts' | 'video';

export interface YouTubeVideo {
  id: number;
  video_type: VideoType;
  youtube_url: string;
  youtube_id: string;
  title: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
}
