// app.js
// Portal Lorentz – Área do Cliente + Cadastro de Interessados
// Funciona em qualquer página, mas só ativa o que existir no HTML atual.

import { supabase } from "./config.js";

// ============================================================================
// Seleção de elementos (podem ser null em algumas páginas)
// ============================================================================

// Header / sessão
const headerSessionText = document.getElementById("header-session-text");
const headerRole = document.getElementById("header-role");
const btnLogout = document.getElementById("btn-logout");

// Login e painel do cliente
const loginSection = document.getElementById("login-section");
const clientSection = document.getElementById("client-section");
const loginForm = document.getElementById("login-form");
const loginStatus = document.getElementById("login-status");

// Cadastro de cliente (visitante)
const clienteCadastroForm = document.getElementById("cliente-cadastro-form");
const clienteCadastroStatus = document.getElementById("cliente-cadastro-status");

// Painel do cliente: orçamentos e pagamentos
const clientOrcamentosList = document.getElementById("client-orcamentos");
const clientPagamentosList = document.getElementById("client-pagamentos");

// ============================================================================
// Helpers de UI
// ============================================================================

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
  return valor.toLocaleString("pt-BR", {
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

// ============================================================================
// Controle de sessão (logado / deslogado)
// ============================================================================

function aplicarEstadoDeslogado() {
  if (headerSessionText) headerSessionText.textContent = "Visitante";
  if (headerRole) {
    headerRole.textContent = "";
    hideElement(headerRole);
  }
  hideElement(btnLogout);

  // Mostra login/cadastro, esconde painel
  showElement(loginSection);
  hideElement(clientSection);

  // Limpa status
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
    showElement(headerRole);
  }

  showElement(btnLogout);

  // Esconde login/cadastro, mostra painel
  hideElement(loginSection);
  showElement(clientSection);
}

// ============================================================================
// Supabase – buscas de dados
// ============================================================================

// Busca o registro do cliente vinculado ao usuário logado (tabela `clientes`)
async function buscarClientePorUserId(userId) {
  try {
    const { data, error } = await supabase
      .from("clientes") // 🔧 se o nome da tabela for outro, ajuste aqui
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (error && error.code !== "PGRST116") {
      console.error("[CLIENTE] Erro ao buscar cliente:", error);
      return null;
    }

    return data || null;
  } catch (err) {
    console.error("[CLIENTE] Erro inesperado ao buscar cliente:", err);
    return null;
  }
}

// Carrega orçamentos do cliente (tabela `orcamentos`)
async function carregarOrcamentos(clienteId) {
  if (!clientOrcamentosList) return;

  clientOrcamentosList.innerHTML =
    '<p class="hint">Carregando informações do seu evento...</p>';

  try {
    const { data, error } = await supabase
      .from("orcamentos") // 🔧 ajuste se o nome for outro
      .select("*")
      .eq("cliente_id", clienteId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[CLIENTE] Erro ao carregar orçamentos:", error);
      clientOrcamentosList.innerHTML =
        '<p class="hint status-error">Não foi possível carregar os orçamentos.</p>';
      return { orcamentos: [], ids: [] };
    }

    const orcamentos = data || [];

    if (!orcamentos.length) {
      clientOrcamentosList.innerHTML =
        '<p class="hint">Ainda não há orçamento aprovado para este cliente.</p>';
      return { orcamentos, ids: [] };
    }

    const ids = orcamentos.map((o) => o.id);
    renderizarOrcamentos(orcamentos);
    return { orcamentos, ids };
  } catch (err) {
    console.error("[CLIENTE] Erro inesperado ao carregar orçamentos:", err);
    clientOrcamentosList.innerHTML =
      '<p class="hint status-error">Erro inesperado ao carregar orçamentos.</p>';
    return { orcamentos: [], ids: [] };
  }
}

function renderizarOrcamentos(orcamentos) {
  if (!clientOrcamentosList) return;

  clientOrcamentosList.innerHTML = "";

  orcamentos.forEach((orc) => {
    const wrapper = document.createElement("div");
    wrapper.className = "orcamento-item";

    const titulo =
      orc.titulo ||
      orc.nome_orcamento ||
      "Orçamento de decoração de festa / evento";

    const valorTotal = formatCurrency(orc.valor_total || orc.valor || 0);
    const status = orc.status || "Em análise";

    // URLs dos PDFs – ajuste os nomes das colunas conforme seu banco
    const urlOrcamento =
      orc.orcamento_pdf_url || orc.url_pdf_orcamento || orc.link_orcamento;
    const urlContrato =
      orc.contrato_pdf_url || orc.url_pdf_contrato || orc.link_contrato;

    wrapper.innerHTML = `
      <h4>${titulo}</h4>
      <p class="hint">
        Valor total do pacote: <strong>${valorTotal}</strong><br />
        Status: <strong>${status}</strong>
      </p>
      <div class="orcamento-links">
        ${
          urlOrcamento
            ? `<a href="${urlOrcamento}" target="_blank" class="btn-link">Ver orçamento (PDF)</a>`
            : `<span class="hint">Orçamento ainda não anexado em PDF.</span>`
        }
        ${
          urlContrato
            ? `<a href="${urlContrato}" target="_blank" class="btn-link">Ver contrato (PDF)</a>`
            : `<span class="hint">Contrato ainda não anexado em PDF.</span>`
        }
      </div>
    `;

    clientOrcamentosList.appendChild(wrapper);
  });
}

// Carrega parcelas/pagamentos (tabela `parcelas`)
async function carregarPagamentos(orcamentoIds) {
  if (!clientPagamentosList) return;

  if (!orcamentoIds || !orcamentoIds.length) {
    clientPagamentosList.innerHTML =
      '<p class="hint">Ainda não há forma de pagamento cadastrada para o seu orçamento.</p>';
    return;
  }

  clientPagamentosList.innerHTML =
    '<p class="hint">Carregando informações de pagamento...</p>';

  try {
    const { data, error } = await supabase
      .from("parcelas") // 🔧 ajuste se o nome for outro
      .select("*")
      .in("orcamento_id", orcamentoIds)
      .order("vencimento", { ascending: true });

    if (error) {
      console.error("[CLIENTE] Erro ao carregar pagamentos:", error);
      clientPagamentosList.innerHTML =
        '<p class="hint status-error">Não foi possível carregar as parcelas.</p>';
      return;
    }

    const parcelas = data || [];
    renderizarPagamentos(parcelas);
  } catch (err) {
    console.error("[CLIENTE] Erro inesperado ao carregar pagamentos:", err);
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
      <th>Forma</th>
      <th>Status</th>
    </tr>
  `;

  const tbody = document.createElement("tbody");

  parcelas.forEach((p) => {
    const tr = document.createElement("tr");

    const numero =
      p.numero_parcela || p.parcela || p.n_parcela || p.id || "-";
    const venc = formatDate(p.vencimento || p.data_vencimento);
    const valor = formatCurrency(p.valor || p.valor_parcela);
    const forma = p.forma_pagamento || p.meio_pagamento || "-";
    const status = p.status_pagamento || p.status || "A vencer";

    tr.innerHTML = `
      <td>${numero}</td>
      <td>${venc}</td>
      <td>${valor}</td>
      <td>${forma}</td>
      <td>${status}</td>
    `;

    tbody.appendChild(tr);
  });

  table.appendChild(thead);
  table.appendChild(tbody);

  clientPagamentosList.innerHTML = "";
  clientPagamentosList.appendChild(table);
}

// Carrega tudo do painel do cliente (cliente + orçamentos + pagamentos)
async function carregarPainelCliente(user) {
  const cliente = await buscarClientePorUserId(user.id);

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

  const { ids: orcamentoIds } = await carregarOrcamentos(cliente.id);
  await carregarPagamentos(orcamentoIds);
}

// ============================================================================
// Autenticação – login / logout
// ============================================================================

async function checarSessaoInicial() {
  try {
    const { data, error } = await supabase.auth.getUser();

    if (error || !data?.user) {
      aplicarEstadoDeslogado();
      return;
    }

    const user = data.user;
    await carregarPainelCliente(user);
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

// ============================================================================
// Cadastro de cliente (visitante) – NÃO cria usuário de login, só registro
// ============================================================================

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

// ============================================================================
// Eventos de formulário / botões
// ============================================================================

function registrarEventos() {
  // Login
  if (loginForm) {
    loginForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      const emailInput = document.getElementById("email");
      const passwordInput = document.getElementById("password");

      const email = emailInput?.value?.trim();
      const password = passwordInput?.value || "";

      if (!email || !password) {
        setStatus(loginStatus, "Informe e-mail e senha para entrar.", "error");
        return;
      }

      await fazerLogin(email, password);
    });
  }

  // Logout
  if (btnLogout) {
    btnLogout.addEventListener("click", async () => {
      await fazerLogout();
    });
  }

  // Cadastro de visitante
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

      // Se existir usuário logado, vincula esse cadastro ao user_id
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
        origem_cadastro: "site_cliente", // opcional, útil pro ADM
      };

      if (userId) {
        payload.user_id = userId; // 🔧 exige coluna user_id em `clientes`
      }

      await cadastrarClienteVisitante(payload);

      // Não limpar tudo pra pessoa ainda ver o que preencheu,
      // mas se quiser, descomente:
      // clienteCadastroForm.reset();
    });
  }
}

// ============================================================================
// Inicialização
// ============================================================================

async function init() {
  aplicarEstadoDeslogado(); // estado padrão
  registrarEventos();
  await checarSessaoInicial();
}

init();
