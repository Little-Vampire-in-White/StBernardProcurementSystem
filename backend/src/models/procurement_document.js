const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  return sequelize.define('ProcurementDocument', {
    id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
    request_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
    doc_type: { type: DataTypes.STRING(255), allowNull: false },
    is_uploaded: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    file_path: { type: DataTypes.STRING(1024) },
    uploaded_by: { type: DataTypes.BIGINT.UNSIGNED },
    uploaded_at: { type: DataTypes.DATE }
  }, {
    tableName: 'procurement_documents',
    timestamps: false,
    underscored: true,
    indexes: [
      { unique: true, fields: ['request_id','doc_type'] }
    ]
  });
};
