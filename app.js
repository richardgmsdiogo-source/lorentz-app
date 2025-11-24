// Código principal do portal Lorentz (versão somente catálogo + área do cliente).
// Agora o acesso ADM é feito apenas pelo app interno; o site foca no portfólio
// e na experiência da cliente.

import { supabase } from "./config.js";

// ===== Seleção de elementos (podem ser null em algumas páginas) =====

// Catálogo
const catalogoGrid = document.getElementById("catalogo-grid");
const catalogTabs = document.querySelectorAll(".catalog-tab");

// Login / sessão (área do cliente)
const loginForm = document.getElementById("login-form");
const loginStatus = document.getElementById("login-status");

const loginSection = document.getElementById("login-section");
const clientSection = document.getElementById("client-section");

// Header
const headerSessionText = document.getElementById("header-session-text");
const headerRole = document.getElementById("header-role");
const btnLogout = document.getElementById("btn-logout");

// Área do cliente (painel do usuário)
const clientOrcamentosList = document.getElementById("client-orcamentos");
const clientPagamentosList = document.getElementById("client-pagamentos");

// Cadastro de clientes (visitante)
const clienteCadastroForm = document.getElementById("cliente-cadastro-form");
const clienteCadastroStatus = document.getElementById("cliente-cadastro-status");

// Modal do catálogo (usado em catalogo.html)
const decorModal = document.getElementById("decor-modal");
const decorModalClose = document.getElementById("decor-modal-close");
const decorModalContent = document.getElementById("decor-modal-content");

// ===== UI de sessão =====
function setLoggedOutUI() {
  if (loginSection) loginSection.classList.remove("hidden");
  if (clientSection) clientSection.classList.add("hidden");

  if (headerSessionText) headerSessionText.textContent = "Visitante";
  if (headerRole) headerRole.classList.add("hidden");
  if (btnLogout) btnLogout.classList.add("hidden");
}

function setClientUI(name) {
  if (loginSection) loginSection.classList.add("hidden");
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

  // Busca apenas o nome no profile (role agora é usada só no app ADM)
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("name")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    console.error("Erro ao carregar profile:", error);
  }

  const name = profile?.name || user.email;
  setClientUI(name);
  await loadClientOrcamentosForUser(user);
}

// ===== Cadastro de clientes (visitante) =====

function buildClientePayload(prefix) {
  const get = (id) => {
    const el = document.getElementById(prefix + id);
    return el ? el.value.trim() : "";
  };

  const nomeContratante = get("nome-contratante");
  const nomeNoivos = get("nome-noivos");
  const email = get("email");
  const telefone = get("telefone");
  const telefoneWhats = get("telefone-whatsapp");
  const cpf = get("cpf");
  const dataEvento = get("data-evento");
  const horaEvento = get("hora-evento");
  const endResidencial = get("endereco-residencial");
  const endEvento = get("endereco-evento");

  return {
    nome_contratante: nomeContratante || null,
    nome_noivos: nomeNoivos || null,
    email: email || null,
    telefone: telefone || null,
    telefone_whatsapp: telefoneWhats || telefone || null,
    cpf: cpf || null,
    documento: cpf || null,              // espelha CPF em documento
    data_evento: dataEvento || null,
    hora_evento: horaEvento || null,
    horario_evento: horaEvento || null,  // espelho, se existir essa coluna
    endereco_residencial: endResidencial || null,
    endereco_evento: endEvento || null,
    nome: nomeContratante || null        // espelha contratante em nome
  };
}

async function inserirCliente(payload, statusEl) {
  if (!statusEl) statusEl = { textContent: "", className: "" };

  if (!payload.nome_contratante || !payload.email || !payload.telefone) {
    statusEl.textContent =
      "Preencha pelo menos nome do contratante, telefone e e-mail.";
    statusEl.className = "status error";
    return;
  }

  statusEl.textContent = "Salvando cadastro...";
  statusEl.className = "status";

  const { error } = await supabase.from("clientes").insert(payload);

  if (error) {
    console.error("Erro ao salvar cliente:", error);
    statusEl.textContent = "Erro ao salvar cliente: " + error.message;
    statusEl.className = "status error";
    return;
  }

  statusEl.textContent = "Cliente cadastrado com sucesso!";
  statusEl.className = "status ok";
}

// Listener do formulário de cadastro do visitante (cliente.html)
if (clienteCadastroForm) {
  clienteCadastroForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = buildClientePayload("cli-");
    await inserirCliente(payload, clienteCadastroStatus);
    if (!clienteCadastroStatus.className.includes("error")) {
      clienteCadastroForm.reset();
    }
  });
}

