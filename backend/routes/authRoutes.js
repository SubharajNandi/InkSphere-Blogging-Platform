// backend/routes/authRoutes.js
// Mounted at /api/auth in server.js

const express = require('express');
const router = express.Router();
const { register, login, me, logout } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

router.post('/register', register);
router.post('/login', login);
router.post('/logout', logout);
router.get('/me', protect, me);

module.exports = router;
