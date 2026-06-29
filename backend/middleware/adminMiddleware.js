// backend/middleware/adminMiddleware.js
// Gate routes to admin-only access. Must run after `protect` so
// req.user is already populated.

function adminOnly(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ message: 'Not authorized. Please sign in.' });
  }
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admins only.' });
  }
  next();
}

module.exports = { adminOnly };
