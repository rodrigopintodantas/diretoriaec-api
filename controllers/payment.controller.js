const { UsuarioTimeModel, TimeMercadoPagoOauthModel } = require("../models");
const { createPaymentWithToken } = require("../services/mercadopago.service");

async function getVinculoDoHeaderUp(usuarioId, upHeader) {
  const membershipId = parseInt(String(upHeader), 10);
  if (Number.isNaN(membershipId)) {
    return null;
  }

  return UsuarioTimeModel.findOne({
    where: { id: membershipId, UsuarioModelId: usuarioId },
    attributes: ["id", "TimeModelId"],
  });
}

exports.createPayment = async (req, res) => {
  try {
    const vinculo = await getVinculoDoHeaderUp(req.auth?.UsuarioId, req.headers.up);
    if (!vinculo) {
      return res.status(400).json({ message: "Vínculo com o time não encontrado." });
    }

    const oauthRow = await TimeMercadoPagoOauthModel.findOne({
      where: { TimeModelId: vinculo.TimeModelId },
      attributes: ["accessToken"],
    });
    if (!oauthRow) {
      return res.status(404).json({ message: "Time ainda não conectado ao Mercado Pago." });
    }

    const payload = {
      transaction_amount: Number(req.body?.transaction_amount || 10),
      description: req.body?.description || "Pagamento PIX",
      payment_method_id: req.body?.payment_method_id || "pix",
      payer: {
        email: req.body?.payer?.email || "teste@test.com",
      },
      ...req.body,
    };

    const payment = await createPaymentWithToken(oauthRow.accessToken, payload);
    return res.status(200).json(payment);
  } catch (error) {
    console.error(error.response?.data || error.message);
    const status = error.response?.status || 500;
    return res.status(status).json({
      message: "Erro ao criar pagamento no Mercado Pago.",
      details: error.response?.data || null,
    });
  }
};