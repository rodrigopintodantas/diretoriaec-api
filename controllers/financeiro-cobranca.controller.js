const {
  UsuarioTimeModel,
  UsuarioModel,
  PapelModel,
  TimeMercadoPagoOauthModel,
  FinanceiroCobrancaModel,
} = require("../models");
const {
  ensureValidAccessToken,
  getPaymentWithToken,
} = require("../services/mercadopago.service");
const { randomUUID } = require("crypto");

function mapPaymentStatusToLocal(mpStatus) {
  if (mpStatus === "approved") return "pago";
  if (["rejected", "cancelled", "refunded", "charged_back"].includes(mpStatus)) return "cancelado";
  return "pendente";
}

const TAXA_MP = 0.009;

function calcularValorCobrado(valorInformado) {
  const valorCentavos = Math.round(Number(valorInformado) * 100);
  const valorCobradoCentavos = Math.ceil(valorCentavos / (1 - TAXA_MP));
  return Number((valorCobradoCentavos / 100).toFixed(2));
}

function calcularStatusGrupo(itens) {
  const statuses = [...new Set(itens.map((i) => String(i.status || "").trim().toLowerCase()))];
  if (!statuses.length) return "pendente";
  if (statuses.length === 1) return statuses[0];
  if (statuses.includes("pendente")) return "pendente";
  if (statuses.includes("pago")) return "parcial";
  return statuses[0];
}

async function getVinculoAdmin(req) {
  const membershipId = parseInt(String(req.headers.up), 10);
  if (Number.isNaN(membershipId)) {
    return null;
  }
  return UsuarioTimeModel.findOne({
    where: {
      id: membershipId,
      UsuarioModelId: req.auth.UsuarioId,
    },
    include: [{ model: PapelModel, attributes: ["nome"] }],
  });
}

exports.listCobrancas = async (req, res) => {
  try {
    const vinculo = await getVinculoAdmin(req);
    if (!vinculo || vinculo.PapelModel?.nome !== "Administrador") {
      return res.status(403).json({ message: "Apenas administradores podem listar cobranças." });
    }

    const rows = await FinanceiroCobrancaModel.findAll({
      where: { TimeModelId: vinculo.TimeModelId },
      order: [["createdAt", "DESC"]],
      limit: 100,
      include: [
        {
          model: UsuarioTimeModel,
          attributes: ["id"],
          include: [{ model: UsuarioModel, attributes: ["id", "nome", "email", "login"] }],
        },
      ],
    });

    const grupos = new Map();
    for (const r of rows) {
      const u = r.UsuarioTimeModel?.UsuarioModel;
      const grupoId = r.grupoCobrancaId || `legacy-${r.id}`;
      if (!grupos.has(grupoId)) {
        grupos.set(grupoId, {
          id: grupoId,
          nome: r.nome,
          descricao: r.descricao,
          valor: r.valor,
          valorCobrado: r.valorCobrado,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
          atletas: [],
        });
      }
      const grupo = grupos.get(grupoId);
      grupo.atletas.push({
        id: r.id,
        status: r.status,
        valor: r.valor,
        valorCobrado: r.valorCobrado,
        externalReference: r.externalReference,
        mpPreferenceId: r.mpPreferenceId,
        mpPaymentId: r.mpPaymentId,
        initPoint: r.initPoint,
        sandboxInitPoint: r.sandboxInitPoint,
        payerEmail: r.payerEmail,
        atleta: u
          ? {
              nome: u.nome,
              email: u.email,
              login: u.login,
            }
          : null,
      });
    }

    const items = [...grupos.values()].map((grupo) => ({
      ...grupo,
      status: calcularStatusGrupo(grupo.atletas),
    }));

    return res.status(200).json({ items });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Erro ao listar cobranças." });
  }
};

