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

// Kirim SATU notifikasi native langsung/instan (bukan dijadwalkan ke masa depan
// kayak reminder H-N) — dipakai buat event yang terjadi sekarang juga: pesanan
// baru masuk, atau pengiriman sukses. ID-nya dibikin unik pakai timestamp biar
// gak bentrok/ketimpa sama notifikasi reminder yang lain.
async function sendNativeInstantNotification(title, body) {
    const plugin = getLocalNotifPlugin();
    if (!plugin) return;
    const granted = await requestNativeNotifPermission();
    if (!granted) return;
    try {
        await plugin.schedule({
            notifications: [{
                id: Math.floor(Date.now() % 2147483647),
                title,
                body,
                schedule: { at: new Date(Date.now() + 1000) }
            }]
        });
    } catch (err) { console.error('Gagal kirim notifikasi native instan:', err); }
}
// data transaksi, akun, & pembelian WDP TERKINI. Dipanggil ulang tiap ada perubahan
// data (renderAll) supaya jadwalnya selalu sinkron — notifikasi lama otomatis
// dibatalkan & diganti baru.
//
// SEMUA notif di sini dijadwalkan LANGSUNG ke OS Android (bukan nunggu app dibuka
// buat ngecek), jadi tetap muncul walau app-nya ditutup/di-kill — kayak alarm.
// Kalau ada jadwal yang waktunya udah lewat pas fungsi ini jalan (misal app baru
// dibuka beberapa hari kemudian), notifnya langsung dikirim instan saat itu juga
// (catch-up) — ditandai di localStorage biar gak dobel kalau renderAll() jalan lagi.
async function scheduleNativeReminders() {
    const plugin = getLocalNotifPlugin();
    if (!plugin) return;

    const granted = await requestNativeNotifPermission();
    if (!granted) return;

    await cancelAllNativeReminders();

    const now = new Date();
    const notifications = [];
    let idCounter = 1;
    const catchUps = [];

    // --- 1. Reminder H-1 / HARI-H jatuh tempo kirim (saklar "Aktifkan pengingat di HP") --- //
    if (state.settings.h1NotifEnabled) {
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
    }

    // --- 2. Reminder H-N pengingat jatuh tempo (dulu "WA reminder", sekarang notif biasa) --- //
    const hmin = parseInt(state.settings.waHmin) || 2;
    const waNotifiedKey = 'fl_wa_notified';
    const waNotified = safeParse(waNotifiedKey, {});
    getAllActiveDeliverableTx().forEach(t => {
        if (!t.estDeliveryDate) return;
        const flag = `${t.id}`;
        if (waNotified[flag]) return; // sudah pernah dikirim buat transaksi ini
        const deliveryDate = new Date(`${t.estDeliveryDate}T09:00:00`);
        const triggerDate = new Date(deliveryDate);
        triggerDate.setDate(triggerDate.getDate() - hmin);
        const body = `${t.buyerName || '-'} — ${t.starlightType || '-'} (estimasi kirim: ${t.estDeliveryDate})`;

        if (triggerDate > now) {
            notifications.push({
                id: idCounter++,
                title: `⏰ Pengingat H-${hmin} Pengiriman`,
                body,
                schedule: { at: triggerDate },
            });
        } else {
            // Ambang H-N udah lewat (app sempat ketutup pas waktunya) — kirim sekarang, sekali.
            catchUps.push({ title: `⏰ Pengingat H-${hmin} Pengiriman`, body });
            waNotified[flag] = true;
        }
    });
    localStorage.setItem(waNotifiedKey, JSON.stringify(waNotified));

    // --- 3. Reminder klaim WDP harian (jam 16:00) --- //
    const wdpNotifiedKey = 'fl_wdp_notified';
    const wdpNotified = safeParse(wdpNotifiedKey, {});
    (state.wdpPurchases || []).filter(p => !isWdpPassFullyClaimed(p)).forEach(p => {
        const acc = state.accounts.find(a => a.id === p.accountId);
        const accName = acc ? (acc.ign || acc.username) : 'Akun';
        const claims = ensureWdpClaimsField(p);
        getWdpClaimUnlockDates(p).forEach((unlockAt, dayIndex) => {
            if (claims[dayIndex]) return; // sudah diklaim
            const flag = `${p.id}_${dayIndex}`;
            const body = `${accName} — Hari ke-${dayIndex + 1}/${getWdpTotalDays(p)}, jangan lupa klaim sekarang.`;

            if (unlockAt > now) {
                notifications.push({
                    id: idCounter++,
                    title: '🎁 WDP Siap Diklaim!',
                    body,
                    schedule: { at: unlockAt },
                });
            } else if (!wdpNotified[flag]) {
                // Jatah ini udah kebuka sebelum app dibuka lagi — kirim sekarang, sekali.
                catchUps.push({ title: '🎁 WDP Siap Diklaim!', body });
                wdpNotified[flag] = true;
            }
        });
    });
    localStorage.setItem(wdpNotifiedKey, JSON.stringify(wdpNotified));

    // Kirim semua notif "telat" (catch-up) secara instan.
    for (const c of catchUps) {
        await sendNativeInstantNotification(c.title, c.body);
    }

    if (notifications.length > 0) {
        try {
            await plugin.schedule({ notifications });
        } catch (err) { console.error('Gagal menjadwalkan notifikasi native:', err); }
    }

    localStorage.setItem('fl_last_scheduled_at', new Date().toISOString());
    renderNotifLastScheduled();
}
