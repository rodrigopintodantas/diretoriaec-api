const { UsuarioTimeModel, PapelModel, UsuarioModel, TimeModel } = require("../models");
const { verifyAccessToken } = require("./jwt");

/**
 * Autenticação com JWT:
 * - Authorization: Bearer <token>
 * - Header "up": id da linha em usuario_time (vínculo usuário + time + papel).
 */

function getBearerToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return null;
  }
  const parts = authHeader.split(" ");
  if (parts.length === 2 && /^Bearer$/i.test(parts[0])) {
    return parts[1];
  }
  return null;
}

function temPermissao(userRoles = [], functionRoles = []) {
  if (userRoles.length === 0) {
    return false;
  }
  return userRoles.some((element) => functionRoles.indexOf(element) > -1);
}

/**
 * Carrega o usuário a partir do JWT (sem validar vínculo ainda).
 */
async function getUsuarioDoToken(req, res) {
  const token = getBearerToken(req);
  if (!token) {
    res.status(401).json({ message: "Cabeçalho Authorization não informado." });
    return null;
  }
  let decoded;
  try {
    decoded = verifyAccessToken(token);
  } catch {
    res.status(401).json({ message: "Token inválido ou expirado." });
    return null;
  }
  const usuario = await UsuarioModel.findByPk(decoded.sub, {
    attributes: ["id", "login", "nome", "email", "telefone", "dataNascimento"],
  });
  if (!usuario) {
    res.status(401).json({ message: "Usuário não encontrado." });
    return null;
  }
  return usuario;
}

function authorize(functionRoles = []) {
  if (typeof functionRoles === "string") {
    functionRoles = [functionRoles];
  }

  return async (req, res, next) => {
    try {
      const usuario = await getUsuarioDoToken(req, res);
      if (!usuario) {
        return;
      }

      const membershipIdHeader = req.headers.up;
      const membershipId = membershipIdHeader != null ? parseInt(String(membershipIdHeader), 10) : NaN;
      if (Number.isNaN(membershipId)) {
        return res.status(400).json({
          message: "Cabeçalho up (id do vínculo no time) não informado ou inválido.",
        });
      }

      const vinculo = await getVinculoComPapel(usuario.id, membershipId);

      if (!vinculo) {
        return res.status(400).json({
          message: "O usuário não possui esse vínculo com time/papel.",
        });
      }

      if (!temPermissao([vinculo.PapelModel.nome], functionRoles)) {
        return res.status(401).json({
          message: "Usuário sem perfil",
        });
      }

      req.auth = {
        preferred_username: usuario.login,
        UsuarioId: usuario.id,
      };

      next();
    } catch (error) {
      console.error("Erro no middleware authorize:", error);
      return res.status(401).json({
        message: "Não autorizado. ",
      });
    }
  };
}

function authorizeSemPerfilSelecionado() {
  return async (req, res) => {
    try {
      const usuario = await getUsuarioDoToken(req, res);
      if (!usuario) {
        return;
      }

      const up = await getPapeisPorUsuario(usuario);

      if (!up || up.length === 0) {
        return res.status(400).json({
          message: "O usuário não possui vínculo com time no sistema.",
        });
      }

      req.auth = {
        preferred_username: usuario.login,
        UsuarioId: usuario.id,
      };

      return res.status(200).send({
        usuario: {
          id: usuario.id,
          login: usuario.login,
          nome: usuario.nome,
          email: usuario.email,
          telefone: usuario.telefone,
          dataNascimento: usuario.dataNascimento,
        },
        up,
      });
    } catch (error) {
      console.error("Erro no middleware authorizeSemPerfilSelecionado:", error);
      return res.status(401).json({
        message: "Não autorizado. ",
      });
    }
  };
}

function authBearerLogin() {
  return async (req, res, next) => {
    try {
      const usuario = await getUsuarioDoToken(req, res);
      if (!usuario) {
        return;
      }

      req.auth = {
        preferred_username: usuario.login,
        UsuarioId: usuario.id,
      };

      next();
    } catch (error) {
      console.error("Erro no middleware authBearerLogin:", error);
      return res.status(401).json({
        message: "Não autorizado. ",
      });
    }
  };
}

async function getPapeisPorUsuario(usuario) {
  const rows = await UsuarioTimeModel.findAll({
    where: {
      UsuarioModelId: usuario.id,
    },
    include: [
      {
        model: PapelModel,
        attributes: ["id", "nome", "dashboard"],
      },
      {
        model: TimeModel,
        attributes: ["id", "nome"],
      },
    ],
  });

  return rows.map((u) => {
    return {
      id: u.id,
      nome: u.PapelModel.nome,
      descricao: null,
      dashboard: u.PapelModel.dashboard,
      time: {
        id: u.TimeModel.id,
        nome: u.TimeModel.nome,
      },
    };
  });
}

async function getVinculoComPapel(UsuarioId, membershipId) {
  return UsuarioTimeModel.findOne({
    where: {
      id: membershipId,
      UsuarioModelId: UsuarioId,
    },
    include: [
      {
        model: PapelModel,
        attributes: ["nome", "dashboard"],
      },
    ],
  });
}

module.exports = {
  authorizeSemPerfilSelecionado,
  authorize,
  authBearerLogin,
  getBearerToken,
  getPapeisPorUsuario,
  getUsuarioDoToken,
};
