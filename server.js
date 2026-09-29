const http = require('http');
const { Server } = require('socket.io');
const { connectToDatabase } = require('./server/mongo');
const { createApp } = require('./server/app');
const GameState = require('./server/gameState');
const MatchManager = require('./server/matchManager');

const gameState = new GameState();
const matchManager = new MatchManager();
const app = createApp({ gameState, matchManager });
const server = http.createServer(app);

process.on('unhandledRejection', (error) => {
  console.error('[server] unhandled rejection:', error);
});

process.on('uncaughtException', (error) => {
  console.error('[server] uncaught exception:', error);
  process.exitCode = 1;
});
const io = new Server(server, {
  cors: {
    origin: '*'
  }
});

let lastProjectileTick = Date.now();
let projectileTickCount = 0;
const projectileTick = setInterval(() => {
  const now = Date.now();
  const deltaSeconds = Math.min((now - lastProjectileTick) / 1000, 0.1);
  lastProjectileTick = now;

  for (const event of gameState.advanceProjectiles(deltaSeconds, now)) {
    const roomId = event.projectile.roomId;
    io.to(roomId).emit('projectileImpact', {
      id: event.projectile.id,
      playerId: event.projectile.playerId,
      targetId: event.playerId,
      weaponType: event.projectile.weaponType,
      type: event.type,
      surface: event.surface,
      position: event.position,
      shielded: Boolean(event.damageResult?.ignored)
    });

    if (!event.damageResult || event.damageResult.ignored) {
      continue;
    }

    if (event.damageResult.respawned) {
      io.to(roomId).emit('playerKilled', {
        id: event.playerId,
        killerId: event.projectile.playerId,
        health: 0
      });
      setTimeout(() => {
        const respawnedPlayer = gameState.respawnPlayer(event.playerId);
        if (respawnedPlayer) {
          io.to(roomId).emit('playerRespawn', respawnedPlayer);
        }
      }, event.damageResult.respawnDelayMs);
    } else {
      io.to(roomId).emit('playerDamaged', {
        id: event.playerId,
        health: event.damageResult.health,
        damage: event.damageResult.damage,
        killerId: event.projectile.playerId,
        weaponType: event.projectile.weaponType
      });
    }
  }

  for (const event of gameState.advanceGrenades(deltaSeconds, now)) {
    const { grenade, results } = event;
    io.to(grenade.roomId).emit('grenadeDetonated', {
      id: grenade.id,
      playerId: grenade.playerId,
      position: grenade.position,
      radius: grenade.radius
    });
    for (const result of results) {
      if (result.respawned) {
        io.to(grenade.roomId).emit('playerKilled', { id: result.targetId, killerId: grenade.playerId, health: 0 });
        setTimeout(() => {
          const respawnedPlayer = gameState.respawnPlayer(result.targetId);
          if (respawnedPlayer) io.to(grenade.roomId).emit('playerRespawn', respawnedPlayer);
        }, gameState.respawnDelayMs);
      } else {
        io.to(grenade.roomId).emit('playerDamaged', {
          id: result.targetId,
          health: result.health,
          damage: result.damage,
          killerId: grenade.playerId,
          weaponType: 'grenade'
        });
      }
    }
  }

  projectileTickCount += 1;
  if (projectileTickCount % 2 === 0) {
    const activeRoomIds = new Set(gameState.getProjectiles().map((projectile) => projectile.roomId));
    for (const roomId of activeRoomIds) {
      io.to(roomId).emit('projectileUpdate', gameState.getProjectiles(roomId));
    }
    const grenadeRoomIds = new Set(gameState.getGrenades().map((grenade) => grenade.roomId));
    for (const roomId of grenadeRoomIds) {
      io.to(roomId).emit('grenadeUpdate', gameState.getGrenades(roomId));
    }
  }
}, 1000 / 30);
projectileTick.unref();

function isValidVector(value) {
  return value && typeof value === 'object' && typeof value.x === 'number' && typeof value.y === 'number' && typeof value.z === 'number';
}

