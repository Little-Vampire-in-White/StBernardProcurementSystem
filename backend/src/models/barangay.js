const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  return sequelize.define('Barangay', {
    id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING(255), allowNull: false, unique: true },
    seal_url: { type: DataTypes.STRING(1024), allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  }, {
    tableName: 'barangays',
    timestamps: true,
    underscored: true,
  });
};
