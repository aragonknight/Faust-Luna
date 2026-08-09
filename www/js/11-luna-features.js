// ============================================================
// FITUR BARU FAUSTLUNA STORE:
//   1) Dashboard Kesehatan Toko   2) Riwayat Aktivitas (terstruktur)
//   3) Luna Assistant             4) Kalender Operasional
//   5) Statistik Akun ML
// File ini murni TAMBAHAN — tidak mengubah logic inti yang sudah ada,
// cuma dipanggil dari renderAll()/goHome() dan event listener baru.
// ============================================================

// ------------------------------------------------------------
// 1) RIWAYAT AKTIVITAS TERSTRUKTUR
// ------------------------------------------------------------
const ACTIVITY_ICONS = {
    transaksi: '🧾', hapus: '🗑️', akun: '🛡️', pembayaran: '💰', wdp: '🎁',
    login: '🔑', logout: '🚪', sync: '☁️', kalender: '📅', sistem: '⚙️'
};
const ACTIVITY_LABELS = {
    semua: 'Semua', transaksi: 'Transaksi', hapus: 'Hapus', akun: 'Akun',
    pembayaran: 'Pembayaran', wdp: 'WDP', login: 'Login', logout: 'Logout',
    sync: 'Sinkronisasi', kalender: 'Kalender'
};
let activeActivityFilter = 'semua';

// Dipanggil dari titik-titik aksi penting di seluruh app (lihat komentar di
// masing-masing handler). Menyimpan entry terstruktur (waktu, jenis, data
// terpengaruh) SEKALIGUS tetap memanggil pushLog() lama supaya kompatibel
// dengan skema sinkronisasi (state.logs) yang sudah ada sebelumnya.
function logActivity(type, message, meta) {
    if (!state.activityLog) state.activityLog = [];
    state.activityLog.unshift({ time: new Date().toISOString(), type: type || 'sistem', message, meta: meta || null });
    if (state.activityLog.length > 300) state.activityLog.length = 300;
    if (typeof pushLog === 'function') pushLog(message); // simpan juga ke log mentah lama + saveState() + renderLogs()
    renderActivityLog();
}

function filterActivityLog(type) {
    activeActivityFilter = type;
    renderActivityLog();
}

function clearActivityLog() {
    showConfirm('Bersihkan semua riwayat aktivitas? Tindakan ini tidak bisa dibatalkan.', () => {
        state.activityLog = [];
        state.logs = [];
        saveState();
        renderActivityLog();
        renderLogs();
        showToast('🗑️ Riwayat aktivitas dibersihkan', 'success');
    });
}

function renderActivityLog() {
    const container = document.getElementById('activity-log-list');
    if (!container) return;

    document.querySelectorAll('.activity-filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-atype') === activeActivityFilter);
    });

    const list = (state.activityLog || []);
    const filtered = activeActivityFilter === 'semua' ? list : list.filter(l => l.type === activeActivityFilter);

    if (filtered.length === 0) {
        container.innerHTML = maskotEmptyHTML('kosong', 'Belum ada aktivitas tercatat untuk filter ini.');
        return;
    }

    container.innerHTML = filtered.slice(0, 150).map(entry => {
        const d = new Date(entry.time);
        const timeLabel = isNaN(d.getTime()) ? '-' : d.toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
        return `
        <div class="activity-item">
            <span class="act-icon">${ACTIVITY_ICONS[entry.type] || '📌'}</span>
            <div class="act-body">
                <div class="act-msg">${entry.message}</div>
                <div class="act-time">${timeLabel} • ${ACTIVITY_LABELS[entry.type] || entry.type}</div>
            </div>
        </div>`;
    }).join('');
}

