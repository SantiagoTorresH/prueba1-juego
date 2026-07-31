const express = require('express');
const path = require('path');
const User = require('./models/user');
const Match = require('./models/match');
const MatchManager = require('./matchManager');
const GameState = require('./gameState');
const { hashPassword, comparePassword, signToken, verifyToken } = require('./auth');
const { applyMatchStats } = require('./stats');

function createApp({ matchManager = new MatchManager(), gameState = new GameState() } = {}) {
  const app = express();

  app.use(express.json());
  app.use(express.static(path.join(__dirname, '..', 'public')));

  app.post('/api/register', async (req, res) => {
    try {
      const { username, email, password } = req.body;
      if (!username || !email || !password) {
        return res.status(400).json({ error: 'Faltan datos obligatorios' });
      }

      const existingUser = await User.findOne({ $or: [{ username }, { email }] });
      if (existingUser) {
        return res.status(409).json({ error: 'El usuario o correo ya existe' });
      }

      const passwordHash = await hashPassword(password);
      const user = await User.create({ username, email, passwordHash });
      const token = signToken({ sub: user._id.toString(), username: user.username });

      return res.status(201).json({
        success: true,
        token,
        user: { id: user._id, username: user.username, email: user.email, stats: user.stats, skin: user.skin }
      });
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  });

  app.post('/api/login', async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ error: 'Faltan datos obligatorios' });
      }

      const normalizedLogin = String(username).trim();
      const user = await User.findOne({
        $or: [
          { username: normalizedLogin },
          { email: normalizedLogin.toLowerCase() }
        ]
      });

      if (!user) {
        return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
      }

      const isValidPassword = await comparePassword(password, user.passwordHash);
      if (!isValidPassword) {
        return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
      }

      const token = signToken({ sub: user._id.toString(), username: user.username });
      return res.json({
        success: true,
        token,
        user: { id: user._id, username: user.username, email: user.email, stats: user.stats, skin: user.skin }
      });
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  });

  app.get('/api/me', async (req, res) => {
    try {
      const authHeader = req.headers.authorization || '';
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

      if (!token) {
        return res.status(401).json({ error: 'Token requerido' });
      }

      const payload = verifyToken(token);
      const user = await User.findById(payload.sub).select('-passwordHash');
      if (!user) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }

      return res.json({ success: true, user });
    } catch (error) {
      return res.status(401).json({ error: 'Token inválido' });
    }
  });

  app.get('/api/users/:username', async (req, res) => {
    try {
      const user = await User.findOne({ username: req.params.username }).select('-passwordHash');
      if (!user) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }
      return res.json({ success: true, user });
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  });

  app.post('/api/matches', async (req, res) => {
    try {
      const match = await Match.create(req.body);

      if (Array.isArray(req.body.players) && req.body.players.length) {
        const updates = applyMatchStats(req.body);
        await Promise.all(updates.map(({ username, update }) => User.updateOne({ username }, update)));
      }

      return res.status(201).json({ success: true, match });
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  });

  app.post('/api/matches/finish', async (req, res) => {
    try {
      const { roomId, winnerId } = req.body;
      if (!roomId || !winnerId) {
        return res.status(400).json({ error: 'Datos de partida incompletos' });
      }

      const finishedMatch = matchManager.finishMatch(roomId, winnerId);
      if (!finishedMatch) {
        return res.status(404).json({ error: 'Partida no encontrada' });
      }

      const savedMatch = await matchManager.persistMatch(finishedMatch);
      return res.status(201).json({ success: true, match: savedMatch });
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  });

  app.post('/api/rooms', async (req, res) => {
    try {
      const { roomId } = req.body;
      if (!roomId) {
        return res.status(400).json({ error: 'Se requiere un roomId' });
      }

      let match = matchManager.getMatch(roomId);
      if (!match) {
        match = matchManager.createMatch(roomId, []);
      }

      return res.json({ success: true, roomId, state: matchManager.buildPersistedState(roomId), match });
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  });

  app.get('/api/rooms/:roomId/state', (req, res) => {
    const state = matchManager.buildPersistedState(req.params.roomId);
    if (!state) {
      return res.status(404).json({ error: 'Sala no encontrada' });
    }

    return res.json({ success: true, state });
  });

  app.post('/api/rooms/:roomId/players', (req, res) => {
    try {
      const { roomId } = req.params;
      const { player, action } = req.body;
      if (!player?.id) {
        return res.status(400).json({ error: 'Se requiere un jugador' });
      }

      const normalizedPlayer = {
        id: player.id,
        username: player.username || player.name || 'Jugador'
      };

      if (action === 'disconnect') {
        const disconnected = matchManager.markPlayerDisconnected(roomId, normalizedPlayer.id);
        return res.json({ success: true, state: matchManager.buildPersistedState(roomId), player: disconnected });
      }

      if (action === 'reconnect') {
        const reconnected = matchManager.reconnectPlayer(roomId, normalizedPlayer.id, normalizedPlayer);
        return res.json({ success: true, state: matchManager.buildPersistedState(roomId), player: reconnected });
      }

      const match = matchManager.ensureMatch(roomId, normalizedPlayer);
      return res.json({ success: true, state: matchManager.buildPersistedState(roomId), match });
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  });

  app.get('/api/leaderboard', async (_req, res) => {
    try {
      const users = await User.find({}).sort({ 'stats.wins': -1, 'stats.kills': -1 }).limit(10).select('-passwordHash');
      return res.json({ success: true, users });
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  });

  app.locals.gameState = gameState;
  app.locals.matchManager = matchManager;

  return app;
}

module.exports = { createApp };
