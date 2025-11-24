// catalogo.js
// Catálogo de Decorações – Lorentz

import { supabase } from "./config.js";

// Elementos da página de catálogo
const catalogoGrid = document.getElementById("catalogo-grid");
const catalogTabs = document.querySelectorAll(".catalog-tab");
const decorModal = document.getElementById("decor-modal");
const decorModalContent = document.getElementById("decor-modal-content");
const decorModalClose = document.getElementById("decor-modal-close");

// Cache em memória
let decoracoesCache = [];
const imagensCache = {}; // { [decorId]: string[] }

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getDecorPublicUrl(path) {
  if (!path) return null;
  const { data } = supabase.storage.from("decoracoes").getPublicUrl(path);
  return data?.publicUrl || null;
}

// Lista arquivos de um prefixo no bucket decoracoes
async function listarNoBucket(prefix) {
  // prefix pode ser "" (raiz), "10", "10/10" etc.
  const path = prefix || "";
  const { data, error } = await supabase.storage
    .from("decoracoes")
    .list(path, {
      limit: 50,
      sortBy: { column: "name", order: "asc" },
    });

  if (error || !data) {
    console.warn("[CATÁLOGO] Erro ao listar", path, error);
    return [];
  }

  // Somente arquivos de imagem
  const files = data.filter((item) =>
    /\.(jpg|jpeg|png|webp)$/i.test(item.name)
  );
  return files.map((f) => ({ prefix: path, name: f.name }));
}

// Carrega todas as imagens de uma decoração
async function carregarImagensDecoracao(decor) {
  const id = decor.id;
  const pastaId = String(id);

  // Tentativas de lugares onde as fotos podem estar
  const candidatos = [
    pastaId,               // "10"
    `${pastaId}/${pastaId}` // "10/10" (caso tenha subpasta)
  ];

  let arquivos = [];

  for (const prefix of candidatos) {
    arquivos = await listarNoBucket(prefix);
    if (arquivos.length) break;
  }

  // Se ainda não achou nada, como fallback pega algumas imagens soltas na raiz
  if (!arquivos.length) {
    arquivos = await listarNoBucket("");
  }

  const urls = arquivos.map((arq) =>
    getDecorPublicUrl(
      arq.prefix ? `${arq.prefix}/${arq.name}` : arq.name
    )
  );

  imagensCache[id] = urls;
}

// ---------------------------------------------------------------------------
// Renderização do grid
// ---------------------------------------------------------------------------

