"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const colunas = await queryInterface.describeTable("financeiro_cobranca");
    if (!colunas.notificacao_cobranca_em) {
      await queryInterface.addColumn("financeiro_cobranca", "notificacao_cobranca_em", {
        type: Sequelize.DATE,
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const colunas = await queryInterface.describeTable("financeiro_cobranca");
    if (colunas.notificacao_cobranca_em) {
      await queryInterface.removeColumn("financeiro_cobranca", "notificacao_cobranca_em");
    }
  },
};
