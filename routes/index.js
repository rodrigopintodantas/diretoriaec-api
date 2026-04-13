const express = require("express");

const router = express.Router();

router.get("/status", (req, res) => {
  res.status(200).json({
    msg: "Estou bem - base-api",
    timestamp: new Date().toISOString(),
  });
});

router.get("/", (req, res) => {
  res.status(200).json({ msg: "base-api" });
});

router.use("/auth", require("./auth"));
router.use("/atletas", require("./atletas"));
router.use("/partidas", require("./partidas"));
router.use("/push", require("./push"));
router.use("/financeiro", require("./financeiro"));

module.exports = router;
