// app.js
// Portal Lorentz – Catálogo + Área do Cliente + Cadastro de Interessados

import { supabase } from "./config.js";

// ===========================================================================
// SELEÇÃO DE ELEMENTOS (podem ser null em algumas páginas)
// ===========================================================================

// Header
const headerSessionText = document.getElementById("header-session-text");
const headerRole = document.getElementById("header-role");
const btnLogout = document.getElementById("btn-logout");

// Página CLIENTE
const loginSection = document.getElementById("login-section");
const clientSection = document.getElementById("client-section");
const loginForm = document.getElementById("login-form");
const loginStatus = document.getElementById("login-status");

const clienteCadastroForm = document.getElementById("cliente-cadastro-form");
const clienteCadastroStatus = document.getElementById(
  "cliente-cadastro-status"
);

const clientOrcamentosList = document.getElementById("client-orcamentos");
const clientPagamentosList = document.getElementById("client-pagamentos");

// Página CATÁLOGO
const catalogoGrid = document.getElementById("catalogo-grid");
const catalogTabs = document.querySelectorAll(".catalog-tab");
const decorModal = document.getElementById("decor-modal");
const decorModalContent = document.getElementById("decor-modal-content");
const decorModalClose = document.getElementById("decor-modal-close");

// Cache do catálogo
let decoracoesCache = [];
const decorImagensCache = {}; // { [decorId]: string[] }

// ===========================================================================
// HELPERS DE UI
// ===========================================================================

function setStatus(el, message, type = "info") {
  if (!el) return;
  el.textContent = message || "";
  el.classList.remove("status-error", "status-success", "status-info");
  if (type === "error") el.classList.add("status-error");
  else if (type === "success") el.classList.add("status-success");
  else el.classList.add("status-info");
}

function showElement(el) {
  if (!el) return;
  el.classList.remove("hidden");
}

function hideElement(el) {
  if (!el) return;
  el.classList.add("hidden");
}

function formatCurrency(valor) {
  if (valor == null || isNaN(valor)) return "-";
  return Number(valor).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatDate(dateStr) {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("pt-BR");
}

// ===========================================================================
// ESTADO DE SESSÃO – CLIENTE
// ===========================================================================

function aplicarEstadoDeslogado() {
  if (headerSessionText) headerSessionText.textContent = "Visitante";
  if (headerRole) {
    headerRole.textContent = "";
    headerRole.classList.add("hidden");
  }
  if (btnLogout) btnLogout.classList.add("hidden");

  if (loginSection) showElement(loginSection);
  if (clientSection) hideElement(clientSection);

  setStatus(loginStatus, "");
}

function aplicarEstadoLogado(user, cliente) {
  const nome =
    cliente?.nome_contratante ||
    cliente?.nome ||
    user.email ||
    "Cliente Lorentz";

  if (headerSessionText) headerSessionText.textContent = nome;

  if (headerRole) {
    headerRole.textContent = "Cliente";
    headerRole.classList.remove("hidden");
  }

  if (btnLogout) btnLogout.classList.remove("hidden");

  if (loginSection) hideElement(loginSection);
  if (clientSection) showElement(clientSection);
}

// ===========================================================================
// CLIENTE – BUSCA NO BANCO (tenta por user_id e depois por email)
// ===========================================================================

async function buscarCliente(user) {
  // 1) Tenta por user_id
  try {
    const { data, error } = await supabase
      .from("clientes")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!error && data) {
      return data;
    }
  } catch (err) {
    console.warn(
      "[CLIENTE] Erro buscando cliente por user_id, tentando por email:",
      err
    );
  }

  // 2) Fallback: tenta por email
  try {
    const { data, error } = await supabase
      .from("clientes")
      .select("*")
      .eq("email", user.email)
      .maybeSingle();

    if (error) {
      console.warn("[CLIENTE] Erro buscando cliente por email:", error);
      return null;
    }

    return data || null;
  } catch (err) {
    console.error("[CLIENTE] Erro inesperado buscando cliente por email:", err);
    return null;
  }
}

// ===========================================================================
// CLIENTE – DOCUMENTOS (ORÇAMENTO / CONTRATO) via STORAGE
// ===========================================================================

// bucket: documentos
function getPublicUrlFromPath(path) {
  if (!path) return null;
  const { data } = supabase.storage.from("documentos").getPublicUrl(path);
  return data?.publicUrl || null;
}

