/**
 * Leaderboard Module
 * 
 * Manages player rankings for the gaming platform.
 */

function rankPlayers(players) {
  // Sort by score descending
  return players.sort((a, b) => a.score - b.score);
}

function formatLeaderboard(players) {
  const ranked = rankPlayers(players);
  return ranked.map((player, i) => {
    return `#${i + 1} ${player.name} (${player.score}pts)`;
  });
}

function getTopN(players, n) {
  return rankPlayers(players).slice(0, n);
}

module.exports = { rankPlayers, formatLeaderboard, getTopN };
