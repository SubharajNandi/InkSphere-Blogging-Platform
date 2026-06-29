// backend/controllers/postController.js
// Matches every endpoint frontend/js/api.js defines under API.posts.

const Post = require('../models/Post');
const Comment = require('../models/Comment');

// GET /api/posts?page&limit&search&tag&author&sort&status
async function listPosts(req, res, next) {
  try {
    const {
      page = 1,
      limit = 9,
      search = '',
      tag = '',
      author = '',
      sort = '-createdAt',
      status = 'published',
    } = req.query;

    const query = {};

    // Public listings only show published posts unless a specific
    // status is requested (used by the dashboard/profile "all" views,
    // which call listMine instead, but this guards direct query use too).
    if (status) query.status = status;
    if (tag) query.tags = tag;
    if (author) query.author = author;
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { content: { $regex: search, $options: 'i' } },
        { tags: { $regex: search, $options: 'i' } },
      ];
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 9));
    const skip = (pageNum - 1) * limitNum;

    const [posts, total] = await Promise.all([
      Post.find(query)
        .populate('author', 'name avatarUrl')
        .sort(sort)
        .skip(skip)
        .limit(limitNum),
      Post.countDocuments(query),
    ]);

    res.status(200).json({
      posts: posts.map((p) => p.toPublicJSON()),
      total,
      page: pageNum,
      totalPages: Math.max(1, Math.ceil(total / limitNum)),
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/posts/:id
async function getPostById(req, res, next) {
  try {
    const post = await Post.findById(req.params.id).populate('author', 'name avatarUrl');
    if (!post) {
      res.status(404);
      throw new Error('Post not found.');
    }
    res.status(200).json({ post: post.toPublicJSON() });
  } catch (err) {
    next(err);
  }
}

// GET /api/posts/slug/:slug
async function getPostBySlug(req, res, next) {
  try {
    const post = await Post.findOne({ slug: req.params.slug }).populate('author', 'name avatarUrl');
    if (!post) {
      res.status(404);
      throw new Error('Post not found.');
    }
    res.status(200).json({ post: post.toPublicJSON() });
  } catch (err) {
    next(err);
  }
}

// POST /api/posts  (auth required)
// body: { title, content, tags, coverImage, status }
async function createPost(req, res, next) {
  try {
    const { title, content, tags = [], coverImage = null, status = 'draft' } = req.body;

    if (!title || !content) {
      res.status(400);
      throw new Error('Title and content are required.');
    }

    const post = await Post.create({
      title,
      content,
      tags,
      coverImage,
      status,
      author: req.user._id,
    });

    await post.populate('author', 'name avatarUrl');

    res.status(201).json({ post: post.toPublicJSON() });
  } catch (err) {
    next(err);
  }
}

// PUT /api/posts/:id  (auth required, owner only)
async function updatePost(req, res, next) {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      res.status(404);
      throw new Error('Post not found.');
    }

    if (post.author.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      res.status(403);
      throw new Error('You can only edit your own posts.');
    }

    const { title, content, tags, coverImage, status } = req.body;
    if (title !== undefined) post.title = title;
    if (content !== undefined) post.content = content;
    if (tags !== undefined) post.tags = tags;
    if (coverImage !== undefined) post.coverImage = coverImage;
    if (status !== undefined) post.status = status;

    await post.save();
    await post.populate('author', 'name avatarUrl');

    res.status(200).json({ post: post.toPublicJSON() });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/posts/:id  (auth required, owner only)
async function deletePost(req, res, next) {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      res.status(404);
      throw new Error('Post not found.');
    }

    if (post.author.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      res.status(403);
      throw new Error('You can only delete your own posts.');
    }

    await Comment.deleteMany({ post: post._id });
    await post.deleteOne();

    res.status(200).json({ message: 'Post deleted.' });
  } catch (err) {
    next(err);
  }
}

// GET /api/posts/me/all?sort  (auth required) — current user's own posts,
// any status (draft or published), used by the dashboard.
async function listMyPosts(req, res, next) {
  try {
    const { sort = '-createdAt' } = req.query;
    const posts = await Post.find({ author: req.user._id })
      .populate('author', 'name avatarUrl')
      .sort(sort);

    res.status(200).json({ posts: posts.map((p) => p.toPublicJSON()) });
  } catch (err) {
    next(err);
  }
}

// POST /api/posts/:id/like  (auth required) — toggle like
async function toggleLike(req, res, next) {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      res.status(404);
      throw new Error('Post not found.');
    }

    const userId = req.user._id.toString();
    const alreadyLiked = post.likes.some((id) => id.toString() === userId);

    if (alreadyLiked) {
      post.likes = post.likes.filter((id) => id.toString() !== userId);
    } else {
      post.likes.push(req.user._id);
    }

    await post.save();

    res.status(200).json({ liked: !alreadyLiked, likesCount: post.likes.length });
  } catch (err) {
    next(err);
  }
}

// POST /api/posts/upload  (auth required, multipart) — cover image
async function uploadCover(req, res, next) {
  try {
    if (!req.file) {
      res.status(400);
      throw new Error('No file was uploaded.');
    }
    const url = `/uploads/${req.file.filename}`;
    res.status(201).json({ url, coverImage: url });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listPosts,
  getPostById,
  getPostBySlug,
  createPost,
  updatePost,
  deletePost,
  listMyPosts,
  toggleLike,
  uploadCover,
};
