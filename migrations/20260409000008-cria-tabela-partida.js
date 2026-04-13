"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("partida", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      id_time_1: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "time",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      nome_time_1: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      sigla_time_1: {
        type: Sequelize.STRING(3),
        allowNull: false,
      },
      id_time_2: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "time",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      nome_time_2: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      sigla_time_2: {
        type: Sequelize.STRING(3),
        allowNull: false,
      },
      local: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      data: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      hora: {
        type: Sequelize.TIME,
        allowNull: false,
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
  },

  async down(queryInterface) {
    await queryInterface.dropTable("partida");
  },
};
