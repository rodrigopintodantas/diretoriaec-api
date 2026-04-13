"use strict";

module.exports = (sequelize, DataTypes) => {
  const TimeMercadoPagoOauthModel = sequelize.define(
    "TimeMercadoPagoOauthModel",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      TimeModelId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        unique: true,
        field: "time_id",
      },
      mpUserId: {
        type: DataTypes.STRING(64),
        allowNull: false,
        field: "mp_user_id",
      },
      accessToken: {
        type: DataTypes.TEXT,
        allowNull: false,
        field: "access_token",
      },
      refreshToken: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: "refresh_token",
      },
      tokenExpiresAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: "token_expires_at",
      },
      publicKey: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: "public_key",
      },
    },
    { freezeTableName: true, tableName: "time_mercado_pago_oauth", timestamps: true },
  );

  TimeMercadoPagoOauthModel.associate = function (models) {
    TimeMercadoPagoOauthModel.belongsTo(models.TimeModel, {
      foreignKey: "TimeModelId",
      allowNull: false,
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });
  };

  return TimeMercadoPagoOauthModel;
};
