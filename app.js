// Código principal do portal Lorentz.
// Funciona em QUALQUER página (index, catalogo, cliente):
// só executa o que tiver elementos na página atual.

import { supabase } from "./config.js";

// ===== Seleção de elementos (podem ser null em algumas páginas) =====

// Catálogo
const catalogoGrid = document.getElementById("catalogo-grid");
const catalogTabs = document.querySelectorAll(".catalog-tab");

// Login / sessão
const loginForm = document.getElementById("login-form");
const loginStatus = document.getElementById("login-status");

const loginSection = document.getElementById("login-section");
const adminSection = document.getElementById("admin-section");
const clientSection = document.getElementById("client-section");

// Header
const headerSessionText = document.getElementById("header-session-text");
const headerRole = document.getElementById("header-role");
const btnLogout = document.getElementById("btn-logout");

// Área do cliente (painel do usuário)
const clientOrcamentosList = document.getElementById("client-orcamentos");
const clientPagamentosList = document.getElementById("client-pagamentos");

// Admin: cadastro de decoração
const formDecor = document.getElementById("form-decor");
const decorCategoria = document.getElementById("decor-categoria");
const decorTitulo = document.getElementById("decor-titulo");
const decorDescricao = document.getElementById("decor-descricao");
const decorImagem = document.getElementById("decor-imagem");
const decorStatus = document.getElementById("decor-status");

// Modal do catálogo (usado em catalogo.html)
const decorModal = document.getElementById("decor-modal");
const decorModalClose = document.getElementById("decor-modal-close");
const decorModalContent = document.getElementById("decor-modal-content");

// Admin: gestão de clientes
const adminClientesList = document.getElementById("admin-clientes-list");
const adminClienteDetalhe = document.getElementById("admin-cliente-detalhe");
const clienteNomeTitulo = document.getElementById("cliente-nome-titulo");
const clienteInfoBasica = document.getElementById("cliente-info-basica");

// Cadastro de clientes (admin + visitante)
const adminClienteForm = document.getElementById("admin-cliente-form");
const adminClienteStatus = document.getElementById("admin-cliente-status");
const clienteCadastroForm = document.getElementById("cliente-cadastro-form");
const clienteCadastroStatus = document.getElementById("cliente-cadastro-status");

const formDocumentos = document.getElementById("form-documentos");
const orcamentoPdfInput = document.getElementById("orcamento-pdf");
const contratoPdfInput = document.getElementById("contrato-pdf");
const documentosStatus = document.getElementById("documentos-status");
const btnResetSenha = document.getElementById("btn-reset-senha");

// NOVOS campos para forma de pagamento parcelada
const formaQtdInput = document.getElementById("forma-qtd");
const parcelasContainer = document.getElementById("parcelas-container");
const formaPreview = document.getElementById("forma-preview");

let clienteSelecionado = null;
let orcamentoAtual = null;

// ===== UI de sessão =====
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
    await loadAdminClientes();
  } else {
    setClientUI(name);
    await loadClientOrcamentosForUser(user);
  }
}



// ===== Cadastro de clientes (admin e visitante) =====

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

