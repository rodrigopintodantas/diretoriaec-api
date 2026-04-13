"use strict";

const bcrypt = require("bcryptjs");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("usuario", "senha_hash", {
      type: Sequelize.STRING(255),
      allowNull: true,
    });

    const [rows] = await queryInterface.sequelize.query(`SELECT id, login FROM usuario ORDER BY id`);
    const rounds = 10;
    for (const row of rows) {
      const pwd = String(row.login);
      const hash = bcrypt.hashSync(pwd, rounds);
      await queryInterface.sequelize.query(`UPDATE usuario SET senha_hash = :hash WHERE id = :id`, {
        replacements: { hash, id: row.id },
      });
    }

    await queryInterface.changeColumn("usuario", "senha_hash", {
      type: Sequelize.STRING(255),
      allowNull: false,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("usuario", "senha_hash");
  },
};
