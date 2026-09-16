const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('ChatMessage', {
  id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
  room_type: { type: DataTypes.ENUM('municipality', 'barangay'), allowNull: false },
  barangay_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  sender_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
  reply_to_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
  body: { type: DataTypes.STRING(2000), allowNull: false },
}, { tableName: 'chat_messages', timestamps: true, createdAt: 'created_at', updatedAt: false, underscored: true });
