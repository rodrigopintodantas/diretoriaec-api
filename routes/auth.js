const express = require("express");
const bcrypt = require("bcryptjs");
const { col, fn, where } = require("sequelize");
const { authorizeSemPerfilSelecionado, authBearerLogin, getPapeisPorUsuario } = require("../auth/authorize");
const { signAccessToken } = require("../auth/jwt");
const { sequelize, UsuarioModel, UsuarioTimeModel, TimeModel, PapelModel, PosicaoModel } = require("../models");
const perfil = require("../auth/perfil");

const router = express.Router();

function parseDataNascimento(input) {
  if (input == null) {
    return null;
  }
  const value = String(input).trim();
  if (!value) {
    return null;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return { invalida: true };
  }
  const [anoRaw, mesRaw, diaRaw] = value.split("-");
  const ano = Number.parseInt(anoRaw, 10);
  const mes = Number.parseInt(mesRaw, 10);
  const dia = Number.parseInt(diaRaw, 10);
  const date = new Date(Date.UTC(ano, mes - 1, dia));
  if (
    date.getUTCFullYear() !== ano ||
    date.getUTCMonth() + 1 !== mes ||
    date.getUTCDate() !== dia
  ) {
    return { invalida: true };
  }
  return value;
}

function parsePosicaoId(input) {
  if (input == null || String(input).trim() === "") {
    return null;
  }
  const id = parseInt(String(input), 10);
  if (!Number.isFinite(id) || id <= 0) {
    return { invalida: true };
  }
  return id;
}

router.get("/inscricao-atleta/contexto", async (req, res, next) => {
  try {
    const timeId = parseInt(String(req.query?.time_id ?? ""), 10);
    if (!Number.isFinite(timeId) || timeId <= 0) {
      return res.status(400).json({ message: "time_id inválido." });
    }

    const [time, posicoes] = await Promise.all([
      TimeModel.findByPk(timeId, { attributes: ["id", "nome", "sigla"] }),
      PosicaoModel.findAll({ attributes: ["id", "nome"], order: [["nome", "ASC"]] }),
    ]);

    if (!time) {
      return res.status(404).json({ message: "Time não encontrado para esse link de inscrição." });
    }

    return res.json({
      time: {
        id: time.id,
        nome: time.nome,
        sigla: time.sigla ?? null,
      },
      posicoes: posicoes.map((p) => ({ id: p.id, nome: p.nome })),
    });
  } catch (err) {
    next(err);
  }
});

