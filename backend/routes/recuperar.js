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

    const compradoresSnapshot = await db.collection("compradores").get();

    let compradorEncontrado = null;
    let compradorId = null;

    compradoresSnapshot.docs.forEach((doc) => {
      const comprador = doc.data();

      const mesmoEmail = normalizeEmail(comprador.email) === emailNormalizado;
      const mesmoTelefone = normalizePhone(comprador.phone) === telefoneNormalizado;
      const mesmaData = normalizeBirthDate(comprador.birthDate) === nascimentoNormalizado;

      if (mesmoEmail && mesmoTelefone && mesmaData) {
        compradorEncontrado = comprador;
        compradorId = doc.id;
      }
    });

    if (!compradorEncontrado || !compradorId) {
      return res.status(404).json({
        status: "erro",
        message: "Não foi possível recuperar o ingresso com os dados informados."
      });
    }

    const pedidosSnapshot = await db
      .collection("pedidos")
      .where("compradorId", "==", compradorId)
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

    res.json({
      status: "sucesso",
      message: "Ingresso recuperado com sucesso.",
      compradorId,
      comprador: compradorEncontrado,
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