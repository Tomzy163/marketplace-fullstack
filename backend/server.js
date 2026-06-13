require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const passport = require('passport');
const { connectDB } = require('./src/config/db/migrations/001_multi_tenant_schema.sql');
const configurePassport = require('./src/services/passport');
const registerSockets = require('./src/services/socketService');
const authenticateToken = require('./src/middleware/auth');
const setPostgresSession = require('./src/middleware/postgresSession');
const checkSubscription = require('./src/middleware/subscription');
const { checkRole } = require('./src/middleware/role');
const { apiRateLimiter } = require('./src/middleware/rateLimiter');

const app = express();
const server = http.createServer(app);
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim());
const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('CORS origin not allowed'));
  },
  credentials: true,
};
const io = new Server(server, { cors: corsOptions });

configurePassport();
registerSockets(io);

app.use(helmet());
app.use(cors(corsOptions));
app.use(cookieParser());
app.use(passport.initialize());

app.use('/api/webhooks/paystack', express.raw({ type: 'application/json' }), require('./src/routes/webhooks'));

app.use(express.json({ limit: '1mb' }));
app.use(apiRateLimiter);

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'marketplace-api' });
});

app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/plans', require('./src/routes/plans'));
app.use('/api/store', require('./src/routes/storefront'));

app.use(
  '/api/seller',
  authenticateToken,
  setPostgresSession,
  checkRole('seller'),
  checkSubscription,
  require('./src/routes/seller'),
);
app.use(
  '/api/subscriptions',
  authenticateToken,
  setPostgresSession,
  checkRole('seller'),
  require('./src/routes/subscriptions'),
);
app.use('/api/tickets', authenticateToken, setPostgresSession, require('./src/routes/tickets'));
app.use(
  '/api/admin',
  authenticateToken,
  setPostgresSession,
  checkRole('super_admin'),
  require('./src/routes/admin'),
);

app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(error.status || 500).json({
    message: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message,
  });
});

const PORT = process.env.PORT || 5000;
if (process.env.NODE_ENV !== 'test') {
  connectDB()
    .then(() => {
      server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
    })
    .catch((error) => {
      console.error('Failed to start server', error);
      process.exit(1);
    });
}

module.exports = { app, server };