// ------------------------------------------------------------
// 2) DASHBOARD KESEHATAN TOKO
// ------------------------------------------------------------
function computeStoreHealth(productKey) {
    const todayStr = new Date().toISOString().split('T')[0];
    const allTxAll = state.transactions || [];
    // Kalau productKey diisi (dipanggil dari dashboard tiap produk), filter transaksi
    // supaya angka omzet/profit/dsb yang ditampilkan cuma punya produk itu — bukan
    // gabungan semua produk. Kalau kosong (dipanggil dari Luna Assistant di Home),
    // tetap hitung gabungan semua produk seperti semula.
    const allTx = productKey ? allTxAll.filter(t => TYPE_TO_PRODUCT[t.starlightType] === productKey) : allTxAll;
    const todayTx = allTx.filter(t => t.purchaseDate === todayStr);

    const sumOmzet = list => list.reduce((s, t) => s + ((parseFloat(t.priceSelling) || 0) - (parseFloat(t.priceDiscount) || 0)), 0);
    const sumProfit = list => list.reduce((s, t) => s + (parseFloat(t.netProfit) || 0), 0);

    const omzetToday = sumOmzet(todayTx);
    const profitToday = sumProfit(todayTx);
    const totalTransaksiToday = todayTx.length;
    const pesananBelumSelesai = allTx.filter(t => t.status !== 'Sudah Dikirim').length;

    // WDP & akun kasir (gift slot/DM pool) adalah konsep KHUSUS Mobile Legends —
    // game lain top up langsung ke UID pembeli tanpa akun kasir. Jadi kedua metrik
    // ini cuma dihitung kalau lagi di produk Mobile Legends (atau gabungan di Home).
    const isMobileLegContext = !productKey || productKey === 'mobileleg';
    const wdpBelumDiklaim = isMobileLegContext && typeof getPendingWdpClaims === 'function' ? getPendingWdpClaims().length : 0;
    const akunLimit = isMobileLegContext ? (state.accounts || []).filter(a => (a.gift_slots || 0) <= 0) : [];
    const akunMendekati = isMobileLegContext ? (state.accounts || []).filter(a => (a.gift_slots || 0) === 1) : [];

    // Hutang pembeli tetap relevan di semua produk (transaksi apapun bisa berstatus
    // "Hutang"), jadi ikut difilter per produk juga.
    const totalHutang = allTx.reduce((s, t) => s + (typeof getTxOutstandingDebt === 'function' ? getTxOutstandingDebt(t) : 0), 0);

    const now = new Date();
    const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - now.getDay()); startOfWeek.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const omzetWeek = sumOmzet(allTx.filter(t => t.purchaseDate && new Date(t.purchaseDate) >= startOfWeek));
    const omzetMonth = sumOmzet(allTx.filter(t => t.purchaseDate && new Date(t.purchaseDate) >= startOfMonth));

    const chartData = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        const dStr = d.toISOString().split('T')[0];
        chartData.push({ label: d.toLocaleDateString('id-ID', { weekday: 'short' }), value: sumOmzet(allTx.filter(t => t.purchaseDate === dStr)) });
    }

    const yd = new Date(); yd.setDate(yd.getDate() - 1);
    const omzetYesterday = sumOmzet(allTx.filter(t => t.purchaseDate === yd.toISOString().split('T')[0]));

    return { todayStr, omzetToday, profitToday, totalTransaksiToday, pesananBelumSelesai, wdpBelumDiklaim, akunLimit, akunMendekati, totalHutang, omzetWeek, omzetMonth, chartData, omzetYesterday, isMobileLegContext };
}

