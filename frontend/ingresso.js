    const buyerData = JSON.parse(localStorage.getItem("saoJoaoBuyer"));
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

    function showError() {
      ticketContainer.style.display = "none";
      errorCard.style.display = "block";
    }

    function loadTicket() {
      if (!buyerData || !purchaseData || purchaseData.status !== "pago") {
        showError();
        return;
      }

      ticketName.textContent = buyerData.fullName;
      ticketEmail.textContent = buyerData.email;
      ticketPhone.textContent = buyerData.phone;
      ticketBirthDate.textContent = formatDate(buyerData.birthDate);
      ticketQuantity.textContent = `${purchaseData.quantity} ingresso(s)`;
      ticketTotal.textContent = formatCurrency(purchaseData.totalPrice);
      ticketCode.textContent = purchaseData.ticketCode || "SJ-CODIGO-NAO-GERADO";
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