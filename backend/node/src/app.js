// src/app.js
// Express application setup – pulls in routes, middleware, and config
// ---------------------------------------------------------------
require('dotenv').config();

const express = require('express');
const cors = require('cors');

const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const adminDashboardRoutes = require('./routes/adminDashboard');
const adminDeliveryRoutes = require('./routes/adminDeliveries');
const adminInvoiceRoutes = require('./routes/adminInvoices');
const adminOrderRoutes = require('./routes/adminOrders');
const adminProductionRoutes = require('./routes/adminProduction');
const adminRmaRoutes = require('./routes/adminRma');
const adminUserRoutes = require('./routes/adminUsers');
const authRoutes = require('./routes/auth');
const verificationRoutes = require('./routes/verification');
const phoneRoutes = require('./routes/phone');
const cuttingRoutes = require('./routes/cutting');
const customerRoutes = require('./routes/customer');
const operatorRoutes = require('./routes/operator');
const apiRouter = require('./routes/api'); // health & generic routes
const { UPLOAD_ROOT } = require('./middleware/upload');

const app = express();

// Global middlewares
const allowedOrigins = (
  process.env.FRONTEND_ORIGINS ||
  'http://localhost:5500,http://127.0.0.1:5500'
)
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

function isLocalDevelopmentOrigin(origin) {
  if (process.env.NODE_ENV !== 'development') {
    return false;
  }

  try {
    const url = new URL(origin);
    return (
      url.protocol === 'http:' &&
      ['localhost', '127.0.0.1'].includes(url.hostname)
    );
  } catch {
    return false;
  }
}

app.use(
  cors({
    origin(origin, callback) {
      if (
        !origin ||
        allowedOrigins.includes(origin) ||
        isLocalDevelopmentOrigin(origin)
      ) {
        return callback(null, true);
      }
      const error = new Error('Origin tidak diizinkan.');
      error.status = 403;
      return callback(error);
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
app.use('/api/admin/dashboard', adminDashboardRoutes);
app.use('/api/admin/deliveries', adminDeliveryRoutes);
app.use('/api/admin/invoices', adminInvoiceRoutes);
app.use('/api/admin/orders', adminOrderRoutes);
app.use('/api/admin/production', adminProductionRoutes);
app.use('/api/admin/rma', adminRmaRoutes);
app.use('/api/admin/users', adminUserRoutes);
app.use('/api/verification', verificationRoutes);
app.use('/api/phone', phoneRoutes);
app.use('/api/cutting', cuttingRoutes);
app.use('/api/customer', customerRoutes);
app.use('/api/operator', operatorRoutes);

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
