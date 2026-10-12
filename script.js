
/* =========================================
   K STORE — JAVASCRIPT
   Produtos: Supabase
   Login: senha do painel + conta Supabase
   Encomendas: WhatsApp
   Definições: Supabase
========================================= */

const ADMIN_PASSWORD = "KStore2026!";

const $ = (id) => document.getElementById(id);

let products = [];
let settings = {
  emola: "",
  mpesa: "",
  whatsapp: "",
  instructions: "Paga por e-Mola ou M-Pesa e envia o comprovativo pelo WhatsApp."
};

let selectedProductId = null;
let imageData = "";
let isAdmin = false;

function safeText(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function money(value) {
  return new Intl.NumberFormat("pt-MZ", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(Number(value) || 0) + " MT";
}

function finalPrice(product) {
  const price = Number(product.price);
  const promo = Number(product.promo);

  if (
    product.promo !== null &&
    product.promo !== undefined &&
    product.promo !== "" &&
    Number.isFinite(promo) &&
    promo >= 0 &&
    promo < price
  ) {
    return promo;
  }

  return price;
}

function notify(message) {
  const toast = $("toast");

  if (!toast) {
    alert(message);
    return;
  }

  toast.textContent = message;
  toast.classList.remove("hidden");

  clearTimeout(notify.timer);

  notify.timer = setTimeout(() => {
    toast.classList.add("hidden");
  }, 3500);
}

function normalizeNumber(value) {
  return String(value || "").replace(/\D/g, "");
}

/* ---------- SUPABASE: PRODUTOS ---------- */

async function carregarProdutosSupabase() {
  if (!window.supabaseClient) {
    console.error("Supabase não foi encontrado. Verifica supabase.js.");
    notify("Erro de ligação ao Supabase.");
    return false;
  }

  try {
    const { data, error } = await window.supabaseClient
      .from("products")
      .select("*")
      .eq("active", true)
      .order("id", { ascending: false });

    if (error) {
      console.error("Erro ao carregar produtos:", error);
      notify("Não foi possível carregar os produtos.");
      return false;
    }

    products = (data || []).map(p => ({
      id: p.id,
      name: p.name,
      description: p.description || "",
      price: Number(p.price),
      promo: p.promo ?? p.promo_price ?? null,
      category: p.category || "",
      image: p.image_url || ""
    }));

    renderProducts();

    if (isAdmin) renderAdminProducts();

    return true;
  } catch (error) {
    console.error("Erro inesperado nos produtos:", error);
    notify("Erro ao carregar produtos.");
    return false;
  }
}

/* ---------- MOSTRAR PRODUTOS ---------- */

function renderProducts() {
  const grid = $("productGrid");
  const empty = $("emptyProducts");

  if (!grid) {
    console.error("Não encontrei o elemento productGrid no HTML.");
    return;
  }

  if (empty) {
    empty.classList.toggle("hidden", products.length > 0);
  }

  grid.innerHTML = products.map(product => {
    const price = finalPrice(product);
    const onSale = price < Number(product.price);

    const image = product.image
      ? `<img class="product-image"
           src="${safeText(product.image)}"
           alt="${safeText(product.name)}">`
      : `<div class="product-placeholder">K</div>`;

    return `
      <article class="product-card">
        <div class="product-image-wrap">
          ${image}
          ${onSale ? '<span class="sale-badge">PROMOÇÃO</span>' : ""}
        </div>

        <div class="product-info">
          <span class="product-category">
            ${safeText(product.category || "K STORE")}
          </span>

          <h3>${safeText(product.name)}</h3>

          <p class="product-description">
            ${safeText(product.description || "Disponível na K STORE.")}
          </p>

          <div class="price-row">
            <span class="price">${money(price)}</span>
            ${onSale ? `<span class="old-price">${money(product.price)}</span>` : ""}
          </div>

          <button class="btn btn-light full"
            type="button"
            data-buy="${safeText(product.id)}">
            Comprar ↗
          </button>
        </div>
      </article>
    `;
  }).join("");

  grid.querySelectorAll("[data-buy]").forEach(button => {
    button.addEventListener("click", () => openOrder(button.dataset.buy));
  });
}

/* ---------- LOGIN DO ADMINISTRADOR ---------- */

function openAdmin() {
  $("adminModal").classList.remove("hidden");
  $("loginView").classList.remove("hidden");
  $("dashboard").classList.add("hidden");
  $("password").value = "";
  $("loginError").classList.add("hidden");
}

function closeModal(id) {
  const element = $(id);
  if (element) element.classList.add("hidden");
}

if ($("adminBtn")) {
  $("adminBtn").addEventListener("click", openAdmin);
}

document.querySelectorAll("[data-close]").forEach(button => {
  button.addEventListener("click", () => closeModal(button.dataset.close));
});

if ($("loginForm")) {
  $("loginForm").addEventListener("submit", async event => {
    event.preventDefault();

    if ($("password").value !== ADMIN_PASSWORD) {
      $("loginError").classList.remove("hidden");
      return;
    }

    if (!window.supabaseClient) {
      notify("A ligação ao Supabase não está disponível.");
      return;
    }

    const email = prompt("Email da conta de administrador do Supabase:");
    if (!email || !email.trim()) return;

    const supabasePassword = prompt("Senha da conta Supabase:");
    if (!supabasePassword) return;

    try {
      const { data, error } = await window.supabaseClient.auth
        .signInWithPassword({
          email: email.trim(),
          password: supabasePassword
        });

      if (error) {
        console.error("Erro de autenticação:", error);
        notify("Login falhou. Confirma o email e a senha.");
        return;
      }

      if (!data.session) {
        notify("Não foi possível iniciar a sessão.");
        return;
      }

      isAdmin = true;

      $("loginView").classList.add("hidden");
      $("dashboard").classList.remove("hidden");

      await carregarProdutosSupabase();
      await loadSettings();
      renderAdminProducts();
      renderSettings();
      switchTab("productsTab");
    } catch (error) {
      console.error("Erro de login:", error);
      notify("Ocorreu um erro ao entrar.");
    }
  });
}

/* ---------- ABAS DO PAINEL ---------- */

function switchTab(tabId) {
  document.querySelectorAll(".tab").forEach(button => {
    button.classList.toggle("active", button.dataset.tab === tabId);
  });

  ["productsTab", "settingsTab"].forEach(id => {
    const element = $(id);
    if (element) element.classList.toggle("hidden", id !== tabId);
  });
}

document.querySelectorAll("[data-tab]").forEach(button => {
  button.addEventListener("click", () => switchTab(button.dataset.tab));
});

/* ---------- FORMULÁRIO DE PRODUTOS ---------- */

function resetProductForm() {
  $("productForm").reset();
  $("productId").value = "";
  imageData = "";

  $("imagePreview").src = "";
  $("imagePreview").classList.add("hidden");
  $("cancelEdit").classList.add("hidden");
  $("formTitle").textContent = "Adicionar produto";
}

if ($("productImage")) {
  $("productImage").addEventListener("change", event => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      notify("Escolhe um ficheiro de imagem.");
      event.target.value = "";
      return;
    }

    if (file.size > 1024 * 1024) {
      notify("Escolhe uma imagem com menos de 1 MB.");
      event.target.value = "";
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      imageData = String(reader.result);
      $("imagePreview").src = imageData;
      $("imagePreview").classList.remove("hidden");
    };

    reader.onerror = () => notify("Não foi possível ler a imagem.");
    reader.readAsDataURL(file);
  });
}

