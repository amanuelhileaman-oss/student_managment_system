/**
 * Centralized error handler returning clear, structured JSON responses
 */
const errorHandler = (err, req, res, next) => {
  console.error('[SERVER ERROR]', err);

  const statusCode = err.statusCode || 500;
  let message = err.message || err.error?.message || err.sourceError?.message;
  if (!message && err[Symbol.for('kError')]) {
    message = err[Symbol.for('kError')].message;
  }
  if (!message) {
    message = 'An unexpected error occurred. Please try again.';
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

module.exports = errorHandler;
