// Central configuration. Every other file reads settings from here, never from process.env directly.
const path = require('path');

// Node 20.12+ can load a .env file by itself, so we do not need the "dotenv" package.
try {
  process.loadEnvFile(path.join(__dirname, '.env'));
} catch {
  console.warn('[config] backend/.env not found, using default values');
}

module.exports = {
  port: Number(process.env.PORT) || 5000,
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/tourist_safety',
  jwtSecret: process.env.JWT_SECRET || 'dev-only-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1d',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  bcryptRounds: 10, // cost factor: 2^10 hashing rounds per password
  chainRpcUrl: process.env.CHAIN_RPC_URL || 'http://127.0.0.1:8545', // Hardhat node
  deploymentFile: path.join(__dirname, '..', 'blockchain', 'deployment.json'), // written by the deploy script
};