router.post("/inscricao-atleta", async (req, res, next) => {
  try {
    const timeId = parseInt(String(req.body?.time_id ?? ""), 10);
    const nome = req.body?.nome != null ? String(req.body.nome).trim() : "";
    const loginRaw = req.body?.login != null ? String(req.body.login).trim() : "";
    const login = loginRaw.toLowerCase();
    const emailRaw = req.body?.email != null ? String(req.body.email).trim() : "";
    const email = emailRaw ? emailRaw.toLowerCase() : null;
    const telefoneRaw = req.body?.telefone != null ? String(req.body.telefone).trim() : "";
    const telefone = telefoneRaw || null;
    const senha = req.body?.senha != null ? String(req.body.senha) : "";
    const senhaConfirmacao =
      req.body?.senha_confirmacao != null ? String(req.body.senha_confirmacao) : "";
    const dataNascimento = parseDataNascimento(req.body?.data_nascimento);
    const posicaoId = parsePosicaoId(req.body?.posicao_id);

    if (!Number.isFinite(timeId) || timeId <= 0) {
      return res.status(400).json({ message: "time_id inválido." });
    }
    if (nome.length < 3) {
      return res.status(400).json({ message: "Informe um nome com pelo menos 3 caracteres." });
    }
    if (!/^[a-z0-9._-]{3,40}$/.test(login)) {
      return res.status(400).json({
        message:
          "Login inválido. Use de 3 a 40 caracteres com letras minúsculas, números, ponto, hífen ou underscore.",
      });
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: "E-mail inválido." });
    }
    if (senha.length < 6) {
      return res.status(400).json({ message: "A senha deve ter pelo menos 6 caracteres." });
    }
    if (senha !== senhaConfirmacao) {
      return res.status(400).json({ message: "A confirmação de senha não confere." });
    }
    if (dataNascimento && dataNascimento.invalida) {
      return res.status(400).json({ message: "Data de nascimento inválida." });
    }
    if (posicaoId && posicaoId.invalida) {
      return res.status(400).json({ message: "Posição inválida." });
    }

    const [time, papelAtleta, loginExistente, emailExistente, posicao] = await Promise.all([
      TimeModel.findByPk(timeId, { attributes: ["id", "nome", "sigla"] }),
      PapelModel.findOne({
        where: { nome: "Atleta" },
        attributes: ["id"],
      }),
      UsuarioModel.unscoped().findOne({
        where: where(fn("lower", col("login")), login),
        attributes: ["id"],
      }),
      email
        ? UsuarioModel.unscoped().findOne({
            where: where(fn("lower", col("email")), email),
            attributes: ["id"],
          })
        : Promise.resolve(null),
      posicaoId ? PosicaoModel.findByPk(posicaoId, { attributes: ["id", "nome"] }) : Promise.resolve(null),
    ]);

    if (!time) {
      return res.status(404).json({ message: "Time não encontrado para esse link de inscrição." });
    }
    if (!papelAtleta) {
      return res.status(500).json({ message: "Papel Atleta não configurado no sistema." });
    }
    if (loginExistente) {
      return res.status(409).json({ message: "Este login já está em uso." });
    }
    if (email && emailExistente) {
      return res.status(409).json({ message: "Este e-mail já está em uso." });
    }
    if (posicaoId && !posicao) {
      return res.status(400).json({ message: "Posição inválida." });
    }

    const senhaHash = await bcrypt.hash(senha, 10);
    const criado = await sequelize.transaction(async (transaction) => {
      const usuario = await UsuarioModel.create(
        {
          nome,
          login,
          email,
          telefone,
          dataNascimento: dataNascimento || null,
          senha_hash: senhaHash,
        },
        { transaction },
      );

      await UsuarioTimeModel.create(
        {
          UsuarioModelId: usuario.id,
          TimeModelId: time.id,
          PapelModelId: papelAtleta.id,
          id_posicao: posicaoId ?? null,
        },
        { transaction },
      );

      return usuario;
    });

    return res.status(201).json({
      message: "Inscrição enviada com sucesso.",
      usuario: {
        id: criado.id,
        nome: criado.nome,
        login: criado.login,
      },
      time: {
        id: time.id,
        nome: time.nome,
        sigla: time.sigla ?? null,
      },
    });
  } catch (err) {
    if (err?.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({ message: "Login ou e-mail já cadastrado." });
    }
    next(err);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const { login, senha } = req.body ?? {};
    const identificadorTrim = login != null ? String(login).trim() : "";
    const senhaStr = senha != null ? String(senha) : "";

    if (!identificadorTrim || !senhaStr) {
      return res.status(400).json({ message: "Informe login ou email e senha." });
    }

    const identificadorLower = identificadorTrim.toLowerCase();

    let usuario = await UsuarioModel.unscoped().findOne({
      where: where(fn("lower", col("login")), identificadorLower),
    });

    if (!usuario) {
      usuario = await UsuarioModel.unscoped().findOne({
        where: where(fn("lower", col("email")), identificadorLower),
      });
    }

    if (!usuario || !usuario.senha_hash) {
      return res.status(401).json({ message: "Login ou senha incorretos." });
    }

    const ok = await bcrypt.compare(senhaStr, usuario.senha_hash);
    if (!ok) {
      return res.status(401).json({ message: "Login ou senha incorretos." });
    }

    const up = await getPapeisPorUsuario(usuario);
    if (!up || up.length === 0) {
      return res.status(400).json({
        message: "O usuário não possui vínculo com time no sistema.",
      });
    }

    const token = signAccessToken(usuario);

    const usuarioPublico = {
      id: usuario.id,
      login: usuario.login,
      nome: usuario.nome,
      email: usuario.email,
      telefone: usuario.telefone,
      dataNascimento: usuario.dataNascimento,
    };

    return res.json({
      token,
      usuario: usuarioPublico,
      up,
    });
  } catch (err) {
    next(err);
  }
});

router.get("/", authorizeSemPerfilSelecionado());
router.get("/perfil", authBearerLogin(), perfil);

router.post("/alterar-senha", authBearerLogin(), async (req, res, next) => {
  try {
    const senhaAtual = req.body?.senha_atual != null ? String(req.body.senha_atual) : "";
    const senhaNova = req.body?.senha_nova != null ? String(req.body.senha_nova) : "";
    const senhaNovaConfirmacao =
      req.body?.senha_nova_confirmacao != null ? String(req.body.senha_nova_confirmacao) : "";

    if (!senhaAtual) {
      return res.status(400).json({ message: "Informe a senha atual." });
    }
    if (senhaNova.length < 6) {
      return res.status(400).json({ message: "A nova senha deve ter pelo menos 6 caracteres." });
    }
    if (senhaNova !== senhaNovaConfirmacao) {
      return res.status(400).json({ message: "A confirmação da nova senha não confere." });
    }

    const usuario = await UsuarioModel.unscoped().findByPk(req.auth.UsuarioId);
    if (!usuario || !usuario.senha_hash) {
      return res.status(400).json({ message: "Usuário não encontrado." });
    }

    const ok = await bcrypt.compare(senhaAtual, usuario.senha_hash);
    if (!ok) {
      return res.status(400).json({ message: "Senha atual incorreta." });
    }

    const rounds = 10;
    const novoHash = await bcrypt.hash(senhaNova, rounds);
    await usuario.update({ senha_hash: novoHash });

    return res.status(200).json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
