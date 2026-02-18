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

  async create(member: Omit<Member, 'id' | 'created_at'>): Promise<Member> {
    const [result] = await pool.query(
      `INSERT INTO member (club_id, name, birth_year, gender, phone, local_busu, open_busu, play_style, pimple_type, spouse_id, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        member.club_id,
        member.name,
        member.birth_year,
        member.gender,
        member.phone,
        member.local_busu,
        member.open_busu,
        member.play_style,
        member.pimple_type,
        member.spouse_id,
        member.is_active,
      ]
    );
    const insertId = (result as any).insertId;
    return { ...member, id: insertId, created_at: new Date() } as Member;
  },

  async update(id: number, member: Partial<Member>): Promise<void> {
    const fields: string[] = [];
    const values: any[] = [];

    if (member.name !== undefined) {
      fields.push('name = ?');
      values.push(member.name);
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

    if (fields.length === 0) return;

    values.push(id);
    await pool.query(`UPDATE member SET ${fields.join(', ')} WHERE id = ?`, values);
  },
};
