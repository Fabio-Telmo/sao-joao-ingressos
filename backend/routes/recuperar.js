const express = require("express");
const db = require("../services/firebase");

const router = express.Router();

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function normalizePhone(phone) {
  return String(phone || "").replace(/\D/g, "");
}

function normalizeBirthDate(birthDate) {
  return String(birthDate || "").trim();
}

function getDateValue(value) {
  if (!value) return 0;

  if (value._seconds) {
    return value._seconds * 1000;
  }

  if (typeof value.toDate === "function") {
    return value.toDate().getTime();
  }

  return new Date(value).getTime() || 0;
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

router.post("/ingresso", async (req, res) => {
  try {
    const { email, phone, birthDate } = req.body;

    const emailNormalizado = normalizeEmail(email);
    const telefoneNormalizado = normalizePhone(phone);
    const nascimentoNormalizado = normalizeBirthDate(birthDate);

    if (!emailNormalizado || !telefoneNormalizado || !nascimentoNormalizado) {
      return res.status(400).json({
        status: "erro",
        message: "Informe email, telefone e data de nascimento."
      });
    }

    const possibleBuyers = removeDuplicates([
      ...(await queryBuyersByField("emailNormalized", emailNormalizado)),
      ...(await queryBuyersByField("email", email.trim())),
      ...(await queryBuyersByField("phoneDigits", telefoneNormalizado)),
      ...(await queryBuyersByField("phone", phone.trim())),
      ...(await queryBuyersByField("birthDate", nascimentoNormalizado))
    ]);

    const compradorEncontrado = possibleBuyers.find((comprador) => {
      const mesmoEmail =
        normalizeEmail(comprador.emailNormalized || comprador.email) === emailNormalizado ||
        normalizeEmail(comprador.email) === emailNormalizado;

      const mesmoTelefone =
        normalizePhone(comprador.phoneDigits || comprador.phone) === telefoneNormalizado ||
        normalizePhone(comprador.phone) === telefoneNormalizado;

      const mesmaData = normalizeBirthDate(comprador.birthDate) === nascimentoNormalizado;

      return mesmoEmail && mesmoTelefone && mesmaData;
    });

    if (!compradorEncontrado) {
      return res.status(404).json({
        status: "erro",
        message: "Não foi possível recuperar o ingresso com os dados informados."
      });
    }

    const compradorId = compradorEncontrado.compradorId;

    const pedidosSnapshot = await db
      .collection("pedidos")
      .where("compradorId", "==", compradorId)
      .limit(20)
      .get();

    if (pedidosSnapshot.empty) {
      return res.status(404).json({
        status: "erro",
        message: "Não foi possível recuperar o ingresso com os dados informados."
      });
    }

    const pedidos = pedidosSnapshot.docs
      .map((doc) => ({
        pedidoId: doc.id,
        ...doc.data()
      }))
      .sort((a, b) => getDateValue(b.criadoEm) - getDateValue(a.criadoEm));

    const pedido = pedidos[0];

    let ingresso = null;

    if (pedido.ingressoId) {
      const ingressoDoc = await db
        .collection("ingressos")
        .doc(pedido.ingressoId)
        .get();

      if (ingressoDoc.exists) {
        ingresso = {
          ingressoId: ingressoDoc.id,
          ...ingressoDoc.data()
        };
      }
    }

    if (!ingresso) {
      return res.status(404).json({
        status: "erro",
        message: "Não foi possível recuperar o ingresso com os dados informados."
      });
    }

    const compradorLimpo = {
      fullName: compradorEncontrado.fullName,
      birthDate: compradorEncontrado.birthDate,
      phone: compradorEncontrado.phone,
      email: compradorEncontrado.email
    };

    res.json({
      status: "sucesso",
      message: "Ingresso recuperado com sucesso.",
      compradorId,
      comprador: compradorLimpo,
      pedido,
      ingresso
    });
  } catch (error) {
    console.error("Erro ao recuperar ingresso:", error);

    res.status(500).json({
      status: "erro",
      message: "Erro ao recuperar ingresso.",
      error: error.message
    });
  }
});

module.exports = router;