async function carregarDocumentosCliente(clienteId) {
  if (!clientOrcamentosList) return;

  clientOrcamentosList.innerHTML =
    '<p class="hint">Carregando documentos do seu evento...</p>';

  try {
    const folder = String(clienteId); // pasta = id do cliente

    const { data, error } = await supabase.storage
      .from("documentos")
      .list(folder, {
        limit: 20,
        sortBy: { column: "name", order: "asc" },
      });

    if (error) {
      console.error("[CLIENTE] Erro ao listar documentos no Storage:", error);
      clientOrcamentosList.innerHTML =
        '<p class="hint status-error">Não foi possível carregar os documentos.</p>';
      return;
    }

    if (!data || !data.length) {
      clientOrcamentosList.innerHTML =
        '<p class="hint">Ainda não há documentos anexados para este cliente.</p>';
      return;
    }

    let orcamentoFile = null;
    let contratoFile = null;

    data.forEach((file) => {
      const name = file.name.toLowerCase();
      if (!orcamentoFile && name.includes("orcamento")) {
        orcamentoFile = file;
      }
      if (!contratoFile && name.includes("contrato")) {
        contratoFile = file;
      }
    });

    renderizarDocumentosCliente(folder, orcamentoFile, contratoFile);
  } catch (err) {
    console.error("[CLIENTE] Erro inesperado ao carregar documentos:", err);
    clientOrcamentosList.innerHTML =
      '<p class="hint status-error">Erro inesperado ao carregar documentos.</p>';
  }
}

function renderizarDocumentosCliente(folder, orcamentoFile, contratoFile) {
  if (!clientOrcamentosList) return;

  const urlOrcamento = orcamentoFile
    ? getPublicUrlFromPath(`${folder}/${orcamentoFile.name}`)
    : null;

  const urlContrato = contratoFile
    ? getPublicUrlFromPath(`${folder}/${contratoFile.name}`)
    : null;

  clientOrcamentosList.innerHTML = `
    <div class="orcamento-item">
      <h4>Orçamento de decoração de festa / evento</h4>
      <p class="hint">
        ${
          urlOrcamento
            ? `<a href="${urlOrcamento}" target="_blank" class="btn-link">Ver orçamento (PDF)</a>`
            : `Orçamento ainda não anexado em PDF.`
        }
        <br />
        ${
          urlContrato
            ? `<a href="${urlContrato}" target="_blank" class="btn-link">Ver contrato (PDF)</a>`
            : `Contrato ainda não anexado em PDF.`
        }
      </p>
    </div>
  `;
}

// ===========================================================================
// CLIENTE – PAGAMENTOS (tabela parcelas)
// ===========================================================================

async function carregarPagamentos(clienteId) {
  if (!clientPagamentosList) return;

  clientPagamentosList.innerHTML =
    '<p class="hint">Carregando informações de pagamento...</p>';

  try {
    const { data, error } = await supabase
      .from("parcelas")
      .select("*")
      .eq("cliente_id", clienteId)
      .order("data_venc", { ascending: true });

    if (error) {
      console.error("[CLIENTE] Erro ao carregar parcelas:", error);
      clientPagamentosList.innerHTML =
        '<p class="hint status-error">Não foi possível carregar as parcelas.</p>';
      return;
    }

    const parcelas = data || [];
    renderizarPagamentos(parcelas);
  } catch (err) {
    console.error("[CLIENTE] Erro inesperado ao carregar parcelas:", err);
    clientPagamentosList.innerHTML =
      '<p class="hint status-error">Erro inesperado ao carregar parcelas.</p>';
  }
}

function renderizarPagamentos(parcelas) {
  if (!clientPagamentosList) return;

  if (!parcelas.length) {
    clientPagamentosList.innerHTML =
      '<p class="hint">Ainda não há parcelas cadastradas para este cliente.</p>';
    return;
  }

  const table = document.createElement("table");
  table.className = "tabela-pagamentos";

  const thead = document.createElement("thead");
  thead.innerHTML = `
    <tr>
      <th>Parcela</th>
      <th>Vencimento</th>
      <th>Valor</th>
      <th>Tipo</th>
      <th>Status</th>
    </tr>
  `;

  const tbody = document.createElement("tbody");

  parcelas.forEach((p) => {
    const tr = document.createElement("tr");

    const numero = p.numero ?? "-";
    const venc = formatDate(p.data_venc);
    const valor = formatCurrency(p.valor);
    const tipo = p.tipo || "-";
    const status = p.status || "aberta";

    tr.innerHTML = `
      <td>${numero}</td>
      <td>${venc}</td>
      <td>${valor}</td>
      <td>${tipo}</td>
      <td>${status}</td>
    `;

    tbody.appendChild(tr);
  });

  table.appendChild(thead);
  table.appendChild(tbody);

  clientPagamentosList.innerHTML = "";
  clientPagamentosList.appendChild(table);
}

