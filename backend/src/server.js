const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
require('dotenv').config();

const authRoutes = require('./routes/authRoutes');
const academicRoutes = require('./routes/academicRoutes');
const studentRoutes = require('./routes/studentRoutes');
const teacherRoutes = require('./routes/teacherRoutes');
const adminRoutes = require('./routes/adminRoutes');
const reportRoutes = require('./routes/reportRoutes');
const communicationRoutes = require('./routes/communicationRoutes');
const auditRoutes = require('./routes/auditRoutes');
const searchRoutes = require('./routes/searchRoutes');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);

    // Development mode allows localhost and local testing ports
    if (process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }

    // Production mode strictly checks allowed origins
    const configuredOrigins = (process.env.FRONTEND_URL || '')
      .split(',')
      .map((url) => url.trim().replace(/\/+$/, ''))
      .filter(Boolean);

    const allowedOrigins = [
      ...configuredOrigins,
      'http://localhost:5173',
      'http://localhost:3000',
    ];

    const cleanOrigin = origin.replace(/\/+$/, '');
    const isAllowed = allowedOrigins.some((allowed) => cleanOrigin === allowed || cleanOrigin.startsWith(allowed)) ||
      cleanOrigin.endsWith('.vercel.app');

    if (isAllowed) {
      return callback(null, true);
    }

    return callback(new Error(`CORS policy blocked access from origin: ${origin}`));
  },
  credentials: true,
}));
const path = require('path');
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    system: 'High School Management System API (PERN Stack)',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/academic', academicRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/teachers', teacherRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/communications', communicationRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/search', searchRoutes);

// Error Handling Middleware
app.use(errorHandler);

// Start server if run directly
if (require.main === module) {
  const { ensureAdminUser } = require('./controllers/authController');

  const server = app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`High School Management System Backend`);
    console.log(`Server running on: http://localhost:${PORT}`);
    console.log(`Database connected: PostgreSQL`);
    console.log(`====================================================`);

    ensureAdminUser().catch((err) => {
      console.warn('[Server Startup] Admin check skipped:', err.message);
    });
  });

  // Graceful shutdown to release the port cleanly
  const shutdown = () => {
    server.close(() => {
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

module.exports = app;
