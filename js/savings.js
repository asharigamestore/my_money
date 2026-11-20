/* ============================================================
   MY MONEY — savings.js
   Target tabungan: setor / tarik dana, progres otomatis
   ============================================================ */
'use strict';

Views.savings = {
  title: 'Tabungan',

  async render(el) {
    const targets = (await DB.getAll('savings')).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    const totalSaved = targets.reduce((s, t) => s + (t.saved || 0), 0);
    const totalGoal = targets.reduce((s, t) => s + (t.target || 0), 0);

    el.innerHTML = `
      <section class="card">
        <div class="hero-top">
          <span class="hero-label">Total Tabungan Terkumpul</span>
          ${targets.length ? `<span class="hero-period">${targets.length} target</span>` : ''}
        </div>
        <div class="hero-amount serif num" style="font-size:clamp(1.9rem,5vw,2.6rem)">${Utils.fmtIDR(totalSaved)}</div>
        ${totalGoal ? `
        <div class="ratio-bar" style="margin-top:16px"><div class="ratio-fill" style="width:${Math.min(Utils.pct(totalSaved, totalGoal), 100)}%"></div></div>
        <div class="ratio-text">${Utils.pct(totalSaved, totalGoal)}% dari total target ${Utils.fmtIDR(totalGoal)}</div>` : ''}
      </section>

      <div class="section-gap sav-grid">
        ${targets.map(t => {
          const p = Utils.pct(t.saved, t.target);
          const done = t.saved >= t.target;
          return `
          <div class="card hoverable sav-card">
            <div class="sav-top">
              <div>
                <div class="sav-name">${Utils.esc(t.name)}</div>
                <div class="sav-deadline"><i data-lucide="calendar-days"></i>Target: ${Utils.fmtDate(t.deadline)}</div>
              </div>
              <span class="badge ${done ? 'ok' : 'info'}">${done ? 'Tercapai' : p + '%'}</span>
            </div>
            <div>
              <div class="progress"><div class="progress-bar" style="width:${Math.min(p, 100)}%"></div></div>
              <div class="progress-label"><b class="num">${Utils.fmtIDR(t.saved)}</b><span class="num">dari ${Utils.fmtIDR(t.target)}</span></div>
            </div>
            <div class="sav-actions">
              <button class="btn-primary-soft" data-fund="${t.id}" data-mode="in"><i data-lucide="plus"></i>Setor</button>
              <button class="btn-ghost" data-fund="${t.id}" data-mode="out" ${t.saved <= 0 ? 'disabled style="opacity:.5"' : ''}><i data-lucide="minus"></i>Tarik</button>
              <button class="mini-btn" data-edit="${t.id}" title="Edit" style="align-self:center"><i data-lucide="pencil"></i></button>
              <button class="mini-btn danger" data-del="${t.id}" title="Hapus" style="align-self:center"><i data-lucide="trash-2"></i></button>
            </div>
          </div>`;
        }).join('')}
        <button class="add-card" id="sav-add"><i data-lucide="plus"></i>Buat Target Tabungan</button>
      </div>

      ${targets.length ? '' : `
      <section class="card section-gap">
        <div class="empty-state">
          <div class="empty-ico"><i data-lucide="piggy-bank"></i></div>
          <h4>Mulai menabung dengan target</h4>
          <p>Buat target seperti dana darurat, liburan, atau uang muka. Setoran dicatat sebagai pindah dana, bukan pengeluaran — saldo utamamu tidak berkurang secara dobel.</p>
        </div>
      </section>`}`;

    el.querySelector('#sav-add').addEventListener('click', () => this.openTargetForm());
    el.querySelectorAll('[data-fund]').forEach(b => b.addEventListener('click', async () => {
      const t = (await DB.getAll('savings')).find(x => x.id === b.dataset.fund);
      if (t) this.openFundForm(t, b.dataset.mode);
    }));
    el.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', async () => {
      const t = (await DB.getAll('savings')).find(x => x.id === b.dataset.edit);
      if (t) this.openTargetForm(t);
    }));
    el.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', async () => {
      const t = (await DB.getAll('savings')).find(x => x.id === b.dataset.del);
      if (t) this.remove(t);
    }));
  },

  openTargetForm(existing = null) {
    Modal.open({
      title: existing ? 'Edit Target Tabungan' : 'Buat Target Tabungan',
      submitLabel: existing ? 'Simpan Perubahan' : 'Buat Target',
      body: `
        <div class="field">
          <label>Nama Target</label>
          <input class="form-control" name="name" placeholder="cth: Dana Darurat" value="${Utils.esc(existing?.name || '')}" maxlength="50" required />
        </div>
        <div class="row-2">
          <div class="field">
            <label>Target Nominal (Rp)</label>
            <input class="form-control rupiah-input" name="target" inputmode="numeric" data-value="${existing ? existing.target : ''}" required />
          </div>
          <div class="field">
            <label>Tenggat Waktu</label>
            <input class="form-control" type="date" name="deadline" value="${existing?.deadline || ''}" required />
          </div>
        </div>
        ${existing ? '' : `
        <div class="field">
          <label>Saldo Awal Terkumpul (opsional)</label>
          <input class="form-control rupiah-input" name="initial" inputmode="numeric" placeholder="0" />
        </div>`}`,
      async onSubmit(data, form) {
        const name = (data.name || '').trim();
        if (!name) throw new Error('Nama target wajib diisi.');
        const target = Utils.parseNum(form.querySelector('[name=target]').dataset.raw);
        if (!target || target <= 0) throw new Error('Target nominal harus lebih dari nol.');
        if (!data.deadline) throw new Error('Tenggat waktu wajib diisi.');
        if (existing) {
          await DB.put('savings', { ...existing, name, target, deadline: data.deadline });
          Toast.show('Target tabungan diperbarui');
        } else {
          const initial = Utils.parseNum(form.querySelector('[name=initial]').dataset.raw);
          await DB.put('savings', {
            id: Utils.uid(), name, target, deadline: data.deadline,
            saved: Math.max(initial, 0), createdAt: Date.now()
          });
          Toast.show('Target tabungan dibuat');
        }
        Bus.emit('data-changed');
        App.refresh();
      }
    });
  },

  openFundForm(t, mode) {
    const isIn = mode === 'in';
    Modal.open({
      title: isIn ? `Setor ke "${t.name}"` : `Tarik dari "${t.name}"`,
      submitLabel: isIn ? 'Setor Dana' : 'Tarik Dana',
      body: `
        <div class="form-note"><i data-lucide="info"></i><span>
          ${isIn
            ? 'Setoran dicatat sebagai pindah dana (transfer), bukan pengeluaran — tidak mengurangi saldo utama secara dobel.'
            : 'Penarikan dicatat sebagai pindah dana kembali ke saldo utama.'}
        </span></div>
        <div class="field">
          <label>Nominal (Rp)</label>
          <input class="form-control rupiah-input" name="amount" inputmode="numeric" required />
        </div>
        <div class="field">
          <label>Catatan (opsional)</label>
          <input class="form-control" name="note" placeholder="cth: setoran rutin" maxlength="80" />
        </div>
        <p class="hint">Saldo target saat ini: <b class="num">${Utils.fmtIDR(t.saved)}</b></p>`,
      async onSubmit(data, form) {
        const amount = Utils.parseNum(form.querySelector('[name=amount]').dataset.raw);
        if (!amount || amount <= 0) throw new Error('Nominal harus lebih dari nol.');
        if (!isIn && amount > t.saved) throw new Error('Nominal melebihi saldo terkumpul (' + Utils.fmtIDR(t.saved) + ').');
        const note = (data.note || '').trim();
        const tx = {
          id: Utils.uid(),
          type: 'transfer',
          amount,
          category: isIn ? 'Setoran Tabungan' : 'Penarikan Tabungan',
          note: `${isIn ? 'Setor' : 'Tarik'}: ${t.name}${note ? ' — ' + note : ''}`,
          date: Utils.dateISO(),
          method: 'Transfer Bank',
          monthKey: Utils.monthKey(),
          createdAt: Date.now(),
          refType: 'saving', refId: t.id
        };
        await DB.put('transactions', tx);
        await DB.put('savings', { ...t, saved: t.saved + (isIn ? amount : -amount) });
        Toast.show(isIn ? 'Dana berhasil disetor' : 'Dana berhasil ditarik');
        Bus.emit('data-changed');
        App.refresh();
      }
    });
  },

  async remove(t) {
    if (!await Modal.confirm(`Hapus target "${t.name}"? Riwayat pindah dana tetap tersimpan di Transaksi.`, { ok: 'Hapus' })) return;
    await DB.del('savings', t.id);
    Toast.show('Target tabungan dihapus');
    Bus.emit('data-changed');
    App.refresh();
  }
};
