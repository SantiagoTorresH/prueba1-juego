const test = require('node:test');
const assert = require('node:assert/strict');
const { hashPassword, comparePassword, signToken, verifyToken } = require('../server/auth');

test('genera y verifica un token JWT correctamente', async () => {
  const password = 'superSecret123';
  const hash = await hashPassword(password);

  const isValid = await comparePassword(password, hash);
  assert.equal(isValid, true);

  const token = signToken({ sub: 'user-1', username: 'TestUser' });
  const payload = verifyToken(token);

  assert.equal(payload.sub, 'user-1');
  assert.equal(payload.username, 'TestUser');
});
