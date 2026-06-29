// backend/models/Post.js
// Matches the shape frontend/js/blog.js, post.js, and dashboard.js expect:
// { _id, title, content, tags, coverImage, status, author, likes, createdAt }
// `author` is populated with { id/_id, name, avatarUrl } before being sent.

const mongoose = require('mongoose');

function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const postSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: [180, 'Title must be 180 characters or fewer'],
    },
    slug: {
      type: String,
      unique: true,
      index: true,
    },
    content: {
      type: String,
      required: [true, 'Content is required'],
    },
    excerpt: {
      type: String,
      default: '',
      maxlength: 280,
    },
    coverImage: {
      type: String,
      default: null,
    },
    tags: {
      type: [String],
      default: [],
      validate: [(arr) => arr.length <= 5, 'You can add up to 5 tags'],
    },
    status: {
      type: String,
      enum: ['draft', 'published'],
      default: 'draft',
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    likes: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: 'User',
      default: [],
    },
    commentsCount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

postSchema.index({ title: 'text', content: 'text', tags: 'text' });

// Build a unique slug from the title before saving. If the title changes
// on an update, the slug is left as-is unless explicitly cleared, so
// published links don't break.
postSchema.pre('save', async function generateSlug(next) {
  if (!this.isModified('title') && this.slug) return next();

  const base = slugify(this.title);
  let candidate = base;
  let suffix = 1;

  // Ensure uniqueness by appending -2, -3, etc. on collision.
  // eslint-disable-next-line no-await-in-loop
  while (await mongoose.models.Post.findOne({ slug: candidate, _id: { $ne: this._id } })) {
    suffix += 1;
    candidate = `${base}-${suffix}`;
  }

  this.slug = candidate;
  next();
});

// Auto-derive a plain-text excerpt from content if one wasn't provided.
postSchema.pre('save', function deriveExcerpt(next) {
  if (this.excerpt) return next();
  const plain = (this.content || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  this.excerpt = plain.slice(0, 160);
  next();
});

postSchema.methods.toPublicJSON = function toPublicJSON() {
  const author =
    this.author && this.author.toPublicJSON
      ? { id: this.author._id.toString(), name: this.author.name, avatarUrl: this.author.avatarUrl }
      : this.author;

  return {
    _id: this._id.toString(),
    title: this.title,
    slug: this.slug,
    content: this.content,
    excerpt: this.excerpt,
    coverImage: this.coverImage,
    tags: this.tags,
    status: this.status,
    author,
    likes: this.likes.map((id) => id.toString()),
    likesCount: this.likes.length,
    commentsCount: this.commentsCount,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

module.exports = mongoose.model('Post', postSchema);
