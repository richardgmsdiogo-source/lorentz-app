/*
  Arquivo de lógica principal para o site Lorentz Decorações. Este
  módulo é carregado como "type=module" no index.html e contém todo o
  comportamento interactivo: comunicação com o Supabase, gestão de sessões
  (login/logout), carregamento do catálogo, painéis do cliente e do
  administrador, e submissão de formulários para criar decorações, planos,
  clientes, contratos e pagamentos.

  Para utilizar este script em seu próprio projecto, certifique‑se de
  preencher as constantes SUPABASE_URL e SUPABASE_ANON_KEY com as
  credenciais do seu projecto no painel da Supabase. Não exponha
  chaves secretas (service key) aqui.
*/

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// CONFIGURAÇÃO SUPABASE – substituir pelos seus valores
const SUPABASE_URL = 'https://tsdrlbkrkjaxzpdxtmoa.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzZHJsYmtya2pheHpwZHh0bW9hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIxMjY0NjYsImV4cCI6MjA3NzcwMjQ2Nn0.Jx0ot29QIb2bi-wcTL6T69J6oBHoEFbR237Rtf3MO0g';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Referências a elementos DOM
const catalogGrid = document.getElementById('catalog-grid');
const categoryNav = document.getElementById('category-nav');
const sessionUser = document.getElementById('session-user');
const sessionRole = document.getElementById('session-role');
const btnLogout = document.getElementById('btn-logout');

const loginArea = document.getElementById('login-area');
const loginForm = document.getElementById('login-form');
const loginStatus = document.getElementById('login-status');

const clientArea = document.getElementById('client-area');
const clientInfo = document.getElementById('client-info');

const adminArea = document.getElementById('admin-area');
const adminNav = document.getElementById('admin-nav');

// Admin panels
const panelDecor = document.getElementById('panel-decor');
const panelPlan = document.getElementById('panel-plan');
const panelClient = document.getElementById('panel-client');
const panelContract = document.getElementById('panel-contract');
const panelPayment = document.getElementById('panel-payment');

// Admin forms
const formDecor = document.getElementById('form-decor');
const decorCategory = document.getElementById('decor-category');
const decorTitle = document.getElementById('decor-title');
const decorDescription = document.getElementById('decor-description');
const decorStatus = document.getElementById('decor-status');

const formPlan = document.getElementById('form-plan');
const planName = document.getElementById('plan-name');
const planDescription = document.getElementById('plan-description');
const planValue = document.getElementById('plan-value');
const planStatus = document.getElementById('plan-status');

const formClient = document.getElementById('form-client');
const clientNameInput = document.getElementById('client-name');
const clientEmailInput = document.getElementById('client-email');
const clientPasswordInput = document.getElementById('client-password');
const clientPhoneInput = document.getElementById('client-phone');
const clientDocInput = document.getElementById('client-doc');
const clientStatus = document.getElementById('client-status');

const formContract = document.getElementById('form-contract');
const contractClientSelect = document.getElementById('contract-client');
const contractPlanSelect = document.getElementById('contract-plan');
const contractDate = document.getElementById('contract-date');
const contractLocation = document.getElementById('contract-location');
const contractTotal = document.getElementById('contract-total');
const contractStatusMsg = document.getElementById('contract-status');

const formPayment = document.getElementById('form-payment');
const paymentContractSelect = document.getElementById('payment-contract');
const paymentParcelInput = document.getElementById('payment-parcel');
const paymentValueInput = document.getElementById('payment-value');
const paymentDueInput = document.getElementById('payment-due');
const paymentStatusMsg = document.getElementById('payment-status');

// Lista de categorias disponíveis. Pode ser expandida conforme cadastra
// novos tipos de decoração. A primeira entrada "Todas" carrega tudo.
const CATEGORIES = ['Todas', 'Casamento', 'Aniversário', '15 anos', 'Infantil'];

// Função para desenhar as abas de categoria
function renderCategories() {
  categoryNav.innerHTML = '';
  CATEGORIES.forEach((cat) => {
    const btn = document.createElement('button');
    btn.className = 'category-btn';
    btn.textContent = cat;
    btn.dataset.category = cat;
    btn.addEventListener('click', () => {
      const currentActive = categoryNav.querySelector('.category-btn.active');
      if (currentActive) currentActive.classList.remove('active');
      btn.classList.add('active');
      loadCatalog(cat);
    });
    // Por padrão, a categoria "Todas" fica activa
    if (cat === 'Todas') btn.classList.add('active');
    categoryNav.appendChild(btn);
  });
}

