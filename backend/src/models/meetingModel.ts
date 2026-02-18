import pool from '../config/database';
import type {
  MonthlyMeeting,
  MeetingTournament,
  MeetingTeamMatch,
  MeetingTeamMatchGame,
  MeetingStatus,
  ApplicantWithMember,
  GroupWithMembers,
  Member,
  MeetingMatch,
  DBRow,
  TournamentDivision,
  GameType,
} from '../types';

export const meetingModel = {
  // Meeting CRUD
  async findCurrent(clubId: number = 1): Promise<MonthlyMeeting | null> {
    const [rows] = await pool.query<DBRow[]>(
      `SELECT * FROM monthly_meeting
       WHERE club_id = ? AND status != 'closed'
       ORDER BY year DESC, month DESC LIMIT 1`,
      [clubId]
    );
    return rows.length > 0 ? (rows[0] as MonthlyMeeting) : null;
  },

  async findById(id: number): Promise<MonthlyMeeting | null> {
    const [rows] = await pool.query<DBRow[]>(
      'SELECT * FROM monthly_meeting WHERE id = ?',
      [id]
    );
    return rows.length > 0 ? (rows[0] as MonthlyMeeting) : null;
  },

  async findAll(clubId: number = 1): Promise<MonthlyMeeting[]> {
    const [rows] = await pool.query<DBRow[]>(
      `SELECT * FROM monthly_meeting
       WHERE club_id = ?
       ORDER BY COALESCE(start_date, created_at) DESC`,
      [clubId]
    );
    return rows as MonthlyMeeting[];
  },

  async findClosed(clubId: number = 1): Promise<MonthlyMeeting[]> {
    const [rows] = await pool.query<DBRow[]>(
      `SELECT * FROM monthly_meeting
       WHERE club_id = ? AND status = 'closed'
       ORDER BY COALESCE(start_date, created_at) DESC`,
      [clubId]
    );
    return rows as MonthlyMeeting[];
  },

  async create(meeting: Omit<MonthlyMeeting, 'id' | 'created_at' | 'updated_at' | 'status'>): Promise<MonthlyMeeting> {
    const [result] = await pool.query(
      `INSERT INTO monthly_meeting (club_id, year, month, name, start_date, end_date, group_count, advance_rate, has_upper_tournament, has_lower_tournament, separate_spouses, use_detailed_score, match_format, busu_type, match_type, team_size, team_match_format)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        meeting.club_id || 1,
        meeting.year,
        meeting.month,
        meeting.name || null,
        meeting.start_date || null,
        meeting.end_date || null,
        meeting.group_count,
        meeting.advance_rate,
        meeting.has_upper_tournament ?? true,
        meeting.has_lower_tournament ?? false,
        meeting.separate_spouses ?? true,
        meeting.use_detailed_score ?? false,
        meeting.match_format ?? 'best_of_5',
        meeting.busu_type ?? 'local',
        meeting.match_type ?? 'individual',
        meeting.team_size ?? 0,
        meeting.team_match_format ?? 'dd',
      ]
    );
    const insertId = (result as any).insertId;
    return this.findById(insertId) as Promise<MonthlyMeeting>;
  },

  async updateStatus(id: number, status: MeetingStatus): Promise<void> {
    await pool.query('UPDATE monthly_meeting SET status = ? WHERE id = ?', [status, id]);
  },

  async updateOptions(id: number, options: {
    group_count?: number;
    advance_rate?: number;
    separate_spouses?: boolean;
    use_detailed_score?: boolean;
    match_format?: string;
    busu_type?: string;
    has_lower_tournament?: boolean;
    match_type?: string;
    team_size?: number;
    team_match_format?: string;
  }): Promise<void> {
    const fields: string[] = [];
    const values: any[] = [];

    if (options.group_count !== undefined) {
      fields.push('group_count = ?');
      values.push(options.group_count);
    }
    if (options.advance_rate !== undefined) {
      fields.push('advance_rate = ?');
      values.push(options.advance_rate);
    }
    if (options.separate_spouses !== undefined) {
      fields.push('separate_spouses = ?');
      values.push(options.separate_spouses);
    }
    if (options.use_detailed_score !== undefined) {
      fields.push('use_detailed_score = ?');
      values.push(options.use_detailed_score);
    }
    if (options.match_format !== undefined) {
      fields.push('match_format = ?');
      values.push(options.match_format);
    }
    if (options.busu_type !== undefined) {
      fields.push('busu_type = ?');
      values.push(options.busu_type);
    }
    if (options.has_lower_tournament !== undefined) {
      fields.push('has_lower_tournament = ?');
      values.push(options.has_lower_tournament);
    }
    if (options.match_type !== undefined) {
      fields.push('match_type = ?');
      values.push(options.match_type);
    }
    if (options.team_size !== undefined) {
      fields.push('team_size = ?');
      values.push(options.team_size);
    }
    if (options.team_match_format !== undefined) {
      fields.push('team_match_format = ?');
      values.push(options.team_match_format);
    }

    if (fields.length > 0) {
      values.push(id);
      await pool.query(`UPDATE monthly_meeting SET ${fields.join(', ')} WHERE id = ?`, values);
    }
  },

  async hasRecordedMatches(meetingId: number): Promise<boolean> {
    const [rows] = await pool.query<DBRow[]>(
      'SELECT COUNT(*) as count FROM meeting_match WHERE meeting_id = ?',
      [meetingId]
    );
    if (rows[0].count > 0) return true;

    // 단체전 기록도 체크
    const [teamRows] = await pool.query<DBRow[]>(
      'SELECT COUNT(*) as count FROM meeting_team_match WHERE meeting_id = ?',
      [meetingId]
    );
    return teamRows[0].count > 0;
  },

  async delete(id: number): Promise<void> {
    // 관련 데이터 삭제 (CASCADE로 처리되지만 명시적으로)
    await pool.query('DELETE FROM meeting_team_match_game WHERE meeting_id = ?', [id]);
    await pool.query('DELETE FROM meeting_team_match WHERE meeting_id = ?', [id]);
    await pool.query('DELETE FROM meeting_tournament WHERE meeting_id = ?', [id]);
    await pool.query('DELETE FROM meeting_match WHERE meeting_id = ?', [id]);
    await pool.query('DELETE FROM meeting_group WHERE meeting_id = ?', [id]);
    await pool.query('DELETE FROM meeting_applicant WHERE meeting_id = ?', [id]);
    await pool.query('DELETE FROM monthly_meeting WHERE id = ?', [id]);
  },

  // Applicants
  async getApplicants(meetingId: number): Promise<ApplicantWithMember[]> {
    const [rows] = await pool.query<DBRow[]>(
      `SELECT ma.*, m.*
       FROM meeting_applicant ma
       JOIN member m ON ma.member_id = m.id
       WHERE ma.meeting_id = ?
       ORDER BY ma.is_late, m.local_busu, m.name`,
      [meetingId]
    );

    return rows.map((row) => ({
      id: row.id,
      meeting_id: row.meeting_id,
      member_id: row.member_id,
      applied_at: row.applied_at,
      is_late: row.is_late,
      member: {
        id: row.member_id,
        club_id: row.club_id,
        name: row.name,
        birth_year: row.birth_year,
        gender: row.gender,
        phone: row.phone,
        local_busu: row.local_busu,
        open_busu: row.open_busu,
        play_style: row.play_style,
        pimple_type: row.pimple_type,
        spouse_id: row.spouse_id,
        is_active: row.is_active,
        created_at: row.created_at,
      } as Member,
    }));
  },

  async addApplicant(meetingId: number, memberId: number, isLate: boolean = false): Promise<void> {
    await pool.query(
      `INSERT INTO meeting_applicant (meeting_id, member_id, is_late) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE is_late = ?`,
      [meetingId, memberId, isLate, isLate]
    );
  },

  async addApplicants(meetingId: number, memberIds: number[], isLate: boolean = false): Promise<void> {
    if (memberIds.length === 0) return;

    const values = memberIds.map((memberId) => [meetingId, memberId, isLate]);
    await pool.query(
      `INSERT INTO meeting_applicant (meeting_id, member_id, is_late) VALUES ?
       ON DUPLICATE KEY UPDATE is_late = VALUES(is_late)`,
      [values]
    );
  },

  async removeApplicant(meetingId: number, memberId: number): Promise<void> {
    await pool.query(
      'DELETE FROM meeting_applicant WHERE meeting_id = ? AND member_id = ?',
      [meetingId, memberId]
    );
  },

  // Groups
  async getGroups(meetingId: number): Promise<GroupWithMembers[]> {
    const [rows] = await pool.query<DBRow[]>(
      `SELECT mg.group_num, mg.order_in_group, m.*
       FROM meeting_group mg
       JOIN member m ON mg.member_id = m.id
       WHERE mg.meeting_id = ?
       ORDER BY mg.group_num, mg.order_in_group`,
      [meetingId]
    );

    const groupMap = new Map<number, (Member & { order_in_group: number })[]>();
    for (const row of rows) {
      const groupNum = row.group_num;
      if (!groupMap.has(groupNum)) {
        groupMap.set(groupNum, []);
      }
      groupMap.get(groupNum)!.push({
        id: row.id,
        club_id: row.club_id,
        name: row.name,
        birth_year: row.birth_year,
        gender: row.gender,
        phone: row.phone,
        local_busu: row.local_busu,
        open_busu: row.open_busu,
        play_style: row.play_style,
        pimple_type: row.pimple_type,
        spouse_id: row.spouse_id,
        is_active: row.is_active,
        created_at: row.created_at,
        order_in_group: row.order_in_group,
      });
    }

    return Array.from(groupMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([group_num, members]) => ({ group_num, members }));
  },

  async clearGroups(meetingId: number): Promise<void> {
    await pool.query('DELETE FROM meeting_group WHERE meeting_id = ?', [meetingId]);
  },

  async saveGroups(meetingId: number, groups: Map<number, number[]>): Promise<void> {
    await this.clearGroups(meetingId);

    const values: [number, number, number, number][] = [];
    for (const [groupNum, memberIds] of groups) {
      memberIds.forEach((memberId, order) => {
        values.push([meetingId, groupNum, memberId, order + 1]);
      });
    }

    if (values.length > 0) {
      await pool.query(
        `INSERT INTO meeting_group (meeting_id, group_num, member_id, order_in_group)
         VALUES ?`,
        [values]
      );
    }
  },

  async reassignMember(meetingId: number, memberId: number, newGroupNum: number): Promise<void> {
    // Get current max order in new group
    const [rows] = await pool.query<DBRow[]>(
      'SELECT MAX(order_in_group) as max_order FROM meeting_group WHERE meeting_id = ? AND group_num = ?',
      [meetingId, newGroupNum]
    );
    const maxOrder = rows[0]?.max_order || 0;

    // INSERT ON DUPLICATE KEY UPDATE로 신규/기존 모두 처리
    await pool.query(
      `INSERT INTO meeting_group (meeting_id, group_num, member_id, order_in_group)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE group_num = VALUES(group_num), order_in_group = VALUES(order_in_group)`,
      [meetingId, newGroupNum, memberId, maxOrder + 1]
    );
  },

  // Matches
  async getMatches(meetingId: number, groupNum: number): Promise<MeetingMatch[]> {
    const [rows] = await pool.query<DBRow[]>(
      'SELECT * FROM meeting_match WHERE meeting_id = ? AND group_num = ?',
      [meetingId, groupNum]
    );
    return rows as MeetingMatch[];
  },

  async getAllMatches(meetingId: number): Promise<MeetingMatch[]> {
    const [rows] = await pool.query<DBRow[]>(
      'SELECT * FROM meeting_match WHERE meeting_id = ?',
      [meetingId]
    );
    return rows as MeetingMatch[];
  },

  async saveMatch(
    meetingId: number,
    groupNum: number,
    player1Id: number,
    player2Id: number,
    player1Sets: number,
    player2Sets: number
  ): Promise<void> {
    // Ensure player1_id < player2_id for consistency
    const [p1, p2, s1, s2] =
      player1Id < player2Id
        ? [player1Id, player2Id, player1Sets, player2Sets]
        : [player2Id, player1Id, player2Sets, player1Sets];

    await pool.query(
      `INSERT INTO meeting_match (meeting_id, group_num, player1_id, player2_id, player1_sets, player2_sets)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE player1_sets = ?, player2_sets = ?, recorded_at = CURRENT_TIMESTAMP`,
      [meetingId, groupNum, p1, p2, s1, s2, s1, s2]
    );
  },

  async deleteMatch(meetingId: number, player1Id: number, player2Id: number): Promise<void> {
    const [p1, p2] = player1Id < player2Id ? [player1Id, player2Id] : [player2Id, player1Id];
    await pool.query(
      'DELETE FROM meeting_match WHERE meeting_id = ? AND player1_id = ? AND player2_id = ?',
      [meetingId, p1, p2]
    );
  },

  // Tournament
  async getTournament(meetingId: number, division?: TournamentDivision): Promise<MeetingTournament[]> {
    let query = 'SELECT * FROM meeting_tournament WHERE meeting_id = ?';
    const params: any[] = [meetingId];

    if (division) {
      query += ' AND division = ?';
      params.push(division);
    }

    query += ' ORDER BY division, round DESC, match_order';

    const [rows] = await pool.query<DBRow[]>(query, params);
    return rows as MeetingTournament[];
  },

  async clearTournament(meetingId: number, division?: TournamentDivision): Promise<void> {
    if (division) {
      await pool.query('DELETE FROM meeting_tournament WHERE meeting_id = ? AND division = ?', [meetingId, division]);
    } else {
      await pool.query('DELETE FROM meeting_tournament WHERE meeting_id = ?', [meetingId]);
    }
  },

  async saveTournamentMatches(matches: Omit<MeetingTournament, 'id'>[]): Promise<void> {
    if (matches.length === 0) return;

    const values = matches.map((m) => [
      m.meeting_id,
      m.division,
      m.round,
      m.match_order,
      m.player1_id,
      m.player2_id,
      m.winner_id,
      m.player1_from_group,
      m.player2_from_group,
      m.player1_rank,
      m.player2_rank,
      m.player1_sets,
      m.player2_sets,
      m.is_bye,
    ]);

    await pool.query(
      `INSERT INTO meeting_tournament
       (meeting_id, division, round, match_order, player1_id, player2_id, winner_id, player1_from_group, player2_from_group, player1_rank, player2_rank, player1_sets, player2_sets, is_bye)
       VALUES ?`,
      [values]
    );
  },

  async setTournamentWinner(matchId: number, winnerId: number, p1Sets?: number, p2Sets?: number): Promise<MeetingTournament | null> {
    if (p1Sets !== undefined && p2Sets !== undefined) {
      await pool.query(
        'UPDATE meeting_tournament SET winner_id = ?, player1_sets = ?, player2_sets = ? WHERE id = ?',
        [winnerId, p1Sets, p2Sets, matchId]
      );
    } else {
      await pool.query('UPDATE meeting_tournament SET winner_id = ? WHERE id = ?', [winnerId, matchId]);
    }

    const [rows] = await pool.query<DBRow[]>(
      'SELECT * FROM meeting_tournament WHERE id = ?',
      [matchId]
    );
    return rows.length > 0 ? (rows[0] as MeetingTournament) : null;
  },

  async getTournamentMatch(matchId: number): Promise<MeetingTournament | null> {
    const [rows] = await pool.query<DBRow[]>(
      'SELECT * FROM meeting_tournament WHERE id = ?',
      [matchId]
    );
    return rows.length > 0 ? (rows[0] as MeetingTournament) : null;
  },

  async advanceWinnerToNextRound(
    meetingId: number,
    division: TournamentDivision,
    currentRound: number,
    currentMatchOrder: number,
    winnerId: number,
    winnerFromGroup: number | null,
    winnerRank: number | null = null
  ): Promise<void> {
    const nextRound = currentRound / 2;
    if (nextRound < 1) return;

    const nextMatchOrder = Math.ceil(currentMatchOrder / 2);
    const isPlayer1 = currentMatchOrder % 2 === 1;

    if (isPlayer1) {
      await pool.query(
        `UPDATE meeting_tournament
         SET player1_id = ?, player1_from_group = ?, player1_rank = ?
         WHERE meeting_id = ? AND division = ? AND round = ? AND match_order = ?`,
        [winnerId, winnerFromGroup, winnerRank, meetingId, division, nextRound, nextMatchOrder]
      );
    } else {
      await pool.query(
        `UPDATE meeting_tournament
         SET player2_id = ?, player2_from_group = ?, player2_rank = ?
         WHERE meeting_id = ? AND division = ? AND round = ? AND match_order = ?`,
        [winnerId, winnerFromGroup, winnerRank, meetingId, division, nextRound, nextMatchOrder]
      );
    }
  },

  async clearNextRoundsWinner(
    meetingId: number,
    division: TournamentDivision,
    startRound: number,
    playerId: number
  ): Promise<void> {
    // Clear this player from all subsequent rounds
    let currentRound = startRound / 2;
    while (currentRound >= 1) {
      await pool.query(
        `UPDATE meeting_tournament
         SET player1_id = NULL, player1_from_group = NULL, winner_id = NULL
         WHERE meeting_id = ? AND division = ? AND round = ? AND player1_id = ?`,
        [meetingId, division, currentRound, playerId]
      );
      await pool.query(
        `UPDATE meeting_tournament
         SET player2_id = NULL, player2_from_group = NULL, winner_id = NULL
         WHERE meeting_id = ? AND division = ? AND round = ? AND player2_id = ?`,
        [meetingId, division, currentRound, playerId]
      );
      currentRound = currentRound / 2;
    }
  },

  // Team Matches (단체전)
  async getTeamMatches(meetingId: number): Promise<MeetingTeamMatch[]> {
    const [rows] = await pool.query<DBRow[]>(
      'SELECT * FROM meeting_team_match WHERE meeting_id = ? ORDER BY team1_num, team2_num',
      [meetingId]
    );
    return rows as MeetingTeamMatch[];
  },

  async saveTeamMatch(
    meetingId: number,
    team1Num: number,
    team2Num: number,
    team1Score: number,
    team2Score: number
  ): Promise<void> {
    const [t1, t2, s1, s2] =
      team1Num < team2Num
        ? [team1Num, team2Num, team1Score, team2Score]
        : [team2Num, team1Num, team2Score, team1Score];

    await pool.query(
      `INSERT INTO meeting_team_match (meeting_id, team1_num, team2_num, team1_score, team2_score)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE team1_score = ?, team2_score = ?, recorded_at = CURRENT_TIMESTAMP`,
      [meetingId, t1, t2, s1, s2, s1, s2]
    );
  },

  async deleteTeamMatch(meetingId: number, team1Num: number, team2Num: number): Promise<void> {
    const [t1, t2] = team1Num < team2Num ? [team1Num, team2Num] : [team2Num, team1Num];
    // 개별 경기도 함께 삭제
    await pool.query(
      'DELETE FROM meeting_team_match_game WHERE meeting_id = ? AND team1_num = ? AND team2_num = ?',
      [meetingId, t1, t2]
    );
    await pool.query(
      'DELETE FROM meeting_team_match WHERE meeting_id = ? AND team1_num = ? AND team2_num = ?',
      [meetingId, t1, t2]
    );
  },

  async getTeamMatchGames(meetingId: number, team1Num?: number, team2Num?: number): Promise<MeetingTeamMatchGame[]> {
    let query = 'SELECT * FROM meeting_team_match_game WHERE meeting_id = ?';
    const params: any[] = [meetingId];

    if (team1Num !== undefined && team2Num !== undefined) {
      const [t1, t2] = team1Num < team2Num ? [team1Num, team2Num] : [team2Num, team1Num];
      query += ' AND team1_num = ? AND team2_num = ?';
      params.push(t1, t2);
    }

    query += ' ORDER BY team1_num, team2_num, game_order';

    const [rows] = await pool.query<DBRow[]>(query, params);
    return rows as MeetingTeamMatchGame[];
  },

  async saveTeamMatchGame(
    meetingId: number,
    team1Num: number,
    team2Num: number,
    gameOrder: number,
    gameType: GameType,
    team1Player1Id?: number,
    team1Player2Id?: number,
    team2Player1Id?: number,
    team2Player2Id?: number,
    winnerTeam?: number
  ): Promise<void> {
    const [t1, t2] = team1Num < team2Num ? [team1Num, team2Num] : [team2Num, team1Num];
    // 팀 번호가 바뀌면 player와 winner도 반전
    const swapped = team1Num > team2Num;
    const t1p1 = swapped ? team2Player1Id : team1Player1Id;
    const t1p2 = swapped ? team2Player2Id : team1Player2Id;
    const t2p1 = swapped ? team1Player1Id : team2Player1Id;
    const t2p2 = swapped ? team1Player2Id : team2Player2Id;
    let wt = winnerTeam;
    if (swapped && wt !== undefined && wt !== null) {
      wt = wt === team1Num ? team2Num : (wt === team2Num ? team1Num : wt);
      // Now wt refers to the original team num; remap to t1/t2
      // Actually simpler: if swapped, t1 = original team2Num, t2 = original team1Num
      // winnerTeam was in terms of original team nums. We need it in terms of t1/t2.
    }
    // Simpler approach: winnerTeam stores the actual team number
    // No remapping needed since we store team numbers, not positions

    await pool.query(
      `INSERT INTO meeting_team_match_game
       (meeting_id, team1_num, team2_num, game_order, game_type, team1_player1_id, team1_player2_id, team2_player1_id, team2_player2_id, winner_team)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
       game_type = ?, team1_player1_id = ?, team1_player2_id = ?, team2_player1_id = ?, team2_player2_id = ?, winner_team = ?, recorded_at = CURRENT_TIMESTAMP`,
      [
        meetingId, t1, t2, gameOrder, gameType,
        t1p1 || null, t1p2 || null, t2p1 || null, t2p2 || null, wt || null,
        gameType, t1p1 || null, t1p2 || null, t2p1 || null, t2p2 || null, wt || null,
      ]
    );
  },

  async deleteTeamMatchGame(meetingId: number, team1Num: number, team2Num: number, gameOrder: number): Promise<void> {
    const [t1, t2] = team1Num < team2Num ? [team1Num, team2Num] : [team2Num, team1Num];
    await pool.query(
      'DELETE FROM meeting_team_match_game WHERE meeting_id = ? AND team1_num = ? AND team2_num = ? AND game_order = ?',
      [meetingId, t1, t2, gameOrder]
    );
  },

  async updateTeamMatchScoreFromGames(meetingId: number, team1Num: number, team2Num: number): Promise<void> {
    const [t1, t2] = team1Num < team2Num ? [team1Num, team2Num] : [team2Num, team1Num];
    const games = await this.getTeamMatchGames(meetingId, t1, t2);

    let t1Score = 0;
    let t2Score = 0;
    for (const game of games) {
      if (game.winner_team === t1) t1Score++;
      else if (game.winner_team === t2) t2Score++;
    }

    await this.saveTeamMatch(meetingId, t1, t2, t1Score, t2Score);
  },

  /**
   * 토너먼트 최종 순위 조회
   * 1위: 결승 승자
   * 2위: 결승 패자
   * 공동 3위: 4강 패자 2명
   * 8강 진출자, 16강 진출자 등
   */
  async getTournamentStandings(meetingId: number, division: TournamentDivision = 'upper'): Promise<{
    rank: number;
    member_id: number;
    member_name: string;
    eliminated_round: number | null;  // 탈락한 라운드 (null이면 우승)
    from_group: number | null;
    group_rank: number | null;
  }[]> {
    const [rows] = await pool.query<DBRow[]>(
      `SELECT
        t.round,
        t.player1_id,
        t.player2_id,
        t.winner_id,
        t.player1_from_group,
        t.player2_from_group,
        t.player1_rank,
        t.player2_rank,
        t.is_bye,
        m1.name as player1_name,
        m2.name as player2_name
       FROM meeting_tournament t
       LEFT JOIN member m1 ON t.player1_id = m1.id
       LEFT JOIN member m2 ON t.player2_id = m2.id
       WHERE t.meeting_id = ? AND t.division = ?
       ORDER BY t.round ASC, t.match_order ASC`,
      [meetingId, division]
    );

    if (rows.length === 0) return [];

    const standings: {
      rank: number;
      member_id: number;
      member_name: string;
      eliminated_round: number | null;
      from_group: number | null;
      group_rank: number | null;
    }[] = [];

    // 각 라운드별 탈락자 추적
    const eliminatedPlayers = new Map<number, { round: number; name: string; fromGroup: number | null; groupRank: number | null }>();
    let champion: { id: number; name: string; fromGroup: number | null; groupRank: number | null } | null = null;
    let runnerUp: { id: number; name: string; fromGroup: number | null; groupRank: number | null } | null = null;

    for (const match of rows) {
      if (!match.winner_id) continue;
      if (match.is_bye) continue;

      // 패자 확인
      const loserId = match.winner_id === match.player1_id ? match.player2_id : match.player1_id;
      const loserName = match.winner_id === match.player1_id ? match.player2_name : match.player1_name;
      const loserFromGroup = match.winner_id === match.player1_id ? match.player2_from_group : match.player1_from_group;
      const loserGroupRank = match.winner_id === match.player1_id ? match.player2_rank : match.player1_rank;

      if (loserId && loserName) {
        eliminatedPlayers.set(loserId, {
          round: match.round,
          name: loserName,
          fromGroup: loserFromGroup,
          groupRank: loserGroupRank,
        });
      }

      // 결승전 (round = 1)
      if (match.round === 1 && match.winner_id) {
        const winnerName = match.winner_id === match.player1_id ? match.player1_name : match.player2_name;
        const winnerFromGroup = match.winner_id === match.player1_id ? match.player1_from_group : match.player2_from_group;
        const winnerGroupRank = match.winner_id === match.player1_id ? match.player1_rank : match.player2_rank;

        champion = { id: match.winner_id, name: winnerName, fromGroup: winnerFromGroup, groupRank: winnerGroupRank };
        runnerUp = { id: loserId, name: loserName, fromGroup: loserFromGroup, groupRank: loserGroupRank };
      }
    }

    // 순위 계산
    // 1위: 우승자
    if (champion) {
      standings.push({
        rank: 1,
        member_id: champion.id,
        member_name: champion.name,
        eliminated_round: null,
        from_group: champion.fromGroup,
        group_rank: champion.groupRank,
      });
    }

    // 2위: 준우승
    if (runnerUp && runnerUp.id) {
      standings.push({
        rank: 2,
        member_id: runnerUp.id,
        member_name: runnerUp.name,
        eliminated_round: 1,
        from_group: runnerUp.fromGroup,
        group_rank: runnerUp.groupRank,
      });
      eliminatedPlayers.delete(runnerUp.id);
    }

    // 나머지 탈락자들을 라운드별로 순위 부여
    // round 2 탈락 = 공동 3위 (4강 탈락)
    // round 4 탈락 = 공동 5위 (8강 탈락)
    // round 8 탈락 = 공동 9위 (16강 탈락)
    const roundRanks: Record<number, number> = {
      2: 3,   // 4강 탈락 = 공동 3위
      4: 5,   // 8강 탈락 = 공동 5위
      8: 9,   // 16강 탈락 = 공동 9위
      16: 17, // 32강 탈락 = 공동 17위
    };

    const sortedEliminated = Array.from(eliminatedPlayers.entries())
      .sort((a, b) => a[1].round - b[1].round);

    for (const [memberId, info] of sortedEliminated) {
      standings.push({
        rank: roundRanks[info.round] || info.round * 2 + 1,
        member_id: memberId,
        member_name: info.name,
        eliminated_round: info.round,
        from_group: info.fromGroup,
        group_rank: info.groupRank,
      });
    }

    // 순위순 정렬
    standings.sort((a, b) => a.rank - b.rank);

    return standings;
  },
};
