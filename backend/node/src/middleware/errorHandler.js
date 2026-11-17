// src/middleware/errorHandler.js
// Centralized error handling middleware
// ---------------------------------------------------------------
function notFoundHandler(req, res) {
  res.status(404).json({ success: false, message: 'Endpoint not found' });
}

function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  console.error('Unexpected error:', err);
  const status = err.status || 500;
  const message = err.message || 'Unexpected server error';
  res.status(status).json({ success: false, message });
}

module.exports = { notFoundHandler, errorHandler };
