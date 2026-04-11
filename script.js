// ==================== CONFIGURAÇÃO SUPABASE ====================
const SB_URL = "https://vcyrcjayfjueshnffzoc.supabase.co";
const SB_KEY = "sb_publishable_E7U5H2QdRT20-Il8LZrlhg_2FnEx2Qk";
const supabaseClient = window.supabase.createClient(SB_URL, SB_KEY);
const BASE_URL = "https://portal-etevalda-pro.vercel.app";

// ✅ ENTREGADORES ATUALIZADOS
const DELIVERERS = {
    '5565992512338': { name: 'Santiago', phone: '5565992512338' },
    '5565992038306': { name: 'Raielle', phone: '5565992038306' },
    '5566999126191': { name: 'Valdir', phone: '5566999126191' },
    '5566996952171': { name: 'Ginaldo', phone: '5566996952171' },
    '5565992022295': { name: 'Sol', phone: '5565992022295' },
};

let orders = [], pendingPurchases = [], financeEntries = [];
let reportUnlocked = false, currentEditId = null, currentDeleteId = null;
let currentFinanceEditId = null;
let currentDeleteTable = null;
let currentEditPendingId = null;

// ✅ VARIÁVEIS DE FILTRO DO RELATÓRIO
let currentFilterType = 'current';
let currentFilterMonth = 'current';

// ✅ INTERVALO PARA VERIFICAÇÃO DE ALERTAS
let pendingAlertInterval = null;

// ==================== INICIALIZAÇÃO ====================
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 App iniciado. URL:', window.location.href);

    const urlParams = new URLSearchParams(window.location.search);
    const pedidoId = urlParams.get('id')?.trim();
    console.log('🔍 Parâmetro ID da URL:', pedidoId);

    if (pedidoId && isValidUUID(pedidoId)) {
        console.log('✅ UUID válido detectado. Modo entregador ativado.');
        document.getElementById('adminPanel').classList.add('hidden');
        document.getElementById('deliveryPage').classList.add('active');
        await loadDeliveryPage(pedidoId);
    } else {
        console.log('🔧 Modo admin ativado');
        setupTabs();
        setupRealtimeSubscription();
        setupAutoPaste();
        await loadData();
        setDefaultDates();

        // ✅ INICIA A VERIFICAÇÃO DE ALERTAS A CADA 1 MINUTO
        startPendingAlertChecker();
    }
});

function isValidUUID(uuid) {
    if (!uuid) return false;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid.trim());
}

// ==================== AUTO-PASTE INTELIGENTE ====================
function setupAutoPaste() {
    const textarea = document.getElementById('extractConversation');
    if (!textarea) return;
    textarea.addEventListener('paste', async (e) => {
        e.preventDefault();
        const pastedText = (e.clipboardData || window.clipboardData).getData('text');
        textarea.value = pastedText;
        setTimeout(() => {
            if (pastedText.trim().length > 50) handleExtract();
        }, 300);
    });
}

// ==================== PÁGINA DE ROTA DO ENTREGADOR ====================
async function loadDeliveryPage(orderId) {
    const content = document.getElementById('deliveryContent');
    content.innerHTML = '<div class="delivery-loading"><div class="spinner"></div><p>Carregando dados da entrega...</p></div>';

    try {
        console.log('📥 Buscando pedido ID:', orderId);
        const { data: order, error } = await supabaseClient
            .from('pedidos')
            .select('*')
            .eq('id', orderId)
            .maybeSingle();

        console.log('📦 Resposta:', { order, error });

        if (error) {
            console.error('❌ Erro Supabase:', error);
            content.innerHTML = `<div class="delivery-error"><i class="fas fa-exclamation-triangle"></i><h3>Erro de conexão</h3><p>${error.message || 'Verifique sua internet.'}</p></div>`;
            return;
        }

        if (!order) {
            content.innerHTML = `
                <div class="delivery-error">
                    <i class="fas fa-exclamation-triangle"></i>
                    <h3>Pedido não encontrado</h3>
                    <p>O link pode estar incorreto ou o pedido foi excluído.</p>
                    <button class="btn btn-primary btn-sm" style="margin-top:1rem;" onclick="window.location.href='${BASE_URL}'">Voltar ao Painel</button>
                </div>`;
            return;
        }

        const observationsHtml = order.observations && order.observations.trim()
            ? `<div class="delivery-info">
                <div class="delivery-label"><i class="fas fa-sticky-note"></i> 📝 Observações da Entrega</div>
                <div class="delivery-value observations"><strong style="color:#92400e;">${escapeHtml(order.observations)}</strong></div>
            </div>`
            : '';

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
                ${observationsHtml}
                <div class="delivery-actions">
                    ${order.location_url ? `<a href="${order.location_url}" target="_blank" class="delivery-btn map"><i class="fas fa-map-marker-alt"></i> VER NO MAPA</a>` : ''}
                    <button class="delivery-btn" onclick="openClientWhatsApp('${order.client_phone}', '${escapeJs(order.client_name)}', '${escapeJs(order.products || '')}', '${escapeJs(order.observations || '')}', '${escapeJs(order.entregador_responsavel || '')}')"><i class="fab fa-whatsapp"></i> FALAR COM CLIENTE</button>
                </div>
            </div>
        `;
    } catch (err) {
        console.error('💥 Erro crítico:', err);
        content.innerHTML = `<div class="delivery-error"><i class="fas fa-exclamation-triangle"></i><h3>Erro ao carregar</h3><p>Tente recarregar a página.</p></div>`;
    }
}

// ✅ WhatsApp com observações - FORMATADO CORRETAMENTE
function openClientWhatsApp(clientPhone, clientName, products, observations, delivererName) {
    if (!delivererName || delivererName === '') {
        for (const [phone, data] of Object.entries(DELIVERERS)) {
            if (clientPhone.includes(phone.replace('55', '')) || phone.includes(clientPhone.replace('55', ''))) {
                delivererName = data.name;
                break;
            }
        }
    }
    if (!delivererName) delivererName = 'Entregador';

    // ✅ MENSAGEM FORMATADA COM PARÁGRAFOS E QUEBRAS DE LINHA
    let message = `Olá, sou ${delivererName} da Etevalda Joias.\n\n`;
    message += `📦 Seu pedido:\n\n${products}\n\n`;

    if (observations && observations.trim() !== '') {
        message += `📝 Observações importantes:\n${observations}\n\n`;
    }

    message += `Já estou com sua localização e saindo para entrega! 🚀`;

    const cleanPhone = clientPhone.replace(/\D/g, '');
    const fullPhone = cleanPhone.startsWith('55') ? cleanPhone : '55' + cleanPhone;
    const url = `https://api.whatsapp.com/send?phone=${fullPhone}&text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');

    // ✅ Se for um pendente, atualiza o status para "completed"
    const pendingItem = pendingPurchases.find(p => p.client_phone === clientPhone);
    if (pendingItem && pendingItem.status === 'pending') {
        markPendingCompleted(pendingItem.id);
    }
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
            if (tab === 'report') {
                setupReportFilters();
            }
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
        checkPendingAlerts(); // ✅ Verifica alertas ao carregar dados
    } catch (error) {
        console.error('Erro ao carregar dados:', error);
        showToast('⚠️ Erro ao sincronizar com o banco', 'error');
    }
}

