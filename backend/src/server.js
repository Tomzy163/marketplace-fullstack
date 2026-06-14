require('dotenv').config({ path:'../.env'});
console.log('DATABASE_URL:', process.env.DATABASE_URL);
// ... rest of your code
const express = require('express');
const pool = require('./config/db');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const passport = require('passport');
const { connectDB } = require('./config/db');
const configurePassport = require('./services/passport');
const registerSockets = require('./services/socketService');
const authenticateToken = require('./middleware/auth');
const setPostgresSession = require('./middleware/postgresSession');
const checkSubscription = require('./middleware/subscription');
const { checkRole } = require('./middleware/role');
const { apiRateLimiter } = require('./middleware/rateLimiter');

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

app.use('/api/webhooks/paystack', express.raw({ type: 'application/json' }), require('./routes/webhooks'));

app.use(express.json({ limit: '1mb' }));
app.use(apiRateLimiter);

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'marketplace-api' });
});

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

app.use(express.json()); // lets Express read JSON from Postman

// app.post('/register', async (req, res) => {
//   const { email, password } = req.body;
//   const bcrypt = require('bcrypt');
  
//   try {
//     const hashedPassword = await bcrypt.hash(password, 10);
//     const result = await pool.query(
//       'INSERT INTO users (email, password) VALUES ($1, $2) RETURNING id, email',
//       [email, hashedPassword]
//     );
//     res.status(201).json(result.rows[0]);
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// });
app.get('/register', async (req, res) => {
  const { email, password } = req.query; // <-- use query instead of body
  const bcrypt = require('bcrypt');
  
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (email, password) VALUES ($1, $2) RETURNING id, email',
      [email, hashedPassword]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.json({ error: err.message });
  }
});
// Test route
app.get('/', (req, res) => {
  res.json({ message: 'Marketplace API Running 🚀' });
});

// Keep your 404 handler at the very bottom
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

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
pool.query('SELECT NOW()', (err, res) => {
  console.log('DB Time:', res.rows[0]);
});
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
