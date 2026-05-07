const API_URL = "https://sao-joao-ingressos.onrender.com";

const purchaseData = JSON.parse(localStorage.getItem("saoJoaoPurchase"));

const ticketContainer = document.getElementById("ticketContainer");
const errorCard = document.getElementById("errorCard");

const ticketName = document.getElementById("ticketName");
const ticketEmail = document.getElementById("ticketEmail");
const ticketPhone = document.getElementById("ticketPhone");
const ticketBirthDate = document.getElementById("ticketBirthDate");
const ticketQuantity = document.getElementById("ticketQuantity");
const ticketTotal = document.getElementById("ticketTotal");
const ticketCode = document.getElementById("ticketCode");

const printButton = document.getElementById("printButton");
const newPurchaseButton = document.getElementById("newPurchaseButton");
const goToRegisterButton = document.getElementById("goToRegisterButton");

function formatCurrency(value) {
  return Number(value).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function formatDate(dateValue) {
  if (!dateValue) return "-";

  const [year, month, day] = dateValue.split("-");
  return `${day}/${month}/${year}`;
}

function showError(message = "Não encontrei um ingresso válido. Volte para o cadastro e faça o fluxo novamente.") {
  ticketContainer.style.display = "none";
  errorCard.style.display = "block";

  const errorText = errorCard.querySelector("p");

  if (errorText) {
    errorText.textContent = message;
  }
}

function getPaymentStatusLabel(statusPagamento) {
  if (statusPagamento === "pago") {
    return "Pago";
  }

  return "Não pago";
}

function getPaymentStatusColor(statusPagamento) {
  if (statusPagamento === "pago") {
    return {
      background: "rgba(142, 229, 157, 0.34)",
      color: "#23633a",
      border: "rgba(38, 166, 91, 0.28)"
    };
  }

  return {
    background: "rgba(255, 216, 107, 0.38)",
    color: "#735000",
    border: "rgba(183, 121, 0, 0.25)"
  };
}

function createOrUpdatePaymentStatus(statusPagamento) {
  let statusElement = document.getElementById("paymentStatus");

  if (!statusElement) {
    statusElement = document.createElement("div");
    statusElement.id = "paymentStatus";

    const qrSection = document.querySelector(".qr-section");

    if (qrSection) {
      qrSection.appendChild(statusElement);
    }
  }

  const colors = getPaymentStatusColor(statusPagamento);

  statusElement.textContent = `Status do pagamento: ${getPaymentStatusLabel(statusPagamento)}`;
  statusElement.style.marginTop = "12px";
  statusElement.style.padding = "10px 12px";
  statusElement.style.borderRadius = "14px";
  statusElement.style.fontWeight = "900";
  statusElement.style.background = colors.background;
  statusElement.style.color = colors.color;
  statusElement.style.border = `1px solid ${colors.border}`;
}

async function loadTicket() {
  if (!purchaseData || !purchaseData.pedidoId) {
    showError("Pedido não encontrado. Volte para a compra e gere um pedido novamente.");
    return;
  }

  try {
    const response = await fetch(`${API_URL}/api/pedidos/${purchaseData.pedidoId}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Erro ao buscar ingresso.");
    }

    const comprador = data.comprador;
    const pedido = data.pedido;
    const ingresso = data.ingresso;

    if (!pedido || !ingresso) {
      showError("Ingresso não encontrado para este pedido.");
      return;
    }

    ticketName.textContent = comprador?.fullName || "-";
    ticketEmail.textContent = comprador?.email || "-";
    ticketPhone.textContent = comprador?.phone || "-";
    ticketBirthDate.textContent = formatDate(comprador?.birthDate);
    ticketQuantity.textContent = `${ingresso.quantidade || pedido.quantidade} ingresso(s)`;
    ticketTotal.textContent = formatCurrency(ingresso.valorTotal || pedido.valorTotal);
    ticketCode.textContent = ingresso.codigoValidacao || pedido.codigoValidacao || "-";

    createOrUpdatePaymentStatus(ingresso.statusPagamento || pedido.statusPagamento);

    const updatedPurchase = {
      ...purchaseData,
      pedidoId: data.pedidoId,
      ingressoId: ingresso.ingressoId || pedido.ingressoId,
      codigoValidacao: ingresso.codigoValidacao || pedido.codigoValidacao,
      statusPagamento: ingresso.statusPagamento || pedido.statusPagamento,
      quantity: ingresso.quantidade || pedido.quantidade,
      totalPrice: ingresso.valorTotal || pedido.valorTotal
    };

    localStorage.setItem("saoJoaoPurchase", JSON.stringify(updatedPurchase));
  } catch (error) {
    showError(error.message);
  }
}

printButton.addEventListener("click", () => {
  window.print();
});

newPurchaseButton.addEventListener("click", () => {
  localStorage.removeItem("saoJoaoPurchase");
  window.location.href = "compra.html";
});

goToRegisterButton.addEventListener("click", () => {
  window.location.href = "cadastro.html";
});

loadTicket();