// ============================================================
// NOTIFIKASI NATIVE (CAPACITOR LOCAL NOTIFICATIONS)
// Notifikasi ini muncul di status bar Android seperti WA, dan TETAP jalan
// walau aplikasi FaustLuna Store sudah ditutup/di-kill dari recent apps —
// beda dengan notifikasi browser biasa (Notification API) yang cuma jalan
// selama aplikasinya masih kebuka.
//
// Cuma aktif kalau aplikasi ini dijalankan sebagai APK Android (dibungkus
// Capacitor). Kalau dibuka lewat browser/PWA biasa, semua fungsi di sini
// otomatis gak ngapa-ngapain (fallback ke notifikasi browser yang sudah ada).
// ============================================================

function isNativeApp() {
    return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
}

function getLocalNotifPlugin() {
    if (!isNativeApp()) return null;
    return (window.Capacitor.Plugins && window.Capacitor.Plugins.LocalNotifications) || null;
}

async function requestNativeNotifPermission() {
    const plugin = getLocalNotifPlugin();
    if (!plugin) return false;
    try {
        const current = await plugin.checkPermissions();
        if (current.display === 'granted') return true;
        const req = await plugin.requestPermissions();
        return req.display === 'granted';
    } catch (err) {
        console.error('Gagal minta izin notifikasi native:', err);
        return false;
    }
}

async function cancelAllNativeReminders() {
    const plugin = getLocalNotifPlugin();
    if (!plugin) return;
    try {
        const pending = await plugin.getPending();
        if (pending.notifications.length > 0) {
            await plugin.cancel({ notifications: pending.notifications.map(n => ({ id: n.id })) });
        }
    } catch (err) { console.error('Gagal membatalkan notifikasi native lama:', err); }
}

// Jadwalkan ulang semua notifikasi (pengiriman H-1/H-0 + stok menipis) berdasarkan
// data transaksi & akun TERKINI. Dipanggil ulang tiap ada perubahan data (renderAll)
// supaya jadwalnya selalu sinkron — notifikasi lama otomatis dibatalkan & diganti baru.
async function scheduleNativeReminders() {
    if (!state.settings.h1NotifEnabled) return; // hormati saklar "Aktifkan pengingat H-1 di HP" yang sudah ada
    const plugin = getLocalNotifPlugin();
    if (!plugin) return;

    const granted = await requestNativeNotifPermission();
    if (!granted) return;

    await cancelAllNativeReminders();

    const now = new Date();
    const notifications = [];
    let idCounter = 1;

    getAllActiveDeliverableTx().forEach(t => {
        if (!t.estDeliveryDate) return;
        const deliveryDate = new Date(`${t.estDeliveryDate}T09:00:00`);
        const h1Date = new Date(deliveryDate);
        h1Date.setDate(h1Date.getDate() - 1);

        if (h1Date > now) {
            notifications.push({
                id: idCounter++,
                title: '🌙 FaustLuna Store',
                body: `Besok jatuh tempo kirim: ${t.buyerName || 'Tanpa Nama'} (${t.starlightType || '-'})`,
                schedule: { at: h1Date },
            });
        }
        if (deliveryDate > now) {
            notifications.push({
                id: idCounter++,
                title: '🌙 FaustLuna Store',
                body: `HARI INI jatuh tempo kirim: ${t.buyerName || 'Tanpa Nama'} (${t.starlightType || '-'})`,
                schedule: { at: deliveryDate },
            });
        }
    });

    // Stok Basic/Premium akun kasir ML menipis — dikirim ~15 detik dari sekarang
    // (bukan dijadwalkan jauh ke depan, karena statusnya bisa berubah kapan saja).
    const hasLowStock = state.accounts.some(a => (a.basic || 0) < 2 || (a.premium || 0) < 2);
    if (hasLowStock) {
        notifications.push({
            id: idCounter++,
            title: '🌙 FaustLuna Store',
            body: 'Stok akun kasir Mobile Legends kamu mulai menipis, cek menu Info Stok ya!',
            schedule: { at: new Date(now.getTime() + 15000) },
        });
    }

    if (notifications.length > 0) {
        try {
            await plugin.schedule({ notifications });
        } catch (err) { console.error('Gagal menjadwalkan notifikasi native:', err); }
    }
}