function renderHomeHealthDashboard() {
    const grid = document.getElementById('health-grid');
    if (!grid) return null; // elemen cuma ada di halaman Dashboard tiap produk (page-dashboard)

    // Dipanggil setelah currentProduct di-set (lewat switchToProduct -> renderAll),
    // jadi kartu ini otomatis nampilin data khusus produk yang lagi dibuka.
    const h = computeStoreHealth(currentProduct);
    const fmt = n => `Rp ${Math.round(n || 0).toLocaleString('id-ID')}`;

    const mlOnlyRows = h.isMobileLegContext ? `
        <div class="health-metric-card ${h.wdpBelumDiklaim > 0 ? 'hm-warn' : 'hm-ok'}"><span class="hm-icon">🎁</span><span class="hm-label">WDP Belum Diklaim</span><span class="hm-value">${h.wdpBelumDiklaim}</span></div>
        <div class="health-metric-card ${h.akunLimit.length > 0 ? 'hm-warn' : 'hm-ok'}"><span class="hm-icon">🛡️</span><span class="hm-label">Akun Limit / Hampir</span><span class="hm-value">${h.akunLimit.length} / ${h.akunMendekati.length}</span></div>
    ` : '';

    grid.innerHTML = `
        <div class="health-metric-card"><span class="hm-icon">💰</span><span class="hm-label">Omzet Hari Ini</span><span class="hm-value privacy-hide">${fmt(h.omzetToday)}</span></div>
        <div class="health-metric-card"><span class="hm-icon">📈</span><span class="hm-label">Profit Hari Ini</span><span class="hm-value privacy-hide">${fmt(h.profitToday)}</span></div>
        <div class="health-metric-card"><span class="hm-icon">🧾</span><span class="hm-label">Total Transaksi</span><span class="hm-value">${h.totalTransaksiToday}</span></div>
        <div class="health-metric-card ${h.pesananBelumSelesai > 0 ? 'hm-warn' : 'hm-ok'}"><span class="hm-icon">📦</span><span class="hm-label">Pesanan Belum Selesai</span><span class="hm-value">${h.pesananBelumSelesai}</span></div>
        ${mlOnlyRows}
        <div class="health-metric-card ${h.totalHutang > 0 ? 'hm-warn' : 'hm-ok'}" style="grid-column: span 2;"><span class="hm-icon">🧮</span><span class="hm-label">Total Hutang Pembeli</span><span class="hm-value privacy-hide">${fmt(h.totalHutang)}</span></div>
    `;

    const cmp = document.getElementById('health-compare-row');
    if (cmp) {
        cmp.innerHTML = `
            <div class="health-compare-box"><span class="lbl">Hari Ini</span><span class="val privacy-hide">${fmt(h.omzetToday)}</span></div>
            <div class="health-compare-box"><span class="lbl">Minggu Ini</span><span class="val privacy-hide">${fmt(h.omzetWeek)}</span></div>
            <div class="health-compare-box"><span class="lbl">Bulan Ini</span><span class="val privacy-hide">${fmt(h.omzetMonth)}</span></div>
        `;
    }

    const chartWrap = document.getElementById('health-sales-chart');
    if (chartWrap) {
        const maxVal = Math.max(...h.chartData.map(d => d.value), 1);
        chartWrap.innerHTML = h.chartData.map(d => `
            <div class="mini-chart-bar-col" title="Rp ${Math.round(d.value).toLocaleString('id-ID')}">
                <div class="mini-chart-bar" style="height:${Math.max(4, Math.round((d.value / maxVal) * 100))}%;"></div>
                <div class="mini-chart-bar-label">${d.label}</div>
            </div>
        `).join('');
    }
    initPrivacy();
    return h;
}

