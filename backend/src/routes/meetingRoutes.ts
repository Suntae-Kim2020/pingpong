import { Router } from 'express';
import { meetingController } from '../controllers/meetingController';
import { requireAuth } from '../middleware/auth';

const router = Router();

// Meeting CRUD
router.get('/current', meetingController.getCurrent);
router.get('/closed', meetingController.getClosed);
router.get('/:id', meetingController.getById);
router.post('/', requireAuth, meetingController.create);
router.patch('/:id/status', requireAuth, meetingController.updateStatus);
router.patch('/:id/options', requireAuth, meetingController.updateOptions);
router.delete('/:id', requireAuth, meetingController.delete);

// Applicants
router.get('/:id/applicants', meetingController.getApplicants);
router.post('/:id/apply', requireAuth, meetingController.apply);
router.post('/:id/apply-bulk', requireAuth, meetingController.applyBulk);  // 복수 회원 일괄 신청
router.delete('/:id/apply/:memberId', requireAuth, meetingController.cancelApply);

// Groups
router.get('/:id/groups', meetingController.getGroups);
router.post('/:id/assign', requireAuth, meetingController.assignGroups);
router.patch('/:id/assign/complete', requireAuth, meetingController.completeAssignment);
router.put('/:id/groups/:memberId', requireAuth, meetingController.reassignMember);

// Matches
router.get('/:id/groups/:groupNum/matches', meetingController.getMatches);
router.post('/:id/matches', requireAuth, meetingController.recordMatch);
router.delete('/:id/matches', requireAuth, meetingController.deleteMatch);

// Team Matches (단체전)
router.get('/:id/team-matches', meetingController.getTeamMatches);
router.post('/:id/team-matches', requireAuth, meetingController.recordTeamMatch);
router.delete('/:id/team-matches', requireAuth, meetingController.deleteTeamMatch);
router.get('/:id/team-matches/games', meetingController.getTeamMatchGames);
router.post('/:id/team-matches/games', requireAuth, meetingController.recordTeamMatchGame);
router.delete('/:id/team-matches/games', requireAuth, meetingController.deleteTeamMatchGame);
router.get('/:id/team-ranking', meetingController.getTeamRanking);

// Ranking
router.get('/:id/groups/:groupNum/ranking', meetingController.getGroupRanking);

// Tournament
router.get('/:id/tournament', meetingController.getTournament);
router.get('/:id/tournament/standings', meetingController.getTournamentStandings);
router.post('/:id/tournament', requireAuth, meetingController.createTournament);
router.patch('/:id/tournament/:matchId/winner', requireAuth, meetingController.setTournamentWinner);

export default router;
