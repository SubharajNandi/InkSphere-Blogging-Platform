// backend/config/db.js
// Establishes the Mongoose connection to MongoDB.
// Connection string comes from .env (MONGO_URI) so it's never hardcoded.

const mongoose = require('mongoose');

async function connectDB() {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/inksphere';

  try {
    await mongoose.connect(uri);
    console.log(`MongoDB connected: ${mongoose.connection.host}/${mongoose.connection.name}`);
  } catch (err) {
    console.error('MongoDB connection failed:', err.message);
    // Exit the process — there's no useful way to run the API without a DB.
    process.exit(1);
  }
}

module.exports = connectDB;
