import pool from '../config/database';
import type { YouTubeVideo, CreateYouTubeVideoRequest, UpdateYouTubeVideoRequest, DBRow, DBResult } from '../types';

export const youtubeModel = {
  async getAll(): Promise<YouTubeVideo[]> {
    const [rows] = await pool.query<DBRow[]>(
      'SELECT * FROM youtube_video ORDER BY display_order ASC, created_at DESC'
    );
    return rows as YouTubeVideo[];
  },

  async getActive(): Promise<YouTubeVideo[]> {
    const [rows] = await pool.query<DBRow[]>(
      'SELECT * FROM youtube_video WHERE is_active = TRUE ORDER BY display_order ASC, created_at DESC'
    );
    return rows as YouTubeVideo[];
  },

  async create(data: CreateYouTubeVideoRequest): Promise<YouTubeVideo> {
    const [result] = await pool.query<DBResult>(
      `INSERT INTO youtube_video (video_type, youtube_url, youtube_id, title, display_order)
       VALUES (?, ?, ?, ?, ?)`,
      [data.video_type, data.youtube_url, data.youtube_id, data.title, data.display_order || 0]
    );
    const [rows] = await pool.query<DBRow[]>('SELECT * FROM youtube_video WHERE id = ?', [result.insertId]);
    return rows[0] as YouTubeVideo;
  },

  async update(id: number, data: UpdateYouTubeVideoRequest): Promise<YouTubeVideo | null> {
    const fields: string[] = [];
    const values: unknown[] = [];

    if (data.title !== undefined) { fields.push('title = ?'); values.push(data.title); }
    if (data.display_order !== undefined) { fields.push('display_order = ?'); values.push(data.display_order); }
    if (data.is_active !== undefined) { fields.push('is_active = ?'); values.push(data.is_active); }

    if (fields.length === 0) return null;

    values.push(id);
    await pool.query(`UPDATE youtube_video SET ${fields.join(', ')} WHERE id = ?`, values);

    const [rows] = await pool.query<DBRow[]>('SELECT * FROM youtube_video WHERE id = ?', [id]);
    return rows.length > 0 ? (rows[0] as YouTubeVideo) : null;
  },

  async delete(id: number): Promise<boolean> {
    const [result] = await pool.query<DBResult>('DELETE FROM youtube_video WHERE id = ?', [id]);
    return result.affectedRows > 0;
  },
};
