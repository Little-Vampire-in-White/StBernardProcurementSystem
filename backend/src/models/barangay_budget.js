const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('BarangayBudget', {
  id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
  barangay_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  fiscal_year: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  amount: { type: DataTypes.DECIMAL(18, 2), allowNull: false, defaultValue: 0 },
  created_by: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
}, {
  tableName: 'barangay_budgets',
  timestamps: true,
  underscored: true,
  indexes: [{ unique: true, fields: ['barangay_id', 'fiscal_year'] }],
});
