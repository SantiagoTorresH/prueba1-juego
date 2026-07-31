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
