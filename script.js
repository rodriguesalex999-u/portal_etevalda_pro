// ==================== CONFIGURAÇÃO FIREBASE ====================
const BASE_URL = "https://portal-etevalda-pro.vercel.app";

// CONFIGURAÇÃO DO SEU PROJETO FIREBASE (cole do seu console)
const firebaseConfig = {
  apiKey: "AIzaSyBCPzOz6ep9-msLy1fSw9FEALvrOw2j-AI",
  authDomain: "portal-etevalda-entregas-7f130.firebaseapp.com",
  projectId: "portal-etevalda-entregas-7f130",
  storageBucket: "portal-etevalda-entregas-7f130.firebasestorage.app",
  messagingSenderId: "232114227897",
  appId: "1:232114227897:web:62cc2ab43e8c4945712968"
};

// Inicializa o Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Referências das coleções
const pedidosCollection = db.collection('pedidos');
const pendingPurchasesCollection = db.collection('pending_purchases');
const financeEntriesCollection = db.collection('finance_entries');

// ✅ ENTREGADORES ATUALIZADOS
const DELIVERERS = {
    '5565992038306': { name: 'Raielle', phone: '5565992038306' },
    '5566996952171': { name: 'Ginaldo', phone: '5566996952171' },
    '5565992022295': { name: 'Sol', phone: '5565992022295' },
    '5565996328797': { name: 'Flavia', phone: '5565996328797' },
    '5565992215786': { name: 'Kinho', phone: '5565992215786' },
    '556699034031': { name: 'Deyvid', phone: '556699034031' },
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
        // setupRealtimeSubscription(); // REMOVIDO - Não usamos mais Supabase
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
        const doc = await pedidosCollection.doc(orderId).get();
        const order = doc.exists ? { id: doc.id, ...doc.data() } : null;

        console.log('📦 Resposta:', { order });

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
    try {
        const snapshot = await pedidosCollection.orderBy('created_at', 'desc').get();
        orders = [];
        snapshot.forEach(doc => {
            orders.push({ id: doc.id, ...doc.data() });
        });
    } catch (error) {
        console.error('Erro pedidos:', error);
        showToast('⚠️ Erro ao carregar pedidos', 'error');
    }
}
async function loadPendingPurchases() {
    try {
        const snapshot = await pendingPurchasesCollection.orderBy('purchase_date', 'asc').get();
        pendingPurchases = [];
        snapshot.forEach(doc => {
            pendingPurchases.push({ id: doc.id, ...doc.data() });
        });
    } catch (error) {
        console.error('Erro pendentes:', error);
        showToast('⚠️ Erro ao carregar pendentes', 'error');
    }
}

