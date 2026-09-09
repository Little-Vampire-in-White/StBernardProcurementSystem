const { Op } = require('sequelize');
const { User, Barangay } = require('../models');
const { ROLES, BARANGAY_SCOPED_ROLES } = require('../constants/roles');

const GLOBAL_LIMITS = {
  [ROLES.BARANGAY_BOOKKEEPER]: 6,
  [ROLES.SK_BOOKKEEPER]: 1,
  [ROLES.MUNICIPAL_ACCOUNTANT]: 1,
};
const ONE_PER_BARANGAY = new Set([
  ROLES.BARANGAY_TREASURER,
  ROLES.SK_TREASURER,
  ROLES.SK_CHAIRMAN,
]);

async function assertRoleCapacity({ role, barangayId, status = 'pending', excludeUserId = null, transaction }) {
  if (status === 'rejected') return;
  if (BARANGAY_SCOPED_ROLES.has(role) && !barangayId) {
    const error = new Error('barangay_required_for_role');
    error.statusCode = 400;
    throw error;
  }
  if (barangayId && !(await Barangay.findByPk(barangayId, { transaction }))) {
    const error = new Error('invalid_barangay');
    error.statusCode = 400;
    throw error;
  }

  const where = { role, status: { [Op.ne]: 'rejected' } };
  if (excludeUserId) where.id = { [Op.ne]: excludeUserId };
  if (ONE_PER_BARANGAY.has(role)) where.barangay_id = barangayId;

  const limit = ONE_PER_BARANGAY.has(role) ? 1 : GLOBAL_LIMITS[role];
  if (!limit) return;
  if ((await User.count({ where, transaction })) >= limit) {
    const error = new Error('role_capacity_reached');
    error.statusCode = 409;
    error.details = { role, barangay_id: barangayId || null, limit };
    throw error;
  }
}

module.exports = { assertRoleCapacity, GLOBAL_LIMITS, ONE_PER_BARANGAY };
