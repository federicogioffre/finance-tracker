// ── API helper ──────────────────────────────────────────────────────────────

const BASE = "";

async function api(method, path, body = null) {
  const token = localStorage.getItem("token");
  const res = await fetch(BASE + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : null,
  });
  if (res.status === 204) return null;
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Errore sconosciuto");
  return data;
}

const get = (p) => api("GET", p);
const post = (p, b) => api("POST", p, b);

// ── Auth ─────────────────────────────────────────────────────────────────────

function isLoggedIn() {
  return !!localStorage.getItem("token");
}

function logout() {
  localStorage.removeItem("token");
  show("auth-screen");
  hide("app-screen");
}

async function login(email, password) {
  const form = new URLSearchParams({ username: email, password });
  const res = await fetch("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Credenziali errate");
  localStorage.setItem("token", data.access_token);
}

// ── DOM helpers ───────────────────────────────────────────────────────────────

const $ = (sel) => document.querySelector(sel);
const show = (id) => document.getElementById(id).classList.remove("hidden");
const hide = (id) => document.getElementById(id).classList.add("hidden");

function fmt(amount) {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(amount);
}

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString("it-IT");
}

// ── Navigation ────────────────────────────────────────────────────────────────

let currentPage = "dashboard";

function showPage(name) {
  ["dashboard", "transactions", "budgets"].forEach((p) => {
    document.getElementById(`page-${p}`).classList.toggle("hidden", p !== name);
  });
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.page === name);
  });
  currentPage = name;
  loadPage(name);
}

