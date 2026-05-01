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

    const pedido = {
      compradorId,
      quantidade,
      valorUnitario: TICKET_PRICE,
      valorTotal: quantidade * TICKET_PRICE,
      status: "pendente",
      metodoPagamento: "pix_manual",
      criadoEm: new Date(),
      atualizadoEm: new Date()
    };

    const docRef = await db.collection("pedidos").add(pedido);

    res.status(201).json({
      status: "sucesso",
      message: "Pedido criado com sucesso.",
      pedidoId: docRef.id,
      pedido
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
    const snapshot = await db
      .collection("pedidos")
      .where("status", "in", ["pendente", "aguardando_confirmacao"])
      .get();

    const pedidos = [];

    for (const doc of snapshot.docs) {
      const pedido = doc.data();

      let comprador = null;

      if (pedido.compradorId) {
        const compradorDoc = await db
          .collection("compradores")
          .doc(pedido.compradorId)
          .get();

        if (compradorDoc.exists) {
          comprador = compradorDoc.data();
        }
      }

      pedidos.push({
        pedidoId: doc.id,
        ...pedido,
        comprador
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

    res.json({
      status: "sucesso",
      pedidoId,
      pedido,
      comprador: compradorDoc.exists ? compradorDoc.data() : null,
      pix: {
        key: process.env.PIX_KEY,
        receiverName: process.env.PIX_RECEIVER_NAME
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

router.post("/:pedidoId/avisar-pagamento", async (req, res) => {
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

    if (pedido.status === "pago") {
      return res.status(400).json({
        status: "erro",
        message: "Este pedido já foi confirmado como pago."
      });
    }

    await pedidoRef.update({
      status: "aguardando_confirmacao",
      compradorAvisouPagamentoEm: new Date(),
      atualizadoEm: new Date()
    });

    res.json({
      status: "sucesso",
      message: "Aviso de pagamento registrado. Aguarde a confirmação do administrador."
    });
  } catch (error) {
    console.error("Erro ao avisar pagamento:", error);

    res.status(500).json({
      status: "erro",
      message: "Erro ao registrar aviso de pagamento.",
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

    if (pedido.status === "pago") {
      return res.status(400).json({
        status: "erro",
        message: "Este pedido já está pago."
      });
    }

    const ticketCode = generateTicketCode();

    const ingresso = {
      pedidoId,
      compradorId: pedido.compradorId,
      codigoValidacao: ticketCode,
      quantidade: pedido.quantidade,
      valorTotal: pedido.valorTotal,
      usado: false,
      usadoEm: null,
      criadoEm: new Date()
    };

    const ingressoRef = await db.collection("ingressos").add(ingresso);

    await pedidoRef.update({
      status: "pago",
      ingressoId: ingressoRef.id,
      codigoValidacao: ticketCode,
      confirmadoManualEm: new Date(),
      atualizadoEm: new Date()
    });

    res.json({
      status: "sucesso",
      message: "Pagamento confirmado e ingresso criado.",
      ingressoId: ingressoRef.id,
      codigoValidacao: ticketCode
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