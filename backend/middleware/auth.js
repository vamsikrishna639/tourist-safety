// JWT helpers and Express middleware for authentication (who are you?) and authorization (what may you do?).
const jwt = require('jsonwebtoken');
const config = require('../config');

// The token holds only the user id and role, no personal data
function signToken(user) {
  return jwt.sign({ id: user._id.toString(), role: user.role }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  });
}

// Throws if the token is fake, tampered with or expired.
// Shared by the REST middleware below and the Socket.IO handshake (Stage 2).
function verifyToken(token) {
  return jwt.verify(token, config.jwtSecret);
}

// Requires header "Authorization: Bearer <token>" and puts { id, role } on req.user
function requireAuth(req, res, next) {
  const [scheme, token] = (req.headers.authorization || '').split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ message: 'Login required (missing token)' });
  }
  try {
    req.user = verifyToken(token);
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token, please log in again' });
  }
}

// Use after requireAuth, e.g. requireRole('admin')
function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'You do not have permission for this action' });
    }
    next();
  };
}

module.exports = { signToken, verifyToken, requireAuth, requireRole };
