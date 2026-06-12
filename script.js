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
const receivablesCollection = db.collection('receivables');

// ✅ ENTREGADORES ATUALIZADOS
const DELIVERERS = {
    '5565992038306': { name: 'Sr(a) Raielle', phone: '5565992038306' },
    '5566996952171': { name: 'Sr Ginaldo', phone: '5566996952171' },
    '5565992022295': { name: 'Sr(a) Sol', phone: '5565992022295' },
    '5565996328797': { name: 'Sr(a) Flavia', phone: '5565996328797' },
    '5565992215786': { name: 'Sr Kinho', phone: '5565992215786' },
    '556699034031': { name: 'Sr Deyvid', phone: '556699034031' },
    '556697118132': { name: 'Sr Matheus', phone: '556697118132' },
    '5565984428298': { name: 'Sr(a) Guta', phone: '5565984428298' },
};

let orders = [], pendingPurchases = [], financeEntries = [], receivables = [];
let reportUnlocked = false, currentEditId = null, currentDeleteId = null;
let currentFinanceEditId = null;
let currentDeleteTable = null;
let currentEditPendingId = null;
let currentEditReceivableId = null;

// ✅ VARIÁVEIS DE FILTRO DO RELATÓRIO
let currentFilterType = 'current';
let currentFilterMonth = 'current';
let reportFiltersInitialized = false;

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

function isValidUUID(id) {
    if (!id) return false;
    // Aceita UUID tradicional OU ID do Firestore (20 caracteres alfanuméricos)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const firestoreIdRegex = /^[a-zA-Z0-9]{20}$/;
    return uuidRegex.test(id.trim()) || firestoreIdRegex.test(id.trim());
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
        await loadReceivables();
        renderAllLists();
        updateStats();
        checkPendingAlerts(); // ✅ Verifica alertas ao carregar dados
        // ✅ Recalcula o auto-preenchimento do valor de retorno com os pedidos mais recentes
        autoFillReturned('financeDate', 'financeReturned');
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

async function loadReceivables() {
    try {
        const snapshot = await receivablesCollection.orderBy('receive_date', 'asc').get();
        receivables = [];
        snapshot.forEach(doc => {
            receivables.push({ id: doc.id, ...doc.data() });
        });
    } catch (error) {
        console.error('Erro a receber:', error);
        showToast('⚠️ Erro ao carregar clientes a receber', 'error');
    }
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
        const purchaseDate = p.purchase_date;
        if (purchaseDate < today) return true;
        if (purchaseDate === today && p.purchase_time) return p.purchase_time <= currentTime;
        return purchaseDate === today && !p.purchase_time;
    });

    const dueReceivables = receivables.filter(r => {
        if (r.status !== 'pending') return false;
        const receiveDate = r.receive_date;
        if (receiveDate < today) return true;
        if (receiveDate === today && r.receive_time) return r.receive_time <= currentTime;
        return receiveDate === today && !r.receive_time;
    });

    console.log('🔔 Pendentes com alerta:', duePendings.length, '| A receber:', dueReceivables.length);

    const alertBanner = document.getElementById('pendingAlertBanner');
    const alertBannerText = document.getElementById('alertBannerText');
    const totalAlerts = duePendings.length + dueReceivables.length;

    if (totalAlerts > 0) {
        let parts = [];
        if (duePendings.length > 0) parts.push(`🔴 ${duePendings.length} pendente(s) de compra`);
        if (dueReceivables.length > 0) parts.push(`💰 ${dueReceivables.length} cliente(s) a receber`);
        if (alertBannerText) {
            alertBannerText.innerHTML = `<span id="pendingAlertCount">${totalAlerts}</span> alerta(s): ${parts.join(' | ')} — Ação necessária AGORA!`;
        }
        alertBanner.classList.remove('hidden');
    } else {
        alertBanner.classList.add('hidden');
    }
}

