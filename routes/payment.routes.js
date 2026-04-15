const express = require("express");
const { authorize } = require("../auth/authorize");
const { createPayment } = require("../controllers/payment.controller");

const router = express.Router();

router.post("/create", authorize(["Administrador"]), createPayment);

module.exports = router;