async function loadPage(name) {
  if (name === "dashboard") await loadDashboard();
  if (name === "transactions") await loadTransactions();
  if (name === "budgets") await loadBudgets();
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

async function loadDashboard() {
  const [accounts, summary, recent] = await Promise.all([
    get("/accounts/"),
    get("/transactions/summary"),
    get("/transactions?limit=5"),
  ]);

  const grid = $("#accounts-grid");
  grid.innerHTML = accounts.length
    ? accounts.map((a) => {
        const bal = parseFloat(a.balance);
        return `<div class="account-card">
          <div class="name">${a.name}</div>
          <div class="type">${a.account_type}</div>
          <div class="balance ${bal >= 0 ? "positive" : "negative"}">${fmt(bal)}</div>
        </div>`;
      }).join("")
    : '<p style="color:var(--muted)">Nessun conto. Clicca &ldquo;+ Nuovo conto&rdquo; per iniziare.</p>';

  $("#sum-income").textContent = fmt(summary.total_income);
  $("#sum-expenses").textContent = fmt(summary.total_expenses);
  const net = parseFloat(summary.net);
  const netEl = $("#sum-net");
  netEl.textContent = fmt(net);
  netEl.style.color = net >= 0 ? "var(--income)" : "var(--expense)";

  const tbody = $("#recent-body");
  tbody.innerHTML = recent.length
    ? recent.map((tx) => {
        const amt = parseFloat(tx.amount);
        return `<tr>
          <td>${fmtDate(tx.date)}</td>
          <td>${tx.description || "—"}</td>
          <td class="${amt >= 0 ? "amount-income" : "amount-expense"}">${fmt(Math.abs(amt))}</td>
        </tr>`;
      }).join("")
    : '<tr><td colspan="3" style="color:var(--muted);text-align:center">Nessuna transazione</td></tr>';
}

// ── Transactions ──────────────────────────────────────────────────────────────

let allAccounts = [];
let allCategories = [];

async function loadTransactions() {
  [allAccounts, allCategories] = await Promise.all([
    get("/accounts/"),
    get("/categories"),
  ]);

  $("#filter-account").innerHTML =
    '<option value="">Tutti i conti</option>' +
    allAccounts.map((a) => `<option value="${a.id}">${a.name}</option>`).join("");

  await renderTransactions();
}

async function renderTransactions() {
  const accountId = $("#filter-account").value;
  const type = $("#filter-type").value;
  let url = "/transactions?limit=100";
  if (accountId) url += `&account_id=${accountId}`;
  if (type) url += `&transaction_type=${type}`;

  const txs = await get(url);
  const accountMap = Object.fromEntries(allAccounts.map((a) => [a.id, a.name]));
  const catMap = Object.fromEntries(allCategories.map((c) => [c.id, c.name]));

  const tbody = $("#tx-body");
  tbody.innerHTML = txs.length
    ? txs.map((tx) => {
        const amt = parseFloat(tx.amount);
        return `<tr>
          <td>${fmtDate(tx.date)}</td>
          <td>${tx.description || "—"}</td>
          <td>${tx.category_id ? catMap[tx.category_id] || "—" : "—"}</td>
          <td>${accountMap[tx.account_id] || "—"}</td>
          <td class="${amt >= 0 ? "amount-income" : "amount-expense"}">${fmt(Math.abs(amt))}</td>
        </tr>`;
      }).join("")
    : '<tr><td colspan="5" style="color:var(--muted);text-align:center">Nessuna transazione</td></tr>';
}

// ── Budgets ───────────────────────────────────────────────────────────────────

async function loadBudgets() {
  const now = new Date();
  const status = await get(
    `/budgets/status?year=${now.getFullYear()}&month=${now.getMonth() + 1}`
  );

  const list = $("#budget-list");
  if (!status.length) {
    list.innerHTML = '<p style="color:var(--muted)">Nessun budget impostato per questo mese.</p>';
    return;
  }

  list.innerHTML = status.map((b) => {
    const pct = Math.min(b.percent_used, 100);
    const cls = b.over_budget ? "over" : b.percent_used >= 80 ? "warning" : "";
    return `<div class="budget-item">
      <div class="budget-header">
        <span class="budget-name">${b.category_name}</span>
        <span class="budget-amounts">${fmt(b.spent)} / ${fmt(b.budget)}</span>
      </div>
      <div class="progress-bar">
        <div class="progress-fill ${cls}" style="width:${pct}%"></div>
      </div>
      ${b.over_budget ? `<div class="budget-alert">Budget superato di ${fmt(Math.abs(b.remaining))}</div>` : ""}
      ${!b.over_budget && b.percent_used >= 80 ? `<div class="budget-alert" style="color:var(--warning)">Attenzione: ${b.percent_used}% utilizzato</div>` : ""}
    </div>`;
  }).join("");
}

// ── Modal: Add Account ────────────────────────────────────────────────────────

function openAccountModal() {
  $("#account-form").reset();
  $("#account-error").textContent = "";
  show("account-modal");
}

async function submitAccount(e) {
  e.preventDefault();
  $("#account-error").textContent = "";
  try {
    await post("/accounts/", {
      name: $("#account-name").value,
      account_type: $("#account-type").value,
      balance: parseFloat($("#account-balance").value),
    });
    hide("account-modal");
    await loadDashboard();
  } catch (err) {
    $("#account-error").textContent = err.message;
  }
}

// ── Modal: Add Category ───────────────────────────────────────────────────────

function openCategoryModal() {
  $("#category-form").reset();
  $("#category-error").textContent = "";
  show("category-modal");
}

async function submitCategory(e) {
  e.preventDefault();
  $("#category-error").textContent = "";
  try {
    await post("/categories", {
      name: $("#category-name").value,
      category_type: $("#category-type").value,
    });
    hide("category-modal");
    // Refresh the cached lists so the new category appears immediately in the tx modal
    [allAccounts, allCategories] = await Promise.all([
      get("/accounts/"),
      get("/categories"),
    ]);
  } catch (err) {
    $("#category-error").textContent = err.message;
  }
}

// ── Modal: Add Transaction ────────────────────────────────────────────────────

async function openTxModal() {
  // Always fetch fresh data so newly created accounts/categories appear
  [allAccounts, allCategories] = await Promise.all([
    get("/accounts/"),
    get("/categories"),
  ]);

  if (!allAccounts.length) {
    alert("Devi prima creare almeno un conto dalla Dashboard.");
    return;
  }

  $("#tx-account").innerHTML = allAccounts
    .map((a) => `<option value="${a.id}">${a.name}</option>`)
    .join("");
  $("#tx-category").innerHTML =
    '<option value="">Nessuna categoria</option>' +
    allCategories.map((c) => `<option value="${c.id}">${c.name}</option>`).join("");
  $("#tx-error").textContent = "";
  $("#tx-form").reset();
  // Re-populate after reset clears the selects
  $("#tx-account").innerHTML = allAccounts
    .map((a) => `<option value="${a.id}">${a.name}</option>`)
    .join("");
  $("#tx-category").innerHTML =
    '<option value="">Nessuna categoria</option>' +
    allCategories.map((c) => `<option value="${c.id}">${c.name}</option>`).join("");
  show("tx-modal");
}

async function submitTransaction(e) {
  e.preventDefault();
  $("#tx-error").textContent = "";
  const body = {
    account_id: parseInt($("#tx-account").value),
    transaction_type: $("#tx-type").value,
    amount: parseFloat($("#tx-amount").value),
    description: $("#tx-description").value || null,
  };
  const catVal = $("#tx-category").value;
  if (catVal) body.category_id = parseInt(catVal);

  try {
    await post("/transactions", body);
    hide("tx-modal");
    if (currentPage === "transactions") await loadTransactions();
    else await loadDashboard();
  } catch (err) {
    $("#tx-error").textContent = err.message;
  }
}

// ── Modal: Add Budget ─────────────────────────────────────────────────────────

async function openBudgetModal() {
  const cats = await get("/categories");
  if (!cats.length) {
    alert("Devi prima creare almeno una categoria dalla pagina Transazioni.");
    return;
  }
  const now = new Date();
  $("#budget-category").innerHTML = cats
    .map((c) => `<option value="${c.id}">${c.name}</option>`)
    .join("");
  $("#budget-error").textContent = "";
  $("#budget-form").reset();
  $("#budget-year").value = now.getFullYear();
  $("#budget-month").value = now.getMonth() + 1;
  show("budget-modal");
}

async function submitBudget(e) {
  e.preventDefault();
  $("#budget-error").textContent = "";
  try {
    await post("/budgets/", {
      category_id: parseInt($("#budget-category").value),
      amount: parseFloat($("#budget-amount").value),
      year: parseInt($("#budget-year").value),
      month: parseInt($("#budget-month").value),
    });
    hide("budget-modal");
    await loadBudgets();
  } catch (err) {
    $("#budget-error").textContent = err.message;
  }
}

// ── Boot ──────────────────────────────────────────────────────────────────────

function init() {
  // Auth tabs
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      hide("login-form");
      hide("register-form");
      show(`${tab.dataset.tab}-form`);
    });
  });

  // Login
  $("#login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    $("#login-error").textContent = "";
    try {
      await login($("#login-email").value, $("#login-password").value);
      hide("auth-screen");
      show("app-screen");
      showPage("dashboard");
    } catch (err) {
      $("#login-error").textContent = err.message;
    }
  });

  // Register
  $("#register-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    $("#reg-error").textContent = "";
    try {
      await post("/auth/register", {
        full_name: $("#reg-name").value,
        email: $("#reg-email").value,
        password: $("#reg-password").value,
      });
      await login($("#reg-email").value, $("#reg-password").value);
      hide("auth-screen");
      show("app-screen");
      showPage("dashboard");
    } catch (err) {
      $("#reg-error").textContent = err.message;
    }
  });

  // Nav
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => showPage(btn.dataset.page));
  });

  // Logout
  $("#logout-btn").addEventListener("click", logout);

  // Account modal
  $("#open-account-modal").addEventListener("click", openAccountModal);
  $("#close-account-modal").addEventListener("click", () => hide("account-modal"));
  $("#account-form").addEventListener("submit", submitAccount);
  $("#account-modal").addEventListener("click", (e) => {
    if (e.target === $("#account-modal")) hide("account-modal");
  });

  // Category modal
  $("#open-category-modal").addEventListener("click", openCategoryModal);
  $("#close-category-modal").addEventListener("click", () => hide("category-modal"));
  $("#category-form").addEventListener("submit", submitCategory);
  $("#category-modal").addEventListener("click", (e) => {
    if (e.target === $("#category-modal")) hide("category-modal");
  });

  // Transaction modal
  $("#open-tx-modal").addEventListener("click", openTxModal);
  $("#close-tx-modal").addEventListener("click", () => hide("tx-modal"));
  $("#tx-form").addEventListener("submit", submitTransaction);
  $("#tx-modal").addEventListener("click", (e) => {
    if (e.target === $("#tx-modal")) hide("tx-modal");
  });

  // Budget modal
  $("#open-budget-modal").addEventListener("click", openBudgetModal);
  $("#close-budget-modal").addEventListener("click", () => hide("budget-modal"));
  $("#budget-form").addEventListener("submit", submitBudget);
  $("#budget-modal").addEventListener("click", (e) => {
    if (e.target === $("#budget-modal")) hide("budget-modal");
  });

  // Transaction filters
  $("#filter-account").addEventListener("change", renderTransactions);
  $("#filter-type").addEventListener("change", renderTransactions);

  // Auto-login if token exists
  if (isLoggedIn()) {
    hide("auth-screen");
    show("app-screen");
    showPage("dashboard");
  }
}

document.addEventListener("DOMContentLoaded", init);
