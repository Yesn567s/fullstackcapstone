// src/app.js
// Express application setup – pulls in routes, middleware, and config
// ---------------------------------------------------------------
require('dotenv').config();

const express = require('express');
const cors = require('cors');

const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const adminUserRoutes = require('./routes/adminUsers');
const authRoutes = require('./routes/auth');
const verificationRoutes = require('./routes/verification');
const phoneRoutes = require('./routes/phone');
const cuttingRoutes = require('./routes/cutting');
const customerRoutes = require('./routes/customer');
const apiRouter = require('./routes/api'); // health & generic routes
const path = require('path');

const UPLOAD_ROOT = path.resolve(__dirname, '../../../uploads');

const app = express();

// Global middlewares
const allowedOrigins = (
  process.env.FRONTEND_ORIGINS ||
  'http://localhost:5500,http://127.0.0.1:5500'
)
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Origin tidak diizinkan.'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Accept', 'Authorization'],
  }),
);
app.use(express.json());

// Mount API routers under /api
app.use('/api', apiRouter);
app.use('/api/auth', authRoutes);
app.use('/api/admin/users', adminUserRoutes);
app.use('/api/verification', verificationRoutes);
app.use('/api/phone', phoneRoutes);
app.use('/api/cutting', cuttingRoutes);
app.use('/api/customer', customerRoutes);

// Static files: /uploads/... -> backend/uploads/...
app.use('/uploads', express.static(UPLOAD_ROOT, {
  fallthrough: true,
  maxAge: '1d',
}));

// 404 for unknown /api/* routes
app.use('/api', notFoundHandler);

// Global error handler (must be last)
app.use(errorHandler);

module.exports = app;
