"use strict";

module.exports = (sequelize, DataTypes) => {
  const PartidaModel = sequelize.define(
    "PartidaModel",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      id_time_1: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: "id_time_1",
      },
      nome_time_1: {
        type: DataTypes.STRING,
        allowNull: false,
        field: "nome_time_1",
      },
      sigla_time_1: {
        type: DataTypes.STRING,
        allowNull: false,
        field: "sigla_time_1",
      },
      id_time_2: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: "id_time_2",
      },
      nome_time_2: {
        type: DataTypes.STRING,
        allowNull: false,
        field: "nome_time_2",
      },
      sigla_time_2: {
        type: DataTypes.STRING,
        allowNull: false,
        field: "sigla_time_2",
      },
      local: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      data: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      hora: {
        type: DataTypes.TIME,
        allowNull: false,
      },
      status: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: "AGENDADA",
      },
      placar_time_1: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: "placar_time_1",
      },
      placar_time_2: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: "placar_time_2",
      },
    },
    { freezeTableName: true, tableName: "partida", timestamps: true },
  );

  PartidaModel.associate = function (models) {
    PartidaModel.belongsTo(models.TimeModel, {
      as: "TimeMandante",
      foreignKey: "id_time_1",
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });
    PartidaModel.belongsTo(models.TimeModel, {
      as: "TimeVisitante",
      foreignKey: "id_time_2",
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    });
    PartidaModel.hasMany(models.PartidaGolModel, {
      foreignKey: "partida_id",
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });
    PartidaModel.hasMany(models.ConvocacaoModel, {
      foreignKey: "partida_id",
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });
  };

  return PartidaModel;
};
