// backend/controllers/authController.js
// Handles POST /api/auth/register, POST /api/auth/login,
// GET /api/auth/me, POST /api/auth/logout.
//
// Response shapes match what frontend/js/auth.js expects:
//   register/login -> { token, user: {...} }
//   me             -> { user: {...} }

const jwt = require('jsonwebtoken');
const User = require('../models/User');

function signToken(userId) {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

// POST /api/auth/register
// body: { name, email, password }
async function register(req, res, next) {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      res.status(400);
      throw new Error('Name, email, and password are all required.');
    }

    if (password.length < 8) {
      res.status(400);
      throw new Error('Password must be at least 8 characters.');
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      res.status(409);
      throw new Error('An account with that email already exists.');
    }

    const user = await User.create({ name, email, password });
    const token = signToken(user._id);

    res.status(201).json({ token, user: user.toPublicJSON() });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/login
// body: { email, password }
async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400);
      throw new Error('Email and password are required.');
    }

    // .select('+password') because the schema excludes it by default
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

    if (!user) {
      res.status(401);
      throw new Error('No account found with that email.');
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      res.status(401);
      throw new Error('Incorrect password.');
    }

    const token = signToken(user._id);

    res.status(200).json({ token, user: user.toPublicJSON() });
  } catch (err) {
    next(err);
  }
}

// GET /api/auth/me  (requires auth middleware -> req.user)
async function me(req, res, next) {
  try {
    res.status(200).json({ user: req.user.toPublicJSON() });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/logout
// JWTs are stateless, so there's nothing to invalidate server-side
// unless you add a token blocklist. This endpoint exists so the
// frontend has something to call; it just acknowledges the request.
async function logout(req, res) {
  res.status(200).json({ message: 'Signed out.' });
}

module.exports = { register, login, me, logout };
