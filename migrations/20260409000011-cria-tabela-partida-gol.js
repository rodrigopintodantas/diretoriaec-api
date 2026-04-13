"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const dialect = queryInterface.sequelize.getDialect();

    const tableExists = async () => {
      if (dialect === "postgres") {
        const [rows] = await queryInterface.sequelize.query(
          `SELECT EXISTS (
            SELECT FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = 'partida_gol'
          ) AS e;`,
        );
        return rows[0].e === true;
      }
      if (dialect === "sqlite") {
        const [rows] = await queryInterface.sequelize.query(
          `SELECT name FROM sqlite_master WHERE type='table' AND name='partida_gol' LIMIT 1;`,
        );
        return rows.length > 0;
      }
      const tables = await queryInterface.showAllTables();
      return tables.includes("partida_gol");
    };

    if (!(await tableExists())) {
      await queryInterface.createTable("partida_gol", {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
        partida_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: {
            model: "partida",
            key: "id",
          },
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
        },
        lado: {
          type: Sequelize.SMALLINT,
          allowNull: false,
        },
        usuario_id: {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: {
            model: "usuario",
            key: "id",
          },
          onUpdate: "CASCADE",
          onDelete: "SET NULL",
        },
        minuto: {
          type: Sequelize.INTEGER,
          allowNull: true,
        },
        contra: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false,
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

    if (dialect === "postgres") {
      await queryInterface.sequelize.query(`
        ALTER TABLE partida_gol DROP CONSTRAINT IF EXISTS partida_gol_lado_chk;
        ALTER TABLE partida_gol ADD CONSTRAINT partida_gol_lado_chk CHECK (lado IN (1, 2));
      `);
    } else {
      try {
        await queryInterface.sequelize.query(`
          ALTER TABLE partida_gol
          ADD CONSTRAINT partida_gol_lado_chk CHECK (lado IN (1, 2));
        `);
      } catch (err) {
        const msg = err && err.message ? String(err.message) : "";
        if (!/already exists|duplicate/i.test(msg)) {
          throw err;
        }
      }
    }
  },

  async down(queryInterface) {
    const dialect = queryInterface.sequelize.getDialect();
    if (dialect === "postgres") {
      await queryInterface.sequelize.query(`DROP TABLE IF EXISTS partida_gol CASCADE;`);
    } else {
      await queryInterface.dropTable("partida_gol");
    }
  },
};
