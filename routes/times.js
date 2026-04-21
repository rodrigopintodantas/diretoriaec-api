const express = require("express");
const { sequelize, TimeModel, UsuarioTimeModel, PapelModel, UsuarioModel } = require("../models");
const { authBearerLogin } = require("../auth/authorize");

const router = express.Router();

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

module.exports = router;
