"use strict";

/** Senhas dos atletas: hash (bcrypt) definido em `20260409000014-adiciona-senha-hash-usuario` (senha inicial = login). */

const ATLETAS = [
  { nome: "Lucas", login: "Lucas", posicao: "Goleiro" },
  { nome: "Diego", login: "Diego", posicao: "Goleiro" },
  { nome: "Everton", login: "Everton", posicao: "Defensor" },
  { nome: "Bruno", login: "Bruno", posicao: "Defensor" },
  { nome: "Caio", login: "Caio", posicao: "Defensor" },
  { nome: "Thiago", login: "Thiago", posicao: "Defensor" },
  { nome: "Rafael", login: "Rafael", posicao: "Meio-Campista" },
  { nome: "Vinicius", login: "Vinicius", posicao: "Meio-Campista" },
  { nome: "Alan", login: "Alan", posicao: "Meio-Campista" },
  { nome: "Rodrigo", login: "Rodrigo", posicao: "Atacante" },
  { nome: "Gabriel", login: "Gabriel", posicao: "Atacante" },
  { nome: "Pedro", login: "Pedro", posicao: "Atacante" },
];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const listaLogins = ATLETAS.map((atleta) => `'${atleta.login}'`).join(",");
    const [usuariosExistentes] = await queryInterface.sequelize.query(`
      SELECT login
      FROM usuario
      WHERE login IN (${listaLogins})
    `);
    const loginsExistentes = new Set(usuariosExistentes.map((usuario) => usuario.login));
    const usuariosParaInserir = ATLETAS.filter((atleta) => !loginsExistentes.has(atleta.login));

    if (usuariosParaInserir.length > 0) {
      await queryInterface.bulkInsert(
        "usuario",
        usuariosParaInserir.map((atleta) => ({
          nome: atleta.nome,
          login: atleta.login,
          data_nascimento: null,
          email: null,
          telefone: null,
        })),
        {},
      );
    }

    let times = [];
    const [timesMorada] = await queryInterface.sequelize.query(
      "SELECT id FROM time WHERE nome = 'Morada FC' ORDER BY id LIMIT 1",
    );
    if (timesMorada.length) {
      times = timesMorada;
    } else {
      const [timesLegado] = await queryInterface.sequelize.query(
        "SELECT id FROM time WHERE nome = 'Time Base' ORDER BY id LIMIT 1",
      );
      if (timesLegado.length) {
        times = timesLegado;
      } else {
        const [timesFallback] = await queryInterface.sequelize.query(
          "SELECT id FROM time ORDER BY id ASC LIMIT 1",
        );
        times = timesFallback;
      }
    }

    const [papeis] = await queryInterface.sequelize.query("SELECT id FROM papel WHERE nome = 'Atleta' LIMIT 1");
    const [posicoes] = await queryInterface.sequelize.query(
      "SELECT id, nome FROM posicao WHERE nome IN ('Goleiro', 'Defensor', 'Meio-Campista', 'Atacante')",
    );
    const [usuarios] = await queryInterface.sequelize.query(`
      SELECT id, login
      FROM usuario
      WHERE login IN (${listaLogins})
    `);

    if (!times.length || !papeis.length || posicoes.length !== 4 || usuarios.length !== ATLETAS.length) {
      throw new Error("Migration seed atletas: time, papel, posições ou usuários não encontrados.");
    }

    const timeId = times[0].id;
    const papelAtletaId = papeis[0].id;
    const posicaoPorNome = new Map(posicoes.map((posicao) => [posicao.nome, posicao.id]));
    const usuarioPorLogin = new Map(usuarios.map((usuario) => [usuario.login, usuario.id]));

    const usuarioIds = ATLETAS.map((atleta) => usuarioPorLogin.get(atleta.login)).join(",");
    const [vinculosExistentes] = await queryInterface.sequelize.query(`
      SELECT usuario_id
      FROM usuario_time
      WHERE time_id = ${timeId}
        AND usuario_id IN (${usuarioIds})
    `);
    const idsJaVinculados = new Set(vinculosExistentes.map((vinculo) => Number(vinculo.usuario_id)));
    const vinculosParaInserir = ATLETAS.filter(
      (atleta) => !idsJaVinculados.has(Number(usuarioPorLogin.get(atleta.login))),
    ).map((atleta) => ({
      usuario_id: usuarioPorLogin.get(atleta.login),
      time_id: timeId,
      papel_id: papelAtletaId,
      id_posicao: posicaoPorNome.get(atleta.posicao),
      createdAt: now,
      updatedAt: now,
    }));

    if (vinculosParaInserir.length > 0) {
      await queryInterface.bulkInsert("usuario_time", vinculosParaInserir, {});
    }
  },

  async down(queryInterface) {
    const listaLogins = ATLETAS.map((atleta) => `'${atleta.login}'`).join(",");

    await queryInterface.sequelize.query(`
      DELETE FROM usuario_time
      WHERE usuario_id IN (
        SELECT id
        FROM usuario
        WHERE login IN (${listaLogins})
      );
    `);

    await queryInterface.sequelize.query(`
      DELETE FROM usuario
      WHERE login IN (${listaLogins});
    `);
  },
};
