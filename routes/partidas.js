const express = require("express");
const { Op } = require("sequelize");
const { authorize } = require("../auth/authorize");
const { notificarConvocados, notificarReconvocacaoPresenca } = require("../lib/push-send");
const {
  UsuarioTimeModel,
  TimeModel,
  PartidaModel,
  PapelModel,
  PartidaGolModel,
  UsuarioModel,
  ConvocacaoModel,
  ConvocacaoAtletaModel,
  sequelize,
} = require("../models");

const router = express.Router();

const STATUS_PARTIDA = ["AGENDADA", "REALIZADA", "CANCELADA", "ADIADA"];
const PRESENCA_STATUS = ["PENDENTE", "CONFIRMADO", "RECUSADO"];

function siglaDeNome(nome, fallback = "TIM") {
  if (!nome || typeof nome !== "string") {
    return fallback;
  }
  const limpa = nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase();

  if (!limpa) {
    return fallback;
  }
  return limpa.slice(0, 3).padEnd(3, "X");
}

async function getVinculoSelecionado(req) {
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
      { model: TimeModel, attributes: ["id", "nome", "sigla"] },
      { model: PapelModel, attributes: ["id", "nome"] },
    ],
  });
}

function serializarJogo(jogo) {
  return {
    id: jogo.id,
    id_time_1: jogo.id_time_1,
    nome_time_1: jogo.nome_time_1,
    sigla_time_1: jogo.sigla_time_1,
    id_time_2: jogo.id_time_2,
    nome_time_2: jogo.nome_time_2,
    sigla_time_2: jogo.sigla_time_2,
    local: jogo.local,
    data: jogo.data,
    hora: jogo.hora,
    status: jogo.status,
    placar_time_1: jogo.placar_time_1,
    placar_time_2: jogo.placar_time_2,
  };
}

async function findPartidaDoTime(partidaId, timeId) {
  return PartidaModel.findOne({
    where: {
      id: partidaId,
      [Op.or]: [{ id_time_1: timeId }, { id_time_2: timeId }],
    },
  });
}

function timeIdParaLado(partida, lado) {
  return lado === 1 ? partida.id_time_1 : partida.id_time_2;
}

function serializarGols(gols) {
  return gols.map((g) => ({
    id: g.id,
    lado: g.lado,
    usuario_id: g.UsuarioModelId,
    nome_artilheiro: g.UsuarioModel ? g.UsuarioModel.nome : null,
    minuto: g.minuto,
    contra: g.contra,
  }));
}

function serializarConvocacao(conv) {
  if (!conv) {
    return null;
  }
  const itens = conv.ConvocacaoAtletaModels || [];
  const linhas = itens.map((linha) => {
    const ut = linha.UsuarioTimeModel;
    const u = ut && ut.UsuarioModel ? ut.UsuarioModel : null;
    return {
      id: linha.id,
      usuario_time_id: linha.usuario_time_id,
      presenca_status: linha.presenca_status,
      presenca_em: linha.presenca_em,
      motivo_recusa: linha.motivo_recusa,
      atleta: u
        ? {
            id: u.id,
            nome: u.nome,
            login: u.login,
          }
        : null,
    };
  });
  return {
    id: conv.id,
    partida_id: conv.partida_id,
    time_id: conv.time_id,
    atletas: linhas,
  };
}

router.get("/meus-jogos", authorize(["Administrador"]), async (req, res, next) => {
  try {
    const vinculo = await getVinculoSelecionado(req);
    if (!vinculo) {
      return res.status(400).json({ message: "Vínculo não encontrado." });
    }

    const timeId = vinculo.TimeModelId;
    const jogos = await PartidaModel.findAll({
      where: {
        [Op.or]: [{ id_time_1: timeId }, { id_time_2: timeId }],
      },
      order: [
        ["data", "ASC"],
        ["hora", "ASC"],
        ["id", "ASC"],
      ],
    });

    res.json({
      time: {
        id: vinculo.TimeModel.id,
        nome: vinculo.TimeModel.nome,
        sigla: vinculo.TimeModel.sigla ?? siglaDeNome(vinculo.TimeModel.nome),
      },
      jogos: jogos.map(serializarJogo),
    });
  } catch (err) {
    next(err);
  }
});

