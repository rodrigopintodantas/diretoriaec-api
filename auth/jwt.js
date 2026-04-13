"use strict";

const jwt = require("jsonwebtoken");

function getSecret() {
  return process.env.JWT_SECRET || "base-runner-dev-secret-altere-em-producao";
}

function signAccessToken(usuario) {
  return jwt.sign(
    {
      sub: usuario.id,
      login: usuario.login,
    },
    getSecret(),
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" },
  );
}

function verifyAccessToken(token) {
  return jwt.verify(token, getSecret());
}

/** Estado assinado para OAuth Mercado Pago (callback sem Bearer). */
function signMercadoPagoOAuthState(timeId, usuarioId) {
  return jwt.sign(
    { typ: "mp_oauth", tid: timeId, uid: usuarioId },
    getSecret(),
    { expiresIn: "15m" },
  );
}

function verifyMercadoPagoOAuthState(token) {
  const payload = jwt.verify(token, getSecret());
  if (payload.typ !== "mp_oauth") {
    throw new Error("Estado OAuth inválido.");
  }
  return { timeId: payload.tid, usuarioId: payload.uid };
}

module.exports = {
  signAccessToken,
  verifyAccessToken,
  signMercadoPagoOAuthState,
  verifyMercadoPagoOAuthState,
};