exports.createCobranca = async (req, res) => {
  try {
    const vinculo = await getVinculoAdmin(req);
    if (!vinculo || vinculo.PapelModel?.nome !== "Administrador") {
      return res.status(403).json({ message: "Apenas administradores podem criar cobranças." });
    }

    const timeId = vinculo.TimeModelId;
    const valorNum = Number(req.body?.valor);
    const nome = String(req.body?.nome ?? "").trim();
    const descricao = String(req.body?.descricao ?? "").trim();

    if (!Number.isFinite(valorNum) || valorNum < 0.5) {
      return res.status(400).json({ message: "Valor mínimo é R$ 0,50." });
    }
    if (nome.length < 3 || nome.length > 120) {
      return res.status(400).json({ message: "Nome deve ter entre 3 e 120 caracteres." });
    }
    if (descricao.length < 3 || descricao.length > 500) {
      return res.status(400).json({ message: "Descrição deve ter entre 3 e 500 caracteres." });
    }
    const valorCobradoNum = calcularValorCobrado(valorNum);

    let idsRaw = Array.isArray(req.body?.usuario_time_ids) ? req.body.usuario_time_ids : [];
    if (!idsRaw.length && req.body?.usuario_time_id != null) {
      idsRaw = [req.body.usuario_time_id];
    }
    const usuarioTimeIds = [...new Set(idsRaw.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0))];
    if (!usuarioTimeIds.length) {
      return res.status(400).json({ message: "Selecione ao menos um atleta para a cobrança." });
    }

    const papelAtleta = await PapelModel.findOne({ where: { nome: "Atleta" }, attributes: ["id"] });
    if (!papelAtleta) {
      return res.status(500).json({ message: "Papel Atleta não encontrado no sistema." });
    }

    const atletasAlvo = await UsuarioTimeModel.findAll({
      where: {
        id: usuarioTimeIds,
        TimeModelId: timeId,
        PapelModelId: papelAtleta.id,
      },
      include: [{ model: UsuarioModel, attributes: ["id", "nome", "email"] }],
    });

    if (atletasAlvo.length !== usuarioTimeIds.length) {
      return res.status(400).json({ message: "Um ou mais atletas selecionados não pertencem a este time." });
    }

    const grupoCobrancaId = randomUUID();
    const cobrancasCriadas = [];
    for (const alvo of atletasAlvo) {
      const email = alvo.UsuarioModel?.email ? String(alvo.UsuarioModel.email).trim() : null;
      const cobranca = await FinanceiroCobrancaModel.create({
        TimeModelId: timeId,
        UsuarioTimeModelId: alvo.id,
        grupoCobrancaId,
        valor: valorNum.toFixed(2),
        valorCobrado: valorCobradoNum.toFixed(2),
        nome,
        descricao,
        status: "pendente",
        payerEmail: email,
      });
      cobrancasCriadas.push({
        id: cobranca.id,
        grupoCobrancaId: cobranca.grupoCobrancaId,
        valor: cobranca.valor,
        valorCobrado: cobranca.valorCobrado,
        nome: cobranca.nome,
        descricao: cobranca.descricao,
        status: cobranca.status,
        createdAt: cobranca.createdAt,
        atleta: {
          usuario_time_id: alvo.id,
          nome: alvo.UsuarioModel?.nome ?? "Atleta",
          email: email,
        },
      });
    }

    return res.status(201).json({
      items: cobrancasCriadas,
    });
  } catch (error) {
    console.error(error.response?.data || error.message);
    const status = error.response?.status || 500;
    return res.status(status >= 400 && status < 600 ? status : 500).json({
      message: "Erro ao criar cobranças.",
      details: error.response?.data || null,
    });
  }
};