router.get("/meus-jogos/:id", authorize(["Administrador"]), async (req, res, next) => {
  try {
    const vinculo = await getVinculoSelecionado(req);
    if (!vinculo) {
      return res.status(400).json({ message: "Vínculo não encontrado." });
    }
    const timeId = vinculo.TimeModelId;
    const partidaId = parseInt(req.params.id, 10);
    if (Number.isNaN(partidaId)) {
      return res.status(400).json({ message: "Id da partida inválido." });
    }

    const partida = await findPartidaDoTime(partidaId, timeId);
    if (!partida) {
      return res.status(404).json({ message: "Partida não encontrada." });
    }

    const gols = await PartidaGolModel.findAll({
      where: { partida_id: partidaId },
      include: [{ model: UsuarioModel, attributes: ["id", "nome", "login"] }],
      order: [
        ["lado", "ASC"],
        ["minuto", "ASC NULLS LAST"],
        ["id", "ASC"],
      ],
    });

    const conv = await ConvocacaoModel.findOne({
      where: { partida_id: partidaId, time_id: timeId },
      include: [
        {
          model: ConvocacaoAtletaModel,
          include: [
            {
              model: UsuarioTimeModel,
              include: [{ model: UsuarioModel, attributes: ["id", "nome", "login"] }],
            },
          ],
        },
      ],
    });

    res.json({
      partida: serializarJogo(partida),
      gols: serializarGols(gols),
      convocacao: serializarConvocacao(conv),
    });
  } catch (err) {
    next(err);
  }
});

router.get("/meus-jogos/:id/resumo", authorize(["Atleta"]), async (req, res, next) => {
  try {
    const vinculo = await getVinculoSelecionado(req);
    if (!vinculo) {
      return res.status(400).json({ message: "Vínculo não encontrado." });
    }
    const timeId = vinculo.TimeModelId;
    const partidaId = parseInt(req.params.id, 10);
    if (Number.isNaN(partidaId)) {
      return res.status(400).json({ message: "Id da partida inválido." });
    }

    const partida = await findPartidaDoTime(partidaId, timeId);
    if (!partida) {
      return res.status(404).json({ message: "Partida não encontrada." });
    }

    const gols = await PartidaGolModel.findAll({
      where: { partida_id: partidaId },
      include: [{ model: UsuarioModel, attributes: ["id", "nome", "login"] }],
      order: [
        ["lado", "ASC"],
        ["minuto", "ASC NULLS LAST"],
        ["id", "ASC"],
      ],
    });

    const conv = await ConvocacaoModel.findOne({
      where: { partida_id: partidaId, time_id: timeId },
    });

    let minhaLinha = null;
    if (conv) {
      const linha = await ConvocacaoAtletaModel.findOne({
        where: {
          convocacao_id: conv.id,
          usuario_time_id: vinculo.id,
        },
      });
      if (linha) {
        minhaLinha = {
          presenca_status: linha.presenca_status,
          presenca_em: linha.presenca_em,
          motivo_recusa: linha.motivo_recusa,
        };
      }
    }

    res.json({
      partida: serializarJogo(partida),
      gols: serializarGols(gols),
      minha_presenca: minhaLinha,
    });
  } catch (err) {
    next(err);
  }
});

router.post("/meus-jogos", authorize(["Administrador"]), async (req, res, next) => {
  try {
    const vinculo = await getVinculoSelecionado(req);
    if (!vinculo) {
      return res.status(400).json({ message: "Vínculo não encontrado." });
    }

    const { local, data, hora, nome_time_adversario, mandante } = req.body ?? {};

    if (!local || !data || !hora || !nome_time_adversario) {
      return res
        .status(400)
        .json({ message: "Campos obrigatórios: local, data, hora e nome do time adversário." });
    }

    const nomeAdversario = String(nome_time_adversario).trim();
    if (!nomeAdversario) {
      return res.status(400).json({ message: "Informe o nome do time adversário." });
    }

    const meuTime = vinculo.TimeModel;
    const meuNome = meuTime.nome;
    const minhaSigla = (meuTime.sigla ?? "").trim() || siglaDeNome(meuNome);
    const adversarioSigla = siglaDeNome(nomeAdversario, "ADV");
    const souMandante = mandante === true || mandante === "true";

    const payload = souMandante
      ? {
          id_time_1: meuTime.id,
          nome_time_1: meuNome,
          sigla_time_1: minhaSigla,
          id_time_2: null,
          nome_time_2: nomeAdversario,
          sigla_time_2: adversarioSigla,
        }
      : {
          id_time_1: null,
          nome_time_1: nomeAdversario,
          sigla_time_1: adversarioSigla,
          id_time_2: meuTime.id,
          nome_time_2: meuNome,
          sigla_time_2: minhaSigla,
        };

    const nova = await PartidaModel.create({
      ...payload,
      local: String(local).trim(),
      data,
      hora,
      status: "AGENDADA",
    });

    return res.status(201).json(serializarJogo(nova));
  } catch (err) {
    next(err);
  }
});

