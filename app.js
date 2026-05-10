// ===== Card Manager App =====
const STORAGE_KEY = 'cards_manager_data';
const ITEMS_PER_PAGE = 15;
let cards = [];
let currentPage = 1;
let deleteTargetId = null;

// ===== Init =====
document.addEventListener('DOMContentLoaded', () => {
    loadCards();
    setupEventListeners();
    navigateTo('dashboard');
});

// ===== Data =====
function loadCards() {
    const saved = localStorage.getItem(STORAGE_KEY);
    cards = saved ? JSON.parse(saved) : [];
}

function saveCards() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

// ===== Event Listeners =====
function setupEventListeners() {
    // Navigation
    document.querySelectorAll('.nav-item[data-page]').forEach(btn => {
        btn.addEventListener('click', () => navigateTo(btn.dataset.page));
    });

    // Mobile menu
    document.getElementById('menu-toggle').addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('open');
    });

    // Search
    document.getElementById('global-search').addEventListener('input', debounce((e) => {
        if (document.getElementById('page-cards').classList.contains('active')) {
            currentPage = 1;
            renderCardsTable();
        } else {
            navigateTo('cards');
            currentPage = 1;
            renderCardsTable();
        }
    }, 300));

    // Add card button
    document.getElementById('btn-add-card').addEventListener('click', openAddModal);

    // Form
    document.getElementById('card-form').addEventListener('submit', handleSaveCard);
    document.getElementById('modal-close').addEventListener('click', closeModal);
    document.getElementById('btn-cancel').addEventListener('click', closeModal);
    document.getElementById('modal-overlay').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) closeModal();
    });

    // Delete modal
    document.getElementById('btn-cancel-delete').addEventListener('click', closeDeleteModal);
    document.getElementById('btn-confirm-delete').addEventListener('click', confirmDelete);
    document.getElementById('delete-modal-overlay').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) closeDeleteModal();
    });

    // Filters
    ['filter-duration', 'filter-paid', 'filter-sort'].forEach(id => {
        document.getElementById(id).addEventListener('change', () => {
            currentPage = 1;
            renderCardsTable();
        });
    });

    // Import/Export
    document.getElementById('btn-import-excel').addEventListener('click', () => {
        document.getElementById('import-file').click();
    });
    document.getElementById('import-file').addEventListener('change', handleImport);
    document.getElementById('btn-export-excel').addEventListener('click', handleExport);

    // Keyboard
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') { closeModal(); closeDeleteModal(); }
    });
}

// ===== Navigation =====
function navigateTo(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item[data-page]').forEach(n => n.classList.remove('active'));

    document.getElementById('page-' + page).classList.add('active');
    const navBtn = document.querySelector(`.nav-item[data-page="${page}"]`);
    if (navBtn) navBtn.classList.add('active');

    document.getElementById('sidebar').classList.remove('open');

    if (page === 'dashboard') renderDashboard();
    else if (page === 'cards') renderCardsTable();
    else if (page === 'debts') renderDebts();
}

// ===== Dashboard =====
function renderDashboard() {
    const total = cards.length;
    const paid = cards.filter(c => c.paid === 'نعم').length;
    const unpaid = total - paid;
    const totalDebt = cards.reduce((s, c) => s + (Number(c.debt) || 0), 0);

    animateCounter('stat-total', total);
    animateCounter('stat-paid', paid);
    animateCounter('stat-unpaid', unpaid);
    animateCounter('stat-debt', totalDebt);

    // Duration breakdown
    const durCounts = {};
    cards.forEach(c => { durCounts[c.duration] = (durCounts[c.duration] || 0) + 1; });
    const maxCount = Math.max(...Object.values(durCounts), 1);
    const colors = ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b'];
    const barsEl = document.getElementById('duration-bars');
    barsEl.innerHTML = '';

    Object.entries(durCounts).sort((a, b) => b[1] - a[1]).forEach(([dur, count], i) => {
        const pct = Math.round((count / maxCount) * 100);
        barsEl.innerHTML += `
            <div class="dur-bar-item">
                <span class="dur-bar-label">${dur}</span>
                <div class="dur-bar-track">
                    <div class="dur-bar-fill" style="width:${pct}%;background:${colors[i % colors.length]}">${count}</div>
                </div>
            </div>`;
    });
    if (Object.keys(durCounts).length === 0) {
        barsEl.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:40px 0">لا توجد بيانات</p>';
    }

    // Recent cards
    const recentEl = document.getElementById('recent-cards');
    const recent = [...cards].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 8);
    recentEl.innerHTML = recent.length === 0
        ? '<p style="color:var(--text-muted);text-align:center;padding:40px 0">لا توجد بطاقات</p>'
        : recent.map(c => `
            <div class="recent-item">
                <div>
                    <div class="recent-name">${escapeHtml(c.name)}</div>
                    <div class="recent-num">${c.cardNumber}</div>
                </div>
                <span class="recent-date">${formatDate(c.date)}</span>
            </div>`).join('');
}

