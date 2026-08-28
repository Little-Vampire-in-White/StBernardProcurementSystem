const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const AuditLog = sequelize.define('AuditLog', {
    id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
    timestamp: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    user_id: { type: DataTypes.BIGINT.UNSIGNED },
    actor_name: { type: DataTypes.STRING(255), allowNull: true },
    actor_email: { type: DataTypes.STRING(255), allowNull: true },
    action: { type: DataTypes.STRING(255), allowNull: false },
    target_table: { type: DataTypes.STRING(255) },
    target_id: { type: DataTypes.BIGINT.UNSIGNED },
    ip_address: { type: DataTypes.STRING(64) },
    details: { type: DataTypes.JSON }
  }, {
    tableName: 'audit_logs',
    timestamps: false,
    underscored: true
  });

  // Prevent updates or deletes at ORM level
  AuditLog.beforeUpdate(() => {
    throw new Error('audit_logs is append-only: updates are forbidden');
  });
  AuditLog.beforeDestroy(() => {
    throw new Error('audit_logs is append-only: deletes are forbidden');
  });
  AuditLog.beforeBulkUpdate(() => {
    throw new Error('audit_logs is append-only: bulk updates are forbidden');
  });
  AuditLog.beforeBulkDestroy(() => {
    throw new Error('audit_logs is append-only: bulk deletes are forbidden');
  });

  return AuditLog;
};