// ===== Catálogo =====
async function loadCatalog(categoria = "todos") {
  if (!catalogoGrid) return; // página sem catálogo

  let query = supabase
    .from("decoracoes")
    .select("id, categoria, titulo, descricao, capa_url, imagem_url, ativo")
    .eq("ativo", true)
    .order("criado_em", { ascending: false });

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
      '<div class="decor-desc">As produções serão adicionadas em breve.</div>';
    catalogoGrid.appendChild(div);
    return;
  }

  for (const deco of data) {
    const capa = deco.capa_url || deco.imagem_url;

    const card = document.createElement("article");
    card.className = "decor-card";
    card.innerHTML = `
      ${capa ? `<img class="decor-img" src="${capa}" alt="${deco.titulo}" />` : ""}
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

// ===== Imagens da decoração (carrossel) por TÍTULO =====
async function fetchDecorationImagesByTitulo(titulo, fallbackUrl) {
  const urls = [];

  try {
    const { data, error } = await supabase
      .from("decoracao_imagens")
      .select("url, ordem")
      .eq("titulo", titulo)
      .order("ordem", { ascending: true });

    if (error) {
      console.error("Erro ao buscar imagens por título:", error);
    } else if (data && data.length > 0) {
      data.forEach((row) => urls.push(row.url));
    }
  } catch (e) {
    console.error("Erro geral ao buscar imagens:", e);
  }

  if (urls.length === 0 && fallbackUrl) {
    urls.push(fallbackUrl);
  }

  return urls;
}

async function openDecorModal(deco) {
  if (!decorModal || !decorModalContent) return;

  const capa = deco.capa_url || deco.imagem_url;

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

  const imagens = await fetchDecorationImagesByTitulo(deco.titulo, capa);
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

// ===== Login / logout (área do cliente) =====
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
  });
}

if (btnLogout) {
  btnLogout.addEventListener("click", async () => {
    await supabase.auth.signOut();
    setLoggedOutUI();
  });
}

// ===== Resumo das parcelas na área do cliente (com base no texto do orçamento) =====
function renderPagamentosResumo(orc) {
  if (!clientPagamentosList) return;

  if (!orc || !orc.forma_pagamento) {
    clientPagamentosList.innerHTML = `
      <p class="hint">
        Ainda não há forma de pagamento cadastrada para o seu orçamento.
      </p>`;
    return;
  }

  const partes = orc.forma_pagamento
    .split("|")
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  clientPagamentosList.innerHTML = "";

  const card = document.createElement("article");
  card.className = "decor-card";

  card.innerHTML = `
    <div class="decor-tag">Resumo das parcelas</div>
    <div class="decor-title">${partes.length} parcela(s) combinadas</div>
  ";

  const ul = document.createElement("ul");
  ul.style.marginTop = "8px";
  ul.style.fontSize = "0.85rem";
  ul.style.color = "var(--muted)";
  ul.style.paddingLeft = "18px";

  partes.forEach((txt) => {
    const li = document.createElement("li");
    li.textContent = txt;
    ul.appendChild(li);
  });

  card.appendChild(ul);
  clientPagamentosList.appendChild(card);
}

// ===== Parcelas detalhadas (tabela parcelas) para o cliente =====
async function loadClientParcelas(clienteId) {
  if (!clientPagamentosList) return;

  const { data, error } = await supabase
    .from("parcelas")
    .select("numero, tipo, data_venc, status")
    .eq("cliente_id", clienteId)
    .order("data_venc", { ascending: true });

  if (error) {
    console.error("Erro ao carregar parcelas do cliente:", error);
    const msg = document.createElement("p");
    msg.className = "status error";
    msg.textContent = "Erro ao carregar as parcelas.";
    clientPagamentosList.appendChild(msg);
    return;
  }

  if (!data || !data.length) {
    const msg = document.createElement("p");
    msg.className = "hint";
    msg.textContent =
      "Ainda não há parcelas registradas individualmente. A equipe Lorentz pode atualizar isso pelo app ADM.";
    clientPagamentosList.appendChild(msg);
    return;
  }

  const list = document.createElement("div");
  list.style.marginTop = "10px";
  list.style.display = "flex";
  list.style.flexDirection = "column";
  list.style.gap = "6px";

  data.forEach((parc) => {
    const row = document.createElement("div");
    row.style.display = "flex";
    row.style.justifyContent = "space-between";
    row.style.fontSize = "0.8rem";

    let dataBr = parc.data_venc;
    try {
      if (parc.data_venc) {
        dataBr = new Date(parc.data_venc).toLocaleDateString("pt-BR");
      }
    } catch (_) {
      /* mantém valor original em caso de erro */
    }

    const statusLabel = parc.status || "aberta";

    row.innerHTML = `
      <span>${parc.numero}ª parcela - ${parc.tipo || "Meio de pagamento"} - vencimento ${dataBr}</span>
      <span>${statusLabel}</span>
    `;
    list.appendChild(row);
  });

  clientPagamentosList.appendChild(list);
}

