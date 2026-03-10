// ==================== CONFIGURAÇÃO SUPABASE ====================
const SB_URL = "https://vcyrcjayfjueshnffzoc.supabase.co";
const SB_KEY = "sb_publishable_E7U5H2QdRT20-Il8LZrlhg_2FnEx2Qk";
const supabaseClient = window.supabase.createClient(SB_URL, SB_KEY);
// ✅ DOMÍNIO REAL DO NETLIFY - SEM ESPAÇOS!
const BASE_URL = "https://portal-etevalda-pro.vercel.app";
// ✅ ENTREGADORES COM NÚMEROS REAIS (55+DDD+NUMERO)
const DELIVERERS = {
  '5565992512338': { name: 'Santiago', phone: '5565992512338' },
  '5565992038306': { name: 'Raielle', phone: '5565992038306' },
  '5566999168711': { name: 'Sidimar', phone: '5566999168711' },
  '5566996952171': { name: 'Ginaldo', phone: '5566996952171' },
  '5565992022295': { name: 'Valdicleia', phone: '5565992022295' },
};

let orders = [], pendingPurchases = [], financeEntries = [];
let reportUnlocked = false, currentEditId = null, currentDeleteId = null;

// ==================== INICIALIZAÇÃO - VERIFICA URL PARA MODO ENTREGADOR ====================
document.addEventListener('DOMContentLoaded', async () => {
  console.log('🚀 App iniciado. URL:', window.location.href);
  
  // ✅ VERIFICA SE EXISTE ID NA URL (?id=UUID)
  const urlParams = new URLSearchParams(window.location.search);
  const pedidoId = urlParams.get('id')?.trim();
  
  console.log('🔍 Parâmetro ID da URL:', pedidoId);
  
  if (pedidoId && isValidUUID(pedidoId)) {
    console.log('✅ UUID válido detectado. Modo entregador ativado.');
    // MODO ENTREGADOR: carrega tela de rota
    document.getElementById('adminPanel').classList.add('hidden');
    document.getElementById('deliveryPage').classList.add('active');
    await loadDeliveryPage(pedidoId);
  } else {
    console.log('🔧 Modo admin ativado (sem ID válido na URL)');
    // MODO ADMIN: carrega painel normal
    setupTabs();
    setupRealtimeSubscription();
    await loadData();
    startPendingAlertChecker();
    setDefaultDates();
  }
});

// ✅ VALIDA FORMATO DE UUID
function isValidUUID(uuid) {
  if (!uuid) {
    console.log('❌ UUID vazio ou null');
    return false;
  }
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const isValid = uuidRegex.test(uuid.trim());
  console.log('🔍 Validação UUID:', uuid, '=>', isValid);
  return isValid;
}

// ==================== PÁGINA DE ROTA DO ENTREGADOR ====================
async function loadDeliveryPage(orderId) {
  const content = document.getElementById('deliveryContent');
  console.log('📥 loadDeliveryPage chamada com ID:', orderId);
  
  content.innerHTML = '<div class="delivery-loading"><div class="spinner"></div><p>Carregando dados da entrega...</p></div>';
  
  try {
    console.log('🔎 Buscando pedido no Supabase. Tabela: pedidos, ID:', orderId);
    
    // ✅ BUSCA NA TABELA 'pedidos' (em português)
    const { data: order, error } = await supabaseClient
      .from('pedidos')
      .select('*')
      .eq('id', orderId)
      .maybeSingle();
    
    console.log('📦 Resposta do Supabase:', { order, error });
    
    if (error) {
      console.error('❌ Erro do Supabase:', error);
      content.innerHTML = `<div class="delivery-error"><i class="fas fa-exclamation-triangle"></i><h3>Erro de conexão</h3><p style="margin-top:0.5rem">${error.message || 'Verifique sua internet.'}</p></div>`;
      return;
    }
    
    if (!order) {
      console.error('❌ Pedido NÃO ENCONTRADO no banco. ID:', orderId);
      content.innerHTML = `
        <div class="delivery-error">
          <i class="fas fa-exclamation-triangle"></i>
          <h3>Pedido não encontrado</h3>
          <p style="margin-top:0.5rem">O pedido pode ter sido excluído ou o link está incorreto.</p>
          <p style="margin-top:0.5rem;font-size:0.8rem;color:var(--gray-600)">ID buscado: ${orderId}</p>
          <button class="btn btn-primary btn-sm" style="margin-top:1rem;" onclick="window.location.href='${BASE_URL}'">Voltar ao Painel</button>
        </div>`;
      return;
    }
    
    console.log('✅ Pedido encontrado:', order.client_name);
    
    // ✅ RENDERIZA PÁGINA DE ROTA COM DADOS
    content.innerHTML = `
      <div class="delivery-card">
        <div class="delivery-header">
          <div class="logo"><i class="fas fa-gem"></i> Etevalda Joias</div>
          <div class="subtitle">🚚 Rota de Entrega</div>
        </div>
        <div class="delivery-info">
          <div class="delivery-label"><i class="fas fa-user"></i> Cliente</div>
          <div class="delivery-value client-name">${escapeHtml(order.client_name || '—')}</div>
        </div>
        <div class="delivery-info">
          <div class="delivery-label"><i class="fas fa-box-open"></i> Pedido</div>
          <div class="delivery-value products">${escapeHtml(order.products || '—')}</div>
        </div>
        ${order.total_value ? `<div class="delivery-info"><div class="delivery-label"><i class="fas fa-dollar-sign"></i> Valor Total</div><div class="delivery-value total">${order.total_value}</div></div>` : ''}
        ${order.observations && order.observations.trim() ? `<div class="delivery-info"><div class="delivery-label"><i class="fas fa-sticky-note"></i> Observações</div><div class="delivery-value observations">${escapeHtml(order.observations)}</div></div>` : ''}
        <div class="delivery-actions">
          ${order.location_url ? `<a href="${order.location_url}" target="_blank" class="delivery-btn map"><i class="fas fa-map-marker-alt"></i> VER NO MAPA</a>` : ''}
          <button class="delivery-btn" onclick="openClientWhatsApp('${order.client_phone}', '${escapeJs(order.client_name)}', '${escapeJs(order.products || '')}', '${escapeJs(order.observations || '')}', '${escapeJs(order.entregador_responsavel || '')}')"><i class="fab fa-whatsapp"></i> FALAR COM CLIENTE</button>
        </div>
      </div>
    `;
    
  } catch (err) {
    console.error('💥 Erro crítico em loadDeliveryPage:', err);
    content.innerHTML = `<div class="delivery-error"><i class="fas fa-exclamation-triangle"></i><h3>Erro ao carregar</h3><p style="margin-top:0.5rem">Tente recarregar a página.</p><details style="margin-top:0.5rem;font-size:0.8rem;"><summary>Detalhes do erro</summary><pre>${err.message || err}</pre></details></div>`;
  }
}

