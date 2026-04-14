const Usuario = require("../models").UsuarioModel;
const Papel = require("../models").PapelModel;
const Time = require("../models").TimeModel;
const UsuarioTime = require("../models").UsuarioTimeModel;
const Posicao = require("../models").PosicaoModel;

module.exports = perfil;

async function perfil(req, res) {
  try {
    let retorno = {};
    const usuario = await Usuario.findByPk(req.auth.UsuarioId, {
      include: {
        model: UsuarioTime,
        include: [
          { model: Papel, attributes: ["id", "nome", "dashboard"] },
          { model: Time, attributes: ["id", "nome"] },
          { model: Posicao, attributes: ["id", "nome"], required: false },
        ],
      },
      attributes: ["id", "nome", "login", "email", "telefone", "dataNascimento"],
    });
    if (usuario && usuario.UsuarioTimeModels) {
      const userRoles = (usuario.UsuarioTimeModels || []).map((ut) => {
        const p = ut.PapelModel || {};
        const t = ut.TimeModel || {};
        const pos = ut.PosicaoModel;
        return {
          id: ut.id,
          papel: p.nome,
          optionLabel: `${p.nome} · ${t.nome}`,
          dashboard: p.dashboard,
          time: { id: t.id, nome: t.nome },
          posicao: pos ? { id: pos.id, nome: pos.nome } : null,
        };
      });

      retorno = {
        usuario: {
          id: usuario.id,
          login: usuario.login,
          nome: usuario.nome,
          email: usuario.email,
          telefone: usuario.telefone,
          data_nascimento: usuario.dataNascimento,
        },
        up: userRoles,
      };
    }

    return res.status(200).send(retorno);
  } catch (err) {
    console.log(err);
    res.status(400).send({
      message: "Ops... problemas ao recuperar dados  do Usuario. " + err.message,
    });
  }
}
