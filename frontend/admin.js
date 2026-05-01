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

    function getSimulatedTicket() {
      const buyerData = JSON.parse(localStorage.getItem("saoJoaoBuyer"));
      const purchaseData = JSON.parse(localStorage.getItem("saoJoaoPurchase"));
      const usedTickets = JSON.parse(localStorage.getItem("saoJoaoUsedTickets")) || [];

      if (!buyerData || !purchaseData || purchaseData.status !== "pago") {
        return null;
      }

      return {
        code: purchaseData.ticketCode,
        name: buyerData.fullName,
        email: buyerData.email,
        phone: buyerData.phone,
        quantity: purchaseData.quantity,
        totalPrice: purchaseData.totalPrice,
        used: usedTickets.includes(purchaseData.ticketCode),
        usedAt: localStorage.getItem(`usedAt_${purchaseData.ticketCode}`)
      };
    }

    function formatCurrency(value) {
      return Number(value).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL"
      });
    }

    function formatDateTime(value) {
      if (!value) return "-";
      return new Date(value).toLocaleString("pt-BR");
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
              <span>Valor pago</span>
              <strong>${formatCurrency(ticket.totalPrice)}</strong>
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

    function validateTicketCode(code) {
      const normalizedCode = code.trim().toUpperCase();
      const ticket = getSimulatedTicket();

      currentValidTicket = null;
      useActions.style.display = "none";

      if (!normalizedCode) {
        showResult("invalid", "Código vazio", "Digite ou escaneie um código antes de validar.");
        return;
      }

      if (!ticket || ticket.code !== normalizedCode) {
        showResult("invalid", "Ingresso inválido", "Este código não foi encontrado ou não pertence a uma compra paga.");
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
      showResult("valid", "Ingresso válido", "Compra paga encontrada. Você pode liberar a entrada e marcar o ingresso como usado.", ticket);
      useActions.style.display = "flex";
    }

    function markCurrentTicketAsUsed() {
      if (!currentValidTicket) return;

      const usedTickets = JSON.parse(localStorage.getItem("saoJoaoUsedTickets")) || [];

      if (!usedTickets.includes(currentValidTicket.code)) {
        usedTickets.push(currentValidTicket.code);
      }

      const usedAt = new Date().toISOString();
      localStorage.setItem("saoJoaoUsedTickets", JSON.stringify(usedTickets));
      localStorage.setItem(`usedAt_${currentValidTicket.code}`, usedAt);

      currentValidTicket.used = true;
      currentValidTicket.usedAt = usedAt;

      showResult(
        "used",
        "Entrada registrada",
        `Ingresso marcado como usado em ${formatDateTime(usedAt)}. Se a pessoa tentar passar de novo, o sistema vai bloquear.`,
        currentValidTicket
      );

      currentValidTicket = null;
      useActions.style.display = "none";
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
              validateTicketCode(scannedCode);
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