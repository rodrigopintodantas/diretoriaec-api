"use strict";

module.exports = (sequelize, DataTypes) => {
  const PartidaGolModel = sequelize.define(
    "PartidaGolModel",
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
      lado: {
        type: DataTypes.SMALLINT,
        allowNull: false,
        validate: {
          isIn: [[1, 2]],
        },
      },
      UsuarioModelId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: "usuario_id",
      },
      minuto: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      contra: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
    },
    { freezeTableName: true, tableName: "partida_gol", timestamps: true },
  );

  PartidaGolModel.associate = function (models) {
    PartidaGolModel.belongsTo(models.PartidaModel, {
      foreignKey: "partida_id",
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });
    PartidaGolModel.belongsTo(models.UsuarioModel, {
      foreignKey: "usuario_id",
      allowNull: true,
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    });
  };

  return PartidaGolModel;
};
