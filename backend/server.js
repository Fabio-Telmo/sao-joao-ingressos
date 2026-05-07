const adminRoutes = require("./routes/admin");
const express = require("express");
const cors = require("cors");
const ingressosRoutes = require("./routes/ingressos");

require("dotenv").config();

const db = require("./services/firebase");
const pedidosRoutes = require("./routes/pedidos");
const compradoresRoutes = require("./routes/compradores");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("Backend do São João está funcionando.");
});

app.get("/api/status", (req, res) => {
  res.json({
    status: "online",
    message: "Servidor funcionando corretamente."
  });
});

app.get("/api/firebase-test", async (req, res) => {
  try {
    const docRef = await db.collection("testes").add({
      mensagem: "Conexão com Firebase funcionando",
      criadoEm: new Date()
    });

    res.json({
      status: "sucesso",
      message: "Dado salvo no Firestore.",
      id: docRef.id
    });
  } catch (error) {
    console.error("Erro ao conectar com Firebase:", error);

    res.status(500).json({
      status: "erro",
      message: "Erro ao conectar com Firebase.",
      error: error.message
    });
  }
});

app.use("/api/compradores", compradoresRoutes);
app.use("/api/pedidos", pedidosRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/ingressos", ingressosRoutes);

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});