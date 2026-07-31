const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../server/app');

test('devuelve 401 cuando falta el token en /api/me', async () => {
  const app = createApp();
  const server = app.listen(0);

  try {
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}/api/me`);
    assert.equal(response.status, 401);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
