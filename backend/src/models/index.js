const Sequelize = require('sequelize');
const sequelize = require('../config/database');

const User = require('./user')(sequelize);
const Barangay = require('./barangay')(sequelize);
const ProcurementRequest = require('./procurement_request')(sequelize);
const ProcurementDocument = require('./procurement_document')(sequelize);
const AuditLog = require('./audit_log')(sequelize);
const Approval = require('./approval')(sequelize);
const BarangayBudget = require('./barangay_budget')(sequelize);
const Notification = require('./notification')(sequelize);
const UserBarangayAssignment = require('./user_barangay_assignment')(sequelize);

// associations
ProcurementRequest.hasMany(ProcurementDocument, { foreignKey: 'request_id', as: 'documents' });
ProcurementDocument.belongsTo(ProcurementRequest, { foreignKey: 'request_id', as: 'request' });

ProcurementRequest.hasMany(Approval, { foreignKey: 'request_id', as: 'approvals' });
Approval.belongsTo(ProcurementRequest, { foreignKey: 'request_id', as: 'request' });
User.hasMany(Approval, { foreignKey: 'approved_by', as: 'approvals' });
Approval.belongsTo(User, { foreignKey: 'approved_by', as: 'approver' });
Barangay.hasMany(User, { foreignKey: 'barangay_id', as: 'users' });
User.belongsTo(Barangay, { foreignKey: 'barangay_id', as: 'barangay' });
User.belongsToMany(Barangay, { through: UserBarangayAssignment, foreignKey: 'user_id', otherKey: 'barangay_id', as: 'assignedBarangays' });
Barangay.belongsToMany(User, { through: UserBarangayAssignment, foreignKey: 'barangay_id', otherKey: 'user_id', as: 'assignedBookkeepers' });
Barangay.hasMany(BarangayBudget, { foreignKey: 'barangay_id', as: 'budgets' });
BarangayBudget.belongsTo(Barangay, { foreignKey: 'barangay_id', as: 'barangay' });

// link audit logs to user identities
AuditLog.belongsTo(User, { foreignKey: 'user_id', as: 'user', onDelete: 'SET NULL', onUpdate: 'CASCADE' });

// link requests to users
User.hasMany(ProcurementRequest, { foreignKey: 'created_by', as: 'requests' });
ProcurementRequest.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });
User.hasMany(Notification, { foreignKey: 'recipient_id', as: 'notifications' });
Notification.belongsTo(User, { foreignKey: 'recipient_id', as: 'recipient' });

module.exports = {
  sequelize,
  Sequelize,
  User,
  Barangay,
  ProcurementRequest,
  ProcurementDocument,
  AuditLog,
  Approval,
  BarangayBudget,
  Notification,
  UserBarangayAssignment,
};