// ✅ Abre WhatsApp do cliente com mensagem completa - URL CORRIGIDA
function openClientWhatsApp(clientPhone, clientName, products, observations, delivererName) {
  if (!delivererName || delivererName === '') {
    for (const [phone, data] of Object.entries(DELIVERERS)) {
      if (clientPhone.includes(phone.replace('55', '')) || phone.includes(clientPhone.replace('55', ''))) {
        delivererName = data.name;
        break;
      }
    }
  }
  if (!delivererName || delivererName === '') {
    delivererName = 'Entregador';
  }
  
  let message = `Olá, sou Entregador ${delivererName} da Etevalda Joias.\n\n`;
  message += `Pedido:\n${products}\n\n`;
  if (observations && observations.trim() !== '') {
    message += `OBS:\n${observations}\n\n`;
  }
  message += `Já estou com sua localização e saindo para entrega!`;
  
  const cleanPhone = clientPhone.replace(/\D/g, '');
  const fullPhone = cleanPhone.startsWith('55') ? cleanPhone : '55' + cleanPhone;
  // ✅ URL CORRIGIDA: sem espaços após "phone="
  const url = `https://api.whatsapp.com/send?phone=${fullPhone}&text=${encodeURIComponent(message)}`;
  window.open(url, '_blank');
}

// ==================== FUNÇÕES DO ADMIN ====================
function setupTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      if (tab === 'report' && !reportUnlocked) {
        const pwd = prompt('Digite a senha para acessar o relatório:');
        if (pwd !== '4444') { showToast('❌ Senha incorreta', 'error'); return; }
        reportUnlocked = true;
      }
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
      btn.classList.add('active');
      document.getElementById(`tab-${tab}`).classList.remove('hidden');
      if (tab === 'report') renderFinanceTable();
    });
  });
}

async function loadData() {
  try {
    await loadOrders();
    await loadPendingPurchases();
    await loadFinanceEntries();
    renderAllLists();
    updateStats();
    checkPendingAlerts();
  } catch (error) {
    console.error('Erro ao carregar dados:', error);
    showToast('⚠️ Erro ao sincronizar com o banco de dados', 'error');
  }
}

async function loadOrders() {
  const { data, error } = await supabaseClient
    .from('pedidos')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) { console.error('Erro ao carregar pedidos:', error); showToast('⚠️ Erro ao carregar pedidos', 'error'); return; }
  orders = data || [];
}

async function loadPendingPurchases() {
  const { data, error } = await supabaseClient
    .from('pending_purchases')
    .select('*')
    .order('purchase_date', { ascending: true });
  if (error) { console.error('Erro ao carregar pendentes:', error); return; }
  pendingPurchases = data || [];
}

async function loadFinanceEntries() {
  const { data, error } = await supabaseClient
    .from('finance_entries')
    .select('*')
    .order('date', { ascending: false });
  if (error) { console.error('Erro ao carregar financeiro:', error); return; }
  financeEntries = data || [];
}

