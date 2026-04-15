const {
  UsuarioTimeModel,
  UsuarioModel,
  PapelModel,
  TimeMercadoPagoOauthModel,
  FinanceiroCobrancaModel,
} = require("../models");
const {
  ensureValidAccessToken,
  createPreferenceWithToken,
  getPaymentWithToken,
} = require("../services/mercadopago.service");

function mapPaymentStatusToLocal(mpStatus) {
  if (mpStatus === "approved") return "pago";
  if (["rejected", "cancelled", "refunded", "charged_back"].includes(mpStatus)) return "cancelado";
  return "pendente";
}

/** Base do front para back_urls (FRONTEND_URL ou localhost). */
function normalizeFrontendBase() {
  const raw = (process.env.FRONTEND_URL || "http://localhost:4200").trim();
  const base = raw.replace(/\/$/, "");
  if (!/^https?:\/\//i.test(base)) {
    return "http://localhost:4200";
  }
  return base;
}

/**
 * Com `auto_return`, o MP exige `back_urls.success` válido (em produção costuma exigir HTTPS).
 * Em http://localhost ou https://* podemos usar auto_return; caso contrário omitimos para evitar invalid_auto_return.
 */
function mercadoPagoAceitaAutoReturnParaUrl(successUrl) {
  try {
    const u = new URL(successUrl);
    if (u.protocol === "https:") return true;
    if (u.protocol === "http:" && (u.hostname === "localhost" || u.hostname === "127.0.0.1")) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/** Apenas dígitos; retorna null se inválido. */
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

/**
 * Checkout Pro: por padrão não restringe meios (todos os que a conta MP permitir).
 * Para excluir cartão/débito/boleto na preferência, defina MERCADO_PAGO_PREFERENCIA_APENAS_PIX=true no ambiente.
 * Obs.: o MP não permite excluir "dinheiro em conta" (saldo); pode continuar aparecendo.
 */
function paymentMethodsPreferenciaPix() {
  if (process.env.MERCADO_PAGO_PREFERENCIA_APENAS_PIX !== "true") {
    return null;
  }
  return {
    excluded_payment_types: [{ id: "credit_card" }, { id: "debit_card" }, { id: "ticket" }],
  };
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

    const items = rows.map((r) => {
      const u = r.UsuarioTimeModel?.UsuarioModel;
      return {
        id: r.id,
        valor: r.valor,
        descricao: r.descricao,
        status: r.status,
        externalReference: r.externalReference,
        mpPreferenceId: r.mpPreferenceId,
        mpPaymentId: r.mpPaymentId,
        initPoint: r.initPoint,
        sandboxInitPoint: r.sandboxInitPoint,
        payerEmail: r.payerEmail,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        atleta: u
          ? {
              nome: u.nome,
              email: u.email,
              login: u.login,
            }
          : null,
      };
    });

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
      return res.status(403).json({ message: "Apenas administradores podem gerar cobranças." });
    }

    const timeId = vinculo.TimeModelId;
    const oauthRow = await TimeMercadoPagoOauthModel.findOne({
      where: { TimeModelId: timeId },
    });
    if (!oauthRow) {
      return res.status(400).json({ message: "Conecte a conta Mercado Pago do clube antes de gerar cobranças." });
    }

    const usuarioTimeId = parseInt(String(req.body?.usuario_time_id), 10);
    const valorNum = Number(req.body?.valor);
    const descricao = String(req.body?.descricao ?? "").trim();

    if (Number.isNaN(usuarioTimeId) || usuarioTimeId <= 0) {
      return res.status(400).json({ message: "Informe o atleta (usuario_time_id)." });
    }
    if (!Number.isFinite(valorNum) || valorNum < 0.5) {
      return res.status(400).json({ message: "Valor mínimo é R$ 0,50." });
    }
    if (descricao.length < 3 || descricao.length > 500) {
      return res.status(400).json({ message: "Descrição deve ter entre 3 e 500 caracteres." });
    }

    const papelAtleta = await PapelModel.findOne({ where: { nome: "Atleta" }, attributes: ["id"] });
    if (!papelAtleta) {
      return res.status(500).json({ message: "Papel Atleta não encontrado no sistema." });
    }

    const alvo = await UsuarioTimeModel.findOne({
      where: {
        id: usuarioTimeId,
        TimeModelId: timeId,
        PapelModelId: papelAtleta.id,
      },
      include: [{ model: UsuarioModel, attributes: ["id", "nome", "email"] }],
    });

    if (!alvo) {
      return res.status(400).json({ message: "Atleta não encontrado neste time." });
    }

    const email = alvo.UsuarioModel?.email ? String(alvo.UsuarioModel.email).trim() : "";
    if (!email) {
      return res.status(400).json({
        message: "O atleta precisa ter e-mail cadastrado para gerar o link de pagamento.",
      });
    }

    const cpfInformado = req.body?.payer_cpf != null ? String(req.body.payer_cpf).trim() : "";
    const cpfValido = validarCpfBrasil(cpfInformado);
    if (cpfInformado.length > 0 && !cpfValido) {
      return res.status(400).json({ message: "CPF do pagador inválido. Informe 11 dígitos válidos ou deixe em branco." });
    }

    const cobranca = await FinanceiroCobrancaModel.create({
      TimeModelId: timeId,
      UsuarioTimeModelId: alvo.id,
      valor: valorNum.toFixed(2),
      descricao,
      status: "pendente",
      payerEmail: email,
    });

    const externalReference = `fc-${cobranca.id}`;
    await cobranca.update({ externalReference });

    const accessToken = await ensureValidAccessToken(oauthRow);

    const publicBase = (process.env.API_PUBLIC_URL || "").replace(/\/$/, "");
    const front = normalizeFrontendBase();
    const webhookToken = process.env.MERCADO_PAGO_WEBHOOK_TOKEN || "";
    const notificationPath = `/api/financeiro/mercado-pago/webhook`;
    const notificationUrl = publicBase
      ? `${publicBase}${notificationPath}${webhookToken ? `?token=${encodeURIComponent(webhookToken)}` : ""}`
      : undefined;

    const successUrl = `${front}/admin/financeiro?mp=cobranca_ok`;
    const nomeAtleta = alvo.UsuarioModel?.nome ? String(alvo.UsuarioModel.nome) : "";
    const { first_name, last_name } = nomeParaPayerMercadoPago(nomeAtleta);
    const payer = {
      email,
      first_name,
      last_name,
    };
    if (cpfValido) {
      payer.identification = { type: "CPF", number: cpfValido };
    }

    const preferenceBody = {
      items: [
        {
          title: descricao.slice(0, 256),
          quantity: 1,
          unit_price: valorNum,
          currency_id: "BRL",
        },
      ],
      payer,
      external_reference: externalReference,
      back_urls: {
        success: successUrl,
        failure: `${front}/admin/financeiro?mp=cobranca_erro`,
        pending: `${front}/admin/financeiro?mp=cobranca_pendente`,
      },
    };

    if (mercadoPagoAceitaAutoReturnParaUrl(successUrl)) {
      preferenceBody.auto_return = "approved";
    }

    if (notificationUrl) {
      preferenceBody.notification_url = notificationUrl;
    }

    const pixOnly = paymentMethodsPreferenciaPix();
    if (pixOnly) {
      preferenceBody.payment_methods = pixOnly;
    }

    const pref = await createPreferenceWithToken(accessToken, preferenceBody);

    await cobranca.update({
      mpPreferenceId: pref.id != null ? String(pref.id) : null,
      initPoint: pref.init_point || null,
      sandboxInitPoint: pref.sandbox_init_point || null,
    });

    return res.status(201).json({
      id: cobranca.id,
      externalReference,
      status: cobranca.status,
      initPoint: pref.init_point || null,
      sandboxInitPoint: pref.sandbox_init_point || null,
      mpPreferenceId: pref.id != null ? String(pref.id) : null,
      warning:
        !publicBase &&
        "Defina API_PUBLIC_URL na API para que o Mercado Pago notifique pagamentos automaticamente (webhook).",
    });
  } catch (error) {
    console.error(error.response?.data || error.message);
    const status = error.response?.status || 500;
    return res.status(status >= 400 && status < 600 ? status : 500).json({
      message: "Erro ao criar preferência no Mercado Pago.",
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