async function loadOrders() {
    const { data, error } = await supabaseClient
        .from('pedidos')
        .select('*')
        .order('created_at', { ascending: false });
    if (error) { console.error('Erro pedidos:', error); showToast('⚠️ Erro ao carregar pedidos', 'error'); return; }
    orders = data || [];
}

async function loadPendingPurchases() {
    const { data, error } = await supabaseClient
        .from('pending_purchases')
        .select('*')
        .order('purchase_date', { ascending: true });
    if (error) { console.error('Erro pendentes:', error); return; }
    pendingPurchases = data || [];
}

async function loadFinanceEntries() {
    const { data, error } = await supabaseClient
        .from('finance_entries')
        .select('*')
        .order('date', { ascending: false });
    if (error) { console.error('Erro financeiro:', error); return; }
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
            if (!urlParams.get('id')) {
                loadData();
                checkPendingAlerts(); // ✅ Reavalia alertas quando pendentes mudam
            }
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

// ==================== SISTEMA DE ALERTA INTELIGENTE ====================
function startPendingAlertChecker() {
    checkPendingAlerts(); // Executa imediatamente
    if (pendingAlertInterval) clearInterval(pendingAlertInterval);
    pendingAlertInterval = setInterval(checkPendingAlerts, 60000); // A cada 1 minuto
}

function checkPendingAlerts() {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    console.log('🔔 Verificando alertas para:', today, currentTime);

    const duePendings = pendingPurchases.filter(p => {
        if (p.status !== 'pending') return false;

        // Verifica se a data já chegou ou passou
        const purchaseDate = p.purchase_date;
        if (purchaseDate < today) return true; // Data passada

        // Se for hoje, verifica o horário
        if (purchaseDate === today && p.purchase_time) {
            return p.purchase_time <= currentTime; // Horário já passou ou é agora
        }

        return purchaseDate === today && !p.purchase_time; // Hoje sem horário definido
    });

    console.log('🔔 Pendentes com alerta:', duePendings.length);

    const alertBanner = document.getElementById('pendingAlertBanner');
    const alertCount = document.getElementById('pendingAlertCount');

    if (duePendings.length > 0) {
        alertCount.textContent = duePendings.length;
        alertBanner.classList.remove('hidden');
    } else {
        alertBanner.classList.add('hidden');
    }
}

function scrollToPendingSection() {
    const pendingSection = document.getElementById('pendingAccordionContent');
    if (pendingSection) {
        if (pendingSection.classList.contains('hidden')) {
            togglePendingAccordion();
        }
        pendingSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

// ==================== RENDERING UNIFICADO ====================
function renderAllLists() { renderActiveList(); renderHistoryList(); renderPendingList(); }

function getActiveOrders() {
    return orders.filter(o => ['pending', 'en_route'].includes(o.status));
}

function getHistoryOrders() {
    return orders.filter(o => ['delivered', 'cancelled'].includes(o.status));
}

// ✅ FUNÇÕES DE BUSCA REATIVAS
function searchActiveOrders() { 
    const query = document.getElementById('activeSearch')?.value.toLowerCase() || '';
    renderActiveList(query);
}

function searchHistoryOrders() { 
    const query = document.getElementById('historySearch')?.value.toLowerCase() || '';
    renderHistoryList(query);
}

function renderActiveList(query = '') {
    const container = document.getElementById('activeList');
    const filtered = getActiveOrders().filter(o =>
        o.client_name?.toLowerCase().includes(query) ||
        o.client_phone?.includes(query)
    );
    document.getElementById('activeCount').textContent = `${filtered.length} pedidos`;
    if (filtered.length === 0) { container.innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i><p>Nenhum pedido ativo</p></div>'; return; }
    container.innerHTML = filtered.map(o => createOrderCard(o, true)).join('');
}

function renderHistoryList(query = '') {
    const container = document.getElementById('historyList');
    const filtered = getHistoryOrders().filter(o =>
        o.client_name?.toLowerCase().includes(query) ||
        o.client_phone?.includes(query)
    );
    document.getElementById('historyCount').textContent = `${filtered.length} pedidos`;
    if (filtered.length === 0) { container.innerHTML = '<div class="empty-state"><i class="fas fa-history"></i><p>Nenhum registro no histórico</p></div>'; return; }
    container.innerHTML = filtered.map(o => createOrderCard(o, false)).join('');
}

function createOrderCard(order, isActive) {
    const statusBadge = {
        pending: '<span class="badge badge-pending">⏳ Pendente</span>',
        'en_route': '<span class="badge badge-en-route">🚚 Em Rota</span>',
        delivered: '<span class="badge badge-delivered">✅ Entregue</span>',
        cancelled: '<span class="badge badge-cancelled">❌ Cancelado</span>'
    }[order.status] || '<span class="badge badge-pending">📋 Em andamento</span>';

    return `<div class="order-item" onclick="openEditModal('${order.id}')">
        <div class="order-item-header">
            <div>
                <div class="order-client">${escapeHtml(order.client_name)}</div>
                <a href="${generateWhatsAppLink(order.client_phone, order.client_name)}" target="_blank" class="order-phone" onclick="event.stopPropagation()"><i class="fab fa-whatsapp"></i> ${formatPhone(order.client_phone)}</a>
            </div>
            ${statusBadge}
        </div>
        <div class="order-products">${escapeHtml(order.products)}</div>
        <div class="order-meta">
            <span><i class="fas fa-calendar"></i> ${formatDateBR(order.created_at)}</span>
            ${order.total_value ? `<span class="order-value">${order.total_value}</span>` : ''}
        </div>
        <div class="order-actions" onclick="event.stopPropagation()">
            <button class="btn btn-outline btn-sm" onclick="openEditModal('${order.id}')">✏️ Editar</button>
            <button class="btn btn-danger btn-sm" onclick="confirmDelete('${order.id}')">🗑️ Excluir</button>
        </div>
    </div>`;
}

function renderPendingList() {
    const container = document.getElementById('pendingList');
    if (pendingPurchases.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i><p>Nenhum pendente cadastrado</p></div>';
        return;
    }
    container.innerHTML = pendingPurchases.map(p => {
        let badgeHtml = '';
        if (p.status === 'pending') badgeHtml = '<span class="badge badge-pending">📅 Pendente</span>';
        else if (p.status === 'completed') badgeHtml = '<span class="badge badge-delivered">✅ Concluído</span>';
        else badgeHtml = '<span class="badge badge-cancelled">❌ Cancelado</span>';

        const whatsappLink = generateWhatsAppLink(p.client_phone, p.client_name, 'Olá, ficamos combinado pra hoje. Estamos confirmando sua entrega!');
        return `<div class="order-item">
            <div class="order-item-header">
                <div><div class="order-client">${escapeHtml(p.client_name)}</div>
                <a href="${whatsappLink}" target="_blank" class="order-phone"><i class="fab fa-whatsapp"></i> ${formatPhone(p.client_phone)}</a></div>
                ${badgeHtml}
            </div>
            <div class="order-meta">
                <span><i class="fas fa-calendar"></i> ${formatDateBR(p.purchase_date)}</span>
                ${p.purchase_time ? `<span><i class="fas fa-clock"></i> ${p.purchase_time}</span>` : ''}
            </div>
            <div class="order-products">${escapeHtml(p.conversation_summary || '—')}</div>
            <div class="order-actions">
                <button class="btn btn-outline btn-sm" onclick="editPending('${p.id}')">✏️ Editar</button>
                <button class="btn btn-danger btn-sm" onclick="confirmDeletePending('${p.id}')">🗑️ Excluir</button>
                <button class="btn btn-success btn-sm" onclick="markPendingCompleted('${p.id}')">✅ Confirmar / Concluído</button>
            </div>
        </div>`;
    }).join('');
}

// ==================== EXCLUSÃO ====================
function confirmDelete(orderId) {
    currentDeleteId = orderId;
    currentDeleteTable = 'pedidos';
    document.getElementById('deleteModal').classList.remove('hidden');
}

function confirmDeletePending(id) {
    currentDeleteId = id;
    currentDeleteTable = 'pending_purchases';
    document.getElementById('deleteModal').classList.remove('hidden');
}

function closeDeleteModal() {
    document.getElementById('deleteModal').classList.add('hidden');
    currentDeleteId = null;
    currentDeleteTable = null;
}

async function executeDelete() {
    if (!currentDeleteId) return;
    const table = currentDeleteTable || 'pedidos';
    try {
        const { error } = await supabaseClient.from(table).delete().eq('id', currentDeleteId);
        if (error) {
            showToast('❌ Erro: ' + error.message, 'error');
            return;
        }
        closeDeleteModal();
        showToast('🗑️ Registro excluído com sucesso!', 'success');
        await loadData();
    } catch (err) {
        showToast('❌ Erro de conexão', 'error');
        console.error(err);
    }
}

document.getElementById('confirmDeleteBtn').addEventListener('click', executeDelete);

// ==================== FECHAR MODAIS (ESC + BACKDROP) ====================
const MODAL_CLOSE_MAP = {
    'editOrderModal': closeEditModal,
    'editPendingModal': closeEditPendingModal,
    'editFinanceModal': closeEditFinanceModal,
    'deleteModal': closeDeleteModal
};

document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    for (const [id, closeFn] of Object.entries(MODAL_CLOSE_MAP)) {
        const el = document.getElementById(id);
        if (el && !el.classList.contains('hidden')) { closeFn(); break; }
    }
});

document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
        if (e.target !== overlay) return;
        const closeFn = MODAL_CLOSE_MAP[overlay.id];
        if (closeFn) closeFn();
    });
});

