"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const colunas = await queryInterface.describeTable("financeiro_cobranca");
    if (!colunas.valor_cobrado) {
      await queryInterface.addColumn("financeiro_cobranca", "valor_cobrado", {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: true,
      });
      await queryInterface.sequelize.query(`
        UPDATE financeiro_cobranca
        SET valor_cobrado = valor
        WHERE valor_cobrado IS NULL;
      `);
      await queryInterface.changeColumn("financeiro_cobranca", "valor_cobrado", {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: false,
      });
    }
  },

  async down(queryInterface) {
    const colunas = await queryInterface.describeTable("financeiro_cobranca");
    if (colunas.valor_cobrado) {
      await queryInterface.removeColumn("financeiro_cobranca", "valor_cobrado");
    }
  },
};

