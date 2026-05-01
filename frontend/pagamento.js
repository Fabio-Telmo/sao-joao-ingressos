   const API_URL = "https://sao-joao-ingressos.onrender.com/";

  
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
  const pixKeyText = document.getElementById("pixKeyText");
  const pixReceiverText = document.getElementById("pixReceiverText");
  const pixValueText = document.getElementById("pixValueText");
  const copyPixKeyButton = document.getElementById("copyPixKeyButton");

let currentPixKey = "";
  const purchaseData = JSON.parse(localStorage.getItem("saoJoaoPurchase"));

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

  async function loadPaymentData() {
    if (!purchaseData || !purchaseData.pedidoId) {
      setStatus("Pedido não encontrado. Volte para a compra e refaça o pedido.", "error");
      copyPixButton.disabled = true;
      simulatePaymentButton.disabled = true;
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/pedidos/${purchaseData.pedidoId}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Erro ao buscar pedido.");
      }

      buyerName.textContent = data.comprador.fullName;
      buyerEmail.textContent = data.comprador.email;
      ticketQuantity.textContent = `${data.pedido.quantidade} ingresso(s)`;
      totalPrice.textContent = formatCurrency(data.pedido.valorTotal);

      currentPixKey = data.pix.key || "";

pixKeyText.textContent = currentPixKey || "Chave Pix não configurada";
pixReceiverText.textContent = `Recebedor: ${data.pix.receiverName || "Não informado"}`;
pixValueText.textContent = `Valor: ${formatCurrency(data.pedido.valorTotal)}`;

pixCode.value =
  `Chave Pix: ${data.pix.key}\n` +
  `Recebedor: ${data.pix.receiverName}\n` +
  `Valor: ${formatCurrency(data.pedido.valorTotal)}\n` +
  `Identificação do pedido: ${data.pedidoId}`;

      if (data.pedido.status === "pendente") {
        setStatus("Faça o Pix e depois clique em “Já paguei”.");
      }

      if (data.pedido.status === "aguardando_confirmacao") {
        setStatus("Pagamento informado. Aguarde a confirmação do administrador.");
        simulatePaymentButton.disabled = true;
        simulatePaymentButton.textContent = "Aguardando confirmação";
      }

      if (data.pedido.status === "pago") {
        setStatus("Pagamento confirmado. Seu ingresso está liberado.", "approved");
        simulatePaymentButton.style.display = "none";
        ticketButton.style.display = "block";

        const updatedPurchase = {
          ...purchaseData,
          status: "pago",
          ticketCode: data.pedido.codigoValidacao
        };

        localStorage.setItem("saoJoaoPurchase", JSON.stringify(updatedPurchase));
      }
    } catch (error) {
      setStatus(error.message, "error");
    }
  }

  async function copyPixCode() {
    try {
      await navigator.clipboard.writeText(pixCode.value);
      copyPixButton.textContent = "Dados copiados";

      setTimeout(() => {
        copyPixButton.textContent = "Copiar código Pix";
      }, 1500);
    } catch (error) {
      pixCode.select();
      document.execCommand("copy");
      copyPixButton.textContent = "Dados copiados";

      setTimeout(() => {
        copyPixButton.textContent = "Copiar código Pix";
      }, 1500);
    }
  }

  async function notifyPayment() {
    if (!purchaseData || !purchaseData.pedidoId) {
      setStatus("Pedido não encontrado.", "error");
      return;
    }

    simulatePaymentButton.disabled = true;
    simulatePaymentButton.textContent = "Enviando aviso...";

    try {
      const response = await fetch(`${API_URL}/api/pedidos/${purchaseData.pedidoId}/avisar-pagamento`, {
        method: "POST"
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Erro ao avisar pagamento.");
      }

      setStatus("Pagamento informado. Aguarde a confirmação do administrador.");
      simulatePaymentButton.textContent = "Aguardando confirmação";
    } catch (error) {
      setStatus(error.message, "error");
      simulatePaymentButton.disabled = false;
      simulatePaymentButton.textContent = "Já paguei";
    }
  }

  copyPixButton.addEventListener("click", copyPixCode);

  simulatePaymentButton.textContent = "Já paguei";
  simulatePaymentButton.addEventListener("click", notifyPayment);

  ticketButton.addEventListener("click", () => {
    window.location.href = "ingresso.html";
  });

  backButton.addEventListener("click", () => {
    window.location.href = "compra.html";
  });
  copyPixKeyButton.addEventListener("click", copyPixKey);
  async function copyPixKey() {
  if (!currentPixKey) {
    setStatus("Chave Pix não encontrada.", "error");
    return;
  }

  try {
    await navigator.clipboard.writeText(currentPixKey);

    copyPixKeyButton.textContent = "Copiado";

    setTimeout(() => {
      copyPixKeyButton.textContent = "Copiar";
    }, 1500);
  } catch (error) {
    const tempInput = document.createElement("input");
    tempInput.value = currentPixKey;
    document.body.appendChild(tempInput);
    tempInput.select();
    document.execCommand("copy");
    document.body.removeChild(tempInput);

    copyPixKeyButton.textContent = "Copiado";

    setTimeout(() => {
      copyPixKeyButton.textContent = "Copiar";
    }, 1500);
  }
}

  loadPaymentData();