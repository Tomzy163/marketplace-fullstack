const { Pool } = require('pg');
const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.warn('DATABASE_URL is not set. PostgreSQL queries will fail until it is configured.');
}

const pool = new Pool({
  connectionString,
  ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : undefined,
});

pool.on('error', (error) => {
  console.error('Unexpected PostgreSQL pool error', error);
});

const query = (text, params = []) => pool.query(text, params);
const getClient = () => pool.connect();

async function setTenantContext(client, { userId, sellerId, role } = {}) {
  await client.query(
    `SELECT
      set_config('app.current_user_id', COALESCE($1::text, ''), true),
      set_config('app.current_seller_id', COALESCE($2::text, ''), true),
      set_config('app.current_role', COALESCE($3::text, 'anonymous'), true)`,
    [userId || '', sellerId || '', role || 'anonymous'],
  );
}

async function connectDB() {
  await query('SELECT 1 AS ok');
  console.log('PostgreSQL connected');
}

module.exports = {
  pool,
  query,
  getClient,
  setTenantContext,
  connectDB,
};
