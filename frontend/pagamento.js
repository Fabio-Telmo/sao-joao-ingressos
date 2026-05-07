const API_URL = "https://sao-joao-ingressos.onrender.com";

const buyerName = document.getElementById("buyerName");
const buyerEmail = document.getElementById("buyerEmail");
const ticketQuantity = document.getElementById("ticketQuantity");
const totalPrice = document.getElementById("totalPrice");
const pixCode = document.getElementById("pixCode");
const statusBox = document.getElementById("statusBox");
const copyPixButton = document.getElementById("copyPixButton");
const simulatePaymentButton = document.getElementById("simulatePaymentButton");
const ticketButton = document.getElementById("ticketButton");
const backButton = document.getElementById("backButton");

let currentPixKey = "";
let currentWhatsappLink = "";
let currentPurchaseData = JSON.parse(localStorage.getItem("saoJoaoPurchase"));

function formatCurrency(value) {
  return Number(value).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function setStatus(text, type = "waiting") {
  statusBox.textContent = text;
  statusBox.classList.remove("approved", "error");

  if (type === "approved") {
    statusBox.classList.add("approved");
  }

  if (type === "error") {
    statusBox.classList.add("error");
  }
}

function getPaymentStatusText(statusPagamento) {
  if (statusPagamento === "pago") {
    return "Pagamento confirmado";
  }

  return "Pagamento ainda não confirmado";
}

function getPaymentStatusType(statusPagamento) {
  if (statusPagamento === "pago") {
    return "approved";
  }

  return "waiting";
}

function buildWhatsappLink({ whatsappNumber, buyer, pedidoId, valorTotal }) {
  const message = encodeURIComponent(
    `Olá, segue o comprovante do pagamento do ingresso do Arraiá do CETEP.\n\n` +
    `Nome: ${buyer.fullName}\n` +
    `Email: ${buyer.email}\n` +
    `Pedido: ${pedidoId}\n` +
    `Valor: ${formatCurrency(valorTotal)}`
  );

  return `https://wa.me/${whatsappNumber}?text=${message}`;
}

async function loadPaymentData() {
  if (!currentPurchaseData || !currentPurchaseData.pedidoId) {
    setStatus("Pedido não encontrado. Volte para a compra e refaça o pedido.", "error");

    if (copyPixButton) copyPixButton.disabled = true;
    if (simulatePaymentButton) simulatePaymentButton.disabled = true;
    if (ticketButton) ticketButton.style.display = "none";

    return;
  }

  try {
    const response = await fetch(`${API_URL}/api/pedidos/${currentPurchaseData.pedidoId}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Erro ao buscar pedido.");
    }

    const comprador = data.comprador;
    const pedido = data.pedido;
    const ingresso = data.ingresso;

    buyerName.textContent = comprador?.fullName || "Comprador não encontrado";
    buyerEmail.textContent = comprador?.email || "-";
    ticketQuantity.textContent = `${pedido.quantidade} ingresso(s)`;
    totalPrice.textContent = formatCurrency(pedido.valorTotal);

    currentPixKey = data.pix?.key || "";

    pixCode.value =
      `Chave Pix: ${data.pix?.key || "Não configurada"}\n` +
      `Recebedor: ${data.pix?.receiverName || "Não informado"}\n` +
      `Valor: ${formatCurrency(pedido.valorTotal)}\n` +
      `Pedido: ${data.pedidoId}\n` +
      `Código do ingresso: ${ingresso?.codigoValidacao || pedido.codigoValidacao || "-"}`;

    const updatedPurchase = {
      ...currentPurchaseData,
      pedidoId: data.pedidoId,
      ingressoId: ingresso?.ingressoId || pedido.ingressoId,
      codigoValidacao: ingresso?.codigoValidacao || pedido.codigoValidacao,
      compradorId: pedido.compradorId,
      quantity: pedido.quantidade,
      unitPrice: pedido.valorUnitario,
      totalPrice: pedido.valorTotal,
      status: pedido.status,
      statusPagamento: pedido.statusPagamento
    };

    localStorage.setItem("saoJoaoPurchase", JSON.stringify(updatedPurchase));
    currentPurchaseData = updatedPurchase;

    setStatus(
      getPaymentStatusText(pedido.statusPagamento),
      getPaymentStatusType(pedido.statusPagamento)
    );

    if (data.whatsapp?.number) {
      currentWhatsappLink = buildWhatsappLink({
        whatsappNumber: data.whatsapp.number,
        buyer: comprador,
        pedidoId: data.pedidoId,
        valorTotal: pedido.valorTotal
      });

      simulatePaymentButton.textContent = "Enviar comprovante pelo WhatsApp";
      simulatePaymentButton.disabled = false;
    } else {
      simulatePaymentButton.textContent = "WhatsApp não configurado";
      simulatePaymentButton.disabled = true;
    }

    ticketButton.style.display = "block";
    ticketButton.textContent = "Ver ingresso";
  } catch (error) {
    setStatus(error.message, "error");

    if (copyPixButton) copyPixButton.disabled = true;
    if (simulatePaymentButton) simulatePaymentButton.disabled = true;
    if (ticketButton) ticketButton.style.display = "none";
  }
}

async function copyPixKey() {
  if (!currentPixKey) {
    setStatus("Chave Pix não encontrada.", "error");
    return;
  }

  try {
    await navigator.clipboard.writeText(currentPixKey);
    copyPixButton.textContent = "Chave copiada";

    setTimeout(() => {
      copyPixButton.textContent = "Copiar chave Pix";
    }, 1500);
  } catch (error) {
    pixCode.select();
    document.execCommand("copy");

    copyPixButton.textContent = "Dados copiados";

    setTimeout(() => {
      copyPixButton.textContent = "Copiar chave Pix";
    }, 1500);
  }
}

function openWhatsapp() {
  if (!currentWhatsappLink) {
    setStatus("WhatsApp não configurado.", "error");
    return;
  }

  window.open(currentWhatsappLink, "_blank");
}

copyPixButton.textContent = "Copiar chave Pix";
copyPixButton.addEventListener("click", copyPixKey);

simulatePaymentButton.textContent = "Enviar comprovante pelo WhatsApp";
simulatePaymentButton.addEventListener("click", openWhatsapp);

ticketButton.addEventListener("click", () => {
  window.location.href = "ingresso.html";
});

backButton.addEventListener("click", () => {
  window.location.href = "compra.html";
});

loadPaymentData();