const state = {
  gateway: localStorage.getItem("yo.gateway") || "http://localhost:8080",
  adminToken: localStorage.getItem("yo.adminToken") || "",
  adminRefresh: localStorage.getItem("yo.adminRefresh") || "",
  supplierToken: localStorage.getItem("yo.supplierToken") || "",
  supplierRefresh: localStorage.getItem("yo.supplierRefresh") || "",
  buyerToken: localStorage.getItem("yo.buyerToken") || "",
  buyerRefresh: localStorage.getItem("yo.buyerRefresh") || "",
  companyId: localStorage.getItem("yo.companyId") || "",
  productId: localStorage.getItem("yo.productId") || "",
  orderId: localStorage.getItem("yo.orderId") || "",
  userId: localStorage.getItem("yo.userId") || "",
  page: localStorage.getItem("yo.page") || "0",
  size: localStorage.getItem("yo.size") || "20"
};

const refs = {
  gatewayUrl: document.querySelector("#gatewayUrl"),
  adminBadge: document.querySelector("#adminBadge"),
  supplierBadge: document.querySelector("#supplierBadge"),
  buyerBadge: document.querySelector("#buyerBadge"),
  tokenKind: document.querySelector("#tokenKind"),
  companyId: document.querySelector("#ctxCompanyId"),
  productId: document.querySelector("#ctxProductId"),
  orderId: document.querySelector("#ctxOrderId"),
  userId: document.querySelector("#ctxUserId"),
  page: document.querySelector("#ctxPage"),
  size: document.querySelector("#ctxSize"),
  catalog: document.querySelector("#catalog"),
  log: document.querySelector("#logOutput")
};

const actions = {
  debugUsers: () => request(`/debug/users${pageQuery()}`, { tokenKind: "admin" }),
  debugMe: () => request("/debug/users/me", { tokenKind: refs.tokenKind.value || "admin" }),
  refreshAdmin: () => refresh("admin"),
  refreshSupplier: () => refresh("supplier"),
  refreshBuyer: () => refresh("buyer"),
  logoutAdmin: () => logout("admin"),
  logoutSupplier: () => logout("supplier"),
  logoutBuyer: () => logout("buyer"),
  allCompanies: () => request(`/api/seller/companies${pageQuery()}`, { tokenKind: "admin" }),
  myCompanies: () => request(`/api/seller/companies/my${pageQuery()}`, { tokenKind: "supplier" }),
  companyById: () => request(`/api/seller/companies/${ctx("companyId")}`, { tokenKind: refs.tokenKind.value || "admin" }),
  companySellers: () => request(`/api/seller/companies/${ctx("companyId")}/sellers${pageQuery()}`, { tokenKind: refs.tokenKind.value || "admin" }),
  sellerProducts: () => request(`/api/seller/products${pageQuery()}`, { tokenKind: refs.tokenKind.value || "admin" }),
  sellerProductsByCompany: () => request(`/api/seller/products${pageQuery({ companyId: ctx("companyId") })}`, { tokenKind: refs.tokenKind.value || "admin" }),
  sellerProductById: () => request(`/api/seller/products/${ctx("productId")}`, { tokenKind: refs.tokenKind.value || "admin" }),
  deleteProduct: () => request(`/api/seller/products/${ctx("productId")}`, { method: "DELETE", tokenKind: refs.tokenKind.value || "admin" }),
  customerProducts: async () => renderCatalogFromResult(await request(`/customer/products${pageQuery()}`, { tokenKind: "buyer" })),
  customerProductsByCompany: async () => renderCatalogFromResult(await request(`/customer/products${pageQuery({ companyId: ctx("companyId") })}`, { tokenKind: "buyer" })),
  customerProductById: async () => renderCatalogFromResult(await request(`/customer/products/${ctx("productId")}`, { tokenKind: "buyer" })),
  customerOrders: () => request(`/customer/orders${pageQuery()}`, { tokenKind: refs.tokenKind.value || "buyer" }),
  customerOrderById: () => request(`/customer/orders/${ctx("orderId")}`, { tokenKind: refs.tokenKind.value || "buyer" }),
  cancelOrder: () => request(`/customer/orders/${ctx("orderId")}/cancel`, { method: "PATCH", tokenKind: "buyer" }),
  customerCheck: () => request("/customer/orders/check", { tokenKind: "buyer" })
};

