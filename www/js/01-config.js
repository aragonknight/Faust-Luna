// ============================================================
// KONFIGURASI DEFAULT & DATA PRODUK (state dasar, format item, helper produk)
// (bagian dari script.js asli - FaustLuna Store)
// ============================================================
// STATE MANAGEMENT DATA UTAMA (MURNI LOCALSTORAGE + EXTENSIONS)

// ====== VERSI APLIKASI ======
// Naikkan angka ini SETIAP kali push update baru, biar keliatan di sidebar
// (bagian bawah menu) versi berapa yang lagi jalan di HP.
const APP_VERSION = "1";

// ====== KONFIGURASI DEFAULT (HARDCODE) ======
// Isi nilai di sini langsung di kode. Ini dipakai sebagai default kalau
// belum pernah diubah lewat menu Pengaturan di aplikasi (menu Pengaturan
// tetap bisa dipakai kalau suatu saat mau ganti tanpa edit kode lagi).
const DEFAULT_CONFIG = {
    telegramToken: '8655165418:AAHeQ5bbXfboliHZFjhA-OViIgQJAYMxt18',
    telegramChatId: '7302641126',
    telegramHmin: 2,
    supabaseUrl: 'https://apjjnfmxvpofrrklithz.supabase.co',
    supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFwampuZm14dnBvZnJya2xpdGh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ5MzkxMjgsImV4cCI6MjEwMDUxNTEyOH0.Bqg4KqaKt86bW6fMZjplo7X5d1fObb6SZ-uU_zjVLrg'
};

function safeParse(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        if (raw === null || raw === undefined) return fallback;
        return JSON.parse(raw);
    } catch (err) {
        console.error(`Data localStorage "${key}" rusak, pakai nilai default. Error:`, err);
        return fallback;
    }
}

let state = {
    transactions: safeParse('fl_transactions', []),
    accounts: safeParse('fl_accounts', [
        { id: "1", ign: "Faust Main", username: "faustmain@gmail.com", password: "passwordfaust123", login_method: "Moonton", basic: 5, premium: 3, gift_slots: 3, diamond: 1500, avgDmCost: 0 },
        { id: "2", ign: "Luna Booster", username: "luna_booster@gmail.com", password: "passwordluna456", login_method: "Google", basic: 1, premium: 4, gift_slots: 3, diamond: 450, avgDmCost: 0 }
    ]),
    // Riwayat pembelian WDP per akun. Dipakai untuk hitung rata-rata modal per DM
    // (weighted average cost) tiap akun, karena stok DM lama & baru bisa kecampur
    // dengan harga beli yang beda-beda tiap bulan.
    wdpPurchases: safeParse('fl_wdp_purchases', []),
    trash: safeParse('fl_trash', []),
    theme: localStorage.getItem('fl_theme') || 'faust-gold',
    privacyMode: safeParse('fl_privacy', false),
    logs: safeParse('fl_logs', []),
    ledger: safeParse('fl_ledger', []),
    pengeluaran: safeParse('fl_pengeluaran', []),
    homeExpenses: safeParse('fl_home_expenses', []),
    capitalPrices: safeParse('fl_capital_prices', {
        "Basic": 25000,
        "Premium": 25000,
        "WDP": 25000,
        "Twilight": 25000,
        "Custom DM": 25000,
        "Genshin Impact": 25000,
        "Wuthering Waves": 25000
    }),
    // Penyesuaian manual: ditambahkan/dikurangkan di atas hasil hitungan otomatis
    // untuk Pemasukan & Saldo di halaman "Catatan Keuangan Gabungan".
    financeAdjustment: safeParse('fl_finance_adjustment', { pemasukan: 0, saldo: 0 }),
    settings: safeParse('fl_settings', {
        telegramToken: DEFAULT_CONFIG.telegramToken,
        telegramChatId: DEFAULT_CONFIG.telegramChatId,
        telegramHmin: DEFAULT_CONFIG.telegramHmin,
        h1NotifEnabled: false,
        supabaseUrl: DEFAULT_CONFIG.supabaseUrl,
        supabaseKey: DEFAULT_CONFIG.supabaseKey
    })
};

let supabaseClient = null;

let deferredPrompt = null;

