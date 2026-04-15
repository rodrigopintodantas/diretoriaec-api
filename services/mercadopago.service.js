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

module.exports = {
  isMercadoPagoConfigured,
  generateAuthUrl,
  exchangeAuthorizationCode,
  createPaymentWithToken,
};