// ------------------------------------------------------------
// 3) LUNA ASSISTANT — komentar kontekstual berdasar kondisi toko
// ------------------------------------------------------------
function generateLunaInsights(health) {
    const h = health || computeStoreHealth();
    const hour = new Date().getHours();
    const greeting = hour < 11 ? 'Selamat pagi' : hour < 15 ? 'Selamat siang' : hour < 19 ? 'Selamat sore' : 'Selamat malam';
    const msgs = [];

    msgs.push({ mood: 'hai', type: 'info', text: `🌙 ${greeting}! Hari ini ada ${h.totalTransaksiToday} transaksi masuk dengan omzet Rp ${Math.round(h.omzetToday).toLocaleString('id-ID')}.` });

    if (h.omzetToday > h.omzetYesterday && h.omzetYesterday > 0) {
        msgs.push({ mood: 'yeay', type: 'good', text: `✨ Wah, penjualan hari ini meningkat dibanding kemarin! Pertahankan terus ya✨` });
    }
    if (h.pesananBelumSelesai > 0) {
        msgs.push({ mood: 'pengingat', type: 'warn', text: `📦 Ada ${h.pesananBelumSelesai} pesanan yang belum selesai dikirim. Sebaiknya dicek dulu ya.` });
    }
    if (h.wdpBelumDiklaim > 0) {
        msgs.push({ mood: 'pengingat', type: 'warn', text: `🎁 Ada ${h.wdpBelumDiklaim} jatah WDP yang sudah kebuka tapi belum diklaim. Jangan sampai kelewat!` });
    }
    if (h.totalHutang > 0) {
        msgs.push({ mood: 'hmm', type: 'warn', text: `Hmm... ada hutang pembeli sekitar Rp ${Math.round(h.totalHutang).toLocaleString('id-ID')} yang belum lunas. Sebaiknya dicek dulu sebelum menerima pesanan baru.` });
    }
    if (h.akunLimit.length > 0) {
        msgs.push({ mood: 'hmm', type: 'warn', text: `🛡️ ${h.akunLimit.length} akun kasir sudah limit gift bulan ini. Pakai akun lain dulu ya.` });
    }

    if (typeof getUpcomingCalendarEvents === 'function') {
        const tomorrow = getUpcomingCalendarEvents(1);
        if (tomorrow.length > 0) {
            msgs.push({ mood: 'pengingat', type: 'warn', text: `📅 Besok ada ${tomorrow.length} jadwal: ${tomorrow.map(e => e.title).slice(0, 3).join(', ')}. Jangan sampai lupa ya!` });
        }
    }

    if (msgs.filter(m => m.type === 'warn').length === 0) {
        msgs.push({ mood: 'senang', type: 'good', text: `☕ Semua kondisi toko aman terkendali. Gak ada yang mendesak sekarang.` });
    }

    return msgs;
}

function renderLunaPanel() {
    const panel = document.getElementById('luna-assistant-panel');
    if (!panel) return;
    const h = computeStoreHealth();
    const insights = generateLunaInsights(h);
    const topMood = (insights.find(m => m.type === 'warn') || insights[0]).mood;
    panel.innerHTML = `
        <img src="${(typeof MASKOT !== 'undefined' && MASKOT[topMood]) || 'assets/maskot/luna-hai.jpg'}" alt="Luna">
        <div class="luna-panel-messages">
            ${insights.map(m => `<div class="luna-msg-bubble ${m.type === 'warn' ? 'luna-msg-warn' : m.type === 'good' ? 'luna-msg-good' : ''}">${m.text}</div>`).join('')}
        </div>
    `;
}

// ------------------------------------------------------------
// 4) KALENDER OPERASIONAL
// ------------------------------------------------------------
const CALENDAR_CATEGORY_LABEL = {
    gift: '🎁 Jadwal Gift Starlight', kirim: '📦 Jadwal Pengiriman', klaim: '🎁 Jadwal Klaim WDP',
    jatuh_tempo: '💰 Jatuh Tempo Pembayaran', pesanan: '📝 Jadwal Pesanan', reminder: '⏰ Reminder', lainnya: '📌 Agenda Lain'
};
let calendarFilter = 'semua';

function getCalendarStatus(ev) {
    if (ev.status === 'done') return 'selesai';
    const todayStr = new Date().toISOString().split('T')[0];
    if (ev.date <= todayStr) return 'mendesak';
    const diffDays = Math.round((new Date(ev.date) - new Date(todayStr)) / (1000 * 60 * 60 * 24));
    return diffDays <= 1 ? 'mendesak' : 'akan-datang';
}

function calendarStatusLabel(status) {
    return status === 'mendesak' ? '🔴 Mendesak' : status === 'selesai' ? '🟢 Selesai' : '🟡 Akan Datang';
}

function getMendesakCalendarEvents() {
    return (state.calendarEvents || []).filter(ev => ev.status !== 'done' && getCalendarStatus(ev) === 'mendesak');
}

function getUpcomingCalendarEvents(daysFromNow) {
    const d = new Date(); d.setDate(d.getDate() + daysFromNow);
    const dStr = d.toISOString().split('T')[0];
    return (state.calendarEvents || []).filter(e => e.status !== 'done' && e.date === dStr);
}