// Listener do formulário de cadastro do ADM
if (adminClienteForm) {
  adminClienteForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = buildClientePayload("admin-");
    await inserirCliente(payload, adminClienteStatus);
    if (!adminClienteStatus.className.includes("error")) {
      adminClienteForm.reset();
      // recarrega a lista de clientes no painel ADM
      if (typeof loadAdminClientes === "function") {
        await loadAdminClientes();
      }
    }
  });
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
      '<div class="decor-desc">Use o painel do administrador para cadastrar seus cenários.</div>';
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
      decorStatus.textContent =
        "Erro ao salvar decoração: " + decoError.message;
      decorStatus.className = "status error";
      return;
    }

    const decoracaoId = decoData.id;
    let capaUrl = null;
    let imagensSalvas = 0;
    let errosImagens = 0;

    if (files && files.length > 0) {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const ext = file.name.split(".").pop();
        const unique = `${Date.now()}-${i}-${Math.random()
          .toString(36)
          .substring(2, 8)}`;
        const path = `${decoracaoId}/${unique}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("decoracoes")
          .upload(path, file);

        if (uploadError) {
          console.error("Erro ao enviar imagem:", uploadError);
          errosImagens++;
          continue;
        }

        const { data: publicData } = supabase.storage
          .from("decoracoes")
          .getPublicUrl(path);
        const publicUrl = publicData.publicUrl;

        if (!capaUrl) {
          capaUrl = publicUrl;
        }

        const { error: imgError } = await supabase
          .from("decoracao_imagens")
          .insert({
            decoracao_id: decoracaoId,
            titulo,
            url: publicUrl,
            ordem: i,
          })
          .select("id")
          .single();

        if (imgError) {
          console.error("Erro ao salvar imagem no banco:", imgError);
          errosImagens++;
        } else {
          imagensSalvas++;
        }
      }
    }

    if (capaUrl) {
      await supabase
        .from("decoracoes")
        .update({ imagem_url: capaUrl, capa_url: capaUrl })
        .eq("id", decoracaoId);
    }

    if (errosImagens > 0 && imagensSalvas === 0) {
      decorStatus.textContent =
        "Decoração criada, mas houve erro ao salvar todas as imagens. Veja o console para detalhes.";
      decorStatus.className = "status error";
    } else if (errosImagens > 0 && imagensSalvas > 0) {
      decorStatus.textContent =
        `Decoração criada. ${imagensSalvas} imagem(ns) salva(s), ${errosImagens} com erro. Veja o console.`;
      decorStatus.className = "status";
    } else if (imagensSalvas > 0) {
      decorStatus.textContent = "Decoração cadastrada com sucesso!";
      decorStatus.className = "status ok";
    } else {
      decorStatus.textContent =
        "Decoração cadastrada sem imagens. Você selecionou arquivos?";
      decorStatus.className = "status";
    }

    formDecor.reset();

    const activeTab = document.querySelector(".catalog-tab.active");
    const currentCat = activeTab ? activeTab.dataset.categoria : "todos";
    await loadCatalog(currentCat);
  });
}

// ===== Gestão de clientes (admin) =====
async function loadAdminClientes() {
  if (!adminClientesList) return;

  adminClientesList.innerHTML = "<p class='hint'>Carregando clientes...</p>";

  const { data, error } = await supabase
    .from("clientes")
    .select(
      "id, nome, email, telefone, documento, data_evento, endereco_evento"
    )
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Erro ao carregar clientes:", error);
    adminClientesList.innerHTML =
      "<p class='status error'>Erro ao carregar clientes: " +
      error.message +
      "</p>";
    return;
  }

  if (!data || data.length === 0) {
    adminClientesList.innerHTML =
      "<p class='hint'>Nenhum cliente cadastrado ainda.</p>";
    return;
  }

  adminClientesList.innerHTML = "";
  data.forEach((cli) => {
    const card = document.createElement("div");
    card.className = "cliente-card";

    card.innerHTML = `
      <div class="cliente-card-main">
        <strong>${cli.nome || "Sem nome"}</strong>
        <span>${cli.email || ""}</span>
        <span>${cli.telefone || ""}</span>
      </div>
      <button class="btn-secondary btn-small">Gerenciar</button>
    `;

    const btn = card.querySelector("button");
    btn.addEventListener("click", () => {
      abrirDetalheCliente(cli);
    });

    adminClientesList.appendChild(card);
  });
}

async function abrirDetalheCliente(cli) {
  clienteSelecionado = cli;
  orcamentoAtual = null;

  if (!adminClienteDetalhe) return;

  adminClienteDetalhe.classList.remove("hidden");

  if (clienteNomeTitulo) {
    clienteNomeTitulo.textContent = cli.nome || "Cliente sem nome";
  }

  if (clienteInfoBasica) {
    const linhas = [];
    if (cli.email) linhas.push("E-mail: " + cli.email);
    if (cli.telefone) linhas.push("Telefone: " + cli.telefone);
    if (cli.data_evento) linhas.push("Data do evento: " + cli.data_evento);
    if (cli.endereco_evento) linhas.push("Local: " + cli.endereco_evento);

    clienteInfoBasica.textContent = linhas.join(" • ");
  }

  if (documentosStatus) {
    documentosStatus.textContent = "";
    documentosStatus.className = "status";
  }

  // reset padrão da forma de pagamento
  if (formaQtdInput) formaQtdInput.value = "1";
  if (parcelasContainer) parcelasContainer.innerHTML = "";
  if (formaPreview) {
    formaPreview.textContent =
      "Selecione o número de parcelas; depois defina a forma e a data de cada uma.";
  }

  buildParcelasUI();
  await loadOrcamentoCliente(cli.id);
}

async function loadOrcamentoCliente(clienteId) {
  const { data, error } = await supabase
    .from("orcamentos")
    .select(
      "id, valor_total, forma_pagamento, contrato_pdf_url, orcamento_pdf_url"
    )
    .eq("cliente_id", clienteId)
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    console.error("Erro ao carregar orçamento:", error);
  }

  orcamentoAtual = data || null;

  if (orcamentoAtual && formaPreview) {
    formaPreview.textContent = orcamentoAtual.forma_pagamento
      ? `Forma atual: ${orcamentoAtual.forma_pagamento}`
      : "Forma de pagamento ainda não informada.";
  }
}

// ===== Forma de pagamento parcelada (1ª Pix, 2ª Cartão, etc.) =====
function buildParcelasUI() {
  if (!parcelasContainer || !formaQtdInput) return;

  const qtd = parseInt(formaQtdInput.value || "0", 10);
  parcelasContainer.innerHTML = "";

  if (!qtd || qtd <= 0) {
    if (formaPreview) {
      formaPreview.textContent =
        "Selecione o número de parcelas; depois escolha a forma e a data de cada uma.";
    }
    return;
  }

  for (let i = 1; i <= qtd; i++) {
    const row = document.createElement("div");
    row.className = "form-row parcela-row";

    row.innerHTML = `
      <label style="font-weight:600; margin-bottom:4px;">Parcela ${i}</label>
      <div class="form-row">
        <select class="parcela-tipo">
          <option value="">Meio de pagamento...</option>
          <option value="Pix">Pix</option>
          <option value="Boleto">Boleto</option>
          <option value="Cartão">Cartão</option>
        </select>
      </div>
      <div class="form-row">
        <input type="date" class="parcela-data" />
      </div>
    `;

    parcelasContainer.appendChild(row);
  }

  parcelasContainer
    .querySelectorAll("select, input")
    .forEach((el) => el.addEventListener("change", updateFormaPreview));

  updateFormaPreview();
}

function getFormaPagamentoTexto() {
  if (!formaQtdInput || !parcelasContainer) return "";

  const qtd = parseInt(formaQtdInput.value || "0", 10);
  if (!qtd || qtd <= 0) return "";

  const rows = parcelasContainer.querySelectorAll(".parcela-row");
  const partes = [];

  rows.forEach((row, idx) => {
    const tipoEl = row.querySelector(".parcela-tipo");
    const dataEl = row.querySelector(".parcela-data");

    const tipo = tipoEl && tipoEl.value;
    const data = dataEl && dataEl.value;

    if (!tipo || !data) return;

    const [ano, mes, dia] = data.split("-");
    const dataBr = `${dia}/${mes}/${ano}`;
    const num = idx + 1;

    partes.push(`${num}ª parcela: ${tipo} - ${dataBr}`);
  });

  if (partes.length === 0) return "";

  return partes.join(" | ");
}

function updateFormaPreview() {
  if (!formaPreview) return;
  const txt = getFormaPagamentoTexto();
  formaPreview.textContent = txt
    ? `Forma de pagamento definida: ${txt}`
    : "Selecione a forma e a data de cada parcela.";
}

if (formaQtdInput) {
  formaQtdInput.addEventListener("change", buildParcelasUI);
}

// ===== Parcelas: gravação na tabela "parcelas" =====
async function salvarParcelas(orcamentoId, clienteId) {
  if (!parcelasContainer || !formaQtdInput) return;

  const rows = parcelasContainer.querySelectorAll(".parcela-row");
  const payload = [];

  rows.forEach((row, idx) => {
    const tipoEl = row.querySelector(".parcela-tipo");
    const dataEl = row.querySelector(".parcela-data");

    const tipo = tipoEl?.value;
    const data = dataEl?.value; // AAAA-MM-DD

    if (!tipo || !data) return; // ignora linhas incompletas

    payload.push({
      orcamento_id: orcamentoId,
      cliente_id: clienteId,
      numero: idx + 1,
      tipo,
      data_venc: data,
      status: "aberta",
    });
  });

  // Remove parcelas antigas desse orçamento e recria
  await supabase.from("parcelas").delete().eq("orcamento_id", orcamentoId);

  if (!payload.length) return;

  const { error } = await supabase.from("parcelas").insert(payload);
  if (error) {
    console.error("Erro ao salvar parcelas:", error);
  }
}

// ===== formulário de documentos (contrato, orçamento, forma de pagamento) =====
if (formDocumentos) {
  formDocumentos.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!clienteSelecionado || !documentosStatus) return;

    documentosStatus.textContent = "Salvando documentos...";
    documentosStatus.className = "status";

    const formaTexto = getFormaPagamentoTexto();

    let orc = orcamentoAtual;
    if (!orc) {
      const { data, error } = await supabase
        .from("orcamentos")
        .insert({
          cliente_id: clienteSelecionado.id,
          email: clienteSelecionado.email || null,
          valor_total: null,
          forma_pagamento: formaTexto || null,
          status: "aprovado",
        })
        .select("id, forma_pagamento")
        .single();

      if (error) {
        console.error("Erro ao criar orçamento:", error);
        documentosStatus.textContent =
          "Erro ao criar orçamento: " + error.message;
        documentosStatus.className = "status error";
        return;
      }
      orc = data;
      orcamentoAtual = orc;
    } else {
      await supabase
        .from("orcamentos")
        .update({ forma_pagamento: formaTexto || null })
        .eq("id", orc.id);
    }

    // Salva/atualiza parcelas na tabela "parcelas"
    try {
      await salvarParcelas(orc.id, clienteSelecionado.id);
    } catch (err) {
      console.error("Erro ao salvar parcelas:", err);
    }

    const atualizacoes = {};

    // Upload orçamento aprovado
    if (orcamentoPdfInput && orcamentoPdfInput.files[0]) {
      const file = orcamentoPdfInput.files[0];
      const path = `${clienteSelecionado.id}/orcamento-${Date.now()}.pdf`;

      const { error: upErr } = await supabase.storage
        .from("documentos")
        .upload(path, file, { upsert: true });

      if (upErr) {
        console.error("Erro ao enviar orçamento PDF:", upErr);
      } else {
        const { data: pub } = supabase.storage
          .from("documentos")
          .getPublicUrl(path);
        atualizacoes.orcamento_pdf_url = pub.publicUrl;
      }
    }

    // Upload contrato assinado
    if (contratoPdfInput && contratoPdfInput.files[0]) {
      const file = contratoPdfInput.files[0];
      const path = `${clienteSelecionado.id}/contrato-${Date.now()}.pdf`;

      const { error: upErr } = await supabase.storage
        .from("documentos")
        .upload(path, file, { upsert: true });

      if (upErr) {
        console.error("Erro ao enviar contrato PDF:", upErr);
      } else {
        const { data: pub } = supabase.storage
          .from("documentos")
          .getPublicUrl(path);
        atualizacoes.contrato_pdf_url = pub.publicUrl;
      }
    }

    atualizacoes.forma_pagamento = formaTexto || null;

    const { error: updErr } = await supabase
      .from("orcamentos")
      .update(atualizacoes)
      .eq("id", orc.id);

    if (updErr) {
      console.error("Erro ao salvar dados:", updErr);
      documentosStatus.textContent =
        "Erro ao salvar dados: " + updErr.message;
      documentosStatus.className = "status error";
      return;
    }

    if (orcamentoPdfInput) orcamentoPdfInput.value = "";
    if (contratoPdfInput) contratoPdfInput.value = "";

    documentosStatus.textContent = "Dados salvos na conta da cliente.";
    documentosStatus.className = "status ok";
  });
}

// botão de redefinição de senha
if (btnResetSenha) {
  btnResetSenha.addEventListener("click", async () => {
    if (!clienteSelecionado || !clienteSelecionado.email) {
      alert("Selecione uma cliente que tenha e-mail cadastrado.");
      return;
    }

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        clienteSelecionado.email,
        {
          redirectTo: window.location.origin + "/cliente.html",
        }
      );

      if (error) {
        console.error("Erro ao enviar reset de senha:", error);
        alert("Erro ao enviar e-mail de redefinição de senha.");
        return;
      }

      alert(
        "E-mail de redefinição de senha enviado para " +
          clienteSelecionado.email
      );
    } catch (e) {
      console.error(e);
      alert("Erro inesperado ao enviar e-mail de redefinição.");
    }
  });
}

// ===== Resumo das parcelas na área do cliente (com base no texto) =====
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
  `;

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
  renderPagamentosResumo(primeiro);
}

// ===== Inicialização =====
(async () => {
  const { data } = await supabase.auth.getSession();
  const user = data?.session?.user ?? null;
  await handleSession(user);

  await loadCatalog("todos");
})();
