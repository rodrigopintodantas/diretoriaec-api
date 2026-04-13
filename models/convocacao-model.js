"use strict";

module.exports = (sequelize, DataTypes) => {
  const ConvocacaoModel = sequelize.define(
    "ConvocacaoModel",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      partida_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "partida_id",
      },
      time_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "time_id",
      },
    },
    { freezeTableName: true, tableName: "convocacao", timestamps: true },
  );

  ConvocacaoModel.associate = function (models) {
    ConvocacaoModel.belongsTo(models.PartidaModel, {
      foreignKey: "partida_id",
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });
    ConvocacaoModel.belongsTo(models.TimeModel, {
      foreignKey: "time_id",
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });
    ConvocacaoModel.hasMany(models.ConvocacaoAtletaModel, {
      foreignKey: "convocacao_id",
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });
  };

  return ConvocacaoModel;
};
