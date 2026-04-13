"use strict";

module.exports = (sequelize, DataTypes) => {
  const PosicaoModel = sequelize.define(
    "PosicaoModel",
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
    },
    { freezeTableName: true, tableName: "posicao", timestamps: true },
  );

  PosicaoModel.associate = function (models) {
    PosicaoModel.hasMany(models.UsuarioTimeModel, {
      foreignKey: "id_posicao",
    });
  };

  return PosicaoModel;
};
