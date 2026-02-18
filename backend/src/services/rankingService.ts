import type { Member, MeetingMatch, GroupRanking } from '../types';

interface PlayerStats {
  member_id: number;
  member_name: string;
  birth_year: number;
  wins: number;
  losses: number;
  sets_won: number;
  sets_lost: number;
}

export const rankingService = {
  /**
   * 순위 계산 (타이브레이커 적용)
   * 1. 승수 (많은 순)
   * 2. 동률자 간 상대전적 (승자승)
   * 3. 동률자 간 이긴 세트 수
   * 4. 나이 (고령자 우선)
   */
  calculateRanking(
    members: (Member & { order_in_group: number })[],
    matches: MeetingMatch[],
    advanceRate: number
  ): GroupRanking[] {
    // 경기가 없으면 기본 순위 반환
    if (matches.length === 0) {
      return members.map((member, index) => ({
        rank: index + 1,
        member_id: member.id,
        member_name: member.name,
        wins: 0,
        losses: 0,
        sets_won: 0,
        sets_lost: 0,
        is_advanced: false,
      }));
    }

    // 기본 통계 계산
    const stats = this.calculateStats(members, matches);

    // 승수로 그룹화
    const winGroups = this.groupByWins(stats);

    // 각 그룹 내에서 타이브레이커 적용
    const ranked: PlayerStats[] = [];
    for (const group of winGroups) {
      if (group.length === 1) {
        ranked.push(group[0]);
      } else {
        const tiebroken = this.applyTiebreaker(group, matches);
        ranked.push(...tiebroken);
      }
    }

    // 순위 부여 및 진출자 결정
    const advanceCount = Math.ceil(members.length * advanceRate);
    return ranked.map((player, index) => ({
      rank: index + 1,
      member_id: player.member_id,
      member_name: player.member_name,
      wins: player.wins,
      losses: player.losses,
      sets_won: player.sets_won,
      sets_lost: player.sets_lost,
      is_advanced: index < advanceCount,
    }));
  },

  /**
   * 기본 통계 계산
   */
  calculateStats(
    members: (Member & { order_in_group: number })[],
    matches: MeetingMatch[]
  ): PlayerStats[] {
    const statsMap = new Map<number, PlayerStats>();

    // 초기화
    for (const member of members) {
      statsMap.set(member.id, {
        member_id: member.id,
        member_name: member.name,
        birth_year: member.birth_year,
        wins: 0,
        losses: 0,
        sets_won: 0,
        sets_lost: 0,
      });
    }

    // 경기 결과 집계
    for (const match of matches) {
      const p1Stats = statsMap.get(match.player1_id);
      const p2Stats = statsMap.get(match.player2_id);

      if (p1Stats && p2Stats) {
        p1Stats.sets_won += match.player1_sets;
        p1Stats.sets_lost += match.player2_sets;
        p2Stats.sets_won += match.player2_sets;
        p2Stats.sets_lost += match.player1_sets;

        if (match.player1_sets > match.player2_sets) {
          p1Stats.wins++;
          p2Stats.losses++;
        } else if (match.player2_sets > match.player1_sets) {
          p2Stats.wins++;
          p1Stats.losses++;
        }
      }
    }

    return Array.from(statsMap.values());
  },

  /**
   * 승수로 그룹화 (높은 승수 먼저)
   */
  groupByWins(stats: PlayerStats[]): PlayerStats[][] {
    const groups = new Map<number, PlayerStats[]>();

    for (const player of stats) {
      if (!groups.has(player.wins)) {
        groups.set(player.wins, []);
      }
      groups.get(player.wins)!.push(player);
    }

    // 승수 내림차순 정렬
    return Array.from(groups.entries())
      .sort((a, b) => b[0] - a[0])
      .map(([, players]) => players);
  },

  /**
   * 타이브레이커 적용
   * 1. 상대전적 (승자승)
   * 2. 동률자 간 이긴 세트 수
   * 3. 나이 (고령자 우선)
   */
  applyTiebreaker(tiedPlayers: PlayerStats[], allMatches: MeetingMatch[]): PlayerStats[] {
    if (tiedPlayers.length <= 1) return tiedPlayers;

    const playerIds = new Set(tiedPlayers.map((p) => p.member_id));

    // 동률자 간 상대전적 계산
    const headToHead = this.calculateHeadToHead(tiedPlayers, allMatches, playerIds);

    // 상대전적으로 그룹화
    const h2hGroups = this.groupByHeadToHead(tiedPlayers, headToHead);

    const result: PlayerStats[] = [];
    for (const group of h2hGroups) {
      if (group.length === 1) {
        result.push(group[0]);
      } else {
        // 상대전적도 동률이면 세트 수로 비교
        const setsSorted = this.sortBySetsAndAge(group, allMatches);
        result.push(...setsSorted);
      }
    }

    return result;
  },

  /**
   * 동률자 간 상대전적 계산
   */
  calculateHeadToHead(
    players: PlayerStats[],
    allMatches: MeetingMatch[],
    playerIds: Set<number>
  ): Map<number, { wins: number; losses: number }> {
    const h2h = new Map<number, { wins: number; losses: number }>();

    for (const player of players) {
      h2h.set(player.member_id, { wins: 0, losses: 0 });
    }

    // 동률자 간 경기만 집계
    for (const match of allMatches) {
      if (!playerIds.has(match.player1_id) || !playerIds.has(match.player2_id)) continue;

      const p1h2h = h2h.get(match.player1_id);
      const p2h2h = h2h.get(match.player2_id);

      if (p1h2h && p2h2h) {
        if (match.player1_sets > match.player2_sets) {
          p1h2h.wins++;
          p2h2h.losses++;
        } else if (match.player2_sets > match.player1_sets) {
          p2h2h.wins++;
          p1h2h.losses++;
        }
      }
    }

    return h2h;
  },

  /**
   * 상대전적으로 그룹화
   */
  groupByHeadToHead(
    players: PlayerStats[],
    h2h: Map<number, { wins: number; losses: number }>
  ): PlayerStats[][] {
    // 상대전적 점수 계산 (승 - 패)
    const scored = players.map((p) => {
      const record = h2h.get(p.member_id);
      const score = record ? record.wins - record.losses : 0;
      return { player: p, score };
    });

    // 점수로 그룹화
    const groups = new Map<number, PlayerStats[]>();
    for (const { player, score } of scored) {
      if (!groups.has(score)) {
        groups.set(score, []);
      }
      groups.get(score)!.push(player);
    }

    // 점수 내림차순 정렬
    return Array.from(groups.entries())
      .sort((a, b) => b[0] - a[0])
      .map(([, players]) => players);
  },

  /**
   * 세트 수와 나이로 정렬
   */
  sortBySetsAndAge(
    players: PlayerStats[],
    allMatches: MeetingMatch[]
  ): PlayerStats[] {
    // 현재 그룹의 플레이어 ID 세트
    const currentPlayerIds = new Set(players.map((p) => p.member_id));

    // 동률자 간 세트 수 계산
    const setStats = new Map<number, { won: number; lost: number }>();
    for (const player of players) {
      setStats.set(player.member_id, { won: 0, lost: 0 });
    }

    for (const match of allMatches) {
      // 현재 그룹에 있는 두 플레이어 간의 경기만 집계
      if (!currentPlayerIds.has(match.player1_id) || !currentPlayerIds.has(match.player2_id)) continue;

      const p1Sets = setStats.get(match.player1_id);
      const p2Sets = setStats.get(match.player2_id);

      if (p1Sets && p2Sets) {
        p1Sets.won += match.player1_sets;
        p1Sets.lost += match.player2_sets;
        p2Sets.won += match.player2_sets;
        p2Sets.lost += match.player1_sets;
      }
    }

    return [...players].sort((a, b) => {
      const aStats = setStats.get(a.member_id);
      const bStats = setStats.get(b.member_id);
      const aSetDiff = aStats ? aStats.won - aStats.lost : 0;
      const bSetDiff = bStats ? bStats.won - bStats.lost : 0;

      if (aSetDiff !== bSetDiff) {
        return bSetDiff - aSetDiff; // 세트 득실 내림차순
      }

      // 나이 비교 (고령자 우선 = 낮은 birth_year)
      return a.birth_year - b.birth_year;
    });
  },
};