function scrollToPendingSection() {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const hasDuePendings = pendingPurchases.some(p => {
        if (p.status !== 'pending') return false;
        if (p.purchase_date < today) return true;
        if (p.purchase_date === today && p.purchase_time) return p.purchase_time <= currentTime;
        return p.purchase_date === today && !p.purchase_time;
    });
    const hasDueReceivables = receivables.some(r => {
        if (r.status !== 'pending') return false;
        if (r.receive_date < today) return true;
        if (r.receive_date === today && r.receive_time) return r.receive_time <= currentTime;
        return r.receive_date === today && !r.receive_time;
    });
    if (hasDuePendings) {
        const pendingSection = document.getElementById('pendingAccordionContent');
        if (pendingSection) {
            if (pendingSection.classList.contains('hidden')) togglePendingAccordion();
            pendingSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }
    if (hasDueReceivables) {
        const receivableSection = document.getElementById('receivableAccordionContent');
        if (receivableSection) {
            if (receivableSection.classList.contains('hidden')) toggleReceivableAccordion();
            receivableSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }
    if (!hasDuePendings && !hasDueReceivables) {
        const pendingSection = document.getElementById('pendingAccordionContent');
        if (pendingSection) {
            if (pendingSection.classList.contains('hidden')) togglePendingAccordion();
            pendingSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }
}

// ==================== RENDERING UNIFICADO ====================
function renderAllLists() { renderActiveList(); renderHistoryList(); renderPendingList(); renderReceivablesList(); }

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

// ==================== CLIENTES A RECEBER ====================
function toggleReceivableAccordion() {
    const content = document.getElementById('receivableAccordionContent'),
        icon = document.getElementById('receivableAccordionIcon');
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

function renderReceivablesList() {
    const container = document.getElementById('receivableList');
    if (!container) return;
    const activeReceivables = receivables.filter(r => r.status === 'pending');
    if (activeReceivables.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-hand-holding-dollar"></i><p>Nenhum cliente a receber cadastrado</p></div>';
        return;
    }
    container.innerHTML = activeReceivables.map(r => {
        const today = new Date().toISOString().split('T')[0];
        const isToday = r.receive_date === today;
        const isPast = r.receive_date < today;
        let urgencyBadge = '';
        if (isToday) urgencyBadge = '<span class="badge badge-receivable-urgent">💰 RECEBER HOJE!</span>';
        else if (isPast) urgencyBadge = '<span class="badge badge-cancelled">⏰ ATRASADO!</span>';
        else urgencyBadge = '<span class="badge badge-receivable">💰 A Receber</span>';
        const whatsappLink = generateWhatsAppLink(
            r.client_phone,
            r.client_name,
            `Oi ${r.client_name}! 😊 Ficamos combinados que hoje você iria efetuar o pagamento pendente. Estamos aguardando seu pagamento! 🙏`
        );
        return `<div class="order-item receivable-item">
            <div class="order-item-header">
                <div>
                    <div class="order-client">${escapeHtml(r.client_name)}</div>
                    <a href="${whatsappLink}" target="_blank" class="order-phone"><i class="fab fa-whatsapp"></i> ${formatPhone(r.client_phone)}</a>
                </div>
                ${urgencyBadge}
            </div>
            <div class="order-meta">
                <span><i class="fas fa-calendar"></i> ${formatDateBR(r.receive_date)}</span>
                ${r.receive_time ? `<span><i class="fas fa-clock"></i> ${r.receive_time}</span>` : '<span><i class="fas fa-clock"></i> Horário não definido</span>'}
            </div>
            ${r.observation ? `<div class="order-products" style="color:#92400e;background:#fef3c7;padding:0.5rem;border-radius:6px;border-left:3px solid #f59e0b;">${escapeHtml(r.observation)}</div>` : ''}
            <div class="order-actions">
                <button class="btn btn-outline btn-sm" onclick="editReceivable('${r.id}')">✏️ Editar</button>
                <button class="btn btn-danger btn-sm" onclick="confirmDeleteReceivable('${r.id}')">🗑️ Excluir</button>
                <button class="btn btn-success btn-sm" onclick="markReceivableCompleted('${r.id}')">✅ Recebido!</button>
            </div>
            ${isPast ? `<div style="margin-top:0.5rem;padding:0.5rem;background:#fee2e2;border-radius:6px;font-size:0.75rem;color:#991b1b;"><i class="fas fa-exclamation-triangle"></i> ⚠️ Pagamento em atraso! Clique em "✏️ Editar" para reagendar.</div>` : ''}
        </div>`;
    }).join('');
}

async function saveReceivable() {
    const clientName = document.getElementById('receivableClientName').value.trim();
    const clientPhone = document.getElementById('receivableClientPhone').value.trim();
    const receiveDate = document.getElementById('receivableDate').value;
    const receiveTime = document.getElementById('receivableTime').value;
    const observation = document.getElementById('receivableObservation').value.trim();
    if (!clientName || !clientPhone || !receiveDate) { showToast('⚠️ Preencha Nome, Telefone e Data', 'warning'); return; }
    try {
        await receivablesCollection.add({
            client_name: clientName,
            client_phone: formatPhoneForDB(clientPhone),
            receive_date: receiveDate,
            receive_time: receiveTime,
            observation: observation,
            status: 'pending',
            created_at: new Date().toISOString()
        });
        document.getElementById('receivableClientName').value = '';
        document.getElementById('receivableClientPhone').value = '';
        document.getElementById('receivableObservation').value = '';
        document.getElementById('receivableTime').value = '';
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('receivableDate').value = today;
        showToast('✅ Cliente a receber salvo!', 'success');
        await loadData();
    } catch (err) {
        showToast('❌ Falha na conexão: ' + err.message, 'error');
        console.error(err);
    }
}

function editReceivable(id) {
    const r = receivables.find(item => item.id === id);
    if (!r) { showToast('❌ Registro não encontrado', 'error'); return; }
    currentEditReceivableId = id;
    document.getElementById('editReceivableId').value = id;
    document.getElementById('editReceivableClientName').value = r.client_name || '';
    document.getElementById('editReceivableClientPhone').value = r.client_phone || '';
    document.getElementById('editReceivableDate').value = r.receive_date || '';
    document.getElementById('editReceivableTime').value = r.receive_time || '';
    document.getElementById('editReceivableObservation').value = r.observation || '';
    const modal = document.getElementById('editReceivableModal');
    if (modal) { modal.classList.remove('hidden'); document.body.style.overflow = 'hidden'; }
}

function closeEditReceivableModal() {
    document.getElementById('editReceivableModal').classList.add('hidden');
    document.body.style.overflow = '';
    currentEditReceivableId = null;
}

async function saveEditReceivable() {
    if (!currentEditReceivableId) return;
    const data = {
        client_name: document.getElementById('editReceivableClientName').value.trim(),
        client_phone: formatPhoneForDB(document.getElementById('editReceivableClientPhone').value.trim()),
        receive_date: document.getElementById('editReceivableDate').value,
        receive_time: document.getElementById('editReceivableTime').value,
        observation: document.getElementById('editReceivableObservation').value.trim(),
    };
    if (!data.client_name || !data.client_phone || !data.receive_date) { showToast('⚠️ Preencha Nome, Telefone e Data', 'warning'); return; }
    try {
        await receivablesCollection.doc(currentEditReceivableId).update(data);
        closeEditReceivableModal();
        showToast('✅ Cliente a receber atualizado!', 'success');
        await loadData();
    } catch (err) {
        showToast('❌ Erro de conexão: ' + err.message, 'error');
        console.error(err);
    }
}

function confirmDeleteReceivable(id) {
    currentDeleteId = id;
    currentDeleteTable = 'receivables';
    document.getElementById('deleteModal').classList.remove('hidden');
}

async function markReceivableCompleted(id) {
    if (!confirm('Confirmar recebimento? O registro será marcado como concluído.')) return;
    try {
        await receivablesCollection.doc(id).update({ status: 'completed' });
        showToast('✅ Recebimento confirmado!', 'success');
        await loadData();
        checkPendingAlerts();
    } catch (err) {
        showToast('❌ Falha: ' + err.message, 'error');
    }
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
        } else if (table === 'receivables') {
            await receivablesCollection.doc(currentDeleteId).delete();
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
    'editReceivableModal': closeEditReceivableModal,
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
    if (reportFiltersInitialized) {
        updateReportData();
        return;
    }
    reportFiltersInitialized = true;
    document.querySelectorAll('.filter-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            currentFilterType = chip.dataset.days;
            currentFilterMonth = 'custom';
            document.getElementById('monthSelector').value = 'custom';
            document.getElementById('customDateRange').classList.add('hidden');
            updateReportData();
        });
    });

    document.getElementById('monthSelector').addEventListener('change', (e) => {
        currentFilterMonth = e.target.value;
        document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
        if (e.target.value === 'current') {
            currentFilterType = 'current';
            document.querySelector('.filter-chip[data-days="current"]').classList.add('active');
            document.getElementById('customDateRange').classList.add('hidden');
        } else if (e.target.value === 'custom') {
            currentFilterType = 'custom';
            document.getElementById('customDateRange').classList.remove('hidden');
            const today = new Date();
            const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
            document.getElementById('customStartDate').value = startOfMonth.toISOString().split('T')[0];
            document.getElementById('customEndDate').value = today.toISOString().split('T')[0];
        } else {
            currentFilterType = 'custom';
            document.getElementById('customDateRange').classList.add('hidden');
        }
        updateReportData();
    });

    document.getElementById('applyCustomDateBtn').addEventListener('click', () => {
        const start = document.getElementById('customStartDate').value;
        const end = document.getElementById('customEndDate').value;
        if (!start || !end) { showToast('⚠️ Selecione data de início e fim', 'warning'); return; }
        if (start > end) { showToast('⚠️ Data inicial não pode ser maior que a final', 'warning'); return; }
        currentFilterType = 'custom_date';
        currentFilterMonth = 'custom';
        document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
        updateReportData();
    });

    updateReportData();
}

function getDateRange() {
    const now = new Date();
    let startDate, endDate;

    if (currentFilterType === 'custom_date') {
        const startVal = document.getElementById('customStartDate').value;
        const endVal = document.getElementById('customEndDate').value;
        if (startVal && endVal) {
            startDate = new Date(startVal + 'T00:00:00');
            endDate = new Date(endVal + 'T23:59:59');
        } else {
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        }
    } else if (currentFilterType === 'current' || currentFilterMonth === 'current') {
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

async function updateReportData() {
    const { startDate, endDate } = getDateRange();

    console.log('📊 Relatório - período:', { 
        tipo: currentFilterType, 
        inicio: startDate.toString(), 
        fim: endDate.toString() 
    });

    const filteredEntries = financeEntries.filter(entry => {
        const entryDate = new Date(entry.date + 'T00:00:00');
        return entryDate >= startDate && entryDate <= endDate;
    });

    console.log('📊 Registros financeiros no período:', filteredEntries.length);

    let totalInvested = 0, totalRevenue = 0;

    if (filteredEntries.length > 0) {
        // PRIORIDADE: usa o que foi lançado manualmente nos registros financeiros
        console.log('📊 Usando PRIORIDADE (registros financeiros)');
        filteredEntries.forEach(entry => {
            totalInvested += parseFloat(entry.invested) || 0;
            totalRevenue += parseFloat(entry.returned) || 0;
        });
    } else {
        // FALLBACK: se não tem nenhum registro financeiro no período, calcula dos pedidos
        console.log('📊 Usando FALLBACK (pedidos)');
        try {
            const snapshot = await pedidosCollection.get();
            console.log('📊 Total de pedidos no Firestore:', snapshot.size);
            // Converte start/end para YYYY-MM-DD local (para comparar com a data do pedido)
            const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
            const startStr = fmt(startDate);
            const endStr = fmt(endDate);
            console.log('📊 Intervalo (string):', startStr, '→', endStr);
            snapshot.forEach(doc => {
                const order = doc.data();
                if (!order.created_at) return;
                const orderDate = order.created_at.includes('T') 
                    ? order.created_at.split('T')[0] 
                    : order.created_at;
                if (orderDate >= startStr && orderDate <= endStr) {
                    const val = parseBrazilianCurrency(order.total_value);
                    totalRevenue += val;
                    console.log('📦 Pedido incluído:', orderDate, 'valor:', val, 'cliente:', order.client_name);
                }
            });
            console.log('📊 Faturamento total do fallback:', totalRevenue);
        } catch (error) {
            console.error('Erro ao carregar pedidos para fallback do relatório:', error);
        }
    }

    const totalProfit = totalRevenue - totalInvested;

    document.getElementById('summaryInvested').textContent = formatCurrency(totalInvested);
    document.getElementById('summaryRevenue').textContent = formatCurrency(totalRevenue);
    document.getElementById('summaryProfit').textContent = formatCurrency(totalProfit);

    let periodLabel;
    if (currentFilterType === 'custom_date') {
        const s = document.getElementById('customStartDate').value;
        const e = document.getElementById('customEndDate').value;
        periodLabel = `${formatDateBR(s)} — ${formatDateBR(e)} (Personalizado)`;
    } else if (currentFilterType === 'current' || currentFilterMonth === 'current') {
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
    
    renderDeliveryChart(startDate, endDate);
}

// GRÁFICO: MOSTRA TODOS OS PEDIDOS GERADOS POR DIA (independente do status)
async function renderDeliveryChart(startDate, endDate) {
    try {
        const snapshot = await pedidosCollection.get();
        
        const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        const startStr = fmt(startDate);
        const endStr = fmt(endDate);
        
        const ordersByDay = {};
        
        snapshot.forEach(doc => {
            const order = doc.data();
            if (!order.created_at) return;
            const orderDate = order.created_at.includes('T') 
                ? order.created_at.split('T')[0] 
                : order.created_at;
            if (orderDate >= startStr && orderDate <= endStr) {
                ordersByDay[orderDate] = (ordersByDay[orderDate] || 0) + 1;
            }
        });
        
        const sortedDays = Object.keys(ordersByDay).sort();
        const labels = sortedDays.map(day => {
            const [y, m, d] = day.split('-');
            return `${parseInt(d)}/${parseInt(m)}`;
        });
        const data = sortedDays.map(day => ordersByDay[day]);
        
        if (data.length === 0) {
            const ctx = document.getElementById('deliveryChart')?.getContext('2d');
            if (ctx && deliveryChart) {
                deliveryChart.destroy();
                deliveryChart = null;
            }
            return;
        }
        
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
                    label: 'Pedidos Gerados',
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
                                return `${context.raw} pedido(s)`;
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
        const profit = returned - invested;
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
        invested = parseBrazilianCurrency(document.getElementById('financeInvested').value);
        returned = parseBrazilianCurrency(document.getElementById('financeReturned').value);
        profitField = document.getElementById('financeProfit');
    } else if (context === 'edit') {
        invested = parseBrazilianCurrency(document.getElementById('editFinanceInvested').value);
        returned = parseBrazilianCurrency(document.getElementById('editFinanceReturned').value);
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
    const invested = parseBrazilianCurrency(document.getElementById('editFinanceInvested').value);
    const returned = parseBrazilianCurrency(document.getElementById('editFinanceReturned').value);

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

    document.getElementById('extClientName').value = (extracted.clientName || '').toUpperCase();
    document.getElementById('extClientPhone').value = extracted.clientPhone || '';
    document.getElementById('extProducts').value = extracted.products || '';
    document.getElementById('extPayment').value = extracted.paymentMethod || '';
    document.getElementById('extValue').value = extracted.totalValue || '';
    document.getElementById('extObservations').value = extracted.observations || '';
    document.getElementById('extDeliveryTime').value = extracted.deliveryTime || '';
    document.getElementById('extNeighborhood').value = (extracted.neighborhood || '').toUpperCase();

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
        deliveryTime: '',
        neighborhood: ''
    };

    // ========== 1. EXTRAIR LINK DE LOCALIZAÇÃO (Plano A, B e C) ==========
    // Plano A: Google Maps Tradicional e Encurtados
    const mapsPattern = /https?:\/\/(?:maps\.(?:google|app)\.goo\.gl|goo\.gl\/maps|maps\.google\.com|google\.com\/maps)[^\s]*/i;
    
    // Plano B: Link de Coordenadas Diretas (O formato que estava falhando)
    const coordPattern = /https?:\/\/(?:www\.)?google\.com\/maps\?q=[^\s]*/i;
    
    // Plano C: Waze
    const wazePattern = /https?:\/\/(?:www\.)?(?:waze\.com|waze\.to)[^\s]*/i;

    const mapsMatch = conversation.match(mapsPattern) || conversation.match(coordPattern) || conversation.match(wazePattern);
    if (mapsMatch) result.locationUrl = mapsMatch[0];

    // ========== 2. EXTRAIR TELEFONE ==========
    // Lista de números de entregadores para filtrar
    const delivererPhones = Object.keys(DELIVERERS).map(p => p.replace(/\D/g, ''));
    
    // Função auxiliar para filtrar telefone do cliente (remove entregadores)
    const filterClientPhone = (phone) => {
        const cleaned = phone.replace(/\D/g, '');
        if (!cleaned) return '';
        // Se for número de entregador, rejeita
        if (delivererPhones.some(dp => cleaned.includes(dp) || dp.includes(cleaned))) return '';
        return cleaned;
    };
    
    // Padrão 1: WhatsApp export format [timestamp] phone:
    const whatsappSenderMatch = conversation.match(/\[.*?\]\s*\+55\s*(\d{2})\s*(\d{4,5})-?(\d{4})\s*:/);
    if (whatsappSenderMatch) {
        const candidate = '55' + whatsappSenderMatch[1] + whatsappSenderMatch[2] + whatsappSenderMatch[3];
        const filtered = filterClientPhone(candidate);
        if (filtered) result.clientPhone = filtered;
    }
    
    // Padrão 2: +55 43 9132-5844 ou +554391325844 (apenas se ainda não achou)
    if (!result.clientPhone) {
        const allPlusMatches = conversation.match(/\+55\s*(\d{2})\s*(\d{4,5})-?(\d{4})/g);
        if (allPlusMatches) {
            // Pega o último que NÃO é entregador
            for (let i = allPlusMatches.length - 1; i >= 0; i--) {
                const m = allPlusMatches[i].match(/\+55\s*(\d{2})\s*(\d{4,5})-?(\d{4})/);
                if (m) {
                    const candidate = '55' + m[1] + m[2] + m[3];
                    const filtered = filterClientPhone(candidate);
                    if (filtered) { result.clientPhone = filtered; break; }
                }
            }
        }
    }
    
    // Padrão 3: 55\d{10,11} (apenas se ainda não achou)
    if (!result.clientPhone) {
        const phonePattern = /55\d{10,11}/g;
        const phones = conversation.match(phonePattern);
        if (phones && phones.length > 0) {
            for (let i = phones.length - 1; i >= 0; i--) {
                const filtered = filterClientPhone(phones[i]);
                if (filtered) { result.clientPhone = filtered; break; }
            }
        }
    }
    
    // Padrão 4: Apenas números com 10-11 dígitos (último recurso)
    if (!result.clientPhone) {
        const simplePhones = conversation.match(/\d{10,11}/g);
        if (simplePhones && simplePhones.length > 0) {
            for (let i = simplePhones.length - 1; i >= 0; i--) {
                const candidate = '55' + simplePhones[i];
                const filtered = filterClientPhone(candidate);
                if (filtered) { result.clientPhone = filtered; break; }
            }
        }
    }
    
    // Remove espaços e caracteres especiais
    if (result.clientPhone) {
        result.clientPhone = result.clientPhone.replace(/\D/g, '');
    }

    // ========== 3. EXTRAIR NOME DO CLIENTE ==========
    // Padrão 1: ~NOME (Manychat / WhatsApp direto com ~)
    const tildeMatch = conversation.match(/~([A-ZÁ-ÚÃÕÇ][A-ZÁ-ÚÃÕÇa-zá-úãõç]+)/);
    if (tildeMatch && tildeMatch[1]) {
        result.clientName = tildeMatch[1].trim();
    }
    
    // Padrão 2: Primeiro Nome: (Manychat)
    const firstNameMatch = conversation.match(/Primeiro Nome:\s*([A-ZÁ-ÚÃÕÇ][a-zá-úãõç]+)/i);
    if (firstNameMatch && firstNameMatch[1] && !result.clientName) {
        result.clientName = firstNameMatch[1].trim();
    }
    
    // Padrão 3: WhatsApp - agente chamando cliente pelo nome (ex: "Olá Maria", "Maria, tudo bem?")
    if (!result.clientName) {
        // Procura por saudações do agente seguidas de nome próprio
        const agentGreeting = conversation.match(/(?:Olá|Oi|Bom dia|Boa tarde|Boa noite)\s+([A-ZÁ-ÚÃÕÇ][a-zá-úãõç]+)(?:,|!|\s|$)/i);
        if (agentGreeting && agentGreeting[1]) {
            const name = agentGreeting[1].trim();
            if (name.length > 2 && name.length < 20 && !name.match(/^(vc|você|amigo|amiga|querido|querida|tudo|bem|sim|não)$/i)) {
                result.clientName = name;
            }
        }
        // Se não achou com saudação, procura por "Nome, " (agente chamando pelo nome)
        if (!result.clientName) {
            const nameCallMatch = conversation.match(/([A-ZÁ-ÚÃÕÇ][a-zá-úãõç]{2,15}),\s*(?:tudo bem|tudo|vc|você|me|pode|vamos|então|viu|sabe|vou|já|agora|só|estou|está)/i);
            if (nameCallMatch && nameCallMatch[1]) {
                const name = nameCallMatch[1].trim();
                if (name.length > 2 && name.length < 20) {
                    result.clientName = name;
                }
            }
        }
    }
    
    // Padrão 4: Detectar nome nas primeiras linhas da conversa
    if (!result.clientName) {
        for (let i = 0; i < Math.min(8, lines.length); i++) {
            const line = lines[i];
            // Evita linhas com telefone, horários, etc.
            if (line.match(/^\+55|\d{10,}|horas?|hrs?|hoje|\[.*?\]/i)) continue;
            // Nome com 2-4 palavras, letras maiúsculas no início
            const nameMatch = line.match(/^([A-ZÁ-ÚÃÕÇ][a-zá-úãõç]+(?:\s+[A-ZÁ-ÚÃÕÇ][a-zá-úãõç]+){0,3})$/);
            if (nameMatch && nameMatch[1] && nameMatch[1].length > 2 && nameMatch[1].length < 40) {
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
            if ((line.includes('Total') && line.includes(':')) || /✅/.test(line)) {
                pedidoLines.push(line);
                break;
            }
            pedidoLines.push(line);
        }
    }
    
    if (pedidoLines.length > 0) {
        result.products = pedidoLines.join('\n');
    }
    
    // Se o bloco foi encontrado, aplica formatação: linha em branco após título + total com ✅
    if (result.products && result.products.trim() !== '') {
        const prodLines = result.products.split('\n');
        // Se a primeira linha parece um título (bold, all caps, etc), insere linha em branco depois
        if (prodLines.length > 1 && prodLines[0].startsWith('*')) {
            if (prodLines[1] !== '') {
                prodLines.splice(1, 0, '');
            }
        }
        // Garante linha em branco antes da linha de Total
        const totalIdx = prodLines.findIndex(l => /Total\s*:/i.test(l));
        if (totalIdx > 0 && prodLines[totalIdx - 1] !== '') {
            prodLines.splice(totalIdx, 0, '');
        }
        // Verifica se já tem total com ✅, senão adiciona
        const hasTotalWithCheck = prodLines.some(l => /Total.*:.*✅/i.test(l));
        if (!hasTotalWithCheck && result.totalValue) {
            prodLines.push('');
            prodLines.push('-------------------');
            prodLines.push(`Total : ${result.totalValue} ✅`);
        }
        result.products = prodLines.join('\n');
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
            let raw = match[1].replace(/\s/g, '');
            if (raw.includes(',')) {
                result.totalValue = raw.replace(/\./g, '').replace(',', '.');
            } else {
                result.totalValue = raw;
            }
            break;
        }
    }

    // ========== 6. EXTRAIR HORÁRIO DA ENTREGA ==========
    // Primeiro: procura por intervalo de horário (ex: "das 11 até 12:40", "entre as 11 e 12:40")
    const rangeMatch = conversation.match(/(?:das|de|entre)\s+(?:as\s+)?(\d{1,2})(?::(\d{2}))?\s*(?:h|hrs|horas)?\s*(?:até|ate|as|às|e|a)\s+(?:as\s+)?(\d{1,2})(?::(\d{2}))?\s*(?:h|hrs|horas)?/i);
    if (rangeMatch) {
        const h1 = rangeMatch[1];
        const m1 = rangeMatch[2] || '00';
        const h2 = rangeMatch[3];
        const m2 = rangeMatch[4] || '00';
        result.deliveryTime = `Entre as ${h1}:${m1} e ${h2}:${m2}`;
    }
    
    // Dias da semana em português
    const weekdays = /(segunda|ter[cç]a|quarta|quinta|sexta|s[aá]bado|domingo)/i;
    const timePatterns = [
        // Padrão: "na segunda 12:00" / "pra segunda 12:00" / "segunda as 12:00" (com range)
        new RegExp('(?:na|pra|para)?\\s*' + weekdays.source + '\\s*(?:feira)?\\s*(?:as|às)?\\s*(\\d{1,2})(?:[:h](\\d{2}))?', 'i'),
        // Padrão: "segunda-feira as 11" / "segunda feira as 11"
        new RegExp(weekdays.source + '\\s*feira\\s+(?:as|às)\\s*(\\d{1,2})(?::(\\d{2}))?', 'i'),
        // Padrão: "entregar na segunda" / "passar na segunda"
        /(entregamos?|entrega|saindo|chegando|passar|passo)\s+(hoje|amanh[ãa])?\s*[\w\s]*(\d{1,2})\s*(?:h|:)?\s*(\d{0,2})?\s*(?:hrs|horas)?/i,
        /(Hoje|Amanh[ãa])\s+(?:as|às)\s*(\d{1,2})(?::(\d{2}))?\s*(?:h|hrs|horas)?/i,
        /(\d{1,2}):(\d{2})\s*(?:h|hrs)/i,
        /(entrega|saindo|passar)\s+(\d{1,2})\s*(?:h|:)/i
    ];
    
    if (!result.deliveryTime) {
        for (const pattern of timePatterns) {
            const match = conversation.match(pattern);
            if (!match) continue;
            
            // Se capturou dia da semana (grupo 1 do regex composto)
            const dayOfWeek = match[1] && weekdays.test(match[1]) ? match[1] : null;
            const timeHour = match[2] || match[3] || match[1] || '';
            const timeMin = match[3] || match[4] || '';
            
            if (dayOfWeek) {
                let dayName = dayOfWeek;
                const dayMap = { 'terça': 'terca', 'terca': 'terca', 'sábado': 'sabado', 'sabado': 'sabado' };
                dayName = dayMap[dayName.toLowerCase()] || dayName;
                dayName = dayName.charAt(0).toUpperCase() + dayName.slice(1).toLowerCase();
                if (match[1].toLowerCase().includes('feira') || match[0].toLowerCase().includes('feira')) {
                    dayName += '-feira';
                }
                result.deliveryTime = dayName + ' as ' + timeHour + (timeMin ? ':' + timeMin : '') + 'h';
                break;
            }
            
            if (match[1] && (match[1].toLowerCase().includes('hoje') || match[1].toLowerCase().includes('amanhã'))) {
                result.deliveryTime = match[1] + ' ' + (match[2] || '') + (match[3] ? ':' + match[3] : '') + 'h';
            } else if (match[2] && !/^\d{1,2}$/.test(match[1])) {
                result.deliveryTime = (match[1] || 'Hoje') + ' as ' + match[2] + (match[3] ? ':' + match[3] : '') + 'h';
            } else if (match[1] && match[2] && /^\d{1,2}$/.test(match[1])) {
                result.deliveryTime = 'Hoje as ' + match[1] + (match[2] ? ':' + match[2] : '') + 'h';
            }
            if (result.deliveryTime) break;
        }
    }
    
    // Limpa o horário detectado
    if (result.deliveryTime) {
        result.deliveryTime = result.deliveryTime.replace(/\s+/g, ' ').trim();
        result.deliveryTime = result.deliveryTime.replace(/as\s+as/, 'as');
    }

    // ========== 7. EXTRAIR OBSERVAÇÕES (ENDEREÇO) ==========
    let observations = [];
    
    // Palavras-chave que indicam informação de endereço (primeira palavra da linha)
    const addressStartWords = /^(rua|av|avenida|travessa|alameda|praça|casa|apto|bloco|quadra|portão|muro|residencial|condomínio|conjunto|lote|complemento|esquina|fundo|fundos|sobrado|bairro|cep|depois|próximo|ponto|referência|rotatória|contorno|atrás|acima|abaixo)/i;
    // Linhas de template/instrução do atendente (não são endereço do cliente)
    const templateLines = /^(me envie|localização pelo mapa|localização|nome da rua|número da casa|cor do portão|sua esposa|temos algumas|parabéns|vamos|deixa eu|sabe o tamanho|se comprar|sem risco|excelente|eu que te agradeço|maravilha|como vc tem|a sua vc|deus abençoe|sim, vou|vc pode falar|vou fazer|combinado, tenho|vou dar|espera ai|ha sim|anota|blz|hoje,|combinado segunda)/i;
    
    // 7a. Experimenta TODOS os marcadores de localização, fica com o melhor bloco
    const locationMarkers = [];
    for (let i = 0; i < lines.length; i++) {
        const l = lines[i].toLowerCase();
        if (l.includes('location') || l.includes('localização') || l.includes('clique na imagem') || l.includes('ver no mapa')) {
            locationMarkers.push(i);
        }
    }
    
    const pedidoEnd = (fromIdx) => {
        for (let i = fromIdx + 1; i < lines.length; i++) {
            const l = lines[i].toLowerCase();
            if (/^(pedido|📦|👇)/i.test(l) || l.includes('automation') || l.includes('automação') || l.includes('tag adicionada')) return i;
        }
        return lines.length;
    };
    
    const extractBlockAfter = (startIdx) => {
        const block = [];
        const endIdx = pedidoEnd(startIdx);
        const slice = lines.slice(startIdx + 1, endIdx);
        let capturing = false;
        for (const line of slice) {
            if (/^(location|localização|clique|👇|✅|whatssap|whatsapp|qualificar|tag|pedido)/i.test(line)) continue;
            if (/^\d{1,2}:\d{2}/.test(line)) continue;
            if (/^https?:\/\//i.test(line)) continue;
            if (line.length < 3 || line.length > 100) continue;
            if (templateLines.test(line)) {
                if (capturing) break;
                continue;
            }
            const isAddr = addressStartWords.test(line) || /^\d/.test(line) || /rotatória|contorno|referência|próximo|escola|academia/i.test(line);
            if (isAddr) {
                block.push(line);
                capturing = true;
            } else if (capturing) {
                break;
            }
        }
        return block;
    };
    
    // Tenta cada marcador, do primeiro ao último; fica com o bloco mais longo
    let bestBlock = [];
    for (const marker of locationMarkers) {
        const block = extractBlockAfter(marker);
        if (block.length > bestBlock.length) {
            bestBlock = block;
        }
    }
    observations = bestBlock;
    
    // 7b. Complementa com linhas de endereço perto do Pedido (ex: "Ponto de referência")
    if (observations.length > 0) {
        // Pega as últimas 25 linhas antes do Pedido
        let pedidoIdx = lines.findIndex(l => /^pedido/i.test(l));
        if (pedidoIdx < 0) pedidoIdx = lines.length;
        const tail = lines.slice(Math.max(0, pedidoIdx - 25), pedidoIdx);
        for (const line of tail) {
            if (observations.includes(line)) continue;
            if (line.length < 3 || line.length > 100) continue;
            if (templateLines.test(line)) continue;
            if (/^(location|localização|clique|👇|✅|whatssap|whatsapp)/i.test(line)) continue;
            const isAddr = addressStartWords.test(line) || /rotatória|contorno|referência|próximo|escola|academia/i.test(line);
            if (isAddr) {
                observations.push(line);
            }
        }
    }
    
    // 7c. Fallback total: varre toda a conversa por blocos de endereço
    if (observations.length === 0) {
        let currentBlock = [];
        
        for (const line of lines) {
            if (line.length < 3 || line.length > 100) { currentBlock = []; continue; }
            if (/^\d{1,2}:\d{2}/.test(line)) { currentBlock = []; continue; }
            if (/^https?:\/\//i.test(line)) { currentBlock = []; continue; }
            if (templateLines.test(line)) { currentBlock = []; continue; }
            
            const isAddr = addressStartWords.test(line) || /^\d/.test(line) || /rotatória|contorno|referência|próximo|escola|academia/i.test(line);
            
            if (isAddr) {
                currentBlock.push(line);
                if (currentBlock.length > bestBlock.length) {
                    bestBlock = [...currentBlock];
                }
            } else {
                currentBlock = [];
            }
        }
        
        observations = bestBlock.length > 1 ? bestBlock : [];
    }
    
    if (observations.length > 0) {
        result.observations = observations.join('\n');
    }

    // ========== 8. EXTRAIR BAIRRO ==========
    const bairroPatterns = [
        /Bairro\s*:?\s*([A-ZÁ-ÚÃÕÇ][A-ZÁ-ÚÃÕÇa-zá-úãõç\s]+)/i,
        /Bairro\s+do\s+Cliente\s*:?\s*([A-ZÁ-ÚÃÕÇ][A-ZÁ-ÚÃÕÇa-zá-úãõç\s]+)/i,
        /(?:no\s+)?bairro\s+([A-ZÁ-ÚÃÕÇ][A-ZÁ-ÚÃÕÇa-zá-úãõç\s]{2,30})/i,
        /Bairro\s*:\s*([^\n,]+)/i
    ];
    for (const pattern of bairroPatterns) {
        const match = conversation.match(pattern);
        if (match && match[1]) {
            const bairro = match[1].trim();
            if (bairro.length > 2 && bairro.length < 40) {
                result.neighborhood = bairro;
                break;
            }
        }
    }

    // ========== 9. EXTRAIR FORMA DE PAGAMENTO ==========
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
    if (!result.paymentMethod) {
        result.paymentMethod = 'PIX';
    }

    return result;
}

function extractFallbackProducts(lines) {
    const currencyPattern = /(r?\$?\s*\d{1,3}(\.\d{3})*,\d{2})/i;
    const items = [];
    let totalValue = '';
    
    for (const line of lines) {
        const totalMatch = line.match(/Total\s*:?\s*R?\$?\s*(\d{1,3}(?:[\.\s]\d{3})*[.,]\d{2})/i);
        if (totalMatch && totalMatch[1]) {
            totalValue = totalMatch[1].replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
            break;
        }
    }

    const tail = lines.slice(-15);
    for (const line of tail) {
        if (line.includes(':') && currencyPattern.test(line) && !/^total/i.test(line)) {
            const [label, value] = line.split(':', 2);
            if (label && label.trim() && value && value.trim()) items.push(`${label.trim()}: ${value.trim()}`);
        } else if (currencyPattern.test(line) && line.length < 80 && !/^\d/.test(line)) {
            items.push(line.trim());
        }
    }
    
    if (items.length === 0) return 'Produto não identificado - revisar conversa';
    
    let productsText = items.join('\n');
    const linesProd = productsText.split('\n');
    if (linesProd.length > 1 && !linesProd[0].startsWith('*')) {
        linesProd.splice(1, 0, '');
        productsText = linesProd.join('\n');
    }
    if (totalValue) {
        const totalNumerico = parseFloat(totalValue);
        if (!isNaN(totalNumerico)) {
            productsText += `\n-------------------\nTotal : ${formatCurrency(totalNumerico)} ✅`;
        }
    }
    return productsText;
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
        let textToCopy = `👇 ENTREGA CLIENTE: ${clientName}\n${cleanClientPhone}\n\n`;
        
        if (bairroDisplay) {
            textToCopy += `🏠 *BAIRRO : ${bairroDisplay}*\n\n`;
        }
        
        textToCopy += `💰 VALOR DO PEDIDO: ${valorDisplay}\n⏰ HORÁRIO: ${horarioDisplay}\n\n📍 LOCALIZAÇÃO: \n${localDisplay}\n\n${directWhatsAppLink}`;

        document.getElementById('linkOutput').textContent = textToCopy;
        document.getElementById('generatedLinkSection').classList.remove('hidden');

        // Abre WhatsApp do ENTREGADOR com o link direto
        const delivererPhone = selectedDeliverer;
        const whatsappToDeliverer = `https://api.whatsapp.com/send?phone=${delivererPhone}&text=${encodeURIComponent(textToCopy)}`;
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

// ✅ PARSE ROBUSTO DE MOEDA BRASILEIRA (lida com R$ 1.500,00 / 1.500,00 / 1500,00 / 500.00)
function parseBrazilianCurrency(val) {
    if (val === null || val === undefined || val === '') return 0;
    if (typeof val === 'number') return val;
    let cleaned = String(val).replace(/R\$\s*/g, '').trim();
    // Se tiver vírgula, é formato BR: remove TODOS os pontos, depois troca a ÚLTIMA vírgula por ponto
    if (cleaned.includes(',')) {
        cleaned = cleaned.replace(/\./g, '');
        const lastComma = cleaned.lastIndexOf(',');
        cleaned = cleaned.substring(0, lastComma) + '.' + cleaned.substring(lastComma + 1);
    }
    // Se não tiver vírgula, só remove pontos (milhar BR sem vírgula) ou mantém (formato US)
    return parseFloat(cleaned) || 0;
}

function formatCurrency(value) {
    if (value === null || value === undefined) return 'R$ 0,00';
    const num = typeof value === 'string' ? parseBrazilianCurrency(value) : parseFloat(value);
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
    const invested = parseBrazilianCurrency(investedEl.value);
    const returned = parseBrazilianCurrency(returnedEl.value);

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
        // Re-trigger auto-fill para a data atual com os pedidos mais recentes
        autoFillReturned('financeDate', 'financeReturned');
        
        showToast('✅ Registro salvo e relatório atualizado!', 'success');
    } catch (err) {
        showToast('❌ Erro de conexão: ' + err.message, 'error');
        console.error(err);
    }
}

// ✅ AUTO-FILL: Preenche o Valor de Retorno com a soma dos pedidos do dia selecionado
function autoFillReturned(dateInputId, returnedInputId) {
    const dateInput = document.getElementById(dateInputId);
    const returnedInput = document.getElementById(returnedInputId);
    if (!dateInput || !returnedInput) return;
    const selectedDate = dateInput.value;
    if (!selectedDate) return;
    // Soma todos os pedidos que ocorreram nessa data
    let total = 0;
    orders.forEach(o => {
        if (!o.created_at || !o.total_value) return;
        const orderDate = o.created_at.includes('T') ? o.created_at.split('T')[0] : o.created_at;
        if (orderDate === selectedDate) {
            total += parseBrazilianCurrency(o.total_value);
        }
    });
    if (total > 0) {
        returnedInput.value = total.toFixed(2);
    } else {
        returnedInput.value = '';
    }
    // Atualiza o preview do lucro
    if (dateInputId === 'financeDate') {
        calculateAutoProfit('finance');
    } else if (dateInputId === 'editFinanceDate') {
        calculateAutoProfit('edit');
    }
}

function setDefaultDates() {
    const today = new Date().toISOString().split('T')[0];
    const financeDate = document.getElementById('financeDate');
    if (financeDate) {
        financeDate.value = today;
        financeDate.addEventListener('change', () => autoFillReturned('financeDate', 'financeReturned'));
        // Já carrega o total do dia atual após um breve delay (para garantir que orders esteja populado)
        setTimeout(() => autoFillReturned('financeDate', 'financeReturned'), 500);
    }
    const editFinanceDate = document.getElementById('editFinanceDate');
    if (editFinanceDate) {
        editFinanceDate.addEventListener('change', () => autoFillReturned('editFinanceDate', 'editFinanceReturned'));
    }
    const pendingDate = document.getElementById('pendingPurchaseDate'); if (pendingDate) pendingDate.value = today;
    const pendingTime = document.getElementById('pendingPurchaseTime'); if (pendingTime) pendingTime.value = '';
    const receivableDate = document.getElementById('receivableDate'); if (receivableDate) receivableDate.value = today;
}