function animateCounter(id, target) {
    const el = document.getElementById(id);
    const start = parseInt(el.textContent.replace(/,/g, '')) || 0;
    const duration = 600;
    const startTime = performance.now();

    function update(now) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = Math.round(start + (target - start) * eased).toLocaleString('ar-DZ');
        if (progress < 1) requestAnimationFrame(update);
    }
    requestAnimationFrame(update);
}

// ===== Cards Table =====
function getFilteredCards() {
    const search = document.getElementById('global-search').value.trim().toLowerCase();
    const durFilter = document.getElementById('filter-duration').value;
    const paidFilter = document.getElementById('filter-paid').value;
    const sort = document.getElementById('filter-sort').value;

    let filtered = cards.filter(c => {
        if (search && !c.name.toLowerCase().includes(search) && !c.cardNumber.toString().includes(search)) return false;
        if (durFilter && c.duration !== durFilter) return false;
        if (paidFilter && c.paid !== paidFilter) return false;
        return true;
    });

    filtered.sort((a, b) => {
        if (sort === 'insertion') return (a.createdAt || 0) - (b.createdAt || 0);
        if (sort === 'newest') return new Date(b.date) - new Date(a.date);
        if (sort === 'oldest') return new Date(a.date) - new Date(b.date);
        if (sort === 'name') return a.name.localeCompare(b.name, 'ar');
        if (sort === 'debt-high') return (Number(b.debt) || 0) - (Number(a.debt) || 0);
        return 0;
    });

    return filtered;
}

function renderCardsTable() {
    const filtered = getFilteredCards();
    const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
    if (currentPage > totalPages) currentPage = totalPages;

    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const pageCards = filtered.slice(start, start + ITEMS_PER_PAGE);

    const tbody = document.getElementById('cards-tbody');
    const emptyState = document.getElementById('empty-state');

    if (filtered.length === 0) {
        tbody.innerHTML = '';
        emptyState.style.display = 'block';
    } else {
        emptyState.style.display = 'none';
        tbody.innerHTML = pageCards.map(c => `
            <tr>
                <td class="card-number">${c.cardNumber}</td>
                <td>${escapeHtml(c.name)}</td>
                <td>${c.duration}</td>
                <td>
                    <span class="badge ${c.paid === 'نعم' ? 'badge-paid' : 'badge-unpaid'}">
                        <span class="badge-dot"></span>
                        ${c.paid === 'نعم' ? 'مدفوع' : 'غير مدفوع'}
                    </span>
                </td>
                <td>${Number(c.debt || 0).toLocaleString('ar-DZ')} دج</td>
                <td>${formatDate(c.date)}</td>
                <td>
                    <div class="actions-cell">
                        <button class="btn-icon edit" onclick="editCard('${c.id}')" title="تعديل">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                        </button>
                        <button class="btn-icon delete" onclick="deleteCard('${c.id}')" title="حذف">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"/>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                            </svg>
                        </button>
                    </div>
                </td>
            </tr>`).join('');
    }

    renderPagination(totalPages);
}

function renderPagination(totalPages) {
    const el = document.getElementById('pagination');
    if (totalPages <= 1) { el.innerHTML = ''; return; }

    let html = `<button class="page-btn" onclick="goToPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>&rsaquo;</button>`;

    const range = getPageRange(currentPage, totalPages);
    range.forEach(p => {
        if (p === '...') html += '<span style="color:var(--text-muted);padding:0 4px">...</span>';
        else html += `<button class="page-btn ${p === currentPage ? 'active' : ''}" onclick="goToPage(${p})">${p}</button>`;
    });

    html += `<button class="page-btn" onclick="goToPage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>&lsaquo;</button>`;
    el.innerHTML = html;
}