init();

function init() {
  refs.gatewayUrl.value = state.gateway;
  refs.companyId.value = state.companyId;
  refs.productId.value = state.productId;
  refs.orderId.value = state.orderId;
  refs.userId.value = state.userId;
  refs.page.value = state.page;
  refs.size.value = state.size;
  syncLinkedInputs();
  updateBadges();
  bind();
}

function bind() {
  document.querySelector("#saveGatewayBtn").addEventListener("click", saveGateway);
  document.querySelector("#healthBtn").addEventListener("click", () => request("/actuator/health", { tokenKind: "" }));
  document.querySelector("#clearSessionsBtn").addEventListener("click", clearSessions);
  document.querySelector("#clearLogBtn").addEventListener("click", () => refs.log.textContent = "Готово.");

  for (const key of ["companyId", "productId", "orderId", "userId", "page", "size"]) {
    refs[key].addEventListener("input", () => saveCtx(key, refs[key].value.trim()));
  }

  bindAuth("admin", document.querySelector("#adminAuthForm"), "ADMIN");
  bindAuth("supplier", document.querySelector("#supplierAuthForm"), "SUPPLIER");
  bindAuth("buyer", document.querySelector("#buyerAuthForm"), "RETAILER");

  document.querySelector("#companyCreateForm").addEventListener("submit", createCompany);
  document.querySelector("#sellerAddForm").addEventListener("submit", addSeller);
  document.querySelector("#sellerRemoveForm").addEventListener("submit", removeSeller);
  document.querySelector("#productCreateForm").addEventListener("submit", createProduct);
  document.querySelector("#productUpdateForm").addEventListener("submit", updateProduct);
  document.querySelector("#orderCreateForm").addEventListener("submit", createOrder);
  document.querySelector("#rawForm").addEventListener("submit", rawRequest);

  document.querySelectorAll("[data-action]").forEach(button => {
    button.addEventListener("click", async () => {
      try {
        await actions[button.dataset.action]();
      } catch (error) {
        log("UI error", error.message);
      }
    });
  });
}

function bindAuth(kind, form, role) {
  form.querySelectorAll("[data-auth]").forEach(button => {
    button.addEventListener("click", async event => {
      event.preventDefault();
      const data = formValues(form);
      const action = button.dataset.auth;

      const result = action === "register"
        ? await request("/auth/register", {
            method: "POST",
            tokenKind: "",
            body: {
              username: data.username,
              email: data.email,
              password: data.password,
              role
            }
          })
        : await request("/auth/login", {
            method: "POST",
            tokenKind: "",
            body: {
              login: data.username,
              password: data.password
            }
          });

      saveTokens(kind, result.data);
    });
  });
}

async function refresh(kind) {
  const refreshToken = refreshTokenFor(kind);
  const result = await request("/auth/refresh", {
    method: "POST",
    tokenKind: "",
    body: { refreshToken }
  });
  saveTokens(kind, result.data);
}

async function logout(kind) {
  const refreshToken = refreshTokenFor(kind);
  const result = await request("/auth/logout", {
    method: "POST",
    tokenKind: "",
    body: { refreshToken }
  });
  if (result.ok) clearToken(kind);
}

async function createCompany(event) {
  event.preventDefault();
  const data = formValues(event.currentTarget);
  const result = await request("/api/seller/companies", {
    method: "POST",
    tokenKind: refs.tokenKind.value || "supplier",
    body: { name: data.name, ownerId: data.ownerId || null }
  });
  captureIds(result.data);
}

async function addSeller(event) {
  event.preventDefault();
  const data = formValues(event.currentTarget);
  await request(`/api/seller/companies/${ctx("companyId")}/sellers`, {
    method: "POST",
    tokenKind: refs.tokenKind.value || "admin",
    body: { userId: data.userId || ctx("userId") }
  });
}

