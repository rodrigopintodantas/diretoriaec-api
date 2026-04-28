"use strict";

module.exports = (sequelize, DataTypes) => {
  const TimeModel = sequelize.define(
    "TimeModel",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      nome: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      sigla: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      descricao: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
    },
    { freezeTableName: true, tableName: "time", timestamps: true },
  );

  TimeModel.associate = function (models) {
    TimeModel.hasMany(models.UsuarioTimeModel, {
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });
    TimeModel.hasMany(models.PartidaModel, {
      as: "PartidasComoTime1",
      foreignKey: "id_time_1",
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });
    TimeModel.hasMany(models.PartidaModel, {
      as: "PartidasComoTime2",
      foreignKey: "id_time_2",
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    });
    TimeModel.hasMany(models.ConvocacaoModel, {
      foreignKey: "time_id",
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });
    TimeModel.hasOne(models.TimeMercadoPagoOauthModel, {
      foreignKey: "TimeModelId",
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });
    TimeModel.hasMany(models.FinanceiroCobrancaModel, {
      foreignKey: "TimeModelId",
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });
  };

  return TimeModel;
};
