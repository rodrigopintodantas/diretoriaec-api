const express = require("express");
const { authorize } = require("../auth/authorize");
const { getAuthUrl, handleCallback } = require("../controllers/oauth.controller");

const router = express.Router();

router.get("/connect", authorize(["Administrador"]), getAuthUrl);
router.get("/callback", handleCallback);

module.exports = router;