// Carregar catálogo a partir de Supabase com base na categoria seleccionada
async function loadCatalog(category) {
  catalogGrid.innerHTML = '';
  // Mostrar indicador de carregamento
  const loading = document.createElement('p');
  loading.textContent = 'Carregando...';
  loading.style.fontSize = '0.9rem';
  loading.style.color = 'var(--muted)';
  catalogGrid.appendChild(loading);

  let query = supabase
    .from('decoracoes')
    .select('id, categoria, titulo, descricao, ativo')
    .eq('ativo', true)
    .order('id', { ascending: false });
  if (category && category !== 'Todas') {
    query = query.eq('categoria', category);
  }
  const { data, error } = await query;

  catalogGrid.innerHTML = '';
  if (error) {
    const errCard = document.createElement('div');
    errCard.className = 'product-card';
    errCard.innerHTML = `<div class="product-title">Erro ao carregar catálogo</div><div class="product-desc">${error.message}</div>`;
    catalogGrid.appendChild(errCard);
    return;
  }
  if (!data || data.length === 0) {
    const emptyCard = document.createElement('div');
    emptyCard.className = 'product-card';
    emptyCard.innerHTML = `<div class="product-title">Sem itens cadastrados</div><div class="product-desc">Use a área do administrador para inserir decorações.</div>`;
    catalogGrid.appendChild(emptyCard);
    return;
  }
  data.forEach((item) => {
    const card = document.createElement('div');
    card.className = 'product-card';
    card.innerHTML = `
      <div class="product-category">${item.categoria || 'Evento'}</div>
      <div class="product-title">${item.titulo}</div>
      <div class="product-desc">${item.descricao || ''}</div>
    `;
    catalogGrid.appendChild(card);
  });
}

// Actualizar a interface consoante o estado da sessão
async function handleSession(user) {
  if (!user) {
    // Sessão nula: mostrar visitante
    sessionUser.textContent = 'Visitante';
    sessionRole.classList.add('hidden');
    btnLogout.classList.add('hidden');
    loginArea.classList.remove('hidden');
    clientArea.classList.add('hidden');
    adminArea.classList.add('hidden');
    return;
  }
  // Buscar o perfil associado ao user.id
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('name, role')
    .eq('id', user.id)
    .maybeSingle();
  if (error) {
    console.error('Erro ao carregar perfil:', error);
    return;
  }
  const displayName = profile?.name || user.email;
  sessionUser.textContent = displayName;
  sessionRole.textContent = profile?.role || '';
  sessionRole.classList.remove('hidden');
  btnLogout.classList.remove('hidden');
  loginArea.classList.add('hidden');
  // Dependendo do role, mostrar área do cliente ou admin
  if (profile?.role === 'admin') {
    clientArea.classList.add('hidden');
    adminArea.classList.remove('hidden');
    sessionRole.textContent = 'ADMIN';
    // Inicializa navegação admin e seleccionar painel inicial
    setupAdminNav();
  } else {
    adminArea.classList.add('hidden');
    clientArea.classList.remove('hidden');
    sessionRole.textContent = 'CLIENTE';
    // Carrega dados do cliente
    await renderClientInfo(user);
  }
}

