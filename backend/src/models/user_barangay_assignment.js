const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('UserBarangayAssignment', {
  user_id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true },
  barangay_id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true },
}, { tableName: 'user_barangay_assignments', timestamps: true, underscored: true });