if ($("productForm")) {
  $("productForm").addEventListener("submit", async event => {
    event.preventDefault();

    if (!isAdmin) {
      notify("Entra primeiro na conta de administrador.");
      return;
    }

    const name = $("productName").value.trim();
    const price = Number($("productPrice").value);
    const promoInput = $("productPromo").value.trim();
    const promo = promoInput === "" ? null : Number(promoInput);
    const id = $("productId").value;

    if (
      !name ||
      !Number.isFinite(price) ||
      price < 0 ||
      (promo !== null &&
        (!Number.isFinite(promo) || promo < 0 || promo >= price))
    ) {
      notify("Confirma o nome e os preços. A promoção deve ser inferior ao preço normal.");
      return;
    }

    const previous = products.find(item => String(item.id) === String(id));

    const product = {
      name,
      description: $("productDescription").value.trim(),
      price,
      promo_price: promo,
      category: $("productCategory").value.trim(),
      image_url: imageData || (previous ? previous.image : ""),
      active: true
    };

    const submitButton = $("productForm").querySelector('button[type="submit"]');
    if (submitButton) submitButton.disabled = true;

    try {
      let result;

      if (id && previous) {
        result = await window.supabaseClient
          .from("products")
          .update(product)
          .eq("id", Number(id))
          .select()
          .single();
      } else {
        result = await window.supabaseClient
          .from("products")
          .insert(product)
          .select()
          .single();
      }

      if (result.error) {
        console.error("Erro ao guardar produto:", result.error);
        notify("Falha ao guardar: " + result.error.message);
        return;
      }

      resetProductForm();
      await carregarProdutosSupabase();
      renderAdminProducts();
      notify(id ? "Produto atualizado!" : "Produto adicionado!");
    } catch (error) {
      console.error("Erro ao guardar produto:", error);
      notify("Ocorreu um erro ao guardar o produto.");
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });
}

if ($("cancelEdit")) {
  $("cancelEdit").addEventListener("click", resetProductForm);
}

/* ---------- EDITAR PRODUTO ---------- */

function editProduct(id) {
  if (!isAdmin) return;

  const product = products.find(item => String(item.id) === String(id));
  if (!product) return;

  $("productId").value = product.id;
  $("productName").value = product.name;
  $("productCategory").value = product.category || "";
  $("productPrice").value = product.price;
  $("productPromo").value = product.promo ?? "";
  $("productDescription").value = product.description || "";

  imageData = product.image || "";

  if (imageData) {
    $("imagePreview").src = imageData;
    $("imagePreview").classList.remove("hidden");
  } else {
    $("imagePreview").src = "";
    $("imagePreview").classList.add("hidden");
  }

  $("cancelEdit").classList.remove("hidden");
  $("formTitle").textContent = "Editar produto";
  $("productForm").scrollIntoView({ behavior: "smooth", block: "start" });
}

/* ---------- ELIMINAR PRODUTO ---------- */

async function deleteProduct(id) {
  if (!isAdmin) {
    notify("Entra primeiro na conta de administrador.");
    return;
  }

  const product = products.find(item => String(item.id) === String(id));
  if (!product) return;

  if (!confirm(`Queres eliminar "${product.name}"?`)) return;

  const { error } = await window.supabaseClient
    .from("products")
    .delete()
    .eq("id", Number(id));

  if (error) {
    console.error("Erro ao eliminar produto:", error);
    notify("Não foi possível eliminar: " + error.message);
    return;
  }

  await carregarProdutosSupabase();
  renderAdminProducts();
  notify("Produto eliminado!");
}

/* ---------- LISTA DE PRODUTOS NO PAINEL ---------- */

function renderAdminProducts() {
  const list = $("adminProductList");
  if (!list) return;

  if (products.length === 0) {
    list.innerHTML = '<p class="muted">Ainda não há produtos.</p>';
    return;
  }

  list.innerHTML = products.map(product => `
    <div class="admin-product">
      ${product.image
        ? `<img class="admin-thumb" src="${safeText(product.image)}" alt="">`
        : '<div class="admin-thumb product-placeholder">K</div>'}

      <div class="admin-product-main">
        <strong>${safeText(product.name)}</strong>
        <small>${money(finalPrice(product))}</small>
      </div>

      <div class="admin-actions">
        <button class="small-button" type="button"
          data-edit="${safeText(product.id)}">Editar</button>

        <button class="small-button delete" type="button"
          data-delete="${safeText(product.id)}">Eliminar</button>
      </div>
    </div>
  `).join("");

  list.querySelectorAll("[data-edit]").forEach(button => {
    button.addEventListener("click", () => editProduct(button.dataset.edit));
  });

  list.querySelectorAll("[data-delete]").forEach(button => {
    button.addEventListener("click", () => deleteProduct(button.dataset.delete));
  });
}

/* ---------- DEFINIÇÕES DE PAGAMENTO ---------- */

async function loadSettings() {
  if (!window.supabaseClient) return false;

  try {
    const { data, error } = await window.supabaseClient
      .from("store_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle();

    if (error) {
      console.error("Erro ao carregar definições:", error);
      return false;
    }

    if (data) {
      settings = {
        emola: data.emola_number || "",
        mpesa: data.mpesa_number || "",
        whatsapp: data.whatsapp_number || "",
        instructions: data.instructions ||
          "Paga por e-Mola ou M-Pesa e envia o comprovativo pelo WhatsApp."
      };
    }

    updatePaymentDetails();
    return true;
  } catch (error) {
    console.error("Erro ao carregar definições:", error);
    return false;
  }
}

function renderSettings() {
  if (!$("emola")) return;

  $("emola").value = settings.emola || "";
  $("mpesa").value = settings.mpesa || "";
  $("whatsapp").value = settings.whatsapp || "";
  $("instructions").value = settings.instructions || "";
}

async function saveSettings() {
  if (!window.supabaseClient) {
    notify("A ligação ao Supabase não está disponível.");
    return false;
  }

  const { error } = await window.supabaseClient
    .from("store_settings")
    .upsert({
      id: 1,
      emola_number: settings.emola,
      mpesa_number: settings.mpesa,
      whatsapp_number: settings.whatsapp,
      instructions: settings.instructions,
      updated_at: new Date().toISOString()
    }, { onConflict: "id" });

  if (error) {
    console.error("Erro ao guardar definições:", error);
    notify("Erro ao guardar: " + error.message);
    return false;
  }

  return true;
}

if ($("settingsForm")) {
  $("settingsForm").addEventListener("submit", async event => {
    event.preventDefault();

    if (!isAdmin) {
      notify("Entra primeiro no painel.");
      return;
    }

    const oldSettings = { ...settings };

    settings = {
      emola: $("emola").value.trim(),
      mpesa: $("mpesa").value.trim(),
      whatsapp: normalizeNumber($("whatsapp").value),
      instructions: $("instructions").value.trim()
    };

    const saved = await saveSettings();

    if (!saved) {
      settings = oldSettings;
      renderSettings();
      return;
    }

    updatePaymentDetails();
    notify("Definições guardadas para todos os clientes!");
  });
}

/* ---------- ENCOMENDAS ---------- */

function openOrder(id) {
  const product = products.find(item => String(item.id) === String(id));
  if (!product) return;

  selectedProductId = product.id;
  $("orderTitle").textContent = "Comprar " + product.name;

  $("orderSummary").innerHTML = `
    <strong>${safeText(product.name)}</strong><br>
    Valor a pagar: <strong>${money(finalPrice(product))}</strong>
  `;

  $("orderForm").reset();
  updatePaymentDetails();
  $("orderModal").classList.remove("hidden");
}

if ($("paymentMethod")) {
  $("paymentMethod").addEventListener("change", updatePaymentDetails);
}

function updatePaymentDetails() {
  if (!$("paymentMethod") || !$("paymentDetails")) return;

  const method = $("paymentMethod").value;
  const number = method === "e-Mola" ? settings.emola : settings.mpesa;

  $("paymentDetails").textContent =
    `${method}: ${number || "Número ainda não configurado."}\n` +
    `${settings.instructions || ""}`;
}

/* ---------- ENVIAR ENCOMENDA PARA WHATSAPP ---------- */

if ($("orderForm")) {
  $("orderForm").addEventListener("submit", event => {
    event.preventDefault();

    const product = products.find(item => String(item.id) === String(selectedProductId));

    if (!product) {
      notify("Este produto já não está disponível.");
      return;
    }

    const whatsapp = normalizeNumber(settings.whatsapp);

    if (!whatsapp) {
      notify("O administrador ainda não configurou o WhatsApp.");
      return;
    }

    const method = $("paymentMethod").value;
    const paymentNumber = method === "e-Mola" ? settings.emola : settings.mpesa;
    const receipt = $("receipt").files[0];

    const message = [
      "Olá, K STORE! Quero fazer esta encomenda.",
      `Produto: ${product.name}`,
      `Valor: ${money(finalPrice(product))}`,
      `Método de pagamento: ${method}`,
      `Número para pagamento: ${paymentNumber || "Não configurado"}`,
      `Nome: ${$("customerName").value.trim()}`,
      `Contacto: ${$("customerPhone").value.trim() || "Não indicado"}`,
      receipt
        ? `Vou anexar o comprovativo "${receipt.name}" nesta conversa.`
        : "Vou anexar o comprovativo de pagamento nesta conversa."
    ].join("\n");

    const url = "https://wa.me/" + whatsapp + "?text=" + encodeURIComponent(message);
    const whatsappWindow = window.open(url, "_blank");

    if (!whatsappWindow) window.location.href = url;

    $("orderModal").classList.add("hidden");
    notify("Anexa o comprovativo no WhatsApp antes de enviar.");
  });
}

/* ---------- INICIAR A LOJA ---------- */

if ($("year")) {
  $("year").textContent = new Date().getFullYear();
}

renderSettings();
renderProducts();
carregarProdutosSupabase();
loadSettings();
