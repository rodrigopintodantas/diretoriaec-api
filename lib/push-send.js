"use strict";

const webpush = require("web-push");
const { Op } = require("sequelize");
const { PushSubscriptionModel } = require("../models");

let vapidPronto = false;

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

/**
 * @param {{ usuarioIds: number[], partida: import("sequelize").Model | null }} opts
 */
async function notificarConvocados(opts) {
  const { usuarioIds, partida } = opts;
  await enviarPayloadParaUsuarios(usuarioIds, {
    title: "Convocação",
    body: montarCorpoNotificacao(partida),
    data: { partidaId: partida?.id ?? null, type: "convocacao" },
  });
}

const TEXTO_RECONVOCACAO_PRESENCA = "Você ainda não confirmou presença no Jogo!";

/**
 * Lembrete para quem está PENDENTE de confirmar presença.
 * @param {{ usuarioIds: number[], partida: import("sequelize").Model | null }} opts
 */
async function notificarReconvocacaoPresenca(opts) {
  const { usuarioIds, partida } = opts;
  await enviarPayloadParaUsuarios(usuarioIds, {
    title: "Convocação",
    body: TEXTO_RECONVOCACAO_PRESENCA,
    data: { partidaId: partida?.id ?? null, type: "reconvocacao_presenca" },
  });
}

module.exports = {
  notificarConvocados,
  notificarReconvocacaoPresenca,
  pushHabilitadoNoServidor,
};