// ===== Área do cliente: carregar orçamentos / contratos para o usuário logado =====
async function loadClientOrcamentosForUser(user) {
  if (!clientOrcamentosList) return;

  clientOrcamentosList.innerHTML =
    "<p class='hint'>Carregando informações do seu evento...</p>";
  if (clientPagamentosList) {
    clientPagamentosList.innerHTML =
      "<p class='hint'>Carregando informações de pagamento...</p>";
  }

  const email = user.email;
  if (!email) {
    clientOrcamentosList.innerHTML =
      "<p class='status error'>Não foi possível identificar seu e-mail de acesso.</p>";
    if (clientPagamentosList) {
      clientPagamentosList.innerHTML = "";
    }
    return;
  }

  const { data: orcs, error: orcErr } = await supabase
    .from("orcamentos")
    .select(
      "id, valor_total, forma_pagamento, contrato_pdf_url, orcamento_pdf_url, status, cliente_id"
    )
    .eq("email", email)
    .order("id", { ascending: false });

  if (orcErr) {
    console.error("Erro ao carregar orçamentos na área do cliente:", orcErr);
    clientOrcamentosList.innerHTML =
      "<p class='status error'>Erro ao carregar seu orçamento. Tente novamente.</p>";
    if (clientPagamentosList) {
      clientPagamentosList.innerHTML = "";
    }
    return;
  }

  if (!orcs || !orcs.length) {
    clientOrcamentosList.innerHTML =
      "<p class='hint'>Ainda não encontramos nenhum orçamento vinculado a este e-mail. Assim que a equipe Lorentz anexar o orçamento e o contrato, eles aparecerão aqui.</p>";
    if (clientPagamentosList) {
      clientPagamentosList.innerHTML =
        "<p class='hint'>Nenhuma forma de pagamento cadastrada ainda.</p>";
    }
    return;
  }

  // tenta buscar dados do cliente com base no primeiro orçamento
  let cliente = null;
  const primeiro = orcs[0];

  if (primeiro.cliente_id) {
    const { data: clientes, error: cliErr } = await supabase
      .from("clientes")
      .select("id, nome, data_evento, endereco_evento")
      .eq("id", primeiro.cliente_id)
      .limit(1);

    if (cliErr) {
      console.error("Erro ao carregar cliente na área do cliente:", cliErr);
    } else if (clientes && clientes.length) {
      cliente = clientes[0];
    }
  }

  const nomeCliente = cliente?.nome || email;
  const dataEventoTexto = cliente?.data_evento
    ? new Date(cliente.data_evento).toLocaleDateString("pt-BR")
    : "data a definir";

  clientOrcamentosList.innerHTML = "";

  orcs.forEach((orc) => {
    const wrapper = document.createElement("article");
    wrapper.className = "decor-card";

    wrapper.innerHTML = `
      <div class="decor-tag">Orçamento #${orc.id}</div>
      <div class="decor-title">${nomeCliente}</div>
      <p class="hint">
        Evento em: ${dataEventoTexto}
        ${
          cliente?.endereco_evento
            ? " • Local: " + cliente.endereco_evento
            : ""
        }
      </p>
      <p class="hint">
        Status: <strong>${orc.status || "aprovado"}</strong>
        ${
          orc.forma_pagamento
            ? " • Forma de pagamento: " + orc.forma_pagamento
            : ""
        }
      </p>
      <div style="display:flex; flex-wrap:wrap; gap:8px; margin-top:8px;">
        ${
          orc.orcamento_pdf_url
            ? `<a class="btn-secondary btn-small" href="${orc.orcamento_pdf_url}" target="_blank">Ver orçamento em PDF</a>`
            : ""
        }
        ${
          orc.contrato_pdf_url
            ? `<a class="btn-primary btn-small" href="${orc.contrato_pdf_url}" target="_blank">Ver contrato em PDF</a>`
            : ""
        }
      </div>
    `;

    clientOrcamentosList.appendChild(wrapper);
  });

  // Usa o orçamento mais recente para montar o resumo de parcelas
  if (clientPagamentosList) {
    renderPagamentosResumo(primeiro);
    const clientIdForParcels = cliente?.id || primeiro.cliente_id;
    if (clientIdForParcels) {
      await loadClientParcelas(clientIdForParcels);
    }
  }
}

// ===== Inicialização =====
(async () => {
  try {
    const { data } = await supabase.auth.getSession();
    const user = data?.session?.user ?? null;
    await handleSession(user);
  } catch (e) {
    console.error("Erro ao recuperar sessão:", e);
    setLoggedOutUI();
  }

  await loadCatalog("todos");
})();