function openCalendarModal(id = null) {
    const modal = document.getElementById('calendar-event-modal');
    document.getElementById('form-calendar-event')?.reset();
    if (document.getElementById('cal-event-id')) document.getElementById('cal-event-id').value = '';
    if (id) {
        const ev = (state.calendarEvents || []).find(e => e.id === id);
        if (!ev) return;
        document.getElementById('cal-event-id').value = ev.id;
        document.getElementById('cal-title').value = ev.title || '';
        document.getElementById('cal-date').value = ev.date || '';
        document.getElementById('cal-category').value = ev.category || 'lainnya';
        document.getElementById('cal-notes').value = ev.notes || '';
        document.getElementById('calendar-modal-title').textContent = '✏️ Edit Jadwal';
    } else {
        document.getElementById('cal-date').value = new Date().toISOString().split('T')[0];
        document.getElementById('calendar-modal-title').textContent = '➕ Tambah Jadwal Baru';
    }
    modal?.classList.add('open');
}

function handleSaveCalendarEvent(e) {
    e.preventDefault();
    const id = document.getElementById('cal-event-id')?.value;
    const title = document.getElementById('cal-title')?.value.trim();
    const date = document.getElementById('cal-date')?.value;
    const category = document.getElementById('cal-category')?.value || 'lainnya';
    const notes = document.getElementById('cal-notes')?.value.trim();
    if (!title || !date) { showToast('❌ Judul dan tanggal wajib diisi!', 'error'); return; }

    if (!state.calendarEvents) state.calendarEvents = [];
    if (id) {
        const ev = state.calendarEvents.find(x => x.id === id);
        if (ev) Object.assign(ev, { title, date, category, notes });
        logActivity('kalender', `Jadwal "${title}" diubah (${date})`);
    } else {
        state.calendarEvents.push({ id: 'cal_' + Date.now(), title, date, category, notes, status: 'pending', createdAt: new Date().toISOString() });
        logActivity('kalender', `Jadwal baru ditambahkan: "${title}" (${date})`);
    }
    saveState();
    document.getElementById('calendar-event-modal')?.classList.remove('open');
    renderCalendarList();
    renderLunaPanel();
    renderNotifDropdown();
    showToast('✅ Jadwal disimpan!', 'success');
}

function deleteCalendarEvent(id) {
    showConfirm('Hapus jadwal ini dari kalender operasional?', () => {
        const ev = (state.calendarEvents || []).find(e => e.id === id);
        state.calendarEvents = (state.calendarEvents || []).filter(e => e.id !== id);
        logActivity('kalender', `Jadwal "${ev ? ev.title : id}" dihapus`);
        saveState(); renderCalendarList(); renderLunaPanel(); renderNotifDropdown();
        showToast('🗑️ Jadwal dihapus', 'success');
    });
}

function toggleCalendarEventDone(id) {
    const ev = (state.calendarEvents || []).find(e => e.id === id);
    if (!ev) return;
    ev.status = ev.status === 'done' ? 'pending' : 'done';
    logActivity('kalender', `Jadwal "${ev.title}" ditandai ${ev.status === 'done' ? 'SELESAI' : 'belum selesai'}`);
    saveState(); renderCalendarList(); renderLunaPanel(); renderNotifDropdown();
}

function filterCalendar(f) {
    calendarFilter = f;
    renderCalendarList();
}

