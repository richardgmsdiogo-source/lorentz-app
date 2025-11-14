// app.js
import { supabase } from "./config.js";

// =======================
// Elements básicos
// =======================
const heroSection = document.getElementById("hero");
const catalogSection = document.getElementById("catalogo-card");
const authSection = document.getElementById("auth-card");

const navLinks = document.querySelectorAll(".main-nav a");
const heroNavButtons = document.querySelectorAll(".js-nav-view");

const catalogoGrid = document.getElementById("catalogo-grid");
const catalogTabs = document.querySelectorAll(".catalog-tab");

const loginForm = document.getElementById("login-form");
const loginStatus = document.getElementById("login-status");

const loginSection = document.getElementById("login-section");
const adminSection = document.getElementById("admin-section");
const clientSection = document.getElementById("client-section");

const headerSessionText = document.getElementById("header-session-text");
const headerRole = document.getElementById("header-role");
const btnLogout = document.getElementById("btn-logout");

// Admin - cadastrar decoração
const formDecor = document.getElementById("form-decor");
const decorCategoria = document.getElementById("decor-categoria");
const decorTitulo = document.getElementById("decor-titulo");
const decorDescricao = document.getElementById("decor-descricao");
const decorImagem = document.getElementById("decor-imagem");
const decorStatus = document.getElementById("decor-status");

// Modal / carrossel
const decorModal = document.getElementById("decor-modal");
const decorModalClose = document.getElementById("decor-modal-close");
const decorModalContent = document.getElementById("decor-modal-content");

// =======================
// Controle de "views" do site
// =======================
function showView(view) {
  // Reset tudo
  heroSection.classList.add("hidden");
  catalogSection.classList.add("hidden");
  authSection.classList.add("hidden");

  // home: hero + catálogo + área do cliente (como hoje)
  if (view === "home") {
    heroSection.classList.remove("hidden");
    catalogSection.classList.remove("hidden");
    authSection.classList.remove("hidden");
  }

  // catálogo: hero + catálogo apenas
  if (view === "catalogo") {
    heroSection.classList.remove("hidden");
    catalogSection.classList.remove("hidden");
  }

  // cliente: hero + área do cliente apenas
  if (view === "cliente") {
    heroSection.classList.remove("hidden");
    authSection.classList.remove("hidden");
  }

  // estado visual do menu
  navLinks.forEach((link) => {
    link.classList.toggle("nav-active", link.dataset.view === view);
  });
}

navLinks.forEach((link) => {
  link.addEventListener("click", (e) => {
    e.preventDefault();
    showView(link.dataset.view || "home");
  });
});

heroNavButtons.forEach((btn) => {
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    showView(btn.dataset.view || "home");
  });
});

// =======================
// UI de sessão
// =======================
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

// =======================
// Catálogo / decorações
// =======================
async function loadCatalog(categoria = "todos") {
  let query = supabase
    .from("decoracoes")
    .select("id, categoria, titulo, descricao, imagem_url, ativo")
    .eq("ativo", true)
    .order("id", { ascending: false });

  if (categoria && categoria !== "todos") {
    query = query.eq("categoria", categoria);
  }

  const { data, error } = await query;

  catalogoGrid.innerHTML = "";

  if (error) {
    console.error(error);
    const div = document.createElement("div");
    div.className = "decor-card";
    div.innerHTML =
      '<div class="decor-title">Erro ao carregar catálogo</div>' +
      `<div class="decor-desc">${error.message || ""}</div>`;
    catalogoGrid.appendChild(div);
    return;
  }

  if (!data || data.length === 0) {
    const div = document.createElement("div");
    div.className = "decor-card";
    div.innerHTML =
      '<div class="decor-title">Nenhuma decoração cadastrada</div>' +
      '<div class="decor-desc">Use o painel do administrador para cadastrar seus cenários.</div>';
    catalogoGrid.appendChild(div);
    return;
  }

  for (const deco of data) {
    const card = document.createElement("article");
    card.className = "decor-card";
    card.innerHTML = `
      ${
        deco.imagem_url
          ? `<img class="decor-img" src="${deco.imagem_url}" alt="${deco.titulo}" />`
          : ""
      }
      <div class="decor-tag">${deco.categoria || "Evento"}</div>
      <div class="decor-title">${deco.titulo}</div>
      <div class="decor-desc">${deco.descricao || ""}</div>
      <button class="btn-secondary btn-small btn-ver-fotos">Ver fotos e detalhes</button>
    `;
    catalogoGrid.appendChild(card);

    const btnVer = card.querySelector(".btn-ver-fotos");
    btnVer.addEventListener("click", () => openDecorModal(deco));
  }
}

catalogTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    catalogTabs.forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    const cat = tab.dataset.categoria || "todos";
    loadCatalog(cat);
  });
});

