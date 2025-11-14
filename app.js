import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://tsdrlbkrkjaxzpdxtmoa.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzZHJsYmtya2pheHpwZHh0bW9hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIxMjY0NjYsImV4cCI6MjA3NzcwMjQ2Nn0.Jx0ot29QIb2bi-wcTL6T69J6oBHoEFbR237Rtf3MO0g";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const catalogoGrid = document.getElementById("catalogo-grid");
const tabs = document.querySelectorAll(".catalog-tab");

const loginForm = document.getElementById("login-form");
const loginStatus = document.getElementById("login-status");

const loginSection = document.getElementById("login-section");
const adminSection = document.getElementById("admin-section");
const clientSection = document.getElementById("client-section");

const headerSessionText = document.getElementById("header-session-text");
const headerRole = document.getElementById("header-role");
const btnLogout = document.getElementById("btn-logout");

const formDecor = document.getElementById("form-decor");
const decorCategoria = document.getElementById("decor-categoria");
const decorTitulo = document.getElementById("decor-titulo");
const decorDescricao = document.getElementById("decor-descricao");
const decorStatus = document.getElementById("decor-status");

const formPlano = document.getElementById("form-plano");
const planoNome = document.getElementById("plano-nome");
const planoDescricao = document.getElementById("plano-descricao");
const planoValor = document.getElementById("plano-valor");
const planoStatus = document.getElementById("plano-status");

// UI helpers
function setLoggedOutUI() {
  loginSection.classList.remove("hidden");
  adminSection.classList.add("hidden");
  clientSection.classList.add("hidden");
  headerSessionText.textContent = "Visitante";
  headerRole.classList.add("hidden");
  btnLogout.classList.add("hidden");
}

function setAdminUI(name) {
  loginSection.classList.add("hidden");
  adminSection.classList.remove("hidden");
  clientSection.classList.add("hidden");
  headerSessionText.textContent = name || "Administrador";
  headerRole.textContent = "ADMIN";
  headerRole.classList.remove("hidden");
  btnLogout.classList.remove("hidden");
}

function setClientUI(name) {
  loginSection.classList.add("hidden");
  adminSection.classList.add("hidden");
  clientSection.classList.remove("hidden");
  headerSessionText.textContent = name || "Cliente";
  headerRole.textContent = "CLIENTE";
  headerRole.classList.remove("hidden");
  btnLogout.classList.remove("hidden");
}

// Carregar catálogo com filtro opcional de categoria
async function loadCatalog(categoria = "todos") {
  let query = supabase
    .from("decoracoes")
    .select("id, categoria, titulo, descricao, ativo")
    .eq("ativo", true);

  if (categoria && categoria !== "todos") {
    query = query.eq("categoria", categoria);
  }

  const { data, error } = await query.order("id", { ascending: false });

  catalogoGrid.innerHTML = "";

  if (error) {
    console.error("Erro catálogo:", error);
    const div = document.createElement("div");
    div.className = "decor-card";
    div.innerHTML =
      '<div class="decor-title">Erro ao carregar catálogo</div>' +
      '<div class="decor-desc">' +
      (error.message || "") +
      "</div>";
    catalogoGrid.appendChild(div);
    return;
  }

  if (!data || data.length === 0) {
    const div = document.createElement("div");
    div.className = "decor-card";
    div.innerHTML =
      '<div class="decor-title">Nenhuma decoração encontrada</div>' +
      '<div class="decor-desc">Altere a categoria ou crie novas produções pelo painel do administrador.</div>';
    catalogoGrid.appendChild(div);
    return;
  }

  for (const deco of data) {
    const card = document.createElement("article");
    card.className = "decor-card";
    card.innerHTML = `
      <div class="decor-tag">${deco.categoria || "Evento"}</div>
      <div class="decor-title">${deco.titulo}</div>
      <div class="decor-desc">${deco.descricao || ""}</div>
    `;
    catalogoGrid.appendChild(card);
  }
}

