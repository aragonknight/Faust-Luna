// ============================================================
// HALAMAN PENGATURAN: WhatsApp & Supabase
// (bagian dari script.js asli - FaustLuna Store)
// ============================================================
// --- HALAMAN PENGATURAN --- //
function renderSettingsForm() {
    if(document.getElementById('set-wa-hmin')) document.getElementById('set-wa-hmin').value = state.settings.waHmin || 2;
    if(document.getElementById('set-h1-notif-enabled')) document.getElementById('set-h1-notif-enabled').checked = !!state.settings.h1NotifEnabled;
    renderNotifLastScheduled();
    refreshBatteryOptimWarning();
}

// Tombol "🔔 TEST NOTIFIKASI" — kirim satu notifikasi instan buat mastiin izin
// & pluginnya beneran jalan, gak perlu nunggu jadwal beneran kejadian dulu.
function handleTestNotif() {
    if (!isNativeApp()) {
        showToast('ℹ️ Test notifikasi cuma bisa di APK Android, bukan di browser/PWA.', 'error');
        return;
    }
    sendNativeInstantNotification('🔔 Test Notifikasi', 'Kalau ini muncul, notifikasi native FaustLuna Store berhasil aktif!');
    showToast('🔔 Notifikasi test dikirim, cek status bar HP kamu!', 'success');
}

// Nampilin kapan terakhir kali scheduleNativeReminders() berhasil jadwalin ulang
// semua reminder — biar kamu bisa mastiin fitur ini beneran ke-trigger tiap ada
// perubahan data (dicatat di localStorage tiap kali jadwal ulang berhasil).
function renderNotifLastScheduled() {
    const el = document.getElementById('notif-last-scheduled');
    if (!el) return;
    const ts = localStorage.getItem('fl_last_scheduled_at');
    el.textContent = ts
        ? `🕒 Reminder terakhir dijadwalkan ulang: ${new Date(ts).toLocaleString('id-ID')}`
        : (isNativeApp() ? '🕒 Belum ada jadwal reminder yang tercatat.' : '');
}

// Cek status pengecualian battery optimization, tampilkan kartu peringatan
// kalau app ini masih bisa "dihemat" sistem (yang bikin notif terjadwal
// berpotensi telat/gak muncul).
async function refreshBatteryOptimWarning() {
    const box = document.getElementById('battery-optim-warning');
    if (!box) return;
    if (!isNativeApp() || !window.Capacitor?.Plugins?.BatteryOptimization) {
        box.classList.add('hidden');
        return;
    }
    try {
        const { ignoring } = await window.Capacitor.Plugins.BatteryOptimization.isIgnoringBatteryOptimizations();
        box.classList.toggle('hidden', !!ignoring);
    } catch (err) {
        console.error('Gagal cek status battery optimization:', err);
        box.classList.add('hidden');
    }
}

// Dipanggil sekali tiap app dibuka — kalau app masih bisa "dihemat" sistem,
// kasih toast ngarahin ke Pengaturan buat izinin (biar reminder gak telat).
// Cuma diingetin ulang maks sehari sekali biar gak ganggu (bukan tiap buka app).
async function maybeSuggestBatteryOptimExemption() {
    if (!isNativeApp() || !window.Capacitor?.Plugins?.BatteryOptimization) return;
    const lastPromptKey = 'fl_battery_optim_prompt_at';
    const lastPrompt = localStorage.getItem(lastPromptKey);
    if (lastPrompt && (Date.now() - new Date(lastPrompt).getTime()) < 24 * 60 * 60 * 1000) return;

    try {
        const { ignoring } = await window.Capacitor.Plugins.BatteryOptimization.isIgnoringBatteryOptimizations();
        if (!ignoring) {
            showToast('🔋 Biar notif reminder gak telat, izinkan dulu di menu Pengaturan ⚙️', 'error');
            localStorage.setItem(lastPromptKey, new Date().toISOString());
        }
    } catch (err) { console.error('Gagal cek battery optimization saat startup:', err); }
}

function handleRequestBatteryOptim() {
    if (!window.Capacitor?.Plugins?.BatteryOptimization) return;
    window.Capacitor.Plugins.BatteryOptimization.requestIgnoreBatteryOptimizations().then(() => {
        // Kasih jeda dikit biar user sempat pilih di dialog sistem sebelum kita re-cek statusnya.
        setTimeout(refreshBatteryOptimWarning, 1500);
    });
}

// Dipanggil begitu dropdown H-min diganti — langsung simpan tanpa perlu tombol submit
// terpisah, karena kartu WhatsApp (yang dulu punya tombol simpan sendiri) sudah dihapus.
function handleChangeHmin(e) {
    state.settings.waHmin = parseInt(e.target.value) || 2;
    saveState();
    showToast('⚙️ Pengaturan pengingat disimpan!', 'success');
    if (isNativeApp() && state.settings.h1NotifEnabled) scheduleNativeReminders();
}

