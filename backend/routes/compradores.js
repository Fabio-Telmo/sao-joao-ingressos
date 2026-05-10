const express = require("express");
const db = require("../services/firebase");

const router = express.Router();

function normalizeName(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function normalizePhone(phone) {
  return String(phone || "").replace(/\D/g, "");
}

function normalizeBirthDate(birthDate) {
  return String(birthDate || "").trim();
}

router.post("/", async (req, res) => {
  try {
    const { fullName, birthDate, phone, email } = req.body;

    if (!fullName || !birthDate || !phone || !email) {
      return res.status(400).json({
        status: "erro",
        message: "Preencha todos os campos obrigatórios."
      });
    }

    const fullNameNormalized = normalizeName(fullName);
    const emailNormalized = normalizeEmail(email);
    const phoneDigits = normalizePhone(phone);
    const birthDateNormalized = normalizeBirthDate(birthDate);

    if (!fullNameNormalized || !emailNormalized || !phoneDigits || !birthDateNormalized) {
      return res.status(400).json({
        status: "erro",
        message: "Dados inválidos. Verifique nome, data de nascimento, telefone e email."
      });
    }

    const compradoresSnapshot = await db.collection("compradores").get();

    let duplicateReason = null;

    compradoresSnapshot.docs.forEach((doc) => {
      if (duplicateReason) return;

      const comprador = doc.data();

      const existingName = comprador.fullNameNormalized || normalizeName(comprador.fullName);
      const existingEmail = comprador.emailNormalized || normalizeEmail(comprador.email);
      const existingPhone = comprador.phoneDigits || normalizePhone(comprador.phone);
      const existingBirthDate = normalizeBirthDate(comprador.birthDate);

      const sameEmail = existingEmail === emailNormalized;
      const samePhone = existingPhone === phoneDigits;
      const samePerson = existingName === fullNameNormalized && existingBirthDate === birthDateNormalized;

      if (sameEmail) {
        duplicateReason = "Já existe um cadastro com este email.";
      } else if (samePhone) {
        duplicateReason = "Já existe um cadastro com este telefone.";
      } else if (samePerson) {
        duplicateReason = "Já existe um cadastro com este nome e data de nascimento.";
      }
    });

    if (duplicateReason) {
      return res.status(409).json({
        status: "erro",
        message: `${duplicateReason} Use a opção de recuperar ingresso se já tiver comprado.`
      });
    }

    const comprador = {
      fullName: fullName.trim(),
      birthDate: birthDateNormalized,
      phone: phone.trim(),
      email: email.trim(),

      fullNameNormalized,
      emailNormalized,
      phoneDigits,

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