"use strict";

module.exports = (sequelize, DataTypes) => {
  const PushSubscriptionModel = sequelize.define(
    "PushSubscriptionModel",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      UsuarioModelId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "usuario_id",
      },
      endpoint: {
        type: DataTypes.TEXT,
        allowNull: false,
        unique: true,
      },
      auth: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      p256dh: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
    },
    { freezeTableName: true, tableName: "push_subscription", timestamps: true },
  );

  PushSubscriptionModel.associate = function (models) {
    PushSubscriptionModel.belongsTo(models.UsuarioModel, {
      foreignKey: "usuario_id",
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });
  };

  return PushSubscriptionModel;
};
