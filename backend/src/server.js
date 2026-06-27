const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const passport = require('passport');
const { env } = require('./config/env');
const { connectDB, query } = require('./config/db');
const configurePassport = require('./services/passport');
const registerSockets = require('./services/socketService');
const authenticateToken = require('./middleware/auth');
const setPostgresSession = require('./middleware/postgresSession');
const checkSubscription = require('./middleware/subscription');
const { checkRole } = require('./middleware/role');
const { apiRateLimiter } = require('./middleware/rateLimiter');
const asyncHandler = require('./middleware/asyncHandler');

const app = express();
const server = http.createServer(app);
const allowedOrigins = env.allowedOrigins;
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

if (env.TRUST_PROXY) {
  app.set('trust proxy', 1);
}

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(cors(corsOptions));
app.use(cookieParser());
app.use(passport.initialize());

app.use('/api/webhooks/paystack', express.raw({ type: 'application/json' }), require('./routes/webhooks'));

app.use(express.json({ limit: env.REQUEST_BODY_LIMIT }));
app.use(apiRateLimiter);

app.get(
  '/api/health',
  asyncHandler(async (_req, res) => {
    await query('SELECT 1 AS ok');
    res.json({ ok: true, service: 'marketplace-api', database: 'connected' });
  }),
);

app.use('/api/auth', require('./routes/auth'));
app.use('/api/plans', require('./routes/plans'));
app.use('/api/store', require('./routes/storefront'));

app.use(
  '/api/seller',
  authenticateToken,
  setPostgresSession,
  checkRole('seller'),
  checkSubscription,
  require('./routes/seller'),
);
app.use(
  '/api/subscriptions',
  authenticateToken,
  setPostgresSession,
  checkRole('seller'),
  require('./routes/subscriptions'),
);
app.use('/api/tickets', authenticateToken, setPostgresSession, require('./routes/tickets'));
app.use(
  '/api/admin',
  authenticateToken,
  setPostgresSession,
  checkRole('super_admin'),
  require('./routes/admin'),
);

app.get('/', (_req, res) => {
  res.json({ message: 'Marketplace API running' });
});

app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

app.use((error, _req, res, _next) => {
  console.error(error);

  if (error.code === '22P02') {
    return res.status(400).json({ message: 'Invalid identifier supplied' });
  }

  return res.status(error.status || 500).json({
    message: env.isProduction ? 'Internal server error' : error.message,
  });
});

const PORT = env.PORT;
if (env.NODE_ENV !== 'test') {
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
