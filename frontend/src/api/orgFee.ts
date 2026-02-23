import { api } from './client';
import type { OrgFeePolicy, OrgFeeRecord, OrgSpecialFee, OrgSpecialFeeRecord, OrgFinanceTransaction, TransactionSummary } from '../types';

export const orgFeeApi = {
  getPolicy: (orgId: number) =>
    api.get<OrgFeePolicy | null>(`/orgs/${orgId}/fees/policy`),

  upsertPolicy: (orgId: number, data: {
    amount: number;
    bank_name?: string | null;
    account_number?: string | null;
    account_holder?: string | null;
    kakao_pay_link?: string | null;
    description?: string | null;
  }) =>
    api.put<OrgFeePolicy>(`/orgs/${orgId}/fees/policy`, data),

  getRecords: (orgId: number, year: number, month: number) =>
    api.get<{
      records: OrgFeeRecord[];
      stats: { total: number; paid: number; unpaid: number; rate: number };
      allMembers: { id: number; name: string; nickname: string | null; profile_image: string | null }[];
    }>(`/orgs/${orgId}/fees?year=${year}&month=${month}`),

  markPaid: (orgId: number, data: {
    userId: number;
    year: number;
    month: number;
    amount: number;
    memo?: string;
  }) =>
    api.post<{ id: number }>(`/orgs/${orgId}/fees`, data),

  cancelPayment: (orgId: number, feeId: number) =>
    api.delete<{ success: boolean }>(`/orgs/${orgId}/fees/${feeId}`),

  // 각종회비
  getSpecialFees: (orgId: number) =>
    api.get<OrgSpecialFee[]>(`/orgs/${orgId}/fees/special`),

  createSpecialFee: (orgId: number, data: {
    name: string;
    amount: number;
    description?: string | null;
    due_date?: string | null;
  }) =>
    api.post<{ id: number }>(`/orgs/${orgId}/fees/special`, data),

  updateSpecialFee: (orgId: number, id: number, data: {
    name?: string;
    amount?: number;
    description?: string | null;
    due_date?: string | null;
    is_active?: boolean;
  }) =>
    api.put<{ success: boolean }>(`/orgs/${orgId}/fees/special/${id}`, data),

  deleteSpecialFee: (orgId: number, id: number) =>
    api.delete<{ success: boolean }>(`/orgs/${orgId}/fees/special/${id}`),

  getSpecialFeeRecords: (orgId: number, sfId: number) =>
    api.get<{
      records: OrgSpecialFeeRecord[];
      allMembers: { id: number; name: string; nickname: string | null; profile_image: string | null }[];
    }>(`/orgs/${orgId}/fees/special/${sfId}/records`),

  markSpecialFeePaid: (orgId: number, sfId: number, data: {
    userId: number;
    amount: number;
    memo?: string;
  }) =>
    api.post<{ id: number }>(`/orgs/${orgId}/fees/special/${sfId}/records`, data),

  cancelSpecialFeePayment: (orgId: number, recordId: number) =>
    api.delete<{ success: boolean }>(`/orgs/${orgId}/fees/special/records/${recordId}`),

  // 수입/지출
  getTransactions: (orgId: number, year: number, month: number) =>
    api.get<{
      transactions: OrgFinanceTransaction[];
      summary: TransactionSummary;
    }>(`/orgs/${orgId}/fees/transactions?year=${year}&month=${month}`),

  createTransaction: (orgId: number, data: {
    type: 'income' | 'expense';
    category: string;
    amount: number;
    description?: string | null;
    transaction_date: string;
  }) =>
    api.post<{ id: number }>(`/orgs/${orgId}/fees/transactions`, data),

  deleteTransaction: (orgId: number, id: number) =>
    api.delete<{ success: boolean }>(`/orgs/${orgId}/fees/transactions/${id}`),
};
