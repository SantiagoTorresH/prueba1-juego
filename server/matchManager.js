const Match = require('./models/match');
const User = require('./models/user');
const { applyMatchStats } = require('./stats');

class MatchManager {
  constructor() {
    this.activeMatches = new Map();
  }

  assignTeam(existingPlayers = []) {
    const redCount = existingPlayers.filter((p) => p.team === 'red').length;
    const blueCount = existingPlayers.filter((p) => p.team === 'blue').length;
    return redCount <= blueCount ? 'red' : 'blue';
  }

  createMatch(roomId, players = []) {
    const match = {
      roomId,
      status: 'active',
      startedAt: new Date(),
      players: players.map((player, index) => ({
        id: player.id,
        username: player.username || player.name || 'Jugador',
        team: player.team || (index % 2 === 0 ? 'red' : 'blue'),
        kills: 0,
        deaths: 0,
        alive: true,
        connected: true,
        lastSeenAt: new Date()
      })),
      winner: null,
      result: {}
    };

    this.activeMatches.set(roomId, match);
    return match;
  }

  ensureMatch(roomId, player) {
    const existingMatch = this.activeMatches.get(roomId);
    if (existingMatch) {
      const existingPlayer = existingMatch.players.find((entry) => entry.id === player.id);
      if (existingPlayer) {
        existingPlayer.connected = true;
        existingPlayer.lastSeenAt = new Date();
        existingPlayer.username = player.username || existingPlayer.username || 'Jugador';
        return existingMatch;
      }

      const assignedTeam = this.assignTeam(existingMatch.players);
      existingMatch.players.push({
        id: player.id,
        username: player.username || player.name || 'Jugador',
        team: player.team || assignedTeam,
        kills: 0,
        deaths: 0,
        alive: true,
        connected: true,
        lastSeenAt: new Date()
      });
      return existingMatch;
    }

    return this.createMatch(roomId, [player]);
  }

  getMatch(roomId) {
    return this.activeMatches.get(roomId) || null;
  }

  getPlayer(roomId, playerId) {
    const match = this.getMatch(roomId);
    if (!match) {
      return null;
    }

    return match.players.find((player) => player.id === playerId) || null;
  }

  markPlayerDisconnected(roomId, playerId) {
    const player = this.getPlayer(roomId, playerId);
    if (!player) {
      return null;
    }

    player.connected = false;
    player.lastSeenAt = new Date();
    return player;
  }

  reconnectPlayer(roomId, playerId, playerData = {}) {
    let player = this.getPlayer(roomId, playerId);

    if (!player) {
      const match = this.ensureMatch(roomId, {
        id: playerId,
        username: playerData.username || playerData.name || 'Jugador'
      });
      player = match.players.find((entry) => entry.id === playerId) || null;
    }

    if (!player) {
      return null;
    }

    player.connected = true;
    player.lastSeenAt = new Date();
    player.alive = typeof player.alive === 'boolean' ? player.alive : true;
    if (playerData.username) {
      player.username = playerData.username;
    }
    return player;
  }

  buildPersistedState(roomId) {
    const match = this.getMatch(roomId);
    if (!match) {
      return null;
    }

    return {
      roomId: match.roomId,
      status: match.status,
      startedAt: match.startedAt,
      players: match.players.map((player) => ({
        id: player.id,
        username: player.username,
        kills: player.kills,
        deaths: player.deaths,
        alive: player.alive,
        connected: player.connected,
        lastSeenAt: player.lastSeenAt
      })),
      winner: match.winner,
      result: match.result
    };
  }

  updatePlayerStats(roomId, playerId, payload = {}) {
    const match = this.activeMatches.get(roomId);
    if (!match) {
      return null;
    }

    const player = match.players.find((entry) => entry.id === playerId);
    if (!player) {
      return null;
    }

    if (typeof payload.kills === 'number') {
      player.kills = payload.kills;
    }

    if (typeof payload.deaths === 'number') {
      player.deaths = payload.deaths;
    }

    if (typeof payload.alive === 'boolean') {
      player.alive = payload.alive;
    }

    return player;
  }

  recordKill(roomId, killerId, targetId) {
    const match = this.activeMatches.get(roomId);
    if (!match) {
      return null;
    }

    const killer = match.players.find((player) => player.id === killerId);
    const target = match.players.find((player) => player.id === targetId);

    if (killer) {
      killer.kills += 1;
    }

    if (target) {
      target.deaths += 1;
      target.alive = false;
    }

    const survivingPlayers = match.players.filter((player) => player.alive);
    if (survivingPlayers.length === 1) {
      return this.finishMatch(roomId, survivingPlayers[0].id);
    }

    return match;
  }

  finishMatch(roomId, winnerId) {
    const match = this.activeMatches.get(roomId);
    if (!match) {
      return null;
    }

    const winnerPlayer = match.players.find((player) => player.id === winnerId);
    match.winner = winnerPlayer ? winnerPlayer.username : null;
    match.status = 'finished';
    match.endedAt = new Date();
    match.result = {
      winner: match.winner,
      players: match.players
    };

    this.activeMatches.delete(roomId);
    return match;
  }

  async persistMatch(match) {
    const savedMatch = await Match.create({
      roomId: match.roomId,
      status: match.status,
      mode: 'ffa',
      winner: match.winner,
      players: match.players.map((player) => ({
        username: player.username,
        kills: player.kills,
        deaths: player.deaths,
        alive: player.alive,
        connected: player.connected
      })),
      startedAt: match.startedAt,
      endedAt: match.endedAt,
      result: match.result
    });

    const updates = applyMatchStats({
      winner: match.winner,
      players: match.players
    });

    await Promise.all(updates.map(({ username, update }) => 
      User.updateOne({ username }, update)
    ));

    return savedMatch;
  }
}

module.exports = MatchManager;
