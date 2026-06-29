// backend/middleware/authMiddleware.js
// Verifies the `Authorization: Bearer <token>` header the frontend's
// api.js attaches to every authenticated request, then loads the
// matching user onto req.user for downstream controllers.

const jwt = require('jsonwebtoken');
const User = require('../models/User');

async function protect(req, res, next) {
  let token;

  const authHeader = req.headers.authorization || '';
  if (authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ message: 'Not authorized. Please sign in.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({ message: 'This account no longer exists.' });
    }

    req.user = user; // full Mongoose doc, available to controllers
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Session expired or invalid. Please sign in again.' });
  }
}

// Like `protect`, but never rejects the request — used on public routes
// (e.g. GET /api/users/:id) that personalize their response (isFollowing)
// when a valid token is present, but work fine for anonymous visitors too.
async function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) return next();

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (user) req.user = user;
  } catch (err) {
    // Invalid/expired token on a public route: proceed as anonymous
    // rather than blocking the request.
  }
  next();
}

module.exports = { protect, optionalAuth };
