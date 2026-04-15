"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("financeiro_cobranca", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      time_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "time",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      usuario_time_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "usuario_time",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      valor: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: false,
      },
      descricao: {
        type: Sequelize.STRING(500),
        allowNull: false,
      },
      status: {
        type: Sequelize.STRING(32),
        allowNull: false,
        defaultValue: "pendente",
      },
      external_reference: {
        type: Sequelize.STRING(64),
        allowNull: true,
        unique: true,
      },
      mp_preference_id: {
        type: Sequelize.STRING(64),
        allowNull: true,
      },
      mp_payment_id: {
        type: Sequelize.STRING(64),
        allowNull: true,
      },
      init_point: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      sandbox_init_point: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      payer_email: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    });

    await queryInterface.addIndex("financeiro_cobranca", ["time_id"], {
      name: "financeiro_cobranca_time_id_idx",
    });
    await queryInterface.addIndex("financeiro_cobranca", ["status"], {
      name: "financeiro_cobranca_status_idx",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("financeiro_cobranca");
  },
};
