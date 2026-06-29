// backend/controllers/userController.js
// Matches every endpoint frontend/js/api.js defines under API.users.

const User = require('../models/User');
const Post = require('../models/Post');
const Comment = require('../models/Comment');

// GET /api/users/:idOrUsername  (public)
// Frontend profile.js only ever passes an id, but this also accepts
// querying by exact name as a fallback for convenience.
async function getProfile(req, res, next) {
  try {
    const { idOrUsername } = req.params;
    const isValidObjectId = idOrUsername.match(/^[0-9a-fA-F]{24}$/);

    const user = isValidObjectId
      ? await User.findById(idOrUsername)
      : await User.findOne({ name: idOrUsername });

    if (!user) {
      res.status(404);
      throw new Error('User not found.');
    }

    const postsCount = await Post.countDocuments({ author: user._id, status: 'published' });

    let isFollowing = false;
    if (req.user) {
      isFollowing = user.followers.some((id) => id.toString() === req.user._id.toString());
    }

    res.status(200).json({ user: user.toPublicJSON({ postsCount, isFollowing }) });
  } catch (err) {
    next(err);
  }
}

// PUT /api/users/me  (auth required)
// body: { name, bio, avatarUrl }
async function updateMyProfile(req, res, next) {
  try {
    const { name, bio, avatarUrl } = req.body;

    if (name !== undefined) req.user.name = name;
    if (bio !== undefined) req.user.bio = bio;
    if (avatarUrl !== undefined) req.user.avatarUrl = avatarUrl;

    await req.user.save();

    res.status(200).json({ user: req.user.toPublicJSON() });
  } catch (err) {
    next(err);
  }
}

// PUT /api/users/me/password  (auth required)
// body: { currentPassword, newPassword }
async function changePassword(req, res, next) {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      res.status(400);
      throw new Error('Current and new password are both required.');
    }
    if (newPassword.length < 8) {
      res.status(400);
      throw new Error('New password must be at least 8 characters.');
    }

    // req.user came from the protect middleware without the password
    // field selected, so re-fetch it with the password included.
    const userWithPassword = await User.findById(req.user._id).select('+password');
    const isMatch = await userWithPassword.comparePassword(currentPassword);

    if (!isMatch) {
      res.status(401);
      throw new Error('Current password is incorrect.');
    }

    userWithPassword.password = newPassword;
    await userWithPassword.save();

    res.status(200).json({ message: 'Password updated.' });
  } catch (err) {
    next(err);
  }
}

// POST /api/users/me/avatar  (auth required, multipart)
async function uploadAvatar(req, res, next) {
  try {
    if (!req.file) {
      res.status(400);
      throw new Error('No file was uploaded.');
    }
    const url = `/uploads/${req.file.filename}`;

    req.user.avatarUrl = url;
    await req.user.save();

    res.status(201).json({ url, avatarUrl: url });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/users/me  (auth required) — deletes account + their content
async function deleteMyAccount(req, res, next) {
  try {
    const userId = req.user._id;

    const myPosts = await Post.find({ author: userId }).select('_id');
    const myPostIds = myPosts.map((p) => p._id);

    await Comment.deleteMany({ $or: [{ author: userId }, { post: { $in: myPostIds } }] });
    await Post.deleteMany({ author: userId });

    // Remove this user from other users' followers/following lists.
    await User.updateMany({}, { $pull: { followers: userId, following: userId } });

    await User.findByIdAndDelete(userId);

    res.status(200).json({ message: 'Account deleted.' });
  } catch (err) {
    next(err);
  }
}

// POST /api/users/:id/follow  (auth required)
async function followUser(req, res, next) {
  try {
    const targetId = req.params.id;

    if (targetId === req.user._id.toString()) {
      res.status(400);
      throw new Error('You can\u2019t follow yourself.');
    }

    const target = await User.findById(targetId);
    if (!target) {
      res.status(404);
      throw new Error('User not found.');
    }

    const alreadyFollowing = target.followers.some((id) => id.toString() === req.user._id.toString());
    if (!alreadyFollowing) {
      target.followers.push(req.user._id);
      await target.save();

      req.user.following.push(target._id);
      await req.user.save();
    }

    res.status(200).json({ following: true, followersCount: target.followers.length });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/users/:id/follow  (auth required)
async function unfollowUser(req, res, next) {
  try {
    const targetId = req.params.id;

    const target = await User.findById(targetId);
    if (!target) {
      res.status(404);
      throw new Error('User not found.');
    }

    target.followers = target.followers.filter((id) => id.toString() !== req.user._id.toString());
    await target.save();

    req.user.following = req.user.following.filter((id) => id.toString() !== target._id.toString());
    await req.user.save();

    res.status(200).json({ following: false, followersCount: target.followers.length });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getProfile,
  updateMyProfile,
  changePassword,
  uploadAvatar,
  deleteMyAccount,
  followUser,
  unfollowUser,
};
