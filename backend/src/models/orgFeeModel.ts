import pool from '../config/database';
import type { DBRow, DBResult } from '../types';

export const orgFeeModel = {
  async initTables(): Promise<void> {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS org_fee_policy (
        id INT AUTO_INCREMENT PRIMARY KEY,
        org_id INT NOT NULL UNIQUE,
        amount INT NOT NULL DEFAULT 0,
        bank_name VARCHAR(50),
        account_number VARCHAR(50),
        account_holder VARCHAR(50),
        kakao_pay_link VARCHAR(500),
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS org_fee_record (
        id INT AUTO_INCREMENT PRIMARY KEY,
        org_id INT NOT NULL,
        user_id INT NOT NULL,
        year INT NOT NULL,
        month INT NOT NULL,
        amount INT NOT NULL,
        paid_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        confirmed_by INT,
        memo VARCHAR(200),
        UNIQUE KEY uq_org_fee (org_id, user_id, year, month)
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS org_special_fee (
        id INT AUTO_INCREMENT PRIMARY KEY,
        org_id INT NOT NULL,
        name VARCHAR(100) NOT NULL,
        amount INT NOT NULL DEFAULT 0,
        description TEXT,
        due_date DATE,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS org_special_fee_record (
        id INT AUTO_INCREMENT PRIMARY KEY,
        special_fee_id INT NOT NULL,
        org_id INT NOT NULL,
        user_id INT NOT NULL,
        amount INT NOT NULL,
        paid_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        confirmed_by INT,
        memo VARCHAR(200),
        UNIQUE KEY uq_org_special_fee_record (special_fee_id, user_id)
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS org_finance_transaction (
        id INT AUTO_INCREMENT PRIMARY KEY,
        org_id INT NOT NULL,
        type ENUM('income','expense') NOT NULL,
        category VARCHAR(50) NOT NULL,
        amount INT NOT NULL,
        description VARCHAR(500),
        transaction_date DATE NOT NULL,
        recorded_by INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
  },

  // =============================================
  // 월회비 정책
  // =============================================

  async getPolicy(orgId: number) {
    const [rows] = await pool.query<DBRow[]>(
      'SELECT * FROM org_fee_policy WHERE org_id = ?',
      [orgId]
    );
    return rows.length > 0 ? rows[0] : null;
  },

  async upsertPolicy(orgId: number, data: {
    amount: number;
    bank_name?: string | null;
    account_number?: string | null;
    account_holder?: string | null;
    kakao_pay_link?: string | null;
    description?: string | null;
  }) {
    await pool.query(
      `INSERT INTO org_fee_policy (org_id, amount, bank_name, account_number, account_holder, kakao_pay_link, description)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         amount = VALUES(amount),
         bank_name = VALUES(bank_name),
         account_number = VALUES(account_number),
         account_holder = VALUES(account_holder),
         kakao_pay_link = VALUES(kakao_pay_link),
         description = VALUES(description)`,
      [
        orgId,
        data.amount,
        data.bank_name || null,
        data.account_number || null,
        data.account_holder || null,
        data.kakao_pay_link || null,
        data.description || null,
      ]
    );

    return this.getPolicy(orgId);
  },

  // =============================================
  // 월회비 납부 기록
  // =============================================

  async getRecords(orgId: number, year: number, month: number) {
    const [rows] = await pool.query<DBRow[]>(
      `SELECT fr.*, u.name AS user_name, u.nickname AS user_nickname, u.profile_image
       FROM org_fee_record fr
       JOIN user u ON fr.user_id = u.id
       WHERE fr.org_id = ? AND fr.year = ? AND fr.month = ?
       ORDER BY fr.paid_at DESC`,
      [orgId, year, month]
    );
    return rows;
  },

  async markPaid(
    orgId: number,
    userId: number,
    year: number,
    month: number,
    amount: number,
    confirmedBy: number,
    memo?: string
  ) {
    const [result] = await pool.query<DBResult>(
      `INSERT INTO org_fee_record (org_id, user_id, year, month, amount, confirmed_by, memo)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [orgId, userId, year, month, amount, confirmedBy, memo || null]
    );
    return { id: result.insertId };
  },

  async cancelPayment(id: number, orgId: number) {
    const [result] = await pool.query<DBResult>(
      'DELETE FROM org_fee_record WHERE id = ? AND org_id = ?',
      [id, orgId]
    );
    return result.affectedRows > 0;
  },

  async getStats(orgId: number, year: number, month: number) {
    const [totalRows] = await pool.query<DBRow[]>(
      "SELECT COUNT(*) AS total FROM org_membership WHERE org_id = ? AND status = 'approved'",
      [orgId]
    );
    const total = totalRows[0].total as number;

    const [paidRows] = await pool.query<DBRow[]>(
      'SELECT COUNT(*) AS paid FROM org_fee_record WHERE org_id = ? AND year = ? AND month = ?',
      [orgId, year, month]
    );
    const paid = paidRows[0].paid as number;

    return {
      total,
      paid,
      unpaid: total - paid,
      rate: total > 0 ? Math.round((paid / total) * 100) : 0,
    };
  },

  async getAllMembers(orgId: number) {
    const [rows] = await pool.query<DBRow[]>(
      `SELECT om.user_id AS id, u.name, u.nickname, u.profile_image
       FROM org_membership om
       JOIN user u ON om.user_id = u.id
       WHERE om.org_id = ? AND om.status = 'approved'
       ORDER BY u.name`,
      [orgId]
    );
    return rows;
  },

  // =============================================
  // 각종회비 (Special Fee)
  // =============================================

  async getSpecialFees(orgId: number) {
    const [rows] = await pool.query<DBRow[]>(
      'SELECT * FROM org_special_fee WHERE org_id = ? ORDER BY is_active DESC, created_at DESC',
      [orgId]
    );
    return rows;
  },

  async createSpecialFee(orgId: number, data: {
    name: string;
    amount: number;
    description?: string | null;
    due_date?: string | null;
  }) {
    const [result] = await pool.query<DBResult>(
      `INSERT INTO org_special_fee (org_id, name, amount, description, due_date)
       VALUES (?, ?, ?, ?, ?)`,
      [orgId, data.name, data.amount, data.description || null, data.due_date || null]
    );
    return { id: result.insertId };
  },

  async updateSpecialFee(id: number, orgId: number, data: {
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

    values.push(id, orgId);
    const [result] = await pool.query<DBResult>(
      `UPDATE org_special_fee SET ${fields.join(', ')} WHERE id = ? AND org_id = ?`,
      values
    );
    return result.affectedRows > 0;
  },

  async deleteSpecialFee(id: number, orgId: number) {
    const [result] = await pool.query<DBResult>(
      'DELETE FROM org_special_fee WHERE id = ? AND org_id = ?',
      [id, orgId]
    );
    return result.affectedRows > 0;
  },

  async getSpecialFeeRecords(specialFeeId: number, orgId: number) {
    const [rows] = await pool.query<DBRow[]>(
      `SELECT sfr.*, u.name AS user_name, u.nickname AS user_nickname, u.profile_image
       FROM org_special_fee_record sfr
       JOIN user u ON sfr.user_id = u.id
       WHERE sfr.special_fee_id = ? AND sfr.org_id = ?
       ORDER BY sfr.paid_at DESC`,
      [specialFeeId, orgId]
    );
    return rows;
  },

  async markSpecialFeePaid(data: {
    special_fee_id: number;
    org_id: number;
    user_id: number;
    amount: number;
    confirmed_by: number | null;
    memo?: string;
  }) {
    const [result] = await pool.query<DBResult>(
      `INSERT INTO org_special_fee_record (special_fee_id, org_id, user_id, amount, confirmed_by, memo)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [data.special_fee_id, data.org_id, data.user_id, data.amount, data.confirmed_by, data.memo || null]
    );
    return { id: result.insertId };
  },

  async cancelSpecialFeePayment(id: number, orgId: number) {
    const [result] = await pool.query<DBResult>(
      'DELETE FROM org_special_fee_record WHERE id = ? AND org_id = ?',
      [id, orgId]
    );
    return result.affectedRows > 0;
  },

  // =============================================
  // 수입/지출 (Finance Transaction)
  // =============================================

  async getTransactions(orgId: number, year: number, month: number) {
    const [rows] = await pool.query<DBRow[]>(
      `SELECT ft.*, u.name AS recorded_by_name
       FROM org_finance_transaction ft
       LEFT JOIN user u ON ft.recorded_by = u.id
       WHERE ft.org_id = ? AND YEAR(ft.transaction_date) = ? AND MONTH(ft.transaction_date) = ?
       ORDER BY ft.transaction_date DESC, ft.created_at DESC`,
      [orgId, year, month]
    );
    return rows;
  },

  async createTransaction(orgId: number, data: {
    type: 'income' | 'expense';
    category: string;
    amount: number;
    description?: string | null;
    transaction_date: string;
    recorded_by: number | null;
  }) {
    const [result] = await pool.query<DBResult>(
      `INSERT INTO org_finance_transaction (org_id, type, category, amount, description, transaction_date, recorded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [orgId, data.type, data.category, data.amount, data.description || null, data.transaction_date, data.recorded_by]
    );
    return { id: result.insertId };
  },

  async deleteTransaction(id: number, orgId: number) {
    const [result] = await pool.query<DBResult>(
      'DELETE FROM org_finance_transaction WHERE id = ? AND org_id = ?',
      [id, orgId]
    );
    return result.affectedRows > 0;
  },

  // =============================================
  // 이월금 (Carryover)
  // =============================================

  async getCarryoverBalance(orgId: number, year: number, month: number): Promise<number> {
    const firstDay = `${year}-${String(month).padStart(2, '0')}-01`;
    const [rows] = await pool.query<DBRow[]>(
      `SELECT
         COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) -
         COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS balance
       FROM org_finance_transaction
       WHERE org_id = ? AND transaction_date < ?`,
      [orgId, firstDay]
    );
    return rows[0].balance as number;
  },

  async hasCarryoverRecord(orgId: number, year: number, month: number): Promise<boolean> {
    const [rows] = await pool.query<DBRow[]>(
      `SELECT COUNT(*) AS cnt FROM org_finance_transaction
       WHERE org_id = ? AND category = '이월금'
         AND YEAR(transaction_date) = ? AND MONTH(transaction_date) = ?`,
      [orgId, year, month]
    );
    return (rows[0].cnt as number) > 0;
  },

  async ensureCarryover(orgId: number, year: number, month: number): Promise<void> {
    const exists = await this.hasCarryoverRecord(orgId, year, month);
    if (exists) return;

    const balance = await this.getCarryoverBalance(orgId, year, month);
    const firstDay = `${year}-${String(month).padStart(2, '0')}-01`;
    if (balance >= 0) {
      await pool.query(
        `INSERT INTO org_finance_transaction (org_id, type, category, amount, description, transaction_date)
         VALUES (?, 'income', '이월금', ?, '전월 이월금 (자동)', ?)`,
        [orgId, balance, firstDay]
      );
    } else {
      await pool.query(
        `INSERT INTO org_finance_transaction (org_id, type, category, amount, description, transaction_date)
         VALUES (?, 'expense', '이월금', ?, '전월 이월 적자 (자동)', ?)`,
        [orgId, Math.abs(balance), firstDay]
      );
    }
  },

  async getAllOrgIds(): Promise<number[]> {
    const [rows] = await pool.query<DBRow[]>('SELECT id FROM organization');
    return rows.map((r) => r.id as number);
  },

  async getTransactionSummary(orgId: number, year: number, month: number) {
    const [rows] = await pool.query<DBRow[]>(
      `SELECT
         COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) AS total_income,
         COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS total_expense
       FROM org_finance_transaction
       WHERE org_id = ? AND YEAR(transaction_date) = ? AND MONTH(transaction_date) = ?`,
      [orgId, year, month]
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
