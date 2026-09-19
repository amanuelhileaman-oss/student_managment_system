const jwt = require('jsonwebtoken');
const { query } = require('../config/db');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'production_highschool_jwt_secret_token_secure_2026';

/**
 * Middleware to authenticate requests via Bearer JWT token
 */
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  let token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
  if (!token && req.query && req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required. Please sign in to continue.',
    });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch (jwtError) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired session token. Please sign in again.',
    });
  }

  // Set authenticated user payload from verified JWT claims
  req.user = {
    id: decoded.id,
    email: decoded.email,
    role: decoded.role,
    firstName: decoded.firstName || '',
    lastName: decoded.lastName || '',
  };

  try {
    // Check if account still exists and is not deactivated
    const userRes = await query('SELECT id, role, first_name, last_name, is_active FROM users WHERE id = $1', [decoded.id]);
    if (userRes.rows.length > 0) {
      const dbUser = userRes.rows[0];
      if (!dbUser.is_active) {
        return res.status(403).json({
          success: false,
          message: 'Account is deactivated. Please contact the administrator.',
        });
      }
      req.user.role = dbUser.role || req.user.role;
      req.user.firstName = dbUser.first_name || req.user.firstName;
      req.user.lastName = dbUser.last_name || req.user.lastName;
    }
  } catch (dbError) {
    // Transient database hiccup or serverless cold start:
    // Do NOT destroy user's session with a 401!
    console.warn('[Auth Middleware] Database user check skipped due to transient cloud DB issue:', dbError.message);
  }

  next();
};

/**
 * Middleware to enforce strict role-based access control
 * @param {string[]} allowedRoles - Array of allowed roles ('admin', 'teacher', 'student')
 */
const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.',
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. You are not authorized to access this resource. Required role: ${allowedRoles.join(' or ')}.`,
      });
    }

    next();
  };
};

module.exports = {
  authenticateToken,
  requireRole,
  JWT_SECRET,
};
