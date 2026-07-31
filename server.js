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
const io = new Server(server, {
  cors: {
    origin: '*'
  }
});

function isValidVector(value) {
  return value && typeof value === 'object' && typeof value.x === 'number' && typeof value.y === 'number' && typeof value.z === 'number';
}

io.on('connection', (socket) => {
  console.log('Un jugador se ha conectado:', socket.id);

  const player = gameState.addPlayer(socket.id, {
    name: `Jugador ${socket.id.slice(0, 4)}`
  });

  socket.emit('currentPlayers', gameState.getSnapshot());

  socket.on('joinRoom', ({ roomId = 'default-room', playerData = {} } = {}) => {
    const safeRoomId = String(roomId || 'default-room');
    const playerId = playerData.id || socket.id;
    socket.data.roomId = safeRoomId;
    socket.data.playerId = playerId;
    socket.join(safeRoomId);

    const joinedPlayer = matchManager.ensureMatch(safeRoomId, {
      id: playerId,
      username: playerData.username || playerData.name || player.name || `Jugador ${socket.id.slice(0, 4)}`
    });

    socket.data.username = joinedPlayer.username;
    socket.emit('roomJoined', {
      roomId: safeRoomId,
      state: matchManager.buildPersistedState(safeRoomId)
    });
    io.to(safeRoomId).emit('roomState', matchManager.buildPersistedState(safeRoomId));
  });

  socket.on('disconnect', () => {
    console.log('Jugador desconectado:', socket.id);
    gameState.removePlayer(socket.id);

    if (socket.data.roomId && socket.data.playerId) {
      matchManager.markPlayerDisconnected(socket.data.roomId, socket.data.playerId);
      io.to(socket.data.roomId).emit('roomState', matchManager.buildPersistedState(socket.data.roomId));
    }

    io.emit('playerDisconnected', socket.id);
  });

  socket.on('reconnectPlayer', ({ roomId = 'default-room', playerData = {} } = {}) => {
    const safeRoomId = String(roomId || 'default-room');
    const playerId = playerData.id || socket.data.playerId || socket.id;
    socket.data.roomId = safeRoomId;
    socket.data.playerId = playerId;
    socket.join(safeRoomId);

    const reconnectedPlayer = matchManager.reconnectPlayer(safeRoomId, playerId, {
      username: playerData.username || playerData.name || socket.data.username || player.name
    });

    if (reconnectedPlayer) {
      socket.data.username = reconnectedPlayer.username;
    }

    socket.emit('roomJoined', {
      roomId: safeRoomId,
      state: matchManager.buildPersistedState(safeRoomId)
    });
    io.to(safeRoomId).emit('roomState', matchManager.buildPersistedState(safeRoomId));
  });

  socket.on('playerMove', (data) => {
    if (!data || !isValidVector(data.position) || !data.rotation || typeof data.rotation.y !== 'number') {
      return;
    }

    const updatedPlayer = gameState.updatePlayer(socket.id, {
      position: data.position,
      rotation: data.rotation
    });

    if (updatedPlayer) {
      socket.broadcast.emit('updatePlayer', updatedPlayer);
    }
  });

  socket.on('playerShoot', (data) => {
    if (!data || !isValidVector(data.position) || !isValidVector(data.direction) || typeof data.weaponType !== 'string') {
      return;
    }

    io.emit('bulletFired', {
      playerId: socket.id,
      position: data.position,
      direction: data.direction,
      weaponType: data.weaponType
    });
  });

  socket.on('playerHit', (data) => {
    if (!data || typeof data.targetId !== 'string') {
      return;
    }

    const hitResult = gameState.handleHit(socket.id, data.targetId, data.weaponType || 'pistol');
    if (!hitResult) {
      return;
    }

    if (hitResult.respawned) {
      io.emit('playerRespawn', {
        id: hitResult.targetId,
        position: hitResult.position,
        health: hitResult.health
      });
    } else {
      io.emit('playerDamaged', {
        id: hitResult.targetId,
        health: hitResult.health
      });
    }
  });
});

async function startServer() {
  await connectToDatabase();

  server.listen(process.env.PORT || 3000, () => {
    console.log('Servidor corriendo en http://localhost:3000');
  });
}

startServer();
