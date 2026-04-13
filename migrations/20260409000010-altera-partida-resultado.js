"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const colunas = await queryInterface.describeTable("partida");

    if (!colunas.status) {
      await queryInterface.addColumn("partida", "status", {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: "AGENDADA",
      });
    }
    if (!colunas.placar_time_1) {
      await queryInterface.addColumn("partida", "placar_time_1", {
        type: Sequelize.INTEGER,
        allowNull: true,
      });
    }
    if (!colunas.placar_time_2) {
      await queryInterface.addColumn("partida", "placar_time_2", {
        type: Sequelize.INTEGER,
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const colunas = await queryInterface.describeTable("partida");
    if (colunas.placar_time_2) {
      await queryInterface.removeColumn("partida", "placar_time_2");
    }
    if (colunas.placar_time_1) {
      await queryInterface.removeColumn("partida", "placar_time_1");
    }
    if (colunas.status) {
      await queryInterface.removeColumn("partida", "status");
    }
  },
};
