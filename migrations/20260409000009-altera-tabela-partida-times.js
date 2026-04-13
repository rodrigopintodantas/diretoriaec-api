"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const colunas = await queryInterface.describeTable("partida");

    if (!colunas.nome_time_1) {
      await queryInterface.addColumn("partida", "nome_time_1", {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }
    if (!colunas.sigla_time_1) {
      await queryInterface.addColumn("partida", "sigla_time_1", {
        type: Sequelize.STRING(3),
        allowNull: true,
      });
    }
    if (!colunas.nome_time_2) {
      await queryInterface.addColumn("partida", "nome_time_2", {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }
    if (!colunas.sigla_time_2) {
      await queryInterface.addColumn("partida", "sigla_time_2", {
        type: Sequelize.STRING(3),
        allowNull: true,
      });
    }

    await queryInterface.changeColumn("partida", "id_time_1", {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: "time",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });

    await queryInterface.sequelize.query(`
      UPDATE partida p
      SET nome_time_1 = COALESCE(
            p.nome_time_1,
            (SELECT t.nome FROM time t WHERE t.id = p.id_time_1),
            'Time 1'
          ),
          sigla_time_1 = COALESCE(
            p.sigla_time_1,
            UPPER(SUBSTRING(COALESCE((SELECT t.sigla FROM time t WHERE t.id = p.id_time_1), (SELECT t.nome FROM time t WHERE t.id = p.id_time_1), 'TIM') FROM 1 FOR 3))
          ),
          nome_time_2 = COALESCE(
            p.nome_time_2,
            (SELECT t.nome FROM time t WHERE t.id = p.id_time_2),
            'Adversário'
          ),
          sigla_time_2 = COALESCE(
            p.sigla_time_2,
            UPPER(SUBSTRING(COALESCE((SELECT t.sigla FROM time t WHERE t.id = p.id_time_2), (SELECT t.nome FROM time t WHERE t.id = p.id_time_2), 'ADV') FROM 1 FOR 3))
          );
    `);

    await queryInterface.sequelize.query(`
      UPDATE partida
      SET nome_time_1 = COALESCE(nome_time_1, 'Time 1'),
          sigla_time_1 = COALESCE(sigla_time_1, 'TIM'),
          nome_time_2 = COALESCE(nome_time_2, 'Adversário'),
          sigla_time_2 = COALESCE(sigla_time_2, 'ADV');
    `);

    await queryInterface.changeColumn("partida", "nome_time_1", {
      type: Sequelize.STRING,
      allowNull: false,
    });
    await queryInterface.changeColumn("partida", "sigla_time_1", {
      type: Sequelize.STRING(3),
      allowNull: false,
    });
    await queryInterface.changeColumn("partida", "nome_time_2", {
      type: Sequelize.STRING,
      allowNull: false,
    });
    await queryInterface.changeColumn("partida", "sigla_time_2", {
      type: Sequelize.STRING(3),
      allowNull: false,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn("partida", "id_time_1", {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: "time",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    });
    await queryInterface.removeColumn("partida", "sigla_time_2");
    await queryInterface.removeColumn("partida", "nome_time_2");
    await queryInterface.removeColumn("partida", "sigla_time_1");
    await queryInterface.removeColumn("partida", "nome_time_1");
  },
};