function handleToggleH1Notif(e) {
    const enabled = e.target.checked;
    if (enabled) {
        if (isNativeApp()) {
            requestNativeNotifPermission().then(granted => {
                if (!granted) {
                    e.target.checked = false;
                    showToast('❌ Izin notifikasi ditolak. Aktifkan manual di Pengaturan HP > Aplikasi > FaustLuna > Izin > Notifikasi.', 'error');
                    return;
                }
                state.settings.h1NotifEnabled = true;
                saveState();
                showToast('🔔 Pengingat H-1 di HP diaktifkan!', 'success');
                scheduleNativeReminders();
            });
            return;
        }
        if (!('Notification' in window) || Notification.permission !== 'granted') {
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
    } else if (isNativeApp()) {
        cancelAllNativeReminders();
    }
    state.settings.h1NotifEnabled = enabled;
    saveState();
    showToast(enabled ? '🔔 Pengingat H-1 di HP diaktifkan!' : 'Pengingat H-1 di HP dimatikan', 'success');
}

// Backup/restore manual sekarang pakai client Supabase yang sama dengan
// login (getAuthClient() di 10-auth-sync.js), bukan URL/Key manual lagi --
// form pengaturan URL/Key manual sudah diganti sistem login akun.
function getSupabaseClient() {
    if (typeof currentAuthUser === 'undefined' || !currentAuthUser) {
        showToast('❌ Kamu harus login dulu buat backup/tarik data manual.', 'error');
        return null;
    }
    if (typeof getAuthClient !== 'function') return null;
    const client = getAuthClient();
    if (!client) {
        showToast('❌ Library Supabase gagal dimuat (cek koneksi internet).', 'error');
        return null;
    }
    return client;
}

async function pushStateToSupabase() {
    const client = getSupabaseClient();
    const statusEl = document.getElementById('supabase-sync-status');
    if (!client) { showToast('❌ Isi dulu Project URL & Anon Key Supabase di atas.', 'error'); return; }

    const payload = {
        transactions: state.transactions, accounts: state.accounts, trash: state.trash, archivedTx: state.archivedTx,
        theme: state.theme, ledger: state.ledger, pengeluaran: state.pengeluaran,
        homeExpenses: state.homeExpenses, capitalPrices: state.capitalPrices,
        wdpPurchases: state.wdpPurchases, gachaLogs: state.gachaLogs, logs: state.logs,
        activityLog: state.activityLog, calendarEvents: state.calendarEvents,
        privacyMode: state.privacyMode, financeAdjustment: state.financeAdjustment
    };

    // Kalau lagi login, data disimpan di baris milik akun itu (kepisah per
    // akun). Kalau belum login (misal Supabase gagal dimuat), fallback ke
    // baris "main" lama biar tombol manual ini tetap bisa dipakai.
    const rowId = (typeof currentAuthUser !== 'undefined' && currentAuthUser) ? currentAuthUser.id : 'main';

    try {
        const { error } = await client.from('faustluna_backup').upsert({
            id: rowId, data: payload, updated_at: new Date().toISOString()
        });
        if (error) throw error;
        if (typeof logActivity === 'function') logActivity('sync', 'Backup manual ke Supabase berhasil');
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

    const rowId = (typeof currentAuthUser !== 'undefined' && currentAuthUser) ? currentAuthUser.id : 'main';

    try {
        const { data, error } = await client.from('faustluna_backup').select('*').eq('id', rowId).single();
        if (error) throw error;
        if (!data || !data.data) { showToast('⚠️ Belum ada data backup di Supabase.', 'error'); return; }

        showConfirm('PERINGATAN! Data dari Supabase akan menimpa data di perangkat ini. Tetap lanjutkan?', () => {
            const cloud = data.data;
            state.transactions = cloud.transactions || [];
            state.accounts = cloud.accounts || [];
            state.trash = cloud.trash || [];
            state.archivedTx = cloud.archivedTx || [];
            state.ledger = cloud.ledger || [];
            state.pengeluaran = cloud.pengeluaran || [];
            state.homeExpenses = cloud.homeExpenses || [];
            state.capitalPrices = cloud.capitalPrices || state.capitalPrices;
            state.wdpPurchases = cloud.wdpPurchases || [];
            state.gachaLogs = cloud.gachaLogs || [];
            state.logs = cloud.logs || [];
            state.activityLog = cloud.activityLog || [];
            state.calendarEvents = cloud.calendarEvents || [];
            state.privacyMode = cloud.privacyMode || false;
            state.financeAdjustment = cloud.financeAdjustment || { pemasukan: 0, saldo: 0 };
            if (cloud.theme) state.theme = cloud.theme;
            if (typeof logActivity === 'function') logActivity('sync', 'Tarik data manual dari Supabase berhasil (data lokal ditimpa)');
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

