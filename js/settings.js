/* ============================================================
   MY MONEY — settings.js
   Tema, saldo awal, backup & restore, halaman Profil
   ============================================================ */
'use strict';

const Settings = {
  prefs: { theme: 'light', initialBalance: 0 },

  async load() {
    let p = null;
    try { p = await DB.get('settings', 'prefs'); } catch (e) { console.warn(e); }
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    this.prefs = {
      id: 'prefs',
      theme: p?.theme || (prefersDark ? 'dark' : 'light'),
      initialBalance: p?.initialBalance || 0
    };
    this.apply();
  },

  async save() {
    await DB.put('settings', { id: 'prefs', ...this.prefs });
  },

  apply() {
    document.documentElement.dataset.theme = this.prefs.theme;
    const btn = document.getElementById('btn-theme');
    if (btn) {
      btn.innerHTML = `<i data-lucide="${this.prefs.theme === 'dark' ? 'sun' : 'moon'}"></i>`;
      if (window.lucide) lucide.createIcons();
    }
  },

  async toggleTheme() {
    this.prefs.theme = this.prefs.theme === 'dark' ? 'light' : 'dark';
    await this.save();
    this.apply();
    Bus.emit('data-changed');
    App.refresh();
  }
};

/* ---------- Backup & Restore ---------- */
const Backup = {
  async export() {
    try {
      const stores = {};
      for (const s of ['transactions', 'salaries', 'savings', 'categories', 'settings', 'accounts']) {
        stores[s] = await DB.getAll(s);
      }
      const data = {
        app: 'MY-MONEY',
        version: 1,
        exportedAt: new Date().toISOString(),
        stores
      };
      const stamp = Utils.dateISO().replace(/-/g, '');
      Utils.download(`my-money-backup-${stamp}.json`, JSON.stringify(data, null, 2));
      Toast.show('Backup berhasil diunduh');
    } catch (e) {
      console.error(e);
      Toast.show('Gagal membuat backup: ' + (e.message || 'kesalahan tidak dikenal'), 'error');
    }
  },

  async import(file) {
    let parsed;
    try {
      parsed = JSON.parse(await file.text());
    } catch (e) {
      Toast.show('File bukan JSON yang valid.', 'error');
      return;
    }
    const required = ['transactions', 'salaries', 'savings', 'categories', 'settings', 'accounts'];
    const valid = parsed && parsed.app === 'MY-MONEY' && parsed.stores &&
      required.every(k => Array.isArray(parsed.stores[k]));
    if (!valid) {
      Toast.show('File backup tidak valid atau bukan dari aplikasi MY MONEY.', 'error');
      return;
    }
    const ok = await Modal.confirm(
      `File backup dari ${Utils.fmtDate((parsed.exportedAt || '').slice(0, 10))} berisi ` +
      `${parsed.stores.transactions.length} transaksi, ${parsed.stores.salaries.length} gaji, ` +
      `${parsed.stores.savings.length} target tabungan. Seluruh data saat ini akan DITIMPA. Lanjutkan?`,
      { ok: 'Timpa & Pulihkan', title: 'Restore Backup', danger: false }
    );
    if (!ok) return;
    try {
      for (const s of required) {
        await DB.clear(s);
        await DB.bulkPut(s, parsed.stores[s]);
      }
      Toast.show('Data berhasil dipulihkan dari backup');
      Bus.emit('data-changed');
      App.refresh();
    } catch (e) {
      console.error(e);
      Toast.show('Gagal memulihkan data: ' + (e.message || 'kesalahan tidak dikenal'), 'error');
    }
  }
};

