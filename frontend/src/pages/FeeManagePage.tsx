import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { feeApi } from '../api/fee';
import { clubsApi, ClubMembership } from '../api/clubs';
import type { FeePolicy, FeeRecord, SpecialFee, SpecialFeeRecord, FinanceTransaction, TransactionSummary } from '../types';
import * as XLSX from 'xlsx';

type MainTab = 'monthly' | 'special' | 'transaction';
type SubTab = 'unpaid' | 'paid' | 'all';

function downloadExcel(data: Record<string, unknown>[], fileName: string) {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  XLSX.writeFile(wb, `${fileName}.xlsx`);
}

export default function FeeManagePage() {
  const { clubId } = useParams<{ clubId: string }>();
  const { user } = useAuth();
  const numericClubId = parseInt(clubId || '0');

  const [mainTab, setMainTab] = useState<MainTab>('monthly');
  const [isAdmin, setIsAdmin] = useState(false);
  const [roleChecked, setRoleChecked] = useState(false);

  useEffect(() => {
    if (!user || !numericClubId) return;
    clubsApi.getMyClubs().then((memberships: ClubMembership[]) => {
      const m = memberships.find((ms) => ms.club_id === numericClubId && ms.status === 'approved');
      setIsAdmin(m ? (m.role === 'leader' || m.role === 'admin') : false);
      setRoleChecked(true);
    }).catch(() => { setIsAdmin(false); setRoleChecked(true); });
  }, [user, numericClubId]);

  if (!roleChecked) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>로딩 중...</div>;
  }

  if (roleChecked && !isAdmin) {
    return (
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '60px 16px', textAlign: 'center' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>&#128274;</div>
        <h2 style={{ color: '#333', marginBottom: '8px' }}>접근 권한이 없습니다</h2>
        <p style={{ color: '#888' }}>재무관리는 클럽 리더 또는 관리자만 사용할 수 있습니다.</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '0 16px 40px' }}>
      {/* Header Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #795548, #a1887f)',
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
              background: mainTab === t.key ? '#795548' : '#f5f5f5',
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
        <MonthlyFeeTab clubId={numericClubId} isAdmin={isAdmin} />
      )}
      {mainTab === 'special' && (
        <SpecialFeeTab clubId={numericClubId} isAdmin={isAdmin} />
      )}
      {mainTab === 'transaction' && (
        <TransactionTab clubId={numericClubId} isAdmin={isAdmin} />
      )}
    </div>
  );
}

// =============================================
// 탭1: 월회비 (기존 기능 유지)
// =============================================

type FeeMember = {
  id: number;
  name: string;
  profile_image: string | null;
  spouse_id: number | null;
  role: 'leader' | 'admin' | 'member';
};

function MonthlyFeeTab({ clubId, isAdmin }: { clubId: number; isAdmin: boolean }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [policy, setPolicy] = useState<FeePolicy | null>(null);
  const [records, setRecords] = useState<FeeRecord[]>([]);
  const [stats, setStats] = useState({ total: 0, paid: 0, unpaid: 0, rate: 0 });
  const [allMembers, setAllMembers] = useState<FeeMember[]>([]);
  const [tab, setTab] = useState<SubTab>('unpaid');
  const [showPolicyForm, setShowPolicyForm] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [loading, setLoading] = useState(true);
  const [copyMsg, setCopyMsg] = useState('');

  const [formAmount, setFormAmount] = useState(0);
  const [formBankName, setFormBankName] = useState('');
  const [formAccountNumber, setFormAccountNumber] = useState('');
  const [formAccountHolder, setFormAccountHolder] = useState('');
  const [formKakaoPayLink, setFormKakaoPayLink] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formCoupleRate, setFormCoupleRate] = useState(0);
  const [formOfficerRate, setFormOfficerRate] = useState(0);

  // 회비 감면 계산: 부부 / 임원진(leader·admin) 항목 중 더 높은 비율만 적용
  const memberIdSet = new Set(allMembers.map((m) => m.id));
  const coupleRate = policy?.couple_discount_rate ?? 0;
  const officerRate = policy?.officer_discount_rate ?? 0;
  const isCouple = (m: FeeMember) => !!m.spouse_id && memberIdSet.has(m.spouse_id);
  const isOfficer = (m: FeeMember) => m.role === 'leader' || m.role === 'admin';
  // 적용 감면 (라벨, 비율) — 해당 항목 중 최댓값
  const appliedDiscount = (m: FeeMember): { label: string; rate: number } | null => {
    const candidates: { label: string; rate: number }[] = [];
    if (isCouple(m) && coupleRate > 0) candidates.push({ label: '부부', rate: coupleRate });
    if (isOfficer(m) && officerRate > 0) candidates.push({ label: '임원진', rate: officerRate });
    if (candidates.length === 0) return null;
    return candidates.reduce((a, b) => (b.rate > a.rate ? b : a));
  };
  const feeFor = (m: FeeMember) => {
    if (!policy) return 0;
    const d = appliedDiscount(m);
    return d ? Math.round((policy.amount * (100 - d.rate)) / 100) : policy.amount;
  };

  const fetchData = useCallback(async () => {
    if (!clubId) return;
    setLoading(true);
    try {
      const [policyData, recordsData] = await Promise.all([
        feeApi.getPolicy(clubId),
        feeApi.getRecords(clubId, year, month),
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
  }, [clubId, year, month]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openPolicyForm = () => {
    if (policy) {
      setFormAmount(policy.amount);
      setFormBankName(policy.bank_name || '');
      setFormAccountNumber(policy.account_number || '');
      setFormAccountHolder(policy.account_holder || '');
      setFormKakaoPayLink(policy.kakao_pay_link || '');
      setFormDescription(policy.description || '');
      setFormCoupleRate(policy.couple_discount_rate || 0);
      setFormOfficerRate(policy.officer_discount_rate || 0);
    }
    setShowPolicyForm(true);
  };

  const handleSavePolicy = async () => {
    try {
      const result = await feeApi.upsertPolicy(clubId, {
        amount: formAmount,
        bank_name: formBankName || null,
        account_number: formAccountNumber || null,
        account_holder: formAccountHolder || null,
        kakao_pay_link: formKakaoPayLink || null,
        description: formDescription || null,
        couple_discount_rate: formCoupleRate,
        officer_discount_rate: formOfficerRate,
      });
      setPolicy(result);
      setShowPolicyForm(false);
    } catch (err) {
      alert('저장 실패');
    }
  };

  const handleMarkPaid = async (m: FeeMember) => {
    if (!policy) return;
    try {
      await feeApi.markPaid(clubId, { memberId: m.id, year, month, amount: feeFor(m) });
      fetchData();
    } catch (err: any) {
      alert(err.message || '납부 처리 실패');
    }
  };

  const handleCancel = async (feeId: number) => {
    if (!window.confirm('납부 취소하시겠습니까?')) return;
    try {
      await feeApi.cancelPayment(clubId, feeId);
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

  const paidMemberIds = new Set(records.map((r) => r.member_id));
  const unpaidMembers = allMembers.filter((m) => !paidMemberIds.has(m.id));

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
              {(coupleRate > 0 || officerRate > 0) && (
                <div style={{ fontSize: '12px', color: '#e91e63', marginTop: '4px', fontWeight: '500' }}>
                  {coupleRate > 0 && <span style={{ marginRight: '10px' }}>부부 -{coupleRate}%</span>}
                  {officerRate > 0 && <span>임원진 -{officerRate}%</span>}
                </div>
              )}
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
          padding: '20px', marginBottom: '16px', textAlign: 'center', color: '#795548',
        }}>
          <p style={{ margin: '0 0 8px', fontWeight: '600' }}>회비 정책이 설정되지 않았습니다</p>
          {isAdmin && (
            <button onClick={openPolicyForm} style={{
              background: '#795548', color: 'white', border: 'none',
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
            <div style={{ border: '1px solid #f0d4dd', borderRadius: '8px', padding: '12px', background: '#fdf5f8' }}>
              <label style={{ ...labelStyle, color: '#c2185b', marginBottom: '8px', display: 'block' }}>회비 감면 항목 (%)</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '13px', color: '#555' }}>부부</label>
                  <input type="text" inputMode="numeric" value={formCoupleRate} onFocus={(e) => e.target.select()} onChange={(e) => setFormCoupleRate(Math.max(0, Math.min(100, parseInt(e.target.value.replace(/[^0-9]/g, '')) || 0)))} style={inputStyle} placeholder="예: 20" />
                  {formCoupleRate > 0 && formAmount > 0 && (
                    <div style={{ fontSize: '12px', color: '#e91e63', marginTop: '4px' }}>
                      1인당 {Math.round((formAmount * (100 - formCoupleRate)) / 100).toLocaleString()}원
                    </div>
                  )}
                </div>
                <div>
                  <label style={{ fontSize: '13px', color: '#555' }}>임원진(관리자)</label>
                  <input type="text" inputMode="numeric" value={formOfficerRate} onFocus={(e) => e.target.select()} onChange={(e) => setFormOfficerRate(Math.max(0, Math.min(100, parseInt(e.target.value.replace(/[^0-9]/g, '')) || 0)))} style={inputStyle} placeholder="예: 50" />
                  {formOfficerRate > 0 && formAmount > 0 && (
                    <div style={{ fontSize: '12px', color: '#e91e63', marginTop: '4px' }}>
                      1인당 {Math.round((formAmount * (100 - formOfficerRate)) / 100).toLocaleString()}원
                    </div>
                  )}
                </div>
              </div>
              <div style={{ fontSize: '11px', color: '#999', marginTop: '8px' }}>
                * 부부이면서 임원진이면 더 높은 감면율만 적용됩니다.
              </div>
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

      {/* Excel Download / 거래내역 업로드 */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginBottom: '12px' }}>
        {isAdmin && policy && (
          <button onClick={() => setShowUpload(true)} style={{ ...excelBtnStyle, background: '#5c6bc0' }}>
            거래내역 업로드
          </button>
        )}
        <button
          onClick={() => {
            const rows = allMembers.map((m) => {
              const rec = records.find((r) => r.member_id === m.id);
              return {
                '이름': m.name,
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
              background: tab === t ? '#795548' : '#f5f5f5',
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
            const r = item as FeeRecord & { type: 'paid' };
            return (
              <div key={`paid-${r.id}`} style={rowStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                  {r.profile_image ? (
                    <img src={r.profile_image} alt={r.member_name} style={avatarStyle} />
                  ) : (
                    <div style={avatarPlaceholderStyle}>{r.member_name.charAt(0)}</div>
                  )}
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '500', color: '#333' }}>{r.member_name}</div>
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
            const m = item as FeeMember & { type: 'unpaid' };
            const discount = appliedDiscount(m);
            return (
              <div key={`unpaid-${m.id}`} style={rowStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                  {m.profile_image ? (
                    <img src={m.profile_image} alt={m.name} style={avatarStyle} />
                  ) : (
                    <div style={avatarPlaceholderStyle}>{m.name.charAt(0)}</div>
                  )}
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '500', color: '#333' }}>
                      {m.name}
                      {discount && (
                        <span style={{
                          marginLeft: '6px', fontSize: '11px', color: '#e91e63',
                          background: '#fce4ec', padding: '1px 6px', borderRadius: '8px',
                        }}>{discount.label} -{discount.rate}%</span>
                      )}
                    </div>
                    <div style={{ fontSize: '12px', color: discount ? '#e91e63' : '#999' }}>
                      {policy ? `${feeFor(m).toLocaleString()}원` : '미납'}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={unpaidBadgeStyle}>미납</span>
                  {isAdmin && policy && (
                    <button onClick={() => handleMarkPaid(m)} style={confirmBtnStyle}>납부확인</button>
                  )}
                </div>
              </div>
            );
          }
        })}
      </div>

      {showUpload && policy && (
        <DepositUploadModal
          year={year}
          month={month}
          unpaidMembers={unpaidMembers}
          feeFor={feeFor}
          appliedDiscount={appliedDiscount}
          onClose={() => setShowUpload(false)}
          onConfirm={async (memberIds) => {
            for (const mid of memberIds) {
              const m = unpaidMembers.find((x) => x.id === mid);
              if (!m) continue;
              try {
                await feeApi.markPaid(clubId, { memberId: m.id, year, month, amount: feeFor(m), memo: '거래내역 자동확인' });
              } catch { /* 이미 납부 등은 무시 */ }
            }
            setShowUpload(false);
            fetchData();
          }}
        />
      )}
    </>
  );
}