// ===========================================================================
// CLIENTE – CARREGAR PAINEL COMPLETO
// ===========================================================================

async function carregarPainelCliente(user) {
  const cliente = await buscarCliente(user);

  aplicarEstadoLogado(user, cliente);

  if (!cliente) {
    if (clientOrcamentosList) {
      clientOrcamentosList.innerHTML =
        '<p class="hint status-info">Seus dados ainda não foram vinculados ao painel. A equipe Lorentz fará isso em breve.</p>';
    }
    if (clientPagamentosList) {
      clientPagamentosList.innerHTML =
        '<p class="hint status-info">Assim que o orçamento e pagamentos forem cadastrados, aparecerão aqui.</p>';
    }
    return;
  }

  await carregarDocumentosCliente(cliente.id); // PDFs direto do Storage
  await carregarPagamentos(cliente.id); // Parcelas da tabela parcelas
}

// ===========================================================================
// AUTENTICAÇÃO – login / logout
// ===========================================================================

async function checarSessaoInicial() {
  try {
    const { data, error } = await supabase.auth.getUser();

    if (error || !data?.user) {
      aplicarEstadoDeslogado();
      return;
    }

    await carregarPainelCliente(data.user);
  } catch (err) {
    console.error("[CLIENTE] Erro ao checar sessão inicial:", err);
    aplicarEstadoDeslogado();
  }
}

async function fazerLogin(email, password) {
  try {
    setStatus(loginStatus, "Entrando...", "info");

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error("[CLIENTE] Erro no login:", error);
      setStatus(loginStatus, "E-mail ou senha inválidos.", "error");
      return;
    }

    const user = data?.user;
    if (!user) {
      setStatus(
        loginStatus,
        "Não foi possível recuperar os dados do usuário.",
        "error"
      );
      return;
    }

    setStatus(loginStatus, "Login realizado com sucesso!", "success");
    await carregarPainelCliente(user);
  } catch (err) {
    console.error("[CLIENTE] Erro inesperado no login:", err);
    setStatus(
      loginStatus,
      "Erro inesperado ao tentar entrar. Tente novamente.",
      "error"
    );
  }
}

async function fazerLogout() {
  try {
    await supabase.auth.signOut();
  } catch (err) {
    console.error("[CLIENTE] Erro ao sair:", err);
  } finally {
    aplicarEstadoDeslogado();
  }
}

// ===========================================================================
// CADASTRO DE VISITANTE
// ===========================================================================

async function cadastrarClienteVisitante(payload) {
  try {
    setStatus(
      clienteCadastroStatus,
      "Enviando seus dados para a equipe Lorentz...",
      "info"
    );

    const { error } = await supabase.from("clientes").insert(payload);

    if (error) {
      console.error("[CLIENTE] Erro ao cadastrar cliente visitante:", error);
      setStatus(
        clienteCadastroStatus,
        "Não foi possível enviar seus dados. Tente novamente.",
        "error"
      );
      return;
    }

    setStatus(
      clienteCadastroStatus,
      "Cadastro enviado com sucesso! A equipe Lorentz entrará em contato.",
      "success"
    );
  } catch (err) {
    console.error("[CLIENTE] Erro inesperado no cadastro de visitante:", err);
    setStatus(
      clienteCadastroStatus,
      "Erro inesperado ao enviar seus dados.",
      "error"
    );
  }
}

// ===========================================================================
// EVENTOS – formulário de login / cadastro / sair
// ===========================================================================

