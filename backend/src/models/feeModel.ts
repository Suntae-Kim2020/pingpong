import pool from '../config/database';
import type { DBRow, DBResult } from '../types';

export const feeModel = {
  async initTables(): Promise<void> {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS fee_policy (
        id INT AUTO_INCREMENT PRIMARY KEY,
        club_id INT NOT NULL UNIQUE,
        amount INT NOT NULL DEFAULT 0,
        bank_name VARCHAR(50),
        account_number VARCHAR(50),
        account_holder VARCHAR(50),
        kakao_pay_link VARCHAR(500),
        description TEXT,
        couple_discount_rate INT NOT NULL DEFAULT 0,
        officer_discount_rate INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (club_id) REFERENCES club(id) ON DELETE CASCADE
      )
    `);

    // 기존 테이블에 감면 비율(%) 컬럼이 없으면 추가 (MySQL 호환 idempotent)
    const ensureColumn = async (column: string) => {
      const [col] = await pool.query<DBRow[]>(
        `SELECT COUNT(*) AS cnt FROM information_schema.columns
         WHERE table_schema = DATABASE() AND table_name = 'fee_policy' AND column_name = ?`,
        [column]
      );
      if ((col[0]?.cnt as number) === 0) {
        await pool.query(`ALTER TABLE fee_policy ADD COLUMN ${column} INT NOT NULL DEFAULT 0`);
      }
    };
    await ensureColumn('couple_discount_rate');
    await ensureColumn('officer_discount_rate');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS fee_record (
        id INT AUTO_INCREMENT PRIMARY KEY,
        club_id INT NOT NULL,
        member_id INT NOT NULL,
        year INT NOT NULL,
        month INT NOT NULL,
        amount INT NOT NULL,
        paid_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        confirmed_by INT,
        memo VARCHAR(200),
        UNIQUE KEY uq_fee (club_id, member_id, year, month),
        FOREIGN KEY (club_id) REFERENCES club(id) ON DELETE CASCADE,
        FOREIGN KEY (member_id) REFERENCES member(id) ON DELETE CASCADE
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS special_fee (
        id INT AUTO_INCREMENT PRIMARY KEY,
        club_id INT NOT NULL,
        name VARCHAR(100) NOT NULL,
        amount INT NOT NULL DEFAULT 0,
        description TEXT,
        due_date DATE,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (club_id) REFERENCES club(id) ON DELETE CASCADE
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS special_fee_record (
        id INT AUTO_INCREMENT PRIMARY KEY,
        special_fee_id INT NOT NULL,
        club_id INT NOT NULL,
        member_id INT NOT NULL,
        amount INT NOT NULL,
        paid_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        confirmed_by INT,
        memo VARCHAR(200),
        UNIQUE KEY uq_special_fee_record (special_fee_id, member_id),
        FOREIGN KEY (special_fee_id) REFERENCES special_fee(id) ON DELETE CASCADE,
        FOREIGN KEY (club_id) REFERENCES club(id) ON DELETE CASCADE,
        FOREIGN KEY (member_id) REFERENCES member(id) ON DELETE CASCADE
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS finance_transaction (
        id INT AUTO_INCREMENT PRIMARY KEY,
        club_id INT NOT NULL,
        type ENUM('income', 'expense') NOT NULL,
        category VARCHAR(50) NOT NULL,
        amount INT NOT NULL,
        description VARCHAR(500),
        transaction_date DATE NOT NULL,
        recorded_by INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (club_id) REFERENCES club(id) ON DELETE CASCADE
      )
    `);

    // 거래내역 엑셀 컬럼 매핑 학습 (양식 지문 기준, 동호회 공통)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS fee_import_mapping (
        id INT AUTO_INCREMENT PRIMARY KEY,
        signature VARCHAR(512) NOT NULL UNIQUE,
        amount_header VARCHAR(150) NOT NULL,
        name_header VARCHAR(150) NOT NULL,
        date_header VARCHAR(150) DEFAULT NULL,
        used_count INT NOT NULL DEFAULT 1,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
  },

  // 거래내역 양식 컬럼 매핑 조회/저장
  async getImportMapping(signature: string) {
    const [rows] = await pool.query<DBRow[]>(
      'SELECT amount_header, name_header, date_header FROM fee_import_mapping WHERE signature = ?',
      [signature]
    );
    return rows.length > 0 ? rows[0] : null;
  },

  async saveImportMapping(signature: string, amountHeader: string, nameHeader: string, dateHeader: string | null) {
    await pool.query(
      `INSERT INTO fee_import_mapping (signature, amount_header, name_header, date_header)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         amount_header = VALUES(amount_header),
         name_header = VALUES(name_header),
         date_header = VALUES(date_header),
         used_count = used_count + 1`,
      [signature, amountHeader, nameHeader, dateHeader || null]
    );
  },

  async getPolicy(clubId: number) {
    const [rows] = await pool.query<DBRow[]>(
      'SELECT * FROM fee_policy WHERE club_id = ?',
      [clubId]
    );
    return rows.length > 0 ? rows[0] : null;
  },

  async upsertPolicy(clubId: number, data: {
    amount: number;
    bank_name?: string | null;
    account_number?: string | null;
    account_holder?: string | null;
    kakao_pay_link?: string | null;
    description?: string | null;
    couple_discount_rate?: number | null;
    officer_discount_rate?: number | null;
  }) {
    const clamp = (v: any) => Math.max(0, Math.min(100, Number(v) || 0));
    const coupleRate = clamp(data.couple_discount_rate);
    const officerRate = clamp(data.officer_discount_rate);
    await pool.query(
      `INSERT INTO fee_policy (club_id, amount, bank_name, account_number, account_holder, kakao_pay_link, description, couple_discount_rate, officer_discount_rate)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         amount = VALUES(amount),
         bank_name = VALUES(bank_name),
         account_number = VALUES(account_number),
         account_holder = VALUES(account_holder),
         kakao_pay_link = VALUES(kakao_pay_link),
         description = VALUES(description),
         couple_discount_rate = VALUES(couple_discount_rate),
         officer_discount_rate = VALUES(officer_discount_rate)`,
      [
        clubId,
        data.amount,
        data.bank_name || null,
        data.account_number || null,
        data.account_holder || null,
        data.kakao_pay_link || null,
        data.description || null,
        coupleRate,
        officerRate,
      ]
    );

    return this.getPolicy(clubId);
  },

  async getRecords(clubId: number, year: number, month: number) {
    const [rows] = await pool.query<DBRow[]>(
      `SELECT fr.*, m.name AS member_name, m.profile_image
       FROM fee_record fr
       JOIN member m ON fr.member_id = m.id
       WHERE fr.club_id = ? AND fr.year = ? AND fr.month = ?
       ORDER BY fr.paid_at DESC`,
      [clubId, year, month]
    );
    return rows;
  },

  async markPaid(
    clubId: number,
    memberId: number,
    year: number,
    month: number,
    amount: number,
    confirmedBy: number,
    memo?: string
  ) {
    const [result] = await pool.query<DBResult>(
      `INSERT INTO fee_record (club_id, member_id, year, month, amount, confirmed_by, memo)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [clubId, memberId, year, month, amount, confirmedBy, memo || null]
    );
    return { id: result.insertId };
  },

  async cancelPayment(id: number, clubId: number) {
    const [result] = await pool.query<DBResult>(
      'DELETE FROM fee_record WHERE id = ? AND club_id = ?',
      [id, clubId]
    );
    return result.affectedRows > 0;
  },

  async getStats(clubId: number, year: number, month: number) {
    // 전체 활성 멤버 수
    const [totalRows] = await pool.query<DBRow[]>(
      'SELECT COUNT(*) AS total FROM member WHERE club_id = ? AND is_active = TRUE',
      [clubId]
    );
    const total = totalRows[0].total as number;

    // 납부 완료 수
    const [paidRows] = await pool.query<DBRow[]>(
      'SELECT COUNT(*) AS paid FROM fee_record WHERE club_id = ? AND year = ? AND month = ?',
      [clubId, year, month]
    );
    const paid = paidRows[0].paid as number;

    return {
      total,
      paid,
      unpaid: total - paid,
      rate: total > 0 ? Math.round((paid / total) * 100) : 0,
    };
  },

  async getAllMembers(clubId: number) {
    const [rows] = await pool.query<DBRow[]>(
      'SELECT id, name, profile_image, spouse_id, role FROM member WHERE club_id = ? AND is_active = TRUE ORDER BY name',
      [clubId]
    );
    return rows;
  },

  // =============================================
  // 각종회비 (Special Fee)
  // =============================================

  async getSpecialFees(clubId: number) {
    const [rows] = await pool.query<DBRow[]>(
      'SELECT * FROM special_fee WHERE club_id = ? ORDER BY is_active DESC, created_at DESC',
      [clubId]
    );
    return rows;
  },

  async createSpecialFee(clubId: number, data: {
    name: string;
    amount: number;
    description?: string | null;
    due_date?: string | null;
  }) {
    const [result] = await pool.query<DBResult>(
      `INSERT INTO special_fee (club_id, name, amount, description, due_date)
       VALUES (?, ?, ?, ?, ?)`,
      [clubId, data.name, data.amount, data.description || null, data.due_date || null]
    );
    return { id: result.insertId };
  },

  async updateSpecialFee(id: number, clubId: number, data: {
    name?: string;
    amount?: number;
    description?: string | null;
    due_date?: string | null;
    is_active?: boolean;
  }) {
    const fields: string[] = [];
    const values: any[] = [];

    if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name); }
    if (data.amount !== undefined) { fields.push('amount = ?'); values.push(data.amount); }
    if (data.description !== undefined) { fields.push('description = ?'); values.push(data.description); }
    if (data.due_date !== undefined) { fields.push('due_date = ?'); values.push(data.due_date); }
    if (data.is_active !== undefined) { fields.push('is_active = ?'); values.push(data.is_active); }

    if (fields.length === 0) return false;

    values.push(id, clubId);
    const [result] = await pool.query<DBResult>(
      `UPDATE special_fee SET ${fields.join(', ')} WHERE id = ? AND club_id = ?`,
      values
    );
    return result.affectedRows > 0;
  },

  async deleteSpecialFee(id: number, clubId: number) {
    const [result] = await pool.query<DBResult>(
      'DELETE FROM special_fee WHERE id = ? AND club_id = ?',
      [id, clubId]
    );
    return result.affectedRows > 0;
  },

  async getSpecialFeeRecords(specialFeeId: number, clubId: number) {
    const [rows] = await pool.query<DBRow[]>(
      `SELECT sfr.*, m.name AS member_name, m.profile_image
       FROM special_fee_record sfr
       JOIN member m ON sfr.member_id = m.id
       WHERE sfr.special_fee_id = ? AND sfr.club_id = ?
       ORDER BY sfr.paid_at DESC`,
      [specialFeeId, clubId]
    );
    return rows;
  },

  async markSpecialFeePaid(data: {
    special_fee_id: number;
    club_id: number;
    member_id: number;
    amount: number;
    confirmed_by: number | null;
    memo?: string;
  }) {
    const [result] = await pool.query<DBResult>(
      `INSERT INTO special_fee_record (special_fee_id, club_id, member_id, amount, confirmed_by, memo)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [data.special_fee_id, data.club_id, data.member_id, data.amount, data.confirmed_by, data.memo || null]
    );
    return { id: result.insertId };
  },

  async cancelSpecialFeePayment(id: number, clubId: number) {
    const [result] = await pool.query<DBResult>(
      'DELETE FROM special_fee_record WHERE id = ? AND club_id = ?',
      [id, clubId]
    );
    return result.affectedRows > 0;
  },

  // =============================================
  // 수입/지출 (Finance Transaction)
  // =============================================

  async getTransactions(clubId: number, year: number, month: number) {
    const [rows] = await pool.query<DBRow[]>(
      `SELECT ft.*, m.name AS recorded_by_name
       FROM finance_transaction ft
       LEFT JOIN member m ON ft.recorded_by = m.id
       WHERE ft.club_id = ? AND YEAR(ft.transaction_date) = ? AND MONTH(ft.transaction_date) = ?
       ORDER BY ft.transaction_date DESC, ft.created_at DESC`,
      [clubId, year, month]
    );
    return rows;
  },

  async createTransaction(clubId: number, data: {
    type: 'income' | 'expense';
    category: string;
    amount: number;
    description?: string | null;
    transaction_date: string;
    recorded_by: number | null;
  }) {
    const [result] = await pool.query<DBResult>(
      `INSERT INTO finance_transaction (club_id, type, category, amount, description, transaction_date, recorded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [clubId, data.type, data.category, data.amount, data.description || null, data.transaction_date, data.recorded_by]
    );
    return { id: result.insertId };
  },

  async deleteTransaction(id: number, clubId: number) {
    const [result] = await pool.query<DBResult>(
      'DELETE FROM finance_transaction WHERE id = ? AND club_id = ?',
      [id, clubId]
    );
    return result.affectedRows > 0;
  },

  // =============================================
  // 이월금 (Carryover)
  // =============================================

  async getCarryoverBalance(clubId: number, year: number, month: number): Promise<number> {
    // 해당 월 1일 이전의 모든 거래 합산 (이월금 포함)
    const firstDay = `${year}-${String(month).padStart(2, '0')}-01`;
    const [rows] = await pool.query<DBRow[]>(
      `SELECT
         COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) -
         COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS balance
       FROM finance_transaction
       WHERE club_id = ? AND transaction_date < ?`,
      [clubId, firstDay]
    );
    return rows[0].balance as number;
  },

  async hasCarryoverRecord(clubId: number, year: number, month: number): Promise<boolean> {
    const [rows] = await pool.query<DBRow[]>(
      `SELECT COUNT(*) AS cnt FROM finance_transaction
       WHERE club_id = ? AND category = '이월금'
         AND YEAR(transaction_date) = ? AND MONTH(transaction_date) = ?`,
      [clubId, year, month]
    );
    return (rows[0].cnt as number) > 0;
  },

  async ensureCarryover(clubId: number, year: number, month: number): Promise<void> {
    const exists = await this.hasCarryoverRecord(clubId, year, month);
    if (exists) return;

    const balance = await this.getCarryoverBalance(clubId, year, month);
    // 잔액이 0이어도 이월금 기록 생성 (계산 완료 표시)
    const firstDay = `${year}-${String(month).padStart(2, '0')}-01`;
    if (balance >= 0) {
      await pool.query(
        `INSERT INTO finance_transaction (club_id, type, category, amount, description, transaction_date)
         VALUES (?, 'income', '이월금', ?, '전월 이월금 (자동)', ?)`,
        [clubId, balance, firstDay]
      );
    } else {
      // 음수 잔액: 지출로 기록
      await pool.query(
        `INSERT INTO finance_transaction (club_id, type, category, amount, description, transaction_date)
         VALUES (?, 'expense', '이월금', ?, '전월 이월 적자 (자동)', ?)`,
        [clubId, Math.abs(balance), firstDay]
      );
    }
  },

  async getAllClubIds(): Promise<number[]> {
    const [rows] = await pool.query<DBRow[]>('SELECT id FROM club');
    return rows.map((r) => r.id as number);
  },

  async getTransactionSummary(clubId: number, year: number, month: number) {
    const [rows] = await pool.query<DBRow[]>(
      `SELECT
         COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) AS total_income,
         COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS total_expense
       FROM finance_transaction
       WHERE club_id = ? AND YEAR(transaction_date) = ? AND MONTH(transaction_date) = ?`,
      [clubId, year, month]
    );
    const row = rows[0];
    const totalIncome = row.total_income as number;
    const totalExpense = row.total_expense as number;
    return {
      total_income: totalIncome,
      total_expense: totalExpense,
      balance: totalIncome - totalExpense,
    };
  },
};
