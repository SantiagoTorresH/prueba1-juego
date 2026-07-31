const mongoose = require('mongoose');

const playerStateSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true
  },
  kills: {
    type: Number,
    default: 0
  },
  deaths: {
    type: Number,
    default: 0
  },
  alive: {
    type: Boolean,
    default: true
  },
  connected: {
    type: Boolean,
    default: true
  }
}, { _id: false });

const matchSchema = new mongoose.Schema({
  roomId: {
    type: String,
    required: true,
    default: 'default-room'
  },
  status: {
    type: String,
    required: true,
    default: 'active'
  },
  mode: {
    type: String,
    required: true,
    default: 'ffa'
  },
  winner: {
    type: String,
    default: null
  },
  players: [playerStateSchema],
  startedAt: {
    type: Date,
    default: Date.now
  },
  endedAt: {
    type: Date,
    default: null
  },
  result: {
    type: Object,
    default: {}
  }
});

module.exports = mongoose.model('Match', matchSchema);
