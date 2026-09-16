const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  return sequelize.define('ProcurementRequest', {
    id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
    request_uuid: { type: DataTypes.CHAR(36), allowNull: false },
    title: { type: DataTypes.STRING(255), allowNull: false },
    description: { type: DataTypes.TEXT },
    contract_type: { type: DataTypes.STRING(64) },
    amount: { type: DataTypes.DECIMAL(18,2), allowNull: false, defaultValue: 0 },
    barangay_id: { type: DataTypes.INTEGER.UNSIGNED },
    created_by: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
    status: { type: DataTypes.ENUM('Draft','Pending','InReview','Approved','Rejected','Disbursed'), defaultValue: 'Draft' }
  }, {
    tableName: 'procurement_requests',
    timestamps: true,
    underscored: true
  });
};
