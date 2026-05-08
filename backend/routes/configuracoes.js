const express = require("express");
const db = require("../services/firebase");
const requireAdmin = require("../middlewares/adminAuth");

const router = express.Router();

const configRef = db.collection("configuracoes").doc("evento");

const DEFAULT_CONFIG = {
  nomeEvento: "Arraiá do CETEP",
  escola: "CETEP-BRG",
  pixKey: "",
  pixReceiverName: "",
  whatsappNumber: "",
  loteAtualId: "lote1",
  maxPorCompra: 3,
  atualizadoEm: new Date()
};

const DEFAULT_LOTE = {
  nome: "1º lote",
  preco: 10,
  quantidadeMaxima: 100,
  quantidadeReservada: 0,
  quantidadePaga: 0,
  ativo: true,
  criadoEm: new Date(),
  atualizadoEm: new Date()
};

async function ensureDefaultConfig() {
  const configDoc = await configRef.get();

  if (!configDoc.exists) {
    await configRef.set(DEFAULT_CONFIG);
  }

  const loteRef = db.collection("lotes").doc("lote1");
  const loteDoc = await loteRef.get();

  if (!loteDoc.exists) {
    await loteRef.set(DEFAULT_LOTE);
  }
}

router.get("/evento", async (req, res) => {
  try {
    await ensureDefaultConfig();

    const configDoc = await configRef.get();
    const config = configDoc.data();

    let loteAtual = null;

    if (config.loteAtualId) {
      const loteDoc = await db.collection("lotes").doc(config.loteAtualId).get();

      if (loteDoc.exists) {
        loteAtual = {
          loteId: loteDoc.id,
          ...loteDoc.data()
        };
      }
    }

    res.json({
      status: "sucesso",
      configuracao: config,
      loteAtual
    });
  } catch (error) {
    console.error("Erro ao buscar configuração:", error);

    res.status(500).json({
      status: "erro",
      message: "Erro ao buscar configuração.",
      error: error.message
    });
  }
});

router.put("/evento", requireAdmin, async (req, res) => {
  try {
    const {
      nomeEvento,
      escola,
      pixKey,
      pixReceiverName,
      whatsappNumber,
      maxPorCompra,
      loteAtualId
    } = req.body;

    const dadosAtualizados = {
      nomeEvento: nomeEvento || "Arraiá do CETEP",
      escola: escola || "CETEP-BRG",
      pixKey: pixKey || "",
      pixReceiverName: pixReceiverName || "",
      whatsappNumber: whatsappNumber || "",
      maxPorCompra: Number(maxPorCompra) || 1,
      loteAtualId: loteAtualId || "lote1",
      atualizadoEm: new Date()
    };

    if (dadosAtualizados.maxPorCompra < 1) {
      return res.status(400).json({
        status: "erro",
        message: "O máximo por compra precisa ser pelo menos 1."
      });
    }

    await configRef.set(dadosAtualizados, { merge: true });

    res.json({
      status: "sucesso",
      message: "Configurações atualizadas com sucesso.",
      configuracao: dadosAtualizados
    });
  } catch (error) {
    console.error("Erro ao atualizar configuração:", error);

    res.status(500).json({
      status: "erro",
      message: "Erro ao atualizar configuração.",
      error: error.message
    });
  }
});

router.get("/lotes", requireAdmin, async (req, res) => {
  try {
    await ensureDefaultConfig();

    const snapshot = await db.collection("lotes").orderBy("criadoEm", "asc").get();

    const lotes = snapshot.docs.map((doc) => ({
      loteId: doc.id,
      ...doc.data()
    }));

    res.json({
      status: "sucesso",
      lotes
    });
  } catch (error) {
    console.error("Erro ao listar lotes:", error);

    res.status(500).json({
      status: "erro",
      message: "Erro ao listar lotes.",
      error: error.message
    });
  }
});

