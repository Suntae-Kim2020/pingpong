import type { TeamRanking, GroupWithMembers } from '../types';

interface TeamRankingTableProps {
  ranking: TeamRanking[];
  groups: GroupWithMembers[];
}

function TeamRankingTable({ ranking, groups }: TeamRankingTableProps) {
  const getTeamMembers = (teamNum: number): string => {
    const group = groups.find(g => g.group_num === teamNum);
    if (!group) return '';
    return group.members.map(m => m.name).join(', ');
  };

  if (ranking.length === 0) {
    return <p style={{ color: '#666', textAlign: 'center' }}>아직 경기 기록이 없습니다.</p>;
  }

  return (
    <div className="table-responsive">
      <table className="match-table" style={{ width: '100%' }}>
        <thead>
          <tr>
            <th style={{ width: '50px', textAlign: 'center' }}>순위</th>
            <th>팀</th>
            <th>팀원</th>
            <th style={{ width: '50px', textAlign: 'center' }}>승</th>
            <th style={{ width: '50px', textAlign: 'center' }}>무</th>
            <th style={{ width: '50px', textAlign: 'center' }}>패</th>
            <th style={{ width: '70px', textAlign: 'center' }}>득실</th>
          </tr>
        </thead>
        <tbody>
          {ranking.map((team, index) => (
            <tr key={team.team_num} style={{
              backgroundColor: index === 0 ? '#fef3c7' : (index === 1 ? '#f0f9ff' : 'transparent'),
            }}>
              <td style={{ textAlign: 'center', fontWeight: 'bold' }}>
                {index + 1}
              </td>
              <td style={{ fontWeight: 'bold' }}>
                {team.team_num}팀
              </td>
              <td style={{ fontSize: '13px', color: '#666' }}>
                {getTeamMembers(team.team_num)}
              </td>
              <td style={{ textAlign: 'center', color: '#16a34a', fontWeight: 'bold' }}>
                {team.wins}
              </td>
              <td style={{ textAlign: 'center', color: '#ca8a04' }}>
                {team.draws}
              </td>
              <td style={{ textAlign: 'center', color: '#dc2626' }}>
                {team.losses}
              </td>
              <td style={{
                textAlign: 'center',
                fontWeight: 'bold',
                color: team.score_diff > 0 ? '#16a34a' : (team.score_diff < 0 ? '#dc2626' : '#666'),
              }}>
                {team.score_diff > 0 ? `+${team.score_diff}` : team.score_diff}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default TeamRankingTable;