// --- SISTEM MULTI-PRODUK (HOME > MOBILE LEGENDS / GENSHIN IMPACT / WUTHERING WAVES) ---
// Setiap key di sini = 1 kartu produk terpisah di Home. Mau nambah game baru?
// 1) Tambah key baru di sini (contoh: honkai: {...})
// 2) Tambah kartunya juga di index.html (product-card-grid di #page-home-dashboard), data-product harus sama persis.
const PRODUCT_CONFIG = {
    mobileleg: {
        label: 'Mobile Legends',
        icon: '✨',
        heroText: 'Luna siap bantu pantau jualan Mobile Legends kamu hari ini.',
        variations: [
            { value: 'Basic', text: 'Starlight Basic' },
            { value: 'Premium', text: 'Starlight Premium' },
            { value: 'WDP', text: 'Weekly Diamond Pass (WDP)' },
            { value: 'Twilight', text: 'Twilight Pass' },
            { value: 'Diamond', text: 'Diamond' }
        ]
    },
    genshin: {
        label: 'Genshin Impact',
        icon: '⚔️',
        heroText: 'Luna siap bantu pantau top up Genshin Impact kamu hari ini.',
        variations: [
            { value: 'Genesis Crystal', text: 'Genesis Crystal (Jumlah Manual)' },
            { value: 'Blessing of the Welkin Moon', text: 'Blessing of the Welkin Moon (Bulanan)' },
            { value: 'Battle Pass Gnostic Hymn', text: 'Battle Pass Gnostic Hymn' }
        ]
    },
    wuthering: {
        label: 'Wuthering Waves',
        icon: '🌊',
        heroText: 'Luna siap bantu pantau top up Wuthering Waves kamu hari ini.',
        variations: [
            { value: 'Astrite', text: 'Astrite (Jumlah Manual)' },
            { value: 'Radiant Tide', text: 'Radiant Tide (Bulanan)' },
            { value: 'Pioneer Podcast', text: 'Pioneer Podcast (Battle Pass)' }
        ]
    }
};
// 'Custom DM', 'Genshin Impact', dan 'Wuthering Waves' = nilai lama dari sebelum varian
// dipecah lebih detail. Tetap dipetakan supaya transaksi lama gak hilang dari Rekap.
const TYPE_TO_PRODUCT = {
    'Basic': 'mobileleg', 'Premium': 'mobileleg', 'WDP': 'mobileleg', 'Twilight': 'mobileleg', 'Diamond': 'mobileleg',
    'Custom DM': 'genshin', 'Genshin Impact': 'genshin',
    'Genesis Crystal': 'genshin', 'Blessing of the Welkin Moon': 'genshin', 'Battle Pass Gnostic Hymn': 'genshin',
    'Wuthering Waves': 'wuthering',
    'Astrite': 'wuthering', 'Radiant Tide': 'wuthering', 'Pioneer Podcast': 'wuthering'
};
// Item dengan jumlah currency yang diinput manual (bukan dipilih dari variasi bertingkat),
// mengikuti pola "Diamond" di Mobile Legends. Value = label kolom Qty saat item ini dipilih.
const MANUAL_QTY_TYPES = {
    'Diamond': 'Jumlah Diamond',
    'Genesis Crystal': 'Jumlah Genesis Crystal',
    'Astrite': 'Jumlah Astrite'
};
// Format nama produk untuk ditampilkan di kartu/nota. Untuk item qty manual
// (Diamond/Genesis Crystal/Astrite), qty yang tersimpan di t.diamondQty ikut
// ditampilkan di belakang nama produknya, misal "Genesis Crystal x1600".
function formatItemLabel(t) {
    const type = t.starlightType || '-';
    if (MANUAL_QTY_TYPES[type] && t.diamondQty) {
        return `${type} x${t.diamondQty}`;
    }
    return type;
}
// Server/region resmi tiap game yang pakai sistem region (BUKAN Zone ID numerik seperti ML).
// Kalau sebuah produk gak ada di sini, form tetap pakai input Zone ID numerik biasa (perilaku lama).
const SERVER_REGIONS = {
    genshin: ['America', 'Europe', 'Asia', 'TW, HK, MO'],
    wuthering: ['America', 'Europe', 'Asia', 'SEA', 'HMT']
};
let currentProduct = 'mobileleg';

// Konversi Starlight ke Diamond (DM), dipakai buat motong stok DM akun & hitung
// modal otomatis dari rata-rata modal/DM akun terkait. Item lain (WDP, Twilight,
// Diamond manual, Genshin, Wuthering) TIDAK pakai stok DM akun, modalnya tetap
// manual/fix lewat capitalPrices.
const DM_PER_TYPE = { 'Basic': 300, 'Premium': 750 };

function productTx() {
    return state.transactions.filter(t => TYPE_TO_PRODUCT[t.starlightType] === currentProduct);
}
function productPengeluaran() {
    return state.pengeluaran.filter(p => (p.product || 'mobileleg') === currentProduct);
}

function renderVariationOptions() {
    const select = document.getElementById('starlight-type');
    if (!select) return;
    const cfg = PRODUCT_CONFIG[currentProduct];
    select.innerHTML = cfg.variations.map(v => `<option value="${v.value}">${v.text}</option>`).join('');
    updateSalesFormForType();
}

// Akun Penjual (rotasi & potong stok/gift slot) cuma dipakai untuk Starlight Basic/Premium.
// WDP, Twilight, dan Diamond tidak lewat akun penjual sama sekali.
// Khusus Diamond, field "Jumlah (Qty)" juga berubah label & fungsi jadi "Jumlah Diamond".
