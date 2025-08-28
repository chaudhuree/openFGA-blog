// Load env and import libs
require('dotenv').config();
const jwt = require('jsonwebtoken');

// Helper to generate JWTs
function generateToken(user) {
  // Sign a JWT with user id and email
  return jwt.sign({ sub: user.id, email: user.email }, process.env.JWT_SECRET || 'secret', {
    expiresIn: '7d',
  });
}

// Middleware: require authentication
function requiredAuth(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing bearer token' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    req.user = { id: payload.sub, email: payload.email };
    return next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// Middleware: optional auth
function optionalAuth(req, _res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (token) {
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET || 'secret');
      req.user = { id: payload.sub, email: payload.email };
    } catch (_e) {}
  }
  return next();
}

module.exports = { requiredAuth, optionalAuth, generateToken };