async function removeSeller(event) {
  event.preventDefault();
  const data = formValues(event.currentTarget);
  await request(`/api/seller/companies/${ctx("companyId")}/sellers/${data.userId || ctx("userId")}`, {
    method: "DELETE",
    tokenKind: refs.tokenKind.value || "admin"
  });
}

async function createProduct(event) {
  event.preventDefault();
  const data = formValues(event.currentTarget);
  const result = await request("/api/seller/products", {
    method: "POST",
    tokenKind: refs.tokenKind.value || "supplier",
    body: {
      companyId: data.companyId || ctx("companyId"),
      name: data.name,
      price: data.price,
      quantity: Number(data.quantity)
    }
  });
  captureIds(result.data);
}

async function updateProduct(event) {
  event.preventDefault();
  const data = formValues(event.currentTarget);
  const result = await request(`/api/seller/products/${ctx("productId")}`, {
    method: "PUT",
    tokenKind: refs.tokenKind.value || "admin",
    body: {
      name: data.name,
      price: data.price
    }
  });
  captureIds(result.data);
}

async function createOrder(event) {
  event.preventDefault();
  const data = formValues(event.currentTarget);
  const result = await request("/customer/orders", {
    method: "POST",
    tokenKind: "buyer",
    body: {
      items: [
        {
          productId: data.productId || ctx("productId"),
          quantity: Number(data.quantity)
        }
      ]
    }
  });
  captureIds(result.data);
}

async function rawRequest(event) {
  event.preventDefault();
  const data = formValues(event.currentTarget);
  let body;

  if (data.body.trim()) {
    try {
      body = JSON.parse(data.body);
    } catch (error) {
      log("Invalid JSON", error.message);
      return;
    }
  }

  const result = await request(data.path || "/", {
    method: data.method,
    tokenKind: refs.tokenKind.value,
    body
  });
  captureIds(result.data);
}

async function request(path, options = {}) {
  const headers = { Accept: "application/json" };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";

  const token = tokenFor(options.tokenKind ?? refs.tokenKind.value);
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`/proxy?service=gateway&base=${encodeURIComponent(state.gateway)}&path=${encodeURIComponent(path)}`, {
    method: options.method || "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });

  const text = await response.text();
  const data = parse(text);
  const result = {
    ok: response.ok,
    status: response.status,
    method: options.method || "GET",
    path,
    data
  };

  log(response.ok ? "OK" : "ERROR", result);
  if (response.ok) captureIds(data);
  return result;
}

function tokenFor(kind) {
  if (kind === "admin") return state.adminToken;
  if (kind === "supplier") return state.supplierToken;
  if (kind === "buyer") return state.buyerToken;
  return "";
}

function refreshTokenFor(kind) {
  if (kind === "admin") return state.adminRefresh;
  if (kind === "supplier") return state.supplierRefresh;
  if (kind === "buyer") return state.buyerRefresh;
  return "";
}

function saveTokens(kind, data) {
  const box = data?.tokenResponseDTO || data?.tokens || data?.tokenResponse || data;
  if (!box?.accessToken) return;

  if (kind === "admin") {
    state.adminToken = box.accessToken;
    state.adminRefresh = box.refreshToken || state.adminRefresh;
    localStorage.setItem("yo.adminToken", state.adminToken);
    localStorage.setItem("yo.adminRefresh", state.adminRefresh);
  } else if (kind === "supplier") {
    state.supplierToken = box.accessToken;
    state.supplierRefresh = box.refreshToken || state.supplierRefresh;
    localStorage.setItem("yo.supplierToken", state.supplierToken);
    localStorage.setItem("yo.supplierRefresh", state.supplierRefresh);
  } else {
    state.buyerToken = box.accessToken;
    state.buyerRefresh = box.refreshToken || state.buyerRefresh;
    localStorage.setItem("yo.buyerToken", state.buyerToken);
    localStorage.setItem("yo.buyerRefresh", state.buyerRefresh);
  }

  updateBadges();
}

function clearToken(kind) {
  if (kind === "admin") {
    state.adminToken = "";
    state.adminRefresh = "";
    localStorage.removeItem("yo.adminToken");
    localStorage.removeItem("yo.adminRefresh");
  } else if (kind === "supplier") {
    state.supplierToken = "";
    state.supplierRefresh = "";
    localStorage.removeItem("yo.supplierToken");
    localStorage.removeItem("yo.supplierRefresh");
  } else {
    state.buyerToken = "";
    state.buyerRefresh = "";
    localStorage.removeItem("yo.buyerToken");
    localStorage.removeItem("yo.buyerRefresh");
  }
  updateBadges();
}

function captureIds(data) {
  const item = Array.isArray(data?.content) ? data.content[0] : Array.isArray(data) ? data[0] : data;
  if (!item || typeof item !== "object") return;

  if (item.ownerId && item.id) saveCtx("companyId", item.id);
  if (item.companyId && item.id && item.price !== undefined) saveCtx("productId", item.id);
  if (item.status && item.id) saveCtx("orderId", item.id);
  if (item.userId) saveCtx("userId", item.userId);
  syncLinkedInputs();
}

function saveCtx(key, value) {
  state[key] = value;
  localStorage.setItem(`yo.${key}`, value);
  refs[key].value = value;
}

function pageQuery(extra = {}) {
  const params = new URLSearchParams({
    page: ctx("page") || "0",
    size: ctx("size") || "20"
  });

  for (const [key, value] of Object.entries(extra)) {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, value);
    }
  }

  return `?${params.toString()}`;
}

