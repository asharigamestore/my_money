/* ============================================================
   MY MONEY — dashboard.js
   ============================================================ */
'use strict';

Views.dashboard = {
  title: 'Dashboard',
  _chart: null,

  async render(el) {
    const [balance, tx, savings, prefs] = await Promise.all([
      Q.balance(), Q.transactions(), DB.getAll('savings'), DB.get('settings', 'prefs')
    ]);
    const mk = Utils.monthKey();
    const m = await Q.monthTotals(mk);
    const pct = Utils.pct(m.expense, m.income);
    const recent = tx.slice(0, 5);
    const savedTotal = savings.reduce((s, x) => s + (x.saved || 0), 0);
    const savList = savings.slice(0, 3).map(s => `
      <div style="margin-top:12px">
        <div class="progress-label" style="margin:0 0 6px">
          <span class="tx-name">${Utils.esc(s.name)}</span>
          <b>${Utils.pct(s.saved, s.target)}%</b>
        </div>
        <div class="progress"><div class="progress-bar" style="width:${Math.min(Utils.pct(s.saved, s.target), 100)}%"></div></div>
        <div class="progress-label"><span>${Utils.fmtIDR(s.saved)}</span><span>${Utils.fmtIDR(s.target)}</span></div>
      </div>`).join('');

    el.innerHTML = `
      <section class="hero-card card">
        <div class="hero-top">
          <span class="hero-label">Total Saldo</span>
          <span class="hero-period">${Utils.monthLabel(mk)}</span>
        </div>
        <div class="hero-amount serif num">${Utils.fmtIDR(balance)}</div>
        <div class="hero-sub">Termasuk saldo awal ${Utils.fmtIDR(prefs?.initialBalance || 0)}</div>
        <div class="hero-stats">
          <div class="hstat ok">
            <i data-lucide="trending-up"></i>
            <div><span>Pemasukan bulan ini</span><b class="num">${Utils.fmtIDR(m.income)}</b></div>
          </div>
          <div class="hstat bad">
            <i data-lucide="trending-down"></i>
            <div><span>Pengeluaran bulan ini</span><b class="num">${Utils.fmtIDR(m.expense)}</b></div>
          </div>
        </div>
        <div class="ratio-bar"><div class="ratio-fill ${pct > 100 ? 'over' : ''}" style="width:${Math.min(pct, 100)}%"></div></div>
        <div class="ratio-text">Pengeluaran bulan ini <b>${pct}%</b> dari pemasukan</div>
      </section>

      <div class="grid-2 grid-dash">
        <section class="card">
          <div class="card-head"><h3>Arus Kas 6 Bulan</h3><a class="link" href="#/reports">Lihat laporan</a></div>
          <div class="chart-box"><canvas id="dash-chart" aria-label="Grafik arus kas"></canvas></div>
        </section>
        <section class="card">
          <div class="card-head"><h3>Transaksi Terakhir</h3><a class="link" href="#/transactions">Semua</a></div>
          <div class="tx-list">
            ${recent.length ? recent.map(TxUI.row).join('') : `
              <div class="empty-state" style="padding:26px 10px">
                <div class="empty-ico" style="width:54px;height:54px;border-radius:18px"><i data-lucide="receipt"></i></div>
                <h4>Belum ada transaksi</h4>
                <p>Mulai catat pemasukan atau pengeluaran pertama Anda.</p>
              </div>`}
          </div>
        </section>
      </div>

      <div class="grid-2">
        <section class="card">
          <div class="card-head"><h3>Tabungan</h3><a class="link" href="#/savings">Kelola</a></div>
          <div class="stat-card" style="margin-bottom:6px">
            <span class="stat-label">Total terkumpul</span>
            <span class="stat-value serif num">${Utils.fmtIDR(savedTotal)}</span>
          </div>
          ${savings.length ? savList : '<p class="muted small" style="margin-top:12px">Belum ada target tabungan. Buat target pertamamu!</p>'}
        </section>
        <section class="card">
          <div class="card-head"><h3>Aksi Cepat</h3></div>
          <div class="shortcut-grid">
            <button class="shortcut" data-shortcut="income"><i data-lucide="trending-up"></i>Pemasukan</button>
            <button class="shortcut" data-shortcut="expense"><i data-lucide="trending-down"></i>Pengeluaran</button>
            <a class="shortcut" href="#/salary"><i data-lucide="briefcase"></i>Catat Gaji</a>
            <a class="shortcut" href="#/savings"><i data-lucide="piggy-bank"></i>Setor Tabungan</a>
          </div>
        </section>
      </div>`;

    el.querySelectorAll('[data-shortcut]').forEach(b =>
      b.addEventListener('click', () => TxUI.openForm(null, b.dataset.shortcut)));

    this.drawChart();
  },

  async drawChart() {
    if (!window.Chart) return;
    this._chart?.destroy();
    const ctx = document.getElementById('dash-chart');
    if (!ctx) return;
    const data = await Q.lastMonthsTotals(6);
    const css = getComputedStyle(document.documentElement);
    const primary = css.getPropertyValue('--primary').trim() || '#2f6bff';
    const bad = css.getPropertyValue('--bad').trim() || '#df4060';
    this._chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: data.map(d => d.label),
        datasets: [
          { label: 'Pemasukan', data: data.map(d => d.income), backgroundColor: primary, borderRadius: 7, maxBarThickness: 26 },
          { label: 'Pengeluaran', data: data.map(d => d.expense), backgroundColor: bad, borderRadius: 7, maxBarThickness: 26 }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { color: css.getPropertyValue('--muted').trim(), usePointStyle: true, boxWidth: 8, font: { family: 'Inter', size: 11 } } },
          tooltip: { callbacks: { label: c => ' ' + c.dataset.label + ': ' + Utils.fmtIDR(c.parsed.y) } }
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: css.getPropertyValue('--faint').trim(), font: { family: 'Inter', size: 11 } } },
          y: { grid: { color: css.getPropertyValue('--border').trim() }, border: { display: false }, ticks: { color: css.getPropertyValue('--faint').trim(), font: { family: 'Inter', size: 11 }, callback: v => (v >= 1e6 ? (v / 1e6) + ' jt' : v) } }
        }
      }
    });
  }
};
