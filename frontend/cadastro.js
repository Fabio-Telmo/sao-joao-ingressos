  const API_URL = "http://localhost:3000";

  const form = document.getElementById("registerForm");
  const phoneInput = document.getElementById("phone");
  const message = document.getElementById("message");

  phoneInput.addEventListener("input", () => {
    let value = phoneInput.value.replace(/\D/g, "");

    if (value.length > 11) {
      value = value.slice(0, 11);
    }

    if (value.length > 10) {
      phoneInput.value = value.replace(/^(\d{2})(\d{5})(\d{4})$/, "($1) $2-$3");
    } else if (value.length > 6) {
      phoneInput.value = value.replace(/^(\d{2})(\d{4})(\d{0,4})$/, "($1) $2-$3");
    } else if (value.length > 2) {
      phoneInput.value = value.replace(/^(\d{2})(\d{0,5})$/, "($1) $2");
    } else {
      phoneInput.value = value.replace(/^(\d*)$/, "($1");
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const button = form.querySelector("button");
    button.disabled = true;
    button.textContent = "Salvando cadastro...";

    const buyerData = {
      fullName: document.getElementById("fullName").value.trim(),
      birthDate: document.getElementById("birthDate").value,
      phone: document.getElementById("phone").value.trim(),
      email: document.getElementById("email").value.trim()
    };

    try {
      const response = await fetch(`${API_URL}/api/compradores`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(buyerData)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Erro ao cadastrar comprador.");
      }

      const buyerWithId = {
        ...buyerData,
        compradorId: data.compradorId
      };

      localStorage.setItem("saoJoaoBuyer", JSON.stringify(buyerWithId));

      message.textContent = "Cadastro salvo com sucesso. Indo para a compra...";
      message.classList.add("show");

      setTimeout(() => {
        window.location.href = "compra.html";
      }, 900);
    } catch (error) {
      message.textContent = error.message;
      message.classList.add("show");

      button.disabled = false;
      button.textContent = "Continuar para compra";
    }
  });