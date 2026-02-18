import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { meetingsApi } from '../api/meetings';
import type { MonthlyMeeting, GroupWithMembers, GroupRanking, MeetingMatch, MeetingTeamMatch, TeamRanking, SetScore } from '../types';
import { MATCH_FORMAT_LABELS, TEAM_MATCH_FORMAT_LABELS } from '../types';
import MatchTable from '../components/MatchTable';
import GroupRankingTable from '../components/GroupRanking';
import TeamMatchTable from '../components/TeamMatchTable';
import TeamRankingTable from '../components/TeamRanking';

function ResultPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const meetingId = parseInt(id || '0');

  const [meeting, setMeeting] = useState<MonthlyMeeting | null>(null);
  const [groups, setGroups] = useState<GroupWithMembers[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<number>(1);
  const [matches, setMatches] = useState<MeetingMatch[]>([]);
  const [ranking, setRanking] = useState<GroupRanking[]>([]);
  const [teamMatches, setTeamMatches] = useState<MeetingTeamMatch[]>([]);
  const [teamRanking, setTeamRanking] = useState<TeamRanking[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadGroupData = useCallback(async (groupNum: number) => {
    try {
      const [matchesData, rankingData] = await Promise.all([
        meetingsApi.getMatches(meetingId, groupNum),
        meetingsApi.getGroupRanking(meetingId, groupNum),
      ]);
      setMatches(matchesData);
      setRanking(rankingData);
    } catch (err) {
      console.error('Failed to load group data:', err);
    }
  }, [meetingId]);

  const loadTeamData = useCallback(async () => {
    try {
      const [teamMatchesData, teamRankingData] = await Promise.all([
        meetingsApi.getTeamMatches(meetingId),
        meetingsApi.getTeamRanking(meetingId),
      ]);
      setTeamMatches(teamMatchesData);
      setTeamRanking(teamRankingData);
    } catch (err) {
      console.error('Failed to load team data:', err);
    }
  }, [meetingId]);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [meetingData, groupsData] = await Promise.all([
          meetingsApi.getById(meetingId),
          meetingsApi.getGroups(meetingId),
        ]);
        setMeeting(meetingData);
        setGroups(groupsData);

        if (meetingData.match_type === 'team') {
          await loadTeamData();
        } else if (groupsData.length > 0) {
          await loadGroupData(1);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [meetingId, loadGroupData, loadTeamData]);

  useEffect(() => {
    if (groups.length > 0) {
      loadGroupData(selectedGroup);
    }
  }, [selectedGroup, groups.length, loadGroupData]);

  // Auto-refresh every 5 seconds (except when saving)
  useEffect(() => {
    if (saving) return;

    const interval = setInterval(() => {
      if (meeting?.match_type === 'team') {
        loadTeamData();
      } else {
        loadGroupData(selectedGroup);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [selectedGroup, saving, loadGroupData, loadTeamData, meeting?.match_type]);

  const handleRecordMatch = async (
    player1Id: number,
    player2Id: number,
    player1Sets: number,
    player2Sets: number,
    _setScores?: SetScore[]
  ) => {
    try {
      setSaving(true);
      await meetingsApi.recordMatch(meetingId, {
        group_num: selectedGroup,
        player1_id: player1Id,
        player2_id: player2Id,
        player1_sets: player1Sets,
        player2_sets: player2Sets,
        // TODO: Store set_scores in database if needed
      });
      await loadGroupData(selectedGroup);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record match');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteMatch = async (player1Id: number, player2Id: number) => {
    try {
      setSaving(true);
      await meetingsApi.deleteMatch(meetingId, player1Id, player2Id);
      await loadGroupData(selectedGroup);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete match');
    } finally {
      setSaving(false);
    }
  };

  const handleRecordTeamMatch = async (
    team1Num: number,
    team2Num: number,
    team1Score: number,
    team2Score: number
  ) => {
    try {
      setSaving(true);
      await meetingsApi.recordTeamMatch(meetingId, {
        team1_num: team1Num,
        team2_num: team2Num,
        team1_score: team1Score,
        team2_score: team2Score,
      });
      await loadTeamData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record team match');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTeamMatch = async (team1Num: number, team2Num: number) => {
    try {
      setSaving(true);
      await meetingsApi.deleteTeamMatch(meetingId, team1Num, team2Num);
      await loadTeamData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete team match');
    } finally {
      setSaving(false);
    }
  };

  const handleStartTournament = async () => {
    try {
      await meetingsApi.updateStatus(meetingId, 'tournament');
      await meetingsApi.createTournament(meetingId);
      navigate(`/meeting/${meetingId}/tournament`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start tournament');
    }
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  if (!meeting) {
    return <div className="error">Meeting not found</div>;
  }

  const currentGroup = groups.find((g) => g.group_num === selectedGroup);
  const isTeamMode = meeting.match_type === 'team';

  return (
    <div>
      <header className="header">
        <h1 style={{ margin: 0 }}>
          {meeting.name || `${meeting.year}년 ${meeting.month}월 경기`} - {isTeamMode ? '팀 대항전' : '예선 결과'}
        </h1>
      </header>

      <div className="container">
        {error && <div className="error">{error}</div>}

        {isTeamMode ? (
          /* 단체전 UI */
          <>
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <span className="badge badge-primary" style={{ marginRight: '10px' }}>단체전</span>
                  <span style={{ fontSize: '13px', color: '#666' }}>
                    {TEAM_MATCH_FORMAT_LABELS[meeting.team_match_format] || meeting.team_match_format}
                    {' | '}팀당 {meeting.team_size}명
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <button
                    className="btn btn-secondary"
                    onClick={() => navigate(`/meeting/${meetingId}`)}
                  >
                    경기 관리
                  </button>
                </div>
              </div>
            </div>

            <div className="card">
              <h2 className="card-title">팀 순위</h2>
              <TeamRankingTable ranking={teamRanking} groups={groups} />
            </div>

            <div className="card">
              <h2 className="card-title">팀 대항전 기록</h2>
              <TeamMatchTable
                groups={groups}
                teamMatches={teamMatches}
                onRecordMatch={meeting.status === 'recording' ? handleRecordTeamMatch : undefined}
                onDeleteMatch={meeting.status === 'recording' ? handleDeleteTeamMatch : undefined}
                disabled={saving}
              />
            </div>
          </>
        ) : (
          /* 개인전 UI (기존) */
          <>
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  {groups.map((group) => (
                    <button
                      key={group.group_num}
                      className={`btn ${selectedGroup === group.group_num ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setSelectedGroup(group.group_num)}
                      style={{ marginRight: '10px' }}
                    >
                      {group.group_num}조
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '13px', color: '#666' }}>
                    {MATCH_FORMAT_LABELS[meeting.match_format]}
                    {meeting.use_detailed_score && ' (세트별 점수 입력)'}
                  </span>
                  <button
                    className="btn btn-secondary"
                    onClick={() => navigate(`/meeting/${meetingId}`)}
                  >
                    경기 관리
                  </button>
                  {meeting.status === 'recording' && (
                    <button className="btn btn-success" onClick={handleStartTournament}>
                      토너먼트 시작
                    </button>
                  )}
                  {(meeting.status === 'tournament' || meeting.status === 'closed') && (
                    <button
                      className="btn btn-primary"
                      onClick={() => navigate(`/meeting/${meetingId}/tournament`)}
                    >
                      토너먼트 보기
                    </button>
                  )}
                </div>
              </div>
            </div>

            {currentGroup && (
              <>
                <div className="card">
                  <h2 className="card-title">{selectedGroup}조 경기표</h2>
                  <MatchTable
                    members={currentGroup.members}
                    matches={matches}
                    onRecordMatch={meeting.status === 'recording' ? handleRecordMatch : undefined}
                    onDeleteMatch={meeting.status === 'recording' ? handleDeleteMatch : undefined}
                    disabled={saving}
                    useDetailedScore={meeting.use_detailed_score}
                    matchFormat={meeting.match_format}
                    busuType={meeting.busu_type}
                  />
                </div>

                <div className="card">
                  <h2 className="card-title">{selectedGroup}조 순위</h2>
                  <GroupRankingTable ranking={ranking} advanceRate={meeting.advance_rate} />
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default ResultPage;
