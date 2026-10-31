// Opens the MongoDB connection. Used by server.js and seed/seed.js.
const mongoose = require('mongoose');
const config = require('./config');

async function connectDB() {
  // Fail after 5 seconds instead of hanging if mongod is not running
  await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 5000 });
  console.log(`[db] MongoDB connected: ${mongoose.connection.host}/${mongoose.connection.name}`);
}

module.exports = connectDB;
