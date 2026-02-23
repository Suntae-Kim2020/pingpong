import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { orgFeeApi } from '../api/orgFee';
import { orgsApi, OrgMembership } from '../api/orgs';
import type { OrgFeePolicy, OrgFeeRecord, OrgSpecialFee, OrgSpecialFeeRecord, OrgFinanceTransaction, TransactionSummary } from '../types';
import * as XLSX from 'xlsx';

type MainTab = 'monthly' | 'special' | 'transaction';
type SubTab = 'unpaid' | 'paid' | 'all';

interface OrgMember {
  id: number;
  name: string;
  nickname: string | null;
  profile_image: string | null;
}

function displayName(m: OrgMember): string {
  return m.nickname || m.name;
}

function downloadExcel(data: Record<string, unknown>[], fileName: string) {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  XLSX.writeFile(wb, `${fileName}.xlsx`);
}

export default function OrgFeeManagePage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const orgId = parseInt(id || '0');

  const [mainTab, setMainTab] = useState<MainTab>('monthly');
  const [isAdmin, setIsAdmin] = useState(false);
  const [roleChecked, setRoleChecked] = useState(false);

  useEffect(() => {
    if (!user || !orgId) return;
    orgsApi.getMyOrgs().then((memberships: OrgMembership[]) => {
      const m = memberships.find((ms) => ms.org_id === orgId && ms.status === 'approved');
      setIsAdmin(m ? (m.role === 'leader' || m.role === 'admin') : false);
      setRoleChecked(true);
    }).catch(() => { setIsAdmin(false); setRoleChecked(true); });
  }, [user, orgId]);

  if (!roleChecked) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>로딩 중...</div>;
  }

  if (roleChecked && !isAdmin) {
    return (
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '60px 16px', textAlign: 'center' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>&#128274;</div>
        <h2 style={{ color: '#333', marginBottom: '8px' }}>접근 권한이 없습니다</h2>
        <p style={{ color: '#888' }}>재무관리는 단체 리더 또는 관리자만 사용할 수 있습니다.</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '0 16px 40px' }}>
      {/* Header Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #1976d2, #42a5f5)',
        color: 'white',
        padding: '20px 24px',
        borderRadius: '0 0 12px 12px',
        marginBottom: '16px',
      }}>
        <h2 style={{ margin: 0, fontSize: '20px' }}>재무관리</h2>
      </div>

      {/* Main Tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '16px' }}>
        {([
          { key: 'monthly' as MainTab, label: '월회비' },
          { key: 'special' as MainTab, label: '각종회비' },
          { key: 'transaction' as MainTab, label: '수입/지출' },
        ]).map((t) => (
          <button
            key={t.key}
            onClick={() => setMainTab(t.key)}
            style={{
              flex: 1,
              padding: '10px',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: mainTab === t.key ? '700' : '400',
              background: mainTab === t.key ? '#1976d2' : '#f5f5f5',
              color: mainTab === t.key ? 'white' : '#666',
              transition: 'all 0.15s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {mainTab === 'monthly' && (
        <MonthlyFeeTab orgId={orgId} isAdmin={isAdmin} />
      )}
      {mainTab === 'special' && (
        <SpecialFeeTab orgId={orgId} isAdmin={isAdmin} />
      )}
      {mainTab === 'transaction' && (
        <TransactionTab orgId={orgId} isAdmin={isAdmin} />
      )}
    </div>
  );
}

// =============================================
// 탭1: 월회비
// =============================================

function MonthlyFeeTab({ orgId, isAdmin }: { orgId: number; isAdmin: boolean }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [policy, setPolicy] = useState<OrgFeePolicy | null>(null);
  const [records, setRecords] = useState<OrgFeeRecord[]>([]);
  const [stats, setStats] = useState({ total: 0, paid: 0, unpaid: 0, rate: 0 });
  const [allMembers, setAllMembers] = useState<OrgMember[]>([]);
  const [tab, setTab] = useState<SubTab>('unpaid');
  const [showPolicyForm, setShowPolicyForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [copyMsg, setCopyMsg] = useState('');

  const [formAmount, setFormAmount] = useState(0);
  const [formBankName, setFormBankName] = useState('');
  const [formAccountNumber, setFormAccountNumber] = useState('');
  const [formAccountHolder, setFormAccountHolder] = useState('');
  const [formKakaoPayLink, setFormKakaoPayLink] = useState('');
  const [formDescription, setFormDescription] = useState('');

  const fetchData = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const [policyData, recordsData] = await Promise.all([
        orgFeeApi.getPolicy(orgId),
        orgFeeApi.getRecords(orgId, year, month),
      ]);
      setPolicy(policyData);
      setRecords(recordsData.records);
      setStats(recordsData.stats);
      setAllMembers(recordsData.allMembers);
    } catch (err) {
      console.error('Failed to load fee data:', err);
    } finally {
      setLoading(false);
    }
  }, [orgId, year, month]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openPolicyForm = () => {
    if (policy) {
      setFormAmount(policy.amount);
      setFormBankName(policy.bank_name || '');
      setFormAccountNumber(policy.account_number || '');
      setFormAccountHolder(policy.account_holder || '');
      setFormKakaoPayLink(policy.kakao_pay_link || '');
      setFormDescription(policy.description || '');
    }
    setShowPolicyForm(true);
  };

  const handleSavePolicy = async () => {
    try {
      const result = await orgFeeApi.upsertPolicy(orgId, {
        amount: formAmount,
        bank_name: formBankName || null,
        account_number: formAccountNumber || null,
        account_holder: formAccountHolder || null,
        kakao_pay_link: formKakaoPayLink || null,
        description: formDescription || null,
      });
      setPolicy(result);
      setShowPolicyForm(false);
    } catch (err) {
      alert('저장 실패');
    }
  };

  const handleMarkPaid = async (userId: number) => {
    if (!policy) return;
    try {
      await orgFeeApi.markPaid(orgId, { userId, year, month, amount: policy.amount });
      fetchData();
    } catch (err: any) {
      alert(err.message || '납부 처리 실패');
    }
  };

  const handleCancel = async (feeId: number) => {
    if (!window.confirm('납부 취소하시겠습니까?')) return;
    try {
      await orgFeeApi.cancelPayment(orgId, feeId);
      fetchData();
    } catch (err) {
      alert('취소 실패');
    }
  };

  const handleCopyAccount = () => {
    if (!policy) return;
    const text = `${policy.bank_name} ${policy.account_number} ${policy.account_holder}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopyMsg('복사됨!');
      setTimeout(() => setCopyMsg(''), 2000);
    }).catch(() => {
      setCopyMsg('복사 실패');
      setTimeout(() => setCopyMsg(''), 2000);
    });
  };

  const prevMonth = () => {
    if (month === 1) { setYear(year - 1); setMonth(12); }
    else setMonth(month - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setYear(year + 1); setMonth(1); }
    else setMonth(month + 1);
  };

  const paidUserIds = new Set(records.map((r) => r.user_id));
  const unpaidMembers = allMembers.filter((m) => !paidUserIds.has(m.id));

  const filteredList = (() => {
    if (tab === 'paid') return records.map((r) => ({ ...r, type: 'paid' as const }));
    if (tab === 'unpaid') return unpaidMembers.map((m) => ({ ...m, type: 'unpaid' as const }));
    return [
      ...records.map((r) => ({ ...r, type: 'paid' as const })),
      ...unpaidMembers.map((m) => ({ ...m, type: 'unpaid' as const })),
    ];
  })();

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '60px 20px', color: '#888' }}>불러오는 중...</div>;
  }

  return (
    <>
      {/* Payment Info Card */}
      {policy ? (
        <div style={{
          background: 'white', border: '1px solid #e0e0e0', borderRadius: '10px',
          padding: '16px', marginBottom: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ fontSize: '16px', fontWeight: '600', color: '#333' }}>
              월 회비: {policy.amount.toLocaleString()}원
            </div>
            {isAdmin && (
              <button onClick={openPolicyForm} style={adminBtnStyle}>설정</button>
            )}
          </div>
          {policy.description && (
            <div style={{ fontSize: '13px', color: '#666', marginBottom: '12px' }}>{policy.description}</div>
          )}
          {(policy.bank_name || policy.account_number) && (
            <div style={{
              background: '#f5f5f5', borderRadius: '8px', padding: '12px',
              marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div style={{ fontSize: '14px', color: '#333' }}>
                <span style={{ fontWeight: '600' }}>{policy.bank_name}</span>
                {' '}{policy.account_number}
                {policy.account_holder && <span style={{ color: '#888' }}> ({policy.account_holder})</span>}
              </div>
              <button onClick={handleCopyAccount} style={{
                background: '#e0e0e0', border: 'none', padding: '4px 10px',
                borderRadius: '4px', cursor: 'pointer', fontSize: '12px', color: '#555',
              }}>
                {copyMsg || '복사'}
              </button>
            </div>
          )}
          {policy.kakao_pay_link && (
            <a href={policy.kakao_pay_link} target="_blank" rel="noopener noreferrer" style={{
              display: 'inline-block', background: '#FEE500', color: '#3C1E1E',
              padding: '8px 16px', borderRadius: '6px', textDecoration: 'none', fontSize: '14px', fontWeight: '600',
            }}>
              카카오페이 송금
            </a>
          )}
        </div>
      ) : (
        <div style={{
          background: '#fff9c4', border: '1px solid #f9a825', borderRadius: '10px',
          padding: '20px', marginBottom: '16px', textAlign: 'center', color: '#1976d2',
        }}>
          <p style={{ margin: '0 0 8px', fontWeight: '600' }}>회비 정책이 설정되지 않았습니다</p>
          {isAdmin && (
            <button onClick={openPolicyForm} style={{
              background: '#1976d2', color: 'white', border: 'none',
              padding: '8px 20px', borderRadius: '6px', cursor: 'pointer', fontSize: '14px',
            }}>
              회비 설정하기
            </button>
          )}
        </div>
      )}

      {/* Policy Form */}
      {showPolicyForm && (
        <div style={{
          background: 'white', border: '1px solid #e0e0e0', borderRadius: '10px',
          padding: '20px', marginBottom: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '16px', color: '#333' }}>회비 정책 설정</h3>
          <div style={{ display: 'grid', gap: '12px' }}>
            <div>
              <label style={labelStyle}>월 회비 (원) *</label>
              <input type="text" inputMode="numeric" value={formAmount.toLocaleString()} onFocus={(e) => e.target.select()} onChange={(e) => setFormAmount(parseInt(e.target.value.replace(/,/g, '')) || 0)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>은행명</label>
              <input value={formBankName} onChange={(e) => setFormBankName(e.target.value)} style={inputStyle} placeholder="예: 국민은행" />
            </div>
            <div>
              <label style={labelStyle}>계좌번호</label>
              <input value={formAccountNumber} onChange={(e) => setFormAccountNumber(e.target.value)} style={inputStyle} placeholder="예: 123-456-789012" />
            </div>
            <div>
              <label style={labelStyle}>예금주</label>
              <input value={formAccountHolder} onChange={(e) => setFormAccountHolder(e.target.value)} style={inputStyle} placeholder="예: 홍길동" />
            </div>
            <div>
              <label style={labelStyle}>카카오페이 송금 링크</label>
              <input value={formKakaoPayLink} onChange={(e) => setFormKakaoPayLink(e.target.value)} style={inputStyle} placeholder="https://qr.kakaopay.com/..." />
            </div>
            <div>
              <label style={labelStyle}>안내 메시지</label>
              <textarea value={formDescription} onChange={(e) => setFormDescription(e.target.value)} style={{ ...inputStyle, minHeight: '60px', resize: 'vertical' }} placeholder="매월 25일까지 납부 부탁드립니다" />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '16px', justifyContent: 'flex-end' }}>
            <button onClick={() => setShowPolicyForm(false)} style={cancelBtnStyle}>취소</button>
            <button onClick={handleSavePolicy} style={saveBtnStyle}>저장</button>
          </div>
        </div>
      )}

      {/* Month Navigation */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
        <button onClick={prevMonth} style={arrowBtnStyle}>&larr;</button>
        <span style={{ fontSize: '16px', fontWeight: '600', color: '#333' }}>{year}년 {month}월</span>
        <button onClick={nextMonth} style={arrowBtnStyle}>&rarr;</button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '16px' }}>
        <StatBox label="전체" value={`${stats.total}명`} color="#333" />
        <StatBox label="납부" value={`${stats.paid}명`} color="#4caf50" />
        <StatBox label="미납" value={`${stats.unpaid}명`} color="#f44336" />
        <StatBox label="납부율" value={`${stats.rate}%`} color="#1976d2" />
      </div>

      {/* Excel Download */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
        <button
          onClick={() => {
            const rows = allMembers.map((m) => {
              const rec = records.find((r) => r.user_id === m.id);
              return {
                '이름': displayName(m),
                '상태': rec ? '납부완료' : '미납',
                '금액': rec ? rec.amount.toLocaleString() : '',
                '납부일': rec ? new Date(rec.paid_at).toLocaleDateString('ko-KR') : '',
                '메모': rec?.memo || '',
              };
            });
            downloadExcel(rows, `월회비_${year}년${month}월`);
          }}
          style={excelBtnStyle}
        >
          엑셀 다운로드
        </button>
      </div>

      {/* Sub Tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '12px' }}>
        {(['unpaid', 'paid', 'all'] as SubTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1, padding: '8px', border: 'none', borderRadius: '6px',
              cursor: 'pointer', fontSize: '14px',
              fontWeight: tab === t ? '600' : '400',
              background: tab === t ? '#1976d2' : '#f5f5f5',
              color: tab === t ? 'white' : '#666',
              transition: 'all 0.15s',
            }}
          >
            {t === 'unpaid' ? `미납 (${stats.unpaid})` : t === 'paid' ? `납부완료 (${stats.paid})` : `전체 (${stats.total})`}
          </button>
        ))}
      </div>

      {/* Member List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {filteredList.length === 0 && (
          <div style={{ textAlign: 'center', padding: '30px', color: '#aaa', fontSize: '14px' }}>
            {tab === 'unpaid' ? '미납자가 없습니다' : tab === 'paid' ? '납부자가 없습니다' : '데이터가 없습니다'}
          </div>
        )}
        {filteredList.map((item) => {
          if (item.type === 'paid') {
            const r = item as OrgFeeRecord & { type: 'paid' };
            const name = r.user_nickname || r.user_name;
            return (
              <div key={`paid-${r.id}`} style={rowStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                  {r.profile_image ? (
                    <img src={r.profile_image} alt={name} style={avatarStyle} />
                  ) : (
                    <div style={avatarPlaceholderStyle}>{name.charAt(0)}</div>
                  )}
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '500', color: '#333' }}>{name}</div>
                    <div style={{ fontSize: '12px', color: '#888' }}>
                      {r.amount.toLocaleString()}원 | {new Date(r.paid_at).toLocaleDateString('ko-KR')}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={paidBadgeStyle}>납부완료</span>
                  {isAdmin && (
                    <button onClick={() => handleCancel(r.id)} style={cancelActionBtnStyle}>취소</button>
                  )}
                </div>
              </div>
            );
          } else {
            const m = item as OrgMember & { type: 'unpaid' };
            const name = displayName(m);
            return (
              <div key={`unpaid-${m.id}`} style={rowStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                  {m.profile_image ? (
                    <img src={m.profile_image} alt={name} style={avatarStyle} />
                  ) : (
                    <div style={avatarPlaceholderStyle}>{name.charAt(0)}</div>
                  )}
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '500', color: '#333' }}>{name}</div>
                    <div style={{ fontSize: '12px', color: '#ccc' }}>미납</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={unpaidBadgeStyle}>미납</span>
                  {isAdmin && policy && (
                    <button onClick={() => handleMarkPaid(m.id)} style={confirmBtnStyle}>납부확인</button>
                  )}
                </div>
              </div>
            );
          }
        })}
      </div>
    </>
  );
}

// =============================================
// 탭2: 각종회비
// =============================================

function SpecialFeeTab({ orgId, isAdmin }: { orgId: number; isAdmin: boolean }) {
  const [fees, setFees] = useState<OrgSpecialFee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingFee, setEditingFee] = useState<OrgSpecialFee | null>(null);
  const [selectedFee, setSelectedFee] = useState<OrgSpecialFee | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formAmount, setFormAmount] = useState(0);
  const [formDescription, setFormDescription] = useState('');
  const [formDueDate, setFormDueDate] = useState('');

  // Records state
  const [records, setRecords] = useState<OrgSpecialFeeRecord[]>([]);
  const [allMembers, setAllMembers] = useState<OrgMember[]>([]);
  const [recordTab, setRecordTab] = useState<SubTab>('unpaid');
  const [recordsLoading, setRecordsLoading] = useState(false);

  const fetchFees = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const data = await orgFeeApi.getSpecialFees(orgId);
      setFees(data);
    } catch (err) {
      console.error('Failed to load special fees:', err);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => { fetchFees(); }, [fetchFees]);

  const fetchRecords = useCallback(async (feeId: number) => {
    setRecordsLoading(true);
    try {
      const data = await orgFeeApi.getSpecialFeeRecords(orgId, feeId);
      setRecords(data.records);
      setAllMembers(data.allMembers);
    } catch (err) {
      console.error('Failed to load records:', err);
    } finally {
      setRecordsLoading(false);
    }
  }, [orgId]);

  const openCreateForm = () => {
    setEditingFee(null);
    setFormName('');
    setFormAmount(0);
    setFormDescription('');
    setFormDueDate('');
    setShowForm(true);
  };

  const openEditForm = (fee: OrgSpecialFee) => {
    setEditingFee(fee);
    setFormName(fee.name);
    setFormAmount(fee.amount);
    setFormDescription(fee.description || '');
    setFormDueDate(fee.due_date || '');
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formName || formAmount <= 0) {
      alert('이름과 금액을 입력해주세요');
      return;
    }
    try {
      if (editingFee) {
        await orgFeeApi.updateSpecialFee(orgId, editingFee.id, {
          name: formName,
          amount: formAmount,
          description: formDescription || null,
          due_date: formDueDate || null,
        });
      } else {
        await orgFeeApi.createSpecialFee(orgId, {
          name: formName,
          amount: formAmount,
          description: formDescription || null,
          due_date: formDueDate || null,
        });
      }
      setShowForm(false);
      fetchFees();
    } catch (err) {
      alert('저장 실패');
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('이 회비 항목을 삭제하시겠습니까? 관련 납부 기록도 모두 삭제됩니다.')) return;
    try {
      await orgFeeApi.deleteSpecialFee(orgId, id);
      if (selectedFee?.id === id) setSelectedFee(null);
      fetchFees();
    } catch (err) {
      alert('삭제 실패');
    }
  };

  const handleSelectFee = (fee: OrgSpecialFee) => {
    setSelectedFee(fee);
    setRecordTab('unpaid');
    fetchRecords(fee.id);
  };

  const handleMarkPaid = async (userId: number) => {
    if (!selectedFee) return;
    try {
      await orgFeeApi.markSpecialFeePaid(orgId, selectedFee.id, {
        userId,
        amount: selectedFee.amount,
      });
      fetchRecords(selectedFee.id);
    } catch (err: any) {
      alert(err.message || '납부 처리 실패');
    }
  };

  const handleCancelPayment = async (recordId: number) => {
    if (!window.confirm('납부 취소하시겠습니까?')) return;
    try {
      await orgFeeApi.cancelSpecialFeePayment(orgId, recordId);
      if (selectedFee) fetchRecords(selectedFee.id);
    } catch (err) {
      alert('취소 실패');
    }
  };

  const paidUserIds = new Set(records.map((r) => r.user_id));
  const unpaidMembers = allMembers.filter((m) => !paidUserIds.has(m.id));

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '60px 20px', color: '#888' }}>불러오는 중...</div>;
  }

  return (
    <>
      {/* Add Button */}
      {isAdmin && !showForm && (
        <button onClick={openCreateForm} style={{
          width: '100%', padding: '12px', background: '#1976d2', color: 'white',
          border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px',
          fontWeight: '600', marginBottom: '16px',
        }}>
          + 새 회비 항목 추가
        </button>
      )}

      {/* Create/Edit Form */}
      {showForm && (
        <div style={{
          background: 'white', border: '1px solid #e0e0e0', borderRadius: '10px',
          padding: '20px', marginBottom: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '16px', color: '#333' }}>
            {editingFee ? '회비 항목 수정' : '새 회비 항목'}
          </h3>
          <div style={{ display: 'grid', gap: '12px' }}>
            <div>
              <label style={labelStyle}>항목명 *</label>
              <input value={formName} onChange={(e) => setFormName(e.target.value)} style={inputStyle} placeholder="예: 유니폼비, 대회비" />
            </div>
            <div>
              <label style={labelStyle}>금액 (원) *</label>
              <input type="text" inputMode="numeric" value={formAmount.toLocaleString()} onFocus={(e) => e.target.select()} onChange={(e) => setFormAmount(parseInt(e.target.value.replace(/,/g, '')) || 0)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>설명</label>
              <textarea value={formDescription} onChange={(e) => setFormDescription(e.target.value)} style={{ ...inputStyle, minHeight: '50px', resize: 'vertical' }} placeholder="회비에 대한 설명" />
            </div>
            <div>
              <label style={labelStyle}>납부 기한</label>
              <input type="date" value={formDueDate} onChange={(e) => setFormDueDate(e.target.value)} style={inputStyle} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '16px', justifyContent: 'flex-end' }}>
            <button onClick={() => setShowForm(false)} style={cancelBtnStyle}>취소</button>
            <button onClick={handleSave} style={saveBtnStyle}>저장</button>
          </div>
        </div>
      )}

      {/* Fee Items List */}
      {!selectedFee && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {fees.filter(f => f.is_active).length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px', color: '#aaa', fontSize: '14px' }}>
              등록된 회비 항목이 없습니다
            </div>
          )}
          {fees.filter(f => f.is_active).map((fee) => (
            <div
              key={fee.id}
              style={{
                background: 'white', border: '1px solid #e0e0e0', borderRadius: '10px',
                padding: '16px', cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                transition: 'box-shadow 0.15s',
              }}
              onClick={() => handleSelectFee(fee)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '15px', fontWeight: '600', color: '#333', marginBottom: '4px' }}>
                    {fee.name}
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: '700', color: '#1976d2' }}>
                    {fee.amount.toLocaleString()}원
                  </div>
                  {fee.description && (
                    <div style={{ fontSize: '13px', color: '#888', marginTop: '4px' }}>{fee.description}</div>
                  )}
                  {fee.due_date && (
                    <div style={{ fontSize: '12px', color: '#f57c00', marginTop: '4px' }}>
                      납부기한: {new Date(fee.due_date).toLocaleDateString('ko-KR')}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  {isAdmin && (
                    <>
                      <button
                        onClick={(e) => { e.stopPropagation(); openEditForm(fee); }}
                        style={{ ...smallBtnStyle, background: '#e3f2fd', color: '#1976d2' }}
                      >
                        수정
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(fee.id); }}
                        style={{ ...smallBtnStyle, background: '#ffebee', color: '#c62828' }}
                      >
                        삭제
                      </button>
                    </>
                  )}
                  <span style={{ fontSize: '20px', color: '#ccc' }}>&rsaquo;</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Selected Fee Records */}
      {selectedFee && (
        <>
          <button
            onClick={() => setSelectedFee(null)}
            style={{
              background: 'none', border: 'none', color: '#1976d2', cursor: 'pointer',
              fontSize: '14px', padding: '0', marginBottom: '12px', fontWeight: '500',
            }}
          >
            &larr; 목록으로 돌아가기
          </button>

          <div style={{
            background: 'white', border: '1px solid #e0e0e0', borderRadius: '10px',
            padding: '16px', marginBottom: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
          }}>
            <div style={{ fontSize: '16px', fontWeight: '600', color: '#333', marginBottom: '4px' }}>
              {selectedFee.name}
            </div>
            <div style={{ fontSize: '18px', fontWeight: '700', color: '#1976d2' }}>
              {selectedFee.amount.toLocaleString()}원
            </div>
          </div>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '16px' }}>
            <StatBox label="전체" value={`${allMembers.length}명`} color="#333" />
            <StatBox label="납부" value={`${records.length}명`} color="#4caf50" />
            <StatBox label="미납" value={`${unpaidMembers.length}명`} color="#f44336" />
          </div>

          {/* Excel Download */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
            <button
              onClick={() => {
                const rows = allMembers.map((m) => {
                  const rec = records.find((r) => r.user_id === m.id);
                  return {
                    '이름': displayName(m),
                    '항목': selectedFee.name,
                    '금액': selectedFee.amount.toLocaleString(),
                    '상태': rec ? '납부완료' : '미납',
                    '납부일': rec ? new Date(rec.paid_at).toLocaleDateString('ko-KR') : '',
                    '메모': rec?.memo || '',
                  };
                });
                downloadExcel(rows, `각종회비_${selectedFee.name}`);
              }}
              style={excelBtnStyle}
            >
              엑셀 다운로드
            </button>
          </div>

          {/* Sub Tabs */}
          <div style={{ display: 'flex', gap: '4px', marginBottom: '12px' }}>
            {(['unpaid', 'paid', 'all'] as SubTab[]).map((t) => (
              <button
                key={t}
                onClick={() => setRecordTab(t)}
                style={{
                  flex: 1, padding: '8px', border: 'none', borderRadius: '6px',
                  cursor: 'pointer', fontSize: '14px',
                  fontWeight: recordTab === t ? '600' : '400',
                  background: recordTab === t ? '#1976d2' : '#f5f5f5',
                  color: recordTab === t ? 'white' : '#666',
                }}
              >
                {t === 'unpaid' ? `미납 (${unpaidMembers.length})` : t === 'paid' ? `납부완료 (${records.length})` : `전체 (${allMembers.length})`}
              </button>
            ))}
          </div>

          {recordsLoading ? (
            <div style={{ textAlign: 'center', padding: '30px', color: '#888' }}>불러오는 중...</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {/* Paid records */}
              {(recordTab === 'paid' || recordTab === 'all') && records.map((r) => {
                const name = r.user_nickname || r.user_name;
                return (
                  <div key={`paid-${r.id}`} style={rowStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                      {r.profile_image ? (
                        <img src={r.profile_image} alt={name} style={avatarStyle} />
                      ) : (
                        <div style={avatarPlaceholderStyle}>{name.charAt(0)}</div>
                      )}
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: '500', color: '#333' }}>{name}</div>
                        <div style={{ fontSize: '12px', color: '#888' }}>
                          {r.amount.toLocaleString()}원 | {new Date(r.paid_at).toLocaleDateString('ko-KR')}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={paidBadgeStyle}>납부완료</span>
                      {isAdmin && (
                        <button onClick={() => handleCancelPayment(r.id)} style={cancelActionBtnStyle}>취소</button>
                      )}
                    </div>
                  </div>
                );
              })}
              {/* Unpaid members */}
              {(recordTab === 'unpaid' || recordTab === 'all') && unpaidMembers.map((m) => {
                const name = displayName(m);
                return (
                  <div key={`unpaid-${m.id}`} style={rowStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                      {m.profile_image ? (
                        <img src={m.profile_image} alt={name} style={avatarStyle} />
                      ) : (
                        <div style={avatarPlaceholderStyle}>{name.charAt(0)}</div>
                      )}
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: '500', color: '#333' }}>{name}</div>
                        <div style={{ fontSize: '12px', color: '#ccc' }}>미납</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={unpaidBadgeStyle}>미납</span>
                      {isAdmin && (
                        <button onClick={() => handleMarkPaid(m.id)} style={confirmBtnStyle}>납부확인</button>
                      )}
                    </div>
                  </div>
                );
              })}
              {recordTab === 'unpaid' && unpaidMembers.length === 0 && (
                <div style={{ textAlign: 'center', padding: '30px', color: '#aaa', fontSize: '14px' }}>미납자가 없습니다</div>
              )}
              {recordTab === 'paid' && records.length === 0 && (
                <div style={{ textAlign: 'center', padding: '30px', color: '#aaa', fontSize: '14px' }}>납부자가 없습니다</div>
              )}
            </div>
          )}
        </>
      )}
    </>
  );
}

