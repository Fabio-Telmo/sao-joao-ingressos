const express = require("express");
const db = require("../services/firebase");
const requireAdmin = require("../middlewares/adminAuth");

const router = express.Router();

function generateTicketCode() {
  const year = new Date().getFullYear();
  const random = Math.floor(100000 + Math.random() * 900000);
  return `SJ-${year}-${random}`;
}

async function getEventConfigAndActiveLot() {
  const configDoc = await db.collection("configuracoes").doc("evento").get();

  if (!configDoc.exists) {
    throw new Error("Configuração do evento não encontrada. Configure o evento na área administrativa.");
  }

  const configuracao = configDoc.data();

  if (!configuracao.loteAtualId) {
    throw new Error("Nenhum lote ativo foi definido.");
  }

  const loteRef = db.collection("lotes").doc(configuracao.loteAtualId);
  const loteDoc = await loteRef.get();

  if (!loteDoc.exists) {
    throw new Error("Lote ativo não encontrado.");
  }

  const lote = loteDoc.data();

  if (!lote.ativo) {
    throw new Error("O lote selecionado não está ativo.");
  }

  return {
    configuracao,
    lote,
    loteRef,
    loteId: loteDoc.id
  };
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

    const compradorRef = db.collection("compradores").doc(compradorId);
    const compradorDoc = await compradorRef.get();

    if (!compradorDoc.exists) {
      return res.status(404).json({
        status: "erro",
        message: "Comprador não encontrado."
      });
    }

    const { configuracao, lote, loteRef, loteId } = await getEventConfigAndActiveLot();

    const maxPorCompra = Number(configuracao.maxPorCompra || 1);

    if (quantidade > maxPorCompra) {
      return res.status(400).json({
        status: "erro",
        message: `O limite por compra é de ${maxPorCompra} ingresso(s).`
      });
    }

    const quantidadeMaxima = Number(lote.quantidadeMaxima || 0);
    const quantidadeReservada = Number(lote.quantidadeReservada || 0);
    const disponiveis = quantidadeMaxima - quantidadeReservada;

    if (disponiveis <= 0) {
      return res.status(400).json({
        status: "erro",
        message: "Este lote está esgotado."
      });
    }

    if (quantidade > disponiveis) {
      return res.status(400).json({
        status: "erro",
        message: `Restam apenas ${disponiveis} ingresso(s) neste lote.`
      });
    }

    const pedidoRef = db.collection("pedidos").doc();
    const ingressoRef = db.collection("ingressos").doc();

    const ticketCode = generateTicketCode();
    const valorUnitario = Number(lote.preco);
    const valorTotal = quantidade * valorUnitario;

    const pedido = {
      compradorId,
      quantidade,
      valorUnitario,
      valorTotal,
      status: "ativo",
      statusPagamento: "nao_pago",
      metodoPagamento: "pix_manual",
      ingressoId: ingressoRef.id,
      codigoValidacao: ticketCode,
      loteId,
      loteNome: lote.nome,
      criadoEm: new Date(),
      atualizadoEm: new Date()
    };

    const ingresso = {
      pedidoId: pedidoRef.id,
      compradorId,
      codigoValidacao: ticketCode,
      quantidade,
      valorTotal,
      statusPagamento: "nao_pago",
      usado: false,
      usadoEm: null,
      loteId,
      loteNome: lote.nome,
      criadoEm: new Date(),
      atualizadoEm: new Date()
    };

    const batch = db.batch();

    batch.set(pedidoRef, pedido);
    batch.set(ingressoRef, ingresso);
    batch.update(loteRef, {
      quantidadeReservada: quantidadeReservada + quantidade,
      atualizadoEm: new Date()
    });

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
      message: error.message || "Erro ao criar pedido."
    });
  }
});

router.get("/pendentes-pagamento", requireAdmin, async (req, res) => {
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

    const configDoc = await db.collection("configuracoes").doc("evento").get();
    const configuracao = configDoc.exists ? configDoc.data() : {};

    res.json({
      status: "sucesso",
      pedidoId,
      pedido,
      comprador: compradorDoc.exists ? compradorDoc.data() : null,
      ingresso,
      pix: {
        key: configuracao.pixKey || process.env.PIX_KEY,
        receiverName: configuracao.pixReceiverName || process.env.PIX_RECEIVER_NAME
      },
      whatsapp: {
        number: configuracao.whatsappNumber || process.env.WHATSAPP_NUMBER
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

router.post("/:pedidoId/confirmar-pagamento", requireAdmin, async (req, res) => {
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

    if (pedido.loteId) {
      const loteRef = db.collection("lotes").doc(pedido.loteId);
      const loteDoc = await loteRef.get();

      if (loteDoc.exists) {
        const lote = loteDoc.data();
        const quantidadePagaAtual = Number(lote.quantidadePaga || 0);

        batch.update(loteRef, {
          quantidadePaga: quantidadePagaAtual + Number(pedido.quantidade || 0),
          atualizadoEm: new Date()
        });
      }
    }

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