function setupRealtimeSubscription() {
  supabaseClient.channel('public:pedidos')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, () => {
      const urlParams = new URLSearchParams(window.location.search);
      if (!urlParams.get('id')) loadData();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'pending_purchases' }, () => {
      const urlParams = new URLSearchParams(window.location.search);
      if (!urlParams.get('id')) loadData();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'finance_entries' }, () => {
      const urlParams = new URLSearchParams(window.location.search);
      if (!urlParams.get('id')) loadData();
    })
    .subscribe(status => {
      if (status === 'SUBSCRIBED') {
        document.getElementById('connectionStatus').innerHTML = '<i class="fas fa-circle" style="font-size:0.5rem;"></i> Online';
        document.getElementById('connectionStatus').className = 'badge badge-delivered';
      } else if (status === 'CHANNEL_ERROR') {
        document.getElementById('connectionStatus').innerHTML = '<i class="fas fa-circle" style="font-size:0.5rem;"></i> Offline';
        document.getElementById('connectionStatus').className = 'badge badge-cancelled';
        showToast('⚠️ Conexão em tempo real falhou', 'warning');
      }
    });
}

async function refreshData(evt) {
  const btn = evt?.currentTarget;
  if (!btn) { await loadData(); return; }
  const originalText = btn.innerHTML;
  btn.innerHTML = '<span class="loading"><span class="spinner-small"></span> Atualizando...</span>';
  btn.disabled = true;
  await loadData();
  setTimeout(() => { btn.innerHTML = originalText; btn.disabled = false; }, 500);
}

// ==================== RENDERING COM REGRA DE 24 HORAS ====================
function renderAllLists() { renderTodayList(); renderCompletedList(); renderPendingList(); renderFinanceTable(); }

function getTodayOrders() {
  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  return orders.filter(o => new Date(o.created_at) >= twentyFourHoursAgo);
}

function getCompletedOrders() {
  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  return orders.filter(o => new Date(o.created_at) < twentyFourHoursAgo);
}

