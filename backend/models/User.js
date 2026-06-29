// backend/models/User.js
// Matches the shape the frontend expects from auth responses:
// { id, name, email, avatarUrl, bio, role, createdAt }
// Password is hashed with bcrypt before save and never returned in queries
// unless explicitly selected.

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [60, 'Name must be 60 characters or fewer'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Enter a valid email address'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false, // never returned by default on .find()/.findOne()
    },
    avatarUrl: {
      type: String,
      default: null,
    },
    bio: {
      type: String,
      default: '',
      maxlength: [280, 'Bio must be 280 characters or fewer'],
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
    followers: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: 'User',
      default: [],
    },
    following: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: 'User',
      default: [],
    },
  },
  { timestamps: true } // gives us createdAt / updatedAt
);

// Hash the password whenever it's set or changed.
userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Instance method: compare a plaintext password against the stored hash.
userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

// Shape the user object the way the frontend expects (id instead of _id,
// password/version key stripped) whenever this doc is JSON-serialized.
// `extra` lets controllers attach computed fields (postsCount, isFollowing)
// without polluting the schema itself.
userSchema.methods.toPublicJSON = function toPublicJSON(extra = {}) {
  return {
    id: this._id.toString(),
    name: this.name,
    email: this.email,
    avatarUrl: this.avatarUrl,
    bio: this.bio,
    role: this.role,
    followersCount: (this.followers || []).length,
    followingCount: (this.following || []).length,
    createdAt: this.createdAt,
    ...extra,
  };
};

module.exports = mongoose.model('User', userSchema);
