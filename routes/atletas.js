const express = require("express");
const { authorize } = require("../auth/authorize");
const {
  UsuarioTimeModel,
  UsuarioModel,
  TimeModel,
  PapelModel,
  PosicaoModel,
} = require("../models");

const router = express.Router();

const ORDEM_POSICAO = ["Goleiro", "Defensor", "Meio-Campista", "Atacante"];

router.get("/meus-atletas", authorize(["Administrador"]), async (req, res, next) => {
  try {
    const membershipId = parseInt(String(req.headers.up), 10);
    const vinculo = await UsuarioTimeModel.findOne({
      where: {
        id: membershipId,
        UsuarioModelId: req.auth.UsuarioId,
      },
      include: [{ model: TimeModel, attributes: ["id", "nome", "sigla"] }],
    });

    if (!vinculo) {
      return res.status(400).json({ message: "Vínculo não encontrado." });
    }

    const time = vinculo.TimeModel;
    const timeId = vinculo.TimeModelId;

    const rows = await UsuarioTimeModel.findAll({
      where: { TimeModelId: timeId },
      include: [
        {
          model: PapelModel,
          where: { nome: "Atleta" },
          attributes: ["id", "nome"],
        },
        {
          model: UsuarioModel,
          attributes: ["id", "nome", "login", "email", "telefone", "dataNascimento"],
        },
        {
          model: PosicaoModel,
          attributes: ["id", "nome"],
          required: false,
        },
      ],
    });

    const gruposMap = new Map();

    for (const row of rows) {
      const pos = row.PosicaoModel;
      const key = pos ? pos.nome : "__sem_posicao__";
      if (!gruposMap.has(key)) {
        gruposMap.set(key, {
          posicao: pos ? { id: pos.id, nome: pos.nome } : null,
          atletas: [],
        });
      }
      const usuario = row.UsuarioModel;
      gruposMap.get(key).atletas.push({
        usuario_time_id: row.id,
        id: usuario.id,
        nome: usuario.nome,
        login: usuario.login,
        email: usuario.email,
        telefone: usuario.telefone,
        dataNascimento: usuario.dataNascimento,
      });
    }

    for (const g of gruposMap.values()) {
      g.atletas.sort((a, b) => a.nome.localeCompare(b.nome));
    }

    const grupos = Array.from(gruposMap.values()).sort((a, b) => {
      const an = a.posicao?.nome ?? "";
      const bn = b.posicao?.nome ?? "";
      const ia = ORDEM_POSICAO.indexOf(an);
      const ib = ORDEM_POSICAO.indexOf(bn);
      const aRank = ia === -1 ? 999 : ia;
      const bRank = ib === -1 ? 999 : ib;
      if (aRank !== bRank) {
        return aRank - bRank;
      }
      if (!a.posicao) {
        return 1;
      }
      if (!b.posicao) {
        return -1;
      }
      return an.localeCompare(bn);
    });

    res.json({
      time: {
        id: time.id,
        nome: time.nome,
        sigla: time.sigla ?? null,
      },
      grupos,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
