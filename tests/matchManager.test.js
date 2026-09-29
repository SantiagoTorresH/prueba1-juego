const test = require('node:test');
const assert = require('node:assert/strict');
const MatchManager = require('../server/matchManager');

test('finaliza una partida cuando solo queda un jugador vivo', () => {
  const manager = new MatchManager();

  manager.ensureMatch('room-a', { id: 'a', username: 'Ana' });
  manager.ensureMatch('room-a', { id: 'b', username: 'Luis' });

  const finishedMatch = manager.recordKill('room-a', 'a', 'b');

  assert.equal(finishedMatch.status, 'finished');
  assert.equal(finishedMatch.winner, 'Ana');
  assert.equal(manager.getMatch('room-a'), null);
});

test('balancea equipos al incorporar jugadores sin equipo elegido', () => {
  const manager = new MatchManager();

  manager.ensureMatch('room-teams', { id: 'a', username: 'Ana' });
  manager.ensureMatch('room-teams', { id: 'b', username: 'Luis' });

  assert.equal(manager.getPlayer('room-teams', 'a').team, 'red');
  assert.equal(manager.getPlayer('room-teams', 'b').team, 'blue');
});

test('mantiene a los jugadores en una sala y permite reengancharse tras la desconexión', () => {
  const manager = new MatchManager();

  manager.ensureMatch('room-b', { id: 'a', username: 'Ana' });
  manager.ensureMatch('room-b', { id: 'b', username: 'Luis' });

  manager.markPlayerDisconnected('room-b', 'a');
  const disconnectedPlayer = manager.getPlayer('room-b', 'a');
  assert.equal(disconnectedPlayer.connected, false);

  const reconnectedPlayer = manager.reconnectPlayer('room-b', 'a', { id: 'a', username: 'Ana' });
  assert.equal(reconnectedPlayer.connected, true);

  const persisted = manager.buildPersistedState('room-b');
  assert.equal(persisted.roomId, 'room-b');
  assert.equal(persisted.players.length, 2);
});

test('reconecta a un jugador aunque la sesión de la sala haya quedado incompleta', () => {
  const manager = new MatchManager();

  manager.ensureMatch('room-c', { id: 'a', username: 'Ana' });
  manager.getMatch('room-c').players = [];

  const reconnectedPlayer = manager.reconnectPlayer('room-c', 'a', { username: 'Ana' });

  assert.ok(reconnectedPlayer);
  assert.equal(reconnectedPlayer.connected, true);
  assert.equal(reconnectedPlayer.username, 'Ana');
  assert.equal(manager.getMatch('room-c').players.length, 1);
});
