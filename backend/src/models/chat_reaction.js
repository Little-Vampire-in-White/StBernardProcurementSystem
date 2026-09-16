const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('ChatReaction', {
  id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
  message_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
  user_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
  emoji: { type: DataTypes.STRING(16), allowNull: false },
}, { tableName: 'chat_reactions', timestamps: true, underscored: true });
