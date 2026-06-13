async function auditLog(db, { userId, action, resource, resourceId, metadata = {} }) {
  await db.query(
    `INSERT INTO audit_logs (user_id, action, resource, resource_id, metadata)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId || null, action, resource, resourceId || null, metadata],
  );
}

module.exports = {
  auditLog,
};