exports.syncCobranca = async (req, res) => {
  try {
    const vinculo = await getVinculoAdmin(req);
    if (!vinculo || vinculo.PapelModel?.nome !== "Administrador") {
      return res.status(403).json({ message: "Acesso negado." });
    }

    const id = parseInt(String(req.params.id), 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ message: "Id inválido." });
    }

    const cobranca = await FinanceiroCobrancaModel.findOne({
      where: { id, TimeModelId: vinculo.TimeModelId },
    });
    if (!cobranca) {
      return res.status(404).json({ message: "Cobrança não encontrada." });
    }

    const oauthRow = await TimeMercadoPagoOauthModel.findOne({
      where: { TimeModelId: vinculo.TimeModelId },
    });
    if (!oauthRow) {
      return res.status(400).json({ message: "Mercado Pago não conectado." });
    }

    if (!cobranca.mpPaymentId) {
      return res.status(400).json({ message: "Ainda não há pagamento associado a esta cobrança." });
    }

    const accessToken = await ensureValidAccessToken(oauthRow);
    const payment = await getPaymentWithToken(accessToken, cobranca.mpPaymentId);
    const status = mapPaymentStatusToLocal(payment.status);

    await cobranca.update({
      status,
      mpPaymentId: String(payment.id),
    });

    return res.status(200).json({
      id: cobranca.id,
      status,
      mpStatus: payment.status,
    });
  } catch (error) {
    console.error(error.response?.data || error.message);
    return res.status(500).json({ message: "Erro ao sincronizar com o Mercado Pago." });
  }
};

async function resolvePaymentFromWebhook(paymentId) {
  const rows = await TimeMercadoPagoOauthModel.findAll({
    attributes: ["id", "TimeModelId", "accessToken", "refreshToken", "tokenExpiresAt", "mpUserId"],
  });

  for (const row of rows) {
    try {
      const token = await ensureValidAccessToken(row);
      const payment = await getPaymentWithToken(token, paymentId);
      return { payment, oauthRow: row };
    } catch (e) {
      const code = e.response?.status;
      if (code === 401 || code === 403 || code === 404) {
        continue;
      }
      throw e;
    }
  }
  return null;
}

function extractPaymentIdFromWebhook(req) {
  const q = req.query || {};
  const body = req.body || {};
  const direct =
    q["data.id"] ||
    q.id ||
    (body.data && body.data.id) ||
    body.resource ||
    body.id;
  if (direct == null) return null;
  if (typeof direct === "object" && direct.id != null) {
    return String(direct.id);
  }
  const s = String(direct);
  const m = s.match(/payments\/(\d+)/);
  if (m) return m[1];
  if (/^\d+$/.test(s)) return s;
  return null;
}

exports.handleMercadoPagoWebhook = async (req, res) => {
  const token = process.env.MERCADO_PAGO_WEBHOOK_TOKEN;
  if (token && String(req.query.token || "") !== String(token)) {
    return res.status(403).json({ message: "Token inválido." });
  }

  try {
    const paymentId = extractPaymentIdFromWebhook(req);

    if (!paymentId) {
      return res.status(200).json({ ok: true });
    }

    let result = null;
    const mpUserId =
      (req.body && req.body.user_id != null && String(req.body.user_id)) ||
      (q.user_id != null && String(q.user_id));

    if (mpUserId) {
      const oauthRow = await TimeMercadoPagoOauthModel.findOne({
        where: { mpUserId: String(mpUserId) },
      });
      if (oauthRow) {
        const accessToken = await ensureValidAccessToken(oauthRow);
        const payment = await getPaymentWithToken(accessToken, paymentId);
        result = { payment, oauthRow };
      }
    }

    if (!result) {
      result = await resolvePaymentFromWebhook(paymentId);
    }

    if (!result) {
      return res.status(200).json({ ok: true });
    }

    const { payment, oauthRow } = result;
    const extRef = payment.external_reference;
    if (!extRef || String(extRef).indexOf("fc-") !== 0) {
      return res.status(200).json({ ok: true });
    }

    const cobrancaId = parseInt(String(extRef).replace(/^fc-/, ""), 10);
    if (Number.isNaN(cobrancaId)) {
      return res.status(200).json({ ok: true });
    }

    const cobranca = await FinanceiroCobrancaModel.findByPk(cobrancaId);
    if (!cobranca || cobranca.TimeModelId !== oauthRow.TimeModelId) {
      return res.status(200).json({ ok: true });
    }

    const status = mapPaymentStatusToLocal(payment.status);
    await cobranca.update({
      status,
      mpPaymentId: String(payment.id),
    });

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("Webhook MP:", e.response?.data || e.message);
    return res.status(200).json({ ok: true });
  }
};
