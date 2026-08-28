const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  return sequelize.define('Approval', {
    id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
    request_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
    approved_by: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
    action: { type: DataTypes.ENUM('Approved', 'Rejected'), allowNull: false },
    remark: { type: DataTypes.TEXT },
    approved_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  }, {
    tableName: 'approvals',
    timestamps: false,
    underscored: true,
  });
};
