const express = require("express");
const bcrypt = require("bcryptjs");
const { authorizeSemPerfilSelecionado, authBearerLogin, getPapeisPorUsuario } = require("../auth/authorize");
const { signAccessToken } = require("../auth/jwt");
const { UsuarioModel } = require("../models");
const perfil = require("../auth/perfil");

const router = express.Router();

router.post("/login", async (req, res, next) => {
  try {
    const { login, senha } = req.body ?? {};
    const loginTrim = login != null ? String(login).trim() : "";
    const senhaStr = senha != null ? String(senha) : "";

    if (!loginTrim || !senhaStr) {
      return res.status(400).json({ message: "Informe login e senha." });
    }

    const usuario = await UsuarioModel.unscoped().findOne({
      where: { login: loginTrim },
    });

    if (!usuario || !usuario.senha_hash) {
      return res.status(401).json({ message: "Login ou senha incorretos." });
    }

    const ok = await bcrypt.compare(senhaStr, usuario.senha_hash);
    if (!ok) {
      return res.status(401).json({ message: "Login ou senha incorretos." });
    }

    const up = await getPapeisPorUsuario(usuario);
    if (!up || up.length === 0) {
      return res.status(400).json({
        message: "O usuário não possui vínculo com time no sistema.",
      });
    }

    const token = signAccessToken(usuario);

    const usuarioPublico = {
      id: usuario.id,
      login: usuario.login,
      nome: usuario.nome,
      email: usuario.email,
      telefone: usuario.telefone,
      dataNascimento: usuario.dataNascimento,
    };

    return res.json({
      token,
      usuario: usuarioPublico,
      up,
    });
  } catch (err) {
    next(err);
  }
});

router.get("/", authorizeSemPerfilSelecionado());
router.get("/perfil", authBearerLogin(), perfil);

module.exports = router;
