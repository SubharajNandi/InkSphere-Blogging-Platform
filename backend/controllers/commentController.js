// backend/controllers/commentController.js
// Matches every endpoint frontend/js/api.js defines under API.comments.
// Also keeps Post.commentsCount in sync on create/delete so the post
// listing/detail pages can show an accurate count without a separate query.

const Comment = require('../models/Comment');
const Post = require('../models/Post');

// GET /api/comments/post/:postId
async function listCommentsForPost(req, res, next) {
  try {
    const comments = await Comment.find({ post: req.params.postId })
      .populate('author', 'name avatarUrl')
      .sort('-createdAt');

    res.status(200).json({ comments: comments.map((c) => c.toPublicJSON()) });
  } catch (err) {
    next(err);
  }
}

// POST /api/comments/post/:postId  (auth required)
// body: { content, parentCommentId? }
async function createComment(req, res, next) {
  try {
    const { content, parentCommentId = null } = req.body;
    const { postId } = req.params;

    if (!content || !content.trim()) {
      res.status(400);
      throw new Error('Comment content is required.');
    }

    const post = await Post.findById(postId);
    if (!post) {
      res.status(404);
      throw new Error('Post not found.');
    }

    const comment = await Comment.create({
      content: content.trim(),
      post: postId,
      author: req.user._id,
      parentComment: parentCommentId || null,
    });

    post.commentsCount += 1;
    await post.save();

    await comment.populate('author', 'name avatarUrl');

    res.status(201).json({ comment: comment.toPublicJSON() });
  } catch (err) {
    next(err);
  }
}

// PUT /api/comments/:commentId  (auth required, owner only)
async function updateComment(req, res, next) {
  try {
    const comment = await Comment.findById(req.params.commentId);
    if (!comment) {
      res.status(404);
      throw new Error('Comment not found.');
    }

    if (comment.author.toString() !== req.user._id.toString()) {
      res.status(403);
      throw new Error('You can only edit your own comments.');
    }

    const { content } = req.body;
    if (!content || !content.trim()) {
      res.status(400);
      throw new Error('Comment content is required.');
    }

    comment.content = content.trim();
    await comment.save();
    await comment.populate('author', 'name avatarUrl');

    res.status(200).json({ comment: comment.toPublicJSON() });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/comments/:commentId  (auth required, owner or post owner)
async function deleteComment(req, res, next) {
  try {
    const comment = await Comment.findById(req.params.commentId);
    if (!comment) {
      res.status(404);
      throw new Error('Comment not found.');
    }

    const post = await Post.findById(comment.post);
    const isCommentOwner = comment.author.toString() === req.user._id.toString();
    const isPostOwner = post && post.author.toString() === req.user._id.toString();

    if (!isCommentOwner && !isPostOwner && req.user.role !== 'admin') {
      res.status(403);
      throw new Error('You can only delete your own comments.');
    }

    await comment.deleteOne();

    if (post && post.commentsCount > 0) {
      post.commentsCount -= 1;
      await post.save();
    }

    res.status(200).json({ message: 'Comment deleted.' });
  } catch (err) {
    next(err);
  }
}

module.exports = { listCommentsForPost, createComment, updateComment, deleteComment };
