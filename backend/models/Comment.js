// backend/models/Comment.js
// Matches what frontend/js/post.js expects:
// { _id, content, author, createdAt }
// `author` is populated with { id/_id, name, avatarUrl } before being sent.

const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema(
  {
    content: {
      type: String,
      required: [true, 'Comment content is required'],
      trim: true,
      maxlength: [2000, 'Comments must be 2000 characters or fewer'],
    },
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Post',
      required: true,
      index: true,
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // Optional support for threaded replies. The frontend doesn't render
    // nested replies yet, but the field is here so it's easy to add later
    // without a schema migration.
    parentComment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Comment',
      default: null,
    },
  },
  { timestamps: true }
);

commentSchema.methods.toPublicJSON = function toPublicJSON() {
  const author =
    this.author && this.author.name !== undefined
      ? { id: this.author._id.toString(), name: this.author.name, avatarUrl: this.author.avatarUrl }
      : this.author;

  return {
    _id: this._id.toString(),
    content: this.content,
    post: this.post,
    author,
    parentComment: this.parentComment,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

module.exports = mongoose.model('Comment', commentSchema);
