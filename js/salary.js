/* ============================================================
   MY MONEY — salary.js
   Pencatatan gaji mingguan/bulanan + sinkron transaksi pemasukan
   ============================================================ */
'use strict';

Views.salary = {
  title: 'Gaji',

  periodInfo(type, val) {
    if (type === 'monthly') {
      return { key: val, label: Utils.monthLabel(val) };
    }
    const d = new Date(val + 'T00:00:00');
    const week = Math.ceil(d.getDate() / 7);
    const mLabel = d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
    return { key: Utils.monthKey(d) + '-W' + week, label: 'Minggu ke-' + week + ', ' + mLabel };
  },

  async render(el) {
    const sal = (await DB.getAll('salaries'))
      .sort((a, b) => (b.periodKey || '').localeCompare(a.periodKey || '') || (b.createdAt || 0) - (a.createdAt || 0));
    const mk = Utils.monthKey();
    const thisMonth = sal.filter(s => (s.periodKey || '').startsWith(mk));
    const monthTotal = thisMonth.reduce((x, s) => x + (s.net || 0), 0);

    el.innerHTML = `
      <div class="grid-2">
        <section class="card">
          <div class="card-head"><h3>Gaji ${Utils.monthLabel(mk)}</h3></div>
          <div class="big-number serif num">${Utils.fmtIDR(monthTotal)}</div>
          <p class="muted small" style="margin:6px 0 0">dari ${thisMonth.length} pencatatan bulan ini</p>
        </section>
        <section class="card">
          <div class="card-head"><h3>Catat Gaji</h3></div>
          <button class="btn-primary w-100" id="salary-add"><i data-lucide="plus"></i>Catat Gaji Baru</button>
          <p class="muted small" style="margin:12px 0 0">Gaji tersimpan otomatis menjadi pemasukan kategori <b>Gaji</b>, sehingga tidak perlu dicatat dua kali di menu Transaksi.</p>
        </section>
      </div>
      <section class="card stack" style="margin-top:18px">
        <div class="card-head" style="margin:0"><h3>Riwayat Gaji</h3></div>
        <div id="salary-list">
          ${sal.length ? sal.map(s => `
            <div class="salary-row">
              <div class="tx-ico income"><i data-lucide="briefcase"></i></div>
              <div class="tx-main">
                <div class="tx-name">${Utils.esc(s.source)}</div>
                <div class="salary-detail">${Utils.esc(s.periodLabel)} &bull; diterima ${Utils.fmtDate(s.receivedDate)}
                  &bull; pokok ${Utils.fmtIDR(s.base)}${s.bonus ? ' + bonus ' + Utils.fmtIDR(s.bonus) : ''}${s.overtime ? ' + lembur ' + Utils.fmtIDR(s.overtime) : ''}${s.allowance ? ' + tunjangan ' + Utils.fmtIDR(s.allowance) : ''}${s.deduction ? ' − potongan ' + Utils.fmtIDR(s.deduction) : ''}</div>
              </div>
              <div class="tx-right">
                <div class="tx-amount num income">+${Utils.fmtIDR(s.net)}</div>
                <span class="badge ${s.periodType === 'weekly' ? 'info' : 'ok'}" style="margin-top:3px;display:inline-block">${s.periodType === 'weekly' ? 'Mingguan' : 'Bulanan'}</span>
              </div>
              <div class="tx-actions" style="opacity:1">
                <button class="mini-btn" data-edit="${s.id}" title="Edit"><i data-lucide="pencil"></i></button>
                <button class="mini-btn danger" data-del="${s.id}" title="Hapus"><i data-lucide="trash-2"></i></button>
              </div>
            </div>`).join('') : `
            <div class="empty-state">
              <div class="empty-ico"><i data-lucide="briefcase"></i></div>
              <h4>Belum ada gaji tercatat</h4>
              <p>Catat gaji pokok, bonus, lembur, tunjangan, dan potongan — total bersih dihitung otomatis.</p>
            </div>`}
        </div>
      </section>`;

    el.querySelector('#salary-add').addEventListener('click', () => this.openForm());
    el.querySelector('#salary-list').addEventListener('click', async e => {
      const editBtn = e.target.closest('[data-edit]');
      const delBtn = e.target.closest('[data-del]');
      if (!editBtn && !delBtn) return;
      const id = (editBtn || delBtn).dataset.edit || (editBtn || delBtn).dataset.del;
      const all = await DB.getAll('salaries');
      const s = all.find(x => x.id === id);
      if (!s) return;
      if (editBtn) this.openForm(s);
      else this.remove(s);
    });
  },

  openForm(existing = null) {
    const t = existing || { periodType: 'monthly', receivedDate: Utils.dateISO() };
    const thisMonth = Utils.monthKey();
    Modal.open({
      title: existing ? 'Edit Gaji' : 'Catat Gaji',
      submitLabel: existing ? 'Simpan Perubahan' : 'Simpan Gaji',
      body: `
        <div class="field">
          <label>Sumber Pekerjaan</label>
          <input class="form-control" name="source" placeholder="cth: PT Maju Bersama" value="${Utils.esc(t.source || '')}" maxlength="60" required />
        </div>
        <div class="row-2">
          <div class="field">
            <label>Periode Gaji</label>
            <select class="form-select" name="periodType" id="s-period-type">
              <option value="monthly" ${t.periodType === 'monthly' ? 'selected' : ''}>Bulanan</option>
              <option value="weekly" ${t.periodType === 'weekly' ? 'selected' : ''}>Mingguan</option>
            </select>
          </div>
          <div class="field">
            <label id="s-period-label">Bulan</label>
            <input class="form-control" type="month" name="periodMonth" id="s-period-month" value="${t.periodType === 'monthly' ? (t.periodKey || thisMonth) : thisMonth}" />
            <input class="form-control" type="date" name="periodWeek" id="s-period-week" value="${Utils.dateISO()}" style="display:none" />
          </div>
        </div>
        <div class="field">
          <label>Tanggal Penerimaan</label>
          <input class="form-control" type="date" name="receivedDate" value="${t.receivedDate || Utils.dateISO()}" required />
        </div>
        <div class="row-2">
          <div class="field"><label>Gaji Pokok (Rp)</label>
            <input class="form-control rupiah-input" name="base" inputmode="numeric" data-value="${t.base || ''}" /></div>
          <div class="field"><label>Bonus (Rp)</label>
            <input class="form-control rupiah-input" name="bonus" inputmode="numeric" data-value="${t.bonus || ''}" /></div>
        </div>
        <div class="row-2">
          <div class="field"><label>Lembur (Rp)</label>
            <input class="form-control rupiah-input" name="overtime" inputmode="numeric" data-value="${t.overtime || ''}" /></div>
          <div class="field"><label>Tunjangan (Rp)</label>
            <input class="form-control rupiah-input" name="allowance" inputmode="numeric" data-value="${t.allowance || ''}" /></div>
        </div>
        <div class="field"><label>Potongan (Rp)</label>
          <input class="form-control rupiah-input" name="deduction" inputmode="numeric" data-value="${t.deduction || ''}" /></div>
        <div class="net-preview"><span>Total gaji bersih</span><b class="num" id="s-net">Rp0</b></div>`,
      onOpen(overlay, form) {
        const typeSel = form.querySelector('#s-period-type');
        const monthIn = form.querySelector('#s-period-month');
        const weekIn = form.querySelector('#s-period-week');
        const label = form.querySelector('#s-period-label');
        const toggle = () => {
          const weekly = typeSel.value === 'weekly';
          monthIn.style.display = weekly ? 'none' : '';
          weekIn.style.display = weekly ? '' : 'none';
          label.textContent = weekly ? 'Tanggal di Minggu Tersebut' : 'Bulan';
        };
        toggle();
        typeSel.addEventListener('change', toggle);
        const netEl = form.querySelector('#s-net');
        const calc = () => {
          const v = n => Utils.parseNum(form.querySelector(`[name=${n}]`).dataset.raw);
          const net = v('base') + v('bonus') + v('overtime') + v('allowance') - v('deduction');
          netEl.textContent = Utils.fmtIDR(net);
        };
        form.querySelectorAll('.rupiah-input').forEach(i => i.addEventListener('input', calc));
        if (existing) calc();
      },
      async onSubmit(data, form) {
        const v = n => Utils.parseNum(form.querySelector(`[name=${n}]`).dataset.raw);
        const base = v('base'), bonus = v('bonus'), overtime = v('overtime'),
              allowance = v('allowance'), deduction = v('deduction');
        const net = base + bonus + overtime + allowance - deduction;
        const source = (data.source || '').trim();
        if (!source) throw new Error('Nama sumber pekerjaan wajib diisi.');
        if (base <= 0) throw new Error('Gaji pokok harus lebih dari nol.');
        if (net <= 0) throw new Error('Total gaji bersih harus lebih dari nol.');
        if (!data.receivedDate) throw new Error('Tanggal penerimaan wajib diisi.');
        const periodVal = data.periodType === 'monthly' ? data.periodMonth : data.periodWeek;
        if (!periodVal) throw new Error('Periode gaji wajib diisi.');
        const info = Views.salary.periodInfo(data.periodType, periodVal);

        const id = existing ? existing.id : Utils.uid();
        const rec = {
          id, source, periodType: data.periodType, periodKey: info.key, periodLabel: info.label,
          receivedDate: data.receivedDate, base, bonus, overtime, allowance, deduction, net,
          createdAt: existing ? existing.createdAt : Date.now()
        };
        await DB.put('salaries', rec);
        // Sinkron transaksi pemasukan terkait (hindari dobel hitung)
        const linked = await Q.byRef('salary', id);
        await DB.put('transactions', {
          id: linked ? linked.id : Utils.uid(),
          type: 'income', amount: net, category: 'Gaji',
          note: `Gaji ${source} — ${info.label}`,
          date: data.receivedDate, method: 'Transfer Bank',
          monthKey: data.receivedDate.slice(0, 7),
          createdAt: linked ? linked.createdAt : Date.now(),
          refType: 'salary', refId: id
        });
        Toast.show(existing ? 'Data gaji diperbarui' : 'Gaji tersimpan & tercatat sebagai pemasukan');
        Bus.emit('data-changed');
        App.refresh();
      }
    });
  },

  async remove(s) {
    if (!await Modal.confirm(`Hapus gaji dari "${s.source}" periode ${s.periodLabel}? Transaksi pemasukan terkait juga dihapus.`, { ok: 'Hapus' })) return;
    await DB.del('salaries', s.id);
    const linked = await Q.byRef('salary', s.id);
    if (linked) await DB.del('transactions', linked.id);
    Toast.show('Data gaji dihapus');
    Bus.emit('data-changed');
    App.refresh();
  }
};