// =============================================
// 탭3: 수입/지출
// =============================================

const TRANSACTION_CATEGORIES = ['이월금', '월회비', '유니폼비', '대회비', '선수등록비', '장비구입', '장소대여', '식비', '교통비', '기타'];

function TransactionTab({ orgId, isAdmin }: { orgId: number; isAdmin: boolean }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [transactions, setTransactions] = useState<OrgFinanceTransaction[]>([]);
  const [summary, setSummary] = useState<TransactionSummary>({ total_income: 0, total_expense: 0, balance: 0 });
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filterCategory, setFilterCategory] = useState('전체');

  // Form state
  const [formType, setFormType] = useState<'income' | 'expense'>('income');
  const [formCategory, setFormCategory] = useState('');
  const [formAmount, setFormAmount] = useState(0);
  const [formDescription, setFormDescription] = useState('');
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);

  const fetchData = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const data = await orgFeeApi.getTransactions(orgId, year, month);
      setTransactions(data.transactions);
      setSummary(data.summary);
    } catch (err) {
      console.error('Failed to load transactions:', err);
    } finally {
      setLoading(false);
    }
  }, [orgId, year, month]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const prevMonth = () => {
    if (month === 1) { setYear(year - 1); setMonth(12); }
    else setMonth(month - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setYear(year + 1); setMonth(1); }
    else setMonth(month + 1);
  };

  const handleCreate = async () => {
    if (!formCategory || formAmount <= 0) {
      alert('카테고리와 금액을 입력해주세요');
      return;
    }
    try {
      await orgFeeApi.createTransaction(orgId, {
        type: formType,
        category: formCategory,
        amount: formAmount,
        description: formDescription || null,
        transaction_date: formDate,
      });
      setShowForm(false);
      setFormCategory('');
      setFormAmount(0);
      setFormDescription('');
      setFormDate(new Date().toISOString().split('T')[0]);
      fetchData();
    } catch (err) {
      alert('저장 실패');
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('이 기록을 삭제하시겠습니까?')) return;
    try {
      await orgFeeApi.deleteTransaction(orgId, id);
      fetchData();
    } catch (err) {
      alert('삭제 실패');
    }
  };

  const filteredTransactions = filterCategory === '전체'
    ? transactions
    : transactions.filter((t) => t.category === filterCategory);

  const usedCategories = ['전체', ...Array.from(new Set(transactions.map((t) => t.category)))];

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '60px 20px', color: '#888' }}>불러오는 중...</div>;
  }

  return (
    <>
      {/* Month Navigation */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
        <button onClick={prevMonth} style={arrowBtnStyle}>&larr;</button>
        <span style={{ fontSize: '16px', fontWeight: '600', color: '#333' }}>{year}년 {month}월</span>
        <button onClick={nextMonth} style={arrowBtnStyle}>&rarr;</button>
      </div>

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '16px' }}>
        <StatBox label="수입" value={`${summary.total_income.toLocaleString()}원`} color="#4caf50" />
        <StatBox label="지출" value={`${summary.total_expense.toLocaleString()}원`} color="#f44336" />
        <StatBox label="잔액" value={`${summary.balance.toLocaleString()}원`} color={summary.balance >= 0 ? '#1976d2' : '#f44336'} />
      </div>

      {/* Add Button */}
      {isAdmin && !showForm && (
        <button onClick={() => setShowForm(true)} style={{
          width: '100%', padding: '12px', background: '#1976d2', color: 'white',
          border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px',
          fontWeight: '600', marginBottom: '16px',
        }}>
          + 기록 추가
        </button>
      )}

      {/* Create Form */}
      {showForm && (
        <div style={{
          background: 'white', border: '1px solid #e0e0e0', borderRadius: '10px',
          padding: '20px', marginBottom: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '16px', color: '#333' }}>거래 기록 추가</h3>
          <div style={{ display: 'grid', gap: '12px' }}>
            {/* Type toggle */}
            <div>
              <label style={labelStyle}>유형 *</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => setFormType('income')}
                  style={{
                    flex: 1, padding: '10px', border: 'none', borderRadius: '6px',
                    cursor: 'pointer', fontSize: '14px', fontWeight: '600',
                    background: formType === 'income' ? '#4caf50' : '#f5f5f5',
                    color: formType === 'income' ? 'white' : '#666',
                  }}
                >
                  수입
                </button>
                <button
                  onClick={() => setFormType('expense')}
                  style={{
                    flex: 1, padding: '10px', border: 'none', borderRadius: '6px',
                    cursor: 'pointer', fontSize: '14px', fontWeight: '600',
                    background: formType === 'expense' ? '#f44336' : '#f5f5f5',
                    color: formType === 'expense' ? 'white' : '#666',
                  }}
                >
                  지출
                </button>
              </div>
            </div>
            <div>
              <label style={labelStyle}>카테고리 *</label>
              <select
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value)}
                style={inputStyle}
              >
                <option value="">선택</option>
                {TRANSACTION_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>금액 (원) *</label>
              <input type="text" inputMode="numeric" value={formAmount.toLocaleString()} onFocus={(e) => e.target.select()} onChange={(e) => setFormAmount(parseInt(e.target.value.replace(/,/g, '')) || 0)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>설명</label>
              <input value={formDescription} onChange={(e) => setFormDescription(e.target.value)} style={inputStyle} placeholder="거래 내용 설명" />
            </div>
            <div>
              <label style={labelStyle}>날짜 *</label>
              <input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} style={inputStyle} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '16px', justifyContent: 'flex-end' }}>
            <button onClick={() => setShowForm(false)} style={cancelBtnStyle}>취소</button>
            <button onClick={handleCreate} style={saveBtnStyle}>저장</button>
          </div>
        </div>
      )}

      {/* Excel Download */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
        <button
          onClick={() => {
            const rows = filteredTransactions.map((t) => ({
              '날짜': new Date(t.transaction_date).toLocaleDateString('ko-KR'),
              '유형': t.type === 'income' ? '수입' : '지출',
              '카테고리': t.category,
              '금액': t.amount.toLocaleString(),
              '설명': t.description || '',
              '기록자': t.recorded_by_name || '',
            }));
            rows.push({
              '날짜': '',
              '유형': '',
              '카테고리': '합계',
              '금액': '',
              '설명': `수입: ${summary.total_income.toLocaleString()}원 / 지출: ${summary.total_expense.toLocaleString()}원 / 잔액: ${summary.balance.toLocaleString()}원`,
              '기록자': '',
            });
            downloadExcel(rows, `수입지출_${year}년${month}월`);
          }}
          style={excelBtnStyle}
        >
          엑셀 다운로드
        </button>
      </div>

      {/* Category Filter */}
      <div style={{
        display: 'flex', gap: '6px', marginBottom: '12px', overflowX: 'auto',
        paddingBottom: '4px',
      }}>
        {usedCategories.map((c) => (
          <button
            key={c}
            onClick={() => setFilterCategory(c)}
            style={{
              padding: '6px 14px', border: 'none', borderRadius: '16px',
              cursor: 'pointer', fontSize: '13px', whiteSpace: 'nowrap',
              fontWeight: filterCategory === c ? '600' : '400',
              background: filterCategory === c ? '#1976d2' : '#f5f5f5',
              color: filterCategory === c ? 'white' : '#666',
            }}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Transactions List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {filteredTransactions.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px', color: '#aaa', fontSize: '14px' }}>
            거래 내역이 없습니다
          </div>
        )}
        {filteredTransactions.map((t) => (
          <div key={t.id} style={rowStyle}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span style={{
                  display: 'inline-block', padding: '2px 8px', borderRadius: '4px',
                  fontSize: '11px', fontWeight: '600',
                  background: t.type === 'income' ? '#e8f5e9' : '#ffebee',
                  color: t.type === 'income' ? '#2e7d32' : '#c62828',
                }}>
                  {t.type === 'income' ? '수입' : '지출'}
                </span>
                <span style={{ fontSize: '12px', color: '#888', background: '#f5f5f5', padding: '2px 8px', borderRadius: '4px' }}>
                  {t.category}
                </span>
              </div>
              <div style={{ fontSize: '16px', fontWeight: '600', color: t.type === 'income' ? '#2e7d32' : '#c62828' }}>
                {t.type === 'income' ? '+' : '-'}{t.amount.toLocaleString()}원
              </div>
              {t.description && (
                <div style={{ fontSize: '13px', color: '#666', marginTop: '2px' }}>{t.description}</div>
              )}
              <div style={{ fontSize: '12px', color: '#aaa', marginTop: '2px' }}>
                {new Date(t.transaction_date).toLocaleDateString('ko-KR')}
                {t.recorded_by_name && ` | ${t.recorded_by_name}`}
              </div>
            </div>
            {isAdmin && !(t.category === '이월금' && t.description?.includes('(자동)')) && (
              <button
                onClick={() => handleDelete(t.id)}
                style={{ ...smallBtnStyle, background: '#ffebee', color: '#c62828' }}
              >
                삭제
              </button>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

// =============================================
// 공통 컴포넌트 & 스타일
// =============================================

function StatBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      background: '#f5f5f5', borderRadius: '8px', padding: '10px', textAlign: 'center',
    }}>
      <div style={{ fontSize: '12px', color: '#888', marginBottom: '2px' }}>{label}</div>
      <div style={{ fontSize: '18px', fontWeight: '700', color }}>{value}</div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '13px', color: '#555', marginBottom: '4px', fontWeight: '500',
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', border: '1px solid #ddd',
  borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box',
};

const arrowBtnStyle: React.CSSProperties = {
  background: '#f5f5f5', border: '1px solid #ddd', borderRadius: '50%',
  width: '32px', height: '32px', cursor: 'pointer', fontSize: '16px',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};

const rowStyle: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  background: 'white', border: '1px solid #eee', borderRadius: '8px', padding: '10px 14px',
};

const avatarStyle: React.CSSProperties = {
  width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover',
};

const avatarPlaceholderStyle: React.CSSProperties = {
  width: '36px', height: '36px', borderRadius: '50%', background: '#e0e0e0',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontSize: '14px', color: '#888', fontWeight: '600',
};

const adminBtnStyle: React.CSSProperties = {
  background: '#1976d2', color: 'white', border: 'none',
  padding: '6px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px',
};

const cancelBtnStyle: React.CSSProperties = {
  background: '#e0e0e0', color: '#333', border: 'none',
  padding: '8px 20px', borderRadius: '6px', cursor: 'pointer', fontSize: '14px',
};

const saveBtnStyle: React.CSSProperties = {
  background: '#1976d2', color: 'white', border: 'none',
  padding: '8px 20px', borderRadius: '6px', cursor: 'pointer', fontSize: '14px',
};

const paidBadgeStyle: React.CSSProperties = {
  background: '#e8f5e9', color: '#2e7d32',
  padding: '3px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: '600',
};

const unpaidBadgeStyle: React.CSSProperties = {
  background: '#ffebee', color: '#c62828',
  padding: '3px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: '600',
};

const cancelActionBtnStyle: React.CSSProperties = {
  background: 'none', border: '1px solid #ef5350', color: '#ef5350',
  padding: '3px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px',
};

const confirmBtnStyle: React.CSSProperties = {
  background: '#4caf50', border: 'none', color: 'white',
  padding: '4px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px',
};

const smallBtnStyle: React.CSSProperties = {
  border: 'none', padding: '4px 10px', borderRadius: '4px',
  cursor: 'pointer', fontSize: '12px', fontWeight: '500',
};

const excelBtnStyle: React.CSSProperties = {
  background: '#2e7d32', color: 'white', border: 'none',
  padding: '6px 16px', borderRadius: '6px', cursor: 'pointer',
  fontSize: '13px', fontWeight: '500',
};
