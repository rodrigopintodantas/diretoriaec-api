const {
  UsuarioTimeModel,
  UsuarioModel,
  PapelModel,
  TimeMercadoPagoOauthModel,
  FinanceiroCobrancaModel,
} = require("../models");
const {
  ensureValidAccessToken,
  createPaymentWithToken,
  getPaymentWithToken,
} = require("../services/mercadopago.service");
const { randomUUID } = require("crypto");
const { Op } = require("sequelize");

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

function validarCpfBrasil(raw) {
  if (raw == null || raw === "") return null;
  const d = String(raw).replace(/\D/g, "");
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return null;
  let s = 0;
  for (let i = 0; i < 9; i += 1) s += parseInt(d[i], 10) * (10 - i);
  let r = (s * 10) % 11;
  if (r === 10 || r === 11) r = 0;
  if (r !== parseInt(d[9], 10)) return null;
  s = 0;
  for (let i = 0; i < 10; i += 1) s += parseInt(d[i], 10) * (11 - i);
  r = (s * 10) % 11;
  if (r === 10 || r === 11) r = 0;
  if (r !== parseInt(d[10], 10)) return null;
  return d;
}

function nomeParaPayerMercadoPago(nomeCompleto) {
  const partes = String(nomeCompleto ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const first = partes[0] || "Cliente";
  const last = partes.length > 1 ? partes.slice(1).join(" ") : first;
  return { first_name: first.slice(0, 256), last_name: last.slice(0, 256) };
}

function buildNotificationUrl() {
  const publicBase = (process.env.API_PUBLIC_URL || "").replace(/\/$/, "");
  if (!publicBase) {
    return null;
  }
  const webhookToken = process.env.MERCADO_PAGO_WEBHOOK_TOKEN || "";
  const path = "/api/financeiro/mercado-pago/webhook";
  return `${publicBase}${path}${webhookToken ? `?token=${encodeURIComponent(webhookToken)}` : ""}`;
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

async function getVinculoAtleta(req) {
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

exports.listCobrancasAtleta = async (req, res) => {
  try {
    const vinculo = await getVinculoAtleta(req);
    if (!vinculo || vinculo.PapelModel?.nome !== "Atleta") {
      return res.status(403).json({ message: "Apenas atletas podem listar suas cobranças." });
    }

    const rows = await FinanceiroCobrancaModel.findAll({
      where: {
        TimeModelId: vinculo.TimeModelId,
        UsuarioTimeModelId: vinculo.id,
      },
      order: [["createdAt", "DESC"]],
      limit: 100,
    });

    const items = rows.map((r) => ({
      id: r.id,
      grupoCobrancaId: r.grupoCobrancaId,
      nome: r.nome,
      descricao: r.descricao,
      status: r.status,
      valor: r.valor,
      valorCobrado: r.valorCobrado,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));

    const pendentes = items.filter((item) => String(item.status || "").trim().toLowerCase() === "pendente");
    const anteriores = items.filter((item) => String(item.status || "").trim().toLowerCase() !== "pendente");

    return res.status(200).json({ pendentes, anteriores });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Erro ao listar cobranças do atleta." });
  }
};

exports.getCobrancaAtleta = async (req, res) => {
  try {
    const vinculo = await getVinculoAtleta(req);
    if (!vinculo || vinculo.PapelModel?.nome !== "Atleta") {
      return res.status(403).json({ message: "Apenas atletas podem consultar suas cobranças." });
    }

    const id = parseInt(String(req.params.id), 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ message: "Id inválido." });
    }

    const cobranca = await FinanceiroCobrancaModel.findOne({
      where: {
        id,
        TimeModelId: vinculo.TimeModelId,
        UsuarioTimeModelId: vinculo.id,
      },
    });
    if (!cobranca) {
      return res.status(404).json({ message: "Cobrança não encontrada." });
    }

    return res.status(200).json({
      id: cobranca.id,
      grupoCobrancaId: cobranca.grupoCobrancaId,
      nome: cobranca.nome,
      descricao: cobranca.descricao,
      status: cobranca.status,
      valor: cobranca.valor,
      valorCobrado: cobranca.valorCobrado,
      createdAt: cobranca.createdAt,
      updatedAt: cobranca.updatedAt,
      mpPaymentId: cobranca.mpPaymentId,
      externalReference: cobranca.externalReference,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Erro ao consultar cobrança do atleta." });
  }
};

exports.gerarPixCobrancaAtleta = async (req, res) => {
  try {
    const vinculo = await getVinculoAtleta(req);
    if (!vinculo || vinculo.PapelModel?.nome !== "Atleta") {
      return res.status(403).json({ message: "Apenas atletas podem gerar PIX para suas cobranças." });
    }

    const id = parseInt(String(req.params.id), 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ message: "Id inválido." });
    }

    const cobranca = await FinanceiroCobrancaModel.findOne({
      where: {
        id,
        TimeModelId: vinculo.TimeModelId,
        UsuarioTimeModelId: vinculo.id,
      },
      include: [
        {
          model: UsuarioTimeModel,
          attributes: ["id"],
          include: [{ model: UsuarioModel, attributes: ["nome", "email"] }],
        },
      ],
    });
    if (!cobranca) {
      return res.status(404).json({ message: "Cobrança não encontrada." });
    }

    const statusAtual = String(cobranca.status || "").trim().toLowerCase();
    if (statusAtual !== "pendente") {
      return res.status(400).json({ message: "Somente cobranças pendentes podem gerar PIX." });
    }

    const cpfValido = validarCpfBrasil(req.body?.payer_cpf);
    if (!cpfValido) {
      return res.status(400).json({ message: "CPF do pagador inválido. Informe 11 dígitos válidos." });
    }

    const oauthRow = await TimeMercadoPagoOauthModel.findOne({
      where: { TimeModelId: vinculo.TimeModelId },
    });
    if (!oauthRow) {
      return res.status(400).json({ message: "Mercado Pago não conectado para este clube." });
    }

    const accessToken = await ensureValidAccessToken(oauthRow);
    const email = cobranca.payerEmail || cobranca.UsuarioTimeModel?.UsuarioModel?.email;
    if (!email) {
      return res.status(400).json({ message: "Atleta sem e-mail cadastrado para gerar o pagamento." });
    }

    const nomePagador = cobranca.UsuarioTimeModel?.UsuarioModel?.nome || "Cliente";
    const { first_name, last_name } = nomeParaPayerMercadoPago(nomePagador);
    const externalReference = cobranca.externalReference || `fc-${cobranca.id}`;

    const paymentBody = {
      transaction_amount: Number(cobranca.valorCobrado),
      description: `${cobranca.nome} - ${cobranca.descricao}`.slice(0, 256),
      payment_method_id: "pix",
      payer: {
        email: String(email).trim(),
        first_name,
        last_name,
        identification: { type: "CPF", number: cpfValido },
      },
      external_reference: externalReference,
    };
    const notificationUrl = buildNotificationUrl();
    if (notificationUrl) {
      paymentBody.notification_url = notificationUrl;
    }

    const payment = await createPaymentWithToken(accessToken, paymentBody, {
      idempotencyKey: `pix-cobranca-${cobranca.id}-${cpfValido}`,
    });

    const tx = payment.point_of_interaction?.transaction_data || {};
    await cobranca.update({
      externalReference,
      mpPaymentId: payment.id != null ? String(payment.id) : cobranca.mpPaymentId,
      payerEmail: String(email).trim(),
    });

    return res.status(200).json({
      id: cobranca.id,
      status: cobranca.status,
      mpPaymentId: payment.id != null ? String(payment.id) : null,
      pix: {
        qrCodeBase64: tx.qr_code_base64 || null,
        qrCode: tx.qr_code || null,
        ticketUrl: tx.ticket_url || null,
      },
    });
  } catch (error) {
    console.error(error.response?.data || error.message);
    const status = error.response?.status || 500;
    return res.status(status >= 400 && status < 600 ? status : 500).json({
      message: "Erro ao gerar PIX da cobrança.",
      details: error.response?.data || null,
    });
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

exports.syncCobrancasPendentesAdmin = async (req, res) => {
  try {
    const vinculo = await getVinculoAdmin(req);
    if (!vinculo || vinculo.PapelModel?.nome !== "Administrador") {
      return res.status(403).json({ message: "Acesso negado." });
    }

    const oauthRow = await TimeMercadoPagoOauthModel.findOne({
      where: { TimeModelId: vinculo.TimeModelId },
    });
    if (!oauthRow) {
      return res.status(200).json({ ok: true, sincronizadas: 0, falhas: 0, motivo: "mp_nao_conectado" });
    }

    const pendentes = await FinanceiroCobrancaModel.findAll({
      where: {
        TimeModelId: vinculo.TimeModelId,
        status: "pendente",
        mpPaymentId: { [Op.ne]: null },
      },
      attributes: ["id", "status", "mpPaymentId"],
      order: [["updatedAt", "DESC"]],
      limit: 300,
    });

    if (!pendentes.length) {
      return res.status(200).json({ ok: true, sincronizadas: 0, falhas: 0 });
    }

    const accessToken = await ensureValidAccessToken(oauthRow);
    let sincronizadas = 0;
    let falhas = 0;

    for (const cobranca of pendentes) {
      try {
        const payment = await getPaymentWithToken(accessToken, cobranca.mpPaymentId);
        const novoStatus = mapPaymentStatusToLocal(payment.status);
        await cobranca.update({
          status: novoStatus,
          mpPaymentId: payment.id != null ? String(payment.id) : cobranca.mpPaymentId,
        });
        sincronizadas += 1;
      } catch (e) {
        falhas += 1;
      }
    }

    return res.status(200).json({ ok: true, sincronizadas, falhas });
  } catch (error) {
    console.error(error.response?.data || error.message);
    return res.status(500).json({ message: "Erro ao sincronizar cobranças pendentes." });
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
    const q = req.query || {};
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