function renderTodayList() {
  const container = document.getElementById('todayList');
  const query = document.getElementById('todaySearch').value.toLowerCase();
  const filtered = getTodayOrders().filter(o => o.client_name.toLowerCase().includes(query) || o.client_phone.includes(query));
  document.getElementById('todayCount').textContent = `${filtered.length} pedidos`;
  if (filtered.length === 0) { container.innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i><p>Nenhum pedido nas últimas 24h</p></div>'; return; }
  container.innerHTML = filtered.map(o => createOrderCard(o)).join('');
}

function renderCompletedList() {
  const container = document.getElementById('completedList');
  const query = document.getElementById('completedSearch').value.toLowerCase();
  const filtered = getCompletedOrders().filter(o => o.client_name.toLowerCase().includes(query) || o.client_phone.includes(query));
  document.getElementById('completedCount').textContent = `${filtered.length} pedidos`;
  if (filtered.length === 0) { container.innerHTML = '<div class="empty-state"><i class="fas fa-history"></i><p>Nenhum pedido antigo</p></div>'; return; }
  container.innerHTML = filtered.map(o => createOrderCard(o)).join('');
}

function createOrderCard(order) {
  const statusBadge = { pending: '<span class="badge badge-pending">⏳ Pendente</span>', 'en_route': '<span class="badge badge-en-route">🚚 Em Rota</span>', delivered: '<span class="badge badge-delivered">✅ Entregue</span>', cancelled: '<span class="badge badge-cancelled">❌ Cancelado</span>' }[order.status] || '<span class="badge badge-pending">📋 Em andamento</span>';
  return `<div class="order-item" onclick="openEditModal('${order.id}')"><div class="order-item-header"><div><div class="order-client">${escapeHtml(order.client_name)}</div><a href="${generateWhatsAppLink(order.client_phone, order.client_name)}" target="_blank" class="order-phone" onclick="event.stopPropagation()"><i class="fab fa-whatsapp"></i> ${formatPhone(order.client_phone)}</a></div>${statusBadge}</div><div class="order-products">${escapeHtml(order.products)}</div><div class="order-meta"><span><i class="fas fa-calendar"></i> ${formatDateBR(order.created_at)}</span>${order.total_value ? `<span class="order-value">${order.total_value}</span>` : ''}</div><div class="order-actions" onclick="event.stopPropagation()"><button class="btn btn-outline btn-sm" onclick="openEditModal('${order.id}')">✏️ Editar</button><button class="btn btn-danger btn-sm" onclick="confirmDelete('${order.id}')">🗑️ Excluir</button></div></div>`;
}

function renderPendingList() {
  const container = document.getElementById('pendingList');
  const today = new Date().toDateString();
  if (pendingPurchases.length === 0) { container.innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i><p>Nenhum pendente cadastrado</p></div>'; return; }
  container.innerHTML = pendingPurchases.map(p => {
    const pd = new Date(p.purchase_date);
    const isDueToday = pd.toDateString() === today && p.status === 'pending';
    const whatsappLink = generateWhatsAppLink(p.client_phone, p.client_name, 'Olá, ficamos combinado pra hoje. Estamos confirmando sua entrega!');
    return `<div class="order-item ${isDueToday ? 'blink-alert' : ''}"><div class="order-item-header"><div><div class="order-client">${escapeHtml(p.client_name)}</div><a href="${whatsappLink}" target="_blank" class="order-phone"><i class="fab fa-whatsapp"></i> ${formatPhone(p.client_phone)}</a></div><span class="badge badge-pending">📅 Pendente</span></div><div class="order-meta"><span><i class="fas fa-calendar"></i> ${formatDateBR(p.purchase_date)}</span>${p.purchase_time ? `<span><i class="fas fa-clock"></i> ${p.purchase_time}</span>` : ''}</div><div class="order-products">${escapeHtml(p.conversation_summary || '—')}</div><div class="order-actions"><button class="btn btn-outline btn-sm" onclick="editPending('${p.id}')">✏️ Editar</button><button class="btn btn-danger btn-sm" onclick="confirmDelete('pending_purchases', '${p.id}')">🗑️ Excluir</button><a href="${whatsappLink}" target="_blank" class="btn btn-success btn-sm">💬 Confirmar</a></div></div>`;
  }).join('');
}

function renderFinanceTable() {
  const tbody = document.getElementById('financeTableBody');
  if (!tbody) return;
  if (!financeEntries.length) { tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:1rem;">Nenhum registro financeiro</td></tr>'; return; }
  tbody.innerHTML = financeEntries.map(entry => {
    const invested = parseFloat(entry.invested || 0), returned = parseFloat(entry.returned || 0), profit = typeof entry.profit === 'number' ? entry.profit : (returned - invested);
    return `<tr><td>${formatDateBR(entry.date)}</td><td>${formatCurrency(invested)}</td><td>${formatCurrency(returned)}</td><td>${formatCurrency(profit)}</td></tr>`;
  }).join('');
}

// ==================== SISTEMA DE ALERTA DE PENDENTES - CORRIGIDO ====================
function startPendingAlertChecker() { checkPendingAlerts(); setInterval(checkPendingAlerts, 30000); }

// ✅ FUNÇÃO CORRIGIDA: Verifica se CASOU data E horário
function checkPendingAlerts() {
  const now = new Date();
  const today = now.toDateString();
  
  // Filtra pendentes que venceram (data E horário já passaram)
  const dueNow = pendingPurchases.filter(p => {
    if (p.status !== 'pending') return false;
    
    const pd = new Date(p.purchase_date);
    const purchaseDateStr = pd.toDateString();
    
    // Verifica se a data já chegou
    const dateHasArrived = purchaseDateStr === today || pd < now;
    
    // Se tem horário definido, verifica se já passou
    if (p.purchase_time && p.purchase_time.trim() !== '') {
      const [hours, minutes] = p.purchase_time.split(':').map(Number);
      pd.setHours(hours, minutes, 0, 0);
      
      // Só considera vencido se data E horário já passaram
      return dateHasArrived && pd <= now;
    }
    
    // Se não tem horário, considera vencido só pela data
    return dateHasArrived;
  });
  
  const alertEl = document.getElementById('pendingAlert'), 
        alertCount = document.getElementById('alertCount');
  
  if (dueNow.length > 0) { 
    alertEl.classList.remove('hidden'); 
    alertCount.textContent = dueNow.length; 
  } else { 
    alertEl.classList.add('hidden'); 
  }
}

function openPendingAccordionFromAlert() {
  const content = document.getElementById('pendingAccordionContent'), 
        icon = document.getElementById('pendingAccordionIcon');
  if (!content) return;
  if (content.classList.contains('hidden')) { 
    content.classList.remove('hidden'); 
    if (icon) { icon.classList.remove('fa-chevron-down'); icon.classList.add('fa-chevron-up'); } 
  }
  content.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ==================== EXTRAÇÃO E GERAÇÃO DE LINK ====================
async function handleExtract() {
  const conversation = document.getElementById('extractConversation').value.trim();
  if (!conversation) { showToast('⚠️ Por favor, cole a conversa com o cliente', 'warning'); return; }
  const extracted = extractEtevaldaOrder(conversation);
  document.getElementById('extClientName').value = extracted.clientName || '';
  document.getElementById('extClientPhone').value = extracted.clientPhone || '';
  document.getElementById('extProducts').value = extracted.products || '';
  document.getElementById('extPayment').value = extracted.paymentMethod || '';
  document.getElementById('extValue').value = extracted.totalValue || '';
  document.getElementById('extObservations').value = extracted.observations || '';
  document.getElementById('extractedFields').classList.remove('hidden');
  updateSendButton();
  showToast('✅ Dados extraídos! Revise e edite se necessário', 'success');
}

function extractEtevaldaOrder(conversation) {
  const lines = conversation.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  let result = { clientName: '', clientPhone: '', products: '', paymentMethod: '', totalValue: '', observations: '' };
  
  // Telefone literal
  const phonePattern = /55\d{10,11}/g;
  const phones = conversation.match(phonePattern);
  if (phones && phones.length > 0) { result.clientPhone = phones[phones.length - 1]; }
  
  // Nome do cliente
  const pedidoNameMatch = conversation.match(/pedido\s+([A-ZÁ-ÚÃÕÇ][a-zá-úãõç]+(?:\s+[A-ZÁ-ÚÃÕÇ][a-zá-úãõç]+)*)/i);
  if (pedidoNameMatch && pedidoNameMatch[1]) { result.clientName = pedidoNameMatch[1].trim(); }
  
  if (!result.clientName) {
    for (let i = 0; i < Math.min(10, lines.length); i++) {
      const line = lines[i], lower = line.toLowerCase();
      if (/(nome|chamo|me chamo|sou)/i.test(lower)) {
        const nameMatch = line.match(/[:\-]?\s*([A-ZÁ-ÚÃÕÇ][a-zá-úãõç]+(?:\s+[A-ZÁ-ÚÃÕÇ][a-zá-úãõç]+)*)/);
        if (nameMatch && nameMatch[1] && nameMatch[1].length > 2 && nameMatch[1].length < 40) {
          result.clientName = nameMatch[1].trim(); break;
        }
      }
    }
  }
  
  // Bloco de pedido
  const pedidoBlocks = [];
  let currentBlock = null, inPedidoBlock = false;
  
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    const pedidoMatch = line.match(/^pedido\s+([A-ZÁ-ÚÃÕÇ][a-zá-úãõç\s]+)?$/i);
    
    if (pedidoMatch) {
      if (currentBlock && currentBlock.items.length > 0) {
        pedidoBlocks.unshift({ clientName: currentBlock.clientName, items: [...currentBlock.items], total: currentBlock.total, rawBlock: currentBlock.rawBlock });
      }
      inPedidoBlock = true;
      currentBlock = { clientName: pedidoMatch[1]?.trim() || '', items: [], total: '', rawBlock: [line] };
      continue;
    }
    
    if (inPedidoBlock && currentBlock) {
      currentBlock.rawBlock.unshift(line);
      
      if (/total\s*[:\-]?/i.test(line.toLowerCase()) && line.includes('✅')) {
        const totalMatch = line.match(/(\d{1,3}(?:\.\d{3})*,\d{2})/);
        if (totalMatch) { currentBlock.total = totalMatch[1]; }
        if (currentBlock.items.length > 0) {
          pedidoBlocks.unshift({ clientName: currentBlock.clientName, items: [...currentBlock.items], total: currentBlock.total, rawBlock: currentBlock.rawBlock });
        }
        inPedidoBlock = false; currentBlock = null; continue;
      }
      
      if (line.includes(':') && /r\$?\s*\d+,\d{2}/i.test(line)) {
        const [label, value] = line.split(':', 2);
        if (label.trim() && value.trim() && !/^total/i.test(label.trim())) {
          currentBlock.items.unshift(`${label.trim()}:${value.trim()}`);
        }
      } else if (/r\$?\s*\d+,\d{2}/i.test(line) && line.length < 80 && !/^\d/.test(line) && !/^(ok|obrigado|valeu|flw|tchau)/i.test(line)) {
        currentBlock.items.unshift(line.trim());
      }
    }
  }
  
  if (currentBlock && currentBlock.items.length > 0) {
    pedidoBlocks.unshift({ clientName: currentBlock.clientName, items: [...currentBlock.items], total: currentBlock.total, rawBlock: currentBlock.rawBlock });
  }
  
  const lastPedido = pedidoBlocks[0];
  
  if (lastPedido) {
    if (lastPedido.clientName && isLikelyHumanName(lastPedido.clientName)) { result.clientName = lastPedido.clientName; }
    
    if (lastPedido.rawBlock && lastPedido.rawBlock.length > 0) {
      result.products = lastPedido.rawBlock.join('\n');
    } else if (lastPedido.items.length > 0) {
      result.products = lastPedido.items.join('\n');
      if (lastPedido.total) { result.products += `\n----------------\nTotal : ${lastPedido.total} ✅`; }
    }
    
    if (lastPedido.total) { result.totalValue = lastPedido.total; }
  }
  
  if (!result.products || result.products.trim() === '') { result.products = extractFallbackProducts(lines); }
  
  // Forma de pagamento
  const paymentKeywords = [
    { pattern: /pix/i, value: 'PIX' },
    { pattern: /cartão de crédito|cartao de credito|credito/i, value: 'Cartão de crédito' },
    { pattern: /cartão de débito|cartao de debito|debito/i, value: 'Cartão de débito' },
    { pattern: /dinheiro|espécie|especie/i, value: 'Dinheiro' },
    { pattern: /boleto/i, value: 'Boleto' },
    { pattern: /à vista|a vista/i, value: 'À vista' },
    { pattern: /parcelado|parcela/i, value: 'Parcelado no cartão' }
  ];
  
  for (let i = lines.length - 1; i >= 0; i--) {
    for (const kw of paymentKeywords) {
      if (kw.pattern.test(lines[i])) { result.paymentMethod = kw.value; break; }
    }
    if (result.paymentMethod) break;
  }
  
  // Observações
  const obsLines = lines.filter(l => 
    /(rua|avenida|bairro|perto de|ao lado|entregar|horário|horario|após|depois)/i.test(l) && 
    !/pagamento|total|pix|cartão|dinheiro/i.test(l)
  );
  if (obsLines.length > 0) result.observations = obsLines.slice(0, 2).join('\n');
  
  return result;
}

function extractFallbackProducts(lines) {
  const currencyPattern = /(r\$?\s*\d{1,3}(\.\d{3})*,\d{2})|(\d+,\d{2})/i;
  const items = [];
  const tail = lines.slice(-15);
  for (const line of tail) {
    if (line.includes(':') && currencyPattern.test(line) && !/^total/i.test(line)) {
      const [label, value] = line.split(':', 2);
      if (label.trim() && value.trim()) { items.push(`${label.trim()}: ${value.trim()}`); }
    } else if (currencyPattern.test(line) && line.length < 80 && !/^\d/.test(line)) {
      items.push(line.trim());
    }
  }
  
  if (items.length > 0) { return items.join('\n'); }
  return 'Produto não identificado - revisar conversa';
}

function updateSendButton() {
  const selectedDeliverer = document.getElementById('selectedDeliverer').value;
  const btn = document.getElementById('sendToDelivererBtn');
  if (selectedDeliverer && DELIVERERS[selectedDeliverer]) {
    btn.innerHTML = `<i class="fas fa-rocket"></i> 🚀 ENVIAR PARA ${DELIVERERS[selectedDeliverer].name.toUpperCase()}`;
  } else {
    btn.innerHTML = `<i class="fas fa-rocket"></i> 🚀 ENVIAR PARA ENTREGADOR`;
  }
}

document.addEventListener('change', (e) => { if (e.target.id === 'selectedDeliverer') updateSendButton(); });

// ✅ handleGenerateLink: CORREÇÃO DEFINITIVA - Gera link com ?id= que FUNCIONA
async function handleGenerateLink() {
  const selectedDeliverer = document.getElementById('selectedDeliverer').value;
  if (!selectedDeliverer) { showToast('⚠️ Selecione um entregador antes de gerar o link', 'warning'); return; }
  
  const clientName = document.getElementById('extClientName').value.trim();
  const clientPhone = document.getElementById('extClientPhone').value.trim();
  const products = document.getElementById('extProducts').value.trim();
  const paymentMethod = document.getElementById('extPayment').value.trim();
  const totalValue = document.getElementById('extValue').value.trim();
  const observations = document.getElementById('extObservations').value.trim();
  const locationUrl = document.getElementById('extLocation').value.trim();
  
  if (!clientPhone || !products) { showToast('⚠️ Preencha Telefone e Produtos', 'warning'); return; }
  
  try {
    console.log('💾 Salvando pedido na tabela "pedidos"...');
    
    // ✅ INSERT COM .select() PARA RETORNAR OS DADOS DO REGISTRO INSERIDO
    const { data, error: insertError } = await supabaseClient
      .from('pedidos')  // ✅ TABELA EM PORTUGUÊS
      .insert([{
        client_name: clientName,
        client_phone: formatPhoneForDB(clientPhone),
        products: products,
        payment_method: paymentMethod,
        total_value: totalValue,
        observations: observations,
        location_url: locationUrl,
        entregador_responsavel: DELIVERERS[selectedDeliverer]?.name || '',
        status: 'pending',
        created_at: new Date().toISOString()
      }])
      .select();  // ✅ RETORNA OS DADOS DO INSERT
    
    if (insertError) { 
      console.error('❌ Erro ao salvar:', insertError); 
      showToast('❌ Erro ao salvar: ' + insertError.message, 'error'); 
      return; 
    }
    
    // ✅ CAPTURA O PRIMEIRO ITEM DO ARRAY RETORNADO
    const novoPedido = data?.[0];
    console.log('✅ Pedido salvo. Dados retornados:', novoPedido);
    
    if (!novoPedido || !novoPedido.id) {
      console.error('❌ ID não foi retornado pelo banco');
      showToast('⚠️ Pedido salvo, mas ID não capturado', 'warning');
      return;
    }
    
    // ✅ GERA LINK COM ?id= (PRIORITÁRIO) - CORRIGIDO
    const routeLink = `${BASE_URL}/?id=${novoPedido.id}`;
    const textToCopy = `👇 Entrega\nCliente: ${clientName}\n${routeLink}`;
    
    document.getElementById('linkOutput').textContent = textToCopy;
    document.getElementById('generatedLinkSection').classList.remove('hidden');
    
    // ✅ ABRIR WHATSAPP DO ENTREGADOR
    const whatsappUrl = `https://api.whatsapp.com/send?phone=55${selectedDeliverer}&text=${encodeURIComponent(textToCopy)}`;
    window.open(whatsappUrl, '_blank');
    
    // Limpar formulário
    document.getElementById('extractConversation').value = '';
    document.getElementById('extractedFields').classList.add('hidden');
    
    showToast('✅ Link gerado e WhatsApp aberto!', 'success');
    await loadData();
    
  } catch (err) { 
    console.error('💥 Erro crítico em handleGenerateLink:', err); 
    showToast('❌ Falha na conexão com o banco', 'error'); 
  }
}

function copyGeneratedLink() {
  const text = document.getElementById('linkOutput').textContent;
  navigator.clipboard.writeText(text);
  showToast('📋 Texto copiado!', 'success');
}

// ==================== PENDENTES DE COMPRA ====================
async function extractPendingData() {
  const conversation = document.getElementById('pendingConversation').value.trim();
  if (!conversation) { showToast('⚠️ Cole a conversa primeiro', 'warning'); return; }
  const extracted = extractEtevaldaOrder(conversation);
  document.getElementById('pendingClientName').value = extracted.clientName || '';
  document.getElementById('pendingClientPhone').value = extracted.clientPhone || '';
  document.getElementById('pendingSummary').value = formatSummaryInPortuguese(extracted.observations || extracted.products);
  document.getElementById('pendingExtractedFields').classList.remove('hidden');
  showToast('✅ Dados extraídos! Edite se necessário antes de salvar', 'success');
}

function formatSummaryInPortuguese(text) { 
  return text.replace(/([.!?])\s*/g, '$1\n').replace(/\n{3,}/g, '\n').trim(); 
}

function togglePendingAccordion() {
  const content = document.getElementById('pendingAccordionContent'), 
        icon = document.getElementById('pendingAccordionIcon');
  if (!content) return;
  const isHidden = content.classList.contains('hidden');
  if (isHidden) { 
    content.classList.remove('hidden'); 
    if (icon) { icon.classList.remove('fa-chevron-down'); icon.classList.add('fa-chevron-up'); } 
  } else { 
    content.classList.add('hidden'); 
    if (icon) { icon.classList.remove('fa-chevron-up'); icon.classList.add('fa-chevron-down'); } 
  }
}

async function savePendingPurchase() {
  const clientName = document.getElementById('pendingClientName').value.trim();
  const clientPhone = document.getElementById('pendingClientPhone').value.trim();
  const purchaseDate = document.getElementById('pendingPurchaseDate').value;
  const purchaseTime = document.getElementById('pendingPurchaseTime').value;
  const conversationSummary = document.getElementById('pendingSummary').value.trim();
  
  if (!clientName || !clientPhone || !purchaseDate) { showToast('⚠️ Preencha Nome, Telefone e Data', 'warning'); return; }
  
  try {
    const { error } = await supabaseClient.from('pending_purchases').insert([{
      client_name: clientName,
      client_phone: formatPhoneForDB(clientPhone),
      purchase_date: purchaseDate,
      purchase_time: purchaseTime,
      conversation_summary: conversationSummary,
      status: 'pending',
      created_at: new Date().toISOString()
    }]);
    
    if (error) { console.error('Erro ao salvar pendente:', error); showToast('❌ Erro ao salvar: ' + error.message, 'error'); return; }
    
    document.getElementById('pendingConversation').value = '';
    document.getElementById('pendingExtractedFields').classList.add('hidden');
    showToast('✅ Pendente SALVO no banco com sucesso!', 'success');
    await loadData();
  } catch (err) { console.error('Erro crítico ao salvar:', err); showToast('❌ Falha na conexão com o banco de dados', 'error'); }
}

// ==================== MODAL DE EDIÇÃO ====================
function openEditModal(orderId) {
  const order = orders.find(o => o.id === orderId);
  if (!order) return;
  
  currentEditId = orderId;
  document.getElementById('editOrderId').value = orderId;
  document.getElementById('editClientName').value = order.client_name || '';
  document.getElementById('editClientPhone').value = order.client_phone || '';
  document.getElementById('editProducts').value = order.products || '';
  document.getElementById('editPayment').value = order.payment_method || '';
  document.getElementById('editValue').value = order.total_value || '';
  document.getElementById('editStatus').value = order.status || 'pending';
  document.getElementById('editObservations').value = order.observations || '';
  
  document.getElementById('editOrderModal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeEditModal() {
  document.getElementById('editOrderModal').classList.add('hidden');
  document.body.style.overflow = '';
  currentEditId = null;
}

async function saveEditOrder() {
  if (!currentEditId) return;
  
  const data = {
    client_name: document.getElementById('editClientName').value.trim(),
    client_phone: formatPhoneForDB(document.getElementById('editClientPhone').value.trim()),
    products: document.getElementById('editProducts').value.trim(),
    payment_method: document.getElementById('editPayment').value.trim(),
    total_value: document.getElementById('editValue').value.trim(),
    status: document.getElementById('editStatus').value,
    observations: document.getElementById('editObservations').value.trim(),
    updated_at: new Date().toISOString()
  };
  
  if (!data.client_name || !data.client_phone || !data.products) { showToast('⚠️ Preencha Nome, Telefone e Produtos', 'warning'); return; }
  
  try {
    const { error } = await supabaseClient.from('pedidos').update(data).eq('id', currentEditId);
    if (error) { showToast('❌ Erro ao salvar: ' + error.message, 'error'); return; }
    
    closeEditModal();
    showToast('✅ Alterações salvas no banco com sucesso!', 'success');
    await loadData();
  } catch (err) { showToast('❌ Erro de conexão ao editar', 'error'); console.error(err); }
}

// ==================== BUSCA E UTILITÁRIOS ====================
function searchTodayOrders() { renderTodayList(); }
function searchCompletedOrders() { renderCompletedList(); }

function generateWhatsAppLink(phone, name, customMsg) {
  const clean = phone?.replace(/\D/g, '') || '';
  const full = clean.startsWith('55') ? clean : '55' + clean;
  const msg = encodeURIComponent(customMsg || `Olá ${name}, ficamos combinado pra hoje. Estamos confirmando sua entrega!`);
  return `https://wa.me/${full}?text=${msg}`;
}

function formatPhone(phone) {
  if (!phone) return '';
  const p = phone.replace(/\D/g, '');
  if (p.length === 11) return `(${p.slice(2,4)}) ${p.slice(4,9)}-${p.slice(9)}`;
  if (p.length === 10) return `(${p.slice(2,4)}) ${p.slice(4,8)}-${p.slice(8)}`;
  return phone;
}

function formatPhoneForDB(phone) { 
  const clean = phone.replace(/\D/g, ''); 
  return clean.startsWith('55') ? clean : '55' + clean; 
}

function formatDateBR(dateStr) { 
  if (!dateStr) return '—'; 
  const d = new Date(dateStr); 
  return d.toLocaleDateString('pt-BR') + (dateStr.includes('T') ? ' às ' + d.toLocaleTimeString('pt-BR', {hour:'2-digit',minute:'2-digit'}) : ''); 
}

function formatCurrency(value) { 
  if (!value) return 'R$ 0,00'; 
  const num = typeof value === 'string' ? parseFloat(value.replace('R$', '').replace(',', '.')) : value; 
  return `R$ ${num.toFixed(2).replace('.', ',')}`; 
}

function escapeHtml(text) { 
  if (!text) return ''; 
  const div = document.createElement('div'); 
  div.textContent = text; 
  return div.innerHTML; 
}

function escapeJs(str) { 
  return str?.replace(/'/g, "\\'").replace(/\n/g, '\\n') || ''; 
}

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => { 
    toast.style.animation = 'slideOut 0.3s ease'; 
    setTimeout(() => toast.remove(), 300); 
  }, 3000);
}

function updateStats() {
  const today = getTodayOrders();
  const completed = getCompletedOrders();
  document.getElementById('statToday').textContent = today.length;
  document.getElementById('statDelivered').textContent = completed.filter(o => o.status === 'delivered').length;
}

function isLikelyHumanName(name) {
  if (!name) return false;
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 40) return false;
  if (/[0-9@#\/\\]/.test(trimmed) || /[?!]/.test(trimmed)) return false;
  if (/(kkk|rsrs|mano|doido|doida|negócio|negocio)/i.test(trimmed)) return false;
  const words = trimmed.split(/\s+/);
  if (words.length > 4 || (words.length === 1 && words[0].length <= 2)) return false;
  const capitalizedWords = words.filter(w => /^[A-ZÁÉÍÓÚÂÊÔÃÕÇ]/.test(w));
  return capitalizedWords.length > 0;
}

function confirmDelete(orderId) { currentDeleteId = orderId; document.getElementById('deleteModal').classList.remove('hidden'); }
function closeDeleteModal() { document.getElementById('deleteModal').classList.add('hidden'); currentDeleteId = null; }

async function executeDelete() {
  if (!currentDeleteId) return;
  try {
    const { error } = await supabaseClient.from('pedidos').delete().eq('id', currentDeleteId);
    if (error) { showToast('❌ Erro: ' + error.message, 'error'); return; }
    closeDeleteModal();
    showToast('🗑️ Pedido excluído permanentemente!', 'success');
    await loadData();
  } catch (err) { showToast('❌ Erro de conexão', 'error'); console.error(err); }
}

document.getElementById('confirmDeleteBtn').addEventListener('click', executeDelete);

async function addFinanceEntry() {
  const dateEl = document.getElementById('financeDate'), 
        investedEl = document.getElementById('financeInvested'), 
        returnedEl = document.getElementById('financeReturned');
  
  if (!dateEl || !investedEl || !returnedEl) return;
  
  const date = dateEl.value, 
        invested = parseFloat(String(investedEl.value).replace(',', '.')), 
        returned = parseFloat(String(returnedEl.value).replace(',', '.'));
  
  if (!date || isNaN(invested) || isNaN(returned)) { showToast('⚠️ Preencha data, investido e retorno corretamente', 'warning'); return; }
  
  const profit = returned - invested;
  
  try {
    const { data, error } = await supabaseClient.from('finance_entries').insert([{ date, invested, returned, profit }]).select();
    if (error) { showToast('❌ Erro ao salvar: ' + error.message, 'error'); return; }
    
    const inserted = Array.isArray(data) ? data[0] : data;
    financeEntries = [inserted, ...financeEntries];
    renderFinanceTable();
    investedEl.value = ''; returnedEl.value = '';
    showToast('✅ Registro financeiro salvo!', 'success');
  } catch (err) { showToast('❌ Erro de conexão', 'error'); console.error(err); }
}

function setDefaultDates() {
  const today = new Date().toISOString().split('T')[0];
  const financeDate = document.getElementById('financeDate'); if (financeDate) financeDate.value = today;
  const pendingDate = document.getElementById('pendingPurchaseDate'); if (pendingDate) pendingDate.value = today;
  // ✅ LIMPA o campo de horário (não define valor padrão)
  const pendingTime = document.getElementById('pendingPurchaseTime'); if (pendingTime) pendingTime.value = '';
}