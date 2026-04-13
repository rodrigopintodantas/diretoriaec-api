"use strict";

module.exports = (sequelize, DataTypes) => {
  const UsuarioModel = sequelize.define(
    "UsuarioModel",
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
      login: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      dataNascimento: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        field: "data_nascimento",
      },
      email: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      telefone: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      senha_hash: {
        type: DataTypes.STRING(255),
        allowNull: false,
        field: "senha_hash",
      },
    },
    {
      freezeTableName: true,
      tableName: "usuario",
      timestamps: false,
      defaultScope: {
        attributes: { exclude: ["senha_hash"] },
      },
    },
  );

  UsuarioModel.associate = function (models) {
    UsuarioModel.hasMany(models.UsuarioTimeModel, {
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });
    UsuarioModel.hasMany(models.PartidaGolModel, {
      foreignKey: "usuario_id",
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    });
    UsuarioModel.hasMany(models.PushSubscriptionModel, {
      foreignKey: "usuario_id",
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });
  };

  return UsuarioModel;
};
