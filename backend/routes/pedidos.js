const express = require("express");
const db = require("../services/firebase");

const router = express.Router();

const TICKET_PRICE = 10;
const MAX_TICKETS = 10;

function generateTicketCode() {
  const year = new Date().getFullYear();
  const random = Math.floor(100000 + Math.random() * 900000);
  return `SJ-${year}-${random}`;
}

router.post("/", async (req, res) => {
  try {
    const { compradorId, quantity } = req.body;
    const quantidade = Number(quantity);

    if (!compradorId) {
      return res.status(400).json({
        status: "erro",
        message: "ID do comprador não enviado."
      });
    }

    if (!Number.isInteger(quantidade) || quantidade < 1) {
      return res.status(400).json({
        status: "erro",
        message: "Quantidade de ingressos inválida."
      });
    }

    if (quantidade > MAX_TICKETS) {
      return res.status(400).json({
        status: "erro",
        message: `O limite por compra é de ${MAX_TICKETS} ingressos.`
      });
    }

    const compradorRef = db.collection("compradores").doc(compradorId);
    const compradorDoc = await compradorRef.get();

    if (!compradorDoc.exists) {
      return res.status(404).json({
        status: "erro",
        message: "Comprador não encontrado."
      });
    }

    const pedidoRef = db.collection("pedidos").doc();
    const ingressoRef = db.collection("ingressos").doc();

    const ticketCode = generateTicketCode();

    const pedido = {
      compradorId,
      quantidade,
      valorUnitario: TICKET_PRICE,
      valorTotal: quantidade * TICKET_PRICE,
      status: "ativo",
      statusPagamento: "nao_pago",
      metodoPagamento: "pix_manual",
      ingressoId: ingressoRef.id,
      codigoValidacao: ticketCode,
      criadoEm: new Date(),
      atualizadoEm: new Date()
    };

    const ingresso = {
      pedidoId: pedidoRef.id,
      compradorId,
      codigoValidacao: ticketCode,
      quantidade,
      valorTotal: quantidade * TICKET_PRICE,
      statusPagamento: "nao_pago",
      usado: false,
      usadoEm: null,
      criadoEm: new Date(),
      atualizadoEm: new Date()
    };

    const batch = db.batch();

    batch.set(pedidoRef, pedido);
    batch.set(ingressoRef, ingresso);

    await batch.commit();

    res.status(201).json({
      status: "sucesso",
      message: "Pedido e ingresso criados com sucesso.",
      pedidoId: pedidoRef.id,
      ingressoId: ingressoRef.id,
      codigoValidacao: ticketCode,
      pedido,
      ingresso
    });
  } catch (error) {
    console.error("Erro ao criar pedido:", error);

    res.status(500).json({
      status: "erro",
      message: "Erro ao criar pedido.",
      error: error.message
    });
  }
});

router.get("/pendentes-pagamento", async (req, res) => {
  try {
    const snapshot = await db.collection("pedidos").get();

    const pedidos = [];

    for (const doc of snapshot.docs) {
      const pedido = doc.data();

      if (pedido.statusPagamento === "pago") {
        continue;
      }

      let comprador = null;
      let ingresso = null;

      if (pedido.compradorId) {
        const compradorDoc = await db
          .collection("compradores")
          .doc(pedido.compradorId)
          .get();

        if (compradorDoc.exists) {
          comprador = compradorDoc.data();
        }
      }

      if (pedido.ingressoId) {
        const ingressoDoc = await db
          .collection("ingressos")
          .doc(pedido.ingressoId)
          .get();

        if (ingressoDoc.exists) {
          ingresso = ingressoDoc.data();
        }
      }

      pedidos.push({
        pedidoId: doc.id,
        ...pedido,
        comprador,
        ingresso
      });
    }

    res.json({
      status: "sucesso",
      pedidos
    });
  } catch (error) {
    console.error("Erro ao listar pedidos:", error);

    res.status(500).json({
      status: "erro",
      message: "Erro ao listar pedidos.",
      error: error.message
    });
  }
});

router.get("/:pedidoId", async (req, res) => {
  try {
    const { pedidoId } = req.params;

    const pedidoDoc = await db.collection("pedidos").doc(pedidoId).get();

    if (!pedidoDoc.exists) {
      return res.status(404).json({
        status: "erro",
        message: "Pedido não encontrado."
      });
    }

    const pedido = pedidoDoc.data();

    const compradorDoc = await db
      .collection("compradores")
      .doc(pedido.compradorId)
      .get();

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

    res.json({
      status: "sucesso",
      pedidoId,
      pedido,
      comprador: compradorDoc.exists ? compradorDoc.data() : null,
      ingresso,
      pix: {
        key: process.env.PIX_KEY,
        receiverName: process.env.PIX_RECEIVER_NAME
      },
      whatsapp: {
        number: process.env.WHATSAPP_NUMBER
      }
    });
  } catch (error) {
    console.error("Erro ao buscar pedido:", error);

    res.status(500).json({
      status: "erro",
      message: "Erro ao buscar pedido.",
      error: error.message
    });
  }
});

router.post("/:pedidoId/confirmar-pagamento", async (req, res) => {
  try {
    const { pedidoId } = req.params;

    const pedidoRef = db.collection("pedidos").doc(pedidoId);
    const pedidoDoc = await pedidoRef.get();

    if (!pedidoDoc.exists) {
      return res.status(404).json({
        status: "erro",
        message: "Pedido não encontrado."
      });
    }

    const pedido = pedidoDoc.data();

    if (pedido.statusPagamento === "pago") {
      return res.status(400).json({
        status: "erro",
        message: "Este pedido já está pago."
      });
    }

    let ingressoRef = null;

    if (pedido.ingressoId) {
      ingressoRef = db.collection("ingressos").doc(pedido.ingressoId);
    } else {
      ingressoRef = db.collection("ingressos").doc();
    }

    const batch = db.batch();

    batch.update(pedidoRef, {
      statusPagamento: "pago",
      confirmadoManualEm: new Date(),
      atualizadoEm: new Date()
    });

    batch.update(ingressoRef, {
      statusPagamento: "pago",
      pagoEm: new Date(),
      atualizadoEm: new Date()
    });

    await batch.commit();

    res.json({
      status: "sucesso",
      message: "Pagamento confirmado com sucesso.",
      ingressoId: ingressoRef.id,
      codigoValidacao: pedido.codigoValidacao
    });
  } catch (error) {
    console.error("Erro ao confirmar pagamento:", error);

    res.status(500).json({
      status: "erro",
      message: "Erro ao confirmar pagamento.",
      error: error.message
    });
  }
});

module.exports = router;