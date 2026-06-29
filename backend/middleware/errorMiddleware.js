// backend/middleware/errorMiddleware.js
// Centralized error handling. Controllers can throw or call next(err)
// and this turns it into the { message } shape the frontend's
// api.js expects to read off a failed response.

function notFound(req, res, next) {
  const err = new Error(`Route not found: ${req.method} ${req.originalUrl}`);
  err.status = 404;
  next(err);
}

function errorHandler(err, req, res, next) {
  let status = err.status || res.statusCode;
  if (!status || status < 400) status = 500;

  let message = err.message || 'Something went wrong on the server.';

  // Mongoose validation errors -> readable single message
  if (err.name === 'ValidationError') {
    status = 400;
    message = Object.values(err.errors).map((e) => e.message).join(' ');
  }

  // Mongoose duplicate key error (e.g. email already registered)
  if (err.code === 11000) {
    status = 409;
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    message = `That ${field} is already in use.`;
  }

  // Malformed ObjectId passed to a findById-style query
  if (err.name === 'CastError') {
    status = 400;
    message = 'Invalid id provided.';
  }

  res.status(status).json({
    message,
    ...(process.env.NODE_ENV === 'development' ? { stack: err.stack } : {}),
  });
}

module.exports = { notFound, errorHandler };
