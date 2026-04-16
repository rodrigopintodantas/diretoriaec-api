"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const colunas = await queryInterface.describeTable("financeiro_cobranca");
    if (!colunas.grupo_cobranca_id) {
      await queryInterface.addColumn("financeiro_cobranca", "grupo_cobranca_id", {
        type: Sequelize.STRING(64),
        allowNull: true,
      });

      await queryInterface.sequelize.query(`
        UPDATE financeiro_cobranca
        SET grupo_cobranca_id = CONCAT('legacy-', id)
        WHERE grupo_cobranca_id IS NULL;
      `);

      await queryInterface.changeColumn("financeiro_cobranca", "grupo_cobranca_id", {
        type: Sequelize.STRING(64),
        allowNull: false,
      });
    }
  },

  async down(queryInterface) {
    const colunas = await queryInterface.describeTable("financeiro_cobranca");
    if (colunas.grupo_cobranca_id) {
      await queryInterface.removeColumn("financeiro_cobranca", "grupo_cobranca_id");
    }
  },
};