function getPageRange(current, total) {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    if (current <= 3) return [1, 2, 3, 4, '...', total];
    if (current >= total - 2) return [1, '...', total - 3, total - 2, total - 1, total];
    return [1, '...', current - 1, current, current + 1, '...', total];
}

function goToPage(p) {
    const filtered = getFilteredCards();
    const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
    if (p < 1 || p > totalPages) return;
    currentPage = p;
    renderCardsTable();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ===== Debts Page =====
function renderDebts() {
    const debtCards = cards.filter(c => Number(c.debt) > 0);
    const totalDebt = debtCards.reduce((s, c) => s + Number(c.debt), 0);
    const avgDebt = debtCards.length > 0 ? Math.round(totalDebt / debtCards.length) : 0;

    document.getElementById('debts-summary').innerHTML = `
        <div class="debt-stat">
            <div class="debt-stat-value">${debtCards.length}</div>
            <div class="debt-stat-label">عدد المدينين</div>
        </div>
        <div class="debt-stat">
            <div class="debt-stat-value">${totalDebt.toLocaleString('ar-DZ')} دج</div>
            <div class="debt-stat-label">إجمالي الديون</div>
        </div>
        <div class="debt-stat">
            <div class="debt-stat-value">${avgDebt.toLocaleString('ar-DZ')} دج</div>
            <div class="debt-stat-label">متوسط الدين</div>
        </div>`;

    const tbody = document.getElementById('debts-tbody');
    tbody.innerHTML = debtCards.length === 0
        ? '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:40px">لا توجد ديون 🎉</td></tr>'
        : debtCards.sort((a, b) => Number(b.debt) - Number(a.debt)).map(c => `
            <tr>
                <td class="card-number">${c.cardNumber}</td>
                <td>${escapeHtml(c.name)}</td>
                <td>${c.duration}</td>
                <td style="color:var(--orange);font-weight:700">${Number(c.debt).toLocaleString('ar-DZ')} دج</td>
                <td>${formatDate(c.date)}</td>
                <td>
                    <button class="btn btn-sm btn-primary" onclick="markPaid('${c.id}')">تسديد</button>
                </td>
            </tr>`).join('');
}

function markPaid(id) {
    const card = cards.find(c => c.id === id);
    if (card) {
        card.debt = 0;
        card.paid = 'نعم';
        saveCards();
        renderDebts();
        showToast('تم تسديد الدين بنجاح', 'success');
    }
}

// ===== Modal CRUD =====
function openAddModal() {
    document.getElementById('modal-title').textContent = 'إضافة بطاقة جديدة';
    document.getElementById('btn-save').textContent = 'حفظ البطاقة';
    document.getElementById('card-form').reset();
    document.getElementById('card-edit-id').value = '';
    document.getElementById('card-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('card-debt').value = '0';
    document.getElementById('modal-overlay').classList.add('active');
}

function editCard(id) {
    const card = cards.find(c => c.id === id);
    if (!card) return;

    document.getElementById('modal-title').textContent = 'تعديل البطاقة';
    document.getElementById('btn-save').textContent = 'تحديث';
    document.getElementById('card-edit-id').value = card.id;
    document.getElementById('card-number').value = card.cardNumber;
    document.getElementById('card-name').value = card.name;
    document.getElementById('card-duration').value = card.duration;
    document.getElementById('card-paid').value = card.paid;
    document.getElementById('card-debt').value = card.debt || 0;
    document.getElementById('card-date').value = card.date;
    document.getElementById('modal-overlay').classList.add('active');
}

function closeModal() {
    document.getElementById('modal-overlay').classList.remove('active');
}

function handleSaveCard(e) {
    e.preventDefault();

    const editId = document.getElementById('card-edit-id').value;
    const cardData = {
        cardNumber: document.getElementById('card-number').value.trim(),
        name: document.getElementById('card-name').value.trim(),
        duration: document.getElementById('card-duration').value,
        paid: document.getElementById('card-paid').value,
        debt: Number(document.getElementById('card-debt').value) || 0,
        date: document.getElementById('card-date').value,
    };

    if (cardData.paid === 'لا' && cardData.debt <= 0) {
        showToast('الرجاء إدخال مبلغ الدين لأن البطاقة غير مدفوعة', 'error');
        document.getElementById('card-debt').focus();
        return;
    }

    if (editId) {
        const idx = cards.findIndex(c => c.id === editId);
        if (idx !== -1) {
            cards[idx] = { ...cards[idx], ...cardData };
            showToast('تم تحديث البطاقة بنجاح', 'success');
        }
    } else {
        cards.push({ id: generateId(), createdAt: Date.now(), ...cardData });
        showToast('تمت إضافة البطاقة بنجاح', 'success');
    }

    saveCards();
    closeModal();
    refreshCurrentPage();
}

// ===== Delete =====
function deleteCard(id) {
    const card = cards.find(c => c.id === id);
    if (!card) return;
    deleteTargetId = id;
    document.getElementById('delete-card-info').textContent = `${card.name} - ${card.cardNumber}`;
    document.getElementById('delete-modal-overlay').classList.add('active');
}

function closeDeleteModal() {
    document.getElementById('delete-modal-overlay').classList.remove('active');
    deleteTargetId = null;
}

function confirmDelete() {
    if (deleteTargetId) {
        cards = cards.filter(c => c.id !== deleteTargetId);
        saveCards();
        showToast('تم حذف البطاقة', 'info');
        closeDeleteModal();
        refreshCurrentPage();
    }
}

// ===== Import Excel =====
function handleImport(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (evt) {
        try {
            const wb = XLSX.read(evt.target.result, { type: 'array', cellDates: true });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

            let imported = 0;
            for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                const cardNum = row[0];
                const name = row[3];

                if (!cardNum && !name) continue;

                const duration = row[6] || 'عام';
                const paid = row[9] || 'نعم';
                const debt = Number(row[12]) || 0;
                let date = row[15];

                if (date instanceof Date) {
                    date = date.toISOString().split('T')[0];
                } else if (typeof date === 'number') {
                    const d = new Date((date - 25569) * 86400 * 1000);
                    date = d.toISOString().split('T')[0];
                } else {
                    date = new Date().toISOString().split('T')[0];
                }

                // Avoid duplicates by card number
                const exists = cards.some(c => c.cardNumber == cardNum);
                if (!exists) {
                    cards.push({
                        id: generateId(),
                        cardNumber: String(cardNum),
                        name: String(name || ''),
                        duration: String(duration),
                        paid: String(paid),
                        debt: debt,
                        date: date,
                    });
                    imported++;
                }
            }

            saveCards();
            showToast(`تم استيراد ${imported} بطاقة بنجاح`, 'success');
            refreshCurrentPage();
        } catch (err) {
            console.error(err);
            showToast('خطأ في قراءة الملف', 'error');
        }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
}

// ===== Export Excel =====
function handleExport() {
    if (cards.length === 0) {
        showToast('لا توجد بطاقات للتصدير', 'error');
        return;
    }

    const data = [['رقم البطاقة', 'الاسم', 'المدة', 'خالص', 'الدين', 'التاريخ']];
    cards.forEach(c => {
        data.push([c.cardNumber, c.name, c.duration, c.paid, c.debt, c.date]);
    });

    const ws = XLSX.utils.aoa_to_sheet(data);
    // Set column widths
    ws['!cols'] = [
        { wch: 14 }, { wch: 22 }, { wch: 10 },
        { wch: 10 }, { wch: 10 }, { wch: 14 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'البطاقات');
    XLSX.writeFile(wb, 'البطاقات.xlsx');
    showToast('تم تصدير الملف بنجاح', 'success');
}

// ===== Helpers =====
function refreshCurrentPage() {
    const activePage = document.querySelector('.page.active');
    if (activePage) {
        const pageId = activePage.id.replace('page-', '');
        navigateTo(pageId);
    }
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    try {
        const d = new Date(dateStr);
        return d.toLocaleDateString('ar-DZ', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch { return dateStr; }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const icons = {
        success: '✓',
        error: '✕',
        info: 'ℹ'
    };
    toast.innerHTML = `<span>${icons[type] || 'ℹ'}</span> ${message}`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(20px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function debounce(fn, ms) {
    let timer;
    return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), ms);
    };
}

// Make functions global for inline onclick
window.editCard = editCard;
window.deleteCard = deleteCard;
window.goToPage = goToPage;
window.markPaid = markPaid;