function ctx(key) {
  return refs[key].value.trim() || state[key];
}

function syncLinkedInputs() {
  document.querySelectorAll('input[name="companyId"]').forEach(input => input.value ||= state.companyId);
  document.querySelectorAll('input[name="productId"]').forEach(input => input.value ||= state.productId);
  document.querySelectorAll('input[name="userId"]').forEach(input => input.value ||= state.userId);
}

function renderCatalogFromResult(result) {
  if (!result.ok) return;
  const products = Array.isArray(result.data?.content)
    ? result.data.content
    : Array.isArray(result.data)
      ? result.data
      : result.data
        ? [result.data]
        : [];

  if (!products.length) {
    refs.catalog.className = "catalog empty";
    refs.catalog.textContent = "Пусто.";
    return;
  }

  refs.catalog.className = "catalog";
  refs.catalog.innerHTML = products.map(product => `
    <article class="product-card">
      <h3>${escapeHtml(product.name || "-")}</h3>
      <p class="muted">id: ${escapeHtml(product.id || "-")}</p>
      <p class="muted">company: ${escapeHtml(product.companyId || "-")}</p>
      <div class="product-meta">
        <span>updated: ${escapeHtml(product.updatedAt || "-")}</span>
        <span class="price">${escapeHtml(product.price ?? 0)} ₽</span>
      </div>
    </article>
  `).join("");
}

function saveGateway() {
  state.gateway = refs.gatewayUrl.value.trim() || "http://localhost:8080";
  localStorage.setItem("yo.gateway", state.gateway);
  log("Gateway saved", { gateway: state.gateway });
}

function clearSessions() {
  for (const key of ["adminToken", "adminRefresh", "supplierToken", "supplierRefresh", "buyerToken", "buyerRefresh", "companyId", "productId", "orderId", "userId"]) {
    state[key] = "";
    localStorage.removeItem(`yo.${key}`);
  }
  refs.companyId.value = "";
  refs.productId.value = "";
  refs.orderId.value = "";
  refs.userId.value = "";
  updateBadges();
  log("Sessions cleared");
}

function updateBadges() {
  setBadge(refs.adminBadge, state.adminToken, "токен есть");
  setBadge(refs.supplierBadge, state.supplierToken, "токен есть");
  setBadge(refs.buyerBadge, state.buyerToken, "токен есть");
}

function setBadge(node, token, text) {
  node.classList.toggle("ok", Boolean(token));
  node.classList.toggle("bad", !token);
  node.textContent = token ? text : "нет токена";
}

function formValues(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function parse(text) {
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return text;
  }
}

function log(title, payload = "") {
  const body = typeof payload === "string" ? payload : JSON.stringify(payload, null, 2);
  refs.log.textContent = `[${new Date().toLocaleTimeString()}] ${title}\n${body}\n\n${refs.log.textContent}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