io.on('connection', (socket) => {
  console.log('Un jugador se ha conectado:', socket.id);

  const player = gameState.addPlayer(socket.id, {
    name: `Jugador ${socket.id.slice(0, 4)}`
  });

  socket.on('joinRoom', ({ roomId = 'default-room', playerData = {} } = {}) => {
    const safeRoomId = String(roomId || 'default-room');
    const playerId = playerData.id || socket.id;
    socket.data.roomId = safeRoomId;
    socket.data.playerId = playerId;
    socket.join(safeRoomId);
    gameState.ensureRoomWeaponPickups(safeRoomId);

    matchManager.ensureMatch(safeRoomId, {
      id: playerId,
      username: playerData.username || playerData.name || player.name || `Jugador ${socket.id.slice(0, 4)}`,
      team: playerData.team || socket.data.team
    });
    const joinedPlayer = matchManager.getPlayer(safeRoomId, playerId);
    if (!joinedPlayer) {
      return;
    }

    socket.data.username = joinedPlayer.username;
    socket.data.team = joinedPlayer.team;

    // Actualizar o crear el jugador en gameState con el equipo
    gameState.updatePlayer(socket.id, {
      name: joinedPlayer.username,
      team: joinedPlayer.team,
      weapon: gameState.weapons[playerData.weapon] ? playerData.weapon : 'pistol',
      roomId: safeRoomId,
      position: joinedPlayer.team === 'blue' ? { x: 18, y: 0, z: 18 } : { x: -18, y: 0, z: -18 },
      rotation: { x: 0, y: joinedPlayer.team === 'blue' ? 1.09 : -2.05 }
    });

    const roomPlayers = gameState.getSnapshot(safeRoomId).filter(([id]) => id !== socket.id);
    socket.emit('currentPlayers', roomPlayers);
    socket.emit('weaponPickups', gameState.getWeaponPickups(safeRoomId));
    socket.to(safeRoomId).emit('newPlayer', gameState.getPlayer(socket.id));

    socket.emit('roomJoined', {
      roomId: safeRoomId,
      state: matchManager.buildPersistedState(safeRoomId),
      player: gameState.getPlayer(socket.id)
    });
    io.to(safeRoomId).emit('roomState', matchManager.buildPersistedState(safeRoomId));
  });

  socket.on('disconnect', () => {
    console.log('Jugador desconectado:', socket.id);
    gameState.removePlayer(socket.id);

    if (socket.data.roomId && socket.data.playerId) {
      matchManager.markPlayerDisconnected(socket.data.roomId, socket.data.playerId);
      io.to(socket.data.roomId).emit('roomState', matchManager.buildPersistedState(socket.data.roomId));
      io.to(socket.data.roomId).emit('playerDisconnected', socket.id);
    }
  });

  socket.on('reconnectPlayer', ({ roomId = 'default-room', playerData = {} } = {}) => {
    const safeRoomId = String(roomId || 'default-room');
    const playerId = playerData.id || socket.data.playerId || socket.id;
    socket.data.roomId = safeRoomId;
    socket.data.playerId = playerId;
    socket.join(safeRoomId);
    gameState.ensureRoomWeaponPickups(safeRoomId);

    const reconnectedPlayer = matchManager.reconnectPlayer(safeRoomId, playerId, {
      username: playerData.username || playerData.name || socket.data.username || player.name,
      team: playerData.team || socket.data.team
    });

    if (reconnectedPlayer) {
      socket.data.username = reconnectedPlayer.username;
      socket.data.team = reconnectedPlayer.team;
      gameState.updatePlayer(socket.id, {
        name: reconnectedPlayer.username,
        team: reconnectedPlayer.team,
        roomId: safeRoomId,
        position: reconnectedPlayer.team === 'blue' ? { x: 18, y: 0, z: 18 } : { x: -18, y: 0, z: -18 },
        rotation: { x: 0, y: reconnectedPlayer.team === 'blue' ? 1.09 : -2.05 }
      });
    }

    socket.emit('currentPlayers', gameState.getSnapshot(safeRoomId).filter(([id]) => id !== socket.id));
    socket.emit('weaponPickups', gameState.getWeaponPickups(safeRoomId));
    if (reconnectedPlayer) {
      socket.to(safeRoomId).emit('newPlayer', gameState.getPlayer(socket.id));
    }

    socket.emit('roomJoined', {
      roomId: safeRoomId,
      state: matchManager.buildPersistedState(safeRoomId),
      player: gameState.getPlayer(socket.id)
    });
    io.to(safeRoomId).emit('roomState', matchManager.buildPersistedState(safeRoomId));
  });

  socket.on('changeTeam', ({ roomId = socket.data.roomId || 'default-room', team } = {}) => {
    const safeRoomId = String(roomId || 'default-room');
    if (team !== 'red' && team !== 'blue') {
      return;
    }

    const match = matchManager.getMatch(safeRoomId);
    if (!match) {
      return;
    }

    const player = match.players.find((entry) => entry.id === (socket.data.playerId || socket.id));
    if (!player) {
      return;
    }

    player.team = team;
    socket.data.team = team;
    gameState.updatePlayer(socket.id, { team });
    socket.emit('teamChanged', { team });
    io.to(safeRoomId).emit('roomState', matchManager.buildPersistedState(safeRoomId));
  });

  socket.on('playerMove', (data) => {
    if (!socket.data.roomId || !data || !isValidVector(data.position) || !data.rotation || typeof data.rotation.y !== 'number') {
      return;
    }

    const updatedPlayer = gameState.acceptPlayerMove(socket.id, data.position, data.rotation);

    if (updatedPlayer && socket.data.roomId) {
      const positionChanged = Math.hypot(
        updatedPlayer.position.x - data.position.x,
        updatedPlayer.position.y - data.position.y,
        updatedPlayer.position.z - data.position.z
      ) > 0.03;
      if (positionChanged) {
        socket.emit('playerPositionCorrected', updatedPlayer);
      }
      socket.to(socket.data.roomId).emit('updatePlayer', updatedPlayer);
    }
  });

  socket.on('playerShoot', (data) => {
    if (!socket.data.roomId || !data || !isValidVector(data.position) || !isValidVector(data.direction) || typeof data.weaponType !== 'string') {
      return;
    }

    const projectile = gameState.registerShot(socket.id, data.weaponType, data.position, data.direction);
    if (!projectile) {
      socket.emit('shotRejected', { weaponType: data.weaponType, ammo: gameState.getPlayer(socket.id)?.ammo });
      return;
    }

    io.to(socket.data.roomId).emit('projectileSpawned', projectile);
    socket.emit('weaponAmmo', gameState.getPlayer(socket.id).ammo);
  });

  socket.on('pickupWeapon', ({ pickupId } = {}) => {
    if (typeof pickupId !== 'string' || !socket.data.roomId) return;
    const pickupResult = gameState.pickupWeapon(socket.id, pickupId);
    if (!pickupResult) return;
    socket.emit('weaponEquipped', {
      weaponType: pickupResult.pickedWeapon,
      ammo: pickupResult.player.ammo
    });
    io.to(socket.data.roomId).emit('weaponPickups', pickupResult.pickups);
    io.to(socket.data.roomId).emit('playerWeaponChanged', {
      playerId: socket.id,
      weaponType: pickupResult.pickedWeapon
    });
  });

  socket.on('reloadWeapon', () => {
    const reload = gameState.reloadWeapon(socket.id);
    if (reload) socket.emit('weaponAmmo', reload.ammo);
  });

  socket.on('grenadeThrown', (data) => {
    if (!socket.data.roomId || !data || !isValidVector(data.position) || !isValidVector(data.direction)) return;
    const grenade = gameState.registerGrenade(socket.id, data.position, data.direction, data.charge);
    if (!grenade) {
      socket.emit('grenadeRejected', { grenades: gameState.getPlayer(socket.id)?.grenades });
      return;
    }
    socket.emit('grenadeAmmo', grenade.remaining);
    io.to(socket.data.roomId).emit('grenadeSpawned', grenade);
  });

  socket.on('chatMessage', ({ text } = {}) => {
    const message = String(text || '').trim().slice(0, 120);
    if (!message || !socket.data.roomId) return;
    io.to(socket.data.roomId).emit('chatMessage', {
      username: socket.data.username || player.name,
      text: message,
      createdAt: new Date().toISOString()
    });
  });

});

function findAvailablePort(startPort) {
  const tryPort = (port) => new Promise((resolve, reject) => {
    const testServer = http.createServer();

    testServer.once('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        resolve(tryPort(port + 1));
        return;
      }
      reject(error);
    });

    testServer.once('listening', () => {
      testServer.close(() => resolve(port));
    });

    testServer.listen(port);
  });

  return tryPort(startPort);
}

async function startServer() {
  await connectToDatabase();

  const preferredPort = Number(process.env.PORT || 3000);
  const port = await findAvailablePort(preferredPort).catch((error) => {
    console.error('No se pudo iniciar el servidor:', error);
    process.exit(1);
  });

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`Puerto ${port} ocupado. Cierra la instancia vieja o usa PORT=3001+ en el arranque.`);
      process.exit(1);
    }
    throw error;
  });

  server.listen(port, () => {
    console.log(`Servidor corriendo en http://localhost:${port}`);
  });
}

startServer();
