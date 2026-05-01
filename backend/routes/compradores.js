const express = require("express");
const db = require("../services/firebase");

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const { fullName, birthDate, phone, email } = req.body;

    if (!fullName || !birthDate || !phone || !email) {
      return res.status(400).json({
        status: "erro",
        message: "Preencha todos os campos obrigatórios."
      });
    }

    const comprador = {
      fullName,
      birthDate,
      phone,
      email,
      createdAt: new Date()
    };

    const docRef = await db.collection("compradores").add(comprador);

    res.status(201).json({
      status: "sucesso",
      message: "Comprador cadastrado com sucesso.",
      compradorId: docRef.id,
      comprador
    });
  } catch (error) {
    console.error("Erro ao cadastrar comprador:", error);

    res.status(500).json({
      status: "erro",
      message: "Erro ao cadastrar comprador.",
      error: error.message
    });
  }
});

module.exports = router;