async function handleSession(user) {
  if (!user) {
    setLoggedOutUI();
    return;
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("name, role")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    console.error("Erro ao carregar profile:", error);
    setLoggedOutUI();
    return;
  }

  const name = profile?.name || user.email;

  if (profile?.role === "admin") {
    setAdminUI(name);
  } else {
    setClientUI(name);
  }
}

// Login
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginStatus.textContent = "";
  loginStatus.className = "status";

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  if (!email || !password) {
    loginStatus.textContent = "Preencha e-mail e senha.";
    loginStatus.className = "status error";
    return;
  }

  loginStatus.textContent = "Autenticando...";

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    console.error("Erro login:", error);
    loginStatus.textContent = "Erro ao entrar: " + error.message;
    loginStatus.className = "status error";
    return;
  }

  const user = data.user;
  if (!user) {
    loginStatus.textContent = "Não foi possível recuperar o usuário.";
    loginStatus.className = "status error";
    return;
  }

  loginStatus.textContent = "Login realizado com sucesso!";
  loginStatus.className = "status ok";
  await handleSession(user);
});

// Logout
btnLogout.addEventListener("click", async () => {
  await supabase.auth.signOut();
  setLoggedOutUI();
});

// Admin: cadastrar decoração
formDecor.addEventListener("submit", async (e) => {
  e.preventDefault();
  decorStatus.textContent = "";
  decorStatus.className = "status";

  if (!decorTitulo.value.trim()) {
    decorStatus.textContent = "Informe pelo menos o título.";
    decorStatus.className = "status error";
    return;
  }

  decorStatus.textContent = "Salvando...";
  const { error } = await supabase.from("decoracoes").insert({
    categoria: decorCategoria.value.trim() || null,
    titulo: decorTitulo.value.trim(),
    descricao: decorDescricao.value.trim() || null,
    ativo: true,
  });

  if (error) {
    console.error("Erro salvar decoração:", error);
    decorStatus.textContent = "Erro ao salvar: " + error.message;
    decorStatus.className = "status error";
    return;
  }

  decorStatus.textContent = "Decoração cadastrada com sucesso!";
  decorStatus.className = "status ok";
  decorCategoria.value = "";
  decorTitulo.value = "";
  decorDescricao.value = "";
  await loadCatalog(getCategoriaAtiva());
});

// Admin: cadastrar plano
formPlano.addEventListener("submit", async (e) => {
  e.preventDefault();
  planoStatus.textContent = "";
  planoStatus.className = "status";

  if (!planoNome.value.trim()) {
    planoStatus.textContent = "Informe o nome do plano.";
    planoStatus.className = "status error";
    return;
  }

  planoStatus.textContent = "Salvando...";
  const valorNum = planoValor.value ? Number(planoValor.value) : null;

  const { error } = await supabase.from("planos").insert({
    nome: planoNome.value.trim(),
    descricao: planoDescricao.value.trim() || null,
    valor_mensal: valorNum,
  });

  if (error) {
    console.error("Erro salvar plano:", error);
    planoStatus.textContent = "Erro ao salvar: " + error.message;
    planoStatus.className = "status error";
    return;
  }

  planoStatus.textContent = "Plano cadastrado com sucesso!";
  planoStatus.className = "status ok";
  planoNome.value = "";
  planoDescricao.value = "";
  planoValor.value = "";
});

function getCategoriaAtiva() {
  const ativa = document.querySelector(".catalog-tab.active");
  return ativa ? ativa.dataset.categoria : "todos";
}

// Eventos das abas de categoria (funcionam para visitante também)
tabs.forEach((tab) => {
  tab.addEventListener("click", async () => {
    tabs.forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    const categoria = tab.dataset.categoria;
    await loadCatalog(categoria);
  });
});

(async () => {
  await loadCatalog("todos");

  const { data } = await supabase.auth.getSession();
  const session = data?.session;
  await handleSession(session?.user ?? null);

  supabase.auth.onAuthStateChange((_event, session) => {
    handleSession(session?.user ?? null);
  });
})();