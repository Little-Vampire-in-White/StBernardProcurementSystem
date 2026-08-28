const { AuditLog, User } = require('../models');
const { Op } = require('sequelize');

async function listAuditLogs(req, res) {
  try {
    const { user_id, action, target_table, start_date, end_date, limit = 100 } = req.query;

    const where = {};
    if (user_id) where.user_id = user_id;
    if (action) where.action = { [Op.like]: `%${action}%` };
    if (target_table) where.target_table = target_table;
    if (start_date || end_date) {
      where.timestamp = {};
      if (start_date) where.timestamp[Op.gte] = new Date(start_date);
      if (end_date) where.timestamp[Op.lte] = new Date(end_date);
    }

    const logs = await AuditLog.findAll({
      where,
      include: [{ model: User, as: 'user', attributes: ['id', 'display_name', 'email', 'role'] }],
      order: [['timestamp', 'DESC']],
      limit: Math.min(Number(limit) || 100, 500),
    });

    return res.json({ ok: true, auditLogs: logs });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'internal' });
  }
}

module.exports = { listAuditLogs };
