/* ============================================================
   MY MONEY — utils.js
   Utilitas umum, event bus, toast, modal, registry Views
   ============================================================ */
'use strict';

const Utils = {
  uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  },
  esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  },
  fmtIDR(n) {
    n = Math.round(Number(n) || 0);
    const neg = n < 0;
    return (neg ? '-Rp' : 'Rp') + Math.abs(n).toLocaleString('id-ID');
  },
  parseNum(v) {
    if (typeof v === 'number') return v;
    const n = parseInt(String(v ?? '').replace(/[^\d-]/g, ''), 10);
    return isNaN(n) ? 0 : n;
  },
  fmtDate(iso) {
    if (!iso) return '-';
    const d = new Date(iso.length === 10 ? iso + 'T00:00:00' : iso);
    if (isNaN(d)) return '-';
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  },
  fmtDateShort(iso) {
    if (!iso) return '-';
    const d = new Date(iso.length === 10 ? iso + 'T00:00:00' : iso);
    if (isNaN(d)) return '-';
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  },
  dateISO(d = new Date()) {
    const p = n => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  },
  monthKey(d = new Date()) {
    const p = n => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1);
  },
  monthLabel(key) {
    const [y, m] = key.split('-').map(Number);
    if (!y || !m) return key || '-';
    return new Date(y, m - 1, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  },
  addDays(d, n) {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
  },
  startOfWeek(d) { // Senin sebagai awal minggu
    const x = new Date(d);
    const day = (x.getDay() + 6) % 7;
    x.setDate(x.getDate() - day);
    x.setHours(0, 0, 0, 0);
    return x;
  },
  pct(part, whole) {
    return whole ? Math.round((part / whole) * 100) : 0;
  },
  debounce(fn, ms = 250) {
    let t;
    return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  },
  relativeDay(iso) {
    const today = Utils.dateISO();
    const yesterday = Utils.dateISO(Utils.addDays(new Date(), -1));
    if (iso === today) return 'Hari ini';
    if (iso === yesterday) return 'Kemarin';
    return Utils.fmtDate(iso);
  },
  download(filename, text) {
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
};

/* ---------- Event bus ---------- */
const Bus = {
  map: {},
  on(ev, fn) { (this.map[ev] = this.map[ev] || []).push(fn); },
  emit(ev, data) { (this.map[ev] || []).forEach(fn => { try { fn(data); } catch (e) { console.error(e); } }); }
};

/* ---------- Toast ---------- */
const Toast = {
  show(msg, type = 'success') {
    const root = document.getElementById('toast-root');
    const el = document.createElement('div');
    el.className = 'toast ' + type;
    const icon = { success: 'circle-check', error: 'circle-alert', info: 'info' }[type] || 'info';
    el.innerHTML = `<i data-lucide="${icon}"></i><span>${Utils.esc(msg)}</span>`;
    root.appendChild(el);
    if (window.lucide) lucide.createIcons();
    setTimeout(() => {
      el.classList.add('leaving');
      setTimeout(() => el.remove(), 320);
    }, 3200);
  }
};

/* ---------- Modal ---------- */
const Modal = {
  _escHandler: null,
  open(opts) {
    const root = document.getElementById('modal-root');
    root.innerHTML = `
      <div class="modal-overlay" id="modal-overlay">
        <div class="app-modal" role="dialog" aria-modal="true" aria-label="${Utils.esc(opts.title || 'Dialog')}">
          <div class="modal-head">
            <h3>${Utils.esc(opts.title || '')}</h3>
            <button type="button" class="icon-btn" data-close aria-label="Tutup"><i data-lucide="x"></i></button>
          </div>
          <form id="modal-form" novalidate>
            ${opts.body || ''}
            ${opts.hideFooter ? '' : `
            <div class="modal-foot">
              <button type="button" class="btn-ghost" data-close>Batal</button>
              <button type="submit" class="btn-primary" id="modal-submit">${Utils.esc(opts.submitLabel || 'Simpan')}</button>
            </div>`}
          </form>
        </div>
      </div>`;
    const overlay = root.querySelector('#modal-overlay');
    requestAnimationFrame(() => overlay.classList.add('show'));
    const close = () => this.close();
    overlay.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', close));
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    this._escHandler = e => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', this._escHandler);

    const form = overlay.querySelector('#modal-form');
    // Input rupiah: format ribuan otomatis
    form.querySelectorAll('.rupiah-input').forEach(inp => {
      if (inp.dataset.value) {
        const n = parseInt(inp.dataset.value, 10) || 0;
        if (n) inp.value = n.toLocaleString('id-ID');
      }
      inp.addEventListener('input', () => {
        const n = Utils.parseNum(inp.value);
        inp.dataset.raw = n;
        inp.value = n ? n.toLocaleString('id-ID') : '';
      });
    });
    if (opts.onOpen) opts.onOpen(overlay, form);
    if (window.lucide) lucide.createIcons();
    if (!opts.hideFooter) {
      form.addEventListener('submit', async e => {
        e.preventDefault();
        const btn = form.querySelector('#modal-submit');
        const data = Object.fromEntries(new FormData(form).entries());
        btn.disabled = true;
        btn.textContent = 'Menyimpan…';
        try {
          await opts.onSubmit(data, form);
          this.close();
        } catch (err) {
          Toast.show(err.message || 'Terjadi kesalahan. Coba lagi.', 'error');
        } finally {
          btn.disabled = false;
          btn.textContent = opts.submitLabel || 'Simpan';
        }
      });
    }
    const first = form.querySelector('input:not([type=hidden]),select,textarea');
    if (first) setTimeout(() => first.focus(), 250);
  },
  confirm(message, opts = {}) {
    const okLabel = opts.ok || 'Hapus';
    const title = opts.title || 'Konfirmasi';
    const danger = opts.danger !== false;
    return new Promise(resolve => {
      const root = document.getElementById('modal-root');
      root.innerHTML = `
        <div class="modal-overlay" id="modal-overlay">
          <div class="app-modal" role="alertdialog" aria-modal="true" style="max-width:420px">
            <div class="modal-head"><h3>${Utils.esc(title)}</h3>
              <button type="button" class="icon-btn" data-close aria-label="Tutup"><i data-lucide="x"></i></button>
            </div>
            <p style="font-size:.9rem;color:var(--muted);margin:0 0 4px">${Utils.esc(message)}</p>
            <div class="modal-foot">
              <button type="button" class="btn-ghost" data-close>Batal</button>
              <button type="button" class="btn-primary ${danger ? 'btn-danger' : ''}" data-ok>${Utils.esc(okLabel)}</button>
            </div>
          </div>
        </div>`;
      const overlay = root.querySelector('#modal-overlay');
      requestAnimationFrame(() => overlay.classList.add('show'));
      const done = val => { this.close(); resolve(val); };
      overlay.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => done(false)));
      overlay.querySelector('[data-ok]').addEventListener('click', () => done(true));
      overlay.addEventListener('click', e => { if (e.target === overlay) done(false); });
      this._escHandler = e => { if (e.key === 'Escape') done(false); };
      document.addEventListener('keydown', this._escHandler);
      if (window.lucide) lucide.createIcons();
    });
  },
  close() {
    document.getElementById('modal-root').innerHTML = '';
    if (this._escHandler) { document.removeEventListener('keydown', this._escHandler); this._escHandler = null; }
  }
};

/* ---------- Registry view per halaman ---------- */
const Views = {};
