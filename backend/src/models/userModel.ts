import pool from '../config/database';
import type { User, SocialProvider, DBRow } from '../types';

export const userModel = {
  async findById(id: number): Promise<User | null> {
    const [rows] = await pool.query<DBRow[]>(
      'SELECT * FROM user WHERE id = ?',
      [id]
    );
    return rows.length > 0 ? (rows[0] as User) : null;
  },

  async findByProvider(provider: SocialProvider, providerId: string): Promise<User | null> {
    const [rows] = await pool.query<DBRow[]>(
      'SELECT * FROM user WHERE provider = ? AND provider_id = ?',
      [provider, providerId]
    );
    return rows.length > 0 ? (rows[0] as User) : null;
  },

  async findByEmail(email: string): Promise<User | null> {
    const [rows] = await pool.query<DBRow[]>(
      'SELECT * FROM user WHERE email = ?',
      [email]
    );
    return rows.length > 0 ? (rows[0] as User) : null;
  },

  async create(userData: {
    provider: SocialProvider;
    provider_id: string;
    email?: string | null;
    name: string;
    nickname?: string | null;
    profile_image?: string | null;
    phone?: string | null;
    birth_year?: number | null;
    gender?: 'M' | 'F' | null;
  }): Promise<User> {
    const [result] = await pool.query(
      `INSERT INTO user (provider, provider_id, email, name, nickname, profile_image, phone, birth_year, gender)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userData.provider,
        userData.provider_id,
        userData.email || null,
        userData.name,
        userData.nickname || null,
        userData.profile_image || null,
        userData.phone || null,
        userData.birth_year || null,
        userData.gender || null,
      ]
    );
    const insertId = (result as any).insertId;
    return this.findById(insertId) as Promise<User>;
  },

  async update(id: number, userData: Partial<User>): Promise<User | null> {
    const fields: string[] = [];
    const values: any[] = [];

    if (userData.name !== undefined) {
      fields.push('name = ?');
      values.push(userData.name);
    }
    if (userData.nickname !== undefined) {
      fields.push('nickname = ?');
      values.push(userData.nickname);
    }
    if (userData.email !== undefined) {
      fields.push('email = ?');
      values.push(userData.email);
    }
    if (userData.profile_image !== undefined) {
      fields.push('profile_image = ?');
      values.push(userData.profile_image);
    }
    if (userData.phone !== undefined) {
      fields.push('phone = ?');
      values.push(userData.phone);
    }
    if (userData.birth_year !== undefined) {
      fields.push('birth_year = ?');
      values.push(userData.birth_year);
    }
    if (userData.gender !== undefined) {
      fields.push('gender = ?');
      values.push(userData.gender);
    }

    if (fields.length === 0) return this.findById(id);

    values.push(id);
    await pool.query(
      `UPDATE user SET ${fields.join(', ')} WHERE id = ?`,
      values
    );

    return this.findById(id);
  },

  async updateLastLogin(id: number): Promise<void> {
    await pool.query(
      'UPDATE user SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?',
      [id]
    );
  },

  async findOrCreate(userData: {
    provider: SocialProvider;
    provider_id: string;
    email?: string | null;
    name: string;
    nickname?: string | null;
    profile_image?: string | null;
  }): Promise<{ user: User; isNew: boolean }> {
    const existingUser = await this.findByProvider(userData.provider, userData.provider_id);

    if (existingUser) {
      // 기존 사용자 - 프로필 업데이트
      await this.update(existingUser.id, {
        name: userData.name,
        nickname: userData.nickname,
        profile_image: userData.profile_image,
      });
      await this.updateLastLogin(existingUser.id);
      const updatedUser = await this.findById(existingUser.id);
      return { user: updatedUser!, isNew: false };
    }

    // 새 사용자 생성
    const newUser = await this.create(userData);
    return { user: newUser, isNew: true };
  },
};
