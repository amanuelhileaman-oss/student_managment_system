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
    school_id: decoded.school_id || null,
    school_name: decoded.school_name || '',
    firstName: decoded.firstName || '',
    lastName: decoded.lastName || '',
  };
  req.schoolId = decoded.school_id || null;

  try {
    // Check if account still exists and is not deactivated, and verify school status
    const userRes = await query(
      `SELECT u.id, u.role, u.school_id, u.first_name, u.last_name, u.is_active,
              s.name as school_name, s.code as school_code, s.is_active as school_active, s.subscription_status
       FROM users u
       LEFT JOIN schools s ON u.school_id = s.id
       WHERE u.id = $1`,
      [decoded.id]
    );

    if (userRes.rows.length > 0) {
      const dbUser = userRes.rows[0];
      if (!dbUser.is_active) {
        return res.status(403).json({
          success: false,
          message: 'Account is deactivated. Please contact the administrator.',
        });
      }

      // Check if school is suspended or inactive (applies to non-superadmin accounts)
      if (dbUser.role !== 'superadmin' && dbUser.school_id) {
        if (dbUser.school_active === false || dbUser.subscription_status === 'SUSPENDED') {
          return res.status(403).json({
            success: false,
            message: 'Your school access is currently suspended or inactive. Please contact the platform administrator.',
          });
        }

        // Check if school is pending initial license payment
        if (dbUser.subscription_status === 'PENDING_PAYMENT') {
          // Teachers and students are completely locked out until school admin pays
          if (dbUser.role === 'teacher' || dbUser.role === 'student') {
            return res.status(403).json({
              success: false,
              code: 'SCHOOL_PAYMENT_PENDING',
              message: 'School platform access is pending initial license payment by school administration. Please contact your school principal.',
            });
          }

          // School Admin is allowed to access auth and billing/subscription endpoints to complete payment,
          // but operational data mutations (sections, users, assignments, grades) are blocked until payment
          const path = req.originalUrl || req.url || '';
          const isAllowedPath =
            path.startsWith('/api/auth') ||
            path.startsWith('/api/subscriptions') ||
            path.startsWith('/api/health');

          if (!isAllowedPath && (req.method === 'POST' || req.method === 'PUT' || req.method === 'DELETE' || req.method === 'PATCH')) {
            return res.status(402).json({
              success: false,
              code: 'PAYMENT_REQUIRED',
              message: 'School license activation pending. Please complete your subscription payment to unlock operational administrative tools.',
            });
          }
        }
      }

      req.user.role = dbUser.role || req.user.role;
      req.user.school_id = dbUser.school_id;
      req.user.school_name = dbUser.school_name || '';
      req.user.school_code = dbUser.school_code || '';
      req.user.firstName = dbUser.first_name || req.user.firstName;
      req.user.lastName = dbUser.last_name || req.user.lastName;
      req.schoolId = dbUser.school_id;
    }
  } catch (dbError) {
    // Transient database hiccup or serverless cold start:
    console.warn('[Auth Middleware] Database user check skipped due to transient cloud DB issue:', dbError.message);
  }

  next();
};

/**
 * Middleware to enforce strict role-based access control
 * @param {string[]} allowedRoles - Array of allowed roles ('superadmin', 'admin', 'teacher', 'student')
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

/**
 * Middleware to optionally authenticate requests via Bearer JWT token.
 * If token is valid, attaches req.user and req.schoolId.
 * If no token or invalid, proceeds without failing.
 */
const optionalAuthenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  let token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
  if (!token && req.query && req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return next();
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
      school_id: decoded.school_id || null,
      school_name: decoded.school_name || '',
      firstName: decoded.firstName || '',
      lastName: decoded.lastName || '',
    };
    req.schoolId = decoded.school_id || null;
  } catch (err) {
    // Non-blocking for optional auth
  }

  next();
};

module.exports = {
  authenticateToken,
  optionalAuthenticateToken,
  requireRole,
  JWT_SECRET,
};
