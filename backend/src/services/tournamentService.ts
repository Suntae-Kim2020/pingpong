import type { Member, MeetingTournament, TournamentBracket, TournamentMatchDisplay, TournamentDivision } from '../types';

interface AdvancedPlayer {
  memberId: number;
  groupNum: number;
  rank: number;
}

export const tournamentService = {
  /**
   * 토너먼트 대진표 생성
   * - 2의 거듭제곱 브라켓 (8강, 16강 등)
   * - 시드 배치 (1위 vs 꼴찌, 2위 vs 꼴찌-1...)
   * - 같은 조 충돌 회피 (스왑 알고리즘)
   * - 부전승 자동 처리
   * - 상위부/하위부 구분
   */
  createBracket(
    meetingId: number,
    advancedPlayers: AdvancedPlayer[],
    groupCount: number,
    division: TournamentDivision = 'upper'
  ): Omit<MeetingTournament, 'id'>[] {
    const playerCount = advancedPlayers.length;
    if (playerCount < 2) return [];

    // 2의 거듭제곱으로 브라켓 크기 결정
    const bracketSize = this.getNextPowerOf2(playerCount);

    // 시드 순으로 정렬 (조별 순위 기준)
    const seeded = this.seedPlayers(advancedPlayers, groupCount);

    // 초기 대진 생성
    const firstRoundMatches = this.createInitialMatchups(seeded, bracketSize);

    // 같은 조 충돌 회피
    this.avoidSameGroupCollision(firstRoundMatches);

    // 토너먼트 매치 데이터 생성
    const matches: Omit<MeetingTournament, 'id'>[] = [];

    // 1라운드 (가장 큰 라운드)
    const firstRound = bracketSize / 2;
    for (let i = 0; i < firstRound; i++) {
      const match = firstRoundMatches[i];
      const isBye = match.player2 === null;

      matches.push({
        meeting_id: meetingId,
        division,
        round: firstRound,
        match_order: i + 1,
        player1_id: match.player1?.memberId || null,
        player2_id: match.player2?.memberId || null,
        winner_id: isBye ? match.player1?.memberId || null : null,
        player1_from_group: match.player1?.groupNum || null,
        player2_from_group: match.player2?.groupNum || null,
        player1_rank: match.player1?.rank || null,
        player2_rank: match.player2?.rank || null,
        player1_sets: 0,
        player2_sets: 0,
        is_bye: isBye,
      });
    }

    // 이후 라운드 (빈 매치 생성)
    let currentRound = firstRound / 2;
    while (currentRound >= 1) {
      for (let i = 0; i < currentRound; i++) {
        matches.push({
          meeting_id: meetingId,
          division,
          round: currentRound,
          match_order: i + 1,
          player1_id: null,
          player2_id: null,
          winner_id: null,
          player1_from_group: null,
          player2_from_group: null,
          player1_rank: null,
          player2_rank: null,
          player1_sets: 0,
          player2_sets: 0,
          is_bye: false,
        });
      }
      currentRound = currentRound / 2;
    }

    return matches;
  },

  /**
   * 2의 거듭제곱 찾기
   */
  getNextPowerOf2(n: number): number {
    let power = 2;
    while (power < n) {
      power *= 2;
    }
    return power;
  },

  /**
   * 시드 배치
   * 조별 순위를 기준으로 전체 순위 부여
   * 1조 1위, 2조 1위, ... N조 1위, 1조 2위, 2조 2위, ...
   */
  seedPlayers(advancedPlayers: AdvancedPlayer[], groupCount: number): AdvancedPlayer[] {
    // 조별로 그룹화
    const byGroup = new Map<number, AdvancedPlayer[]>();
    for (const player of advancedPlayers) {
      if (!byGroup.has(player.groupNum)) {
        byGroup.set(player.groupNum, []);
      }
      byGroup.get(player.groupNum)!.push(player);
    }

    // 각 조 내에서 순위순 정렬
    for (const players of byGroup.values()) {
      players.sort((a, b) => a.rank - b.rank);
    }

    // 시드 순으로 배치
    const seeded: AdvancedPlayer[] = [];
    const maxRank = Math.max(...advancedPlayers.map((p) => p.rank));

    for (let rank = 1; rank <= maxRank; rank++) {
      for (let group = 1; group <= groupCount; group++) {
        const groupPlayers = byGroup.get(group) || [];
        const player = groupPlayers.find((p) => p.rank === rank);
        if (player) {
          seeded.push(player);
        }
      }
    }

    return seeded;
  },

  /**
   * 표준 토너먼트 브라켓 순서 생성
   * 1위와 2위가 결승에서 만나도록 배치
   * 예: 8명 -> [1,8,4,5,2,7,3,6]
   *     16명 -> [1,16,8,9,4,13,5,12,2,15,7,10,3,14,6,11]
   */
  generateBracketOrder(n: number): number[] {
    if (n === 2) return [1, 2];

    const half = this.generateBracketOrder(n / 2);
    const result: number[] = [];
    for (let i = 0; i < half.length; i++) {
      result.push(half[i]);
      result.push(n + 1 - half[i]);
    }
    return result;
  },

  /**
   * 초기 대진 생성 (표준 시드 매칭)
   * - 1위 vs 최하위 시드
   * - 상위 시드끼리는 결승/준결승에서 만나도록 배치
   * - 예: 1위-4위는 상단 브라켓, 2위-3위는 하단 브라켓
   */
  createInitialMatchups(
    seeded: AdvancedPlayer[],
    bracketSize: number
  ): { player1: AdvancedPlayer | null; player2: AdvancedPlayer | null }[] {
    const matchCount = bracketSize / 2;
    const matches: { player1: AdvancedPlayer | null; player2: AdvancedPlayer | null }[] = [];

    // 부전승 포함하여 슬롯 생성 (시드 순)
    const slots: (AdvancedPlayer | null)[] = [...seeded];
    while (slots.length < bracketSize) {
      slots.push(null);
    }

    // 표준 브라켓 순서 생성
    const bracketOrder = this.generateBracketOrder(bracketSize);

    // 브라켓 순서에 따라 매치 생성
    // bracketOrder의 인접한 두 시드가 한 경기
    for (let i = 0; i < matchCount; i++) {
      const seed1 = bracketOrder[i * 2];      // 1-based seed
      const seed2 = bracketOrder[i * 2 + 1];  // 1-based seed

      matches.push({
        player1: slots[seed1 - 1] || null,  // 0-based index
        player2: slots[seed2 - 1] || null,
      });
    }

    return matches;
  },

  /**
   * 같은 조 충돌 회피
   * 같은 조 선수가 1라운드에서 만나면 스왑
   */
  avoidSameGroupCollision(
    matches: { player1: AdvancedPlayer | null; player2: AdvancedPlayer | null }[]
  ): void {
    const maxIterations = matches.length * 2;
    let iterations = 0;

    while (iterations < maxIterations) {
      iterations++;
      let swapped = false;

      for (let i = 0; i < matches.length; i++) {
        const match = matches[i];
        if (!match.player1 || !match.player2) continue;

        // 같은 조 충돌 체크
        if (match.player1.groupNum === match.player2.groupNum) {
          // 다른 매치와 스왑 시도
          for (let j = i + 1; j < matches.length; j++) {
            const otherMatch = matches[j];
            if (!otherMatch.player2) continue;

            // 스왑해도 충돌이 없는지 확인
            const newI1 = match.player1.groupNum;
            const newI2 = otherMatch.player2.groupNum;
            const newJ1 = otherMatch.player1?.groupNum;
            const newJ2 = match.player2.groupNum;

            if (newI1 !== newI2 && (!newJ1 || newJ1 !== newJ2)) {
              // 스왑 실행
              const temp = match.player2;
              match.player2 = otherMatch.player2;
              otherMatch.player2 = temp;
              swapped = true;
              break;
            }
          }

          if (swapped) break;
        }
      }

      if (!swapped) break;
    }
  },

  /**
   * 대진표 포맷 변환 (API 응답용)
   */
  formatBracket(matches: MeetingTournament[], members: Member[], division: TournamentDivision = 'upper'): TournamentBracket {
    const memberMap = new Map(members.map((m) => [m.id, m]));

    // 해당 division의 매치만 필터링
    const divisionMatches = matches.filter((m) => m.division === division);

    // 라운드별로 그룹화
    const roundMap = new Map<number, TournamentMatchDisplay[]>();

    for (const match of divisionMatches) {
      if (!roundMap.has(match.round)) {
        roundMap.set(match.round, []);
      }

      const p1Name = match.player1_id ? memberMap.get(match.player1_id)?.name || null : null;
      const p2Name = match.player2_id ? memberMap.get(match.player2_id)?.name || null : null;

      roundMap.get(match.round)!.push({
        id: match.id,
        match_order: match.match_order,
        player1: {
          id: match.player1_id,
          name: p1Name,
          from_group: match.player1_from_group,
          rank: match.player1_rank,
        },
        player2: {
          id: match.player2_id,
          name: p2Name,
          from_group: match.player2_from_group,
          rank: match.player2_rank,
        },
        winner_id: match.winner_id,
        player1_sets: match.player1_sets,
        player2_sets: match.player2_sets,
        is_bye: match.is_bye,
      });
    }

    // 라운드 정렬 (큰 라운드부터)
    const rounds = Array.from(roundMap.entries())
      .sort((a, b) => b[0] - a[0])
      .map(([round, matches]) => ({
        round,
        matches: matches.sort((a, b) => a.match_order - b.match_order),
      }));

    return { division, rounds };
  },
};
