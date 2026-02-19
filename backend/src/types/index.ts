import { RowDataPacket, ResultSetHeader } from 'mysql2';

export type DBRow = RowDataPacket;
export type DBResult = ResultSetHeader;

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

export interface Club {
  id: number;
  name: string;
  created_at: Date;
}

export interface Member {
  id: number;
  club_id: number;
  name: string;
  profile_image: string | null;
  birth_year: number;
  gender: 'M' | 'F';
  phone: string | null;
  local_busu: number | null;  // 지역부수
  open_busu: number | null;   // 오픈부수
  play_style: PlayStyle;      // 전형
  pimple_type: PimpleType;    // 핌플 타입 (none, short, long)
  spouse_id: number | null;
  is_active: boolean;
  check_flag?: boolean;       // 출석체크 플래그 (현재 탁장에 있는지)
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

// 국제탁구규칙: 11점 선취, 듀스시 2점차
export interface SetScore {
  p1: number | null;
  p2: number | null;
}

export interface MeetingMatch {
  id: number;
  meeting_id: number;
  group_num: number;
  player1_id: number;
  player2_id: number;
  player1_sets: number;
  player2_sets: number;
  // 세트별 점수 (최대 7세트)
  set_scores?: SetScore[];
  recorded_at: Date;
}

export interface MeetingTournament {
  id: number;
  meeting_id: number;
  division: TournamentDivision;  // 상위부/하위부
  round: number;
  match_order: number;
  player1_id: number | null;
  player2_id: number | null;
  winner_id: number | null;
  player1_from_group: number | null;
  player2_from_group: number | null;
  player1_rank: number | null;     // 예선 순위
  player2_rank: number | null;     // 예선 순위
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

export interface RecordTeamMatchRequest {
  team1_num: number;
  team2_num: number;
  team1_score: number;
  team2_score: number;
}

export interface RecordTeamMatchGameRequest {
  team1_num: number;
  team2_num: number;
  game_order: number;
  game_type: GameType;
  team1_player1_id?: number;
  team1_player2_id?: number;
  team2_player1_id?: number;
  team2_player2_id?: number;
  winner_team?: number;
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
  group_count: number;
  advance_rate: number;
  has_upper_tournament?: boolean;
  has_lower_tournament?: boolean;
  separate_spouses?: boolean;
  use_detailed_score?: boolean;
  match_format?: MatchFormat;
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
  set_scores?: SetScore[];
}

export interface SetTournamentWinnerRequest {
  winner_id: number;
  player1_sets?: number;
  player2_sets?: number;
}

export interface ApplicantWithMember extends MeetingApplicant {
  member: Member;
}

// =============================================
// 플랫폼 확장: 사용자, 지역, 클럽 멤버십
// =============================================

export type SystemRole = 'super_admin' | 'admin' | 'user';

export interface AuthUser {
  userId: number;
  role: SystemRole;
}

export type SocialProvider = 'naver' | 'kakao' | 'google' | 'local';
export type RegionLevel = 'nation' | 'province' | 'city' | 'district' | 'town';
export type ClubJoinType = 'open' | 'approval' | 'invite';
export type ClubMemberRole = 'leader' | 'admin' | 'member';
export type ClubMemberStatus = 'pending' | 'approved' | 'rejected' | 'banned';

export interface User {
  id: number;
  provider: SocialProvider;
  provider_id: string;
  username: string | null;
  password?: string;
  email: string | null;
  name: string;
  nickname: string | null;
  profile_image: string | null;
  phone: string | null;
  birth_year: number | null;
  gender: 'M' | 'F' | null;
  created_at: Date;
  updated_at: Date;
  last_login_at: Date | null;
  is_active: boolean;
  role: SystemRole;
}

export interface Region {
  id: number;
  name: string;
  full_name: string | null;
  level: RegionLevel;
  parent_id: number | null;
  code: string | null;
  created_at: Date;
}

export interface ClubExtended {
  id: number;
  name: string;
  region_id: number | null;
  description: string | null;
  address: string | null;
  leader_user_id: number | null;
  join_type: ClubJoinType;
  is_public: boolean;
  logo_image: string | null;
  member_count: number;
  created_at: Date;
  updated_at: Date;
}

export interface ClubMembership {
  id: number;
  club_id: number;
  user_id: number;
  member_id: number | null;
  role: ClubMemberRole;
  status: ClubMemberStatus;
  display_name: string | null;
  joined_at: Date;
  approved_at: Date | null;
  approved_by: number | null;
}

export interface CreateClubRequest {
  name: string;
  region_id: number;
  description?: string;
  address?: string;
  join_type?: ClubJoinType;
  is_public?: boolean;
}

export interface ClubSearchResult extends ClubExtended {
  region_name: string | null;
  leader_name: string | null;
}

export type NotificationType = 'announcement' | 'schedule' | 'video' | 'join_approved' | 'join_rejected';

export interface Notification {
  id: number;
  user_id: number;
  club_id: number | null;
  title: string;
  body: string | null;
  type: NotificationType;
  is_read: boolean;
  reference_id: number | null;
  created_by: number | null;
  created_at: Date;
}

export interface NotificationWithClub extends Notification {
  club_name: string | null;
}

export interface ClubInvite {
  id: number;
  club_id: number;
  token: string;
  created_by: number;
  expires_at: Date;
  max_uses: number | null;
  use_count: number;
  is_active: boolean;
  created_at: Date;
}

export interface MembershipWithUser extends ClubMembership {
  user_name: string;
  user_nickname: string | null;
  user_profile_image: string | null;
  user_email: string | null;
}

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
  created_at: Date;
}

export interface CreateYouTubeVideoRequest {
  video_type: VideoType;
  youtube_url: string;
  youtube_id: string;
  title: string;
  display_order?: number;
}

export interface UpdateYouTubeVideoRequest {
  title?: string;
  display_order?: number;
  is_active?: boolean;
}

// =============================================
// 개인 전적 / 클럽 랭킹
// =============================================

export interface PlayerOverallStats {
  member_id: number;
  member_name: string;
  local_busu: number | null;
  open_busu: number | null;
  play_style: PlayStyle;
  pimple_type: PimpleType;
  match_wins: number;
  match_losses: number;
  sets_won: number;
  sets_lost: number;
  tournament_wins: number;
  tournament_losses: number;
}

export interface PlayerMeetingStats {
  meeting_id: number;
  year: number;
  month: number;
  meeting_name: string | null;
  wins: number;
  losses: number;
  sets_won: number;
  sets_lost: number;
}

export interface PlayerHeadToHead {
  opponent_id: number;
  opponent_name: string;
  wins: number;
  losses: number;
}

export interface PlayerTournamentResult {
  meeting_id: number;
  year: number;
  month: number;
  meeting_name: string | null;
  division: TournamentDivision;
  placement: string;
}

export interface ClubRankingEntry {
  member_id: number;
  member_name: string;
  local_busu: number | null;
  open_busu: number | null;
  play_style: PlayStyle;
  total_wins: number;
  total_losses: number;
  win_rate: number;
}

// =============================================
// 출석체크
// =============================================

export interface CheckHistory {
  id: number;
  club_id: number;
  member_id: number;
  helper_member_id: number;
  check_date: string;  // YYYYMMDD
  created_at: Date;
}

export interface AttendanceNotice {
  id: number;
  club_id: number;
  member_id: number;
  attend_date: string;
  start_time: string | null;
  end_time: string | null;
  departure_time: string | null;
  message: string | null;
  created_at: Date;
}

export interface AttendanceNoticeWithMember extends AttendanceNotice {
  member_name: string;
  like_count: number;
  comment_count: number;
  liked?: boolean;
}

export interface AttendanceComment {
  id: number;
  notice_id: number;
  member_id: number;
  member_name: string;
  message: string;
  like_count: number;
  liked?: boolean;
  created_at: Date;
}

export interface AttendanceLike {
  id: number;
  target_type: 'notice' | 'comment';
  target_id: number;
  member_id: number;
  created_at: Date;
}

export interface AttendanceStats {
  topAttenders: { member_id: number; member_name: string; count: number }[];
  topHelpers: { member_id: number; member_name: string; count: number }[];
}

// =============================================
// 게임방 (기록경기)
// =============================================

export type GameRoomStatus = 'open' | 'assigning' | 'assigned' | 'recording' | 'completed' | 'deleted';

export interface GameRoom {
  id: number;
  club_id: number;
  creator_member_id: number;
  name: string;
  game_date: string | null;
  game_time: string | null;
  match_type: MatchType;
  group_count: number;
  match_format: number;
  team_size: number;
  status: GameRoomStatus;
  created_at: Date;
}

export interface GameRoomWithCreator extends GameRoom {
  creator_name: string;
  applicant_count: number;
}

export interface GameRoomApplicant {
  id: number;
  room_id: number;
  member_id: number;
  added_by_admin: number;
  created_at: Date;
}

export interface GameRoomApplicantWithMember extends GameRoomApplicant {
  member_name: string;
  open_busu: number | null;
  gender: string;
  pimple_type: PimpleType;
  spouse_id: number | null;
}

export interface GameRoomGroupMember {
  member_id: number;
  member_name: string;
  open_busu: number | null;
  group_number: number;
  display_order: number;
}

export interface GameRoomMatch {
  group_number: number;
  player1_id: number;
  player2_id: number;
  player1_score: number;
  player2_score: number;
}

export interface GameRoomTeamMatch {
  team1_number: number;
  team2_number: number;
  team1_score: number;
  team2_score: number;
}

export interface GameRoomDetail extends GameRoom {
  creator_name: string;
  applicants: GameRoomApplicantWithMember[];
  groups: Record<number, GameRoomGroupMember[]>;
  matches: GameRoomMatch[];
  teamMatches: GameRoomTeamMatch[];
}

// =============================================
// 누적경기기록
// =============================================

export interface CumulativeMatch {
  id: number;
  club_id: number;
  recorder_member_id: number;
  player1_id: number;
  player2_id: number;
  player1_score: number;
  player2_score: number;
  match_date: string;
  memo: string | null;
  created_at: Date;
}

export interface CumulativeMatchWithNames extends CumulativeMatch {
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
