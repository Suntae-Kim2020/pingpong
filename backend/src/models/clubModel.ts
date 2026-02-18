import pool from '../config/database';
import type {
  ClubExtended,
  ClubSearchResult,
  Region,
  ClubMembership,
  DBRow,
  ClubJoinType,
} from '../types';

export const clubModel = {
  // 클럽 검색 (이름, 지역 기반)
  async search(params: {
    keyword?: string;
    regionId?: number;
    limit?: number;
    offset?: number;
  }): Promise<ClubSearchResult[]> {
    const { keyword, regionId, limit = 20, offset = 0 } = params;

    let query = `
      SELECT
        c.*,
        r.full_name as region_name,
        u.name as leader_name
      FROM club c
      LEFT JOIN region r ON c.region_id = r.id
      LEFT JOIN user u ON c.leader_user_id = u.id
      WHERE c.is_public = TRUE
    `;
    const values: any[] = [];

    if (keyword) {
      query += ` AND c.name LIKE ?`;
      values.push(`%${keyword}%`);
    }

    if (regionId) {
      // 해당 지역 및 하위 지역의 클럽 포함
      query += ` AND (c.region_id = ? OR c.region_id IN (
        SELECT id FROM region WHERE parent_id = ?
      ) OR c.region_id IN (
        SELECT r2.id FROM region r2
        JOIN region r1 ON r2.parent_id = r1.id
        WHERE r1.parent_id = ?
      ))`;
      values.push(regionId, regionId, regionId);
    }

    query += ` ORDER BY c.member_count DESC, c.name ASC LIMIT ? OFFSET ?`;
    values.push(limit, offset);

    const [rows] = await pool.query<DBRow[]>(query, values);
    return rows as ClubSearchResult[];
  },

  // 동일 이름 클럽 검색 (생성 시 경고용)
  async findByNameInRegion(name: string, regionId: number): Promise<ClubSearchResult[]> {
    const [rows] = await pool.query<DBRow[]>(
      `SELECT
        c.*,
        r.full_name as region_name,
        u.name as leader_name
       FROM club c
       LEFT JOIN region r ON c.region_id = r.id
       LEFT JOIN user u ON c.leader_user_id = u.id
       WHERE c.name = ? AND c.region_id = ?`,
      [name, regionId]
    );
    return rows as ClubSearchResult[];
  },

  // 유사 이름 클럽 검색 (생성 시 추천용)
  async findSimilarClubs(name: string, regionId: number): Promise<ClubSearchResult[]> {
    // 지역 정보 가져오기 (상위 지역 포함 검색)
    const [regionRows] = await pool.query<DBRow[]>(
      'SELECT * FROM region WHERE id = ?',
      [regionId]
    );
    const region = regionRows[0] as Region | undefined;

    let regionCondition = 'c.region_id = ?';
    const values: any[] = [`%${name}%`];

    if (region?.parent_id) {
      // 같은 시/도 내의 클럽도 검색
      regionCondition = `(c.region_id = ? OR c.region_id IN (
        SELECT id FROM region WHERE parent_id = ?
      ))`;
      values.push(regionId, region.parent_id);
    } else {
      values.push(regionId);
    }

    const [rows] = await pool.query<DBRow[]>(
      `SELECT
        c.*,
        r.full_name as region_name,
        u.name as leader_name
       FROM club c
       LEFT JOIN region r ON c.region_id = r.id
       LEFT JOIN user u ON c.leader_user_id = u.id
       WHERE c.name LIKE ? AND ${regionCondition}
       LIMIT 5`,
      values
    );
    return rows as ClubSearchResult[];
  },

  // 클럽 상세 조회
  async findById(id: number): Promise<ClubSearchResult | null> {
    const [rows] = await pool.query<DBRow[]>(
      `SELECT
        c.*,
        r.full_name as region_name,
        u.name as leader_name
       FROM club c
       LEFT JOIN region r ON c.region_id = r.id
       LEFT JOIN user u ON c.leader_user_id = u.id
       WHERE c.id = ?`,
      [id]
    );
    return rows.length > 0 ? (rows[0] as ClubSearchResult) : null;
  },

  // 클럽 생성
  async create(data: {
    name: string;
    regionId: number;
    description?: string;
    address?: string;
    leaderUserId: number;
    joinType?: ClubJoinType;
    isPublic?: boolean;
  }): Promise<ClubExtended> {
    const [result] = await pool.query(
      `INSERT INTO club (name, region_id, description, address, leader_user_id, join_type, is_public, member_count)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        data.name,
        data.regionId,
        data.description || null,
        data.address || null,
        data.leaderUserId,
        data.joinType || 'approval',
        data.isPublic ?? true,
      ]
    );
    const insertId = (result as any).insertId;
    return this.findById(insertId) as Promise<ClubExtended>;
  },

  // 클럽 업데이트
  async update(id: number, data: Partial<ClubExtended>): Promise<ClubExtended | null> {
    const fields: string[] = [];
    const values: any[] = [];

    if (data.name !== undefined) {
      fields.push('name = ?');
      values.push(data.name);
    }
    if (data.description !== undefined) {
      fields.push('description = ?');
      values.push(data.description);
    }
    if (data.address !== undefined) {
      fields.push('address = ?');
      values.push(data.address);
    }
    if (data.join_type !== undefined) {
      fields.push('join_type = ?');
      values.push(data.join_type);
    }
    if (data.is_public !== undefined) {
      fields.push('is_public = ?');
      values.push(data.is_public);
    }
    if (data.logo_image !== undefined) {
      fields.push('logo_image = ?');
      values.push(data.logo_image);
    }

    if (fields.length === 0) return this.findById(id);

    values.push(id);
    await pool.query(`UPDATE club SET ${fields.join(', ')} WHERE id = ?`, values);

    return this.findById(id);
  },

  // 회원 수 업데이트
  async updateMemberCount(clubId: number): Promise<void> {
    await pool.query(
      `UPDATE club SET member_count = (
        SELECT COUNT(*) FROM club_membership
        WHERE club_id = ? AND status = 'approved'
      ) WHERE id = ?`,
      [clubId, clubId]
    );
  },
};

export const regionModel = {
  // 모든 지역 조회 (트리 구조용)
  async findAll(): Promise<Region[]> {
    const [rows] = await pool.query<DBRow[]>(
      `SELECT * FROM region ORDER BY level, parent_id, name`
    );
    return rows as Region[];
  },

  // 레벨별 지역 조회
  async findByLevel(level: string): Promise<Region[]> {
    const [rows] = await pool.query<DBRow[]>(
      `SELECT * FROM region WHERE level = ? ORDER BY name`,
      [level]
    );
    return rows as Region[];
  },

  // 하위 지역 조회
  async findChildren(parentId: number): Promise<Region[]> {
    const [rows] = await pool.query<DBRow[]>(
      `SELECT * FROM region WHERE parent_id = ? ORDER BY name`,
      [parentId]
    );
    return rows as Region[];
  },

  // 지역 상세
  async findById(id: number): Promise<Region | null> {
    const [rows] = await pool.query<DBRow[]>(
      `SELECT * FROM region WHERE id = ?`,
      [id]
    );
    return rows.length > 0 ? (rows[0] as Region) : null;
  },
};

export const membershipModel = {
  // 사용자의 클럽 멤버십 조회
  async findByUserId(userId: number): Promise<(ClubMembership & { club_name: string })[]> {
    const [rows] = await pool.query<DBRow[]>(
      `SELECT cm.*, c.name as club_name
       FROM club_membership cm
       JOIN club c ON cm.club_id = c.id
       WHERE cm.user_id = ?
       ORDER BY cm.joined_at DESC`,
      [userId]
    );
    return rows as (ClubMembership & { club_name: string })[];
  },

  // 클럽 가입 신청
  async create(data: {
    clubId: number;
    userId: number;
    displayName?: string;
  }): Promise<ClubMembership> {
    const [result] = await pool.query(
      `INSERT INTO club_membership (club_id, user_id, display_name, status)
       VALUES (?, ?, ?, 'pending')`,
      [data.clubId, data.userId, data.displayName || null]
    );
    const insertId = (result as any).insertId;
    const [rows] = await pool.query<DBRow[]>(
      'SELECT * FROM club_membership WHERE id = ?',
      [insertId]
    );
    return rows[0] as ClubMembership;
  },

  // 클럽 생성자 자동 가입 (leader)
  async createAsLeader(data: {
    clubId: number;
    userId: number;
    displayName?: string;
  }): Promise<ClubMembership> {
    const [result] = await pool.query(
      `INSERT INTO club_membership (club_id, user_id, display_name, role, status, approved_at)
       VALUES (?, ?, ?, 'leader', 'approved', CURRENT_TIMESTAMP)`,
      [data.clubId, data.userId, data.displayName || null]
    );
    const insertId = (result as any).insertId;
    const [rows] = await pool.query<DBRow[]>(
      'SELECT * FROM club_membership WHERE id = ?',
      [insertId]
    );
    return rows[0] as ClubMembership;
  },

  // 멤버십 상태 업데이트
  async updateStatus(
    membershipId: number,
    status: 'approved' | 'rejected' | 'banned',
    approvedBy?: number
  ): Promise<void> {
    if (status === 'approved') {
      await pool.query(
        `UPDATE club_membership
         SET status = ?, approved_at = CURRENT_TIMESTAMP, approved_by = ?
         WHERE id = ?`,
        [status, approvedBy, membershipId]
      );
    } else {
      await pool.query(
        'UPDATE club_membership SET status = ? WHERE id = ?',
        [status, membershipId]
      );
    }
  },

  // 중복 가입 확인
  async exists(clubId: number, userId: number): Promise<boolean> {
    const [rows] = await pool.query<DBRow[]>(
      'SELECT id FROM club_membership WHERE club_id = ? AND user_id = ?',
      [clubId, userId]
    );
    return rows.length > 0;
  },
};
