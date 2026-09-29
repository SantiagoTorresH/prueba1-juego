const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const net = require('node:net');
const path = require('node:path');
const { io: createClient } = require('socket.io-client');

function findFreePort() {
  return new Promise((resolve, reject) => {
    const listener = net.createServer();
    listener.once('error', reject);
    listener.listen(0, '127.0.0.1', () => {
      const { port } = listener.address();
      listener.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

function waitForServer(child, port) {
  return new Promise((resolve, reject) => {
    let output = '';
    const timeout = setTimeout(() => finish(new Error(`Servidor no inició a tiempo. ${output}`)), 10000);

    function finish(error) {
      clearTimeout(timeout);
      child.stdout.off('data', onOutput);
      child.stderr.off('data', onOutput);
      child.off('exit', onExit);
      error ? reject(error) : resolve();
    }

    function onOutput(chunk) {
      output += chunk.toString();
      if (output.includes(`Servidor corriendo en http://localhost:${port}`)) {
        finish();
      }
    }

    function onExit(code) {
      finish(new Error(`El servidor terminó con código ${code}. ${output}`));
    }

    child.stdout.on('data', onOutput);
    child.stderr.on('data', onOutput);
    child.once('exit', onExit);
  });
}

async function joinRoom(port, roomId, username, team, weapon) {
  const client = createClient(`http://127.0.0.1:${port}`, {
    transports: ['websocket'],
    reconnection: false,
    timeout: 5000
  });

  await new Promise((resolve, reject) => {
    client.once('connect', resolve);
    client.once('connect_error', reject);
  });

  const currentPlayers = new Promise((resolve) => client.once('currentPlayers', resolve));
  const roomJoined = new Promise((resolve) => client.once('roomJoined', resolve));
  client.emit('joinRoom', { roomId, playerData: { id: username, username, ...(team ? { team } : {}), ...(weapon ? { weapon } : {}) } });

  const [players, joined] = await Promise.all([currentPlayers, roomJoined]);
  return { client, players, joined };
}

test('Socket.IO solo comparte snapshots con jugadores de la misma sala', async () => {
  const port = await findFreePort();
  const serverProcess = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, PORT: String(port), MONGO_URI: '' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  const clients = [];

  try {
    await waitForServer(serverProcess, port);

    const alpha = await joinRoom(port, 'alpha', 'Alpha');
    clients.push(alpha.client);
    const beta = await joinRoom(port, 'beta', 'Beta');
    clients.push(beta.client);
    const alphaGuest = await joinRoom(port, 'alpha', 'AlphaGuest');
    clients.push(alphaGuest.client);

    assert.deepEqual(alpha.players, []);
    assert.deepEqual(beta.players, []);
    assert.deepEqual(alphaGuest.players.map(([id]) => id), [alpha.client.id]);
    assert.equal(alphaGuest.players.some(([id]) => id === beta.client.id), false);
    assert.equal(alphaGuest.joined.roomId, 'alpha');
  } finally {
    clients.forEach((client) => client.disconnect());
    if (serverProcess.exitCode === null) {
      const stopped = new Promise((resolve) => serverProcess.once('exit', resolve));
      serverProcess.kill();
      await stopped;
    }
  }
});

test('Socket.IO ignora hits declarados por cliente y replica el impacto autoritativo con cobertura', async () => {
  const port = await findFreePort();
  const serverProcess = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, PORT: String(port), MONGO_URI: '' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  const clients = [];

  try {
    await waitForServer(serverProcess, port);
    const shooter = await joinRoom(port, 'combat', 'Shooter', 'red', 'rifle');
    clients.push(shooter.client);
    assert.equal(shooter.joined.player.id, shooter.client.id);
    const newPlayerPromise = new Promise((resolve) => shooter.client.once('newPlayer', resolve));
    const target = await joinRoom(port, 'combat', 'Target', 'blue');
    clients.push(target.client);
    assert.equal(target.joined.player.team, 'blue');
    assert.deepEqual(target.joined.player.position, { x: 18, y: 0, z: 18 });
    const remoteTarget = await newPlayerPromise;
    assert.equal(remoteTarget.id, target.client.id);
    assert.equal(remoteTarget.team, 'blue');
    assert.deepEqual(remoteTarget.position, { x: 18, y: 0, z: 18 });
    const damages = [];
    target.client.on('playerDamaged', (event) => {
      if (event.id === target.client.id) damages.push(event.health);
    });

    shooter.client.emit('playerHit', { targetId: target.client.id, weaponType: 'rifle' });
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.deepEqual(damages, []);

    const rejectedShot = new Promise((resolve) => shooter.client.once('shotRejected', resolve));
    shooter.client.emit('playerShoot', {
      position: { x: 0, y: 1.2, z: 0 },
      direction: { x: 0, y: 0, z: -1 },
      weaponType: 'rifle'
    });
    assert.equal((await rejectedShot).weaponType, 'rifle');

    const projectileSpawned = new Promise((resolve) => shooter.client.once('projectileSpawned', resolve));
    shooter.client.emit('playerShoot', {
      position: { x: -18, y: 1.2, z: -18 },
      direction: { x: Math.SQRT1_2, y: 0, z: Math.SQRT1_2 },
      weaponType: 'rifle'
    });
    const projectile = await projectileSpawned;
    assert.deepEqual(projectile.position, { x: -18, y: 1.2, z: -18 });
    assert.ok(Math.abs(projectile.direction.x - Math.SQRT1_2) < 0.001);

    const impactPromise = new Promise((resolve) => shooter.client.once('projectileImpact', resolve));
    shooter.client.emit('playerHit', { targetId: target.client.id, weaponType: 'rifle' });
    const impact = await impactPromise;
    assert.equal(impact.id, projectile.id);
    assert.equal(impact.type, 'arena');
    assert.deepEqual(damages, []);
  } finally {
    clients.forEach((client) => client.disconnect());
    if (serverProcess.exitCode === null) {
      const stopped = new Promise((resolve) => serverProcess.once('exit', resolve));
      serverProcess.kill();
      await stopped;
    }
  }
});

test('Socket.IO aplica daño cuando el proyectil autoritativo alcanza un objetivo', async () => {
  const port = await findFreePort();
  const serverProcess = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, PORT: String(port), MONGO_URI: '' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  const clients = [];

  try {
    await waitForServer(serverProcess, port);
    const shooter = await joinRoom(port, 'clear-shot', 'Shooter', 'red', 'rifle');
    clients.push(shooter.client);
    const target = await joinRoom(port, 'clear-shot', 'Target', 'red');
    clients.push(target.client);

    await new Promise((resolve) => setTimeout(resolve, 200));
    const positionUpdate = new Promise((resolve) => shooter.client.once('updatePlayer', resolve));
    target.client.emit('playerMove', {
      position: { x: -15, y: 0, z: -18 },
      rotation: { x: 0, y: 0 }
    });
    const updatedTarget = await Promise.race([
      positionUpdate,
      new Promise((_, reject) => setTimeout(() => reject(new Error('El servidor rechazó el movimiento de prueba')), 1000))
    ]);
    assert.equal(updatedTarget.id, target.client.id);
    assert.equal(updatedTarget.position.x, -15);

    const damageEvent = new Promise((resolve) => target.client.once('playerDamaged', resolve));
    const impactEvent = new Promise((resolve) => shooter.client.once('projectileImpact', resolve));
    shooter.client.emit('playerShoot', {
      position: { x: -18, y: 1.2, z: -18 },
      direction: { x: 1, y: 0, z: 0 },
      weaponType: 'rifle'
    });

    const [damage, impact] = await Promise.all([damageEvent, impactEvent]);
    assert.equal(impact.type, 'player');
    assert.equal(impact.targetId, target.client.id);
    assert.equal(damage.id, target.client.id);
    assert.equal(damage.health, 80);
  } finally {
    clients.forEach((client) => client.disconnect());
    if (serverProcess.exitCode === null) {
      const stopped = new Promise((resolve) => serverProcess.once('exit', resolve));
      serverProcess.kill();
      await stopped;
    }
  }
});

test('Socket.IO permite recoger SMG, dejar el arma anterior y detonar granada a los 2 s', async () => {
  const port = await findFreePort();
  const serverProcess = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, PORT: String(port), MONGO_URI: '' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  const clients = [];

  try {
    await waitForServer(serverProcess, port);
    const player = await joinRoom(port, 'weapon-pickup', 'Runner', 'red');
    clients.push(player.client);
    const observer = await joinRoom(port, 'weapon-pickup', 'Observer', 'blue');
    clients.push(observer.client);
    await new Promise((resolve) => setTimeout(resolve, 150));

    const moveTo = async (x, z) => {
      const update = new Promise((resolve) => observer.client.once('updatePlayer', resolve));
      player.client.emit('playerMove', { position: { x, y: 0, z }, rotation: { x: 0, y: 0 } });
      const result = await Promise.race([
        update,
        new Promise((_, reject) => setTimeout(() => reject(new Error(`El servidor rechazó la posición ${x}, ${z}`)), 600))
      ]);
      assert.equal(result.id, player.client.id);
      await new Promise((resolve) => setTimeout(resolve, 100));
    };

    for (let z = -16.5; z <= -7.5; z += 1.5) await moveTo(-18, z);
    await moveTo(-18, -6.5);
    for (let x = -16.5; x <= -10.5; x += 1.5) await moveTo(x, -6.5);
    await moveTo(-10, -6.5);
    for (let z = -5; z <= 0; z += 1) await moveTo(-10, z);

    const equipped = new Promise((resolve) => player.client.once('weaponEquipped', resolve));
    player.client.emit('pickupWeapon', { pickupId: 'smg-yard' });
    const weapon = await equipped;
    assert.equal(weapon.weaponType, 'smg');
    assert.equal(weapon.ammo.smg, 36);

    const pickupSync = new Promise((resolve) => observer.client.once('weaponPickups', resolve));
    const pickups = await pickupSync;
    assert.equal(pickups.some((pickup) => pickup.weaponType === 'pistol' && pickup.id.startsWith('drop-')), true);

    const spawned = new Promise((resolve) => player.client.once('grenadeSpawned', resolve));
    const ammo = new Promise((resolve) => player.client.once('grenadeAmmo', resolve));
    player.client.emit('grenadeThrown', {
      position: { x: -10, y: 1.8, z: 0 },
      direction: { x: 0, y: 0, z: -1 },
      charge: 0.75
    });
    const [grenade, remainingGrenades] = await Promise.all([spawned, ammo]);
    assert.equal(remainingGrenades, 2);
    assert.equal(grenade.fuseAt - Date.now() <= 2000, true);

    const detonation = new Promise((resolve) => player.client.once('grenadeDetonated', resolve));
    const exploded = await detonation;
    assert.equal(exploded.id, grenade.id);
    assert.ok(exploded.position.x !== grenade.position.x || exploded.position.y !== grenade.position.y || exploded.position.z !== grenade.position.z);
  } finally {
    clients.forEach((client) => client.disconnect());
    if (serverProcess.exitCode === null) {
      const stopped = new Promise((resolve) => serverProcess.once('exit', resolve));
      serverProcess.kill();
      await stopped;
    }
  }
});