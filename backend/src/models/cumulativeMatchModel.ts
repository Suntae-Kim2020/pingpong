import pool from '../config/database';
import type { DBRow, DBResult, CumulativeMatchWithNames, CumulativeMatchStats } from '../types';

export const cumulativeMatchModel = {
  async create(data: {
    clubId: number;
    recorderMemberId: number;
    player1Id: number;
    player2Id: number;
    player1Score: number;
    player2Score: number;
    matchDate: string;
    memo?: string;
  }): Promise<number> {
    const [result] = await pool.query<DBResult>(
      `INSERT INTO cumulative_match (club_id, recorder_member_id, player1_id, player2_id, player1_score, player2_score, match_date, memo)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [data.clubId, data.recorderMemberId, data.player1Id, data.player2Id, data.player1Score, data.player2Score, data.matchDate, data.memo || null]
    );
    return result.insertId;
  },

  async delete(matchId: number, recorderMemberId: number): Promise<boolean> {
    const [result] = await pool.query<DBResult>(
      'DELETE FROM cumulative_match WHERE id = ? AND recorder_member_id = ?',
      [matchId, recorderMemberId]
    );
    return result.affectedRows > 0;
  },

  async getHistory(clubId: number, filters?: { memberId?: number; opponentId?: number }): Promise<CumulativeMatchWithNames[]> {
    let sql = `
      SELECT cm.*,
             m1.name AS player1_name,
             m2.name AS player2_name,
             mr.name AS recorder_name
      FROM cumulative_match cm
      JOIN member m1 ON m1.id = cm.player1_id
      JOIN member m2 ON m2.id = cm.player2_id
      JOIN member mr ON mr.id = cm.recorder_member_id
      WHERE cm.club_id = ?`;
    const params: any[] = [clubId];

    if (filters?.memberId) {
      sql += ' AND (cm.player1_id = ? OR cm.player2_id = ?)';
      params.push(filters.memberId, filters.memberId);
    }
    if (filters?.opponentId) {
      sql += ' AND (cm.player1_id = ? OR cm.player2_id = ?)';
      params.push(filters.opponentId, filters.opponentId);
    }

    sql += ' ORDER BY cm.match_date DESC, cm.created_at DESC';

    const [rows] = await pool.query<DBRow[]>(sql, params);
    return rows as unknown as CumulativeMatchWithNames[];
  },

  async getHeadToHead(clubId: number, p1: number, p2: number): Promise<{ wins: number; losses: number; matches: CumulativeMatchWithNames[] }> {
    const [rows] = await pool.query<DBRow[]>(
      `SELECT cm.*,
              m1.name AS player1_name,
              m2.name AS player2_name,
              mr.name AS recorder_name
       FROM cumulative_match cm
       JOIN member m1 ON m1.id = cm.player1_id
       JOIN member m2 ON m2.id = cm.player2_id
       JOIN member mr ON mr.id = cm.recorder_member_id
       WHERE cm.club_id = ?
         AND ((cm.player1_id = ? AND cm.player2_id = ?) OR (cm.player1_id = ? AND cm.player2_id = ?))
       ORDER BY cm.match_date DESC, cm.created_at DESC`,
      [clubId, p1, p2, p2, p1]
    );

    const matches = rows as unknown as CumulativeMatchWithNames[];
    let wins = 0;
    let losses = 0;
    for (const m of matches) {
      if (m.player1_id === p1) {
        if (m.player1_score > m.player2_score) wins++;
        else if (m.player1_score < m.player2_score) losses++;
      } else {
        if (m.player2_score > m.player1_score) wins++;
        else if (m.player2_score < m.player1_score) losses++;
      }
    }

    return { wins, losses, matches };
  },

  async getMemberStats(clubId: number, memberId: number): Promise<CumulativeMatchStats[]> {
    const [rows] = await pool.query<DBRow[]>(
      `SELECT
         opponent_id,
         m.name AS opponent_name,
         SUM(wins) AS wins,
         SUM(losses) AS losses
       FROM (
         SELECT player2_id AS opponent_id,
                CASE WHEN player1_score > player2_score THEN 1 ELSE 0 END AS wins,
                CASE WHEN player1_score < player2_score THEN 1 ELSE 0 END AS losses
         FROM cumulative_match
         WHERE club_id = ? AND player1_id = ?
         UNION ALL
         SELECT player1_id AS opponent_id,
                CASE WHEN player2_score > player1_score THEN 1 ELSE 0 END AS wins,
                CASE WHEN player2_score < player1_score THEN 1 ELSE 0 END AS losses
         FROM cumulative_match
         WHERE club_id = ? AND player2_id = ?
       ) AS h2h
       INNER JOIN member m ON m.id = h2h.opponent_id
       GROUP BY opponent_id, m.name
       ORDER BY (SUM(wins) + SUM(losses)) DESC, m.name`,
      [clubId, memberId, clubId, memberId]
    );
    return rows as unknown as CumulativeMatchStats[];
  },

  async getMemberOverall(clubId: number, memberId: number): Promise<{ wins: number; losses: number }> {
    const [rows] = await pool.query<DBRow[]>(
      `SELECT
         COALESCE(SUM(wins), 0) AS wins,
         COALESCE(SUM(losses), 0) AS losses
       FROM (
         SELECT
           CASE WHEN player1_score > player2_score THEN 1 ELSE 0 END AS wins,
           CASE WHEN player1_score < player2_score THEN 1 ELSE 0 END AS losses
         FROM cumulative_match
         WHERE club_id = ? AND player1_id = ?
         UNION ALL
         SELECT
           CASE WHEN player2_score > player1_score THEN 1 ELSE 0 END AS wins,
           CASE WHEN player2_score < player1_score THEN 1 ELSE 0 END AS losses
         FROM cumulative_match
         WHERE club_id = ? AND player2_id = ?
       ) AS combined`,
      [clubId, memberId, clubId, memberId]
    );
    const row = rows[0] as any;
    return { wins: Number(row.wins), losses: Number(row.losses) };
  },
};