// =============================================
// 탭2: 각종회비
// =============================================

function SpecialFeeTab({ clubId, isAdmin }: { clubId: number; isAdmin: boolean }) {
  const [fees, setFees] = useState<SpecialFee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingFee, setEditingFee] = useState<SpecialFee | null>(null);
  const [selectedFee, setSelectedFee] = useState<SpecialFee | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formAmount, setFormAmount] = useState(0);
  const [formDescription, setFormDescription] = useState('');
  const [formDueDate, setFormDueDate] = useState('');

  // Records state
  const [records, setRecords] = useState<SpecialFeeRecord[]>([]);
  const [allMembers, setAllMembers] = useState<{ id: number; name: string; profile_image: string | null }[]>([]);
  const [recordTab, setRecordTab] = useState<SubTab>('unpaid');
  const [recordsLoading, setRecordsLoading] = useState(false);

  const fetchFees = useCallback(async () => {
    if (!clubId) return;
    setLoading(true);
    try {
      const data = await feeApi.getSpecialFees(clubId);
      setFees(data);
    } catch (err) {
      console.error('Failed to load special fees:', err);
    } finally {
      setLoading(false);
    }
  }, [clubId]);

  useEffect(() => { fetchFees(); }, [fetchFees]);

  const fetchRecords = useCallback(async (feeId: number) => {
    setRecordsLoading(true);
    try {
      const data = await feeApi.getSpecialFeeRecords(clubId, feeId);
      setRecords(data.records);
      setAllMembers(data.allMembers);
    } catch (err) {
      console.error('Failed to load records:', err);
    } finally {
      setRecordsLoading(false);
    }
  }, [clubId]);

  const openCreateForm = () => {
    setEditingFee(null);
    setFormName('');
    setFormAmount(0);
    setFormDescription('');
    setFormDueDate('');
    setShowForm(true);
  };

  const openEditForm = (fee: SpecialFee) => {
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
        await feeApi.updateSpecialFee(clubId, editingFee.id, {
          name: formName,
          amount: formAmount,
          description: formDescription || null,
          due_date: formDueDate || null,
        });
      } else {
        await feeApi.createSpecialFee(clubId, {
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
      await feeApi.deleteSpecialFee(clubId, id);
      if (selectedFee?.id === id) setSelectedFee(null);
      fetchFees();
    } catch (err) {
      alert('삭제 실패');
    }
  };

  const handleSelectFee = (fee: SpecialFee) => {
    setSelectedFee(fee);
    setRecordTab('unpaid');
    fetchRecords(fee.id);
  };

  const handleMarkPaid = async (memberId: number) => {
    if (!selectedFee) return;
    try {
      await feeApi.markSpecialFeePaid(clubId, selectedFee.id, {
        memberId,
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
      await feeApi.cancelSpecialFeePayment(clubId, recordId);
      if (selectedFee) fetchRecords(selectedFee.id);
    } catch (err) {
      alert('취소 실패');
    }
  };

  const paidMemberIds = new Set(records.map((r) => r.member_id));
  const unpaidMembers = allMembers.filter((m) => !paidMemberIds.has(m.id));

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '60px 20px', color: '#888' }}>불러오는 중...</div>;
  }

  return (
    <>
      {/* Add Button */}
      {isAdmin && !showForm && (
        <button onClick={openCreateForm} style={{
          width: '100%', padding: '12px', background: '#795548', color: 'white',
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
                  <div style={{ fontSize: '18px', fontWeight: '700', color: '#795548' }}>
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
              background: 'none', border: 'none', color: '#795548', cursor: 'pointer',
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
            <div style={{ fontSize: '18px', fontWeight: '700', color: '#795548' }}>
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
                  const rec = records.find((r) => r.member_id === m.id);
                  return {
                    '이름': m.name,
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
                  background: recordTab === t ? '#795548' : '#f5f5f5',
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
              {(recordTab === 'paid' || recordTab === 'all') && records.map((r) => (
                <div key={`paid-${r.id}`} style={rowStyle}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                    {r.profile_image ? (
                      <img src={r.profile_image} alt={r.member_name} style={avatarStyle} />
                    ) : (
                      <div style={avatarPlaceholderStyle}>{r.member_name.charAt(0)}</div>
                    )}
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: '500', color: '#333' }}>{r.member_name}</div>
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
              ))}
              {/* Unpaid members */}
              {(recordTab === 'unpaid' || recordTab === 'all') && unpaidMembers.map((m) => (
                <div key={`unpaid-${m.id}`} style={rowStyle}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                    {m.profile_image ? (
                      <img src={m.profile_image} alt={m.name} style={avatarStyle} />
                    ) : (
                      <div style={avatarPlaceholderStyle}>{m.name.charAt(0)}</div>
                    )}
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: '500', color: '#333' }}>{m.name}</div>
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
              ))}
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

function TransactionTab({ clubId, isAdmin }: { clubId: number; isAdmin: boolean }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [transactions, setTransactions] = useState<FinanceTransaction[]>([]);
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
    if (!clubId) return;
    setLoading(true);
    try {
      const data = await feeApi.getTransactions(clubId, year, month);
      setTransactions(data.transactions);
      setSummary(data.summary);
    } catch (err) {
      console.error('Failed to load transactions:', err);
    } finally {
      setLoading(false);
    }
  }, [clubId, year, month]);

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
      await feeApi.createTransaction(clubId, {
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
      await feeApi.deleteTransaction(clubId, id);
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
          width: '100%', padding: '12px', background: '#795548', color: 'white',
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
              background: filterCategory === c ? '#795548' : '#f5f5f5',
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
// 거래내역 업로드 → 자동 납부확인
// =============================================

const AMOUNT_ALIASES = ['입금액', '입금금액', '맡기신금액', '받은금액', '입금'];
const NAME_ALIASES = ['입금자', '보낸분', '보낸사람', '의뢰인', '내용', '적요', '기재내용', '거래기록사항', '받는분/보내는분'];
const DATE_ALIASES = ['거래일시', '거래일자', '거래일', '일자', '날짜'];
const normName = (s: string) => (s || '').replace(/\s/g, '');

function DepositUploadModal({
  year, month, unpaidMembers, feeFor, appliedDiscount, onClose, onConfirm,
}: {
  year: number;
  month: number;
  unpaidMembers: FeeMember[];
  feeFor: (m: FeeMember) => number;
  appliedDiscount: (m: FeeMember) => { label: string; rate: number } | null;
  onClose: () => void;
  onConfirm: (memberIds: number[]) => void;
}) {
  const [rows, setRows] = useState<string[][]>([]);
  const [fileName, setFileName] = useState('');
  const [headerRowIdx, setHeaderRowIdx] = useState(0);
  const [amountCol, setAmountCol] = useState(-1);
  const [nameCol, setNameCol] = useState(-1);
  const [dateCol, setDateCol] = useState(-1);
  const [step, setStep] = useState<'select' | 'map' | 'preview'>('select');
  const [sel, setSel] = useState<Record<number, number | ''>>({});
  const [error, setError] = useState('');

  const headers = rows[headerRowIdx] || [];

  const handleFile = async (file: File) => {
    try {
      setError('');
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const aoa = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, raw: false, defval: '' });
      const allRows = aoa.map((r) => (r as any[]).map((c) => (c == null ? '' : String(c).trim())));
      if (allRows.length === 0) { setError('빈 파일입니다.'); return; }
      setRows(allRows);
      setFileName(file.name);

      // 헤더 행 탐색 (앞 15행 내에서 입금/입금자 키워드가 있는 행)
      let hIdx = -1;
      for (let i = 0; i < Math.min(allRows.length, 15); i++) {
        const cells = allRows[i].map((c) => c.replace(/\s/g, ''));
        const hasAmount = cells.some((c) => AMOUNT_ALIASES.some((a) => c.includes(a)));
        const hasName = cells.some((c) => NAME_ALIASES.some((a) => c.includes(a)));
        if (hasAmount && hasName) { hIdx = i; break; }
        if (hIdx < 0 && (hasAmount || hasName)) hIdx = i;
      }
      if (hIdx < 0) hIdx = 0;
      const hdr = allRows[hIdx].map((c) => c.replace(/\s/g, ''));
      const findCol = (aliases: string[], exclude: number) => {
        for (let j = 0; j < hdr.length; j++) if (j !== exclude && aliases.some((a) => hdr[j] === a)) return j;
        for (let j = 0; j < hdr.length; j++) if (j !== exclude && aliases.some((a) => hdr[j].includes(a))) return j;
        return -1;
      };
      const nCol = findCol(NAME_ALIASES, -1);
      const aCol = findCol(AMOUNT_ALIASES, nCol);
      const dCol = findCol(DATE_ALIASES, -1);
      setHeaderRowIdx(hIdx);
      setNameCol(nCol);
      setAmountCol(aCol);
      setDateCol(dCol);
      setStep(aCol >= 0 && nCol >= 0 ? 'preview' : 'map');
    } catch {
      setError('파일을 읽을 수 없습니다. 엑셀(.xlsx) 또는 CSV 파일인지 확인해주세요.');
    }
  };

  // 입금 내역 파싱
  const deposits = (amountCol >= 0 && nameCol >= 0)
    ? rows.slice(headerRowIdx + 1).map((r, i) => ({
        idx: i,
        amount: parseInt((r[amountCol] || '').replace(/[^0-9]/g, '')) || 0,
        name: r[nameCol] || '',
        date: dateCol >= 0 ? (r[dateCol] || '') : '',
      })).filter((d) => d.amount > 0)
    : [];

  const candidatesFor = (d: { amount: number; name: string }) =>
    unpaidMembers.filter((m) =>
      normName(m.name).length > 0 &&
      feeFor(m) === d.amount &&
      (normName(d.name).includes(normName(m.name)) || normName(m.name).includes(normName(d.name)))
    );

  const goPreview = () => setStep('preview');

  // 미리보기 진입 또는 열 매핑 변경 시 자동매칭 재계산 (유일 후보면 자동 선택)
  useEffect(() => {
    if (step !== 'preview') return;
    const init: Record<number, number | ''> = {};
    deposits.forEach((d) => {
      const c = candidatesFor(d);
      init[d.idx] = c.length === 1 ? c[0].id : '';
    });
    setSel(init);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, rows, amountCol, nameCol, dateCol, headerRowIdx]);

  const selectedIds = Array.from(new Set(Object.values(sel).filter((v): v is number => typeof v === 'number')));

  const cellStyle: React.CSSProperties = { padding: '6px 8px', fontSize: '13px', borderBottom: '1px solid #eee', textAlign: 'left' };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 2100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }} onClick={onClose}>
      <div style={{ background: 'white', borderRadius: '12px', padding: '20px', maxWidth: '640px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{ margin: 0, fontSize: '17px' }}>거래내역 업로드 — {year}년 {month}월</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#999' }}>&times;</button>
        </div>
        {error && <div style={{ padding: '8px 12px', background: '#fff3f3', color: '#d32f2f', borderRadius: '6px', marginBottom: '12px', fontSize: '13px' }}>{error}</div>}

        {step === 'select' && (
          <div>
            <p style={{ fontSize: '13px', color: '#666', lineHeight: 1.6 }}>
              은행에서 받은 <b>거래내역 엑셀(.xlsx) 또는 CSV</b> 파일을 올려주세요.<br />
              입금 건을 그 달 미납자와 <b>금액(감면 반영) + 입금자명</b>으로 자동 매칭합니다.
            </p>
            <input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              style={{ marginTop: '12px', fontSize: '14px' }} />
          </div>
        )}

        {step === 'map' && (
          <div>
            <p style={{ fontSize: '13px', color: '#666' }}>
              열을 자동 인식하지 못했습니다. <b>{fileName}</b> 의 각 항목이 어느 열인지 지정해주세요.
            </p>
            <div style={{ display: 'grid', gap: '10px', marginTop: '8px' }}>
              <ColMap label="입금액 열 *" headers={headers} value={amountCol} onChange={setAmountCol} />
              <ColMap label="입금자명 열 *" headers={headers} value={nameCol} onChange={setNameCol} />
              <ColMap label="거래일 열 (선택)" headers={headers} value={dateCol} onChange={setDateCol} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
              <button onClick={onClose} style={cancelBtnStyle}>취소</button>
              <button onClick={goPreview} disabled={amountCol < 0 || nameCol < 0} style={{ ...saveBtnStyle, opacity: amountCol < 0 || nameCol < 0 ? 0.5 : 1 }}>다음</button>
            </div>
          </div>
        )}

        {step === 'preview' && (
          <div>
            <div style={{ fontSize: '13px', color: '#666', marginBottom: '10px' }}>
              입금 {deposits.length}건 중 <b style={{ color: '#1976d2' }}>{selectedIds.length}건</b> 매칭됨. 확인 후 일괄 납부확인됩니다.
            </div>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              background: '#f5f7fa', borderRadius: '6px', padding: '8px 10px', marginBottom: '10px', fontSize: '12px', color: '#555',
            }}>
              <span>
                입금액=<b>{headers[amountCol] || '?'}</b> · 입금자=<b>{headers[nameCol] || '?'}</b>
                {dateCol >= 0 && <> · 일자=<b>{headers[dateCol]}</b></>}
              </span>
              <button onClick={() => setStep('map')} style={{
                background: '#fff', border: '1px solid #c5cae9', color: '#3949ab',
                padding: '4px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', whiteSpace: 'nowrap',
              }}>열 매핑 변경</button>
            </div>
            <div style={{ maxHeight: '46vh', overflowY: 'auto', border: '1px solid #eee', borderRadius: '8px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f5f5f5' }}>
                    <th style={cellStyle}>입금자</th>
                    <th style={cellStyle}>금액</th>
                    <th style={cellStyle}>매칭 회원</th>
                  </tr>
                </thead>
                <tbody>
                  {deposits.map((d) => {
                    const cands = candidatesFor(d);
                    return (
                      <tr key={d.idx}>
                        <td style={cellStyle}>{d.name || <span style={{ color: '#bbb' }}>(없음)</span>}<div style={{ fontSize: '11px', color: '#aaa' }}>{d.date}</div></td>
                        <td style={cellStyle}>{d.amount.toLocaleString()}원</td>
                        <td style={cellStyle}>
                          <select value={sel[d.idx] ?? ''} onChange={(e) => setSel({ ...sel, [d.idx]: e.target.value ? parseInt(e.target.value) : '' })}
                            style={{ ...inputStyle, padding: '4px 6px', borderColor: cands.length === 0 ? '#f0c0c0' : '#ddd' }}>
                            <option value="">{cands.length === 0 ? '— 매칭 없음 —' : '— 선택 안함 —'}</option>
                            {unpaidMembers.map((m) => {
                              const disc = appliedDiscount(m);
                              return <option key={m.id} value={m.id}>{m.name} ({feeFor(m).toLocaleString()}원{disc ? ` ·${disc.label}` : ''})</option>;
                            })}
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                  {deposits.length === 0 && (
                    <tr><td colSpan={3} style={{ ...cellStyle, textAlign: 'center', color: '#aaa', padding: '20px' }}>입금 내역을 찾지 못했습니다.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
              <button onClick={onClose} style={cancelBtnStyle}>취소</button>
              <button onClick={() => onConfirm(selectedIds)} disabled={selectedIds.length === 0}
                style={{ ...saveBtnStyle, opacity: selectedIds.length === 0 ? 0.5 : 1 }}>
                {selectedIds.length}건 납부확인
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ColMap({ label, headers, value, onChange }: { label: string; headers: string[]; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <select value={value} onChange={(e) => onChange(parseInt(e.target.value))} style={inputStyle}>
        <option value={-1}>— 선택 —</option>
        {headers.map((h, i) => <option key={i} value={i}>{h || `(열 ${i + 1})`}</option>)}
      </select>
    </div>
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
  background: '#795548', color: 'white', border: 'none',
  padding: '6px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px',
};

const cancelBtnStyle: React.CSSProperties = {
  background: '#e0e0e0', color: '#333', border: 'none',
  padding: '8px 20px', borderRadius: '6px', cursor: 'pointer', fontSize: '14px',
};

const saveBtnStyle: React.CSSProperties = {
  background: '#795548', color: 'white', border: 'none',
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
