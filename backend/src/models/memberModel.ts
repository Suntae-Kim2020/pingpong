import pool from '../config/database';
import type { Member, DBRow } from '../types';

export const memberModel = {
  async findAll(clubId: number = 1): Promise<Member[]> {
    const [rows] = await pool.query<DBRow[]>(
      'SELECT * FROM member WHERE club_id = ? ORDER BY local_busu, name',
      [clubId]
    );
    return rows as Member[];
  },

  async findById(id: number): Promise<Member | null> {
    const [rows] = await pool.query<DBRow[]>(
      'SELECT * FROM member WHERE id = ?',
      [id]
    );
    return rows.length > 0 ? (rows[0] as Member) : null;
  },

  async findByIds(ids: number[]): Promise<Member[]> {
    if (ids.length === 0) return [];
    const [rows] = await pool.query<DBRow[]>(
      'SELECT * FROM member WHERE id IN (?)',
      [ids]
    );
    return rows as Member[];
  },

  // 클럽 내 이름으로 기존 member 검색 (club_membership에 연결되지 않은 것 우선)
  async findByClubAndName(clubId: number, name: string): Promise<Member | null> {
    const [rows] = await pool.query<DBRow[]>(
      `SELECT m.* FROM member m
       LEFT JOIN club_membership cm ON cm.member_id = m.id AND cm.club_id = m.club_id
       WHERE m.club_id = ? AND m.name = ? AND m.is_active = TRUE
       ORDER BY cm.id IS NULL DESC, m.id ASC
       LIMIT 1`,
      [clubId, name]
    );
    return rows.length > 0 ? (rows[0] as Member) : null;
  },

  async create(member: Omit<Member, 'id' | 'created_at'>): Promise<Member> {
    const [result] = await pool.query(
      `INSERT INTO member (club_id, name, profile_image, birth_year, gender, phone, local_busu, open_busu, play_style, pimple_type, spouse_id, is_active, role)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        member.club_id,
        member.name,
        member.profile_image || null,
        member.birth_year,
        member.gender,
        member.phone,
        member.local_busu,
        member.open_busu,
        member.play_style,
        member.pimple_type,
        member.spouse_id,
        member.is_active,
        member.role || 'member',
      ]
    );
    const insertId = (result as any).insertId;
    return { ...member, id: insertId, created_at: new Date() } as Member;
  },

  // 클럽 내 중복 member 정리: 같은 이름의 중복 레코드를 하나로 병합
  async deduplicateByClub(clubId: number): Promise<number> {
    // 같은 club_id + name 조합에서 중복인 것 찾기
    const [dupes] = await pool.query<DBRow[]>(
      `SELECT name, MIN(id) as keep_id, GROUP_CONCAT(id) as all_ids, COUNT(*) as cnt
       FROM member
       WHERE club_id = ? AND is_active = TRUE
       GROUP BY name
       HAVING cnt > 1`,
      [clubId]
    );

    let removedCount = 0;
    for (const row of dupes as any[]) {
      const keepId = row.keep_id;
      const allIds = (row.all_ids as string).split(',').map(Number);
      const removeIds = allIds.filter((id: number) => id !== keepId);

      if (removeIds.length === 0) continue;

      // club_membership의 member_id를 keepId로 통합
      await pool.query(
        `UPDATE club_membership SET member_id = ? WHERE member_id IN (?) AND club_id = ?`,
        [keepId, removeIds, clubId]
      );

      // 경기 기록 등 다른 테이블의 참조도 keepId로 변경
      const refTables = [
        { table: 'check_history', columns: ['member_id', 'helper_member_id'] },
        { table: 'meeting_applicant', columns: ['member_id'] },
        { table: 'meeting_group', columns: ['member_id'] },
        { table: 'meeting_match', columns: ['player1_id', 'player2_id'] },
        { table: 'meeting_tournament', columns: ['player1_id', 'player2_id'] },
        { table: 'cumulative_match', columns: ['player1_id', 'player2_id'] },
        { table: 'monthly_record', columns: ['player_id', 'opponent_id'] },
      ];

      for (const ref of refTables) {
        for (const col of ref.columns) {
          try {
            await pool.query(
              `UPDATE ${ref.table} SET ${col} = ? WHERE ${col} IN (?) AND club_id = ?`,
              [keepId, removeIds, clubId]
            );
          } catch {
            // 테이블이 없거나 club_id 컬럼이 없는 경우 무시
            try {
              await pool.query(
                `UPDATE ${ref.table} SET ${col} = ? WHERE ${col} IN (?)`,
                [keepId, removeIds]
              );
            } catch {
              // 무시
            }
          }
        }
      }

      // 중복 member를 비활성화
      await pool.query(
        `UPDATE member SET is_active = FALSE WHERE id IN (?) AND club_id = ?`,
        [removeIds, clubId]
      );

      removedCount += removeIds.length;
    }

    return removedCount;
  },

  async update(id: number, member: Partial<Member>): Promise<void> {
    const fields: string[] = [];
    const values: any[] = [];

    if (member.name !== undefined) {
      fields.push('name = ?');
      values.push(member.name);
    }
    if (member.profile_image !== undefined) {
      fields.push('profile_image = ?');
      values.push(member.profile_image);
    }
    if (member.birth_year !== undefined) {
      fields.push('birth_year = ?');
      values.push(member.birth_year);
    }
    if (member.gender !== undefined) {
      fields.push('gender = ?');
      values.push(member.gender);
    }
    if (member.phone !== undefined) {
      fields.push('phone = ?');
      values.push(member.phone);
    }
    if (member.local_busu !== undefined) {
      fields.push('local_busu = ?');
      values.push(member.local_busu);
    }
    if (member.open_busu !== undefined) {
      fields.push('open_busu = ?');
      values.push(member.open_busu);
    }
    if (member.play_style !== undefined) {
      fields.push('play_style = ?');
      values.push(member.play_style);
    }
    if (member.pimple_type !== undefined) {
      fields.push('pimple_type = ?');
      values.push(member.pimple_type);
    }
    if (member.spouse_id !== undefined) {
      fields.push('spouse_id = ?');
      values.push(member.spouse_id);
    }
    if (member.is_active !== undefined) {
      fields.push('is_active = ?');
      values.push(member.is_active);
    }
    if (member.role !== undefined) {
      fields.push('role = ?');
      values.push(member.role);
    }

    if (fields.length === 0) return;

    values.push(id);
    await pool.query(`UPDATE member SET ${fields.join(', ')} WHERE id = ?`, values);
  },

  // 부부(배우자) 양방향 설정. spouseId가 null이면 해제.
  // 기존 배우자가 있으면 양쪽 모두 정리한 뒤 새 관계를 맺는다.
  async setSpouse(memberId: number, spouseId: number | null): Promise<void> {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // 1) memberId의 기존 배우자 연결 해제 (상대 쪽도)
      const [curRows] = await conn.query<DBRow[]>('SELECT spouse_id FROM member WHERE id = ?', [memberId]);
      const oldSpouse = (curRows[0]?.spouse_id as number | null) ?? null;
      if (oldSpouse && oldSpouse !== spouseId) {
        await conn.query('UPDATE member SET spouse_id = NULL WHERE id = ? AND spouse_id = ?', [oldSpouse, memberId]);
      }

      if (spouseId) {
        // 2) 새 배우자가 다른 사람과 묶여 있으면 그 연결도 해제
        const [spRows] = await conn.query<DBRow[]>('SELECT spouse_id FROM member WHERE id = ?', [spouseId]);
        const spOld = (spRows[0]?.spouse_id as number | null) ?? null;
        if (spOld && spOld !== memberId) {
          await conn.query('UPDATE member SET spouse_id = NULL WHERE id = ? AND spouse_id = ?', [spOld, spouseId]);
        }
        // 3) 양방향 연결
        await conn.query('UPDATE member SET spouse_id = ? WHERE id = ?', [spouseId, memberId]);
        await conn.query('UPDATE member SET spouse_id = ? WHERE id = ?', [memberId, spouseId]);
      } else {
        await conn.query('UPDATE member SET spouse_id = NULL WHERE id = ?', [memberId]);
      }

      await conn.commit();
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  },
};