function registrarEventosCliente() {
  if (loginForm) {
    loginForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      const email = document.getElementById("email")?.value.trim();
      const password = document.getElementById("password")?.value || "";

      if (!email || !password) {
        setStatus(
          loginStatus,
          "Informe e-mail e senha para entrar.",
          "error"
        );
        return;
      }

      await fazerLogin(email, password);
    });
  }

  if (btnLogout) {
    btnLogout.addEventListener("click", async () => {
      await fazerLogout();
    });
  }

  if (clienteCadastroForm) {
    clienteCadastroForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      const nomeContratante = document
        .getElementById("cli-nome-contratante")
        ?.value.trim();
      const nomeNoivos = document
        .getElementById("cli-nome-noivos")
        ?.value.trim();
      const email = document.getElementById("cli-email")?.value.trim();
      const telefone = document.getElementById("cli-telefone")?.value.trim();
      const telefoneWhats = document
        .getElementById("cli-telefone-whatsapp")
        ?.value.trim();
      const cpf = document.getElementById("cli-cpf")?.value.trim();
      const dataEvento = document.getElementById("cli-data-evento")?.value;
      const horaEvento = document.getElementById("cli-hora-evento")?.value;
      const enderecoResid = document
        .getElementById("cli-endereco-residencial")
        ?.value.trim();
      const enderecoEvento = document
        .getElementById("cli-endereco-evento")
        ?.value.trim();

      if (!nomeContratante || !email || !telefone) {
        setStatus(
          clienteCadastroStatus,
          "Preencha pelo menos nome, e-mail e telefone.",
          "error"
        );
        return;
      }

      let userId = null;
      try {
        const { data } = await supabase.auth.getUser();
        userId = data?.user?.id || null;
      } catch {
        userId = null;
      }

      const payload = {
        nome_contratante: nomeContratante,
        nome_noivos: nomeNoivos || null,
        email: email,
        telefone: telefone,
        telefone_whatsapp: telefoneWhats || null,
        cpf: cpf || null,
        data_evento: dataEvento || null,
        hora_evento: horaEvento || null,
        endereco_residencial: enderecoResid || null,
        endereco_evento: enderecoEvento || null,
        origem_cadastro: "site_cliente",
      };

      if (userId) {
        payload.user_id = userId;
      }

      await cadastrarClienteVisitante(payload);
    });
  }
}

// ===========================================================================
// CATÁLOGO – imagens via tabela + Storage
// ===========================================================================

// ---------- Helpers de bucket (decoracoes) ----------

function getDecorPublicUrl(path) {
  if (!path) return null;
  const { data } = supabase.storage.from("decoracoes").getPublicUrl(path);
  return data?.publicUrl || null;
}

// nome da pasta onde estão as fotos da decoração
function obterPastaDecoracao(decor) {
  const raw =
    decor.pasta_imagens ||
    decor.pasta ||
    decor.folder ||
    decor.slug ||
    decor.id;

  if (raw === undefined || raw === null) return null;
  return String(raw);
}

// Lista arquivos de imagem em um prefixo (pasta) do bucket decoracoes
async function listarImagensNoPrefixo(prefix) {
  const safePrefix = prefix || "";
  const { data, error } = await supabase.storage
    .from("decoracoes")
    .list(safePrefix, {
      limit: 50,
      sortBy: { column: "name", order: "asc" },
    });

  if (error || !data) {
    console.warn("[CATALOGO] Erro ao listar prefixo", safePrefix, error);
    return { arquivos: [], subpastas: [] };
  }

  // Supabase: pastas não têm metadata; arquivos têm metadata
  const arquivos = data.filter((item) =>
    /\.(jpg|jpeg|png|webp)$/i.test(item.name)
  );
  const subpastas = data.filter((item) => !item.metadata);

  return { arquivos, subpastas };
}

// ---------- Busca imagens na tabela decoracao_imagens (se existir) ----------

async function buscarImagensDecoracaoDB(decoracaoId) {
  const urls = [];

  try {
    const { data, error } = await supabase
      .from("decoracao_imagens")
      .select("url, ordem")
      .eq("decoracao_id", decoracaoId)
      .order("ordem", { ascending: true });

    if (error) {
      console.warn("[CATALOGO] Erro em decoracao_imagens:", error.message);
      return urls;
    }

    (data || []).forEach((row) => {
      if (row.url) urls.push(row.url);
    });
  } catch (err) {
    console.warn(
      "[CATALOGO] decoracao_imagens não disponível ou erro inesperado:",
      err
    );
  }

  return urls;
}

// ---------- Busca imagens no Storage, usando pasta baseada na decoração ----------

