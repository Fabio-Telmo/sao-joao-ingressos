const API_URL = "https://sao-joao-ingressos.onrender.com";

const adminToken = localStorage.getItem("saoJoaoAdminToken");

if (!adminToken) {
  window.location.href = "login-admin.html?redirect=admin.html";
}

const video = document.getElementById("video");
const cameraPlaceholder = document.getElementById("cameraPlaceholder");
const scanFrame = document.getElementById("scanFrame");
const startScannerButton = document.getElementById("startScannerButton");
const stopScannerButton = document.getElementById("stopScannerButton");
const ticketCodeInput = document.getElementById("ticketCodeInput");
const validateButton = document.getElementById("validateButton");
const resultBox = document.getElementById("resultBox");
const useActions = document.getElementById("useActions");
const markAsUsedButton = document.getElementById("markAsUsedButton");
const clearButton = document.getElementById("clearButton");

let cameraStream = null;
let scannerInterval = null;
let currentValidTicket = null;

function formatCurrency(value) {
  return Number(value).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function formatDateTime(value) {
  if (!value) return "-";

  if (value._seconds) {
    return new Date(value._seconds * 1000).toLocaleString("pt-BR");
  }

  return new Date(value).toLocaleString("pt-BR");
}

function getPaymentLabel(statusPagamento) {
  if (statusPagamento === "pago") return "Pago";
  return "Não pago";
}

function getUsedLabel(usado) {
  return usado ? "Usado" : "Não usado";
}

function showResult(type, title, message, ticket = null) {
  resultBox.className = `result show ${type}`;

  let details = "";

  if (ticket) {
    details = `
      <div class="ticket-details">
        <div class="detail">
          <span>Código</span>
          <strong>${ticket.code}</strong>
        </div>

        <div class="detail">
          <span>Nome</span>
          <strong>${ticket.name}</strong>
        </div>

        <div class="detail">
          <span>Email</span>
          <strong>${ticket.email}</strong>
        </div>

        <div class="detail">
          <span>Telefone</span>
          <strong>${ticket.phone}</strong>
        </div>

        <div class="detail">
          <span>Quantidade</span>
          <strong>${ticket.quantity} ingresso(s)</strong>
        </div>

        <div class="detail">
          <span>Valor</span>
          <strong>${formatCurrency(ticket.totalPrice)}</strong>
        </div>

        <div class="detail">
          <span>Pagamento</span>
          <strong>${getPaymentLabel(ticket.statusPagamento)}</strong>
        </div>

        <div class="detail">
          <span>Uso</span>
          <strong>${getUsedLabel(ticket.used)}</strong>
        </div>
      </div>
    `;
  }

  resultBox.innerHTML = `
    <h2>${title}</h2>
    <p>${message}</p>
    ${details}
  `;
}

function normalizeTicketData(data) {
  const ingresso = data.ingresso;
  const comprador = data.comprador;
  const pedido = data.pedido;

  return {
    code: ingresso.codigoValidacao,
    name: comprador?.fullName || "-",
    email: comprador?.email || "-",
    phone: comprador?.phone || "-",
    quantity: ingresso.quantidade || pedido?.quantidade || 0,
    totalPrice: ingresso.valorTotal || pedido?.valorTotal || 0,
    statusPagamento: ingresso.statusPagamento || pedido?.statusPagamento || "nao_pago",
    used: Boolean(ingresso.usado),
    usedAt: ingresso.usadoEm || null
  };
}

async function validateTicketCode(code) {
  const normalizedCode = code.trim().toUpperCase();

  currentValidTicket = null;
  useActions.style.display = "none";

  if (!normalizedCode) {
    showResult("invalid", "Código vazio", "Digite ou escaneie um código antes de validar.");
    return;
  }

  try {
    const response = await fetch(`${API_URL}/api/ingressos/${encodeURIComponent(normalizedCode)}`, {
      headers: {
        "X-Admin-Token": adminToken
      }
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Ingresso inválido.");
    }

    const ticket = normalizeTicketData(data);

    if (ticket.statusPagamento !== "pago") {
      showResult(
        "invalid",
        "Pagamento não confirmado",
        "Este ingresso existe, mas ainda está com status de pagamento não pago. Não libere a entrada.",
        ticket
      );
      return;
    }

    if (ticket.used) {
      showResult(
        "used",
        "Ingresso já utilizado",
        `A entrada desse ingresso já foi registrada em ${formatDateTime(ticket.usedAt)}. Não libere a entrada novamente.`,
        ticket
      );
      return;
    }

    currentValidTicket = ticket;

    showResult(
      "valid",
      "Ingresso válido",
      "Pagamento confirmado e ingresso ainda não utilizado. A entrada pode ser liberada.",
      ticket
    );

    useActions.style.display = "flex";
  } catch (error) {
    showResult("invalid", "Ingresso inválido", error.message);
  }
}

async function markCurrentTicketAsUsed() {
  if (!currentValidTicket) return;

  try {
    const response = await fetch(`${API_URL}/api/ingressos/${encodeURIComponent(currentValidTicket.code)}/usar`, {
      method: "POST",
      headers: {
        "X-Admin-Token": adminToken
      }
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Erro ao registrar entrada.");
    }

    currentValidTicket.used = true;
    currentValidTicket.usedAt = data.usadoEm || new Date().toISOString();

    showResult(
      "used",
      "Entrada registrada",
      `Ingresso marcado como usado em ${formatDateTime(currentValidTicket.usedAt)}. Se a pessoa tentar passar novamente, o sistema vai bloquear.`,
      currentValidTicket
    );

    currentValidTicket = null;
    useActions.style.display = "none";
  } catch (error) {
    showResult("invalid", "Erro ao registrar entrada", error.message, currentValidTicket);
  }
}

function clearValidation() {
  currentValidTicket = null;
  ticketCodeInput.value = "";
  resultBox.className = "result";
  resultBox.innerHTML = "";
  useActions.style.display = "none";
}

async function startScanner() {
  if (!("BarcodeDetector" in window)) {
    showResult(
      "invalid",
      "Leitor não disponível",
      "Este navegador não tem suporte ao leitor nativo de QR Code. Digite o código manualmente ou use outro navegador."
    );
    return;
  }

  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "environment"
      }
    });

    video.srcObject = cameraStream;
    video.style.display = "block";
    cameraPlaceholder.style.display = "none";
    scanFrame.style.display = "block";
    startScannerButton.disabled = true;
    stopScannerButton.disabled = false;

    const detector = new BarcodeDetector({ formats: ["qr_code"] });

    scannerInterval = setInterval(async () => {
      try {
        const codes = await detector.detect(video);

        if (codes.length > 0) {
          const scannedCode = codes[0].rawValue;
          ticketCodeInput.value = scannedCode;
          await validateTicketCode(scannedCode);
          stopScanner();
        }
      } catch (error) {
        console.log("Erro ao ler QR Code:", error);
      }
    }, 700);
  } catch (error) {
    showResult(
      "invalid",
      "Câmera bloqueada",
      "Não foi possível acessar a câmera. Verifique a permissão do navegador ou digite o código manualmente."
    );
  }
}

function stopScanner() {
  if (scannerInterval) {
    clearInterval(scannerInterval);
    scannerInterval = null;
  }

  if (cameraStream) {
    cameraStream.getTracks().forEach((track) => track.stop());
    cameraStream = null;
  }

  video.srcObject = null;
  video.style.display = "none";
  cameraPlaceholder.style.display = "block";
  scanFrame.style.display = "none";
  startScannerButton.disabled = false;
  stopScannerButton.disabled = true;
}

validateButton.addEventListener("click", () => {
  validateTicketCode(ticketCodeInput.value);
});

ticketCodeInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    validateTicketCode(ticketCodeInput.value);
  }
});

markAsUsedButton.addEventListener("click", markCurrentTicketAsUsed);
clearButton.addEventListener("click", clearValidation);
startScannerButton.addEventListener("click", startScanner);
stopScannerButton.addEventListener("click", stopScanner);