function aplicarFiltroCatalogo(categoria) {
  if (!catalogoGrid) return;

  if (!decoracoesCache.length) {
    catalogoGrid.innerHTML =
      '<p class="hint">Ainda não há cenários cadastrados.</p>';
    return;
  }

  let lista = decoracoesCache;

  if (categoria && categoria !== "todos") {
    const alvo = categoria.toLowerCase();
    lista = decoracoesCache.filter((d) => {
      const cat = (d.categoria || d.tipo || "").toLowerCase();
      return cat === alvo;
    });
  }

  if (!lista.length) {
    catalogoGrid.innerHTML =
      '<p class="hint">Nenhum cenário encontrado para esta categoria.</p>';
    return;
  }

  catalogoGrid.innerHTML = "";

  lista.forEach((decor) => {
    const imagens = imagensCache[decor.id] || [];
    const capa = imagens[0] || null;

    const titulo = decor.titulo || decor.nome || "Decoração Lorentz";
    const categoria = decor.categoria || decor.tipo || "Decoração temática";
    const descricao = decor.descricao_curta || decor.descricao || "";

    const card = document.createElement("article");
    card.className = "decor-card";

    card.innerHTML = `
      <div class="decor-card-img-wrapper">
        ${
          capa
            ? `<img src="${capa}" alt="${titulo.replace(
                /"/g,
                "&quot;"
              )}" class="decor-card-img" />`
            : `<div class="decor-card-img decor-card-img-placeholder">Sem foto</div>`
        }
      </div>
      <div class="decor-card-body">
        <h3>${titulo}</h3>
        <p class="decor-card-meta">${categoria}</p>
        ${
          descricao
            ? `<p class="decor-card-desc">${descricao}</p>`
            : ""
        }
        <button class="btn-secondary btn-small" type="button">
          Ver fotos
        </button>
      </div>
    `;

    const btn = card.querySelector("button");
    btn.addEventListener("click", (event) => {
      event.stopPropagation();
      abrirModalDecor(decor.id);
    });

    card.addEventListener("click", () => {
      abrirModalDecor(decor.id);
    });

    catalogoGrid.appendChild(card);
  });
}

// ---------------------------------------------------------------------------
// Modal + carrossel
// ---------------------------------------------------------------------------

function abrirModalDecor(decorId) {
  if (!decorModal || !decorModalContent) return;

  const decor = decoracoesCache.find((d) => d.id === decorId);
  const imagens = imagensCache[decorId] || [];

  const titulo = decor?.titulo || decor?.nome || "Decoração Lorentz";
  const descricao = decor?.descricao || decor?.descricao_curta || "";

  decorModalContent.innerHTML = "";

  if (!imagens.length) {
    decorModalContent.innerHTML = `
      <h3>${titulo}</h3>
      <p class="hint">${
        descricao ||
        "Ainda não há fotos cadastradas para este cenário."
      }</p>
    `;
    decorModal.classList.remove("hidden");
    return;
  }

  let idx = 0;

  decorModalContent.innerHTML = `
    <h3>${titulo}</h3>
    ${
      descricao
        ? `<p class="hint" style="margin-bottom: 10px;">${descricao}</p>`
        : ""
    }
    <div class="decor-carousel">
      <button class="carousel-btn carousel-prev" type="button">&#10094;</button>
      <div class="carousel-frame">
        <img class="carousel-img" src="${imagens[0]}" alt="${titulo}" />
      </div>
      <button class="carousel-btn carousel-next" type="button">&#10095;</button>
    </div>
    <p class="hint" style="text-align:center; margin-top:8px;">
      <span id="carousel-indicator">1 / ${imagens.length}</span>
    </p>
  `;

  const imgEl = decorModalContent.querySelector(".carousel-img");
  const btnPrev = decorModalContent.querySelector(".carousel-prev");
  const btnNext = decorModalContent.querySelector(".carousel-next");
  const indicator = decorModalContent.querySelector("#carousel-indicator");

  function update() {
    imgEl.src = imagens[idx];
    if (indicator) {
      indicator.textContent = `${idx + 1} / ${imagens.length}`;
    }
  }

  btnPrev.addEventListener("click", (e) => {
    e.stopPropagation();
    idx = (idx - 1 + imagens.length) % imagens.length;
    update();
  });

  btnNext.addEventListener("click", (e) => {
    e.stopPropagation();
    idx = (idx + 1) % imagens.length;
    update();
  });

  decorModal.classList.remove("hidden");
}

function fecharModalDecor() {
  if (!decorModal) return;
  decorModal.classList.add("hidden");
}

// ---------------------------------------------------------------------------
// Eventos do catálogo
// ---------------------------------------------------------------------------

function registrarEventosCatalogo() {
  if (catalogTabs && catalogTabs.length) {
    catalogTabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        catalogTabs.forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");
        const cat = tab.dataset.categoria || "todos";
        aplicarFiltroCatalogo(cat);
      });
    });
  }

  if (decorModalClose) {
    decorModalClose.addEventListener("click", () => fecharModalDecor());
  }

  if (decorModal) {
    const backdrop = decorModal.querySelector(".modal-backdrop");
    if (backdrop) {
      backdrop.addEventListener("click", () => fecharModalDecor());
    }
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") fecharModalDecor();
  });
}

// ---------------------------------------------------------------------------
// Carregar catálogo do Supabase
// ---------------------------------------------------------------------------

async function carregarCatalogo() {
  if (!catalogoGrid) return;

  catalogoGrid.innerHTML = '<p class="hint">Carregando cenários...</p>';

  try {
    const { data, error } = await supabase.from("decoracoes").select("*");

    if (error) {
      console.error("[CATÁLOGO] Erro ao carregar decoracoes:", error);
      catalogoGrid.innerHTML =
        '<p class="hint status-error">Não foi possível carregar o catálogo.</p>';
      return;
    }

    decoracoesCache = data || [];

    if (!decoracoesCache.length) {
      catalogoGrid.innerHTML =
        '<p class="hint">Ainda não há cenários cadastrados.</p>';
      return;
    }

    await Promise.all(decoracoesCache.map((d) => carregarImagensDecoracao(d)));

    aplicarFiltroCatalogo("todos");
  } catch (err) {
    console.error("[CATÁLOGO] Erro inesperado ao carregar catálogo:", err);
    catalogoGrid.innerHTML =
      '<p class="hint status-error">Erro inesperado ao carregar o catálogo.</p>';
  }
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

async function initCatalogo() {
  if (!catalogoGrid) return; // se não for a página de catálogo, não faz nada
  registrarEventosCatalogo();
  await carregarCatalogo();
}

initCatalogo();