router.patch("/meus-jogos/:id/resultado", authorize(["Administrador"]), async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const vinculo = await getVinculoSelecionado(req);
    if (!vinculo) {
      await t.rollback();
      return res.status(400).json({ message: "Vínculo não encontrado." });
    }

    const timeId = vinculo.TimeModelId;
    const partidaId = parseInt(req.params.id, 10);
    if (Number.isNaN(partidaId)) {
      await t.rollback();
      return res.status(400).json({ message: "Id da partida inválido." });
    }

    const partida = await findPartidaDoTime(partidaId, timeId);
    if (!partida) {
      await t.rollback();
      return res.status(404).json({ message: "Partida não encontrada." });
    }

    const { placar_time_1, placar_time_2, gols, status } = req.body ?? {};

    if (placar_time_1 == null || placar_time_2 == null) {
      await t.rollback();
      return res.status(400).json({ message: "Informe placar_time_1 e placar_time_2." });
    }

    const p1 = Number(placar_time_1);
    const p2 = Number(placar_time_2);
    if (Number.isNaN(p1) || Number.isNaN(p2) || p1 < 0 || p2 < 0) {
      await t.rollback();
      return res.status(400).json({ message: "Placares devem ser números inteiros >= 0." });
    }

    let novoStatus = "REALIZADA";
    if (status != null && status !== "") {
      if (!STATUS_PARTIDA.includes(String(status))) {
        await t.rollback();
        return res.status(400).json({ message: `status inválido. Use: ${STATUS_PARTIDA.join(", ")}` });
      }
      novoStatus = String(status);
    }

    await partida.update(
      {
        placar_time_1: p1,
        placar_time_2: p2,
        status: novoStatus,
      },
      { transaction: t },
    );

    if (Array.isArray(gols)) {
      await PartidaGolModel.destroy({ where: { partida_id: partidaId }, transaction: t });

      for (const g of gols) {
        const lado = Number(g.lado);
        if (lado !== 1 && lado !== 2) {
          throw Object.assign(new Error("Cada gol deve ter lado 1 ou 2."), { status: 400 });
        }
        const uid = g.usuario_id != null && g.usuario_id !== "" ? Number(g.usuario_id) : null;
        if (uid != null && Number.isNaN(uid)) {
          throw Object.assign(new Error("usuario_id inválido em gol."), { status: 400 });
        }

        const timeDoLado = timeIdParaLado(partida, lado);
        if (uid != null) {
          if (timeDoLado == null) {
            throw Object.assign(new Error("Não é possível associar atleta cadastrado a este lado (time sem id)."), {
              status: 400,
            });
          }
          const ut = await UsuarioTimeModel.findOne({
            where: {
              UsuarioModelId: uid,
              TimeModelId: timeDoLado,
            },
            transaction: t,
          });
          if (!ut) {
            throw Object.assign(new Error("Atleta não pertence ao time deste lado."), { status: 400 });
          }
        }

        await PartidaGolModel.create(
          {
            partida_id: partidaId,
            lado,
            UsuarioModelId: uid,
            minuto: g.minuto != null ? Number(g.minuto) : null,
            contra: Boolean(g.contra),
          },
          { transaction: t },
        );
      }
    }

    await t.commit();

    const atualizada = await PartidaModel.findByPk(partidaId);
    const golsDb = await PartidaGolModel.findAll({
      where: { partida_id: partidaId },
      include: [{ model: UsuarioModel, attributes: ["id", "nome", "login"] }],
      order: [
        ["lado", "ASC"],
        ["minuto", "ASC NULLS LAST"],
        ["id", "ASC"],
      ],
    });

    return res.json({
      partida: serializarJogo(atualizada),
      gols: serializarGols(golsDb),
    });
  } catch (err) {
    await t.rollback();
    if (err.status) {
      return res.status(err.status).json({ message: err.message });
    }
    next(err);
  }
});