// =======================
// Modal + carrossel (várias fotos)
// =======================
async function fetchDecorationImages(decoracaoId, fallbackUrl) {
  const paths = [];
  try {
    const { data, error } = await supabase.storage
      .from("decoracoes")
      .list(`${decoracaoId}`, { limit: 20 });

    if (error) {
      console.error("Erro ao listar imagens:", error);
    } else if (data && data.length > 0) {
      for (const obj of data) {
        const { data: publicData } = supabase.storage
          .from("decoracoes")
          .getPublicUrl(`${decoracaoId}/${obj.name}`);
        paths.push(publicData.publicUrl);
      }
    }
  } catch (e) {
    console.error("Erro geral ao buscar imagens:", e);
  }

  // Garante pelo menos a capa
  if (paths.length === 0 && fallbackUrl) {
    paths.push(fallbackUrl);
  }

  return paths;
}

async function openDecorModal(deco) {
  decorModalContent.innerHTML = `
    <p class="section-kicker">${deco.categoria || "Evento"}</p>
    <h3 class="modal-title">${deco.titulo}</h3>
    <p class="modal-desc">${deco.descricao || ""}</p>
    <div class="carousel">
      <button class="carousel-arrow" data-dir="prev">&#10094;</button>
      <div class="carousel-viewport">
        <img id="carousel-image" class="carousel-image" alt="${deco.titulo}" />
      </div>
      <button class="carousel-arrow" data-dir="next">&#10095;</button>
    </div>
  `;

  decorModal.classList.remove("hidden");

  const imgEl = document.getElementById("carousel-image");
  const arrows = decorModalContent.querySelectorAll(".carousel-arrow");

  const imagens = await fetchDecorationImages(deco.id, deco.imagem_url);
  let index = 0;

  function render() {
    if (!imagens || imagens.length === 0) {
      imgEl.src = "";
      imgEl.alt = "Sem imagens cadastradas";
    } else {
      imgEl.src = imagens[index];
    }
  }

  arrows.forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!imagens || imagens.length === 0) return;
      const dir = btn.dataset.dir;
      if (dir === "next") {
        index = (index + 1) % imagens.length;
      } else {
        index = (index - 1 + imagens.length) % imagens.length;
      }
      render();
    });
  });

  render();
}

function closeDecorModal() {
  decorModal.classList.add("hidden");
}

decorModalClose.addEventListener("click", closeDecorModal);
decorModal.addEventListener("click", (e) => {
  if (e.target === decorModal) closeDecorModal();
});

// =======================
// Login / logout
// =======================
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
    console.error(error);
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

  // ao logar, faz sentido já mostrar view "cliente"
  showView("cliente");
});

btnLogout.addEventListener("click", async () => {
  await supabase.auth.signOut();
  setLoggedOutUI();
  showView("home");
});

// =======================
// Admin: salvar decoração com VÁRIAS imagens
// =======================
if (formDecor) {
  formDecor.addEventListener("submit", async (e) => {
    e.preventDefault();
    decorStatus.textContent = "";
    decorStatus.className = "status";

    const titulo = decorTitulo.value.trim();
    const categoria = decorCategoria.value.trim();
    const descricao = decorDescricao.value.trim();
    const files = decorImagem.files;

    if (!titulo) {
      decorStatus.textContent = "Informe pelo menos o título da decoração.";
      decorStatus.className = "status error";
      return;
    }

    decorStatus.textContent = "Salvando decoração...";
    decorStatus.className = "status";

    // 1) cria a linha da decoração
    const { data: decoData, error: decoError } = await supabase
      .from("decoracoes")
      .insert({
        categoria: categoria || null,
        titulo,
        descricao: descricao || null,
        ativo: true,
      })
      .select("id")
      .single();

    if (decoError) {
      console.error("Erro ao inserir decoração:", decoError);
      decorStatus.textContent =
        "Erro ao salvar decoração: " + decoError.message;
      decorStatus.className = "status error";
      return;
    }

    const decoracaoId = decoData.id;
    let capaUrl = null;

    // 2) envia as imagens para o Storage em uma pasta por decoração
    if (files && files.length > 0) {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const ext = file.name.split(".").pop();
        const fileName =
          Date.now().toString() +
          "-" +
          i +
          "-" +
          Math.random().toString(36).substring(2, 8) +
          "." +
          ext;

        const path = `${decoracaoId}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("decoracoes")
          .upload(path, file);

        if (uploadError) {
          console.error("Erro ao enviar imagem:", uploadError);
          // segue tentando as demais
          continue;
        }

        if (!capaUrl) {
          const { data: publicData } = supabase.storage
            .from("decoracoes")
            .getPublicUrl(path);
          capaUrl = publicData.publicUrl;
        }
      }
    }

    // 3) atualiza a capa (primeira imagem)
    if (capaUrl) {
      await supabase
        .from("decoracoes")
        .update({ imagem_url: capaUrl })
        .eq("id", decoracaoId);
    }

    decorStatus.textContent = "Decoração cadastrada com sucesso!";
    decorStatus.className = "status ok";
    formDecor.reset();

    await loadCatalog(
      document.querySelector(".catalog-tab.active")?.dataset.categoria ||
        "todos"
    );
  });
}

// =======================
// Inicialização
// =======================
(async () => {
  showView("home");

  const { data } = await supabase.auth.getSession();
  const user = data?.session?.user ?? null;
  await handleSession(user);

  await loadCatalog("todos");
})();
