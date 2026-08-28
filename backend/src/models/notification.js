const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('Notification', {
  id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
  recipient_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
  title: { type: DataTypes.STRING(255), allowNull: false },
  message: { type: DataTypes.STRING(1024), allowNull: false },
  link: { type: DataTypes.STRING(255), allowNull: true },
  is_read: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
}, {
  tableName: 'notifications',
  timestamps: true,
  underscored: true,
  indexes: [{ fields: ['recipient_id', 'is_read', 'created_at'] }],
});