/* ---------- Halaman Profil ---------- */
Views.profile = {
  title: 'Profil',

  async render(el) {
    const [prefs, txCount] = await Promise.all([
      DB.get('settings', 'prefs'),
      DB.count('transactions')
    ]);
    const swActive = !!(navigator.serviceWorker && navigator.serviceWorker.controller);
    let storageTxt = '-';
    try {
      if (navigator.storage && navigator.storage.estimate) {
        const est = await navigator.storage.estimate();
        storageTxt = ((est.usage || 0) / 1024).toFixed(1) + ' KB terpakai';
      }
    } catch (e) { /* abaikan */ }

    el.innerHTML = `
      <div class="grid-2">
        <section class="card">
          <div class="card-head"><h3><i data-lucide="palette" style="width:17px;height:17px;vertical-align:-3px"></i> Tampilan</h3></div>
          <div class="profile-row">
            <div><div class="pr-label">Tema Aplikasi</div><div class="pr-desc">Terang untuk siang, gelap untuk malam.</div></div>
            <div class="seg">
              <button data-theme-set="light" class="${Settings.prefs.theme === 'light' ? 'active' : ''}">Terang</button>
              <button data-theme-set="dark" class="${Settings.prefs.theme === 'dark' ? 'active' : ''}">Gelap</button>
            </div>
          </div>
        </section>

        <section class="card">
          <div class="card-head"><h3><i data-lucide="wallet" style="width:17px;height:17px;vertical-align:-3px"></i> Saldo Awal</h3></div>
          <div class="profile-row" style="border:none;padding-top:4px">
            <div style="flex:1">
              <div class="pr-label">Modal awal sebelum memakai aplikasi</div>
              <div class="pr-desc">Masuk ke perhitungan total saldo.</div>
            </div>
          </div>
          <div style="display:flex;gap:10px;margin-top:10px">
            <input class="form-control rupiah-input" id="p-initial" inputmode="numeric" data-value="${prefs?.initialBalance || 0}" />
            <button class="btn-primary" id="p-save-initial" style="white-space:nowrap">Simpan</button>
          </div>
        </section>
      </div>

      <div class="grid-2 section-gap">
        <section class="card">
          <div class="card-head"><h3><i data-lucide="database-backup" style="width:17px;height:17px;vertical-align:-3px"></i> Backup &amp; Restore</h3></div>
          <div class="profile-row">
            <div><div class="pr-label">Export semua data</div><div class="pr-desc">Unduh seluruh data sebagai file JSON.</div></div>
            <button class="btn-ghost" id="p-export"><i data-lucide="download"></i>Export</button>
          </div>
          <div class="profile-row">
            <div><div class="pr-label">Import dari backup</div><div class="pr-desc">File divalidasi & konfirmasi sebelum menimpa data.</div></div>
            <label class="btn-ghost" style="margin:0;cursor:pointer">
              <i data-lucide="upload"></i>Import
              <input type="file" id="p-import" accept="application/json,.json" hidden />
            </label>
          </div>
        </section>

        <section class="card">
          <div class="card-head"><h3><i data-lucide="info" style="width:17px;height:17px;vertical-align:-3px"></i> Tentang</h3></div>
          <div class="profile-row">
            <div><div class="pr-label">Versi aplikasi</div><div class="pr-desc">MY MONEY PWA</div></div>
            <b>v1.0.0</b>
          </div>
          <div class="profile-row">
            <div><div class="pr-label">Penyimpanan lokal</div><div class="pr-desc">IndexedDB — ${storageTxt}</div></div>
            <span class="status-pill"><span class="dot"></span>Aktif</span>
          </div>
          <div class="profile-row">
            <div><div class="pr-label">Mode offline (Service Worker)</div><div class="pr-desc">Buka aplikasi tanpa internet setelah kunjungan pertama.</div></div>
            <span class="status-pill ${swActive ? '' : 'off'}"><span class="dot"></span>${swActive ? 'Aktif' : 'Belum aktif'}</span>
          </div>
          <div class="profile-row">
            <div><div class="pr-label">Transaksi tersimpan</div><div class="pr-desc">Seluruh data milik Anda, di perangkat Anda.</div></div>
            <b class="num">${txCount}</b>
          </div>
          <a class="shortcut" href="#/salary" style="margin-top:14px"><i data-lucide="briefcase"></i>Kelola Data Gaji</a>
        </section>
      </div>`;

    el.querySelectorAll('[data-theme-set]').forEach(b =>
      b.addEventListener('click', async () => {
        Settings.prefs.theme = b.dataset.themeSet;
        await Settings.save();
        Settings.apply();
        el.querySelectorAll('[data-theme-set]').forEach(x =>
          x.classList.toggle('active', x === b));
      }));

    el.querySelector('#p-save-initial').addEventListener('click', async () => {
      const val = Utils.parseNum(el.querySelector('#p-initial').dataset.raw);
      Settings.prefs.initialBalance = Math.max(val, 0);
      await Settings.save();
      Toast.show('Saldo awal tersimpan');
      Bus.emit('data-changed');
    });

    el.querySelector('#p-export').addEventListener('click', () => Backup.export());
    el.querySelector('#p-import').addEventListener('change', e => {
      const f = e.target.files[0];
      if (f) Backup.import(f);
      e.target.value = '';
    });
  }
};
