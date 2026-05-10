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

function makePersonKey(fullName, birthDate) {
  return `${normalizeName(fullName)}|${normalizeBirthDate(birthDate)}`;
}

async function queryBuyersByField(field, value) {
  if (!value) return [];

  const snapshot = await db
    .collection("compradores")
    .where(field, "==", value)
    .limit(10)
    .get();

  return snapshot.docs.map((doc) => ({
    compradorId: doc.id,
    ...doc.data()
  }));
}

function removeDuplicates(list) {
  const map = new Map();

  list.forEach((item) => {
    if (item.compradorId) {
      map.set(item.compradorId, item);
    }
  });

  return Array.from(map.values());
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
    const personKey = makePersonKey(fullName, birthDate);

    if (!fullNameNormalized || !emailNormalized || !phoneDigits || !birthDateNormalized) {
      return res.status(400).json({
        status: "erro",
        message: "Dados inválidos. Verifique nome, data de nascimento, telefone e email."
      });
    }

    const possibleDuplicates = removeDuplicates([
      ...(await queryBuyersByField("emailNormalized", emailNormalized)),
      ...(await queryBuyersByField("email", email.trim())),
      ...(await queryBuyersByField("phoneDigits", phoneDigits)),
      ...(await queryBuyersByField("phone", phone.trim())),
      ...(await queryBuyersByField("personKey", personKey)),
      ...(await queryBuyersByField("birthDate", birthDateNormalized))
    ]);

    let duplicateReason = null;

    possibleDuplicates.forEach((comprador) => {
      if (duplicateReason) return;

      const existingName = comprador.fullNameNormalized || normalizeName(comprador.fullName);
      const existingEmail = comprador.emailNormalized || normalizeEmail(comprador.email);
      const existingPhone = comprador.phoneDigits || normalizePhone(comprador.phone);
      const existingBirthDate = normalizeBirthDate(comprador.birthDate);
      const existingPersonKey = comprador.personKey || makePersonKey(comprador.fullName, comprador.birthDate);

      const sameEmail = existingEmail === emailNormalized;
      const samePhone = existingPhone === phoneDigits;
      const samePerson =
        existingName === fullNameNormalized &&
        existingBirthDate === birthDateNormalized;

      if (sameEmail) {
        duplicateReason = "Já existe um cadastro com este email.";
      } else if (samePhone) {
        duplicateReason = "Já existe um cadastro com este telefone.";
      } else if (existingPersonKey === personKey || samePerson) {
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
      personKey,

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