function renderCalendarList() {
    const container = document.getElementById('calendar-event-list');
    if (!container) return;

    document.querySelectorAll('.cal-filter-btn').forEach(b => b.classList.toggle('active', b.getAttribute('data-cfilter') === calendarFilter));

    let list = [...(state.calendarEvents || [])];
    list.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    if (calendarFilter !== 'semua') list = list.filter(ev => getCalendarStatus(ev) === calendarFilter);

    if (list.length === 0) {
        container.innerHTML = maskotEmptyHTML('kosong', 'Belum ada jadwal untuk filter ini.');
        return;
    }

    container.innerHTML = list.map(ev => {
        const status = getCalendarStatus(ev);
        const dateLabel = new Date(ev.date + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        return `
        <div class="calendar-event-item">
            <div class="cal-top-row">
                <span class="cal-title">${ev.title}</span>
                <span class="calendar-status-badge status-${status}">${calendarStatusLabel(status)}</span>
            </div>
            <div class="cal-meta">${dateLabel} • ${CALENDAR_CATEGORY_LABEL[ev.category] || ev.category || '-'}</div>
            ${ev.notes ? `<div class="cal-notes">📝 ${ev.notes}</div>` : ''}
            <div class="cal-actions">
                <button class="btn-mini-sec" onclick="toggleCalendarEventDone('${ev.id}')">${ev.status === 'done' ? '↩️ Batal Selesai' : '✅ Tandai Selesai'}</button>
                <button class="btn-mini-sec" onclick="openCalendarModal('${ev.id}')">✏️ Edit</button>
                <button class="btn-mini-danger" onclick="deleteCalendarEvent('${ev.id}')">🗑️ Hapus</button>
            </div>
        </div>`;
    }).join('');
}

// ------------------------------------------------------------
// 5) STATISTIK AKUN ML
// ------------------------------------------------------------
const ACCOUNT_STATUS_LABEL = { aktif: '🟢 Aktif', hampir: '🟡 Hampir Limit', limit: '🔴 Limit', nonaktif: '⚪ Tidak Aktif' };
const ACCOUNT_STATUS_CLASS = { aktif: 'st-aktif', hampir: 'st-hampir', limit: 'st-limit', nonaktif: 'st-nonaktif' };

function computeAccountStats(accId) {
    const acc = (state.accounts || []).find(a => a.id === accId);
    if (!acc) return null;

    const txs = (state.transactions || []).filter(t => t.accountId === accId);
    const totalTransaksi = txs.length;
    const totalOmzet = txs.reduce((s, t) => s + ((parseFloat(t.priceSelling) || 0) - (parseFloat(t.priceDiscount) || 0)), 0);
    const totalModal = txs.reduce((s, t) => s + (parseFloat(t.priceCapital) || 0), 0);
    const totalProfit = txs.reduce((s, t) => s + (parseFloat(t.netProfit) || 0), 0);

    const wdpForAcc = (state.wdpPurchases || []).filter(p => p.accountId === accId);
    const totalWdpCount = wdpForAcc.reduce((s, p) => s + (p.wdpCount || 0), 0);
    const totalWdpSpent = wdpForAcc.reduce((s, p) => s + (p.totalPrice || 0), 0);

    const totalStarlight = txs.filter(t => t.starlightType === 'Basic' || t.starlightType === 'Premium' || !!GACHA_TYPE_MAP[t.starlightType]).length;
    const totalGift = txs.filter(t => t.status === 'Sudah Dikirim').length;
    const dmTersedia = acc.diamond || 0;
    const dmTerpakai = txs.reduce((s, t) => s + (DM_PER_TYPE[t.starlightType] || 0), 0);

    let status = 'nonaktif';
    if ((acc.gift_slots || 0) <= 0) status = 'limit';
    else if ((acc.gift_slots || 0) === 1) status = 'hampir';
    else {
        const activeRecently = txs.some(t => t.purchaseDate && ((new Date() - new Date(t.purchaseDate)) / (1000 * 60 * 60 * 24)) <= 30);
        status = activeRecently ? 'aktif' : 'nonaktif';
    }

    return { acc, totalTransaksi, totalOmzet, totalModal, totalProfit, totalWdpCount, totalWdpSpent, totalStarlight, totalGift, dmTersedia, dmTerpakai, status };
}

function openAccountStatsModal(accId) {
    const s = computeAccountStats(accId);
    if (!s) return;
    const fmt = n => `Rp ${Math.round(n || 0).toLocaleString('id-ID')}`;
    const body = document.getElementById('account-stats-body');
    if (body) {
        body.innerHTML = `
            <div class="card-header-title" style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">🎮 ${s.acc.ign || s.acc.username}
                <span class="account-status-pill ${ACCOUNT_STATUS_CLASS[s.status]}">${ACCOUNT_STATUS_LABEL[s.status]}</span>
            </div>
            <div class="invoice-divider"></div>
            <div class="premium-row"><span class="lbl">Total Transaksi Pakai Akun Ini:</span><span class="val highlight">${s.totalTransaksi}x</span></div>
            <div class="premium-row"><span class="lbl">Total Starlight Terjual:</span><span class="val highlight">${s.totalStarlight}x</span></div>
            <div class="premium-row"><span class="lbl">Total Gift Terkirim:</span><span class="val highlight">${s.totalGift}x</span></div>
            <div class="invoice-divider" style="margin:8px 0; border-top:1px dashed rgba(255,255,255,0.05);"></div>
            <div class="premium-row"><span class="lbl">Total Pendapatan (Omzet):</span><span class="val privacy-hide">${fmt(s.totalOmzet)}</span></div>
            <div class="premium-row"><span class="lbl">Total Modal/Pengeluaran:</span><span class="val privacy-hide">${fmt(s.totalModal)}</span></div>
            <div class="premium-row"><span class="lbl">Total Keuntungan (Profit):</span><span class="val privacy-hide" style="color:var(--success-green);">${fmt(s.totalProfit)}</span></div>
            <div class="invoice-divider" style="margin:8px 0; border-top:1px dashed rgba(255,255,255,0.05);"></div>
            <div class="premium-row"><span class="lbl">DM Tersedia (Sisa):</span><span class="val highlight">💎 ${s.dmTersedia}</span></div>
            <div class="premium-row"><span class="lbl">DM Sudah Digunakan (Biasa):</span><span class="val">💎 ${s.dmTerpakai}</span></div>
            <div class="premium-row"><span class="lbl">Batas Gift Bulan Ini:</span><span class="val">${s.acc.gift_slots || 0} / 3</span></div>
            <div class="invoice-divider" style="margin:8px 0; border-top:1px dashed rgba(255,255,255,0.05);"></div>
            <div class="premium-row"><span class="lbl">Total WDP Dibeli:</span><span class="val highlight">${s.totalWdpCount}x</span></div>
            <div class="premium-row"><span class="lbl">Total Modal Beli WDP:</span><span class="val privacy-hide">${fmt(s.totalWdpSpent)}</span></div>
        `;
    }
    document.getElementById('account-stats-modal')?.classList.add('open');
    initPrivacy();
}

// ------------------------------------------------------------
// WIRING: dipanggil dari renderAll()/goHome() lewat "hook" ringan
// (tidak mengubah fungsi lama, cuma nambah pemanggilan setelahnya)
// ------------------------------------------------------------
function renderLunaFeatures() {
    renderHomeHealthDashboard();
    renderLunaPanel();
    renderCalendarList();
    renderActivityLog();
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('form-calendar-event')?.addEventListener('submit', handleSaveCalendarEvent);
    document.getElementById('btn-add-calendar-event')?.addEventListener('click', () => openCalendarModal());
    document.getElementById('btn-close-calendar-modal')?.addEventListener('click', () => document.getElementById('calendar-event-modal')?.classList.remove('open'));
    document.getElementById('btn-close-account-stats')?.addEventListener('click', () => document.getElementById('account-stats-modal')?.classList.remove('open'));
    document.getElementById('btn-clear-activity-log')?.addEventListener('click', clearActivityLog);

    document.querySelectorAll('.cal-filter-btn').forEach(btn => {
        btn.addEventListener('click', () => filterCalendar(btn.getAttribute('data-cfilter')));
    });
    document.querySelectorAll('.activity-filter-btn').forEach(btn => {
        btn.addEventListener('click', () => filterActivityLog(btn.getAttribute('data-atype')));
    });

    // Render awal begitu app dimuat (renderAll() bawaan sudah lebih dulu jalan
    // di 02-ui-core.js, jadi state pasti sudah siap di titik ini).
    renderLunaFeatures();
});