async function loadFinanceEntries() {
    try {
        const snapshot = await financeEntriesCollection.orderBy('date', 'desc').get();
        financeEntries = [];
        snapshot.forEach(doc => {
            financeEntries.push({ id: doc.id, ...doc.data() });
        });
    } catch (error) {
        console.error('Erro financeiro:', error);
        showToast('⚠️ Erro ao carregar financeiro', 'error');
    }
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
    // Filtra apenas pendentes com status 'pending' para exibir
    const activePendings = pendingPurchases.filter(p => p.status === 'pending');
    if (activePendings.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-check-circle"></i><p>Todos os pendentes foram concluídos!</p></div>';
        return;
    }
    container.innerHTML = activePendings.map(p => {
        const today = new Date().toISOString().split('T')[0];
        const isToday = p.purchase_date === today;
        const isPast = p.purchase_date < today;
        
        let urgencyBadge = '';
        if (isToday) urgencyBadge = '<span class="badge badge-en-route" style="background:#dc2626; color:white;">🔔 PARA HOJE!</span>';
        else if (isPast) urgencyBadge = '<span class="badge badge-cancelled">⏰ ATRASADO - Reagende!</span>';
        
        const whatsappLink = generateWhatsAppLink(p.client_phone, p.client_name, 'Olá, ficamos combinado pra hoje. Estamos confirmando sua entrega!');
        return `<div class="order-item">
            <div class="order-item-header">
                <div><div class="order-client">${escapeHtml(p.client_name)}</div>
                <a href="${whatsappLink}" target="_blank" class="order-phone"><i class="fab fa-whatsapp"></i> ${formatPhone(p.client_phone)}</a></div>
                ${urgencyBadge}
            </div>
            <div class="order-meta">
                <span><i class="fas fa-calendar"></i> ${formatDateBR(p.purchase_date)}</span>
                ${p.purchase_time ? `<span><i class="fas fa-clock"></i> ${p.purchase_time}</span>` : '<span><i class="fas fa-clock"></i> Horário não definido</span>'}
            </div>
            <div class="order-products">${escapeHtml(p.conversation_summary || '—')}</div>
            <div class="order-actions">
                <button class="btn btn-outline btn-sm" onclick="editPending('${p.id}')">✏️ Editar (Data/Horário)</button>
                <button class="btn btn-danger btn-sm" onclick="confirmDeletePending('${p.id}')">🗑️ Excluir</button>
                <button class="btn btn-success btn-sm" onclick="markPendingCompleted('${p.id}')">✅ Já vendido / Concluir</button>
            </div>
            ${isPast ? `<div style="margin-top:0.5rem; padding:0.5rem; background:#fee2e2; border-radius:6px; font-size:0.75rem; color:#991b1b;">
                <i class="fas fa-exclamation-triangle"></i> ⚠️ Este pendente está com data vencida! Clique em "✏️ Editar" para reagendar.
            </div>` : ''}
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
        if (table === 'pedidos') {
            await pedidosCollection.doc(currentDeleteId).delete();
        } else if (table === 'pending_purchases') {
            await pendingPurchasesCollection.doc(currentDeleteId).delete();
        }
        closeDeleteModal();
        showToast('🗑️ Registro excluído com sucesso!', 'success');
        await loadData();
    } catch (err) {
        showToast('❌ Erro de conexão: ' + err.message, 'error');
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

// Variável global para o gráfico
let deliveryChart = null;

function updateReportData() {
    const { startDate, endDate } = getDateRange();

    const filteredEntries = financeEntries.filter(entry => {
        const entryDate = new Date(entry.date + 'T00:00:00');
        return entryDate >= startDate && entryDate <= endDate;
    });

    // CÁLCULO CORRETO - SOMA INVESTIDO E RETORNO, DEPOIS CALCULA O LUCRO
    const totalInvested = filteredEntries.reduce((sum, entry) => sum + (parseFloat(entry.invested) || 0), 0);
    const totalReturned = filteredEntries.reduce((sum, entry) => sum + (parseFloat(entry.returned) || 0), 0);
    const totalProfit = totalReturned - totalInvested;

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
    
    // ATUALIZA O GRÁFICO DE PEDIDOS ENTREGUES
    renderDeliveryChart(startDate, endDate);
}

// NOVA FUNÇÃO: RENDERIZA O GRÁFICO DE PEDIDOS ENTREGUES POR DIA
async function renderDeliveryChart(startDate, endDate) {
    try {
        // Busca todos os pedidos entregues no período
        const snapshot = await pedidosCollection
            .where('status', '==', 'delivered')
            .get();
        
        // Agrupa por dia
        const deliveriesByDay = {};
        
        snapshot.forEach(doc => {
            const order = doc.data();
            const createdAt = order.created_at;
            if (!createdAt) return;
            
            const orderDate = new Date(createdAt);
            // Verifica se o pedido está dentro do período selecionado
            if (orderDate >= startDate && orderDate <= endDate) {
                const dayKey = orderDate.toISOString().split('T')[0];
                deliveriesByDay[dayKey] = (deliveriesByDay[dayKey] || 0) + 1;
            }
        });
        
        // Ordena as datas
        const sortedDays = Object.keys(deliveriesByDay).sort();
        const labels = sortedDays.map(day => {
            const d = new Date(day);
            return `${d.getDate()}/${d.getMonth() + 1}`;
        });
        const data = sortedDays.map(day => deliveriesByDay[day]);
        
        // Se não houver dados, mostra mensagem amigável
        if (data.length === 0) {
            const ctx = document.getElementById('deliveryChart')?.getContext('2d');
            if (ctx && deliveryChart) {
                deliveryChart.destroy();
                deliveryChart = null;
            }
            return;
        }
        
        // Renderiza ou atualiza o gráfico
        const ctx = document.getElementById('deliveryChart')?.getContext('2d');
        if (!ctx) return;
        
        if (deliveryChart) {
            deliveryChart.destroy();
        }
        
        deliveryChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Pedidos Entregues',
                    data: data,
                    backgroundColor: 'rgba(212, 175, 55, 0.7)',
                    borderColor: 'rgba(212, 175, 55, 1)',
                    borderWidth: 1,
                    borderRadius: 8,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `${context.raw} pedido(s) entregue(s)`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1,
                            precision: 0
                        },
                        title: {
                            display: true,
                            text: 'Quantidade de Pedidos'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Dia'
                        }
                    }
                }
            }
        });
        
    } catch (error) {
        console.error('Erro ao renderizar gráfico:', error);
    }
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

    try {
        await financeEntriesCollection.doc(currentFinanceEditId).update({ date, invested, returned });

        closeEditFinanceModal();
        showToast('✅ Registro atualizado com sucesso!', 'success');

        await loadFinanceEntries();
        updateReportData();

    } catch (err) {
        showToast('❌ Erro de conexão: ' + err.message, 'error');
        console.error(err);
    }
}

async function deleteFinanceEntry(entryId) {
    if (!confirm('⚠️ Tem certeza que deseja excluir este registro financeiro? Esta ação não pode ser desfeita.')) {
        return;
    }

    try {
        await financeEntriesCollection.doc(entryId).delete();

        showToast('✅ Registro excluído com sucesso!', 'success');

        financeEntries = financeEntries.filter(e => e.id !== entryId);
        updateReportData();

    } catch (err) {
        showToast('❌ Erro de conexão: ' + err.message, 'error');
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
    document.getElementById('extDeliveryTime').value = extracted.deliveryTime || '';
    document.getElementById('extNeighborhood').value = extracted.neighborhood || '';

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
        locationUrl: '',
        deliveryTime: ''
    };

    // ========== 1. EXTRAIR LINK DE LOCALIZAÇÃO ==========
    const mapsPattern = /https?:\/\/(?:maps\.(?:google|app)\.goo\.gl|goo\.gl\/maps)[^\s]*/i;
    const mapsMatch = conversation.match(mapsPattern);
    if (mapsMatch) result.locationUrl = mapsMatch[0];

    // ========== 2. EXTRAIR TELEFONE ==========
    // Padrão 1: +55 43 9132-5844 ou +554391325844
    let phoneMatch = conversation.match(/\+55\s*(\d{2})\s*(\d{4,5})-?(\d{4})/);
    if (phoneMatch) {
        result.clientPhone = '55' + phoneMatch[1] + phoneMatch[2] + phoneMatch[3];
    } else {
        // Padrão 2: 55\d{10,11}
        const phonePattern = /55\d{10,11}/g;
        const phones = conversation.match(phonePattern);
        if (phones && phones.length > 0) {
            result.clientPhone = phones[phones.length - 1];
        } else {
            // Padrão 3: Apenas números com 10-11 dígitos
            const simplePhone = conversation.match(/\d{10,11}/);
            if (simplePhone) result.clientPhone = '55' + simplePhone[0];
        }
    }
    // Remove espaços e caracteres especiais
    if (result.clientPhone) {
        result.clientPhone = result.clientPhone.replace(/\D/g, '');
    }

    // ========== 3. EXTRAIR NOME DO CLIENTE ==========
    // Padrão 1: ~NOME (WhatsApp direto)
    const tildeMatch = conversation.match(/~([A-ZÁ-ÚÃÕÇ][A-ZÁ-ÚÃÕÇa-zá-úãõç]+)/);
    if (tildeMatch && tildeMatch[1]) {
        result.clientName = tildeMatch[1].trim();
    }
    
    // Padrão 2: Primeiro Nome: (Manychat)
    const firstNameMatch = conversation.match(/Primeiro Nome:\s*([A-ZÁ-ÚÃÕÇ][a-zá-úãõç]+)/i);
    if (firstNameMatch && firstNameMatch[1] && !result.clientName) {
        result.clientName = firstNameMatch[1].trim();
    }
    
    // Padrão 3: Detectar nome em linhas específicas
    if (!result.clientName) {
        for (let i = 0; i < Math.min(8, lines.length); i++) {
            const line = lines[i];
            // Evita linhas com telefone, horários, etc.
            if (line.match(/^\+55|\d{10,}|horas?|hrs?|hoje/i)) continue;
            // Nome com 2-4 palavras, letras maiúsculas no início
            const nameMatch = line.match(/^([A-ZÁ-ÚÃÕÇ][a-zá-úãõç]+(?:\s+[A-ZÁ-ÚÃÕÇ][a-zá-úãõç]+){0,2})$/);
            if (nameMatch && nameMatch[1] && nameMatch[1].length > 2 && nameMatch[1].length < 30) {
                result.clientName = nameMatch[1];
                break;
            }
        }
    }

    // ========== 4. EXTRAIR PEDIDO/PRODUTOS ==========
    // Procura pelo bloco do pedido (começa com "Pedido" ou "📦 Pedido")
    let pedidoBlock = '';
    let inPedido = false;
    let pedidoLines = [];
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (/^(Pedido|📦\s*Pedido|👇\s*PEDIDO)/i.test(line)) {
            inPedido = true;
            pedidoLines = [];
            continue;
        }
        if (inPedido) {
            if (/^(✅|Total|-----|---)/i.test(line) || (line.includes('Total') && line.includes(':'))) {
                pedidoLines.push(line);
                break;
            }
            pedidoLines.push(line);
        }
    }
    
    if (pedidoLines.length > 0) {
        result.products = pedidoLines.join('\n');
    }
    
    // Fallback: procura por linhas com valores monetários
    if (!result.products || result.products.trim() === '') {
        result.products = extractFallbackProducts(lines);
    }

    // ========== 5. EXTRAIR VALOR TOTAL ==========
    // Padrão: Total : 330.00 ou Total: R$ 330,00
    const totalPatterns = [
        /Total\s*:?\s*R?\$?\s*(\d{1,3}(?:[\.\s]\d{3})*[.,]\d{2})/i,
        /TOTAL\s*:?\s*R?\$?\s*(\d{1,3}(?:[\.\s]\d{3})*[.,]\d{2})/i,
        /Valor\s*Total\s*:?\s*R?\$?\s*(\d{1,3}(?:[\.\s]\d{3})*[.,]\d{2})/i,
        /✅\s*Total\s*:?\s*R?\$?\s*(\d{1,3}(?:[\.\s]\d{3})*[.,]\d{2})/i
    ];
    
    for (const pattern of totalPatterns) {
        const match = conversation.match(pattern);
        if (match && match[1]) {
            result.totalValue = match[1].replace(/\s/g, '').replace('.', ',').replace(/,(\d{2})$/, ',$1');
            break;
        }
    }

    // ========== 6. EXTRAIR HORÁRIO DA ENTREGA ==========
    const timePatterns = [
        /(entregamos|entrega|saindo|chegando)\s+(hoje|amanhã)?\s*[\w\s]*(\d{1,2})\s*(?:h|:)?\s*(\d{0,2})?\s*(?:hrs|horas)?/i,
        /(Hoje|Amanhã)\s+(?:as|às)\s*(\d{1,2})(?::(\d{2}))?\s*(?:h|hrs|horas)?/i,
        /(\d{1,2}):(\d{2})\s*(?:h|hrs)/i,
        /(entrega|saindo)\s+(\d{1,2})\s*(?:h|:)/i
    ];
    
    for (const pattern of timePatterns) {
        const match = conversation.match(pattern);
        if (match) {
            if (match[1] && (match[1].toLowerCase().includes('hoje') || match[1].toLowerCase().includes('amanhã'))) {
                result.deliveryTime = match[1] + ' ' + (match[2] || '') + (match[3] ? ':' + match[3] : '') + 'h';
            } else if (match[2]) {
                result.deliveryTime = (match[1] || 'Hoje') + ' as ' + match[2] + (match[3] ? ':' + match[3] : '') + 'h';
            } else if (match[1] && match[2]) {
                result.deliveryTime = 'Hoje as ' + match[1] + ':' + match[2] + 'h';
            }
            if (result.deliveryTime) break;
        }
    }
    
    // Limpa o horário detectado
    if (result.deliveryTime) {
        result.deliveryTime = result.deliveryTime.replace(/\s+/g, ' ').trim();
    }

    // ========== 7. EXTRAIR OBSERVAÇÕES (ENDEREÇO) ==========
    let observations = [];
    
    // Procura por padrões de endereço
    const addressPatterns = [
        /(?:Rua|Av|Avenida|Travessa|Alameda|Praça)\s+([^,\n]+)/i,
        /(?:Número|nº|#)\s*:?\s*(\d+)/i,
        /(?:Casa|Apto|Bloco|Quadra)\s*:?\s*([^,\n]+)/i,
        /(?:Portão|Muro)\s*:?\s*([^,\n]+)/i,
        /(?:Ponto de referência|Referência)\s*:?\s*([^,\n]+)/i,
        /(?:Bairro)\s*:?\s*([^,\n]+)/i,
        /(?:CEP)\s*:?\s*(\d{5}-?\d{3})/i
    ];
    
    for (const pattern of addressPatterns) {
        const match = conversation.match(pattern);
        if (match && match[1]) {
            observations.push(`${pattern.source.match(/[A-Za-zÀ-ú]+/)[0]}: ${match[1].trim()}`);
        }
    }
    
    // Procura por linha específica de endereço
    for (const line of lines) {
        if (line.toLowerCase().includes('localização pelo mapa') || 
            line.toLowerCase().includes('nome da rua') ||
            line.toLowerCase().includes('número da casa')) {
            // Pega as próximas linhas
            const idx = lines.indexOf(line);
            for (let i = idx + 1; i < Math.min(idx + 6, lines.length); i++) {
                if (lines[i] && !lines[i].match(/^\d{1,2}:\d{2}/) && lines[i].length > 3) {
                    observations.push(lines[i]);
                }
            }
            break;
        }
    }
    
    if (observations.length > 0) {
        result.observations = observations.join('\n');
    }

    // ========== 8. EXTRAIR FORMA DE PAGAMENTO ==========
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
            if (kw.pattern.test(lines[i])) {
                result.paymentMethod = kw.value;
                break;
            }
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
        // Salva o pedido no banco (para manter o histórico)
        const novoPedido = {
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
        };

        const docRef = await pedidosCollection.add(novoPedido);
        const pedidoId = docRef.id;

        // ========== VERIFICA SE EXISTE PENDENTE PARA ESTE CLIENTE ==========
        // Se existir, REMOVE COMPLETAMENTE o pendente (já que o cliente comprou)
        try {
            // Busca pendentes com o mesmo telefone (qualquer status)
            const pendingSnapshot = await pendingPurchasesCollection
                .where('client_phone', '==', formatPhoneForDB(clientPhone))
                .get();
            
            if (!pendingSnapshot.empty) {
                pendingSnapshot.forEach(async (doc) => {
                    await pendingPurchasesCollection.doc(doc.id).delete();
                    console.log(`🗑️ Pendente ${doc.id} removido automaticamente (cliente comprou)`);
                });
                // Recarrega os pendentes para atualizar a tela
                await loadPendingPurchases();
                renderPendingList();
                checkPendingAlerts();
            }
        } catch (err) {
            console.error('Erro ao verificar pendentes:', err);
            // Não interrompe o fluxo principal se der erro
        }

        // ========== LINK DIRETO DO WHATSAPP PARA O CLIENTE ==========
        const delivererName = DELIVERERS[selectedDeliverer]?.name || 'Entregador';
        
        // Captura o horário da entrega
        const deliveryTime = document.getElementById('extDeliveryTime')?.value.trim() || 'A combinar';
        
        // Captura o bairro (declarado UMA ÚNICA VEZ)
        const neighborhood = document.getElementById('extNeighborhood')?.value.trim() || '';
        
        // Monta a mensagem que será enviada para o cliente
        let message = `Olá, sou ${delivererName} da Etevalda Joias.\n\n`;
        message += `📦 Seu pedido:\n\n${products}\n\n`;
        
        if (neighborhood && neighborhood.trim() !== '') {
            message += `🏠 *BAIRRO : ${neighborhood.toUpperCase()}*\n\n`;
        }
        
        if (deliveryTime && deliveryTime.trim() !== '') {
            message += `⏰ Horário da entrega: ${deliveryTime}\n\n`;
        }
        
        if (observations && observations.trim() !== '') {
            message += `📝 Observações importantes:\n${observations}\n\n`;
        }
        
        if (locationUrl && locationUrl.trim() !== '') {
            message += `📍 Localização para entrega:\n${locationUrl}\n\n`;
        }
        
        message += `Já estou com sua localização e saindo para entrega! 🚀`;
        
        // Limpa o telefone do cliente
        const cleanClientPhone = clientPhone.replace(/\D/g, '');
        const fullClientPhone = cleanClientPhone.startsWith('55') ? cleanClientPhone : '55' + cleanClientPhone;
        
        // Link direto do WhatsApp para o CLIENTE
        const directWhatsAppLink = `https://wa.me/${fullClientPhone}?text=${encodeURIComponent(message)}`;
        
        // Formata o valor para exibição no texto do entregador (reutiliza a variável neighborhood já declarada)
        const valorDisplay = totalValue && totalValue.trim() !== '' ? totalValue : 'Não informado';
        const horarioDisplay = deliveryTime && deliveryTime.trim() !== '' ? deliveryTime : 'A combinar';
        const localDisplay = locationUrl && locationUrl.trim() !== '' ? locationUrl : 'Não informado';
        const bairroDisplay = neighborhood && neighborhood.trim() !== '' ? neighborhood.toUpperCase() : '';
        
        // Monta o texto do entregador com bairro (se existir)
        let textToCopy = `👇 ENTREGA CLIENTE: ${clientName}\n\n`;
        
        if (bairroDisplay) {
            textToCopy += `🏠 *BAIRRO : ${bairroDisplay}*\n\n`;
        }
        
        textToCopy += `💰 VALOR DO PEDIDO: ${valorDisplay}\n⏰ HORÁRIO: ${horarioDisplay}\n\n📍 LOCALIZAÇÃO: \n${localDisplay}\n\n${directWhatsAppLink}`;

        document.getElementById('linkOutput').textContent = textToCopy;
        document.getElementById('generatedLinkSection').classList.remove('hidden');

        // Abre WhatsApp do ENTREGADOR com o link direto
        const delivererPhone = selectedDeliverer;
        const whatsappToDeliverer = `https://api.whatsapp.com/send?phone=55${delivererPhone}&text=${encodeURIComponent(textToCopy)}`;
        window.open(whatsappToDeliverer, '_blank');

        document.getElementById('extractConversation').value = '';
        document.getElementById('extractedFields').classList.add('hidden');
        showToast('✅ Link direto do WhatsApp gerado!', 'success');
        await loadData();

    } catch (err) {
        console.error('💥 Erro crítico:', err);
        showToast('❌ Falha na conexão: ' + err.message, 'error');
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
        await pendingPurchasesCollection.add({
            client_name: clientName,
            client_phone: formatPhoneForDB(clientPhone),
            purchase_date: purchaseDate,
            purchase_time: purchaseTime,
            conversation_summary: conversationSummary,
            status: 'pending',
            created_at: new Date().toISOString()
        });
        document.getElementById('pendingConversation').value = '';
        document.getElementById('pendingExtractedFields').classList.add('hidden');
        showToast('✅ Pendente salvo!', 'success');
        await loadData();
    } catch (err) { 
        showToast('❌ Falha na conexão: ' + err.message, 'error'); 
        console.error(err); 
    }
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
        await pendingPurchasesCollection.doc(currentEditPendingId).update(data);
        closeEditPendingModal();
        showToast('✅ Pendente atualizado!', 'success');
        await loadData();
    } catch (err) { 
        showToast('❌ Erro de conexão: ' + err.message, 'error'); 
        console.error(err); 
    }
}

