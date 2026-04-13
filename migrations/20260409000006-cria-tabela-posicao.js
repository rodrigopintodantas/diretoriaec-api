"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const now = new Date();
    const tabelas = await queryInterface.showAllTables();
    const nomesTabelas = tabelas.map((tabela) =>
      typeof tabela === "string" ? tabela : tabela.tableName,
    );
    const existePosicao = nomesTabelas.includes("posicao");

    if (!existePosicao) {
      await queryInterface.createTable("posicao", {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
        nome: {
          type: Sequelize.STRING,
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
    }

    const [posicoesExistentes] = await queryInterface.sequelize.query(
      "SELECT nome FROM posicao WHERE nome IN ('Goleiro', 'Defensor', 'Meio-Campista', 'Atacante')",
    );
    const nomesExistentes = new Set(posicoesExistentes.map((posicao) => posicao.nome));
    const posicoesParaInserir = ["Goleiro", "Defensor", "Meio-Campista", "Atacante"]
      .filter((nome) => !nomesExistentes.has(nome))
      .map((nome) => ({ nome, createdAt: now, updatedAt: now }));

    if (posicoesParaInserir.length > 0) {
      await queryInterface.bulkInsert("posicao", posicoesParaInserir, {});
    }

    const colunasUsuarioTime = await queryInterface.describeTable("usuario_time");
    if (!colunasUsuarioTime.id_posicao) {
      await queryInterface.addColumn("usuario_time", "id_posicao", {
        type: Sequelize.INTEGER,
        allowNull: true,
      });
    }

    const [constraints] = await queryInterface.sequelize.query(`
      SELECT constraint_name
      FROM information_schema.table_constraints
      WHERE table_schema = 'public'
        AND table_name = 'usuario_time'
        AND constraint_name = 'usuario_time_id_posicao_fk'
      LIMIT 1;
    `);

    if (!constraints.length) {
      await queryInterface.addConstraint("usuario_time", {
        fields: ["id_posicao"],
        type: "foreign key",
        name: "usuario_time_id_posicao_fk",
        references: {
          table: "posicao",
          field: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      });
    }
  },

  async down(queryInterface) {
    const [constraints] = await queryInterface.sequelize.query(`
      SELECT constraint_name
      FROM information_schema.table_constraints
      WHERE table_schema = 'public'
        AND table_name = 'usuario_time'
        AND constraint_name = 'usuario_time_id_posicao_fk'
      LIMIT 1;
    `);

    if (constraints.length) {
      await queryInterface.removeConstraint("usuario_time", "usuario_time_id_posicao_fk");
    }

    await queryInterface.dropTable("posicao");
  },
};
