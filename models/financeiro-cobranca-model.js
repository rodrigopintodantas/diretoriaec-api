"use strict";

module.exports = (sequelize, DataTypes) => {
  const FinanceiroCobrancaModel = sequelize.define(
    "FinanceiroCobrancaModel",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      TimeModelId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "time_id",
      },
      UsuarioTimeModelId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "usuario_time_id",
      },
      valor: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
      },
      valorCobrado: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        field: "valor_cobrado",
      },
      grupoCobrancaId: {
        type: DataTypes.STRING(64),
        allowNull: false,
        field: "grupo_cobranca_id",
      },
      nome: {
        type: DataTypes.STRING(120),
        allowNull: false,
      },
      descricao: {
        type: DataTypes.STRING(500),
        allowNull: false,
      },
      status: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: "pendente",
      },
      externalReference: {
        type: DataTypes.STRING(64),
        allowNull: true,
        unique: true,
        field: "external_reference",
      },
      mpPreferenceId: {
        type: DataTypes.STRING(64),
        allowNull: true,
        field: "mp_preference_id",
      },
      mpPaymentId: {
        type: DataTypes.STRING(64),
        allowNull: true,
        field: "mp_payment_id",
      },
      initPoint: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: "init_point",
      },
      sandboxInitPoint: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: "sandbox_init_point",
      },
      payerEmail: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: "payer_email",
      },
    },
    { freezeTableName: true, tableName: "financeiro_cobranca", timestamps: true },
  );

  FinanceiroCobrancaModel.associate = function (models) {
    FinanceiroCobrancaModel.belongsTo(models.TimeModel, {
      foreignKey: "TimeModelId",
      allowNull: false,
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });
    FinanceiroCobrancaModel.belongsTo(models.UsuarioTimeModel, {
      foreignKey: "UsuarioTimeModelId",
      allowNull: false,
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });
  };

  return FinanceiroCobrancaModel;
};
