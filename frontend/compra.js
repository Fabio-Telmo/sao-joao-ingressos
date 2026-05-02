 const API_URL = "https://sao-joao-ingressos.onrender.com";

  const TICKET_PRICE = 10;
  const MAX_TICKETS = 10;

  const buyerName = document.getElementById("buyerName");
  const buyerEmail = document.getElementById("buyerEmail");
  const unitPrice = document.getElementById("unitPrice");
  const totalPrice = document.getElementById("totalPrice");
  const quantityInput = document.getElementById("quantity");
  const decreaseButton = document.getElementById("decreaseButton");
  const increaseButton = document.getElementById("increaseButton");
  const purchaseForm = document.getElementById("purchaseForm");
  const backButton = document.getElementById("backButton");
  const warningMessage = document.getElementById("warningMessage");

  const buyerData = JSON.parse(localStorage.getItem("saoJoaoBuyer"));

  function formatCurrency(value) {
    return Number(value).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL"
    });
  }

  function showWarning(text) {
    warningMessage.textContent = text;
    warningMessage.classList.add("show");
  }

  function hideWarning() {
    warningMessage.textContent = "";
    warningMessage.classList.remove("show");
  }

  function getQuantity() {
    let quantity = Number(quantityInput.value);

    if (!quantity || quantity < 1) {
      quantity = 1;
    }

    if (quantity > MAX_TICKETS) {
      quantity = MAX_TICKETS;
      showWarning(`O limite por compra é de ${MAX_TICKETS} ingressos.`);
    } else {
      hideWarning();
    }

    quantityInput.value = quantity;
    return quantity;
  }

  function updateTotal() {
    const quantity = getQuantity();
    const total = quantity * TICKET_PRICE;

    totalPrice.textContent = formatCurrency(total);
  }

  if (!buyerData || !buyerData.compradorId) {
    showWarning("Nenhum cadastro válido foi encontrado. Volte para a página de cadastro antes de comprar.");
    purchaseForm.style.display = "none";
    buyerName.textContent = "Cadastro não encontrado";
    buyerEmail.textContent = "";
  } else {
    buyerName.textContent = buyerData.fullName;
    buyerEmail.textContent = buyerData.email;
  }

  unitPrice.textContent = formatCurrency(TICKET_PRICE);
  updateTotal();

  decreaseButton.addEventListener("click", () => {
    const currentQuantity = getQuantity();

    if (currentQuantity > 1) {
      quantityInput.value = currentQuantity - 1;
      updateTotal();
    }
  });

  increaseButton.addEventListener("click", () => {
    const currentQuantity = getQuantity();

    if (currentQuantity < MAX_TICKETS) {
      quantityInput.value = currentQuantity + 1;
      updateTotal();
    } else {
      showWarning(`O limite por compra é de ${MAX_TICKETS} ingressos.`);
    }
  });

  quantityInput.addEventListener("input", updateTotal);

  backButton.addEventListener("click", () => {
    window.location.href = "cadastro.html";
  });

  purchaseForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!buyerData || !buyerData.compradorId) {
      showWarning("Faça o cadastro antes de continuar.");
      return;
    }

    const button = purchaseForm.querySelector(".button.primary");
    button.disabled = true;
    button.textContent = "Criando pedido...";

    const quantity = getQuantity();

    try {
      const response = await fetch(`${API_URL}/api/pedidos`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          compradorId: buyerData.compradorId,
          quantity
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Erro ao criar pedido.");
      }

      const purchaseData = {
        pedidoId: data.pedidoId,
        compradorId: buyerData.compradorId,
        quantity: data.pedido.quantidade,
        unitPrice: data.pedido.valorUnitario,
        totalPrice: data.pedido.valorTotal,
        status: data.pedido.status,
        createdAt: new Date().toISOString()
      };

      localStorage.setItem("saoJoaoPurchase", JSON.stringify(purchaseData));

      window.location.href = "pagamento.html";
    } catch (error) {
      showWarning(error.message);

      button.disabled = false;
      button.textContent = "Continuar para pagamento";
    }
  });
