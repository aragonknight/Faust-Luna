// ============================================================
// HALAMAN PENGATURAN: Telegram & Supabase
// (bagian dari script.js asli - FaustLuna Store)
// ============================================================
// --- HALAMAN PENGATURAN --- //
function renderSettingsForm() {
    if(document.getElementById('set-telegram-token')) document.getElementById('set-telegram-token').value = state.settings.telegramToken || '';
    if(document.getElementById('set-telegram-chatid')) document.getElementById('set-telegram-chatid').value = state.settings.telegramChatId || '';
    if(document.getElementById('set-telegram-hmin')) document.getElementById('set-telegram-hmin').value = state.settings.telegramHmin || 2;
    if(document.getElementById('set-h1-notif-enabled')) document.getElementById('set-h1-notif-enabled').checked = !!state.settings.h1NotifEnabled;
    if(document.getElementById('set-supabase-url')) document.getElementById('set-supabase-url').value = state.settings.supabaseUrl || '';
    if(document.getElementById('set-supabase-key')) document.getElementById('set-supabase-key').value = state.settings.supabaseKey || '';
}

function handleSaveTelegramSettings(e) {
    e.preventDefault();
    state.settings.telegramToken = document.getElementById('set-telegram-token')?.value.trim() || '';
    state.settings.telegramChatId = document.getElementById('set-telegram-chatid')?.value.trim() || '';
    state.settings.telegramHmin = parseInt(document.getElementById('set-telegram-hmin')?.value) || 2;
    saveState();
    showToast('⚙️ Pengaturan Telegram disimpan!', 'success');
    checkTelegramDueReminder();
}

function handleToggleH1Notif(e) {
    const enabled = e.target.checked;
    if (enabled && (!('Notification' in window) || Notification.permission !== 'granted')) {
        if ('Notification' in window) {
            Notification.requestPermission().then(perm => {
                if (perm !== 'granted') {
                    e.target.checked = false;
                    showToast('❌ Izin notifikasi browser ditolak.', 'error');
                    return;
                }
                state.settings.h1NotifEnabled = true;
                saveState();
                showToast('🔔 Pengingat H-1 di HP diaktifkan!', 'success');
            });
            return;
        }
    }
    state.settings.h1NotifEnabled = enabled;
    saveState();
    showToast(enabled ? '🔔 Pengingat H-1 di HP diaktifkan!' : 'Pengingat H-1 di HP dimatikan', 'success');
}

function handleSaveSupabaseSettings(e) {
    e.preventDefault();
    state.settings.supabaseUrl = document.getElementById('set-supabase-url')?.value.trim() || '';
    state.settings.supabaseKey = document.getElementById('set-supabase-key')?.value.trim() || '';
    supabaseClient = null; // reset supaya dibuat ulang dengan config baru
    saveState();
    showToast('☁️ Pengaturan Supabase disimpan!', 'success');
}

function getSupabaseClient() {
    if (!state.settings.supabaseUrl || !state.settings.supabaseKey) return null;
    if (!window.supabase || !window.supabase.createClient) {
        showToast('❌ Library Supabase gagal dimuat (cek koneksi internet).', 'error');
        return null;
    }
    if (!supabaseClient) {
        supabaseClient = window.supabase.createClient(state.settings.supabaseUrl, state.settings.supabaseKey);
    }
    return supabaseClient;
}

async function pushStateToSupabase() {
    const client = getSupabaseClient();
    const statusEl = document.getElementById('supabase-sync-status');
    if (!client) { showToast('❌ Isi dulu Project URL & Anon Key Supabase di atas.', 'error'); return; }

    const payload = {
        transactions: state.transactions, accounts: state.accounts, trash: state.trash,
        theme: state.theme, ledger: state.ledger, pengeluaran: state.pengeluaran,
        homeExpenses: state.homeExpenses, capitalPrices: state.capitalPrices,
        wdpPurchases: state.wdpPurchases
    };

    try {
        const { error } = await client.from('faustluna_backup').upsert({
            id: 'main', data: payload, updated_at: new Date().toISOString()
        });
        if (error) throw error;
        showToast('☁️ Backup ke Supabase berhasil!', 'success');
        if (statusEl) statusEl.textContent = `Terakhir backup: ${new Date().toLocaleString('id-ID')}`;
    } catch (err) {
        console.error('Supabase push error:', err);
        showToast('❌ Gagal backup ke Supabase. Cek URL/Key & tabelnya.', 'error');
    }
}

async function pullStateFromSupabase() {
    const client = getSupabaseClient();
    if (!client) { showToast('❌ Isi dulu Project URL & Anon Key Supabase di atas.', 'error'); return; }

    try {
        const { data, error } = await client.from('faustluna_backup').select('*').eq('id', 'main').single();
        if (error) throw error;
        if (!data || !data.data) { showToast('⚠️ Belum ada data backup di Supabase.', 'error'); return; }

        showConfirm('PERINGATAN! Data dari Supabase akan menimpa data di perangkat ini. Tetap lanjutkan?', () => {
            const cloud = data.data;
            state.transactions = cloud.transactions || [];
            state.accounts = cloud.accounts || [];
            state.trash = cloud.trash || [];
            state.ledger = cloud.ledger || [];
            state.pengeluaran = cloud.pengeluaran || [];
            state.homeExpenses = cloud.homeExpenses || [];
            state.capitalPrices = cloud.capitalPrices || state.capitalPrices;
            state.wdpPurchases = cloud.wdpPurchases || [];
            if (cloud.theme) state.theme = cloud.theme;
            saveState(); initTheme(); renderAll(); renderHomeKeuangan(); buildCRMList();
            showToast('✅ Data berhasil ditarik dari Supabase!', 'success', 'yeay');
            const statusEl = document.getElementById('supabase-sync-status');
            if (statusEl) statusEl.textContent = `Terakhir tarik data: ${new Date().toLocaleString('id-ID')}`;
        });
    } catch (err) {
        console.error('Supabase pull error:', err);
        showToast('❌ Gagal mengambil data dari Supabase.', 'error');
    }
}

