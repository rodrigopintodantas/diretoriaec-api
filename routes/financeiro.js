const express = require("express");
const { authorize } = require("../auth/authorize");
const {
  signMercadoPagoOAuthState,
  verifyMercadoPagoOAuthState,
} = require("../auth/jwt");
const {
  UsuarioTimeModel,
  TimeModel,
  PapelModel,
  TimeMercadoPagoOauthModel,
} = require("../models");

const router = express.Router();

function getRedirectUri() {
  return process.env.MERCADO_PAGO_REDIRECT_URI || "";
}

function getFrontendBase() {
  return (process.env.FRONTEND_URL || "http://localhost:4200").replace(/\/$/, "");
}

function isMercadoPagoConfigured() {
  return !!(
    process.env.MERCADO_PAGO_CLIENT_ID &&
    process.env.MERCADO_PAGO_CLIENT_SECRET &&
    getRedirectUri()
  );
}

async function getVinculoAdminNoTime(req) {
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

/** Callback OAuth (sem JWT): Mercado Pago redireciona aqui. */
router.get("/mercado-pago/callback", async (req, res) => {
  const front = getFrontendBase();
  const fail = (code) => res.redirect(302, `${front}/admin/financeiro?mp=${code}`);

  const { code, state, error, error_description: errorDescription } = req.query;

  if (error) {
    console.warn("Mercado Pago OAuth error:", error, errorDescription);
    return fail("erro");
  }

  if (!code || !state || typeof state !== "string") {
    return fail("erro");
  }

  if (!isMercadoPagoConfigured()) {
    return fail("config");
  }

  let timeId;
  let usuarioId;
  try {
    const payload = verifyMercadoPagoOAuthState(state);
    timeId = payload.timeId;
    usuarioId = payload.usuarioId;
  } catch (e) {
    console.warn("Estado OAuth inválido:", e.message);
    return fail("erro");
  }

  const vinculo = await UsuarioTimeModel.findOne({
    where: {
      UsuarioModelId: usuarioId,
      TimeModelId: timeId,
    },
    include: [{ model: PapelModel, attributes: ["nome"] }],
  });

  if (!vinculo || vinculo.PapelModel.nome !== "Administrador") {
    return fail("erro");
  }

  const redirectUri = getRedirectUri();
  const clientId = process.env.MERCADO_PAGO_CLIENT_ID;
  const clientSecret = process.env.MERCADO_PAGO_CLIENT_SECRET;

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: clientId,
    client_secret: clientSecret,
    code: String(code),
    redirect_uri: redirectUri,
  });

  let tokenRes;
  try {
    tokenRes = await fetch("https://api.mercadopago.com/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: body.toString(),
    });
  } catch (e) {
    console.error("Falha ao chamar token Mercado Pago:", e);
    return fail("erro");
  }

  const data = await tokenRes.json().catch(() => ({}));
  if (!tokenRes.ok || !data.access_token) {
    console.warn("Token MP inválido:", data);
    return fail("erro");
  }

  const expiresIn = typeof data.expires_in === "number" ? data.expires_in : null;
  const tokenExpiresAt =
    expiresIn != null ? new Date(Date.now() + expiresIn * 1000) : null;

  const rowPayload = {
    mpUserId: data.user_id != null ? String(data.user_id) : "",
    accessToken: data.access_token,
    refreshToken: data.refresh_token || null,
    tokenExpiresAt,
    publicKey: data.public_key || null,
  };

  const existing = await TimeMercadoPagoOauthModel.findOne({ where: { TimeModelId: timeId } });
  if (existing) {
    await existing.update(rowPayload);
  } else {
    await TimeMercadoPagoOauthModel.create({
      TimeModelId: timeId,
      ...rowPayload,
    });
  }

  return res.redirect(302, `${front}/admin/financeiro?mp=ok`);
});

router.get("/mercado-pago/status", authorize(["Administrador"]), async (req, res) => {
  try {
    const vinculo = await getVinculoAdminNoTime(req);
    if (!vinculo) {
      return res.status(400).json({ message: "Vínculo com o time não encontrado." });
    }

    const timeId = vinculo.TimeModelId;
    const row = await TimeMercadoPagoOauthModel.findOne({
      where: { TimeModelId: timeId },
      attributes: ["id", "mpUserId", "tokenExpiresAt", "updatedAt"],
    });

    return res.status(200).json({
      configured: isMercadoPagoConfigured(),
      connected: !!row,
      mpUserId: row ? row.mpUserId : null,
      tokenExpiresAt: row ? row.tokenExpiresAt : null,
      timeNome: vinculo.TimeModel?.nome ?? null,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Erro ao consultar Mercado Pago." });
  }
});

router.get("/mercado-pago/conectar", authorize(["Administrador"]), async (req, res) => {
  try {
    if (!isMercadoPagoConfigured()) {
      return res.status(503).json({
        message:
          "Integração Mercado Pago não configurada no servidor (CLIENT_ID, CLIENT_SECRET, REDIRECT_URI).",
      });
    }

    const vinculo = await getVinculoAdminNoTime(req);
    if (!vinculo) {
      return res.status(400).json({ message: "Vínculo com o time não encontrado." });
    }
    if (vinculo.PapelModel.nome !== "Administrador") {
      return res.status(403).json({ message: "Apenas administradores podem conectar." });
    }

    const timeId = vinculo.TimeModelId;
    const state = signMercadoPagoOAuthState(timeId, req.auth.UsuarioId);
    const redirectUri = getRedirectUri();
    const clientId = process.env.MERCADO_PAGO_CLIENT_ID;
    const authBase = process.env.MERCADO_PAGO_AUTH_BASE || "https://auth.mercadopago.com.br";

    const params = new URLSearchParams({
      client_id: clientId,
      response_type: "code",
      platform_id: "mp",
      state,
      redirect_uri: redirectUri,
    });

    const url = `${authBase.replace(/\/$/, "")}/authorization?${params.toString()}`;
    return res.status(200).json({ url });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Erro ao montar URL de conexão." });
  }
});

module.exports = router;
