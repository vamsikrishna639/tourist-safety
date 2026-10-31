// Socket.IO: pushes live updates from the server to browsers (REST is request/response, sockets are push).
const { Server } = require('socket.io');
const config = require('./config');
const { verifyToken } = require('./middleware/auth');

let io = null;

function initSocket(httpServer) {
  io = new Server(httpServer, { cors: { origin: config.clientUrl } });

  // Runs once per connection, before "connection". Same JWT check as the REST routes.
  io.use((socket, next) => {
    try {
      socket.user = verifyToken(socket.handshake.auth?.token); // { id, role }
      next();
    } catch {
      next(new Error('Unauthorized: invalid or missing token'));
    }
  });

  io.on('connection', (socket) => {
    const { id, role } = socket.user;
    // Rooms decide who receives what:
    //   "admins"   -> every admin/police dashboard
    //   "user:<id>" -> only that tourist's own browser tabs
    socket.join(`user:${id}`);
    if (role === 'admin') socket.join('admins');
    console.log(`[socket] ${role} ${id} connected`);

    socket.on('disconnect', () => console.log(`[socket] ${role} ${id} disconnected`));
  });
}

function emitToAdmins(event, data) {
  if (io) io.to('admins').emit(event, data);
}

function emitToUser(userId, event, data) {
  if (io) io.to(`user:${userId}`).emit(event, data);
}

function emitToAll(event, data) {
  if (io) io.emit(event, data);
}

module.exports = { initSocket, emitToAdmins, emitToUser, emitToAll };
