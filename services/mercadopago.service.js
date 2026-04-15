const axios = require("axios");
const config = require("../config/mercadopago");

function isMercadoPagoConfigured() {
  return !!(config.clientId && config.clientSecret && config.redirectUri);
}

function generateAuthUrl(state) {
  const params = new URLSearchParams({
    client_id: config.clientId,
    response_type: "code",
    platform_id: "mp",
    redirect_uri: config.redirectUri,
  });

  if (state) {
    params.set("state", state);
  }

  return `${config.authBase.replace(/\/$/, "")}/authorization?${params.toString()}`;
}

async function exchangeAuthorizationCode(code) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code: String(code),
    redirect_uri: config.redirectUri,
  });

  const response = await axios.post(
    `${config.apiBase.replace(/\/$/, "")}/oauth/token`,
    body.toString(),
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
    },
  );

  return response.data;
}

async function createPaymentWithToken(accessToken, payload) {
  const response = await axios.post(
    `${config.apiBase.replace(/\/$/, "")}/v1/payments`,
    payload,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  return response.data;
}

async function refreshAccessToken(refreshToken) {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: String(refreshToken),
  });

  const response = await axios.post(
    `${config.apiBase.replace(/\/$/, "")}/oauth/token`,
    body.toString(),
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
    },
  );

  return response.data;
}

/**
 * Garante access token válido (refresh OAuth quando próximo do vencimento).
 * @param {import("sequelize").Model & { accessToken: string; refreshToken: string | null; tokenExpiresAt: Date | null }} oauthRow
 */
async function ensureValidAccessToken(oauthRow) {
  const marginMs = 120 * 1000;
  const exp = oauthRow.tokenExpiresAt ? oauthRow.tokenExpiresAt.getTime() : null;
  if (exp != null && exp > Date.now() + marginMs) {
    return oauthRow.accessToken;
  }
  if (oauthRow.refreshToken) {
    const data = await refreshAccessToken(oauthRow.refreshToken);
    await oauthRow.update({
      accessToken: data.access_token,
      refreshToken: data.refresh_token || oauthRow.refreshToken,
      tokenExpiresAt:
        typeof data.expires_in === "number"
          ? new Date(Date.now() + data.expires_in * 1000)
          : oauthRow.tokenExpiresAt,
      mpUserId: data.user_id != null ? String(data.user_id) : oauthRow.mpUserId,
    });
    return oauthRow.accessToken;
  }
  return oauthRow.accessToken;
}

async function createPreferenceWithToken(accessToken, payload) {
  const response = await axios.post(
    `${config.apiBase.replace(/\/$/, "")}/checkout/preferences`,
    payload,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    },
  );

  return response.data;
}

async function getPaymentWithToken(accessToken, paymentId) {
  const response = await axios.get(
    `${config.apiBase.replace(/\/$/, "")}/v1/payments/${encodeURIComponent(String(paymentId))}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    },
  );

  return response.data;
}

module.exports = {
  isMercadoPagoConfigured,
  generateAuthUrl,
  exchangeAuthorizationCode,
  createPaymentWithToken,
  refreshAccessToken,
  ensureValidAccessToken,
  createPreferenceWithToken,
  getPaymentWithToken,
};