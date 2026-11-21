/* ============================================================
   MY MONEY — database.js
   Lapisan IndexedDB + query/perhitungan keuangan
   ============================================================ */
'use strict';

const DB = (() => {
  const NAME = 'my-money-db';
  const VERSION = 1;
  let db = null;

  const INCOME_CATS = ['Gaji', 'Bonus', 'Insentif', 'Usaha Sampingan', 'Penjualan', 'Pemasukan Lainnya'];
  const EXPENSE_CATS = ['Makanan & Minuman', 'Transportasi', 'Bensin', 'Kebutuhan Rumah', 'Belanja', 'Tagihan', 'Hiburan', 'Kesehatan', 'Tabungan', 'Pengeluaran Lainnya'];
  const TRANSFER_CATS = ['Setoran Tabungan', 'Penarikan Tabungan', 'Transfer Antar Rekening', 'Transfer Lainnya'];
  const METHODS = ['Tunai', 'Transfer Bank', 'Kartu Debit', 'Kartu Kredit', 'E-Wallet'];

  function open() {
    return new Promise((resolve, reject) => {
      if (db) return resolve(db);
      const req = indexedDB.open(NAME, VERSION);
      req.onupgradeneeded = e => {
        const d = e.target.result;
        ['transactions', 'salaries', 'savings', 'categories', 'settings', 'accounts']
          .forEach(s => { if (!d.objectStoreNames.contains(s)) d.createObjectStore(s, { keyPath: 'id' }); });
      };
      req.onsuccess = e => { db = e.target.result; resolve(db); };
      req.onerror = () => reject(req.error || new Error('Gagal membuka database.'));
      req.onblocked = () => reject(new Error('Database diblokir. Tutup tab lain yang membuka aplikasi ini.'));
    });
  }

  const wrap = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const os = (store, mode = 'readonly') => db.transaction(store, mode).objectStore(store);

  return {
    NAME, VERSION, INCOME_CATS, EXPENSE_CATS, TRANSFER_CATS, METHODS, open,

    async seed() {
      if (await wrap(os('accounts').count()) > 0) return;
      const tx = os('accounts', 'readwrite');
      INCOME_CATS.forEach(name => tx.put({ id: Utils.uid(), name, type: 'income', builtin: true, createdAt: Date.now() }));
      EXPENSE_CATS.forEach(name => tx.put({ id: Utils.uid(), name, type: 'expense', builtin: true, createdAt: Date.now() }));
      tx.put({ id: 'acc-main', name: 'Dompet Utama', type: 'cash', createdAt: Date.now() });
    },

    getAll: s => wrap(os(s).getAll()),
    get: (s, k) => wrap(os(s).get(k)),
    put: (s, v) => wrap(os(s, 'readwrite').put(v)),
    del: (s, k) => wrap(os(s, 'readwrite').delete(k)),
    clear: s => wrap(os(s, 'readwrite').clear()),
    count: s => wrap(os(s).count()),

    bulkPut(store, items) {
      return new Promise((res, rej) => {
        const tx = db.transaction(store, 'readwrite');
        const s = tx.objectStore(store);
        items.forEach(i => s.put(i));
        tx.oncomplete = () => res();
        tx.onerror = () => rej(tx.error);
      });
    }
  };
})();

/* ---------- Query & perhitungan ---------- */
const Q = {
  async transactions() {
    const t = await DB.getAll('transactions');
    return t.sort((a, b) =>
      (b.date || '').localeCompare(a.date || '') || (b.createdAt || 0) - (a.createdAt || 0));
  },
  async balance() {
    const [t, prefs] = await Promise.all([this.transactions(), DB.get('settings', 'prefs')]);
    const sum = ty => t.filter(x => x.type === ty).reduce((s, x) => s + (x.amount || 0), 0);
    return (prefs?.initialBalance || 0) + sum('income') - sum('expense');
  },
  async totalsBetween(from, to) {
    const tx = (await this.transactions()).filter(x => x.date >= from && x.date <= to);
    const income = tx.filter(x => x.type === 'income').reduce((s, x) => s + x.amount, 0);
    const expense = tx.filter(x => x.type === 'expense').reduce((s, x) => s + x.amount, 0);
    return { income, expense, tx };
  },
  async monthTotals(key) {
    return this.totalsBetween(key + '-01', key + '-31');
  },
  async byRef(refType, refId) {
    return (await this.transactions()).find(x => x.refType === refType && x.refId === refId);
  },
  async expenseByCategory(from, to, cat = 'all') {
    const tx = (await this.transactions()).filter(x =>
      x.type === 'expense' && x.date >= from && x.date <= to && (cat === 'all' || x.category === cat));
    const map = {};
    tx.forEach(t => { map[t.category] = (map[t.category] || 0) + t.amount; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  },
  async lastMonthsTotals(n = 6) {
    const tx = await this.transactions();
    const out = [];
    const now = new Date();
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = Utils.monthKey(d);
      const inc = tx.filter(x => x.type === 'income' && x.monthKey === key).reduce((s, x) => s + x.amount, 0);
      const exp = tx.filter(x => x.type === 'expense' && x.monthKey === key).reduce((s, x) => s + x.amount, 0);
      out.push({ key, label: d.toLocaleDateString('id-ID', { month: 'short' }), income: inc, expense: exp });
    }
    return out;
  }
};
