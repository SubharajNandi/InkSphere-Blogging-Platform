// backend/server.js
// Entry point. Run with: node server.js (or npm run dev with nodemon)

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const postRoutes = require('./routes/postRoutes');
const commentRoutes = require('./routes/commentRoutes');
const userRoutes = require('./routes/userRoutes');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');

const app = express();

// ---- Core middleware ----
app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || 'http://localhost:5000',
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ---- Uploaded files (cover images, avatars) ----
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ---- API routes ----
app.use('/api/auth', authRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/users', userRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// ---- Serve the frontend as static files ----
// This lets the whole app run from one origin/port, so the frontend's
// default API base URL of '/api' just works with no extra config.
const frontendPath = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendPath));

// Redirect root to /pages/index.html (rather than sendFile) so that
// relative links inside the page — href="index.html", href="../css/..." —
// resolve against the real /pages/ URL instead of breaking at /.
app.get('/', (req, res) => {
  res.redirect('/pages/index.html');
});

// ---- Error handling (must be last) ----
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`InkSphere backend running on http://localhost:${PORT}`);
  });
});
