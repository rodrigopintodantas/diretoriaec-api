/**
 * Regras para quem entra no “elenco” de atletas do time (convocação, Meus Atletas, elenco na partida, etc.):
 * - vínculo com papel Atleta, ou
 * - vínculo com papel Administrador e posição cadastrada (id_posicao não nulo).
 */
const { Op } = require("sequelize");
const { PapelModel, UsuarioTimeModel } = require("../models");

async function idsPapeisElenco() {
  const [atleta, admin] = await Promise.all([
    PapelModel.findOne({ where: { nome: "Atleta" }, attributes: ["id"] }),
    PapelModel.findOne({ where: { nome: "Administrador" }, attributes: ["id"] }),
  ]);
  return {
    atletaId: atleta ? atleta.id : null,
    adminId: admin ? admin.id : null,
  };
}

/**
 * Cláusula `where` para UsuarioTimeModel: membros do time elegíveis como atleta em partidas.
 */
async function whereUsuarioTimeElencoDoTime(timeId) {
  const { atletaId, adminId } = await idsPapeisElenco();
  const or = [];
  if (atletaId != null) {
    or.push({ PapelModelId: atletaId });
  }
  if (adminId != null) {
    or.push({
      [Op.and]: [{ PapelModelId: adminId }, { id_posicao: { [Op.ne]: null } }],
    });
  }
  if (!or.length) {
    throw new Error("Papeis Atleta e/ou Administrador não encontrados no sistema.");
  }
  return {
    TimeModelId: timeId,
    [Op.or]: or,
  };
}

/**
 * Busca vínculos do elenco do time (para listagens agrupadas por posição).
 */
async function findAllUsuarioTimeElenco(timeId, include, options = {}) {
  const where = await whereUsuarioTimeElencoDoTime(timeId);
  return UsuarioTimeModel.findAll({
    where,
    include,
    ...options,
  });
}

/**
 * Valida se um usuario_time pertence ao elenco do time (ex.: convocação).
 */
async function findOneUsuarioTimeElencoNoTime(timeId, usuarioTimeId, transaction) {
  const where = await whereUsuarioTimeElencoDoTime(timeId);
  return UsuarioTimeModel.findOne({
    where: {
      ...where,
      id: usuarioTimeId,
    },
    transaction,
  });
}

/**
 * Vínculo elenco por usuário + time (ex.: artilheiro em gol — mesmo critério da lista de atletas).
 */
async function findOneUsuarioTimeElencoPorUsuario(timeId, usuarioModelId, transaction) {
  const where = await whereUsuarioTimeElencoDoTime(timeId);
  return UsuarioTimeModel.findOne({
    where: {
      ...where,
      UsuarioModelId: usuarioModelId,
    },
    transaction,
  });
}

module.exports = {
  whereUsuarioTimeElencoDoTime,
  findAllUsuarioTimeElenco,
  findOneUsuarioTimeElencoNoTime,
  findOneUsuarioTimeElencoPorUsuario,
};
