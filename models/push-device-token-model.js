"use strict";

module.exports = (sequelize, DataTypes) => {
  const PushDeviceTokenModel = sequelize.define(
    "PushDeviceTokenModel",
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
      token: {
        type: DataTypes.TEXT,
        allowNull: false,
        unique: true,
      },
      plataforma: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: "android",
      },
    },
    { freezeTableName: true, tableName: "push_device_token", timestamps: true },
  );

  PushDeviceTokenModel.associate = function (models) {
    PushDeviceTokenModel.belongsTo(models.UsuarioModel, {
      foreignKey: "usuario_id",
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });
  };

  return PushDeviceTokenModel;
};
