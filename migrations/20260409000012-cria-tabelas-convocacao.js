"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("convocacao", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      partida_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "partida",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
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

    await queryInterface.addIndex("convocacao", ["partida_id", "time_id"], {
      unique: true,
      name: "convocacao_partida_id_time_id_uk",
    });

    await queryInterface.createTable("convocacao_atleta", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      convocacao_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "convocacao",
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
      presenca_status: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: "PENDENTE",
      },
      presenca_em: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      motivo_recusa: {
        type: Sequelize.TEXT,
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

    await queryInterface.addIndex("convocacao_atleta", ["convocacao_id", "usuario_time_id"], {
      unique: true,
      name: "convocacao_atleta_conv_usuario_time_uk",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("convocacao_atleta");
    await queryInterface.dropTable("convocacao");
  },
};
