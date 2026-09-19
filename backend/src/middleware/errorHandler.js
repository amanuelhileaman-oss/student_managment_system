const multer = require('multer');

/**
 * Centralized error handler returning clear, structured JSON responses
 */
const errorHandler = (err, req, res, next) => {
  console.error('[SERVER ERROR]', err);

  let statusCode = err.statusCode || err.status || 500;
  let message = err.message || err.error?.message || err.sourceError?.message;

  if (err instanceof multer.MulterError) {
    statusCode = 400;
    if (err.code === 'LIMIT_FILE_SIZE') {
      message = 'The uploaded file is too large. Please select a document within the allowed size limit.';
    } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      message = `Unexpected file field "${err.field}". Please verify the form submission format.`;
    } else {
      message = `Upload error: ${err.message}`;
    }
  } else if (err.type === 'entity.too.large') {
    statusCode = 413;
    message = 'The submitted document data exceeds the maximum allowed payload size. Please compress or select a smaller file.';
  } else if (message && (
    message.includes('File format') ||
    message.includes('not supported') ||
    message.includes('CORS policy')
  )) {
    statusCode = 400;
  }

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