// ✅ FUNÇÃO PARA MARCAR COMO COMPLETED/CONCLUÍDO
async function markPendingCompleted(id) {
    if (!confirm('Marcar como concluído?')) return;
    try {
        await pendingPurchasesCollection.doc(id).update({ status: 'completed' });
        showToast('✅ Pendente marcado como concluído!', 'success');
        await loadData();
        checkPendingAlerts(); // Atualiza o alerta
    } catch (err) {
        showToast('❌ Falha: ' + err.message, 'error');
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
        await pedidosCollection.doc(currentEditId).update(data);
        closeEditModal();
        showToast('✅ Alterações salvas!', 'success');
        await loadData();
    } catch (err) { 
        showToast('❌ Erro de conexão: ' + err.message, 'error'); 
        console.error(err); 
    }
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
        // Salva no banco Firebase
        await financeEntriesCollection.add({ date, invested, returned });

        // RECARREGA OS DADOS E ATUALIZA A TELA
        await loadFinanceEntries();
        updateReportData();

        // Limpa os campos
        investedEl.value = '';
        returnedEl.value = '';
        document.getElementById('financeProfit').value = '';
        
        showToast('✅ Registro salvo e relatório atualizado!', 'success');
    } catch (err) {
        showToast('❌ Erro de conexão: ' + err.message, 'error');
        console.error(err);
    }
}

function setDefaultDates() {
    const today = new Date().toISOString().split('T')[0];
    const financeDate = document.getElementById('financeDate'); if (financeDate) financeDate.value = today;
    const pendingDate = document.getElementById('pendingPurchaseDate'); if (pendingDate) pendingDate.value = today;
    const pendingTime = document.getElementById('pendingPurchaseTime'); if (pendingTime) pendingTime.value = '';
}