// Carregar info do cliente: contratos e pagamentos
async function renderClientInfo(user) {
  clientInfo.innerHTML = '';
  const loading = document.createElement('p');
  loading.textContent = 'Carregando seus contratos...';
  loading.style.fontSize = '0.9rem';
  loading.style.color = 'var(--muted)';
  clientInfo.appendChild(loading);
  // Busca contratos do cliente e inclui planos e pagamentos relacionados
  const { data, error } = await supabase
    .from('contratos')
    .select(
      `id, data_evento, local_evento, status, valor_total, planos(nome, valor_mensal), pagamentos(id, parcela, valor, vencimento, status)`
    )
    .eq('cliente_id', user.id);
  clientInfo.innerHTML = '';
  if (error) {
    const err = document.createElement('p');
    err.className = 'status-msg error';
    err.textContent = 'Erro ao carregar contratos: ' + error.message;
    clientInfo.appendChild(err);
    return;
  }
  if (!data || data.length === 0) {
    const msg = document.createElement('p');
    msg.className = 'status-msg';
    msg.textContent = 'Nenhum contrato encontrado.';
    clientInfo.appendChild(msg);
    return;
  }
  data.forEach((contrato) => {
    const card = document.createElement('div');
    card.className = 'client-card';
    const eventoDate = contrato.data_evento ? new Date(contrato.data_evento) : null;
    const dateStr = eventoDate ? eventoDate.toLocaleDateString('pt-BR') : '';
    card.innerHTML = `
      <h4>${contrato.planos?.nome || 'Plano'}</h4>
      <p>Evento: ${dateStr} ${contrato.local_evento ? ' - ' + contrato.local_evento : ''}</p>
      <p>Status: ${contrato.status}</p>
      ${contrato.valor_total ? `<p>Valor Total: R$ ${contrato.valor_total.toFixed(2)}</p>` : ''}
    `;
    // Lista de pagamentos
    if (contrato.pagamentos && contrato.pagamentos.length > 0) {
      const paymentList = document.createElement('div');
      paymentList.style.marginTop = '6px';
      contrato.pagamentos.forEach((pag) => {
        const vencDate = pag.vencimento ? new Date(pag.vencimento) : null;
        const vencStr = vencDate ? vencDate.toLocaleDateString('pt-BR') : '';
        const payLine = document.createElement('p');
        payLine.style.fontSize = '0.75rem';
        payLine.innerHTML = `Parcela ${pag.parcela}: R$ ${pag.valor.toFixed(2)} – Vencimento: ${vencStr} – <strong>${pag.status}</strong>`;
        paymentList.appendChild(payLine);
      });
      card.appendChild(paymentList);
    }
    clientInfo.appendChild(card);
  });
}

// Configurar navegação do administrador
function setupAdminNav() {
  // Adiciona listener em cada botão de navegação
  const navButtons = adminNav.querySelectorAll('.admin-nav-btn');
  navButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      // Alterna classe activa
      navButtons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const target = btn.dataset.target;
      showAdminPanel(target);
    });
  });
  // Selecciona painel inicial
  navButtons[0].classList.add('active');
  showAdminPanel(navButtons[0].dataset.target);
  // Prepara select de contratos ao abrir painel de pagamento
}

// Mostrar apenas o painel alvo e ocultar os outros
function showAdminPanel(targetId) {
  const panels = [panelDecor, panelPlan, panelClient, panelContract, panelPayment];
  panels.forEach((p) => {
    if (p.id === targetId) p.classList.remove('hidden');
    else p.classList.add('hidden');
  });
  // Se o painel for contrato ou pagamento, atualizar selects
  if (targetId === 'panel-contract') {
    populateContractSelects();
  } else if (targetId === 'panel-payment') {
    populatePaymentContracts();
  }
}

// Popula selects de clientes e planos para contratos
async function populateContractSelects() {
  // Limpar selects
  contractClientSelect.innerHTML = '';
  contractPlanSelect.innerHTML = '';
  // Carregar clientes
  const { data: clients, error: clientsErr } = await supabase
    .from('clientes')
    .select('id, nome');
  if (clientsErr) {
    contractClientSelect.innerHTML = `<option value="">Erro</option>`;
  } else {
    const defaultOpt = document.createElement('option');
    defaultOpt.value = '';
    defaultOpt.textContent = 'Selecione';
    contractClientSelect.appendChild(defaultOpt);
    clients.forEach((cl) => {
      const opt = document.createElement('option');
      opt.value = cl.id;
      opt.textContent = cl.nome;
      contractClientSelect.appendChild(opt);
    });
  }
  // Carregar planos
  const { data: plans, error: plansErr } = await supabase
    .from('planos')
    .select('id, nome');
  if (plansErr) {
    contractPlanSelect.innerHTML = `<option value="">Erro</option>`;
  } else {
    const defaultOpt2 = document.createElement('option');
    defaultOpt2.value = '';
    defaultOpt2.textContent = 'Selecione';
    contractPlanSelect.appendChild(defaultOpt2);
    plans.forEach((pl) => {
      const opt = document.createElement('option');
      opt.value = pl.id;
      opt.textContent = pl.nome;
      contractPlanSelect.appendChild(opt);
    });
  }
}

