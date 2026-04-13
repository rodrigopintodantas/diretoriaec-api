const express = require("express");
const { authorize } = require("../auth/authorize");
const { PushSubscriptionModel } = require("../models");
const { pushHabilitadoNoServidor } = require("../lib/push-send");

const router = express.Router();

router.get("/vapid-public", (req, res) => {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  if (!publicKey) {
    return res.status(503).json({ message: "Notificações push não configuradas no servidor." });
  }
  res.json({ publicKey });
});

router.get("/status", (req, res) => {
  res.json({ pushEnabled: pushHabilitadoNoServidor() });
});

router.post("/subscribe", authorize(["Atleta"]), async (req, res, next) => {
  try {
    const { subscription } = req.body ?? {};
    const endpoint = subscription?.endpoint;
    const auth = subscription?.keys?.auth;
    const p256dh = subscription?.keys?.p256dh;
    if (!endpoint || !auth || !p256dh) {
      return res.status(400).json({ message: "Envie subscription com endpoint e keys.auth / keys.p256dh." });
    }

    if (!pushHabilitadoNoServidor()) {
      return res.status(503).json({ message: "Notificações push não configuradas no servidor." });
    }

    const usuarioId = req.auth.UsuarioId;

    const [row, created] = await PushSubscriptionModel.findOrCreate({
      where: { endpoint },
      defaults: {
        UsuarioModelId: usuarioId,
        endpoint,
        auth,
        p256dh,
      },
    });

    if (!created && (row.UsuarioModelId !== usuarioId || row.auth !== auth || row.p256dh !== p256dh)) {
      await row.update({ UsuarioModelId: usuarioId, auth, p256dh });
    }

    return res.status(201).json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.delete("/subscribe", authorize(["Atleta"]), async (req, res, next) => {
  try {
    const endpoint = req.body?.endpoint ?? req.query?.endpoint;
    if (!endpoint) {
      return res.status(400).json({ message: "Informe endpoint (body ou query)." });
    }
    await PushSubscriptionModel.destroy({
      where: {
        endpoint,
        UsuarioModelId: req.auth.UsuarioId,
      },
    });
    return res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
