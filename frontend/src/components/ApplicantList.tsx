import { useState } from 'react';
import type { Member, ApplicantWithMember, PimpleType } from '../types';

interface ApplicantListProps {
  applicants: ApplicantWithMember[];
  availableMembers: Member[];
  allMembers: Member[];  // 배우자 정보 조회용 전체 회원 목록
  onApply: (memberId: number, isLate: boolean) => void;
  onApplyBulk: (memberIds: number[], isLate: boolean) => void;
  onCancel: (memberId: number) => void;
}

const PIMPLE_BADGES: Record<PimpleType, { label: string; className: string } | null> = {
  none: null,
  short: { label: '숏핌플', className: 'pimple-badge short' },
  long: { label: '롱핌플', className: 'pimple-badge long' },
};

function ApplicantList({ applicants, availableMembers, allMembers, onApply, onApplyBulk, onCancel }: ApplicantListProps) {
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<number>>(new Set());
  const [isLate, setIsLate] = useState(false);

  // 배우자 정보 맵
  const memberMap = new Map(allMembers.map(m => [m.id, m]));

  const getSpouseName = (spouseId: number | null): string | null => {
    if (!spouseId) return null;
    const spouse = memberMap.get(spouseId);
    return spouse ? spouse.name : null;
  };

  const handleCheckboxChange = (memberId: number, checked: boolean) => {
    const newSet = new Set(selectedMemberIds);
    if (checked) {
      newSet.add(memberId);
    } else {
      newSet.delete(memberId);
    }
    setSelectedMemberIds(newSet);
  };

  const handleSelectAll = () => {
    if (selectedMemberIds.size === availableMembers.length) {
      setSelectedMemberIds(new Set());
    } else {
      setSelectedMemberIds(new Set(availableMembers.map(m => m.id)));
    }
  };

  const handleApplySelected = () => {
    if (selectedMemberIds.size === 0) return;

    if (selectedMemberIds.size === 1) {
      const memberId = Array.from(selectedMemberIds)[0];
      onApply(memberId, isLate);
    } else {
      onApplyBulk(Array.from(selectedMemberIds), isLate);
    }
    setSelectedMemberIds(new Set());
    setIsLate(false);
  };

  return (
    <div className="card">
      <h2 className="card-title">참가 신청 ({applicants.length}명)</h2>

      {/* 복수 선택 신청 UI */}
      <div style={{ marginBottom: '20px', padding: '15px', background: '#f9f9f9', borderRadius: '8px' }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '10px' }}>
          <button
            className="btn btn-secondary"
            onClick={handleSelectAll}
            style={{ padding: '6px 12px', fontSize: '13px' }}
          >
            {selectedMemberIds.size === availableMembers.length ? '전체 해제' : '전체 선택'}
          </button>
          <label style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <input
              type="checkbox"
              checked={isLate}
              onChange={(e) => setIsLate(e.target.checked)}
            />
            늦은 참가
          </label>
          <button
            className="btn btn-primary"
            onClick={handleApplySelected}
            disabled={selectedMemberIds.size === 0}
          >
            선택 신청 ({selectedMemberIds.size}명)
          </button>
        </div>

        {/* 미신청 회원 목록 (체크박스로 선택) */}
        <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #ddd', borderRadius: '4px', background: 'white' }}>
          <table className="table" style={{ marginBottom: 0 }}>
            <thead>
              <tr>
                <th style={{ width: '40px' }}>선택</th>
                <th>이름</th>
                <th>지역</th>
                <th>오픈</th>
                <th>성별</th>
                <th>배우자</th>
                <th>핌플</th>
              </tr>
            </thead>
            <tbody>
              {[...availableMembers].sort((a, b) => a.name.localeCompare(b.name, 'ko')).map((member) => {
                const pimpleBadge = PIMPLE_BADGES[member.pimple_type];
                const spouseName = getSpouseName(member.spouse_id);
                // 오픈부수가 없으면 지역부수를 사용
                const effectiveOpenBusu = member.open_busu || member.local_busu;
                return (
                  <tr key={member.id} style={{ cursor: 'pointer' }} onClick={() => handleCheckboxChange(member.id, !selectedMemberIds.has(member.id))}>
                    <td onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedMemberIds.has(member.id)}
                        onChange={(e) => handleCheckboxChange(member.id, e.target.checked)}
                      />
                    </td>
                    <td>{member.name}</td>
                    <td>{member.local_busu || '-'}부</td>
                    <td>{effectiveOpenBusu || '-'}부</td>
                    <td>{member.gender === 'M' ? '남' : '여'}</td>
                    <td>
                      {spouseName && (
                        <span className="badge badge-warning" style={{ fontSize: '11px' }}>
                          {spouseName}
                        </span>
                      )}
                    </td>
                    <td>
                      {pimpleBadge && (
                        <span className={pimpleBadge.className}>{pimpleBadge.label}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {availableMembers.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', color: '#999' }}>
                    모든 회원이 신청했습니다
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 신청자 목록 */}
      <h3 style={{ fontSize: '1rem', marginBottom: '10px' }}>신청자 목록</h3>
      <div style={{ overflowX: 'auto' }}>
        <table className="table">
          <thead>
            <tr>
              <th>이름</th>
              <th>지역부수</th>
              <th>오픈부수</th>
              <th>성별</th>
              <th>배우자</th>
              <th>전형</th>
              <th>핌플</th>
              <th>늦참</th>
              <th>액션</th>
            </tr>
          </thead>
          <tbody>
            {applicants.map((applicant) => {
              const pimpleBadge = PIMPLE_BADGES[applicant.member.pimple_type];
              const spouseName = getSpouseName(applicant.member.spouse_id);
              // 오픈부수가 없으면 지역부수를 사용
              const effectiveOpenBusu = applicant.member.open_busu || applicant.member.local_busu;
              return (
                <tr key={applicant.id}>
                  <td>{applicant.member.name}</td>
                  <td>{applicant.member.local_busu || '-'}부</td>
                  <td>{effectiveOpenBusu || '-'}부</td>
                  <td>{applicant.member.gender === 'M' ? '남' : '여'}</td>
                  <td>
                    {spouseName && (
                      <span className="badge badge-warning" style={{ fontSize: '11px' }}>
                        {spouseName}
                      </span>
                    )}
                  </td>
                  <td style={{ fontSize: '12px' }}>{applicant.member.play_style}</td>
                  <td>
                    {pimpleBadge && (
                      <span className={pimpleBadge.className}>{pimpleBadge.label}</span>
                    )}
                  </td>
                  <td>
                    {applicant.is_late && (
                      <span className="badge badge-warning">늦참</span>
                    )}
                  </td>
                  <td>
                    <button
                      className="btn btn-danger"
                      onClick={() => onCancel(applicant.member_id)}
                      style={{ padding: '4px 8px', fontSize: '12px' }}
                    >
                      취소
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default ApplicantList;
