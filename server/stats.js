function applyMatchStats(matchData) {
  const players = Array.isArray(matchData.players) ? matchData.players : [];
  const winner = matchData.winner;

  return players.map((player) => {
    const username = player.username || player.name;
    const kills = Number(player.kills) || 0;
    const deaths = Number(player.deaths) || 0;
    const isWinner = username === winner;

    return {
      username,
      update: {
        $inc: {
          'stats.wins': isWinner ? 1 : 0,
          'stats.losses': isWinner ? 0 : 1,
          'stats.kills': kills,
          'stats.deaths': deaths
        }
      }
    };
  });
}

module.exports = { applyMatchStats };
