"use strict";

module.exports = (sequelize, DataTypes) => {
  const UsuarioTimeModel = sequelize.define(
    "UsuarioTimeModel",
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
      TimeModelId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "time_id",
      },
      PapelModelId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "papel_id",
      },
      id_posicao: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: "id_posicao",
      },
    },
    { freezeTableName: true, tableName: "usuario_time", timestamps: true },
  );

  UsuarioTimeModel.associate = function (models) {
    UsuarioTimeModel.belongsTo(models.UsuarioModel, {
      allowNull: false,
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });
    UsuarioTimeModel.belongsTo(models.TimeModel, {
      allowNull: false,
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });
    UsuarioTimeModel.belongsTo(models.PapelModel, {
      allowNull: false,
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });
    UsuarioTimeModel.belongsTo(models.PosicaoModel, {
      foreignKey: "id_posicao",
      allowNull: true,
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    });
    UsuarioTimeModel.hasMany(models.ConvocacaoAtletaModel, {
      foreignKey: "usuario_time_id",
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });
  };

  return UsuarioTimeModel;
};
