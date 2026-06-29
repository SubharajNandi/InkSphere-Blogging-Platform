// backend/routes/commentRoutes.js
// Mounted at /api/comments in server.js

const express = require('express');
const router = express.Router();
const {
  listCommentsForPost,
  createComment,
  updateComment,
  deleteComment,
} = require('../controllers/commentController');
const { protect } = require('../middleware/authMiddleware');

router.get('/post/:postId', listCommentsForPost);
router.post('/post/:postId', protect, createComment);

router.put('/:commentId', protect, updateComment);
router.delete('/:commentId', protect, deleteComment);

module.exports = router;
