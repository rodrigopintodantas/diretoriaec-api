"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("usuario", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      nome: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      login: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      data_nascimento: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },
      email: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      telefone: {
        type: Sequelize.STRING,
        allowNull: true,
      },
    });
  },

  async down(queryInterface) {
    const [constraints] = await queryInterface.sequelize.query(
      `SELECT 
        tc.table_name,
        tc.constraint_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.constraint_column_usage ccu 
        ON tc.constraint_name = ccu.constraint_name
        AND tc.table_schema = ccu.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND ccu.table_name = 'usuario'
        AND tc.table_schema = 'public';`,
    );

    for (const constraint of constraints) {
      try {
        await queryInterface.sequelize.query(
          `ALTER TABLE "${constraint.table_name}" DROP CONSTRAINT IF EXISTS "${constraint.constraint_name}";`,
        );
      } catch (error) {
        console.warn(
          `Aviso ao remover constraint ${constraint.constraint_name} de ${constraint.table_name}:`,
          error.message,
        );
      }
    }

    await queryInterface.dropTable("usuario");
  },
};
