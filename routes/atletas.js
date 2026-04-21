const express = require("express");
const { authorize } = require("../auth/authorize");
const { findAllUsuarioTimeElenco } = require("../lib/elenco-atleta");
const {
  UsuarioTimeModel,
  UsuarioModel,
  TimeModel,
  PapelModel,
  PosicaoModel,
} = require("../models");

const router = express.Router();

const ORDEM_POSICAO = ["Goleiro", "Defensor", "Meio-Campista", "Atacante"];

router.get("/elenco", authorize(["Administrador", "Atleta"]), async (req, res, next) => {
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

    const rows = await findAllUsuarioTimeElenco(timeId, [
      { model: PapelModel, attributes: ["id", "nome"] },
      {
        model: UsuarioModel,
        attributes: ["id", "nome", "login", "email", "telefone", "dataNascimento"],
      },
      {
        model: PosicaoModel,
        attributes: ["id", "nome"],
        required: false,
      },
    ]);

    const gruposMap = new Map();

    for (const row of rows) {
      const pos = row.PosicaoModel;
      const key = pos ? pos.nome : "__sem_posicao__";
      const usuario = row.UsuarioModel;
      if (String(usuario?.nome ?? "").trim() === "Administrador") {
        continue;
      }
      if (!gruposMap.has(key)) {
        gruposMap.set(key, {
          posicao: pos ? { id: pos.id, nome: pos.nome } : null,
          atletas: [],
        });
      }
      const nomePapel = String(row.PapelModel?.nome ?? "").trim();
      gruposMap.get(key).atletas.push({
        usuario_time_id: row.id,
        id: usuario.id,
        nome: usuario.nome,
        login: usuario.login,
        email: usuario.email,
        telefone: usuario.telefone,
        dataNascimento: usuario.dataNascimento,
        papel: nomePapel,
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

    const papelAdminRow = await PapelModel.findOne({
      where: { nome: "Administrador" },
      attributes: ["id"],
    });
    let diretoria = [];
    if (papelAdminRow) {
      const dirRows = await UsuarioTimeModel.findAll({
        where: {
          TimeModelId: timeId,
          PapelModelId: papelAdminRow.id,
        },
        include: [
          {
            model: UsuarioModel,
            attributes: ["id", "nome", "login", "email", "telefone"],
          },
        ],
      });
      dirRows.sort((a, b) =>
        (a.UsuarioModel?.nome ?? "").localeCompare(b.UsuarioModel?.nome ?? "", undefined, {
          sensitivity: "base",
        }),
      );
      diretoria = dirRows.map((row) => {
        const u = row.UsuarioModel;
        if (String(u?.nome ?? "").trim() === "Administrador") {
          return null;
        }
        return {
          usuario_time_id: row.id,
          id: u.id,
          nome: u.nome,
          login: u.login,
          email: u.email,
          telefone: u.telefone,
        };
      }).filter(Boolean);
    }

    res.json({
      time: {
        id: time.id,
        nome: time.nome,
        sigla: time.sigla ?? null,
      },
      grupos,
      diretoria,
    });
  } catch (err) {
    next(err);
  }
});

router.patch("/elenco/tornar-administrador", authorize(["Administrador"]), async (req, res, next) => {
  try {
    const usuarioTimeId = parseInt(String(req.body?.usuario_time_id), 10);
    if (!Number.isFinite(usuarioTimeId)) {
      return res.status(400).json({ message: "usuario_time_id inválido." });
    }

    const membershipId = parseInt(String(req.headers.up), 10);
    const vinculo = await UsuarioTimeModel.findOne({
      where: {
        id: membershipId,
        UsuarioModelId: req.auth.UsuarioId,
      },
    });

    if (!vinculo) {
      return res.status(400).json({ message: "Vínculo não encontrado." });
    }

    const timeId = vinculo.TimeModelId;

    const [papelAtleta, papelAdmin] = await Promise.all([
      PapelModel.findOne({ where: { nome: "Atleta" }, attributes: ["id"] }),
      PapelModel.findOne({ where: { nome: "Administrador" }, attributes: ["id"] }),
    ]);

    if (!papelAtleta || !papelAdmin) {
      return res.status(500).json({ message: "Papéis não configurados no sistema." });
    }

    const alvo = await UsuarioTimeModel.findOne({
      where: {
        id: usuarioTimeId,
        TimeModelId: timeId,
        PapelModelId: papelAtleta.id,
      },
    });

    if (!alvo) {
      return res.status(404).json({
        message: "Atleta não encontrado neste time ou já é administrador.",
      });
    }

    await alvo.update({ PapelModelId: papelAdmin.id });

    res.json({ message: "Perfil atualizado para administrador." });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
