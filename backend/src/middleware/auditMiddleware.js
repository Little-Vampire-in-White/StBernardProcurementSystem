const { AuditLog } = require('../models');

async function auditMiddleware(req, res, next) {
  // Attach a helper to create audit logs
  req.logAction = async function({ userId, action, targetTable, targetId, details }) {
    try {
      const ip = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
      await AuditLog.create({
        user_id: userId || null,
        actor_name: req.user?.display_name || null,
        actor_email: req.user?.email || null,
        action,
        target_table: targetTable || null,
        target_id: targetId || null,
        ip_address: ip,
        details: details || null,
      });
    } catch (err) {
      console.error('Failed to write audit log', err);
    }
  };
  next();
}

module.exports = auditMiddleware;
