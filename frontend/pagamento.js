const API_URL = "https://sao-joao-ingressos.onrender.com";

const buyerName = document.getElementById("buyerName");
const buyerEmail = document.getElementById("buyerEmail");
const ticketQuantity = document.getElementById("ticketQuantity");
const totalPrice = document.getElementById("totalPrice");
const pixCode = document.getElementById("pixCode");
const statusBox = document.getElementById("statusBox");
const copyPixButton = document.getElementById("copyPixButton");
const copyPixKeyButton = document.getElementById("copyPixKeyButton");
const pixKeyText = document.getElementById("pixKeyText");
const pixReceiverText = document.getElementById("pixReceiverText");
const pixValueText = document.getElementById("pixValueText");
const whatsappButton = document.getElementById("simulatePaymentButton");
const ticketButton = document.getElementById("ticketButton");
const backButton = document.getElementById("backButton");

let currentPixKey = "";
let currentPaymentText = "";
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
    return "Pagamento confirmado. Seu ingresso está liberado para entrada.";
  }

  return "Pagamento ainda não confirmado. O ingresso já existe, mas a entrada só será liberada após confirmação do administrador.";
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
    `Nome: ${buyer?.fullName || "-"}\n` +
    `Email: ${buyer?.email || "-"}\n` +
    `Pedido: ${pedidoId}\n` +
    `Valor: ${formatCurrency(valorTotal)}`
  );

  return `https://wa.me/${whatsappNumber}?text=${message}`;
}

function disablePaymentActions() {
  if (copyPixButton) copyPixButton.disabled = true;
  if (copyPixKeyButton) copyPixKeyButton.disabled = true;
  if (whatsappButton) whatsappButton.disabled = true;
}

async function loadPaymentData() {
  if (!currentPurchaseData || !currentPurchaseData.pedidoId) {
    setStatus("Pedido não encontrado. Volte para a compra e refaça o pedido.", "error");
    disablePaymentActions();

    if (ticketButton) {
      ticketButton.style.display = "none";
    }

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

    const pixKey = data.pix?.key || "";
    const receiverName = data.pix?.receiverName || "";
    const valorTotal = Number(pedido.valorTotal || 0);
    const codigoIngresso = ingresso?.codigoValidacao || pedido.codigoValidacao || "-";

    buyerName.textContent = comprador?.fullName || "Comprador não encontrado";
    buyerEmail.textContent = comprador?.email || "-";
    ticketQuantity.textContent = `${pedido.quantidade} ingresso(s)`;
    totalPrice.textContent = formatCurrency(valorTotal);

    currentPixKey = pixKey;

    pixKeyText.textContent = pixKey || "Chave Pix não configurada";
    pixReceiverText.textContent = `Recebedor: ${receiverName || "Não informado"}`;
    pixValueText.textContent = `Valor: ${formatCurrency(valorTotal)}`;

    currentPaymentText =
      `Chave Pix: ${pixKey || "Não configurada"}\n` +
      `Recebedor: ${receiverName || "Não informado"}\n` +
      `Valor: ${formatCurrency(valorTotal)}\n` +
      `Pedido: ${data.pedidoId}\n` +
      `Código do ingresso: ${codigoIngresso}`;

    pixCode.value = currentPaymentText;

    const updatedPurchase = {
      ...currentPurchaseData,
      pedidoId: data.pedidoId,
      ingressoId: ingresso?.ingressoId || pedido.ingressoId,
      codigoValidacao: codigoIngresso,
      compradorId: pedido.compradorId,
      quantity: pedido.quantidade,
      unitPrice: pedido.valorUnitario,
      totalPrice: pedido.valorTotal,
      status: pedido.status,
      statusPagamento: pedido.statusPagamento,
      loteId: pedido.loteId,
      loteNome: pedido.loteNome
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
        valorTotal
      });

      whatsappButton.textContent = "Enviar comprovante pelo WhatsApp";
      whatsappButton.disabled = false;
    } else {
      whatsappButton.textContent = "WhatsApp não configurado";
      whatsappButton.disabled = true;
    }

    copyPixButton.disabled = !currentPaymentText;
    copyPixKeyButton.disabled = !currentPixKey;

    ticketButton.style.display = "block";
    ticketButton.textContent = "Ver ingresso";
  } catch (error) {
    setStatus(error.message, "error");
    disablePaymentActions();

    if (ticketButton) {
      ticketButton.style.display = "none";
    }
  }
}

async function copyText(text, button, defaultText) {
  if (!text) {
    setStatus("Nada para copiar.", "error");
    return;
  }

  try {
    await navigator.clipboard.writeText(text);
  } catch (error) {
    const tempInput = document.createElement("textarea");
    tempInput.value = text;
    document.body.appendChild(tempInput);
    tempInput.select();
    document.execCommand("copy");
    document.body.removeChild(tempInput);
  }

  button.textContent = "Copiado";

  setTimeout(() => {
    button.textContent = defaultText;
  }, 1500);
}

function openWhatsapp() {
  if (!currentWhatsappLink) {
    setStatus("WhatsApp não configurado.", "error");
    return;
  }

  window.open(currentWhatsappLink, "_blank");
}

copyPixButton.textContent = "Copiar dados do pagamento";
copyPixButton.addEventListener("click", () => {
  copyText(currentPaymentText, copyPixButton, "Copiar dados do pagamento");
});

copyPixKeyButton.textContent = "Copiar";
copyPixKeyButton.addEventListener("click", () => {
  copyText(currentPixKey, copyPixKeyButton, "Copiar");
});

whatsappButton.textContent = "Enviar comprovante pelo WhatsApp";
whatsappButton.addEventListener("click", openWhatsapp);

ticketButton.addEventListener("click", () => {
  window.location.href = "ingresso.html";
});

backButton.addEventListener("click", () => {
  window.location.href = "compra.html";
});

loadPaymentData();