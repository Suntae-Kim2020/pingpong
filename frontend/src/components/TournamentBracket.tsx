import type { TournamentBracket, TournamentMatchDisplay } from '../types';

interface TournamentBracketProps {
  bracket: TournamentBracket;
  onSetWinner?: (matchId: number, winnerId: number) => void;
}

const ROUND_NAMES: Record<number, string> = {
  1: '결승',
  2: '준결승',
  4: '8강',
  8: '16강',
  16: '32강',
};

function TournamentBracketComponent({ bracket, onSetWinner }: TournamentBracketProps) {
  const handlePlayerClick = (match: TournamentMatchDisplay, playerId: number | null) => {
    if (!onSetWinner || !playerId) return;
    if (match.winner_id === playerId) return;
    onSetWinner(match.id, playerId);
  };

  const sortedRounds = [...bracket.rounds].sort((a, b) => b.round - a.round);

  return (
    <div className="bracket">
      {sortedRounds.map((round, roundIndex) => (
        <div key={round.round} className="bracket-round">
          <div className="bracket-round-title">
            {ROUND_NAMES[round.round] || `${round.round}강`}
          </div>
          <div className="bracket-matches">
            {round.matches.map((match, matchIndex) => (
              <div
                key={match.id}
                className={`bracket-match ${roundIndex < sortedRounds.length - 1 ? 'has-connector' : ''}`}
              >
                <div className="bracket-match-content">
                  <div
                    className={`bracket-player ${match.winner_id === match.player1.id ? 'winner' : ''} ${match.is_bye && !match.player1.id ? 'bye' : ''}`}
                    onClick={() => handlePlayerClick(match, match.player1.id)}
                    style={{ cursor: onSetWinner && match.player1.id && match.player2.id ? 'pointer' : 'default' }}
                  >
                    <span className="player-name">
                      {match.player1.name || (match.is_bye ? '부전승' : '대기중')}
                    </span>
                    {match.player1.from_group && match.player1.rank && (
                      <span className="player-seed">({match.player1.from_group}조 {match.player1.rank}위)</span>
                    )}
                  </div>
                  <div
                    className={`bracket-player ${match.winner_id === match.player2.id ? 'winner' : ''} ${match.is_bye && !match.player2.id ? 'bye' : ''}`}
                    onClick={() => handlePlayerClick(match, match.player2.id)}
                    style={{ cursor: onSetWinner && match.player1.id && match.player2.id ? 'pointer' : 'default' }}
                  >
                    <span className="player-name">
                      {match.player2.name || (match.is_bye ? '부전승' : '대기중')}
                    </span>
                    {match.player2.from_group && match.player2.rank && (
                      <span className="player-seed">({match.player2.from_group}조 {match.player2.rank}위)</span>
                    )}
                  </div>
                </div>
                {/* 연결선 */}
                {roundIndex < sortedRounds.length - 1 && (
                  <div className={`bracket-connector ${matchIndex % 2 === 0 ? 'top' : 'bottom'}`}>
                    <div className="connector-horizontal"></div>
                    <div className="connector-vertical"></div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default TournamentBracketComponent;
