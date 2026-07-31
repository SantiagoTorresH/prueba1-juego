const test = require('node:test');
const assert = require('node:assert/strict');
const GameState = require('../server/gameState');

test('aplica daño y respawnea correctamente', () => {
  const state = new GameState();

  state.addPlayer('a', { name: 'Alpha' });
  state.addPlayer('b', { name: 'Beta' });

  const firstHit = state.handleHit('a', 'b', 'rifle');
  assert.equal(firstHit.damage, 20);
  assert.equal(firstHit.health, 80);
  assert.equal(state.getPlayer('b').health, 80);

  const secondHit = state.handleHit('a', 'b', 'rifle');
  assert.equal(secondHit.health, 60);
  assert.equal(state.getPlayer('b').health, 60);
  assert.equal(secondHit.respawned, false);

  const thirdHit = state.handleHit('a', 'b', 'rifle');
  assert.equal(thirdHit.health, 40);
  assert.equal(state.getPlayer('b').health, 40);
  assert.equal(thirdHit.respawned, false);

  const fourthHit = state.handleHit('a', 'b', 'rifle');
  assert.equal(fourthHit.health, 20);
  assert.equal(state.getPlayer('b').health, 20);
  assert.equal(fourthHit.respawned, false);

  const fifthHit = state.handleHit('a', 'b', 'rifle');
  assert.equal(fifthHit.health, 100);
  assert.equal(state.getPlayer('b').health, 100);
  assert.equal(fifthHit.respawned, true);
});
