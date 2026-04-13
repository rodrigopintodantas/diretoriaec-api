"use strict";

/** Senhas: a migration `20260409000014-adiciona-senha-hash-usuario` define o hash (bcrypt) usando o próprio login como senha inicial. */

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const now = new Date();

    await queryInterface.bulkInsert(
      "papel",
      [
        {
          nome: "Administrador",
          dashboard: "/admin",
          createdAt: now,
          updatedAt: now,
        },
        {
          nome: "Atleta",
          dashboard: "/atleta",
          createdAt: now,
          updatedAt: now,
        },
      ],
      {},
    );

    await queryInterface.bulkInsert(
      "time",
      [
        {
          nome: "Morada FC",
          sigla: "MFC",
          createdAt: now,
          updatedAt: now,
        },
      ],
      {},
    );

    await queryInterface.bulkInsert(
      "usuario",
      [
        {
          nome: "Administrador",
          login: "admin",
          data_nascimento: null,
          email: "admin@base.local",
          telefone: null,
        },
      ],
      {},
    );

    const [usuarios] = await queryInterface.sequelize.query(
      "SELECT id FROM usuario WHERE login = 'admin' LIMIT 1",
    );
    const [papeis] = await queryInterface.sequelize.query(
      "SELECT id, nome FROM papel WHERE nome IN ('Administrador', 'Atleta')",
    );
    const [times] = await queryInterface.sequelize.query(
      "SELECT id FROM time WHERE nome = 'Morada FC' ORDER BY id LIMIT 1",
    );

    if (!usuarios.length || !papeis.length || !times.length) {
      throw new Error("Migration seed: usuario, papel ou time não encontrados após insert.");
    }

    const usuarioId = usuarios[0].id;
    const timeId = times[0].id;
    const papelAdmin = papeis.find((p) => p.nome === "Administrador");
    if (!papelAdmin) {
      throw new Error("Migration seed: papel Administrador não encontrado.");
    }

    await queryInterface.bulkInsert(
      "usuario_time",
      [
        {
          usuario_id: usuarioId,
          time_id: timeId,
          papel_id: papelAdmin.id,
          id_posicao: null,
          createdAt: now,
          updatedAt: now,
        },
      ],
      {},
    );
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DELETE FROM usuario_time
      WHERE usuario_id IN (SELECT id FROM usuario WHERE login = 'admin');
    `);
    await queryInterface.sequelize.query(`DELETE FROM usuario WHERE login = 'admin';`);
    await queryInterface.sequelize.query(`DELETE FROM time WHERE nome = 'Morada FC';`);
    await queryInterface.sequelize.query(`
      DELETE FROM papel WHERE nome IN ('Administrador', 'Atleta');
    `);
  },
};
