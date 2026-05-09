document.addEventListener("DOMContentLoaded", () => {
  // MENU MOBILE
  const menuBtn = document.getElementById("menu-btn");
  const nav = document.getElementById("nav");

  if (menuBtn && nav) {
    menuBtn.addEventListener("click", () => {
      nav.classList.toggle("show");
    });

    document.querySelectorAll(".nav a").forEach((link) => {
      link.addEventListener("click", () => {
        nav.classList.remove("show");
      });
    });
  }

  // CARROSSEL
  const slides = document.querySelectorAll(".slide");
  const prevBtn = document.getElementById("prev-slide");
  const nextBtn = document.getElementById("next-slide");
  let currentSlide = 0;
  let autoSlide;

  function showSlide(index) {
    if (!slides.length) return;

    slides.forEach((slide) => slide.classList.remove("active"));
    currentSlide = (index + slides.length) % slides.length;
    slides[currentSlide].classList.add("active");
  }

  function startAutoSlide() {
    if (!slides.length) return;

    clearInterval(autoSlide);
    autoSlide = setInterval(() => {
      showSlide(currentSlide + 1);
    }, 4000);
  }

  if (slides.length) {
    prevBtn?.addEventListener("click", () => {
      showSlide(currentSlide - 1);
      startAutoSlide();
    });

    nextBtn?.addEventListener("click", () => {
      showSlide(currentSlide + 1);
      startAutoSlide();
    });

    startAutoSlide();
  }

  // ELEMENTOS DO CARRINHO / CHECKOUT
  const cartToggle = document.getElementById("cart-toggle");
  const cartSidebar = document.getElementById("cart-sidebar");
  const closeCart = document.getElementById("close-cart");
  const overlay = document.getElementById("overlay");
  const cartItemsContainer = document.getElementById("cart-items");
  const cartTotal = document.getElementById("cart-total");
  const cartCount = document.getElementById("cart-count");
  const clearCartBtn = document.getElementById("clear-cart");
  const addToCartButtons = document.querySelectorAll(".add-to-cart");

  const checkoutBtn = document.getElementById("checkout-btn");
  const checkoutModal = document.getElementById("checkout-modal");
  const closeCheckout = document.getElementById("close-checkout");
  const checkoutForm = document.getElementById("checkout-form");
  const checkoutMessage = document.getElementById("checkout-message");
  const invoiceBox = document.getElementById("invoice-box");
  const checkoutTitle = document.getElementById("checkout-title");

  const nomeInput = document.getElementById("cliente-nome");
  const cpfInput = document.getElementById("cliente-cpf");
  const enderecoInput = document.getElementById("cliente-endereco");
  const pagamentoInput = document.getElementById("cliente-pagamento");

  // CARRINHO NO LOCAL STORAGE
  function getCart() {
    return JSON.parse(localStorage.getItem("raizCart")) || [];
  }

  function saveCart(cart) {
    localStorage.setItem("raizCart", JSON.stringify(cart));
  }

  function formatPrice(value) {
    return value.toFixed(2).replace(".", ",");
  }

  function updateCartCount() {
    const cart = getCart();
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

    if (cartCount) {
      cartCount.textContent = totalItems;
    }
  }

  function renderCart() {
    if (!cartItemsContainer || !cartTotal) return;

    const cart = getCart();
    cartItemsContainer.innerHTML = "";

    if (cart.length === 0) {
      cartItemsContainer.innerHTML = '<p class="empty-cart">Seu carrinho está vazio.</p>';
      cartTotal.textContent = "0,00";
      updateCartCount();
      return;
    }

    let total = 0;

    cart.forEach((item) => {
      total += item.price * item.quantity;

      const cartItem = document.createElement("div");
      cartItem.classList.add("cart-item");

      cartItem.innerHTML = `
        <img src="${item.image}" alt="${item.name}">
        <div>
          <h4>${item.name}</h4>
          <p>${item.measureLabel || ""}</p>
          <p>R$ ${formatPrice(item.price)}</p>
          <div class="cart-controls">
            <button class="qty-btn decrease" data-id="${item.id}">-</button>
            <span>${item.quantity}</span>
            <button class="qty-btn increase" data-id="${item.id}">+</button>
          </div>
          <button class="remove-item" data-id="${item.id}">Remover</button>
        </div>
      `;

      cartItemsContainer.appendChild(cartItem);
    });

    cartTotal.textContent = formatPrice(total);
    updateCartCount();

    document.querySelectorAll(".increase").forEach((button) => {
      button.addEventListener("click", () => {
        changeQuantity(button.dataset.id, 1);
      });
    });

    document.querySelectorAll(".decrease").forEach((button) => {
      button.addEventListener("click", () => {
        changeQuantity(button.dataset.id, -1);
      });
    });

    document.querySelectorAll(".remove-item").forEach((button) => {
      button.addEventListener("click", () => {
        removeFromCart(button.dataset.id);
      });
    });
  }

  function addToCart(product) {
    const cart = getCart();
    const existingProduct = cart.find((item) => item.id === product.id);

    if (existingProduct) {
      existingProduct.quantity += 1;
    } else {
      cart.push({
        ...product,
        quantity: 1
      });
    }

    saveCart(cart);
    renderCart();
  }

  function changeQuantity(productId, amount) {
    let cart = getCart();

    cart = cart
      .map((item) => {
        if (item.id === productId) {
          return {
            ...item,
            quantity: item.quantity + amount
          };
        }
        return item;
      })
      .filter((item) => item.quantity > 0);

    saveCart(cart);
    renderCart();
  }

  function removeFromCart(productId) {
    const cart = getCart().filter((item) => item.id !== productId);
    saveCart(cart);
    renderCart();
  }

  // ADICIONAR AO CARRINHO
  if (addToCartButtons.length) {
    addToCartButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const unit = button.dataset.unit || "";
        let measureLabel = "";

        switch (unit) {
          case "kg":
            measureLabel = "Venda por kg";
            break;
          case "unidade":
            measureLabel = "Venda por unidade";
            break;
          case "pacote":
            measureLabel = "Venda por pacote";
            break;
          case "garrafa":
            measureLabel = "Venda por garrafa";
            break;
          case "lata":
            measureLabel = "Venda por lata";
            break;
          default:
            measureLabel = "";
        }

        const product = {
          id: button.dataset.id,
          name: button.dataset.name,
          price: Number(button.dataset.price),
          image: button.dataset.image,
          unit,
          measureLabel
        };

        addToCart(product);
      });
    });
  }

  // ABRIR / FECHAR CARRINHO
  cartToggle?.addEventListener("click", () => {
    cartSidebar?.classList.add("open");
    overlay?.classList.add("show");
  });

  closeCart?.addEventListener("click", () => {
    cartSidebar?.classList.remove("open");
    overlay?.classList.remove("show");
  });

  // Fecha só o carrinho lateral. Se modal estiver aberto, não fecha nada.
  overlay?.addEventListener("click", () => {
    const modalAberto = checkoutModal?.classList.contains("show");

    if (!modalAberto) {
      cartSidebar?.classList.remove("open");
      overlay?.classList.remove("show");
    }
  });

  // LIMPAR CARRINHO
  clearCartBtn?.addEventListener("click", () => {
    localStorage.removeItem("raizCart");
    renderCart();
  });

  // MÁSCARA DE CPF
  function formatCPF(value) {
    return value
      .replace(/\D/g, "")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2")
      .slice(0, 14);
  }

  cpfInput?.addEventListener("input", (event) => {
    event.target.value = formatCPF(event.target.value);
    cpfInput.classList.remove("input-error");
    checkoutMessage.textContent = "";
  });

  nomeInput?.addEventListener("input", () => {
    nomeInput.classList.remove("input-error");
    checkoutMessage.textContent = "";
  });

  enderecoInput?.addEventListener("input", () => {
    enderecoInput.classList.remove("input-error");
    checkoutMessage.textContent = "";
  });

  pagamentoInput?.addEventListener("change", () => {
    pagamentoInput.classList.remove("input-error");
    checkoutMessage.textContent = "";
  });

  function validateCPF(cpf) {
    const cleaned = cpf.replace(/\D/g, "");
    return /^\d{11}$/.test(cleaned);
  }

  function clearFieldErrors() {
    nomeInput?.classList.remove("input-error");
    cpfInput?.classList.remove("input-error");
    enderecoInput?.classList.remove("input-error");
    pagamentoInput?.classList.remove("input-error");
  }

  function resetCheckoutState() {
    checkoutMessage.textContent = "";
    checkoutMessage.style.color = "#333333";
    invoiceBox.innerHTML = "";
    invoiceBox.classList.remove("show");
    checkoutForm.classList.remove("hidden");
    if (checkoutTitle) checkoutTitle.textContent = "Finalizar compra";
    clearFieldErrors();
  }

  // CHECKOUT
  checkoutBtn?.addEventListener("click", () => {
    const cart = getCart();

    if (cart.length === 0) {
      alert("Seu carrinho está vazio.");
      return;
    }

    resetCheckoutState();
    checkoutModal?.classList.add("show");
  });

  // Fecha modal SOMENTE no X
  closeCheckout?.addEventListener("click", () => {
    checkoutModal?.classList.remove("show");
    checkoutForm?.reset();
    resetCheckoutState();

    // Se carrinho lateral não estiver aberto, remove overlay
    const carrinhoAberto = cartSidebar?.classList.contains("open");
    if (!carrinhoAberto) {
      overlay?.classList.remove("show");
    }
  });

  checkoutForm?.addEventListener("submit", (event) => {
    event.preventDefault();

    clearFieldErrors();

    const nome = nomeInput?.value.trim() || "";
    const cpf = cpfInput?.value.trim() || "";
    const endereco = enderecoInput?.value.trim() || "";
    const pagamento = pagamentoInput?.value || "";
    const cart = getCart();

    if (!nome) {
      nomeInput?.classList.add("input-error");
      checkoutMessage.textContent = "Informe o nome completo.";
      checkoutMessage.style.color = "#C0392B";
      return;
    }

    if (!validateCPF(cpf)) {
      cpfInput?.classList.add("input-error");
      checkoutMessage.textContent = "CPF incorreto. Digite os 11 números corretamente.";
      checkoutMessage.style.color = "#C0392B";
      return;
    }

    if (!endereco) {
      enderecoInput?.classList.add("input-error");
      checkoutMessage.textContent = "Informe o endereço.";
      checkoutMessage.style.color = "#C0392B";
      return;
    }

    if (!pagamento) {
      pagamentoInput?.classList.add("input-error");
      checkoutMessage.textContent = "Selecione a forma de pagamento.";
      checkoutMessage.style.color = "#C0392B";
      return;
    }

    if (cart.length === 0) {
      checkoutMessage.textContent = "Seu carrinho está vazio.";
      checkoutMessage.style.color = "#C0392B";
      return;
    }

    let total = 0;
    let itemsHtml = "";

    cart.forEach((item) => {
      const subtotal = item.price * item.quantity;
      total += subtotal;

      itemsHtml += `
        <li>
          ${item.name} - ${item.quantity}x - R$ ${formatPrice(item.price)}
          <strong>(Subtotal: R$ ${formatPrice(subtotal)})</strong>
        </li>
      `;
    });

    invoiceBox.innerHTML = `
      <h4>Nota fiscal / Resumo do pedido</h4>
      <p><strong>Cliente:</strong> ${nome}</p>
      <p><strong>CPF:</strong> ${cpf}</p>
      <p><strong>Endereço:</strong> ${endereco}</p>
      <p><strong>Forma de pagamento:</strong> ${pagamento}</p>
      <p><strong>Itens comprados:</strong></p>
      <ul>${itemsHtml}</ul>
      <p><strong>Total do pedido:</strong> R$ ${formatPrice(total)}</p>
    `;

    invoiceBox.classList.add("show");
    checkoutForm.classList.add("hidden");

    if (checkoutTitle) {
      checkoutTitle.textContent = "Compra finalizada";
    }

    checkoutMessage.textContent = "Compra finalizada com sucesso.";
    checkoutMessage.style.color = "#2E7D32";

    localStorage.removeItem("raizCart");
    renderCart();
  });

  // INICIALIZAÇÃO
  renderCart();
  updateCartCount();
});