// Popula select de contratos para pagamentos
async function populatePaymentContracts() {
  paymentContractSelect.innerHTML = '';
  const { data: contracts, error } = await supabase
    .from('contratos')
    .select('id, data_evento, local_evento');
  if (error) {
    paymentContractSelect.innerHTML = `<option value="">Erro</option>`;
    return;
  }
  const defaultOpt = document.createElement('option');
  defaultOpt.value = '';
  defaultOpt.textContent = 'Selecione';
  paymentContractSelect.appendChild(defaultOpt);
  contracts.forEach((co) => {
    const opt = document.createElement('option');
    opt.value = co.id;
    const dateStr = co.data_evento ? new Date(co.data_evento).toLocaleDateString('pt-BR') : '';
    opt.textContent = `#${co.id} - ${dateStr}`;
    paymentContractSelect.appendChild(opt);
  });
}

// SUBMISSÃO DE FORMULÁRIOS ADMIN

// Decoração
formDecor.addEventListener('submit', async (e) => {
  e.preventDefault();
  decorStatus.textContent = '';
  const title = decorTitle.value.trim();
  if (!title) {
    decorStatus.textContent = 'Informe pelo menos o título.';
    decorStatus.className = 'status-msg error';
    return;
  }
  decorStatus.textContent = 'Salvando...';
  decorStatus.className = 'status-msg';
  const { error } = await supabase.from('decoracoes').insert({
    categoria: decorCategory.value.trim() || null,
    titulo: title,
    descricao: decorDescription.value.trim() || null,
    ativo: true,
  });
  if (error) {
    decorStatus.textContent = 'Erro ao salvar: ' + error.message;
    decorStatus.className = 'status-msg error';
  } else {
    decorStatus.textContent = 'Decoração cadastrada com sucesso!';
    decorStatus.className = 'status-msg ok';
    decorCategory.value = '';
    decorTitle.value = '';
    decorDescription.value = '';
    // Recarrega catálogo mantendo categoria activa
    const activeBtn = categoryNav.querySelector('.category-btn.active');
    const currentCat = activeBtn ? activeBtn.dataset.category : 'Todas';
    loadCatalog(currentCat);
  }
});

// Plano
formPlan.addEventListener('submit', async (e) => {
  e.preventDefault();
  planStatus.textContent = '';
  const name = planName.value.trim();
  if (!name) {
    planStatus.textContent = 'Informe o nome do plano.';
    planStatus.className = 'status-msg error';
    return;
  }
  planStatus.textContent = 'Salvando...';
  planStatus.className = 'status-msg';
  const valueNum = planValue.value ? parseFloat(planValue.value) : null;
  const { error } = await supabase.from('planos').insert({
    nome: name,
    descricao: planDescription.value.trim() || null,
    valor_mensal: valueNum,
  });
  if (error) {
    planStatus.textContent = 'Erro ao salvar: ' + error.message;
    planStatus.className = 'status-msg error';
  } else {
    planStatus.textContent = 'Plano cadastrado com sucesso!';
    planStatus.className = 'status-msg ok';
    planName.value = '';
    planDescription.value = '';
    planValue.value = '';
  }
});

// Cliente
formClient.addEventListener('submit', async (e) => {
  e.preventDefault();
  clientStatus.textContent = '';
  const nameVal = clientNameInput.value.trim();
  const emailVal = clientEmailInput.value.trim();
  const passVal = clientPasswordInput.value.trim();
  if (!nameVal || !emailVal || !passVal) {
    clientStatus.textContent = 'Preencha nome, e‑mail e senha.';
    clientStatus.className = 'status-msg error';
    return;
  }
  clientStatus.textContent = 'Criando usuário...';
  clientStatus.className = 'status-msg';
  // Tenta criar o utilizador no Auth via signUp (envia email de confirmação)
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email: emailVal,
    password: passVal,
  });
  if (signUpError) {
    clientStatus.textContent = 'Erro ao criar usuário: ' + signUpError.message;
    clientStatus.className = 'status-msg error';
    return;
  }
  const userId = signUpData?.user?.id;
  if (!userId) {
    clientStatus.textContent = 'Não foi possível obter o ID do usuário criado.';
    clientStatus.className = 'status-msg error';
    return;
  }
  // Inserir na tabela profiles e clientes
  const { error: profileError } = await supabase.from('profiles').insert({
    id: userId,
    name: nameVal,
    role: 'client',
  });
  const { error: clientError } = await supabase.from('clientes').insert({
    id: userId,
    nome: nameVal,
    telefone: clientPhoneInput.value.trim() || null,
    documento: clientDocInput.value.trim() || null,
  });
  if (profileError || clientError) {
    clientStatus.textContent = 'Erro ao registrar cliente: ' + (profileError?.message || clientError?.message);
    clientStatus.className = 'status-msg error';
    return;
  }
  clientStatus.textContent = 'Cliente cadastrado com sucesso! O cliente deve verificar o e‑mail para confirmar a conta.';
  clientStatus.className = 'status-msg ok';
  // Limpar campos
  clientNameInput.value = '';
  clientEmailInput.value = '';
  clientPasswordInput.value = '';
  clientPhoneInput.value = '';
  clientDocInput.value = '';
});

