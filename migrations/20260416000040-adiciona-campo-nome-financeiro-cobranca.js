"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const colunas = await queryInterface.describeTable("financeiro_cobranca");
    if (!colunas.nome) {
      await queryInterface.addColumn("financeiro_cobranca", "nome", {
        type: Sequelize.STRING(120),
        allowNull: true,
      });
      await queryInterface.sequelize.query(`
        UPDATE financeiro_cobranca
        SET nome = COALESCE(NULLIF(TRIM(descricao), ''), 'Cobrança');
      `);
      await queryInterface.changeColumn("financeiro_cobranca", "nome", {
        type: Sequelize.STRING(120),
        allowNull: false,
      });
    }
  },

  async down(queryInterface) {
    const colunas = await queryInterface.describeTable("financeiro_cobranca");
    if (colunas.nome) {
      await queryInterface.removeColumn("financeiro_cobranca", "nome");
    }
  },
};

