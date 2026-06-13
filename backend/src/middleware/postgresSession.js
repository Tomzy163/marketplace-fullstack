const { getClient, setTenantContext } = require('../config/db');

async function setPostgresSession(req, res, next) {
  const client = await getClient();
  let finished = false;

  async function finish(commit) {
    if (finished) return;
    finished = true;

    try {
      await client.query(commit ? 'COMMIT' : 'ROLLBACK');
    } catch (error) {
      console.error('Failed to close PostgreSQL request transaction', error);
    } finally {
      client.release();
    }
  }

  try {
    await client.query('BEGIN');
    await setTenantContext(client, {
      userId: req.user?.id,
      sellerId: req.user?.sellerId,
      role: req.user?.role,
    });

    req.db = client;
    res.on('finish', () => finish(res.statusCode < 500));
    res.on('close', () => finish(false));
    return next();
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    client.release();
    return next(error);
  }
}

module.exports = setPostgresSession;
