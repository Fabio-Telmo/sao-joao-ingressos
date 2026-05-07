const express = require("express");
const db = require("../services/firebase");
const requireAdmin = require("../middlewares/adminAuth");

const router = express.Router();

function formatTicketCode(code) {
  return String(code || "").trim().toUpperCase();
}

router.get("/:codigo", requireAdmin, async (req, res) => {
  try {
    const codigo = formatTicketCode(req.params.codigo);

    if (!codigo) {
      return res.status(400).json({
        status: "erro",
        message: "Código do ingresso não enviado."
      });
    }

    const snapshot = await db
      .collection("ingressos")
      .where("codigoValidacao", "==", codigo)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return res.status(404).json({
        status: "erro",
        message: "Ingresso não encontrado."
      });
    }

    const ingressoDoc = snapshot.docs[0];
    const ingresso = ingressoDoc.data();

    let comprador = null;
    let pedido = null;

    if (ingresso.compradorId) {
      const compradorDoc = await db
        .collection("compradores")
        .doc(ingresso.compradorId)
        .get();

      if (compradorDoc.exists) {
        comprador = compradorDoc.data();
      }
    }

    if (ingresso.pedidoId) {
      const pedidoDoc = await db
        .collection("pedidos")
        .doc(ingresso.pedidoId)
        .get();

      if (pedidoDoc.exists) {
        pedido = pedidoDoc.data();
      }
    }

    res.json({
      status: "sucesso",
      ingressoId: ingressoDoc.id,
      ingresso,
      comprador,
      pedido
    });
  } catch (error) {
    console.error("Erro ao validar ingresso:", error);

    res.status(500).json({
      status: "erro",
      message: "Erro ao validar ingresso.",
      error: error.message
    });
  }
});

router.post("/:codigo/usar", requireAdmin, async (req, res) => {
  try {
    const codigo = formatTicketCode(req.params.codigo);

    if (!codigo) {
      return res.status(400).json({
        status: "erro",
        message: "Código do ingresso não enviado."
      });
    }

    const snapshot = await db
      .collection("ingressos")
      .where("codigoValidacao", "==", codigo)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return res.status(404).json({
        status: "erro",
        message: "Ingresso não encontrado."
      });
    }

    const ingressoDoc = snapshot.docs[0];
    const ingresso = ingressoDoc.data();

    if (ingresso.statusPagamento !== "pago") {
      return res.status(400).json({
        status: "erro",
        message: "Entrada bloqueada. O pagamento deste ingresso ainda não foi confirmado."
      });
    }

    if (ingresso.usado) {
      return res.status(400).json({
        status: "erro",
        message: "Entrada bloqueada. Este ingresso já foi utilizado."
      });
    }

    const usadoEm = new Date();

    await ingressoDoc.ref.update({
      usado: true,
      usadoEm,
      atualizadoEm: usadoEm
    });

    res.json({
      status: "sucesso",
      message: "Entrada registrada com sucesso.",
      ingressoId: ingressoDoc.id,
      codigoValidacao: ingresso.codigoValidacao,
      usado: true,
      usadoEm
    });
  } catch (error) {
    console.error("Erro ao marcar ingresso como usado:", error);

    res.status(500).json({
      status: "erro",
      message: "Erro ao marcar ingresso como usado.",
      error: error.message
    });
  }
});

module.exports = router;