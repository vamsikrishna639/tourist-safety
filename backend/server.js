// Entry point of the backend: Express REST API (Socket.IO is attached to the same server in Stage 2).
const http = require('http');
const express = require('express');
const cors = require('cors');
const config = require('./config');
const connectDB = require('./db');
const { initSocket } = require('./socket');
const { getChainStatus } = require('./services/blockchain');

const app = express();

// Allow the React dev server to call the API (the Vite proxy normally makes this unnecessary)
app.use(cors({ origin: config.clientUrl }));
// Parse JSON request bodies into req.body
app.use(express.json());

// ---------- Routes ----------
app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date() }));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/tourists', require('./routes/tourist'));
app.use('/api/zones', require('./routes/zones'));
app.use('/api/incidents', require('./routes/incidents'));
app.use('/api/verify', require('./routes/verify'));

// Unknown route -> 404
app.use((req, res) => {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
});

// Central error handler. In Express 5, errors thrown inside async route handlers arrive here automatically.
app.use((err, req, res, next) => {
  if (err.name === 'ValidationError') {
    return res.status(400).json({ message: err.message }); // Mongoose schema validation failed
  }
  if (err.name === 'CastError') {
    return res.status(400).json({ message: `Invalid ${err.path}: ${err.value}` }); // e.g. a malformed id in the URL
  }
  if (err.code === 16755) {
    return res.status(400).json({ message: 'Invalid zone shape: the edges must not cross each other' }); // rejected by the 2dsphere index
  }
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'value';
    return res.status(409).json({ message: `${field} already exists` }); // unique index violated
  }
  if (err.status) {
    console.warn(`[error] ${req.method} ${req.originalUrl} -> ${err.status}: ${err.message}`); // expected, e.g. chain down
  } else {
    console.error(err); // unexpected bug: print the full stack trace
  }
  res.status(err.status || 500).json({ message: err.message || 'Server error' });
});

// One HTTP server shared by Express (REST) and Socket.IO (live push), both on port 5000
const server = http.createServer(app);
initSocket(server);

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[server] Port ${config.port} is already in use. Stop the other process or change PORT in backend/.env`);
    process.exit(1);
  }
  throw err;
});

connectDB()
  .then(() => {
    server.listen(config.port, () => {
      console.log(`[server] API running on http://localhost:${config.port}`);
      // The API also works without the chain (only Digital ID and integrity features need it), so just report it
      getChainStatus()
        .then((s) => console.log(`[chain] Contract ${s.address} on chain ${s.chainId}, block ${s.blockNumber}`))
        .catch((err) => console.warn(`[chain] WARNING: ${err.message}`));
    });
  })
  .catch((err) => {
    console.error('[db] Could not connect to MongoDB:', err.message);
    console.error('[db] Is mongod running? Check MONGO_URI in backend/.env');
    process.exit(1);
  });
