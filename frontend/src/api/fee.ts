import { api } from './client';
import type { FeePolicy, FeeRecord, SpecialFee, SpecialFeeRecord, FinanceTransaction, TransactionSummary } from '../types';

export const feeApi = {
  getPolicy: (clubId: number) =>
    api.get<FeePolicy | null>(`/clubs/${clubId}/fees/policy`),

  upsertPolicy: (clubId: number, data: {
    amount: number;
    bank_name?: string | null;
    account_number?: string | null;
    account_holder?: string | null;
    kakao_pay_link?: string | null;
    description?: string | null;
    couple_discount_rate?: number;
  }) =>
    api.put<FeePolicy>(`/clubs/${clubId}/fees/policy`, data),

  getRecords: (clubId: number, year: number, month: number) =>
    api.get<{
      records: FeeRecord[];
      stats: { total: number; paid: number; unpaid: number; rate: number };
      allMembers: { id: number; name: string; profile_image: string | null; spouse_id: number | null }[];
    }>(`/clubs/${clubId}/fees?year=${year}&month=${month}`),

  markPaid: (clubId: number, data: {
    memberId: number;
    year: number;
    month: number;
    amount: number;
    memo?: string;
  }) =>
    api.post<{ id: number }>(`/clubs/${clubId}/fees`, data),

  cancelPayment: (clubId: number, feeId: number) =>
    api.delete<{ success: boolean }>(`/clubs/${clubId}/fees/${feeId}`),

  // 각종회비
  getSpecialFees: (clubId: number) =>
    api.get<SpecialFee[]>(`/clubs/${clubId}/fees/special`),

  createSpecialFee: (clubId: number, data: {
    name: string;
    amount: number;
    description?: string | null;
    due_date?: string | null;
  }) =>
    api.post<{ id: number }>(`/clubs/${clubId}/fees/special`, data),

  updateSpecialFee: (clubId: number, id: number, data: {
    name?: string;
    amount?: number;
    description?: string | null;
    due_date?: string | null;
    is_active?: boolean;
  }) =>
    api.put<{ success: boolean }>(`/clubs/${clubId}/fees/special/${id}`, data),

  deleteSpecialFee: (clubId: number, id: number) =>
    api.delete<{ success: boolean }>(`/clubs/${clubId}/fees/special/${id}`),

  getSpecialFeeRecords: (clubId: number, specialFeeId: number) =>
    api.get<{
      records: SpecialFeeRecord[];
      allMembers: { id: number; name: string; profile_image: string | null }[];
    }>(`/clubs/${clubId}/fees/special/${specialFeeId}/records`),

  markSpecialFeePaid: (clubId: number, specialFeeId: number, data: {
    memberId: number;
    amount: number;
    memo?: string;
  }) =>
    api.post<{ id: number }>(`/clubs/${clubId}/fees/special/${specialFeeId}/records`, data),

  cancelSpecialFeePayment: (clubId: number, recordId: number) =>
    api.delete<{ success: boolean }>(`/clubs/${clubId}/fees/special/records/${recordId}`),

  // 수입/지출
  getTransactions: (clubId: number, year: number, month: number) =>
    api.get<{
      transactions: FinanceTransaction[];
      summary: TransactionSummary;
    }>(`/clubs/${clubId}/fees/transactions?year=${year}&month=${month}`),

  createTransaction: (clubId: number, data: {
    type: 'income' | 'expense';
    category: string;
    amount: number;
    description?: string | null;
    transaction_date: string;
  }) =>
    api.post<{ id: number }>(`/clubs/${clubId}/fees/transactions`, data),

  deleteTransaction: (clubId: number, id: number) =>
    api.delete<{ success: boolean }>(`/clubs/${clubId}/fees/transactions/${id}`),
};
