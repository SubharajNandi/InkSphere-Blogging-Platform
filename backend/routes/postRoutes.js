// backend/routes/postRoutes.js
// Mounted at /api/posts in server.js
//
// Order matters here: '/me/all' and '/upload' and '/slug/:slug' must be
// declared before '/:id', otherwise Express would treat "me", "upload",
// or "slug" as an :id value.

const express = require('express');
const router = express.Router();
const {
  listPosts,
  getPostById,
  getPostBySlug,
  createPost,
  updatePost,
  deletePost,
  listMyPosts,
  toggleLike,
  uploadCover,
} = require('../controllers/postController');
const { protect } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

router.get('/me/all', protect, listMyPosts);
router.post('/upload', protect, upload.single('cover'), uploadCover);
router.get('/slug/:slug', getPostBySlug);

router.get('/', listPosts);
router.post('/', protect, createPost);

router.get('/:id', getPostById);
router.put('/:id', protect, updatePost);
router.delete('/:id', protect, deletePost);
router.post('/:id/like', protect, toggleLike);

module.exports = router;