async function buscarImagensDecoracaoStorage(decor) {
  const urls = [];
  const pastaBase = obterPastaDecoracao(decor);
  if (!pastaBase) return urls;

  try {
    // 1) Arquivos direto na pasta "10"
    const { arquivos, subpastas } = await listarImagensNoPrefixo(pastaBase);

    arquivos.forEach((f) => {
      const url = getDecorPublicUrl(`${pastaBase}/${f.name}`);
      if (url) urls.push(url);
    });

    // 2) Subpastas "10/10", "10/11", "10/12"...
    for (const folder of subpastas) {
      const subPrefix = `${pastaBase}/${folder.name}`;
      const { arquivos: arquivosSub } = await listarImagensNoPrefixo(
        subPrefix
      );
      arquivosSub.forEach((f) => {
        const url = getDecorPublicUrl(`${subPrefix}/${f.name}`);
        if (url) urls.push(url);
      });
    }
  } catch (err) {
    console.error(
      "[CATALOGO] Erro inesperado ao carregar imagens da decoração via Storage",
      decor.id,
      err
    );
  }

  return urls;
}

// ---------- Monta cache de imagens para cada decoração ----------

async function carregarImagensDecoracoes(lista) {
  const promises = lista.map(async (decor) => {
    let urls = [];

    // 1) Tenta pela tabela decoracao_imagens (se existir)
    urls = await buscarImagensDecoracaoDB(decor.id);

    // 2) Se ainda não tem nada, tenta buscar no Storage
    if (!urls.length) {
      urls = await buscarImagensDecoracaoStorage(decor);
    }

    // 3) Fallback final: capa_url / imagem_url
    const capa = decor.capa_url || decor.imagem_url;
    if (!urls.length && capa) {
      urls.push(capa);
    }

    decorImagensCache[decor.id] = urls;
    console.log(
      `[CATALOGO] Imagens para decoração ${decor.id}:`,
      urls.length
    );
  });

  await Promise.all(promises);
}

// ---------- Carrega catálogo do Supabase ----------

async function carregarCatalogo(categoria = "todos") {
  if (!catalogoGrid) return;

  catalogoGrid.innerHTML = '<p class="hint">Carregando cenários...</p>';

  try {
    const { data, error } = await supabase.from("decoracoes").select("*");

    if (error) {
      console.error("[CATALOGO] Erro ao carregar decoracoes:", error);
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

    await carregarImagensDecoracoes(decoracoesCache);
    aplicarFiltroCatalogo(categoria);
  } catch (err) {
    console.error("[CATALOGO] Erro inesperado ao carregar catálogo:", err);
    catalogoGrid.innerHTML =
      '<p class="hint status-error">Erro inesperado ao carregar o catálogo.</p>';
  }
}

// ---------- Renderização do grid ----------

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
    const imagens = decorImagensCache[decor.id] || [];
    const capa =
      imagens[0] || decor.capa_url || decor.imagem_url || null;

    const titulo = decor.titulo || decor.nome || "Decoração Lorentz";
    const categoriaLabel =
      decor.categoria || decor.tipo || "Decoração temática";
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
        <p class="decor-card-meta">${categoriaLabel}</p>
        ${descricao ? `<p class="decor-card-desc">${descricao}</p>` : ""}
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

// ---------- Modal + carrossel ----------

function abrirModalDecor(decorId) {
  if (!decorModal || !decorModalContent) return;

  const decor = decoracoesCache.find((d) => d.id === decorId);
  const imagens = decorImagensCache[decorId] || [];

  const titulo = decor?.titulo || decor?.nome || "Decoração Lorentz";
  const descricao = decor?.descricao || decor?.descricao_curta || "";

  decorModalContent.innerHTML = "";

  if (!imagens.length) {
    decorModalContent.innerHTML = `
      <h3>${titulo}</h3>
      <p class="hint">${
        descricao || "Ainda não há fotos cadastradas para este cenário."
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

function registrarEventosCatalogo() {
  if (catalogTabs && catalogTabs.length) {
    catalogTabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        catalogTabs.forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");
        const cat = tab.dataset.categoria || "todos";
        carregarCatalogo(cat);
      });
    });
  }

  if (decorModalClose) {
    decorModalClose.addEventListener("click", () => {
      fecharModalDecor();
    });
  }

  if (decorModal) {
    const backdrop = decorModal.querySelector(".modal-backdrop");
    if (backdrop) {
      backdrop.addEventListener("click", () => fecharModalDecor());
    }
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      fecharModalDecor();
    }
  });
}

// ===========================================================================
// INICIALIZAÇÃO
// ===========================================================================

async function init() {
  // Área do cliente (se a página tiver os elementos)
  aplicarEstadoDeslogado();
  registrarEventosCliente();
  await checarSessaoInicial();

  // Catálogo (só roda se estiver na página de catálogo)
  if (catalogoGrid) {
    registrarEventosCatalogo();
    await carregarCatalogo("todos");
  }
}

init();