// Contrato
formContract.addEventListener('submit', async (e) => {
  e.preventDefault();
  contractStatusMsg.textContent = '';
  const clientId = contractClientSelect.value;
  const planId = contractPlanSelect.value;
  if (!clientId || !planId) {
    contractStatusMsg.textContent = 'Selecione cliente e plano.';
    contractStatusMsg.className = 'status-msg error';
    return;
  }
  contractStatusMsg.textContent = 'Salvando contrato...';
  contractStatusMsg.className = 'status-msg';
  const totalVal = contractTotal.value ? parseFloat(contractTotal.value) : null;
  const { error } = await supabase.from('contratos').insert({
    cliente_id: clientId,
    plano_id: planId,
    data_evento: contractDate.value || null,
    local_evento: contractLocation.value.trim() || null,
    valor_total: totalVal,
    status: 'ativo',
  });
  if (error) {
    contractStatusMsg.textContent = 'Erro ao salvar: ' + error.message;
    contractStatusMsg.className = 'status-msg error';
  } else {
    contractStatusMsg.textContent = 'Contrato cadastrado com sucesso!';
    contractStatusMsg.className = 'status-msg ok';
    contractClientSelect.value = '';
    contractPlanSelect.value = '';
    contractDate.value = '';
    contractLocation.value = '';
    contractTotal.value = '';
    // Atualizar selects para pagamentos caso seja necessário
    populatePaymentContracts();
  }
});

// Pagamento
formPayment.addEventListener('submit', async (e) => {
  e.preventDefault();
  paymentStatusMsg.textContent = '';
  const contractId = paymentContractSelect.value;
  const parcelaNum = paymentParcelInput.value;
  const valorNum = paymentValueInput.value;
  const vencDateVal = paymentDueInput.value;
  if (!contractId || !parcelaNum || !valorNum || !vencDateVal) {
    paymentStatusMsg.textContent = 'Preencha todos os campos.';
    paymentStatusMsg.className = 'status-msg error';
    return;
  }
  paymentStatusMsg.textContent = 'Salvando parcela...';
  paymentStatusMsg.className = 'status-msg';
  const { error } = await supabase.from('pagamentos').insert({
    contrato_id: contractId,
    parcela: parseInt(parcelaNum),
    valor: parseFloat(valorNum),
    vencimento: vencDateVal,
    status: 'pendente',
  });
  if (error) {
    paymentStatusMsg.textContent = 'Erro ao salvar: ' + error.message;
    paymentStatusMsg.className = 'status-msg error';
  } else {
    paymentStatusMsg.textContent = 'Parcela cadastrada com sucesso!';
    paymentStatusMsg.className = 'status-msg ok';
    paymentContractSelect.value = '';
    paymentParcelInput.value = '';
    paymentValueInput.value = '';
    paymentDueInput.value = '';
  }
});

// LOGIN
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginStatus.textContent = '';
  loginStatus.className = 'status-msg';
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  if (!email || !password) {
    loginStatus.textContent = 'Informe e‑mail e senha.';
    loginStatus.className = 'status-msg error';
    return;
  }
  loginStatus.textContent = 'Autenticando...';
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    loginStatus.textContent = 'Erro ao entrar: ' + error.message;
    loginStatus.className = 'status-msg error';
    return;
  }
  const user = data.user;
  if (!user) {
    loginStatus.textContent = 'Usuário não encontrado.';
    loginStatus.className = 'status-msg error';
    return;
  }
  loginStatus.textContent = 'Login realizado com sucesso!';
  loginStatus.className = 'status-msg ok';
  await handleSession(user);
});

// LOGOUT
btnLogout.addEventListener('click', async () => {
  await supabase.auth.signOut();
  handleSession(null);
});

// Monitorar alterações de sessão
supabase.auth.onAuthStateChange(async (_event, session) => {
  await handleSession(session?.user || null);
});

// Execução inicial
(async function init() {
  renderCategories();
  await loadCatalog('Todas');
  // Verifica sessão inicial
  const { data } = await supabase.auth.getSession();
  const user = data?.session?.user;
  await handleSession(user || null);
})();