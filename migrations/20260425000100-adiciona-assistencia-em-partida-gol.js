"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("partida_gol", "assistencia_usuario_id", {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: "usuario",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("partida_gol", "assistencia_usuario_id");
  },
};
