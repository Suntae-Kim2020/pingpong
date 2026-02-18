import type { GroupRanking } from '../types';

interface GroupRankingTableProps {
  ranking: GroupRanking[];
  advanceRate: number;
}

function GroupRankingTable({ ranking, advanceRate }: GroupRankingTableProps) {
  const advanceCount = Math.ceil(ranking.length * advanceRate);

  return (
    <table className="table">
      <thead>
        <tr>
          <th>순위</th>
          <th>이름</th>
          <th>승</th>
          <th>패</th>
          <th>득세트</th>
          <th>실세트</th>
          <th>진출</th>
        </tr>
      </thead>
      <tbody>
        {ranking.map((player, index) => (
          <tr
            key={player.member_id}
            style={{
              backgroundColor: index < advanceCount ? '#e8f5e9' : 'transparent',
            }}
          >
            <td>{player.rank}</td>
            <td>{player.member_name}</td>
            <td>{player.wins}</td>
            <td>{player.losses}</td>
            <td>{player.sets_won}</td>
            <td>{player.sets_lost}</td>
            <td>
              {index < advanceCount && (
                <span className="badge badge-success">진출</span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default GroupRankingTable;
