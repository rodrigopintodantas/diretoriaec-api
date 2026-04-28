const express = require("express");
const { sequelize, TimeModel, UsuarioTimeModel, PapelModel, UsuarioModel } = require("../models");
const { authBearerLogin, authorize } = require("../auth/authorize");

const router = express.Router();

async function getVinculoSelecionadoAdmin(req) {
  const membershipId = parseInt(String(req.headers.up), 10);
  if (Number.isNaN(membershipId)) {
    return null;
  }
  return UsuarioTimeModel.findOne({
    where: {
      id: membershipId,
      UsuarioModelId: req.auth.UsuarioId,
    },
    include: [
      { model: PapelModel, attributes: ["nome"] },
      { model: TimeModel, attributes: ["id", "nome", "sigla", "descricao"] },
    ],
  });
}

router.post("/", authBearerLogin(), async (req, res, next) => {
  try {
    const usuario = await UsuarioModel.findByPk(req.auth.UsuarioId, {
      attributes: ["id", "nome"],
    });
    const nomeUsuario = String(usuario?.nome ?? "").trim();
    if (nomeUsuario !== "Administrador") {
      return res.status(403).json({ message: "Apenas o usuário Administrador pode criar times." });
    }

    const nome = req.body?.nome != null ? String(req.body.nome).trim() : "";
    const siglaRaw = req.body?.sigla != null ? String(req.body.sigla).trim().toUpperCase() : "";
    const sigla = siglaRaw || null;

    if (nome.length < 3) {
      return res.status(400).json({ message: "Informe o nome do time com pelo menos 3 caracteres." });
    }
    if (sigla && (sigla.length < 2 || sigla.length > 10)) {
      return res.status(400).json({ message: "A sigla deve ter entre 2 e 10 caracteres." });
    }

    const papelAdmin = await PapelModel.findOne({
      where: { nome: "Administrador" },
      attributes: ["id"],
    });
    if (!papelAdmin) {
      return res.status(500).json({ message: "Papel Administrador não configurado no sistema." });
    }

    const time = await sequelize.transaction(async (transaction) => {
      const novoTime = await TimeModel.create(
        {
          nome,
          sigla,
        },
        { transaction },
      );

      await UsuarioTimeModel.create(
        {
          UsuarioModelId: req.auth.UsuarioId,
          TimeModelId: novoTime.id,
          PapelModelId: papelAdmin.id,
          id_posicao: null,
        },
        { transaction },
      );

      return novoTime;
    });

    return res.status(201).json({
      message: "Time criado com sucesso.",
      time: {
        id: time.id,
        nome: time.nome,
        sigla: time.sigla ?? null,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get("/meu-time", authorize(["Administrador"]), async (req, res, next) => {
  try {
    const vinculo = await getVinculoSelecionadoAdmin(req);
    if (!vinculo || vinculo.PapelModel?.nome !== "Administrador") {
      return res.status(403).json({ message: "Apenas administradores podem consultar o time." });
    }
    const time = vinculo.TimeModel;
    if (!time) {
      return res.status(404).json({ message: "Time não encontrado." });
    }
    return res.status(200).json({
      time: {
        id: time.id,
        nome: time.nome,
        sigla: time.sigla ?? null,
        descricao: time.descricao ?? null,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.patch("/meu-time", authorize(["Administrador"]), async (req, res, next) => {
  try {
    const vinculo = await getVinculoSelecionadoAdmin(req);
    if (!vinculo || vinculo.PapelModel?.nome !== "Administrador") {
      return res.status(403).json({ message: "Apenas administradores podem editar o time." });
    }
    const time = vinculo.TimeModel;
    if (!time) {
      return res.status(404).json({ message: "Time não encontrado." });
    }

    const siglaRaw = req.body?.sigla != null ? String(req.body.sigla).trim().toUpperCase() : "";
    const descricaoRaw = req.body?.descricao != null ? String(req.body.descricao).trim() : "";
    const sigla = siglaRaw || null;
    const descricao = descricaoRaw || null;

    if (sigla && !/^[A-Z]{3}$/.test(sigla)) {
      return res.status(400).json({ message: "A sigla deve conter exatamente 3 letras." });
    }
    if (descricao && descricao.length > 500) {
      return res.status(400).json({ message: "A descrição deve ter no máximo 500 caracteres." });
    }

    await time.update({ sigla, descricao });

    return res.status(200).json({
      message: "Time atualizado com sucesso.",
      time: {
        id: time.id,
        nome: time.nome,
        sigla: time.sigla ?? null,
        descricao: time.descricao ?? null,
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
