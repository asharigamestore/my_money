/* ============================================================
   MY MONEY — app.js
   Bootstrap aplikasi, router hash, registrasi service worker
   ============================================================ */
'use strict';

const App = {
  current: 'dashboard',

  async init() {
    try {
      await DB.open();
      await DB.seed();
    } catch (e) {
      console.error(e);
      document.getElementById('view').innerHTML = `
        <div class="card">
          <div class="empty-state">
            <div class="empty-ico"><i data-lucide="database-zap"></i></div>
            <h4>Database tidak dapat dibuka</h4>
            <p>${Utils.esc(e.message || 'Peramban Anda tidak mendukung IndexedDB, atau penyimpanan diblokir.')}
               Data aplikasi tersimpan lokal — pastikan mode penyamaran/privasi tidak memblokir penyimpanan.</p>
          </div>
        </div>`;
      if (window.lucide) lucide.createIcons();
      return;
    }

    await Settings.load();

    window.addEventListener('hashchange', () => this.route());
    document.querySelectorAll('[data-route]').forEach(b =>
      b.addEventListener('click', () => { location.hash = '#/' + b.dataset.route; }));
    document.getElementById('btn-theme').addEventListener('click', () => Settings.toggleTheme());
    document.getElementById('btn-add').addEventListener('click', () => TxUI.openForm());

    this.route();
    this.registerSW();
  },

  route() {
    const r = (location.hash || '#/dashboard').replace('#/', '').split('?')[0].trim();
    this.current = Views[r] ? r : 'dashboard';
    this.render();
  },

  async render() {
    const v = Views[this.current];
    if (!v) return;
    document.getElementById('page-title').textContent = v.title;
    document.title = 'MY MONEY — ' + v.title;
    document.querySelectorAll('[data-route]').forEach(b =>
      b.classList.toggle('active', b.dataset.route === this.current));
    const el = document.getElementById('view');
    el.classList.remove('page-enter');
    void el.offsetWidth;
    try {
      await v.render(el);
    } catch (e) {
      console.error(e);
      el.innerHTML = `
        <div class="card"><div class="empty-state">
          <div class="empty-ico"><i data-lucide="circle-alert"></i></div>
          <h4>Terjadi kesalahan</h4><p>${Utils.esc(e.message || 'Gagal memuat halaman.')}</p>
        </div></div>`;
    }
    el.classList.add('page-enter');
    if (window.lucide) lucide.createIcons();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  refresh() { this.render(); },

  registerSW() {
    if (!('serviceWorker' in navigator)) return;
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./service-worker.js')
        .then(() => console.log('[MY MONEY] Service worker terdaftar.'))
        .catch(err => console.warn('[MY MONEY] SW gagal:', err));
    });
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
