const { signMercadoPagoOAuthState, verifyMercadoPagoOAuthState } = require("../auth/jwt");
const { UsuarioTimeModel, PapelModel, TimeMercadoPagoOauthModel } = require("../models");
const {
  isMercadoPagoConfigured,
  generateAuthUrl,
  exchangeAuthorizationCode,
} = require("../services/mercadopago.service");

async function getVinculoDoHeaderUp(usuarioId, upHeader) {
  const membershipId = parseInt(String(upHeader), 10);
  if (Number.isNaN(membershipId)) {
    return null;
  }

  return UsuarioTimeModel.findOne({
    where: { id: membershipId, UsuarioModelId: usuarioId },
    include: [{ model: PapelModel, attributes: ["nome"] }],
  });
}

exports.getAuthUrl = async (req, res) => {
  try {
    if (!isMercadoPagoConfigured()) {
      return res.status(503).json({
        message:
          "Integração Mercado Pago não configurada (MERCADO_PAGO_CLIENT_ID, MERCADO_PAGO_CLIENT_SECRET, MERCADO_PAGO_REDIRECT_URI).",
      });
    }

    const vinculo = await getVinculoDoHeaderUp(req.auth?.UsuarioId, req.headers.up);
    if (!vinculo || vinculo.PapelModel?.nome !== "Administrador") {
      return res.status(403).json({ message: "Apenas administradores podem conectar o Mercado Pago." });
    }

    const state = signMercadoPagoOAuthState(vinculo.TimeModelId, req.auth.UsuarioId);
    const url = generateAuthUrl(state);
    return res.redirect(url);
  } catch (error) {
    console.error(error.response?.data || error.message);
    return res.status(500).json({ message: "Erro ao gerar URL de conexão com Mercado Pago." });
  }
};

exports.handleCallback = async (req, res) => {
  const { code, state, error } = req.query;

  if (error) {
    return res.status(400).json({ message: "OAuth do Mercado Pago retornou erro.", error });
  }
  if (!code || !state || typeof state !== "string") {
    return res.status(400).json({ message: "Parâmetros obrigatórios ausentes no callback." });
  }
  if (!isMercadoPagoConfigured()) {
    return res.status(503).json({
      message:
        "Integração Mercado Pago não configurada (MERCADO_PAGO_CLIENT_ID, MERCADO_PAGO_CLIENT_SECRET, MERCADO_PAGO_REDIRECT_URI).",
    });
  }

  try {
    const { timeId, usuarioId } = verifyMercadoPagoOAuthState(state);

    const vinculo = await UsuarioTimeModel.findOne({
      where: { UsuarioModelId: usuarioId, TimeModelId: timeId },
      include: [{ model: PapelModel, attributes: ["nome"] }],
    });

    if (!vinculo || vinculo.PapelModel?.nome !== "Administrador") {
      return res.status(403).json({ message: "Vínculo inválido para concluir conexão do Mercado Pago." });
    }

    const data = await exchangeAuthorizationCode(code);
    const expiresIn = typeof data.expires_in === "number" ? data.expires_in : null;
    const tokenExpiresAt = expiresIn != null ? new Date(Date.now() + expiresIn * 1000) : null;

    const payload = {
      mpUserId: data.user_id != null ? String(data.user_id) : "unknown",
      accessToken: data.access_token,
      refreshToken: data.refresh_token || null,
      tokenExpiresAt,
      publicKey: data.public_key || null,
    };

    const existing = await TimeMercadoPagoOauthModel.findOne({
      where: { TimeModelId: timeId },
    });

    if (existing) {
      await existing.update(payload);
    } else {
      await TimeMercadoPagoOauthModel.create({
        TimeModelId: timeId,
        ...payload,
      });
    }

    return res.status(200).json({ message: "Conta Mercado Pago conectada com sucesso." });
  } catch (error) {
    console.error(error.response?.data || error.message);
    return res.status(500).json({ message: "Erro ao conectar conta Mercado Pago." });
  }
};