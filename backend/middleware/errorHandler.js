module.exports = (err, req, res, next) => {
  console.error('Error:', err);
  
  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ 
      success: false,
      message: 'Invalid token',
      error: 'UNAUTHORIZED'
    });
  }
  
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ 
      success: false,
      message: 'Token expired',
      error: 'TOKEN_EXPIRED'
    });
  }
  
  // Handle usage limit errors
  if (err.limitExceeded) {
    return res.status(err.statusCode || 429).json({
      success: false,
      message: err.message,
      error: 'USAGE_LIMIT_EXCEEDED',
      limitExceeded: true,
      limitType: err.limitType,
      remaining: err.remaining,
      limit: err.limit,
      tier: err.tier
    });
  }

  // Handle validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      error: 'VALIDATION_ERROR',
      details: err.errors
    });
  }
  
  // Handle database errors
  if (err.code === '23505') { // Unique violation
    return res.status(409).json({
      success: false,
      message: 'Resource already exists',
      error: 'DUPLICATE_ENTRY',
      details: err.detail
    });
  }
  
  // Default error response
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || 'Something went wrong',
    error: statusCode === 500 ? 'INTERNAL_SERVER_ERROR' : 'BAD_REQUEST',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};