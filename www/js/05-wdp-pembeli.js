// ============================================================
// PEMBELIAN WDP, GRID PEMBELI, EDIT/HAPUS TRANSAKSI, NOTA & TESTIMONI
// (bagian dari script.js asli - FaustLuna Store)
// ============================================================
// --- PEMBELIAN WDP (MODAL STARLIGHT ML, PER AKUN) --- //
function openWdpModal(accountId) {
    const acc = state.accounts.find(a => a.id === accountId);
    if (!acc) return;
    document.getElementById('form-wdp-purchase')?.reset();
    document.getElementById('wdp-account-id').value = accountId;
    document.getElementById('wdp-account-label').textContent = `${acc.ign || acc.username} (Sisa DM saat ini: 💎 ${acc.diamond || 0}, rata-rata modal/DM: Rp ${Math.round(acc.avgDmCost || 0).toLocaleString('id-ID')})`;
    document.getElementById('wdp-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('wdp-modal')?.classList.add('open');
}

function handleAddWdpPurchase(e) {
    e.preventDefault();
    const accountId = document.getElementById('wdp-account-id')?.value;
    const acc = state.accounts.find(a => a.id === accountId);
    if (!acc) { showToast("❌ Akun tidak ditemukan!", "error"); return; }

    const wdpCount = parseInt(document.getElementById('wdp-count')?.value || 0);
    const totalPrice = parseFloat(document.getElementById('wdp-price')?.value || 0);
    const dmReceived = parseInt(document.getElementById('wdp-dm-received')?.value || 0);
    const date = document.getElementById('wdp-date')?.value || new Date().toISOString().split('T')[0];
    if (dmReceived <= 0 || totalPrice <= 0) { showToast("❌ Isi jumlah DM & harga dengan benar!", "error"); return; }

    // Rata-rata tertimbang (weighted average): stok DM lama yang tersisa di akun ini
    // dicampur sama DM baru, modal/DM-nya jadi rata-rata baru. Jadi meski tiap bulan
    // beli WDP beda jumlah/harga, modal per Starlight tetap kehitung akurat.
    const oldStock = acc.diamond || 0;
    const oldAvgCost = acc.avgDmCost || 0;
    const oldValue = oldStock * oldAvgCost;
    const newStock = oldStock + dmReceived;
    const newAvgCost = newStock > 0 ? (oldValue + totalPrice) / newStock : 0;

    acc.diamond = newStock;
    acc.avgDmCost = newAvgCost;

    state.wdpPurchases.unshift({
        id: "wdp_" + Date.now(), accountId, accountName: acc.ign || acc.username,
        wdpCount, totalPrice, dmReceived, date, avgCostAfter: newAvgCost
    });

    // Auto-catat sebagai Pengeluaran di Catatan Keuangan Gabungan, biar Saldo/kas
    // tetap akurat (uang beli WDP ini nyata-nyata keluar dari kantong).
    state.homeExpenses.unshift({
        id: "hexp_auto_" + Date.now(),
        desc: `[Otomatis] Beli WDP — ${acc.ign || acc.username} (${wdpCount} WDP, ${dmReceived} DM)`,
        amount: totalPrice,
        date,
        source: 'auto-wdp'
    });

    saveState();
    document.getElementById('wdp-modal')?.classList.remove('open');
    renderAll(); renderHomeKeuangan();
    showToast(`✅ Pembelian WDP dicatat! Rata-rata modal/DM sekarang: Rp ${Math.round(newAvgCost).toLocaleString('id-ID')}`, "success");
}

function renderWdpHistory(accountId) {
    const acc = state.accounts.find(a => a.id === accountId);
    const modal = document.getElementById('wdp-history-modal');
    const listEl = document.getElementById('wdp-history-list');
    const titleEl = document.getElementById('wdp-history-title');
    if (!modal || !listEl) return;
    if (titleEl) titleEl.textContent = `🧾 Riwayat Beli WDP — ${acc ? (acc.ign || acc.username) : ''}`;

    const purchases = state.wdpPurchases.filter(p => p.accountId === accountId);
    if (purchases.length === 0) {
        listEl.innerHTML = maskotEmptyHTML('kosong', 'Belum ada riwayat pembelian WDP untuk akun ini.');
    } else {
        listEl.innerHTML = purchases.map(p => `
            <div class="agenda-item" style="justify-content: space-between; align-items: center; display: flex; padding: 10px; border-bottom: 1px solid var(--accent-alpha);">
                <div>
                    <div style="font-weight:bold; font-size: 13px;">${p.wdpCount} WDP → 💎 ${p.dmReceived} DM</div>
                    <div style="font-size:10px; color:var(--text-muted);">${p.date} • Rata-rata modal/DM setelah ini: Rp ${Math.round(p.avgCostAfter || 0).toLocaleString('id-ID')}</div>
                </div>
                <div style="color:var(--danger-red); font-weight:bold; font-size: 13px;">- Rp ${(p.totalPrice||0).toLocaleString('id-ID')}</div>
            </div>
        `).join('');
    }
    modal.classList.add('open');
}

// --- CATAT HASIL GACHA (STOK BASIC/PREMIUM JALUR GACHA, PER AKUN) --- //
function openGachaModal(accountId) {
    const acc = state.accounts.find(a => a.id === accountId);
    if (!acc) return;
    document.getElementById('form-gacha-catat')?.reset();
    document.getElementById('gacha-account-id').value = accountId;
    document.getElementById('gacha-account-label').textContent = `${acc.ign || acc.username} (Sisa DM saat ini: 💎 ${acc.diamond || 0})`;
    document.getElementById('gacha-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('gacha-modal')?.classList.add('open');
}

function handleAddGachaLog(e) {
    e.preventDefault();
    const accountId = document.getElementById('gacha-account-id')?.value;
    const acc = state.accounts.find(a => a.id === accountId);
    if (!acc) { showToast("❌ Akun tidak ditemukan!", "error"); return; }

    const baseType = document.getElementById('gacha-type')?.value || 'Basic';
    const mapping = GACHA_TYPE_MAP[`${baseType} Gacha`];
    const qty = parseInt(document.getElementById('gacha-qty')?.value || 0);
    const dmUsed = parseInt(document.getElementById('gacha-dm-used')?.value || 0);
    const date = document.getElementById('gacha-date')?.value || new Date().toISOString().split('T')[0];
    if (!mapping) { showToast("❌ Tipe gacha tidak dikenal!", "error"); return; }
    if (qty <= 0 || dmUsed <= 0) { showToast("❌ Isi jumlah item & DM yang abis dengan benar!", "error"); return; }
    if ((acc.diamond || 0) < dmUsed) { showToast("❌ Sisa DM akun ini nggak cukup buat DM segitu! Catat dulu pembelian WDP-nya.", "error"); return; }

    // Modal batch ini (Rupiah) = DM riil yang abis x rata-rata modal/DM akun (bukan
    // konversi fixed 300/750), lalu dirata-rata tertimbang per item ke stok Gacha yang
    // sudah ada sebelumnya — mirip logika WDP, tapi per-item, bukan per-DM.
    const batchCost = dmUsed * (acc.avgDmCost || 0);
    const oldStock = acc[mapping.stockField] || 0;
    const oldAvgCost = acc[mapping.avgCostField] || 0;
    const oldValue = oldStock * oldAvgCost;
    const newStock = oldStock + qty;
    const newAvgCost = newStock > 0 ? (oldValue + batchCost) / newStock : 0;

    acc[mapping.stockField] = newStock;
    acc[mapping.avgCostField] = newAvgCost;
    // DM langsung dipotong sekarang (saat gacha beneran kejadian), bukan nanti pas dijual.
    acc.diamond = (acc.diamond || 0) - dmUsed;

    state.gachaLogs.unshift({
        id: "gacha_" + Date.now(), accountId, accountName: acc.ign || acc.username,
        baseType, qty, dmUsed, batchCost, avgCostAfter: newAvgCost, date
    });

    saveState();
    document.getElementById('gacha-modal')?.classList.remove('open');
    renderAll();
    showToast(`✅ Hasil gacha dicatat! Modal rata-rata ${baseType} (Gacha) sekarang: Rp ${Math.round(newAvgCost).toLocaleString('id-ID')}/item`, "success");
}

function deleteAccount(id) {
    showConfirm("Apakah Anda yakin ingin menghapus akun penjual ini?", () => {
        state.accounts = state.accounts.filter(a => a.id !== id); saveState(); renderAll(); showToast("🗑️ Akun berhasil dihapus", "success");
    });
}

function renderPembeliGrid() {
    const container = document.getElementById('pembeli-premium-grid'); if(!container) return;
    container.innerHTML = '';
    const searchVal = document.getElementById('search-buyer')?.value.toLowerCase() || '';
    const hideDelivered = document.getElementById('hide-delivered-check')?.checked;
    const hideAcc = document.getElementById('hide-acc-check')?.checked;
    
    let filtered = productTx().filter(t => (t.buyerName || '').toLowerCase().includes(searchVal));
    if (hideDelivered) filtered = filtered.filter(t => t.status !== 'Sudah Dikirim');
    if (hideAcc) filtered = filtered.filter(t => t.friendshipChecked !== true);

    const sortMode = document.getElementById('pembeli-sort-select')?.value || 'default';
    if (sortMode === 'due-asc') {
        filtered = [...filtered].sort((a, b) => (a.estDeliveryDate || '9999-99-99').localeCompare(b.estDeliveryDate || '9999-99-99'));
    } else if (sortMode === 'due-desc') {
        filtered = [...filtered].sort((a, b) => (b.estDeliveryDate || '').localeCompare(a.estDeliveryDate || ''));
    } else if (sortMode === 'name-az') {
        filtered = [...filtered].sort((a, b) => (a.buyerName || '').localeCompare(b.buyerName || ''));
    }

    if(filtered.length === 0) {
        container.innerHTML = maskotEmptyHTML('kosong', 'Kosong / Tidak ditemukan.'); return;
    }
    filtered.forEach(t => {
        const card = document.createElement('div'); card.className = 'premium-card';
        let badgeType = t.status === 'Sudah Dikirim' ? 'status-sudah' : (t.status === 'Booking' ? 'status-booking' : 'status-belum');
        const isStarlightProduct = t.starlightType === 'Basic' || t.starlightType === 'Premium';
        let countdownText = "";
        
        if (isStarlightProduct && t.estDeliveryDate) {
            const daysLeft = getDaysRemaining(t.estDeliveryDate);
            countdownText = `(H-${daysLeft} Hari)`;
            if(daysLeft === 0) countdownText = `🔥 HARI INI!`;
            if(daysLeft < 0) countdownText = `⚠️ TERLAMBAT ${Math.abs(daysLeft)} HARI`;
            if(t.status === 'Sudah Dikirim') countdownText = `✅ Selesai`;
            if((t.status === 'Belum Dikirim' || t.status === 'Booking') && daysLeft === 1) card.style.borderColor = '#ffaa00';

        } else {
            countdownText = t.status === 'Sudah Dikirim' ? `✅ Selesai` : `⚡ (Proses Instan)`;
        }

        let nickHistoryHtml = "";
        if(t.nicknameHistory && t.nicknameHistory.length > 0) {
            nickHistoryHtml = `<div class="nickname-history-box">🔄 Histori Nick: ${t.nicknameHistory.join(' ➡️ ')}</div>`;
        }

        const estRowHtml = isStarlightProduct ? `<div class="premium-row"><span class="lbl">Estimasi Kirim:</span><span class="val" style="color:#ffdf7a; font-weight:bold;">${t.estDeliveryDate || '-'}</span></div>` : '';
        const friendshipRowHtml = isStarlightProduct ? `
            <div class="premium-row">
                <span class="lbl">Pertemanan H+7:</span>
                <span class="val"><input type="checkbox" ${t.friendshipChecked ? 'checked' : ''} onclick="toggleFriendship('${t.id}')"> Terbaca Acc</span>
            </div>
        ` : '';

        card.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <div class="card-header-title">${t.buyerName || 'Tanpa Nama'} <span style="font-size:10px; color:var(--text-gold);">${countdownText}</span></div>
                <span class="pill-badge ${badgeType}" style="cursor:pointer;" onclick="toggleDeliveryStatus('${t.id}')">${t.status || '-'}</span>
            </div>
            <div class="invoice-divider"></div>
            ${nickHistoryHtml}
            <div class="premium-row">
                <span class="lbl">ID / Target:</span>
                <span class="val highlight">
                    ${t.buyerId || '-'} 
                    <button class="live-hide" style="padding:1px 4px; font-size:9px; background:none; border:1px solid var(--text-gold); color:var(--text-gold); cursor:pointer;" onclick="navigator.clipboard.writeText('${t.buyerId || ''}'); showToast('📋 ID Berhasil Disalin!', 'success');">📋 Salin</button>
                </span>
            </div>
            <div class="premium-row"><span class="lbl">Akun Penjual:</span><span class="val" style="color:var(--text-muted);">${t.accountName || '-'}</span></div>
            <div class="premium-row"><span class="lbl">Produk Item:</span><span class="pill-badge">${formatItemLabel(t)}</span></div>
            ${estRowHtml}
            ${friendshipRowHtml}
            <div class="card-action-footer">
                <button class="btn-mini-sec" style="border-color:#e67e22; color:#e67e22;" onclick="addNicknameHistory('${t.id}')">🔄 Nick</button>
                <button class="btn-mini-sec" style="border-color:#2ecc71; color:#2ecc71;" onclick="generateTestimonialImage('${t.id}')">📸 Testimoni</button>
                <button class="btn-mini-sec btn-copy-text" onclick="copyInvoiceText('${t.id}')">📋 Salin Teks</button>
                <button class="btn-mini-sec" onclick="openEditTxModal('${t.id}')">✏️ Edit</button>
                <button class="btn-mini-primary" onclick="generateInvoiceModal('${t.id}')">Nota</button>
                <button class="btn-mini-danger" onclick="moveTxToTrash('${t.id}')">🗑️</button>
            </div>
        `;
        container.appendChild(card);
    });
}

function getDaysRemaining(dateStr) {
    if(!dateStr) return 0;
    const target = new Date(dateStr);
    const today = new Date();
    target.setHours(0,0,0,0); today.setHours(0,0,0,0);
    return Math.round((target - today) / (1000 * 60 * 60 * 24));
}

function openEditTxModal(id) {
    const tx = state.transactions.find(t => t.id === id);
    if (!tx) return;
    const modal = document.getElementById('edit-tx-modal');

    document.getElementById('edit-tx-id').value = tx.id;
    document.getElementById('edit-tx-buyer-name').value = tx.buyerName || '';
    document.getElementById('edit-tx-buyer-id').value = tx.buyerId || '';

    const typeSelect = document.getElementById('edit-tx-type');
    const cfg = PRODUCT_CONFIG[TYPE_TO_PRODUCT[tx.starlightType] || currentProduct];
    typeSelect.innerHTML = cfg.variations.map(v => `<option value="${v.value}">${v.text}</option>`).join('');
    typeSelect.value = tx.starlightType || cfg.variations[0].value;

    // Harga jual & diskon disimpan per-item, tampilkan total kembali biar konsisten dengan tampilan awal
    document.getElementById('edit-tx-price-capital').value = tx.priceCapital || 0;
    document.getElementById('edit-tx-price-selling').value = tx.priceSelling || 0;
    document.getElementById('edit-tx-price-discount').value = tx.priceDiscount || 0;
    document.getElementById('edit-tx-purchase-date').value = tx.purchaseDate || '';
    document.getElementById('edit-tx-est-delivery').value = tx.estDeliveryDate || '';
    document.getElementById('edit-tx-status').value = tx.status || 'Belum Dikirim';

    if (modal) modal.classList.add('open');
}

function handleEditTxSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('edit-tx-id')?.value;
    const tx = state.transactions.find(t => t.id === id);
    if (!tx) return;

    tx.buyerName = document.getElementById('edit-tx-buyer-name')?.value || tx.buyerName;
    tx.buyerId = document.getElementById('edit-tx-buyer-id')?.value || tx.buyerId;
    tx.starlightType = document.getElementById('edit-tx-type')?.value || tx.starlightType;
    tx.priceCapital = parseFloat(document.getElementById('edit-tx-price-capital')?.value) || 0;
    tx.priceSelling = parseFloat(document.getElementById('edit-tx-price-selling')?.value) || 0;
    tx.priceDiscount = parseFloat(document.getElementById('edit-tx-price-discount')?.value) || 0;
    tx.purchaseDate = document.getElementById('edit-tx-purchase-date')?.value || tx.purchaseDate;
    tx.estDeliveryDate = document.getElementById('edit-tx-est-delivery')?.value || tx.estDeliveryDate;
    tx.status = document.getElementById('edit-tx-status')?.value || tx.status;
    tx.netProfit = (tx.priceSelling - tx.priceDiscount) - tx.priceCapital;

    saveState();
    document.getElementById('edit-tx-modal')?.classList.remove('open');
    renderAll(); buildCRMList();
    showToast('✅ Transaksi berhasil diperbarui!', 'success');
}

function addNicknameHistory(id) {
    const tx = state.transactions.find(t => t.id === id);
    showPrompt("Masukkan Nickname lama / perubahan baru pembeli:", "", (oldNick) => {
        if (oldNick && oldNick.trim() !== "") {
            if(!tx.nicknameHistory) tx.nicknameHistory = [];
            tx.nicknameHistory.push(oldNick.trim());
            saveState(); renderPembeliGrid();
            showToast("✅ Riwayat perubahan Nickname berhasil dicatat!");
        }
    });
}

function generateTestimonialImage(id) {
    const tx = state.transactions.find(t => t.id === id);
    const canvas = document.getElementById('testimonial-canvas'); 
    if(!canvas) return showToast("❌ Error: Canvas tidak ditemukan", "error");
    const ctx = canvas.getContext('2d');
    const customColor = state.theme === 'faust-gold' ? '#d4af37' : '#00e5ff';

    ctx.fillStyle = '#060b14'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = 'rgba(214, 175, 55, 0.05)'; ctx.lineWidth = 2;
    for(let i=0; i<canvas.width; i+=40) { ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i,canvas.height); ctx.stroke(); }
    for(let j=0; j<canvas.height; j+=40) { ctx.beginPath(); ctx.moveTo(0,j); ctx.lineTo(canvas.width,j); ctx.stroke(); }
    
    ctx.strokeStyle = customColor; ctx.lineWidth = 6; ctx.strokeRect(30, 30, canvas.width - 60, canvas.height - 60);
    
    ctx.fillStyle = customColor; ctx.font = 'bold 42px Arial'; ctx.textAlign = 'center';
    ctx.fillText('FAUSTLUNA STORE', canvas.width / 2, 160);
    ctx.fillStyle = '#8899a6'; ctx.font = '20px Arial';
    ctx.fillText('🌟 OFFICIAL TESTIMONIAL RECEIPT 🌟', canvas.width / 2, 210);
    
    ctx.fillStyle = '#091124'; ctx.fillRect(80, 280, canvas.width - 160, 200);
    ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = 2; ctx.strokeRect(80, 280, canvas.width - 160, 200);
    
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 36px Arial';
    ctx.fillText('THANK YOU FOR ORDERING!', canvas.width / 2, 370);
    ctx.fillStyle = customColor; ctx.font = '20px Arial';
    ctx.fillText('Pesanan Berhasil Diproses Selaras Antrean', canvas.width / 2, 420);
    
    let startY = 580;
    const rows = [
        { lbl: 'PELANGGAN', val: (tx.buyerName || 'Tanpa Nama').toUpperCase() },
        { lbl: 'TARGET ID GAME', val: tx.buyerId || '-' },
        { lbl: 'PRODUK GAME', val: formatItemLabel(tx).toUpperCase() },
        { lbl: 'TANGGAL ORDER', val: tx.purchaseDate || '-' },
        { lbl: 'STATUS SISTEM', val: 'SUDAH DIKIRIM (DONE) ✅' }
    ];
    
    rows.forEach(row => {
        ctx.textAlign = 'left'; ctx.fillStyle = '#8899a6'; ctx.font = 'bold 20px Arial';
        ctx.fillText(row.lbl, 90, startY);
        ctx.textAlign = 'right'; ctx.fillStyle = row.lbl.includes('STATUS') ? '#2ecc71' : '#ffffff';
        ctx.font = 'bold 22px Arial'; ctx.fillText(row.val, canvas.width - 90, startY);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(80, startY + 25); ctx.lineTo(canvas.width - 80, startY + 25); ctx.stroke();
        startY += 85;
    });
    
    ctx.textAlign = 'center'; ctx.fillStyle = '#8899a6'; ctx.font = 'italic 18px Arial';
    ctx.fillText('Follow us for more premium gaming top up services: @faustluna.store', canvas.width / 2, canvas.height - 100);
    
    const link = document.createElement('a'); link.download = `Testi-FaustLuna-${tx.buyerName || 'user'}.png`; link.href = canvas.toDataURL('image/png'); link.click();
    showToast("📸 Gambar testimoni Story (9:16) berhasil diunduh!", "success");
}

function copyInvoiceText(id) {
    const t = state.transactions.find(tx => tx.id === id);
    let textFormat = "";
    
    const isStarlightProduct = t.starlightType === 'Basic' || t.starlightType === 'Premium';

    if (isStarlightProduct) {
        if (t.status === 'Sudah Dikirim') {
            textFormat = `🎉 *BUKTI PENGIRIMAN FAUSTLUNA STORE* 🎉\n==================================\n\nHalo Kak *${t.buyerName}*, terima kasih banyak telah bersabar menunggu antrean! Pesanan top up game kamu telah berhasil dikirim oleh tim kami. Berikut detailnya:\n\n👤 Pembeli : *${t.buyerName}*\n💎 Produk : ${formatItemLabel(t)}\n🎯 Target ID : *${t.buyerId}*\n✅ Status :   *SUDAH DIKIRIM (SELESAI)*\n\n📌 *Catatan:* Silakan cek pesan masuk (in-game mail) atau sistem gift di dalam game kamu sekarang untuk mengklaim produknya ya Kak! 🎮\n\n----------------------------------\n⚡ *Butuh Top Up Instan & Hemat Lainnya?*\nKunjungi web top up resmi kami untuk proses otomatis 24 jam masuk dalam hitungan detik tanpa antre:\n🌐 https://faustluna.my.id/\n\nJangan lupa berikan testimoni terbaikmu ya, Kak! Have a nice day! ✨`;
        } else {
            textFormat = `🧾 *NOTA PESANAN FAUSTLUNA STORE* 🧾\n==================================\n\nHalo Kak *${t.buyerName}*, terima kasih telah mempercayakan top up game kamu di toko kami! Berikut adalah detail pesananmu:\n\n👤 Pembeli : *${t.buyerName}*\n💎 Produk : ${formatItemLabel(t)}\n🗓️ Est. Kirim: *${t.estDeliveryDate}* (Proses Antrean H+7/8)\n\n⚠️ *Catatan Penting:* Mohon pertemanan akun dengan akun penjual tetap aktif dan jangan mengganti Nickname MLBB kamu selama masa tunggu ya agar proses pengiriman lancar tanpa kendala! 🛡️\n\n----------------------------------\n⚡ *Mau Top Up Lebih Cepat & Hemat?*\nKunjungi web top up resmi kami untuk harga diskon harian termurah dan proses otomatis 24 jam di:\n🌐 https://faustluna.my.id/\n\nDitunggu orderan selanjutnya ya, Kak! Have a nice day! ✨`;
        }
    } else {
        if (t.status === 'Sudah Dikirim') {
            textFormat = `🎉 *BUKTI PENGIRIMAN FAUSTLUNA STORE* 🎉\n==================================\n\nHalo Kak *${t.buyerName}*, terima kasih banyak telah berbelanja di toko kami! Pesanan produk game kamu telah berhasil diproses dan sukses masuk ke akunmu. Berikut detailnya:\n\n👤 Pembeli : *${t.buyerName}*\n💎 Produk : ${formatItemLabel(t)}\n🎯 Target ID : *${t.buyerId}*\n✅ Status :   *SUDAH DIKIRIM (SELESAI)*\n\n📌 *Catatan:* Silakan buka game kamu dan cek langsung item/diamond kamu sekarang ya Kak!\n\n----------------------------------\n⚡ *Butuh Top Up Instan & Hemat Lainnya?*\nKunjungi web top up resmi kami untuk proses otomatis 24 jam masuk dalam hitungan detik tanpa antre:\n🌐 https://faustluna.my.id/\n\nJangan lupa berikan testimoni terbaikmu ya, Kak! Have a nice day! ✨`;
        } else {
            textFormat = `🧾 *NOTA PESANAN FAUSTLUNA STORE* 🧾\n==================================\n\nHalo Kak *${t.buyerName}*, terima kasih telah mempercayakan top up game kamu di toko kami! Pesananmu saat ini sudah masuk antrean sistem proses cepat kami. Berikut detailnya:\n\n👤 Pembeli : *${t.buyerName}*\n💎 Produk : ${formatItemLabel(t)}\n🎯 Target ID : *${t.buyerId}*\n⏳ Status :   *SEDANG DIPROSES (CEPAT/INSTAN)*\n\n⚠️ *Catatan Penting:* Produk ini diproses langsung tanpa perlu menunggu waktu pertemanan 7 hari. Mohon ditunggu beberapa saat sementara tim kami menyelesaikan pengiriman ya Kak!\n\n----------------------------------\n⚡ *Mau Top Up Lebih Cepat & Hemat?*\nKunjungi web top up resmi kami untuk harga diskon harian termurah dan proses otomatis 24 jam di:\n🌐 https://faustluna.my.id/\n\nDitunggu orderan selanjutnya ya, Kak! Have a nice day! ✨`;
        }
    }
    
    navigator.clipboard.writeText(textFormat)
        .then(() => { showToast(`📋 Teks nota (${t.status}) ${t.buyerName} berhasil disalin!`, "success"); })
        .catch(() => { showToast("❌ Gagal menyalin teks nota.", "error"); });
}

function toggleFriendship(id) {
    const tx = state.transactions.find(t => t.id === id);
    if(tx) {
        tx.friendshipChecked = !tx.friendshipChecked;
        saveState(); showToast("✅ Status pertemanan diperbarui", "success");
    }
}

function toggleDeliveryStatus(id) {
    const tx = state.transactions.find(t => t.id === id);
    if(!tx) return;
    const needsAccount = usesSellerAccount(tx.starlightType);
    const acc = needsAccount ? state.accounts.find(a => a.id === tx.accountId) : null;
    // WDP, Twilight, dan Diamond tidak punya akun penjual, jadi lewati penyesuaian stok akun
    if (needsAccount && !acc) return;
    const gachaInfo = GACHA_TYPE_MAP[tx.starlightType];

    if (tx.status === 'Booking') {
        if (tx.starlightType === 'Basic') { if ((acc.basic || 0) <= 0) return; acc.basic--; }
        else if (tx.starlightType === 'Premium') { if ((acc.premium || 0) <= 0) return; acc.premium--; }
        // Jalur Gacha: yang ditahan cuma stok itemnya, DM-nya udah kepotong dari awal
        // (sejak dicatat lewat "Catat Gacha"), jadi diamond gak disentuh di sini.
        else if (gachaInfo) { if ((acc[gachaInfo.stockField] || 0) <= 0) return; acc[gachaInfo.stockField]--; }
        tx.status = 'Belum Dikirim';
    } else if (tx.status === 'Belum Dikirim') {
        tx.status = 'Sudah Dikirim';
        // Genshin Impact & Wuthering Waves diproses instan (gak ada estimasi H+7 kayak
        // ML), jadi biar tetap ada kabar ke penjual, kirim notif pas statusnya baru aja
        // ditandai "Sudah Dikirim" (bukan pengingat H-N kayak produk ML).
        const prodKeyInstan = TYPE_TO_PRODUCT[tx.starlightType];
        if (prodKeyInstan === 'genshin' || prodKeyInstan === 'wuthering') {
            notifyInstantDeliverySuccess(tx, prodKeyInstan);
        }
    }
    else {
        tx.status = 'Booking';
        if (tx.starlightType === 'Basic') acc.basic++;
        else if (tx.starlightType === 'Premium') acc.premium++;
        else if (gachaInfo) acc[gachaInfo.stockField] = (acc[gachaInfo.stockField] || 0) + 1;
    }
    saveState(); renderAll(); showToast(`✅ Status: ${tx.status}`, "success");
}

// Notif "pengiriman sukses" khusus produk instan (Genshin Impact & Wuthering Waves).
// Dikirim lewat WhatsApp (kalau sudah disetting) dan notifikasi browser (kalau izinnya
// sudah "granted"), persis polanya reminder H-1 tapi dipicu begitu status berubah,
// bukan berdasarkan hitung mundur tanggal.
function notifyInstantDeliverySuccess(tx, prodKey) {
    const productLabel = PRODUCT_CONFIG[prodKey]?.label || prodKey;
    const textNotif = `*✅ PENGIRIMAN SUKSES!*\n\n` +
        `*Pembeli:* ${tx.buyerName || '-'}\n` +
        `*Produk:* ${productLabel}\n` +
        `*Item:* ${formatItemLabel(tx)}\n\n` +
        `Pesanan sudah berhasil dikirim ke pembeli. 🌙`;
    sendWhatsappNotification(textNotif);

    if ('Notification' in window && Notification.permission === 'granted') {
        try {
            new Notification('🌙 FaustLuna Store', {
                body: `Pengiriman sukses: ${tx.buyerName || 'Tanpa Nama'} — ${productLabel} (${formatItemLabel(tx)})`,
                icon: 'logo.png'
            });
        } catch (err) { console.error('Gagal menampilkan notifikasi browser pengiriman sukses:', err); }
    }
}

function checkGlobalOverdueAlert() {
    const todayStr = new Date().toISOString().split('T')[0];
    const hasUrgent = productTx().some(t => (t.status === 'Belum Dikirim' || t.status === 'Booking') && (t.estDeliveryDate || '') <= todayStr);
    const alertBox = document.getElementById('urgent-alert-container'); 
    const alertText = document.getElementById('alert-zone-text');
    
    if(!alertBox || !alertText) return;
    
    if(hasUrgent) {
        alertBox.classList.remove('hidden');
        alertText.innerHTML = `<strong>Alarm Pengiriman Mendesak!</strong> Ada pesanan menunggak hari ini! Silakan cek menu Info Pembeli.`;
        setMascotMood('pengingat', '⚠️ Ada pesanan menunggak, cek Info Pembeli ya!', 6000);
    } else { alertBox.classList.add('hidden'); }
}

function renderDailyAgenda() {
    const container = document.getElementById('daily-schedule-list'); if(!container) return;
    container.innerHTML = '';
    const todayStr = new Date().toISOString().split('T')[0];
    const todayOrders = productTx().filter(t => t.estDeliveryDate === todayStr && t.status !== 'Sudah Dikirim');
    
    if(todayOrders.length === 0) {
        container.innerHTML = maskotEmptyHTML('peluk', '☕ Santai! Tidak ada jadwal kirim hari ini.'); return;
    }
    todayOrders.forEach(t => {
        const div = document.createElement('div'); div.className = 'agenda-item';
        div.innerHTML = `<div><strong>${t.buyerName || 'Tanpa Nama'}</strong><br><small style="color:var(--text-muted);">${t.accountName || '-'} | ${t.starlightType || '-'}</small></div>
                         <button class="btn-mini-primary" style="padding:4px 8px;" onclick="toggleDeliveryStatus('${t.id}')">🚀 Kirim</button>`;
        container.appendChild(div);
    });
}

function renderRekapPage() {
    const filter = document.getElementById('rekap-month-filter'); if(!filter) return;
    const selectedMonth = filter.value;
    const myTx = productTx();
    const months = [...new Set(myTx.map(t => (t.purchaseDate || '').substring(0, 7)))].filter(Boolean).sort();
    
    filter.innerHTML = '<option value="all">Semua Bulan</option>';
    months.forEach(m => { const opt = document.createElement('option'); opt.value = m; opt.textContent = m; filter.appendChild(opt); });
    filter.value = months.includes(selectedMonth) ? selectedMonth : 'all';

    let txList = filter.value === 'all' ? myTx : myTx.filter(t => (t.purchaseDate || '').startsWith(filter.value));
    let omset = 0, modal = 0, profit = 0;
    
    const container = document.getElementById('rekap-premium-grid'); if(!container) return;
    container.innerHTML = '';
    
    // PELINDUNG DATA KOSONG UNTUK HALAMAN REKAP PEMBUKUAN
    txList.forEach(t => {
        const gross = (parseFloat(t.priceSelling) || 0) - (parseFloat(t.priceDiscount) || 0); 
        omset += gross; 
        modal += (parseFloat(t.priceCapital) || 0); 
        profit += (parseFloat(t.netProfit) || 0);
        
        const card = document.createElement('div'); card.className = 'premium-card'; card.style.padding = '12px 15px';
        card.innerHTML = `
            <div class="premium-row"><span class="lbl" style="font-weight:bold; color:var(--text-gold);">${t.buyerName || 'Tanpa Nama'}</span><span class="val" style="font-size:11px; opacity:0.6;">${t.purchaseDate || '-'}</span></div>
            <div class="premium-row"><span class="lbl">Item & Sumber:</span><span class="val">${formatItemLabel(t)} (${t.accountName || '-'})</span></div>
            <div class="premium-row"><span class="lbl">Omset Bersih:</span><span class="val">Rp ${(gross || 0).toLocaleString('id-ID')}</span></div>
            <div class="premium-row"><span class="lbl">Keuntungan:</span><span class="val privacy-hide" style="color:var(--success-green); font-weight:bold;">Rp ${(parseFloat(t.netProfit) || 0).toLocaleString('id-ID')}</span></div>
            <div style="display:flex; justify-content:flex-end; margin-top:5px;"><button class="btn-mini-danger" style="font-size:10px; padding:2px 8px;" onclick="moveTxToTrash('${t.id}')">Hapus</button></div>
        `;
        container.appendChild(card);
    });
    
    if(document.getElementById('stat-omset')) document.getElementById('stat-omset').textContent = `Rp ${(omset || 0).toLocaleString('id-ID')}`;
    if(document.getElementById('stat-modal')) document.getElementById('stat-modal').textContent = `Rp ${(modal || 0).toLocaleString('id-ID')}`;
    if(document.getElementById('stat-profit')) document.getElementById('stat-profit').textContent = `Rp ${(profit || 0).toLocaleString('id-ID')}`;
    initPrivacy();
}

function moveTxToTrash(id) {
    showConfirm("Pindahkan transaksi ini ke kotak sampah?", () => {
        const idx = state.transactions.findIndex(t => t.id === id);
        const item = state.transactions.splice(idx, 1)[0];
        state.trash.push({ id: "trash_" + Date.now(), type: "Transaksi", meta: `Pembeli: ${item.buyerName || '-'} | ${item.starlightType || '-'}`, rawData: item });
        saveState(); renderAll(); buildCRMList(); showToast("🗑️ ...Terbuang ke Kotak Sampah", "success");
    });
}

function renderTrashBin() {
    const container = document.getElementById('trash-premium-grid'); if(!container) return;
    container.innerHTML = '';
    if(state.trash.length === 0) { container.innerHTML = maskotEmptyHTML('recycle', 'Kotak sampah kosong.'); return; }
    state.trash.forEach(item => {
        const card = document.createElement('div'); card.className = 'premium-card';
        card.innerHTML = `
            <div class="card-header-title" style="font-size:13px; color:var(--danger-red);">${item.type || 'Data'}</div>
            <div class="invoice-divider"></div>
            <p style="font-size:12px; opacity:0.8; margin-bottom:10px;">${item.meta || '-'}</p>
            <button class="btn-mini-sec" style="width:100%;" onclick="restoreTrash('${item.id}')">♻️ Pulihkan Data</button>
        `;
        container.appendChild(card);
    });
}

function restoreTrash(id) {
    const idx = state.trash.findIndex(t => t.id === id);
    state.transactions.push(state.trash.splice(idx, 1)[0].rawData);
    saveState(); renderAll(); buildCRMList(); showToast("♻️ Data berhasil dipulihkan!", "success");
}

function generateInvoiceModal(id) {
    const tx = state.transactions.find(t => t.id === id);
    if(!tx) return;
    
    // PELINDUNG DATA KOSONG UNTUK INVOICE
    const totalClean = (parseFloat(tx.priceSelling) || 0) - (parseFloat(tx.priceDiscount) || 0);
    const itemText = (tx.starlightType || '').includes('Basic') || (tx.starlightType || '').includes('Premium') ? `Starlight ${tx.starlightType}` : formatItemLabel(tx);
    const isStarlightProduct = (tx.starlightType || '') === 'Basic' || (tx.starlightType || '') === 'Premium';
    
    if(document.getElementById('inv-buyer-name')) document.getElementById('inv-buyer-name').textContent = tx.buyerName || 'Tanpa Nama';
    if(document.getElementById('inv-buyer-id')) document.getElementById('inv-buyer-id').textContent = tx.buyerId || '-';
    if(document.getElementById('inv-item-type')) document.getElementById('inv-item-type').textContent = itemText;
    if(document.getElementById('inv-purchase-date')) document.getElementById('inv-purchase-date').textContent = tx.purchaseDate || '-';
    
    const deliveryDateEl = document.getElementById('inv-delivery-date');
    if (deliveryDateEl) {
        const rowEl = deliveryDateEl.closest('.invoice-row');
        if (isStarlightProduct) { rowEl.style.display = 'flex'; deliveryDateEl.textContent = tx.estDeliveryDate || '-'; } else { rowEl.style.display = 'none'; }
    }
    
    if(document.getElementById('inv-total-price')) document.getElementById('inv-total-price').textContent = `Rp ${(totalClean || 0).toLocaleString('id-ID')}`;
    
    const picker = document.getElementById('invoice-theme-picker');
    const customColor = picker ? picker.value : '#d4af37';
    
    const canvas = document.getElementById('invoice-canvas'); 
    if(!canvas) return;
    const ctx = canvas.getContext('2d');
    
    ctx.fillStyle = '#091124'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = customColor; ctx.lineWidth = 3; ctx.setLineDash([6, 6]);
    ctx.strokeRect(18, 18, canvas.width - 36, canvas.height - 36); ctx.setLineDash([]);
    
    ctx.fillStyle = customColor; ctx.font = 'bold 22px Arial'; ctx.textAlign = 'center';
    ctx.fillText('FAUSTLUNA STORE', canvas.width / 2, 65);
    ctx.fillStyle = '#8899a6'; ctx.font = '12px Arial';
    ctx.fillText('Official Game Gifting Invoice Receipt', canvas.width / 2, 88);
    
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(40, 115); ctx.lineTo(canvas.width - 40, 115); ctx.stroke(); ctx.setLineDash([]);
    
    const startX = 40; const endX = canvas.width - 40; let currentY = 155;
    const rows = [
        { label: 'Nama Pembeli:', value: tx.buyerName || '-', color: '#ffffff', isBadge: false },
        { label: 'Target Akun:', value: tx.buyerId || '-', color: '#ffffff', isBadge: false },
        { label: 'Produk Item:', value: itemText, color: '#091124', isBadge: true },
        { label: 'Tanggal Beli:', value: tx.purchaseDate || '-', color: '#ffffff', isBadge: false }
    ];
    if (isStarlightProduct) rows.push({ label: 'Estimasi Kirim:', value: tx.estDeliveryDate || '-', color: '#ffdf7a', isBadge: false, isBold: true });
    
    rows.forEach(row => {
        ctx.textAlign = 'left'; ctx.fillStyle = '#ffffff'; ctx.font = '14px Arial';
        ctx.fillText(row.label, startX, currentY); ctx.textAlign = 'right';
        if(row.isBadge) {
            ctx.font = 'bold 12px Arial'; const textWidth = ctx.measureText(row.value).width;
            ctx.fillStyle = customColor; ctx.fillRect(endX - textWidth - 16, currentY - 14, textWidth + 16, 22);
            ctx.fillStyle = '#091124'; ctx.fillText(row.value, endX - 8, currentY + 2);
        } else { ctx.font = row.isBold ? 'bold 14px Arial' : '14px Arial'; ctx.fillStyle = row.color; ctx.fillText(row.value, endX, currentY); }
        currentY += 36;
    });
    
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(40, currentY); ctx.lineTo(canvas.width - 40, currentY); ctx.stroke(); ctx.setLineDash([]);
    currentY += 35;
    
    ctx.textAlign = 'left'; ctx.fillStyle = '#ffffff'; ctx.font = 'bold 16px Arial'; ctx.fillText('Total Bersih:', startX, currentY);
    ctx.textAlign = 'right'; ctx.fillStyle = '#2ecc71'; ctx.font = 'bold 19px Arial';
    ctx.fillText(`Rp ${(totalClean || 0).toLocaleString('id-ID')}`, endX, currentY);
    
    ctx.textAlign = 'center'; ctx.fillStyle = '#8899a6'; ctx.font = '11px Arial';
    ctx.fillText('Nota Resmi Faustluna Store | Terima kasih atas kepercayaan Anda!', canvas.width / 2, canvas.height - 45);
    
    const invModal = document.getElementById('invoice-modal');
    if(invModal) invModal.classList.add('open');
    
    const downloadBtn = document.getElementById('download-invoice-btn');
    if(downloadBtn) {
        downloadBtn.onclick = () => {
            const link = document.createElement('a'); link.download = `Nota-${tx.buyerName || 'user'}.png`; link.href = canvas.toDataURL('image/png'); link.click();
        };
    }
}

if ('serviceWorker' in window.navigator) {
    const registerSW = () => {
        window.navigator.serviceWorker.register('./sw.js', { scope: './' })
            .then(reg => console.log('Service Worker terdaftar:', reg.scope))
            .catch(err => console.error('Gagal daftar Service Worker:', err));
    };
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        registerSW();
    } else {
        document.addEventListener('DOMContentLoaded', registerSW);
    }
}

// FUNGSI UNTUK MENGIRIM PESAN KE WHATSAPP (WhatsApp Cloud API resmi Meta, DENGAN DETEKSI ERROR)
async function sendWhatsappNotification(message) {
    const accessToken = state.settings.waAccessToken;
    const phoneNumberId = state.settings.waPhoneNumberId;
    const recipient = state.settings.waRecipientNumber;

    if (!accessToken || !phoneNumberId || !recipient) {
        console.warn('WhatsApp belum dikonfigurasi. Isi di menu Pengaturan.');
        return;
    }

    const url = `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify({
                messaging_product: 'whatsapp',
                to: recipient,
                type: 'text',
                text: { body: message, preview_url: false }
            })
        });

        const data = await response.json();

        if (!response.ok) {
            console.error("Detail Error WhatsApp:", data);
            // Error paling umum: pesan dikirim di luar jendela 24 jam sejak balasan
            // terakhir dari nomor tujuan, sehingga WhatsApp menolak pesan teks bebas
            // dan mewajibkan pakai Template Message yang sudah disetujui Meta.
            showToast(`❌ WhatsApp Gagal: ${data.error?.message || 'cek konfigurasi & jendela 24 jam'}`, "error");
        } else {
            console.log("Notifikasi WhatsApp berhasil dikirim.");
        }

    } catch (error) {
        console.error('Koneksi gagal ke WhatsApp:', error);
        showToast("❌ Gagal terhubung ke server WhatsApp", "error");
    }
}

// Nama lama tetap disediakan sebagai alias, biar kalau ada pemanggilan lama
// yang kelewat belum diganti, tetap jalan ke WhatsApp (bukan Telegram lagi).
function sendTelegramNotification(message) {
    return sendWhatsappNotification(message);
}


