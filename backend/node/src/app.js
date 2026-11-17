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
const apiRouter = require('./routes/api'); // health & generic routes

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
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Accept', 'Authorization'],
  }),
);
app.use(express.json());

// Mount API routers under /api
app.use('/api', apiRouter);
app.use('/api/auth', authRoutes);
app.use('/api/admin/users', adminUserRoutes);
app.use('/api/verification', verificationRoutes);

// 404 for unknown /api/* routes
app.use('/api', notFoundHandler);

// Global error handler (must be last)
app.use(errorHandler);

module.exports = app;
