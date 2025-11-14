// Código principal do portal Lorentz.
// Agora ele funciona em QUALQUER página (index, catalogo, cliente) sem tentar
// esconder/mostrar seções. Só faz algo se o elemento existir na página.

import { supabase } from "./config.js";

// ===== Seleção de elementos (podem ser null em algumas páginas) =====
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

// Admin: cadastro de decoração
const formDecor = document.getElementById("form-decor");
const decorCategoria = document.getElementById("decor-categoria");
const decorTitulo = document.getElementById("decor-titulo");
const decorDescricao = document.getElementById("decor-descricao");
const decorImagem = document.getElementById("decor-imagem");
const decorStatus = document.getElementById("decor-status");

// Modal do catálogo
const decorModal = document.getElementById("decor-modal");
const decorModalClose = document.getElementById("decor-modal-close");
const decorModalContent = document.getElementById("decor-modal-content");

// ===== UI de sessão (guardando nulls) =====
function setLoggedOutUI() {
  if (loginSection) loginSection.classList.remove("hidden");
  if (adminSection) adminSection.classList.add("hidden");
  if (clientSection) clientSection.classList.add("hidden");

  if (headerSessionText) headerSessionText.textContent = "Visitante";
  if (headerRole) headerRole.classList.add("hidden");
  if (btnLogout) btnLogout.classList.add("hidden");
}

function setAdminUI(name) {
  if (loginSection) loginSection.classList.add("hidden");
  if (adminSection) adminSection.classList.remove("hidden");
  if (clientSection) clientSection.classList.add("hidden");

  if (headerSessionText) headerSessionText.textContent = name || "Administrador";
  if (headerRole) {
    headerRole.textContent = "ADMIN";
    headerRole.classList.remove("hidden");
  }
  if (btnLogout) btnLogout.classList.remove("hidden");
}

function setClientUI(name) {
  if (loginSection) loginSection.classList.add("hidden");
  if (adminSection) adminSection.classList.add("hidden");
  if (clientSection) clientSection.classList.remove("hidden");

  if (headerSessionText) headerSessionText.textContent = name || "Cliente";
  if (headerRole) {
    headerRole.textContent = "CLIENTE";
    headerRole.classList.remove("hidden");
  }
  if (btnLogout) btnLogout.classList.remove("hidden");
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

// ===== Catálogo =====
async function loadCatalog(categoria = "todos") {
  if (!catalogoGrid) return; // página sem catálogo

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
      ${deco.imagem_url ? `<img class="decor-img" src="${deco.imagem_url}" alt="${deco.titulo}" />` : ""}
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

// Tabs de categoria (só se existirem)
if (catalogTabs && catalogTabs.length) {
  catalogTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      catalogTabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      const cat = tab.dataset.categoria || "todos";
      loadCatalog(cat);
    });
  });
}

// ===== Modal / carrossel =====
async function fetchDecorationImages(decoracaoId, fallbackUrl) {
  const paths = [];
  try {
    const { data, error } = await supabase.storage
      .from("decoracoes")
      .list(`${decoracaoId}`, { limit: 20 });

    if (!error && data && data.length > 0) {
      for (const obj of data) {
        const { data: publicData } = supabase.storage
          .from("decoracoes")
          .getPublicUrl(`${decoracaoId}/${obj.name}`);
        paths.push(publicData.publicUrl);
      }
    } else if (error) {
      console.error("Erro ao listar imagens:", error);
    }
  } catch (e) {
    console.error("Erro geral ao buscar imagens:", e);
  }

  if (paths.length === 0 && fallbackUrl) paths.push(fallbackUrl);
  return paths;
}

async function openDecorModal(deco) {
  if (!decorModal || !decorModalContent) return;

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
      if (dir === "next") index = (index + 1) % imagens.length;
      else index = (index - 1 + imagens.length) % imagens.length;
      render();
    });
  });

  render();
}

function closeDecorModal() {
  if (decorModal) decorModal.classList.add("hidden");
}

if (decorModal && decorModalClose) {
  decorModalClose.addEventListener("click", closeDecorModal);
  decorModal.addEventListener("click", (e) => {
    if (e.target === decorModal) closeDecorModal();
  });
}

// ===== Login / logout =====
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!loginStatus) return;

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

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

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
  });
}

if (btnLogout) {
  btnLogout.addEventListener("click", async () => {
    await supabase.auth.signOut();
    setLoggedOutUI();
  });
}

// ===== Cadastro de decoração (admin) =====
if (formDecor) {
  formDecor.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!decorStatus) return;

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
      decorStatus.textContent = "Erro ao salvar decoração: " + decoError.message;
      decorStatus.className = "status error";
      return;
    }

    const decoracaoId = decoData.id;
    let capaUrl = null;

    if (files && files.length > 0) {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const ext = file.name.split(".").pop();
        const unique = `${Date.now()}-${i}-${Math.random().toString(36).substring(2, 8)}`;
        const path = `${decoracaoId}/${unique}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("decoracoes")
          .upload(path, file);

        if (uploadError) {
          console.error("Erro ao enviar imagem:", uploadError);
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

    if (capaUrl) {
      await supabase.from("decoracoes").update({ imagem_url: capaUrl }).eq("id", decoracaoId);
    }

    decorStatus.textContent = "Decoração cadastrada com sucesso!";
    decorStatus.className = "status ok";
    formDecor.reset();

    // Se estiver na página do catálogo, recarrega lista
    const activeTab = document.querySelector(".catalog-tab.active");
    const currentCat = activeTab ? activeTab.dataset.categoria : "todos";
    await loadCatalog(currentCat);
  });
}

// ===== Inicialização =====
(async () => {
  // Recupera sessão atual (se usuário já estiver logado)
  const { data } = await supabase.auth.getSession();
  const user = data?.session?.user ?? null;
  await handleSession(user);

  // Só carrega catálogo se existir na página
  await loadCatalog("todos");
})();
