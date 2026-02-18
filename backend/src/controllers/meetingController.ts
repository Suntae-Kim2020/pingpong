import { Request, Response, NextFunction } from 'express';
import { meetingModel } from '../models/meetingModel';
import { memberModel } from '../models/memberModel';
import { groupAssignmentService } from '../services/groupAssignmentService';
import { rankingService } from '../services/rankingService';
import { tournamentService } from '../services/tournamentService';
import { AppError } from '../middleware/errorHandler';
import type { MeetingStatus, TournamentDivision, TeamRanking } from '../types';

export const meetingController = {
  // Meeting CRUD
  async getCurrent(req: Request, res: Response, next: NextFunction) {
    try {
      const meeting = await meetingModel.findCurrent();
      res.json(meeting);
    } catch (error) {
      next(error);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id);
      const meeting = await meetingModel.findById(id);
      if (!meeting) {
        throw new AppError('Meeting not found', 404);
      }
      res.json(meeting);
    } catch (error) {
      next(error);
    }
  },

  async getClosed(req: Request, res: Response, next: NextFunction) {
    try {
      const meetings = await meetingModel.findClosed();
      res.json(meetings);
    } catch (error) {
      next(error);
    }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const { year, month, name, start_date, end_date, group_count, advance_rate, has_upper_tournament, has_lower_tournament, separate_spouses, use_detailed_score, match_format, busu_type, match_type, team_size, team_match_format } = req.body;
      const meeting = await meetingModel.create({
        club_id: 1,
        year,
        month,
        name: name || null,
        start_date: start_date || null,
        end_date: end_date || null,
        group_count,
        advance_rate,
        has_upper_tournament: has_upper_tournament ?? true,
        has_lower_tournament: has_lower_tournament ?? false,
        separate_spouses: separate_spouses ?? true,
        use_detailed_score: use_detailed_score ?? false,
        match_format: match_format ?? 'best_of_5',
        busu_type: busu_type ?? 'local',
        match_type: match_type ?? 'individual',
        team_size: team_size ?? 0,
        team_match_format: team_match_format ?? 'dd',
      });
      res.status(201).json(meeting);
    } catch (error) {
      next(error);
    }
  },

  async updateStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id);
      const { status } = req.body as { status: MeetingStatus };
      await meetingModel.updateStatus(id, status);
      const meeting = await meetingModel.findById(id);
      res.json(meeting);
    } catch (error) {
      next(error);
    }
  },

  // 월례회 옵션 수정 (점수 입력 전에만 가능)
  async updateOptions(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id);
      const meeting = await meetingModel.findById(id);

      if (!meeting) {
        throw new AppError('Meeting not found', 404);
      }

      // 점수가 입력되었으면 옵션 변경 불가
      const hasMatches = await meetingModel.hasRecordedMatches(id);
      if (hasMatches) {
        throw new AppError('경기 점수가 이미 입력되어 옵션을 변경할 수 없습니다.', 400);
      }

      const { group_count, advance_rate, separate_spouses, use_detailed_score, match_format, busu_type, has_lower_tournament, match_type, team_size, team_match_format } = req.body;

      // 옵션 업데이트
      await meetingModel.updateOptions(id, {
        group_count,
        advance_rate,
        separate_spouses,
        use_detailed_score,
        match_format,
        busu_type,
        has_lower_tournament,
        match_type,
        team_size,
        team_match_format,
      });

      // 조편성이 된 상태라면 다시 조편성 실행
      const applicants = await meetingModel.getApplicants(id);
      if (applicants.length > 0 && (meeting.status === 'assigning' || meeting.status === 'assigned')) {
        const updatedMeeting = await meetingModel.findById(id);
        if (updatedMeeting) {
          const members = applicants.map((a) => a.member);

          // 단체전 모드: 팀 수 자동 계산, 배우자 회피 비활성화
          let groupCount = updatedMeeting.group_count;
          let separateSpouses = updatedMeeting.separate_spouses;
          if (updatedMeeting.match_type === 'team' && updatedMeeting.team_size > 0) {
            groupCount = Math.max(2, Math.ceil(members.length / updatedMeeting.team_size));
            separateSpouses = false;
            await meetingModel.updateOptions(id, { group_count: groupCount });
          }

          const groups = groupAssignmentService.snakeDraft(
            members,
            groupCount,
            separateSpouses,
            updatedMeeting.busu_type
          );
          groupAssignmentService.balancePimple(groups, members, separateSpouses);
          await meetingModel.saveGroups(id, groups);
        }
      }

      const updatedMeeting = await meetingModel.findById(id);
      res.json(updatedMeeting);
    } catch (error) {
      next(error);
    }
  },

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id);
      const meeting = await meetingModel.findById(id);
      if (!meeting) {
        throw new AppError('Meeting not found', 404);
      }
      await meetingModel.delete(id);
      res.json({ success: true, message: `Meeting ${id} deleted` });
    } catch (error) {
      next(error);
    }
  },

  // Applicants
  async getApplicants(req: Request, res: Response, next: NextFunction) {
    try {
      const meetingId = parseInt(req.params.id);
      const applicants = await meetingModel.getApplicants(meetingId);
      res.json(applicants);
    } catch (error) {
      next(error);
    }
  },

  async apply(req: Request, res: Response, next: NextFunction) {
    try {
      const meetingId = parseInt(req.params.id);
      const { member_id, is_late } = req.body;

      // 신청자 추가
      await meetingModel.addApplicant(meetingId, member_id, is_late || false);

      // 늦참자 자동 배정: 조편성이 완료된 상태에서 늦참 신청 시
      let assignedGroup: number | null = null;
      if (is_late) {
        const meeting = await meetingModel.findById(meetingId);
        const groupsAssignedStatuses: MeetingStatus[] = ['assigned', 'recording', 'tournament'];

        if (meeting && groupsAssignedStatuses.includes(meeting.status)) {
          assignedGroup = await this.assignLateParticipantToGroup(meetingId, member_id, meeting.separate_spouses);
        }
      }

      res.status(201).json({ success: true, assigned_group: assignedGroup });
    } catch (error) {
      next(error);
    }
  },

  // 복수 회원 일괄 신청
  async applyBulk(req: Request, res: Response, next: NextFunction) {
    try {
      const meetingId = parseInt(req.params.id);
      const { member_ids, is_late } = req.body;
      if (!Array.isArray(member_ids) || member_ids.length === 0) {
        throw new AppError('member_ids must be a non-empty array', 400);
      }

      // 신청자들 추가
      await meetingModel.addApplicants(meetingId, member_ids, is_late || false);

      // 늦참자 자동 배정
      const assignedGroups: { member_id: number; group: number }[] = [];
      if (is_late) {
        const meeting = await meetingModel.findById(meetingId);
        const groupsAssignedStatuses: MeetingStatus[] = ['assigned', 'recording', 'tournament'];

        if (meeting && groupsAssignedStatuses.includes(meeting.status)) {
          for (const memberId of member_ids) {
            const group = await this.assignLateParticipantToGroup(meetingId, memberId, meeting.separate_spouses);
            if (group) {
              assignedGroups.push({ member_id: memberId, group });
            }
          }
        }
      }

      res.status(201).json({ success: true, count: member_ids.length, assigned_groups: assignedGroups });
    } catch (error) {
      next(error);
    }
  },

  // 늦참자를 조에 자동 배정하는 헬퍼 함수
  async assignLateParticipantToGroup(
    meetingId: number,
    memberId: number,
    separateSpouses: boolean
  ): Promise<number | null> {
    try {
      // 현재 조편성 정보 가져오기
      const groups = await meetingModel.getGroups(meetingId);
      if (groups.length === 0) return null;

      // 신규 회원 정보 가져오기
      const newMember = await memberModel.findById(memberId);
      if (!newMember) return null;

      // 모든 조원 ID 수집
      const allMemberIds = groups.flatMap(g => g.members.map(m => m.id));
      allMemberIds.push(memberId);

      // 모든 회원 정보 가져오기
      const allMembers = await memberModel.findByIds(allMemberIds);
      const memberMap = new Map(allMembers.map(m => [m.id, m]));

      // 현재 조를 Map으로 변환
      const groupsMap = new Map<number, number[]>();
      for (const group of groups) {
        groupsMap.set(group.group_num, group.members.map(m => m.id));
      }

      // 부수합이 가장 낮은 조에 배정 (배우자 회피)
      let minBusuSum = Infinity;
      let targetGroup = 1;

      for (const [groupNum, memberIds] of groupsMap) {
        const busuSum = memberIds.reduce((sum, id) => sum + (memberMap.get(id)?.local_busu || 8), 0);

        // 배우자가 있는 조 회피 (separateSpouses가 true일 때)
        const hasSpouse = separateSpouses && newMember.spouse_id && memberIds.includes(newMember.spouse_id);

        if (!hasSpouse && busuSum < minBusuSum) {
          minBusuSum = busuSum;
          targetGroup = groupNum;
        }
      }

      // DB에 조 배정 저장
      await meetingModel.reassignMember(meetingId, memberId, targetGroup);

      return targetGroup;
    } catch (error) {
      console.error('Failed to assign late participant:', error);
      return null;
    }
  },

  async cancelApply(req: Request, res: Response, next: NextFunction) {
    try {
      const meetingId = parseInt(req.params.id);
      const memberId = parseInt(req.params.memberId);
      await meetingModel.removeApplicant(meetingId, memberId);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  },

  // Groups
  async getGroups(req: Request, res: Response, next: NextFunction) {
    try {
      const meetingId = parseInt(req.params.id);
      const groups = await meetingModel.getGroups(meetingId);
      res.json(groups);
    } catch (error) {
      next(error);
    }
  },

  async assignGroups(req: Request, res: Response, next: NextFunction) {
    try {
      const meetingId = parseInt(req.params.id);
      const meeting = await meetingModel.findById(meetingId);
      if (!meeting) {
        throw new AppError('Meeting not found', 404);
      }

      const applicants = await meetingModel.getApplicants(meetingId);
      const members = applicants.map((a) => a.member);

      // 단체전 모드: 팀 수 자동 계산, 배우자 회피 비활성화
      let groupCount = meeting.group_count;
      let separateSpouses = meeting.separate_spouses;

      if (meeting.match_type === 'team' && meeting.team_size > 0) {
        groupCount = Math.max(2, Math.ceil(members.length / meeting.team_size));
        separateSpouses = false;
        // 자동 계산된 group_count를 DB에 저장
        await meetingModel.updateOptions(meetingId, { group_count: groupCount });
      }

      // Snake draft assignment (separateSpouses, busuType 옵션 적용)
      const groups = groupAssignmentService.snakeDraft(members, groupCount, separateSpouses, meeting.busu_type);

      // Balance pimple players (separateSpouses 옵션 적용)
      groupAssignmentService.balancePimple(groups, members, separateSpouses);

      // Save groups
      await meetingModel.saveGroups(meetingId, groups);
      await meetingModel.updateStatus(meetingId, 'assigning');

      const savedGroups = await meetingModel.getGroups(meetingId);
      res.json(savedGroups);
    } catch (error) {
      next(error);
    }
  },

  async completeAssignment(req: Request, res: Response, next: NextFunction) {
    try {
      const meetingId = parseInt(req.params.id);
      await meetingModel.updateStatus(meetingId, 'assigned');
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  },

  async reassignMember(req: Request, res: Response, next: NextFunction) {
    try {
      const meetingId = parseInt(req.params.id);
      const memberId = parseInt(req.params.memberId);
      const { group_num } = req.body;
      await meetingModel.reassignMember(meetingId, memberId, group_num);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  },

  // Matches
  async getMatches(req: Request, res: Response, next: NextFunction) {
    try {
      const meetingId = parseInt(req.params.id);
      const groupNum = parseInt(req.params.groupNum);
      const matches = await meetingModel.getMatches(meetingId, groupNum);
      res.json(matches);
    } catch (error) {
      next(error);
    }
  },

  async recordMatch(req: Request, res: Response, next: NextFunction) {
    try {
      const meetingId = parseInt(req.params.id);
      const { group_num, player1_id, player2_id, player1_sets, player2_sets } = req.body;
      await meetingModel.saveMatch(
        meetingId,
        group_num,
        player1_id,
        player2_id,
        player1_sets,
        player2_sets
      );
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  },

  async deleteMatch(req: Request, res: Response, next: NextFunction) {
    try {
      const meetingId = parseInt(req.params.id);
      const player1Id = parseInt(req.query.player1 as string);
      const player2Id = parseInt(req.query.player2 as string);
      await meetingModel.deleteMatch(meetingId, player1Id, player2Id);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  },

  // Ranking
  async getGroupRanking(req: Request, res: Response, next: NextFunction) {
    try {
      const meetingId = parseInt(req.params.id);
      const groupNum = parseInt(req.params.groupNum);

      const meeting = await meetingModel.findById(meetingId);
      if (!meeting) {
        throw new AppError('Meeting not found', 404);
      }

      const groups = await meetingModel.getGroups(meetingId);
      const group = groups.find((g) => g.group_num === groupNum);
      if (!group) {
        throw new AppError('Group not found', 404);
      }

      const matches = await meetingModel.getMatches(meetingId, groupNum);
      const ranking = rankingService.calculateRanking(group.members, matches, meeting.advance_rate);

      res.json(ranking);
    } catch (error) {
      next(error);
    }
  },

  // Tournament
  async getTournament(req: Request, res: Response, next: NextFunction) {
    try {
      const meetingId = parseInt(req.params.id);

      const meeting = await meetingModel.findById(meetingId);
      if (!meeting) {
        throw new AppError('Meeting not found', 404);
      }

      const allMatches = await meetingModel.getTournament(meetingId);
      const members = await memberModel.findAll();

      const upperBracket = tournamentService.formatBracket(allMatches, members, 'upper');
      const lowerBracket = meeting.has_lower_tournament
        ? tournamentService.formatBracket(allMatches, members, 'lower')
        : null;

      res.json({ upper: upperBracket, lower: lowerBracket });
    } catch (error) {
      next(error);
    }
  },

  async createTournament(req: Request, res: Response, next: NextFunction) {
    try {
      const meetingId = parseInt(req.params.id);

      const meeting = await meetingModel.findById(meetingId);
      if (!meeting) {
        throw new AppError('Meeting not found', 404);
      }

      // Get all group rankings
      const groups = await meetingModel.getGroups(meetingId);
      const advancedPlayers: { memberId: number; groupNum: number; rank: number }[] = [];
      const nonAdvancedPlayers: { memberId: number; groupNum: number; rank: number }[] = [];

      for (const group of groups) {
        const matches = await meetingModel.getMatches(meetingId, group.group_num);
        const ranking = rankingService.calculateRanking(
          group.members,
          matches,
          meeting.advance_rate
        );

        ranking.forEach((player) => {
          if (player.is_advanced) {
            advancedPlayers.push({
              memberId: player.member_id,
              groupNum: group.group_num,
              rank: player.rank,
            });
          } else {
            nonAdvancedPlayers.push({
              memberId: player.member_id,
              groupNum: group.group_num,
              rank: player.rank,
            });
          }
        });
      }

      // Helper function to create and process a tournament division
      const createDivision = async (division: TournamentDivision, players: typeof advancedPlayers) => {
        await meetingModel.clearTournament(meetingId, division);
        const tournamentMatches = tournamentService.createBracket(
          meetingId,
          players,
          meeting.group_count,
          division
        );
        await meetingModel.saveTournamentMatches(tournamentMatches);

        // Process bye matches - advance winners to next round
        const savedMatches = await meetingModel.getTournament(meetingId, division);
        for (const match of savedMatches) {
          if (match.is_bye && match.player1_id) {
            await meetingModel.advanceWinnerToNextRound(
              meetingId,
              division,
              match.round,
              match.match_order,
              match.player1_id,
              match.player1_from_group,
              match.player1_rank
            );
          }
        }
      };

      // Always create upper tournament
      await createDivision('upper', advancedPlayers);

      // Create lower tournament if enabled
      if (meeting.has_lower_tournament && nonAdvancedPlayers.length >= 2) {
        await createDivision('lower', nonAdvancedPlayers);
      }

      // Return both brackets
      const members = await memberModel.findAll();
      const allMatches = await meetingModel.getTournament(meetingId);
      const upperBracket = tournamentService.formatBracket(allMatches, members, 'upper');
      const lowerBracket = meeting.has_lower_tournament
        ? tournamentService.formatBracket(allMatches, members, 'lower')
        : null;

      res.json({ upper: upperBracket, lower: lowerBracket });
    } catch (error) {
      next(error);
    }
  },

  async setTournamentWinner(req: Request, res: Response, next: NextFunction) {
    try {
      const meetingId = parseInt(req.params.id);
      const matchId = parseInt(req.params.matchId);
      const { winner_id, player1_sets, player2_sets } = req.body;

      const match = await meetingModel.getTournamentMatch(matchId);
      if (!match) {
        throw new AppError('Match not found', 404);
      }

      // If there was a previous winner, clear their advancement
      if (match.winner_id && match.winner_id !== winner_id) {
        await meetingModel.clearNextRoundsWinner(meetingId, match.division, match.round, match.winner_id);
      }

      // Set new winner
      await meetingModel.setTournamentWinner(matchId, winner_id, player1_sets, player2_sets);

      // Advance to next round
      const winnerFromGroup =
        winner_id === match.player1_id ? match.player1_from_group : match.player2_from_group;
      const winnerRank =
        winner_id === match.player1_id ? match.player1_rank : match.player2_rank;
      await meetingModel.advanceWinnerToNextRound(
        meetingId,
        match.division,
        match.round,
        match.match_order,
        winner_id,
        winnerFromGroup,
        winnerRank
      );

      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  },

  // Team Matches (단체전)
  async getTeamMatches(req: Request, res: Response, next: NextFunction) {
    try {
      const meetingId = parseInt(req.params.id);
      const matches = await meetingModel.getTeamMatches(meetingId);
      res.json(matches);
    } catch (error) {
      next(error);
    }
  },

  async recordTeamMatch(req: Request, res: Response, next: NextFunction) {
    try {
      const meetingId = parseInt(req.params.id);
      const { team1_num, team2_num, team1_score, team2_score } = req.body;
      await meetingModel.saveTeamMatch(meetingId, team1_num, team2_num, team1_score, team2_score);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  },

  async deleteTeamMatch(req: Request, res: Response, next: NextFunction) {
    try {
      const meetingId = parseInt(req.params.id);
      const team1Num = parseInt(req.query.team1 as string);
      const team2Num = parseInt(req.query.team2 as string);
      await meetingModel.deleteTeamMatch(meetingId, team1Num, team2Num);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  },

  async getTeamMatchGames(req: Request, res: Response, next: NextFunction) {
    try {
      const meetingId = parseInt(req.params.id);
      const team1Num = req.query.team1 ? parseInt(req.query.team1 as string) : undefined;
      const team2Num = req.query.team2 ? parseInt(req.query.team2 as string) : undefined;
      const games = await meetingModel.getTeamMatchGames(meetingId, team1Num, team2Num);
      res.json(games);
    } catch (error) {
      next(error);
    }
  },

  async recordTeamMatchGame(req: Request, res: Response, next: NextFunction) {
    try {
      const meetingId = parseInt(req.params.id);
      const { team1_num, team2_num, game_order, game_type, team1_player1_id, team1_player2_id, team2_player1_id, team2_player2_id, winner_team } = req.body;
      await meetingModel.saveTeamMatchGame(
        meetingId, team1_num, team2_num, game_order, game_type,
        team1_player1_id, team1_player2_id, team2_player1_id, team2_player2_id, winner_team
      );
      // 개별 경기 결과로 팀 점수 자동 계산
      await meetingModel.updateTeamMatchScoreFromGames(meetingId, team1_num, team2_num);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  },

  async deleteTeamMatchGame(req: Request, res: Response, next: NextFunction) {
    try {
      const meetingId = parseInt(req.params.id);
      const team1Num = parseInt(req.query.team1 as string);
      const team2Num = parseInt(req.query.team2 as string);
      const gameOrder = parseInt(req.query.game_order as string);
      await meetingModel.deleteTeamMatchGame(meetingId, team1Num, team2Num, gameOrder);
      // 개별 경기 결과로 팀 점수 자동 재계산
      await meetingModel.updateTeamMatchScoreFromGames(meetingId, team1Num, team2Num);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  },

  async getTeamRanking(req: Request, res: Response, next: NextFunction) {
    try {
      const meetingId = parseInt(req.params.id);
      const meeting = await meetingModel.findById(meetingId);
      if (!meeting) {
        throw new AppError('Meeting not found', 404);
      }

      const teamMatches = await meetingModel.getTeamMatches(meetingId);
      const groups = await meetingModel.getGroups(meetingId);

      // 팀별 승/무/패/득실 계산
      const rankingMap = new Map<number, TeamRanking>();
      for (const group of groups) {
        rankingMap.set(group.group_num, {
          team_num: group.group_num,
          wins: 0,
          draws: 0,
          losses: 0,
          score_diff: 0,
        });
      }

      for (const match of teamMatches) {
        const t1 = rankingMap.get(match.team1_num);
        const t2 = rankingMap.get(match.team2_num);
        if (!t1 || !t2) continue;

        t1.score_diff += match.team1_score - match.team2_score;
        t2.score_diff += match.team2_score - match.team1_score;

        if (match.team1_score > match.team2_score) {
          t1.wins++;
          t2.losses++;
        } else if (match.team1_score < match.team2_score) {
          t1.losses++;
          t2.wins++;
        } else {
          t1.draws++;
          t2.draws++;
        }
      }

      const ranking = Array.from(rankingMap.values())
        .sort((a, b) => {
          // 승수 내림차순 → 득실차 내림차순 → 팀번호 오름차순
          if (b.wins !== a.wins) return b.wins - a.wins;
          if (b.score_diff !== a.score_diff) return b.score_diff - a.score_diff;
          return a.team_num - b.team_num;
        });

      res.json(ranking);
    } catch (error) {
      next(error);
    }
  },

  async getTournamentStandings(req: Request, res: Response, next: NextFunction) {
    try {
      const meetingId = parseInt(req.params.id);
      const division = (req.query.division as TournamentDivision) || 'upper';

      const meeting = await meetingModel.findById(meetingId);
      if (!meeting) {
        throw new AppError('Meeting not found', 404);
      }

      const upperStandings = await meetingModel.getTournamentStandings(meetingId, 'upper');
      const lowerStandings = meeting.has_lower_tournament
        ? await meetingModel.getTournamentStandings(meetingId, 'lower')
        : [];

      res.json({
        meeting_id: meetingId,
        meeting_name: meeting.name || `${meeting.year}년 ${meeting.month}월 경기`,
        upper: upperStandings,
        lower: lowerStandings,
      });
    } catch (error) {
      next(error);
    }
  },
};
