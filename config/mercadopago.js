module.exports = {
  clientId: process.env.MERCADO_PAGO_CLIENT_ID || "",
  clientSecret: process.env.MERCADO_PAGO_CLIENT_SECRET || "",
  redirectUri: process.env.MERCADO_PAGO_REDIRECT_URI || "",
  authBase: process.env.MERCADO_PAGO_AUTH_BASE || "https://auth.mercadopago.com.br",
  apiBase: process.env.MERCADO_PAGO_API_BASE || "https://api.mercadopago.com",
};