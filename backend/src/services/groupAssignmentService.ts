import type { Member, BusuType } from '../types';

export const groupAssignmentService = {
  /**
   * 회원의 부수 가져오기 (오픈부수가 없으면 지역부수 사용)
   */
  getMemberBusu(member: Member, busuType: BusuType): number {
    if (busuType === 'open') {
      return member.open_busu || member.local_busu || 8;
    }
    return member.local_busu || 8;
  },

  /**
   * 스네이크 드래프트 조편성
   * 부수 순으로 정렬 후 지그재그 배치 (1→N, N→1, 1→N...)
   * separateSpouses=true일 때 배우자 같은 조 회피
   */
  snakeDraft(members: Member[], groupCount: number, separateSpouses: boolean = true, busuType: BusuType = 'local'): Map<number, number[]> {
    // 부수 순으로 정렬 (낮은 부수 = 높은 실력)
    const sorted = [...members].sort((a, b) => {
      const busuA = this.getMemberBusu(a, busuType);
      const busuB = this.getMemberBusu(b, busuType);
      if (busuA !== busuB) return busuA - busuB;
      // 같은 부수면 나이순 (고령자 먼저)
      return a.birth_year - b.birth_year;
    });

    const groups = new Map<number, number[]>();
    for (let i = 1; i <= groupCount; i++) {
      groups.set(i, []);
    }

    // 스네이크 드래프트 배치
    let direction = 1; // 1: forward, -1: backward
    let currentGroup = 1;

    for (const member of sorted) {
      let targetGroup = currentGroup;

      // 배우자 같은 조 회피 (separateSpouses가 true일 때만)
      if (separateSpouses) {
        const spouseGroup = this.findSpouseGroup(member, groups);
        if (spouseGroup === targetGroup) {
          // 배우자가 같은 조에 있으면 다른 조 찾기
          targetGroup = this.findAlternativeGroup(currentGroup, spouseGroup, groupCount, direction);
        }
      }

      groups.get(targetGroup)!.push(member.id);

      // 다음 조로 이동
      currentGroup += direction;
      if (currentGroup > groupCount) {
        currentGroup = groupCount;
        direction = -1;
      } else if (currentGroup < 1) {
        currentGroup = 1;
        direction = 1;
      }
    }

    return groups;
  },

  /**
   * 배우자가 속한 조 찾기
   */
  findSpouseGroup(member: Member, groups: Map<number, number[]>): number | null {
    if (!member.spouse_id) return null;

    for (const [groupNum, memberIds] of groups) {
      if (memberIds.includes(member.spouse_id)) {
        return groupNum;
      }
    }
    return null;
  },

  /**
   * 배우자와 다른 조 찾기
   */
  findAlternativeGroup(
    currentGroup: number,
    spouseGroup: number,
    groupCount: number,
    direction: number
  ): number {
    // 현재 방향의 다음 조 시도
    let nextGroup = currentGroup + direction;
    if (nextGroup > groupCount) nextGroup = groupCount - 1;
    if (nextGroup < 1) nextGroup = 2;

    if (nextGroup !== spouseGroup) return nextGroup;

    // 반대 방향 시도
    nextGroup = currentGroup - direction;
    if (nextGroup > groupCount) nextGroup = groupCount;
    if (nextGroup < 1) nextGroup = 1;

    return nextGroup;
  },

  /**
   * 핌플 선수 밸런싱
   * 각 조의 핌플 수 차이가 1 이하가 되도록 스왑
   * 핌플 타입(short/long) 모두 포함
   * separateSpouses=true일 때 배우자 충돌 체크
   */
  balancePimple(groups: Map<number, number[]>, members: Member[], separateSpouses: boolean = true): void {
    const memberMap = new Map(members.map((m) => [m.id, m]));

    // 각 조의 핌플 수 계산 (short 또는 long)
    const getPimpleCount = (groupNum: number) => {
      return groups.get(groupNum)!.filter((id) => {
        const member = memberMap.get(id);
        return member && member.pimple_type !== 'none';
      }).length;
    };

    const groupCount = groups.size;
    let iterations = 0;
    const maxIterations = groupCount * 10; // 무한 루프 방지

    while (iterations < maxIterations) {
      iterations++;

      // 핌플 수가 가장 많은 조와 가장 적은 조 찾기
      let maxGroup = 1,
        minGroup = 1;
      let maxPimple = getPimpleCount(1),
        minPimple = getPimpleCount(1);

      for (let i = 2; i <= groupCount; i++) {
        const count = getPimpleCount(i);
        if (count > maxPimple) {
          maxPimple = count;
          maxGroup = i;
        }
        if (count < minPimple) {
          minPimple = count;
          minGroup = i;
        }
      }

      // 차이가 1 이하면 밸런싱 완료
      if (maxPimple - minPimple <= 1) break;

      // 스왑할 선수 찾기
      const swapped = this.trySwapPimple(groups, memberMap, maxGroup, minGroup, separateSpouses);
      if (!swapped) break; // 스왑 불가능하면 종료
    }
  },

  /**
   * 핌플 선수와 비-핌플 선수 스왑 시도
   */
  trySwapPimple(
    groups: Map<number, number[]>,
    memberMap: Map<number, Member>,
    fromGroup: number,
    toGroup: number,
    separateSpouses: boolean = true
  ): boolean {
    const fromMembers = groups.get(fromGroup)!;
    const toMembers = groups.get(toGroup)!;

    // fromGroup에서 핌플 선수 찾기
    for (const pimpleId of fromMembers) {
      const pimpleMember = memberMap.get(pimpleId);
      if (!pimpleMember || pimpleMember.pimple_type === 'none') continue;

      // toGroup에서 비슷한 부수의 비-핌플 선수 찾기
      for (const nonPimpleId of toMembers) {
        const nonPimpleMember = memberMap.get(nonPimpleId);
        if (!nonPimpleMember || nonPimpleMember.pimple_type !== 'none') continue;

        const pimpleBusu = pimpleMember.local_busu || 8;
        const nonPimpleBusu = nonPimpleMember.local_busu || 8;

        // 부수 차이가 1 이하인 선수와 스왑
        if (Math.abs(pimpleBusu - nonPimpleBusu) <= 1) {
          // 배우자 체크 (separateSpouses가 true일 때만)
          if (separateSpouses) {
            if (this.wouldCreateSpouseConflict(pimpleMember, toGroup, groups, memberMap)) continue;
            if (this.wouldCreateSpouseConflict(nonPimpleMember, fromGroup, groups, memberMap))
              continue;
          }

          // 스왑 실행
          const fromIdx = fromMembers.indexOf(pimpleId);
          const toIdx = toMembers.indexOf(nonPimpleId);
          fromMembers[fromIdx] = nonPimpleId;
          toMembers[toIdx] = pimpleId;

          return true;
        }
      }
    }

    return false;
  },

  /**
   * 스왑 시 배우자 충돌 체크
   */
  wouldCreateSpouseConflict(
    member: Member,
    targetGroup: number,
    groups: Map<number, number[]>,
    _memberMap: Map<number, Member>
  ): boolean {
    if (!member.spouse_id) return false;

    const targetMembers = groups.get(targetGroup)!;
    return targetMembers.includes(member.spouse_id);
  },

  /**
   * 늦은 참가자 자동 배정
   * 부수합이 가장 낮은 조에 배정
   */
  assignLateParticipant(
    groups: Map<number, number[]>,
    newMember: Member,
    memberMap: Map<number, Member>
  ): number {
    let minBusuSum = Infinity;
    let targetGroup = 1;

    for (const [groupNum, memberIds] of groups) {
      const busuSum = memberIds.reduce((sum, id) => sum + (memberMap.get(id)?.local_busu || 8), 0);

      // 배우자가 있는 조 회피
      const hasSpouse = newMember.spouse_id && memberIds.includes(newMember.spouse_id);

      if (!hasSpouse && busuSum < minBusuSum) {
        minBusuSum = busuSum;
        targetGroup = groupNum;
      }
    }

    groups.get(targetGroup)!.push(newMember.id);
    return targetGroup;
  },
};