router.put("/meus-jogos/:id/convocacao/atletas", authorize(["Administrador"]), async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const vinculo = await getVinculoSelecionado(req);
    if (!vinculo) {
      await t.rollback();
      return res.status(400).json({ message: "Vínculo não encontrado." });
    }

    const timeId = vinculo.TimeModelId;
    const partidaId = parseInt(req.params.id, 10);
    if (Number.isNaN(partidaId)) {
      await t.rollback();
      return res.status(400).json({ message: "Id da partida inválido." });
    }

    const partida = await findPartidaDoTime(partidaId, timeId);
    if (!partida) {
      await t.rollback();
      return res.status(404).json({ message: "Partida não encontrada." });
    }

    const { usuario_time_ids } = req.body ?? {};
    if (!Array.isArray(usuario_time_ids)) {
      await t.rollback();
      return res.status(400).json({ message: "Envie usuario_time_ids: [ id, ... ]" });
    }

    const papelAtleta = await PapelModel.findOne({ where: { nome: "Atleta" } });
    if (!papelAtleta) {
      await t.rollback();
      return res.status(500).json({ message: "Papel Atleta não encontrado no sistema." });
    }

    const ids = [...new Set(usuario_time_ids.map((x) => Number(x)).filter((n) => !Number.isNaN(n)))];
    for (const utid of ids) {
      const ut = await UsuarioTimeModel.findOne({
        where: {
          id: utid,
          TimeModelId: timeId,
          PapelModelId: papelAtleta.id,
        },
        transaction: t,
      });
      if (!ut) {
        await t.rollback();
        return res.status(400).json({ message: `usuario_time_id inválido para este time: ${utid}` });
      }
    }

    const [conv] = await ConvocacaoModel.findOrCreate({
      where: { partida_id: partidaId, time_id: timeId },
      defaults: { partida_id: partidaId, time_id: timeId },
      transaction: t,
    });

    const linhasAntigasConv = await ConvocacaoAtletaModel.findAll({
      where: { convocacao_id: conv.id },
      attributes: ["usuario_time_id"],
      transaction: t,
    });
    const conjuntoAntigoUt = new Set(linhasAntigasConv.map((x) => x.usuario_time_id));

    await ConvocacaoAtletaModel.destroy({ where: { convocacao_id: conv.id }, transaction: t });

    for (const utid of ids) {
      await ConvocacaoAtletaModel.create(
        {
          convocacao_id: conv.id,
          usuario_time_id: utid,
          presenca_status: "PENDENTE",
          presenca_em: null,
          motivo_recusa: null,
        },
        { transaction: t },
      );
    }

    await t.commit();

    const novosConvocadosUt = ids.filter((utid) => !conjuntoAntigoUt.has(utid));
    if (novosConvocadosUt.length) {
      const uts = await UsuarioTimeModel.findAll({
        where: { id: { [Op.in]: novosConvocadosUt } },
        attributes: ["UsuarioModelId"],
      });
      const usuarioIds = [...new Set(uts.map((u) => u.UsuarioModelId))];
      const partidaPush = await PartidaModel.findByPk(partidaId);
      setImmediate(() => {
        notificarConvocados({ usuarioIds, partida: partidaPush }).catch((e) =>
          console.error("[push] convocação:", e),
        );
      });
    }

    const convFinal = await ConvocacaoModel.findOne({
      where: { id: conv.id },
      include: [
        {
          model: ConvocacaoAtletaModel,
          include: [
            {
              model: UsuarioTimeModel,
              include: [{ model: UsuarioModel, attributes: ["id", "nome", "login"] }],
            },
          ],
        },
      ],
    });

    return res.json({ convocacao: serializarConvocacao(convFinal) });
  } catch (err) {
    await t.rollback();
    next(err);
  }
});

