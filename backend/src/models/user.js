const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  return sequelize.define('User', {
    id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
    firebase_uid: { type: DataTypes.STRING(128), unique: true },
    email: { type: DataTypes.STRING(255), allowNull: false, unique: true },
    display_name: { type: DataTypes.STRING(255) },
    barangay_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    role: {
      type: DataTypes.ENUM(
        'Administrator',
        'FinanceManager',
        'BarangayStaff',
        'Auditor',
        'BudgetOfficer',
        'ProcurementOfficer',
        'Requester',
        'DepartmentHead',
        'Guest'
      ),
      allowNull: false,
      defaultValue: 'BarangayStaff',
    },
    status: {
      type: DataTypes.ENUM('active', 'pending', 'rejected'),
      allowNull: false,
      defaultValue: 'active',
    },
    pending_role: { type: DataTypes.STRING(50), allowNull: true },
    profile_image_url: { type: DataTypes.STRING(1024), allowNull: true },
    department: { type: DataTypes.STRING(255) }
  }, {
    tableName: 'users',
    timestamps: true,
    underscored: true
  });
};
