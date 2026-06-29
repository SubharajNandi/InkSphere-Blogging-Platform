// backend/routes/userRoutes.js
// Mounted at /api/users in server.js
//
// Order matters: '/me' routes must be declared before '/:idOrUsername',
// otherwise Express would treat "me" as a profile id to look up.

const express = require('express');
const router = express.Router();
const {
  getProfile,
  updateMyProfile,
  changePassword,
  uploadAvatar,
  deleteMyAccount,
  followUser,
  unfollowUser,
} = require('../controllers/userController');
const { protect, optionalAuth } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

router.put('/me', protect, updateMyProfile);
router.delete('/me', protect, deleteMyAccount);
router.put('/me/password', protect, changePassword);
router.post('/me/avatar', protect, upload.single('avatar'), uploadAvatar);

router.get('/:idOrUsername', optionalAuth, getProfile);

router.post('/:id/follow', protect, followUser);
router.delete('/:id/follow', protect, unfollowUser);

module.exports = router;
