"use strict";

module.exports = (sequelize, DataTypes) => {
  const ConvocacaoAtletaModel = sequelize.define(
    "ConvocacaoAtletaModel",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      convocacao_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "convocacao_id",
      },
      usuario_time_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "usuario_time_id",
      },
      presenca_status: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: "PENDENTE",
      },
      presenca_em: {
        type: DataTypes.DATE,
        allowNull: true,
        field: "presenca_em",
      },
      motivo_recusa: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: "motivo_recusa",
      },
    },
    { freezeTableName: true, tableName: "convocacao_atleta", timestamps: true },
  );

  ConvocacaoAtletaModel.associate = function (models) {
    ConvocacaoAtletaModel.belongsTo(models.ConvocacaoModel, {
      foreignKey: "convocacao_id",
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });
    ConvocacaoAtletaModel.belongsTo(models.UsuarioTimeModel, {
      foreignKey: "usuario_time_id",
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });
  };

  return ConvocacaoAtletaModel;
};