// ==================== FILTROS DO RELATÓRIO FINANCEIRO ====================
function setupReportFilters() {
    document.querySelectorAll('.filter-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            currentFilterType = chip.dataset.days;
            currentFilterMonth = 'custom';
            document.getElementById('monthSelector').value = 'custom';
            updateReportData();
        });
    });

    document.getElementById('monthSelector').addEventListener('change', (e) => {
        currentFilterMonth = e.target.value;
        document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
        if (e.target.value === 'current') {
            currentFilterType = 'current';
            document.querySelector('.filter-chip[data-days="current"]').classList.add('active');
        } else {
            currentFilterType = 'custom';
        }
        updateReportData();
    });

    updateReportData();
}

function getDateRange() {
    const now = new Date();
    let startDate, endDate;

    if (currentFilterType === 'current' || currentFilterMonth === 'current') {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    } else if (currentFilterType === '7') {
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    } else if (currentFilterType === '15') {
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 14);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    } else if (currentFilterType === '30') {
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    } else {
        const monthsAgo = parseInt(currentFilterMonth);
        if (isNaN(monthsAgo)) {
            // Caso seja 'custom' ou outro valor inválido, usa mês atual
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        } else {
            startDate = new Date(now.getFullYear(), now.getMonth() + monthsAgo, 1);
            endDate = new Date(now.getFullYear(), now.getMonth() + monthsAgo + 1, 0, 23, 59, 59);
        }
    }

    return { startDate, endDate };
}