router.post("/lotes", requireAdmin, async (req, res) => {
  try {
    const { nome, preco, quantidadeMaxima } = req.body;

    const precoNumerico = Number(preco);
    const quantidadeNumerica = Number(quantidadeMaxima);

    if (!nome || !precoNumerico || !quantidadeNumerica) {
      return res.status(400).json({
        status: "erro",
        message: "Informe nome, preço e quantidade máxima do lote."
      });
    }

    if (precoNumerico <= 0 || quantidadeNumerica <= 0) {
      return res.status(400).json({
        status: "erro",
        message: "Preço e quantidade máxima precisam ser maiores que zero."
      });
    }

    const lote = {
      nome,
      preco: precoNumerico,
      quantidadeMaxima: quantidadeNumerica,
      quantidadeReservada: 0,
      quantidadePaga: 0,
      ativo: false,
      criadoEm: new Date(),
      atualizadoEm: new Date()
    };

    const docRef = await db.collection("lotes").add(lote);

    res.status(201).json({
      status: "sucesso",
      message: "Lote criado com sucesso.",
      loteId: docRef.id,
      lote
    });
  } catch (error) {
    console.error("Erro ao criar lote:", error);

    res.status(500).json({
      status: "erro",
      message: "Erro ao criar lote.",
      error: error.message
    });
  }
});

router.put("/lotes/:loteId", requireAdmin, async (req, res) => {
  try {
    const { loteId } = req.params;
    const { nome, preco, quantidadeMaxima, ativo } = req.body;

    const loteRef = db.collection("lotes").doc(loteId);
    const loteDoc = await loteRef.get();

    if (!loteDoc.exists) {
      return res.status(404).json({
        status: "erro",
        message: "Lote não encontrado."
      });
    }

    const loteAtual = loteDoc.data();

    const precoNumerico = Number(preco);
    const quantidadeNumerica = Number(quantidadeMaxima);

    if (!nome || !precoNumerico || !quantidadeNumerica) {
      return res.status(400).json({
        status: "erro",
        message: "Informe nome, preço e quantidade máxima."
      });
    }

    if (quantidadeNumerica < Number(loteAtual.quantidadeReservada || 0)) {
      return res.status(400).json({
        status: "erro",
        message: "A quantidade máxima não pode ser menor que a quantidade já reservada."
      });
    }

    await loteRef.update({
      nome,
      preco: precoNumerico,
      quantidadeMaxima: quantidadeNumerica,
      ativo: Boolean(ativo),
      atualizadoEm: new Date()
    });

    res.json({
      status: "sucesso",
      message: "Lote atualizado com sucesso."
    });
  } catch (error) {
    console.error("Erro ao atualizar lote:", error);

    res.status(500).json({
      status: "erro",
      message: "Erro ao atualizar lote.",
      error: error.message
    });
  }
});

router.post("/lotes/:loteId/ativar", requireAdmin, async (req, res) => {
  try {
    const { loteId } = req.params;

    const loteRef = db.collection("lotes").doc(loteId);
    const loteDoc = await loteRef.get();

    if (!loteDoc.exists) {
      return res.status(404).json({
        status: "erro",
        message: "Lote não encontrado."
      });
    }

    const lotesSnapshot = await db.collection("lotes").get();
    const batch = db.batch();

    lotesSnapshot.docs.forEach((doc) => {
      batch.update(doc.ref, {
        ativo: doc.id === loteId,
        atualizadoEm: new Date()
      });
    });

    batch.set(configRef, {
      loteAtualId: loteId,
      atualizadoEm: new Date()
    }, { merge: true });

    await batch.commit();

    res.json({
      status: "sucesso",
      message: "Lote ativado com sucesso."
    });
  } catch (error) {
    console.error("Erro ao ativar lote:", error);

    res.status(500).json({
      status: "erro",
      message: "Erro ao ativar lote.",
      error: error.message
    });
  }
});

module.exports = router;