router.post("/meus-jogos/:id/convocacao/reconvocar", authorize(["Administrador"]), async (req, res, next) => {
  try {
    const vinculo = await getVinculoSelecionado(req);
    if (!vinculo) {
      return res.status(400).json({ message: "Vínculo não encontrado." });
    }
    const timeId = vinculo.TimeModelId;
    const partidaId = parseInt(req.params.id, 10);
    if (Number.isNaN(partidaId)) {
      return res.status(400).json({ message: "Id da partida inválido." });
    }

    const partida = await findPartidaDoTime(partidaId, timeId);
    if (!partida) {
      return res.status(404).json({ message: "Partida não encontrada." });
    }

    const { usuario_time_id } = req.body ?? {};
    const utid = Number(usuario_time_id);
    if (Number.isNaN(utid)) {
      return res.status(400).json({ message: "Envie usuario_time_id." });
    }

    const conv = await ConvocacaoModel.findOne({
      where: { partida_id: partidaId, time_id: timeId },
    });
    if (!conv) {
      return res.status(404).json({ message: "Convocação não encontrada." });
    }

    const linha = await ConvocacaoAtletaModel.findOne({
      where: { convocacao_id: conv.id, usuario_time_id: utid },
    });
    if (!linha) {
      return res.status(400).json({ message: "Atleta não está nesta convocação." });
    }
    if (linha.presenca_status !== "PENDENTE") {
      return res.status(400).json({
        message: "Só é possível reconvocar atletas com presença pendente.",
      });
    }

    const ut = await UsuarioTimeModel.findOne({
      where: {
        id: utid,
        TimeModelId: timeId,
      },
    });
    if (!ut) {
      return res.status(400).json({ message: "Vínculo inválido para este time." });
    }

    setImmediate(() => {
      notificarReconvocacaoPresenca({
        usuarioIds: [ut.UsuarioModelId],
        partida,
      }).catch((e) => console.error("[push] reconvocar:", e));
    });

    return res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.patch("/meus-jogos/:id/convocacao/presenca", authorize(["Administrador", "Atleta"]), async (req, res, next) => {
  try {
    const vinculo = await getVinculoSelecionado(req);
    if (!vinculo) {
      return res.status(400).json({ message: "Vínculo não encontrado." });
    }

    const papelNome = vinculo.PapelModel?.nome;
    const timeId = vinculo.TimeModelId;
    const partidaId = parseInt(req.params.id, 10);
    if (Number.isNaN(partidaId)) {
      return res.status(400).json({ message: "Id da partida inválido." });
    }

    const partida = await findPartidaDoTime(partidaId, timeId);
    if (!partida) {
      return res.status(404).json({ message: "Partida não encontrada." });
    }

    const { usuario_time_id, presenca_status, motivo_recusa } = req.body ?? {};
    const st = String(presenca_status || "").trim();
    if (!PRESENCA_STATUS.includes(st)) {
      return res.status(400).json({ message: `presenca_status deve ser: ${PRESENCA_STATUS.join(", ")}` });
    }

    let utId = usuario_time_id != null ? Number(usuario_time_id) : NaN;
    if (papelNome === "Atleta") {
      utId = vinculo.id;
    }
    if (Number.isNaN(utId)) {
      return res.status(400).json({ message: "usuario_time_id é obrigatório (administrador)." });
    }

    const conv = await ConvocacaoModel.findOne({ where: { partida_id: partidaId, time_id: timeId } });
    if (!conv) {
      return res.status(404).json({ message: "Convocação não encontrada para este time." });
    }

    const linha = await ConvocacaoAtletaModel.findOne({
      where: { convocacao_id: conv.id, usuario_time_id: utId },
    });
    if (!linha) {
      return res.status(404).json({ message: "Atleta não está na convocação." });
    }

    if (papelNome === "Atleta") {
      if (utId !== vinculo.id) {
        return res.status(403).json({ message: "Você só pode alterar a sua própria presença." });
      }
    }

    await linha.update({
      presenca_status: st,
      presenca_em: new Date(),
      motivo_recusa: st === "RECUSADO" && motivo_recusa ? String(motivo_recusa).trim() : null,
    });

    return res.json({
      usuario_time_id: utId,
      presenca_status: linha.presenca_status,
      presenca_em: linha.presenca_em,
      motivo_recusa: linha.motivo_recusa,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
