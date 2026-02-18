import { useState } from 'react';
import type { GroupWithMembers, PimpleType, BusuType, Member } from '../types';

interface GroupCardProps {
  group: GroupWithMembers;
  allGroups: GroupWithMembers[];
  onReassign?: (memberId: number, newGroup: number) => void;
  busuType?: BusuType;
}

const PIMPLE_BADGES: Record<PimpleType, { label: string; className: string } | null> = {
  none: null,
  short: { label: '숏', className: 'pimple-badge short' },
  long: { label: '롱', className: 'pimple-badge long' },
};

function GroupCard({ group, onReassign, busuType = 'local' }: GroupCardProps) {
  const [draggedMember, setDraggedMember] = useState<number | null>(null);

  const handleDragStart = (memberId: number) => {
    if (onReassign) {
      setDraggedMember(memberId);
    }
  };

  const handleDragEnd = () => {
    setDraggedMember(null);
  };

  const handleDrop = (e: React.DragEvent, targetGroupNum: number) => {
    e.preventDefault();
    if (draggedMember && onReassign && targetGroupNum !== group.group_num) {
      onReassign(draggedMember, targetGroupNum);
    }
    setDraggedMember(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (onReassign) {
      e.preventDefault();
    }
  };

  // 부수 계산 헬퍼
  const getMemberBusu = (m: Member) => {
    if (busuType === 'open') {
      return m.open_busu || m.local_busu || 8;
    }
    return m.local_busu || 8;
  };

  const totalBusu = group.members.reduce((sum, m) => sum + getMemberBusu(m), 0);
  const pimpleCount = group.members.filter((m) => m.pimple_type !== 'none').length;
  const busuLabel = busuType === 'open' ? '오픈' : '지역';

  return (
    <div
      className="group-card"
      style={{ minWidth: '220px', flex: '1 1 220px', maxWidth: '320px' }}
      onDrop={(e) => handleDrop(e, group.group_num)}
      onDragOver={handleDragOver}
    >
      <div className="group-header">
        {group.group_num}조
        <span style={{ float: 'right', fontSize: '12px', fontWeight: 'normal' }}>
          부수합: {totalBusu} | 핌플: {pimpleCount}
        </span>
      </div>
      <div className="group-members">
        {group.members.map((member) => {
          const pimpleBadge = PIMPLE_BADGES[member.pimple_type];
          return (
            <div
              key={member.id}
              className={`member-item ${draggedMember === member.id ? 'dragging' : ''}`}
              draggable={!!onReassign}
              onDragStart={() => handleDragStart(member.id)}
              onDragEnd={handleDragEnd}
            >
              <div>
                <span className="member-name">{member.name}</span>
                {pimpleBadge && (
                  <span className={pimpleBadge.className}>{pimpleBadge.label}</span>
                )}
              </div>
              <span className="member-info">
                {busuLabel}{getMemberBusu(member)}부 / {member.gender === 'M' ? '남' : '여'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default GroupCard;
