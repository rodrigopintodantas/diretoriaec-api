"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const [duplicadosLogin] = await queryInterface.sequelize.query(`
      SELECT LOWER(TRIM(login)) AS valor, COUNT(*) AS total
      FROM usuario
      GROUP BY LOWER(TRIM(login))
      HAVING COUNT(*) > 1
    `);
    if (duplicadosLogin.length) {
      throw new Error("Existem logins duplicados (ignorando maiúsculas/minúsculas).");
    }

    const [duplicadosEmail] = await queryInterface.sequelize.query(`
      SELECT LOWER(TRIM(email)) AS valor, COUNT(*) AS total
      FROM usuario
      WHERE email IS NOT NULL AND TRIM(email) <> ''
      GROUP BY LOWER(TRIM(email))
      HAVING COUNT(*) > 1
    `);
    if (duplicadosEmail.length) {
      throw new Error("Existem emails duplicados (ignorando maiúsculas/minúsculas).");
    }

    await queryInterface.sequelize.query(`
      UPDATE usuario
      SET email = NULL
      WHERE email IS NOT NULL AND TRIM(email) = ''
    `);

    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS usuario_login_lower_uk
      ON usuario (LOWER(login))
    `);

    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS usuario_email_lower_uk
      ON usuario (LOWER(email))
      WHERE email IS NOT NULL
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS usuario_email_lower_uk
    `);
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS usuario_login_lower_uk
    `);
  },
};
