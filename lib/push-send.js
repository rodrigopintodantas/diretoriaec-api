"use strict";

const webpush = require("web-push");
const admin = require("firebase-admin");
const { Op } = require("sequelize");
const { PushSubscriptionModel, PushDeviceTokenModel } = require("../models");

let vapidPronto = false;
let fcmPronto = false;

function configurarVapid() {
  if (vapidPronto) {
    return true;
  }
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:contato@localhost";
  if (!pub || !priv) {
    return false;
  }
  webpush.setVapidDetails(subject, pub, priv);
  vapidPronto = true;
  return true;
}

function pushHabilitadoNoServidor() {
  return !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

function configurarFirebase() {
  if (fcmPronto) {
    return true;
  }
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  if (!projectId || !clientEmail || !privateKey) {
    return false;
  }

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey: privateKey.replace(/\\n/g, "\n"),
      }),
    });
  }

  fcmPronto = true;
  return true;
}

function pushNativoHabilitadoNoServidor() {
  return !!(process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY);
}

function formatarHoraPartida(hora) {
  if (hora == null || hora === "") {
    return "";
  }
  return String(hora).trim().slice(0, 5);
}

function montarCorpoNotificacao(partida) {
  if (!partida) {
    return "Você foi convocado para uma partida!";
  }
  const confronto = `${partida.nome_time_1} x ${partida.nome_time_2}`;
  const data = partida.data || "";
  const horaFmt = formatarHoraPartida(partida.hora);
  const quando = horaFmt ? `Data: ${data} às ${horaFmt}.` : `Data: ${data}.`;
  return `Você foi convocado para ${confronto}. ${quando}`;
}

async function enviarPayloadParaUsuarios(usuarioIds, payloadObj) {
  if (!configurarVapid() || !usuarioIds?.length) {
    return;
  }
  const unicos = [...new Set(usuarioIds)];
  const subs = await PushSubscriptionModel.findAll({
    where: { UsuarioModelId: { [Op.in]: unicos } },
  });
  if (!subs.length) {
    return;
  }

  const payload = JSON.stringify(payloadObj);

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { auth: sub.auth, p256dh: sub.p256dh },
        },
        payload,
      );
    } catch (err) {
      const code = err.statusCode;
      if (code === 410 || code === 404) {
        await sub.destroy();
      } else {
        console.error("[push] Falha ao enviar:", err.message);
      }
    }
  }
}

async function enviarPayloadNativoParaUsuarios(usuarioIds, payloadObj) {
  if (!configurarFirebase() || !usuarioIds?.length) {
    return;
  }
  const unicos = [...new Set(usuarioIds)];
  const rows = await PushDeviceTokenModel.findAll({
    where: { UsuarioModelId: { [Op.in]: unicos } },
    attributes: ["id", "token"],
  });
  if (!rows.length) {
    return;
  }

  const message = {
    notification: {
      title: String(payloadObj?.title || "Convocação"),
      body: String(payloadObj?.body || ""),
    },
    data: Object.entries(payloadObj?.data || {}).reduce((acc, [k, v]) => {
      acc[k] = v == null ? "" : String(v);
      return acc;
    }, {}),
    android: {
      priority: "high",
    },
    tokens: rows.map((r) => r.token),
  };

  try {
    const resp = await admin.messaging().sendEachForMulticast(message);
    if (resp.failureCount > 0) {
      const invalidIds = [];
      resp.responses.forEach((r, idx) => {
        if (!r.success) {
          const code = r.error?.code || "";
          if (code.includes("registration-token-not-registered") || code.includes("invalid-registration-token")) {
            invalidIds.push(rows[idx].id);
          } else {
            console.error("[push:nativo] Falha ao enviar:", r.error?.message || "erro desconhecido");
          }
        }
      });
      if (invalidIds.length) {
        await PushDeviceTokenModel.destroy({ where: { id: { [Op.in]: invalidIds } } });
      }
    }
  } catch (err) {
    console.error("[push:nativo] Erro no envio FCM:", err.message);
  }
}

/**
 * @param {{ usuarioIds: number[], partida: import("sequelize").Model | null }} opts
 */
async function notificarConvocados(opts) {
  const { usuarioIds, partida } = opts;
  const payload = {
    title: "Convocação",
    body: montarCorpoNotificacao(partida),
    data: { partidaId: partida?.id ?? null, type: "convocacao" },
  };
  await Promise.all([enviarPayloadParaUsuarios(usuarioIds, payload), enviarPayloadNativoParaUsuarios(usuarioIds, payload)]);
}

const TEXTO_RECONVOCACAO_PRESENCA = "Você ainda não confirmou presença no Jogo!";

/**
 * Lembrete para quem está PENDENTE de confirmar presença.
 * @param {{ usuarioIds: number[], partida: import("sequelize").Model | null }} opts
 */
async function notificarReconvocacaoPresenca(opts) {
  const { usuarioIds, partida } = opts;
  const payload = {
    title: "Convocação",
    body: TEXTO_RECONVOCACAO_PRESENCA,
    data: { partidaId: partida?.id ?? null, type: "reconvocacao_presenca" },
  };
  await Promise.all([enviarPayloadParaUsuarios(usuarioIds, payload), enviarPayloadNativoParaUsuarios(usuarioIds, payload)]);
}

module.exports = {
  notificarConvocados,
  notificarReconvocacaoPresenca,
  pushHabilitadoNoServidor,
  pushNativoHabilitadoNoServidor,
};