function updateReportData() {
    const { startDate, endDate } = getDateRange();

    const filteredEntries = financeEntries.filter(entry => {
        const entryDate = new Date(entry.date + 'T00:00:00');
        return entryDate >= startDate && entryDate <= endDate;
    });

    // CÁLCULO CORRETO - SOMA INVESTIDO E RETORNO, DEPOIS CALCULA O LUCRO
    const totalInvested = filteredEntries.reduce((sum, entry) => sum + (parseFloat(entry.invested) || 0), 0);
    const totalReturned = filteredEntries.reduce((sum, entry) => sum + (parseFloat(entry.returned) || 0), 0);
    const totalProfit = totalReturned - totalInvested; // ISSO É O QUE IMPORTA!

    document.getElementById('summaryInvested').textContent = formatCurrency(totalInvested);
    document.getElementById('summaryRevenue').textContent = formatCurrency(totalReturned);
    document.getElementById('summaryProfit').textContent = formatCurrency(totalProfit);

    let periodLabel;
    if (currentFilterType === 'current' || currentFilterMonth === 'current') {
        const now = new Date();
        periodLabel = `Mês Atual (01/${String(now.getMonth() + 1).padStart(2, '0')} até ${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')})`;
    } else if (currentFilterType === '7') {
        periodLabel = 'Últimos 7 dias';
    } else if (currentFilterType === '15') {
        periodLabel = 'Últimos 15 dias';
    } else if (currentFilterType === '30') {
        periodLabel = 'Últimos 30 dias';
    } else {
        const monthsAgo = Math.abs(parseInt(currentFilterMonth) || 0);
        periodLabel = monthsAgo === 0 ? 'Mês Atual' : `${monthsAgo} Mês(es) Atrás`;
    }
    document.getElementById('currentPeriod').textContent = periodLabel;

    renderFilteredFinanceTable(filteredEntries);
}

