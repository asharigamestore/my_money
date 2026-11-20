/* ============================================================
   MY MONEY — transactions.js
   Daftar, cari, filter, urutkan, tambah/edit/hapus transaksi
   ============================================================ */
'use strict';

const TxState = { q: '', type: 'all', cat: 'all', sort: 'date_desc' };

function txIcon(t) {
  const c = (t.category || '').toLowerCase();
  if (t.type === 'transfer') return 'repeat';
  if (c.includes('makan') || c.includes('minum')) return 'utensils';
  if (c.includes('transport')) return 'car';
  if (c.includes('bensin')) return 'fuel';
  if (c.includes('rumah')) return 'house';
  if (c.includes('belanja')) return 'shopping-bag';
  if (c.includes('tagihan')) return 'receipt';
  if (c.includes('hiburan')) return 'gamepad-2';
  if (c.includes('kesehatan')) return 'heart-pulse';
  if (c.includes('tabungan')) return 'piggy-bank';
  if (c.includes('gaji')) return 'briefcase';
  if (c.includes('bonus') || c.includes('insentif')) return 'gift';
  if (c.includes('usaha')) return 'zap';
  if (c.includes('penjualan')) return 'store';
  return t.type === 'income' ? 'banknote' : 'receipt';
}

const TxUI = {
  row(t) {
    const badge = { income: 'Masuk', expense: 'Keluar', transfer: 'Transfer' }[t.type];
    const cls = { income: 'ok', expense: 'bad', transfer: 'info' }[t.type];
    const sign = t.type === 'income' ? '+' : t.type === 'expense' ? '−' : '';
    return `
      <div class="tx-row">
        <div class="tx-ico ${t.type}"><i data-lucide="${txIcon(t)}"></i></div>
        <div class="tx-main">
          <div class="tx-name">${Utils.esc(t.note || t.category)}</div>
          <div class="tx-meta">${Utils.esc(t.category)} &bull; ${Utils.relativeDay(t.date)} &bull; ${Utils.esc(t.method || '-')}</div>
        </div>
        <div class="tx-right">
          <div class="tx-amount num ${t.type}">${sign}${Utils.fmtIDR(t.amount)}</div>
          <div style="margin-top:3px"><span class="badge ${cls}">${badge}</span></div>
        </div>
        <div class="tx-actions">
          <button class="mini-btn" data-edit="${t.id}" title="Edit" aria-label="Edit transaksi"><i data-lucide="pencil"></i></button>
          <button class="mini-btn danger" data-del="${t.id}" title="Hapus" aria-label="Hapus transaksi"><i data-lucide="trash-2"></i></button>
        </div>
      </div>`;
  },

  catsFor(type) {
    return type === 'income' ? DB.INCOME_CATS : type === 'expense' ? DB.EXPENSE_CATS : DB.TRANSFER_CATS;
  },

  openForm(existing = null, presetType = null) {
    const t = existing || { type: presetType || 'expense', date: Utils.dateISO(), method: 'Tunai' };
    const linked = existing?.refType === 'salary' ? 'Transaksi ini dibuat otomatis dari data gaji. Mengubah nominal di sini tidak mengubah data gaji.'
      : existing?.refType === 'saving' ? 'Transaksi ini dibuat otomatis dari aktivitas tabungan.' : null;
    Modal.open({
      title: existing ? 'Edit Transaksi' : 'Tambah Transaksi',
      submitLabel: existing ? 'Simpan Perubahan' : 'Tambah',
      body: `
        ${linked ? `<div class="form-note"><i data-lucide="info"></i><span>${linked}</span></div>` : ''}
        <div class="row-2">
          <div class="field">
            <label>Jenis</label>
            <select class="form-select" name="type" id="f-type">
              <option value="income" ${t.type === 'income' ? 'selected' : ''}>Pemasukan</option>
              <option value="expense" ${t.type === 'expense' ? 'selected' : ''}>Pengeluaran</option>
              <option value="transfer" ${t.type === 'transfer' ? 'selected' : ''}>Transfer / Pindah Dana</option>
            </select>
          </div>
          <div class="field">
            <label>Kategori</label>
            <select class="form-select" name="category" id="f-cat"></select>
          </div>
        </div>
        <div class="row-2">
          <div class="field">
            <label>Nominal (Rp)</label>
            <input class="form-control rupiah-input" name="amount" inputmode="numeric" placeholder="0"
                   data-value="${existing ? existing.amount : ''}" required />
          </div>
          <div class="field">
            <label>Tanggal</label>
            <input class="form-control" type="date" name="date" value="${t.date}" required />
          </div>
        </div>
        <div class="row-2">
          <div class="field">
            <label>Metode Pembayaran</label>
            <select class="form-select" name="method">
              ${DB.METHODS.map(m => `<option ${t.method === m ? 'selected' : ''}>${m}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label>Nama Transaksi</label>
            <input class="form-control" name="note" placeholder="cth: Makan siang" value="${Utils.esc(t.note || '')}" maxlength="80" />
          </div>
        </div>
        <p class="hint">Transfer / pindah dana (mis. ke tabungan) tidak dihitung sebagai pemasukan maupun pengeluaran agar tidak ada perhitungan ganda.</p>`,
      onOpen(overlay, form) {
        const typeSel = form.querySelector('#f-type');
        const catSel = form.querySelector('#f-cat');
        const fill = () => {
          catSel.innerHTML = TxUI.catsFor(typeSel.value)
            .map(c => `<option ${existing && c === existing.category ? 'selected' : ''}>${c}</option>`).join('');
        };
        fill();
        typeSel.addEventListener('change', fill);
      },
      async onSubmit(data, form) {
        const amount = Utils.parseNum(form.querySelector('[name=amount]').dataset.raw);
        if (!amount || amount <= 0) throw new Error('Nominal harus lebih dari nol.');
        if (!data.date) throw new Error('Tanggal wajib diisi.');
        const rec = {
          id: existing ? existing.id : Utils.uid(),
          type: data.type,
          amount,
          category: data.category,
          note: (data.note || '').trim(),
          date: data.date,
          method: data.method,
          monthKey: data.date.slice(0, 7),
          createdAt: existing ? existing.createdAt : Date.now(),
          refType: existing ? existing.refType : undefined,
          refId: existing ? existing.refId : undefined
        };
        await DB.put('transactions', rec);
        Toast.show(existing ? 'Transaksi diperbarui' : 'Transaksi ditambahkan');
        Bus.emit('data-changed');
        App.refresh();
      }
    });
  },

  async remove(t) {
    if (t.refType === 'salary') {
      Toast.show('Transaksi gaji dihapus melalui menu Gaji agar data tetap konsisten.', 'info');
      return;
    }
    const msg = t.refType === 'saving'
      ? 'Hapus catatan ini? Saldo target tabungan TIDAK ikut berubah.'
      : `Hapus transaksi "${t.note || t.category}" (${Utils.fmtIDR(t.amount)})?`;
    if (!await Modal.confirm(msg, { ok: 'Hapus' })) return;
    await DB.del('transactions', t.id);
    Toast.show('Transaksi dihapus');
    Bus.emit('data-changed');
    App.refresh();
  }
};

Views.transactions = {
  title: 'Transaksi',

  async render(el) {
    const allCats = [...DB.INCOME_CATS, ...DB.EXPENSE_CATS, ...DB.TRANSFER_CATS];
    el.innerHTML = `
      <section class="card">
        <div class="toolbar">
          <div class="search-box">
            <i data-lucide="search"></i>
            <input class="form-control" id="tx-search" placeholder="Cari nama atau kategori…" value="${Utils.esc(TxState.q)}" />
          </div>
          <select class="form-select" id="tx-type" style="width:auto">
            <option value="all">Semua Jenis</option>
            <option value="income" ${TxState.type === 'income' ? 'selected' : ''}>Pemasukan</option>
            <option value="expense" ${TxState.type === 'expense' ? 'selected' : ''}>Pengeluaran</option>
            <option value="transfer" ${TxState.type === 'transfer' ? 'selected' : ''}>Transfer</option>
          </select>
          <select class="form-select" id="tx-cat" style="width:auto">
            <option value="all">Semua Kategori</option>
            ${allCats.map(c => `<option ${TxState.cat === c ? 'selected' : ''}>${c}</option>`).join('')}
          </select>
          <select class="form-select" id="tx-sort" style="width:auto">
            <option value="date_desc" ${TxState.sort === 'date_desc' ? 'selected' : ''}>Terbaru</option>
            <option value="date_asc" ${TxState.sort === 'date_asc' ? 'selected' : ''}>Terlama</option>
            <option value="amount_desc" ${TxState.sort === 'amount_desc' ? 'selected' : ''}>Nominal Tertinggi</option>
            <option value="amount_asc" ${TxState.sort === 'amount_asc' ? 'selected' : ''}>Nominal Terendah</option>
          </select>
          <div class="spacer"></div>
          <button class="btn-primary" id="tx-add"><i data-lucide="plus"></i>Tambah</button>
        </div>
        <div id="tx-summary" class="report-range" style="margin-bottom:10px"></div>
        <div class="tx-list" id="tx-list"></div>
      </section>`;

    el.querySelector('#tx-add').addEventListener('click', () => TxUI.openForm());
    el.querySelector('#tx-search').addEventListener('input', Utils.debounce(e => {
      TxState.q = e.target.value.trim(); this.renderList(el);
    }, 200));
    el.querySelector('#tx-type').addEventListener('change', e => { TxState.type = e.target.value; this.renderList(el); });
    el.querySelector('#tx-cat').addEventListener('change', e => { TxState.cat = e.target.value; this.renderList(el); });
    el.querySelector('#tx-sort').addEventListener('change', e => { TxState.sort = e.target.value; this.renderList(el); });
    el.querySelector('#tx-list').addEventListener('click', async e => {
      const editBtn = e.target.closest('[data-edit]');
      const delBtn = e.target.closest('[data-del]');
      if (!editBtn && !delBtn) return;
      const id = (editBtn || delBtn).dataset.edit || (editBtn || delBtn).dataset.del;
      const all = await Q.transactions();
      const t = all.find(x => x.id === id);
      if (!t) return;
      if (editBtn) TxUI.openForm(t);
      else TxUI.remove(t);
    });

    await this.renderList(el);
  },

  async renderList(el) {
    const container = el.querySelector('#tx-list');
    if (!container) return;
    let tx = await Q.transactions();
    if (TxState.type !== 'all') tx = tx.filter(t => t.type === TxState.type);
    if (TxState.cat !== 'all') tx = tx.filter(t => t.category === TxState.cat);
    if (TxState.q) {
      const q = TxState.q.toLowerCase();
      tx = tx.filter(t => ((t.note || '') + ' ' + (t.category || '')).toLowerCase().includes(q));
    }
    const sorters = {
      date_desc: (a, b) => b.date.localeCompare(a.date),
      date_asc: (a, b) => a.date.localeCompare(b.date),
      amount_desc: (a, b) => b.amount - a.amount,
      amount_asc: (a, b) => a.amount - b.amount
    };
    tx.sort(sorters[TxState.sort] || sorters.date_desc);

    const inc = tx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const exp = tx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const summary = el.querySelector('#tx-summary');
    if (summary) {
      summary.innerHTML = `${tx.length} transaksi &bull; Pemasukan <b class="num" style="color:var(--ok)">${Utils.fmtIDR(inc)}</b>
        &bull; Pengeluaran <b class="num" style="color:var(--bad)">${Utils.fmtIDR(exp)}</b>`;
    }
    container.innerHTML = tx.length ? tx.map(TxUI.row).join('') : `
      <div class="empty-state">
        <div class="empty-ico"><i data-lucide="receipt"></i></div>
        <h4>${TxState.q || TxState.type !== 'all' || TxState.cat !== 'all' ? 'Tidak ditemukan' : 'Belum ada transaksi'}</h4>
        <p>${TxState.q || TxState.type !== 'all' || TxState.cat !== 'all'
          ? 'Coba ubah kata kunci atau filter yang digunakan.'
          : 'Semua pemasukan dan pengeluaran akan tercatat di sini.'}</p>
      </div>`;
    if (window.lucide) lucide.createIcons();
  }
};
