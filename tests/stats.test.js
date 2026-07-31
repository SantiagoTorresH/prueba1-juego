const test = require('node:test');
const assert = require('node:assert/strict');
const { applyMatchStats } = require('../server/stats');

test('aplica victorias, derrotas, kills y deaths correctamente', () => {
  const updates = applyMatchStats({
    winner: 'ana',
    players: [
      { username: 'ana', kills: 5, deaths: 1 },
      { username: 'luis', kills: 2, deaths: 4 }
    ]
  });

  assert.deepEqual(updates, [
    {
      username: 'ana',
      update: {
        $inc: {
          'stats.wins': 1,
          'stats.losses': 0,
          'stats.kills': 5,
          'stats.deaths': 1
        }
      }
    },
    {
      username: 'luis',
      update: {
        $inc: {
          'stats.wins': 0,
          'stats.losses': 1,
          'stats.kills': 2,
          'stats.deaths': 4
        }
      }
    }
  ]);
});