function renderFilteredFinanceTable(entries) {
    const tbody = document.getElementById('financeTableBody');
    if (!tbody) return;

    if (entries.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--gray-600);">Nenhuma transação no período selecionado</td></tr>';
        return;
    }

    const sortedEntries = [...entries].sort((a, b) => new Date(b.date + 'T00:00:00') - new Date(a.date + 'T00:00:00'));

    tbody.innerHTML = sortedEntries.map(entry => {
        const invested = parseFloat(entry.invested) || 0;
        const returned = parseFloat(entry.returned) || 0;
        const profit = returned - invested; // CALCULA NA HORA PARA GARANTIR
        const margin = invested > 0 ? ((profit / invested) * 100).toFixed(1) : 0;
        const marginClass = profit >= 0 ? 'margin-positive' : 'margin-negative';

        return `<tr>
            <td>${formatDateBR(entry.date)}</td>
            <td>${formatCurrency(invested)}</td>
            <td>${formatCurrency(returned)}</td>
            <td>${formatCurrency(profit)}</td>
            <td><span class="margin-badge ${marginClass}">${margin}%</span></td>
            <td>
                <div class="action-buttons">
                    <button class="btn-edit-finance" onclick="editFinanceEntry('${entry.id}', ${invested}, ${returned}, '${entry.date}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-delete-finance" onclick="deleteFinanceEntry('${entry.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>`;
    }).join('');
}

function calculateAutoProfit(context) {
    let invested, returned, profitField;

    if (context === 'finance') {
        invested = parseFloat(document.getElementById('financeInvested').value) || 0;
        returned = parseFloat(document.getElementById('financeReturned').value) || 0;
        profitField = document.getElementById('financeProfit');
    } else if (context === 'edit') {
        invested = parseFloat(document.getElementById('editFinanceInvested').value) || 0;
        returned = parseFloat(document.getElementById('editFinanceReturned').value) || 0;
        profitField = document.getElementById('editFinanceProfit');
    }

    const profit = returned - invested;
    profitField.value = formatCurrency(profit);
}

