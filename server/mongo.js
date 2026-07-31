const mongoose = require('mongoose');
require('dotenv').config();

async function connectToDatabase() {
  if (!process.env.MONGO_URI) {
    console.warn('MONGO_URI no está definido. La app seguirá funcionando sin base de datos persistente.');
    return null;
  }

  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Conectado a MongoDB Atlas');
    return mongoose.connection;
  } catch (error) {
    console.error('Error conectando a MongoDB Atlas:', error.message);
    return null;
  }
}

module.exports = { connectToDatabase };
