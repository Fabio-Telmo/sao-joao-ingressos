const express = require("express");

const router = express.Router();

router.post("/login", (req, res) => {
  const { password } = req.body;

  if (!process.env.ADMIN_PASSWORD || !process.env.ADMIN_TOKEN) {
    return res.status(500).json({
      status: "erro",
      message: "Login administrativo não configurado."
    });
  }

  if (!password || password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({
      status: "erro",
      message: "Senha administrativa incorreta."
    });
  }

  res.json({
    status: "sucesso",
    message: "Login realizado com sucesso.",
    token: process.env.ADMIN_TOKEN
  });
});

module.exports = router;