function editFinanceEntry(entryId, invested, returned, date) {
    currentFinanceEditId = entryId;
    document.getElementById('editFinanceId').value = entryId;
    document.getElementById('editFinanceDate').value = date;
    document.getElementById('editFinanceInvested').value = invested;
    document.getElementById('editFinanceReturned').value = returned;

    calculateAutoProfit('edit');

    document.getElementById('editFinanceModal').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closeEditFinanceModal() {
    document.getElementById('editFinanceModal').classList.add('hidden');
    document.body.style.overflow = '';
    currentFinanceEditId = null;
}

async function saveEditFinanceEntry() {
    if (!currentFinanceEditId) return;

    const date = document.getElementById('editFinanceDate').value;
    const invested = parseFloat(document.getElementById('editFinanceInvested').value) || 0;
    const returned = parseFloat(document.getElementById('editFinanceReturned').value) || 0;

    if (!date || isNaN(invested) || isNaN(returned)) {
        showToast('⚠️ Preencha todos os campos corretamente', 'warning');
        return;
    }

    const profit = returned - invested;

    try {
        const { error } = await supabaseClient
            .from('finance_entries')
            .update({ date, invested, returned, profit })
            .eq('id', currentFinanceEditId);

        if (error) {
            showToast('❌ Erro ao salvar: ' + error.message, 'error');
            return;
        }

        closeEditFinanceModal();
        showToast('✅ Registro atualizado com sucesso!', 'success');

        await loadFinanceEntries();
        updateReportData();

    } catch (err) {
        showToast('❌ Erro de conexão', 'error');
        console.error(err);
    }
}

async function deleteFinanceEntry(entryId) {
    if (!confirm('⚠️ Tem certeza que deseja excluir este registro financeiro? Esta ação não pode ser desfeita.')) {
        return;
    }

    try {
        const { error } = await supabaseClient
            .from('finance_entries')
            .delete()
            .eq('id', entryId);

        if (error) {
            showToast('❌ Erro ao excluir: ' + error.message, 'error');
            return;
        }

        showToast('✅ Registro excluído com sucesso!', 'success');

        financeEntries = financeEntries.filter(e => e.id !== entryId);
        updateReportData();

    } catch (err) {
        showToast('❌ Erro de conexão', 'error');
        console.error(err);
    }
}

// ==================== EXTRAÇÃO DE DADOS ====================
async function handleExtract() {
    const conversation = document.getElementById('extractConversation').value.trim();
    if (!conversation) { showToast('⚠️ Por favor, cole a conversa com o cliente', 'warning'); return; }

    const extracted = extractEtevaldaOrder(conversation);

    document.getElementById('extClientName').value = extracted.clientName || '';
    document.getElementById('extClientPhone').value = extracted.clientPhone || '';
    document.getElementById('extProducts').value = extracted.products || '';
    document.getElementById('extPayment').value = extracted.paymentMethod || '';
    document.getElementById('extValue').value = extracted.totalValue || '';
    document.getElementById('extObservations').value = '';

    if (extracted.locationUrl) {
        document.getElementById('extLocation').value = extracted.locationUrl;
    }

    document.getElementById('extractedFields').classList.remove('hidden');
    updateSendButton();
    showToast('✅ Dados extraídos! Revise e edite se necessário', 'success');
}

function extractEtevaldaOrder(conversation) {
    const lines = conversation.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    let result = {
        clientName: '',
        clientPhone: '',
        products: '',
        paymentMethod: '',
        totalValue: '',
        observations: '',
        locationUrl: ''
    };

    const mapsPattern = /https?:\/\/(?:maps\.(?:google|app)\.goo\.gl|goo\.gl\/maps)[^\s]*/i;
    const mapsMatch = conversation.match(mapsPattern);
    if (mapsMatch) result.locationUrl = mapsMatch[0];

    const phonePattern = /55\d{10,11}/g;
    const phones = conversation.match(phonePattern);
    if (phones && phones.length > 0) result.clientPhone = phones[phones.length - 1];

    const SYSTEM_WORDS = ['fechado', 'whatsapp', 'inscrito', 'enviado', 'mensagem', 'áudio', 'video', 'imagem', 'documento', 'localização', 'contato', 'número', 'telefone', 'zap', 'oi', 'ola', 'olá', 'bom dia', 'boa tarde', 'boa noite', 'alianças', 'automação', 'etevalda', 'joias', 'total', 'pix', 'cartão', 'dinheiro'];

    const pedidoNameMatch = conversation.match(/pedido\s+(.+?)(?:\n|$)/i);
    if (pedidoNameMatch && pedidoNameMatch[1]) {
        const name = pedidoNameMatch[1].trim();
        if (!SYSTEM_WORDS.some(w => name.toLowerCase().includes(w)) && isLikelyHumanName(name)) {
            result.clientName = name;
        }
    }

    if (!result.clientName) {
        for (let i = 0; i < Math.min(5, lines.length); i++) {
            const line = lines[i];
            if (SYSTEM_WORDS.some(w => line.toLowerCase().includes(w))) continue;
            const namePattern = /([A-ZÁ-ÚÃÕÇ][a-zá-úãõç]+(?:\s+[A-ZÁ-ÚÃÕÇ][a-zá-úãõç]+)+)/;
            const match = line.match(namePattern);
            if (match && match[1]) {
                const name = match[1].trim();
                if (!SYSTEM_WORDS.some(w => name.toLowerCase().includes(w)) && isLikelyHumanName(name)) {
                    result.clientName = name;
                    break;
                }
            }
        }
    }

    let lastPedidoIndex = -1;
    for (let i = lines.length - 1; i >= 0; i--) {
        if (/^pedido\s*/i.test(lines[i])) {
            lastPedidoIndex = i;
            break;
        }
    }

    if (lastPedidoIndex >= 0) {
        let blockEnd = lines.length;
        for (let i = lastPedidoIndex + 1; i < lines.length; i++) {
            if (lines[i].includes('✅') || /total\s*[:\-]?/i.test(lines[i])) {
                blockEnd = i + 1;
                break;
            }
        }

        const pedidoBlock = lines.slice(lastPedidoIndex, blockEnd);

        const productLines = pedidoBlock.filter((line, index) => {
            const lower = line.toLowerCase();
            if (index === 0 && /^pedido/i.test(line)) return false;
            if (/^pedido/i.test(line)) return false;
            if (SYSTEM_WORDS.some(w => lower.includes(w) && !/r\$?\s*\d+/.test(line))) return false;
            return /r\$?\s*\d+,\d{2}|:\s*r\$?\s*\d+,\d{2}/i.test(line) ||
                (line.includes(':') && line.length < 100) ||
                (/[a-zá-úãõç]+/i.test(line) && line.length > 3 && line.length < 80);
        });

        if (productLines.length > 0) {
            result.products = productLines.join('\n');
        }

        const totalLine = pedidoBlock.find(l => /total\s*[:\-]?/i.test(l));
        if (totalLine) {
            const totalMatch = totalLine.match(/(\d{1,3}(?:\.\d{3})*,\d{2})/);
            if (totalMatch) {
                result.totalValue = totalMatch[1];
            }
        }
        if (!result.totalValue) {
            const checkLine = pedidoBlock.find(l => l.includes('✅'));
            if (checkLine) {
                const totalMatch = checkLine.match(/(\d{1,3}(?:\.\d{3})*,\d{2})/);
                if (totalMatch) result.totalValue = totalMatch[1];
            }
        }
    }

    if (!result.products || result.products.trim() === '') {
        result.products = extractFallbackProducts(lines);
    }

    result.observations = '';

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

    return result;
}

function extractFallbackProducts(lines) {
    const currencyPattern = /(r\$?\s*\d{1,3}(\.\d{3})*,\d{2})|(\d+,\d{2})/i;
    const items = [];
    const tail = lines.slice(-15);
    for (const line of tail) {
        if (line.includes(':') && currencyPattern.test(line) && !/^total/i.test(line)) {
            const [label, value] = line.split(':', 2);
            if (label.trim() && value.trim()) items.push(`${label.trim()}: ${value.trim()}`);
        } else if (currencyPattern.test(line) && line.length < 80 && !/^\d/.test(line)) {
            items.push(line.trim());
        }
    }
    if (items.length > 0) return items.join('\n');
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

async function handleGenerateLink() {
    const selectedDeliverer = document.getElementById('selectedDeliverer').value;
    if (!selectedDeliverer) { showToast('⚠️ Selecione um entregador', 'warning'); return; }

    const clientName = document.getElementById('extClientName').value.trim();
    const clientPhone = document.getElementById('extClientPhone').value.trim();
    const products = document.getElementById('extProducts').value.trim();
    const paymentMethod = document.getElementById('extPayment').value.trim();
    const totalValue = document.getElementById('extValue').value.trim();
    const observations = document.getElementById('extObservations').value.trim();
    const locationUrl = document.getElementById('extLocation').value.trim();

    if (!clientPhone || !products) { showToast('⚠️ Preencha Telefone e Produtos', 'warning'); return; }

    try {
        const { data, error: insertError } = await supabaseClient
            .from('pedidos')
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
            .select();

        if (insertError) {
            console.error('❌ Erro ao salvar:', insertError);
            showToast('❌ Erro: ' + insertError.message, 'error');
            return;
        }

        const novoPedido = data?.[0];
        if (!novoPedido || !novoPedido.id) {
            showToast('⚠️ Pedido salvo, mas ID não capturado', 'warning');
            return;
        }

        const routeLink = `${BASE_URL}/?id=${novoPedido.id}`;
        const textToCopy = `👇 Entrega\nCliente: ${clientName}\n${routeLink}`;

        document.getElementById('linkOutput').textContent = textToCopy;
        document.getElementById('generatedLinkSection').classList.remove('hidden');

        const whatsappUrl = `https://api.whatsapp.com/send?phone=55${selectedDeliverer}&text=${encodeURIComponent(textToCopy)}`;
        window.open(whatsappUrl, '_blank');

        document.getElementById('extractConversation').value = '';
        document.getElementById('extractedFields').classList.add('hidden');
        showToast('✅ Link gerado e WhatsApp aberto!', 'success');
        await loadData();

    } catch (err) {
        console.error('💥 Erro crítico:', err);
        showToast('❌ Falha na conexão', 'error');
    }
}

function copyGeneratedLink() {
    const text = document.getElementById('linkOutput').textContent;
    navigator.clipboard.writeText(text)
        .then(() => showToast('📋 Texto copiado!', 'success'))
        .catch(() => showToast('⚠️ Não foi possível copiar automaticamente', 'warning'));
}

// ==================== PENDENTES DE COMPRA ====================
async function extractPendingData() {
    const conversation = document.getElementById('pendingConversation').value.trim();
    if (!conversation) { showToast('⚠️ Cole a conversa primeiro', 'warning'); return; }
    const extracted = extractEtevaldaOrder(conversation);
    document.getElementById('pendingClientName').value = extracted.clientName || '';
    document.getElementById('pendingClientPhone').value = extracted.clientPhone || '';
    document.getElementById('pendingSummary').value = formatSummaryInPortuguese(extracted.products);
    document.getElementById('pendingExtractedFields').classList.remove('hidden');
    showToast('✅ Dados extraídos!', 'success');
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
        if (error) { showToast('❌ Erro: ' + error.message, 'error'); return; }
        document.getElementById('pendingConversation').value = '';
        document.getElementById('pendingExtractedFields').classList.add('hidden');
        showToast('✅ Pendente salvo!', 'success');
        await loadData();
    } catch (err) { showToast('❌ Falha na conexão', 'error'); console.error(err); }
}

// ✅ FUNÇÃO EDIT PENDING CORRIGIDA
function editPending(id) {
    const p = pendingPurchases.find(item => item.id === id);
    if (!p) {
        showToast('❌ Pendente não encontrado', 'error');
        return;
    }

    currentEditPendingId = id;
    document.getElementById('editPendingId').value = id;
    document.getElementById('editPendingClientName').value = p.client_name || '';
    document.getElementById('editPendingClientPhone').value = p.client_phone || '';
    document.getElementById('editPendingPurchaseDate').value = p.purchase_date || '';

    // ✅ Garante que o horário seja preenchido corretamente
    if (p.purchase_time) {
        document.getElementById('editPendingPurchaseTime').value = p.purchase_time;
    } else {
        document.getElementById('editPendingPurchaseTime').value = '';
    }

    document.getElementById('editPendingSummary').value = p.conversation_summary || '';

    // ✅ Abre o modal de edição
    const modal = document.getElementById('editPendingModal');
    if (modal) {
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    } else {
        console.error('❌ Modal editPendingModal não encontrado no HTML');
        showToast('❌ Erro: Modal de edição não encontrado', 'error');
    }
}

function closeEditPendingModal() {
    document.getElementById('editPendingModal').classList.add('hidden');
    document.body.style.overflow = '';
    currentEditPendingId = null;
}

async function saveEditPending() {
    if (!currentEditPendingId) return;
    const data = {
        client_name: document.getElementById('editPendingClientName').value.trim(),
        client_phone: formatPhoneForDB(document.getElementById('editPendingClientPhone').value.trim()),
        purchase_date: document.getElementById('editPendingPurchaseDate').value,
        purchase_time: document.getElementById('editPendingPurchaseTime').value,
        conversation_summary: document.getElementById('editPendingSummary').value.trim(),
    };
    if (!data.client_name || !data.client_phone || !data.purchase_date) { showToast('⚠️ Preencha Nome, Telefone e Data', 'warning'); return; }
    try {
        const { error } = await supabaseClient.from('pending_purchases').update(data).eq('id', currentEditPendingId);
        if (error) { showToast('❌ Erro: ' + error.message, 'error'); return; }
        closeEditPendingModal();
        showToast('✅ Pendente atualizado!', 'success');
        await loadData();
    } catch (err) { showToast('❌ Erro de conexão', 'error'); console.error(err); }
}

// ✅ FUNÇÃO PARA MARCAR COMO COMPLETED/CONCLUÍDO
async function markPendingCompleted(id) {
    if (!confirm('Marcar como concluído?')) return;
    try {
        const { error } = await supabaseClient
            .from('pending_purchases')
            .update({ status: 'completed' })
            .eq('id', id);
        if (error) {
            showToast('❌ Erro ao atualizar: ' + error.message, 'error');
            return;
        }
        showToast('✅ Pendente marcado como concluído!', 'success');
        await loadData();
        checkPendingAlerts(); // Atualiza o alerta
    } catch (err) {
        showToast('❌ Falha', 'error');
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

// ==================== MODAL DE EDIÇÃO DE PEDIDO ====================
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
        if (error) { showToast('❌ Erro: ' + error.message, 'error'); return; }
        closeEditModal();
        showToast('✅ Alterações salvas!', 'success');
        await loadData();
    } catch (err) { showToast('❌ Erro de conexão', 'error'); console.error(err); }
}

// ==================== UTILITÁRIOS ====================
function generateWhatsAppLink(phone, name, customMsg) {
    const clean = phone?.replace(/\D/g, '') || '';
    const full = clean.startsWith('55') ? clean : '55' + clean;
    const msg = encodeURIComponent(customMsg || `Olá ${name}, ficamos combinado pra hoje. Estamos confirmando sua entrega!`);
    return `https://wa.me/${full}?text=${msg}`;
}

function formatPhone(phone) {
    if (!phone) return '';
    const p = phone.replace(/\D/g, '');
    if (p.length === 11) return `(${p.slice(2, 4)}) ${p.slice(4, 9)}-${p.slice(9)}`;
    if (p.length === 10) return `(${p.slice(2, 4)}) ${p.slice(4, 8)}-${p.slice(8)}`;
    return phone;
}

function formatPhoneForDB(phone) {
    const clean = phone.replace(/\D/g, '');
    return clean.startsWith('55') ? clean : '55' + clean;
}

function formatDateBR(dateStr) {
    if (!dateStr) return '—';
    const dateOnly = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
    const d = new Date(dateOnly + 'T00:00:00');
    return d.toLocaleDateString('pt-BR');
}

function formatCurrency(value) {
    if (value === null || value === undefined) return 'R$ 0,00';
    let num;
    if (typeof value === 'string') {
        const cleaned = value.replace(/R\$\s*/g, '').trim().replace(/\./g, '').replace(',', '.');
        num = parseFloat(cleaned);
    } else {
        num = parseFloat(value);
    }
    if (isNaN(num)) return 'R$ 0,00';
    const parts = num.toFixed(2).split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return `R$ ${parts[0]},${parts[1]}`;
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
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const todayOrders = orders.filter(o => o.created_at && new Date(o.created_at) >= yesterday);
    document.getElementById('statToday').textContent = todayOrders.length;
    document.getElementById('statDelivered').textContent = orders.filter(o => o.status === 'delivered').length;
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

// ✅ FUNÇÃO addFinanceEntry CORRIGIDA (NÃO ENVIA profit)
async function addFinanceEntry() {
    const dateEl = document.getElementById('financeDate'),
        investedEl = document.getElementById('financeInvested'),
        returnedEl = document.getElementById('financeReturned');
    if (!dateEl || !investedEl || !returnedEl) return;

    const date = dateEl.value;
    const invested = parseFloat(String(investedEl.value).replace(',', '.')) || 0;
    const returned = parseFloat(String(returnedEl.value).replace(',', '.')) || 0;

    if (!date || isNaN(invested) || isNaN(returned)) {
        showToast('⚠️ Preencha corretamente', 'warning');
        return;
    }

    try {
        // Salva no banco
        const { error } = await supabaseClient
            .from('finance_entries')
            .insert([{ date, invested, returned }]);

        if (error) {
            showToast('❌ Erro: ' + error.message, 'error');
            return;
        }

        // RECARREGA OS DADOS E ATUALIZA A TELA
        await loadFinanceEntries();
        updateReportData();

        // Limpa os campos
        investedEl.value = '';
        returnedEl.value = '';
        document.getElementById('financeProfit').value = '';
        
        showToast('✅ Registro salvo e relatório atualizado!', 'success');
    } catch (err) {
        showToast('❌ Erro de conexão', 'error');
        console.error(err);
    }
}

function setDefaultDates() {
    const today = new Date().toISOString().split('T')[0];
    const financeDate = document.getElementById('financeDate'); if (financeDate) financeDate.value = today;
    const pendingDate = document.getElementById('pendingPurchaseDate'); if (pendingDate) pendingDate.value = today;
    const pendingTime = document.getElementById('pendingPurchaseTime'); if (pendingTime) pendingTime.value = '';
}