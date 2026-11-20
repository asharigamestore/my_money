/* ============================================================
   MY MONEY — reports.js
   Laporan harian / mingguan / bulanan / tahunan + grafik
   ============================================================ */
'use strict';

const ReportState = { period: 'monthly', ref: Utils.dateISO(), cat: 'all' };

function reportRange(period, refISO) {
  const d = new Date(refISO + 'T00:00:00');
  if (period === 'daily') {
    return { from: refISO, to: refISO };
  }
  if (period === 'weekly') {
    const start = Utils.startOfWeek(d);
    const end = Utils.addDays(start, 6);
    return { from: Utils.dateISO(start), to: Utils.dateISO(end) };
  }
  if (period === 'monthly') {
    const first = new Date(d.getFullYear(), d.getMonth(), 1);
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    return { from: Utils.dateISO(first), to: Utils.dateISO(last) };
  }
  // yearly
  return {
    from: d.getFullYear() + '-01-01',
    to: d.getFullYear() + '-12-31'
  };
}

Views.reports = {
  title: 'Laporan',
  _chart: null,

  async render(el) {
    const allCats = [...DB.INCOME_CATS, ...DB.EXPENSE_CATS];
    el.innerHTML = `
      <section class="card">
        <div class="toolbar" style="margin-bottom:12px">
          <div class="seg" id="rep-seg">
            <button data-period="daily">Harian</button>
            <button data-period="weekly">Mingguan</button>
            <button data-period="monthly">Bulanan</button>
            <button data-period="yearly">Tahunan</button>
          </div>
          <input class="form-control" type="date" id="rep-date" value="${ReportState.ref}" style="width:auto" />
          <select class="form-select" id="rep-cat" style="width:auto">
            <option value="all">Semua Kategori</option>
            ${allCats.map(c => `<option ${ReportState.cat === c ? 'selected' : ''}>${c}</option>`).join('')}
          </select>
        </div>
        <div class="report-range" id="rep-range"></div>
      </section>
      <div id="rep-results"></div>`;

    el.querySelectorAll('#rep-seg button').forEach(b => {
      b.classList.toggle('active', b.dataset.period === ReportState.period);
      b.addEventListener('click', () => {
        ReportState.period = b.dataset.period;
        el.querySelectorAll('#rep-seg button').forEach(x => x.classList.toggle('active', x === b));
        this.update(el);
      });
    });
    el.querySelector('#rep-date').addEventListener('change', e => {
      if (e.target.value) { ReportState.ref = e.target.value; this.update(el); }
    });
    el.querySelector('#rep-cat').addEventListener('change', e => {
      ReportState.cat = e.target.value;
      this.update(el);
    });

    await this.update(el);
  },

  async update(el) {
    const { from, to } = reportRange(ReportState.period, ReportState.ref);
    let { income, expense, tx } = await Q.totalsBetween(from, to);
    if (ReportState.cat !== 'all') {
      tx = tx.filter(t => t.category === ReportState.cat && t.type !== 'transfer');
      income = tx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
      expense = tx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    }
    const net = income - expense;
    const pct = Utils.pct(expense, income);
    const cats = await Q.expenseByCategory(from, to, ReportState.cat);
    const maxCat = cats.length ? cats[0][1] : 1;

    const rangeEl = el.querySelector('#rep-range');
    if (rangeEl) {
      const label = ReportState.period === 'yearly' ? ReportState.ref.slice(0, 4)
        : Utils.fmtDate(from) + (from !== to ? ' — ' + Utils.fmtDate(to) : '');
      rangeEl.textContent = 'Periode: ' + label;
    }

    const results = el.querySelector('#rep-results');
    if (!results) return;
    results.innerHTML = `
      <div class="grid-3">
        <div class="card stat-card">
          <div class="stat-ico ok"><i data-lucide="trending-up"></i></div>
          <span class="stat-label">Total Pemasukan</span>
          <span class="stat-value num" style="color:var(--ok)">${Utils.fmtIDR(income)}</span>
        </div>
        <div class="card stat-card">
          <div class="stat-ico bad"><i data-lucide="trending-down"></i></div>
          <span class="stat-label">Total Pengeluaran</span>
          <span class="stat-value num" style="color:var(--bad)">${Utils.fmtIDR(expense)}</span>
        </div>
        <div class="card stat-card">
          <div class="stat-ico info"><i data-lucide="scale"></i></div>
          <span class="stat-label">Selisih (Pemasukan − Pengeluaran)</span>
          <span class="stat-value num serif" style="color:${net >= 0 ? 'var(--ok)' : 'var(--bad)'}">${Utils.fmtIDR(net)}</span>
          <span class="small muted">Pengeluaran ${pct}% dari pemasukan</span>
        </div>
      </div>
      <div class="grid-2">
        <section class="card">
          <div class="card-head"><h3>Grafik Arus Keuangan</h3></div>
          <div class="chart-box"><canvas id="rep-chart"></canvas></div>
        </section>
        <section class="card">
          <div class="card-head"><h3>Pengeluaran per Kategori</h3></div>
          ${cats.length ? cats.slice(0, 6).map(([name, val]) => `
            <div class="cat-bar-row">
              <span class="cat-name">${Utils.esc(name)}</span>
              <div class="cat-bar-track"><div class="cat-bar-fill" style="width:${Math.round(val / maxCat * 100)}%"></div></div>
              <span class="cat-bar-val num">${Utils.fmtIDR(val)}</span>
            </div>`).join('')
          : '<div class="empty-state" style="padding:30px 10px"><div class="empty-ico" style="width:54px;height:54px;border-radius:18px"><i data-lucide="chart-pie"></i></div><h4>Belum ada pengeluaran</h4><p>Belum ada pengeluaran pada periode dan filter ini.</p></div>'}
        </section>
      </div>`;

    this.drawChart(tx, from, to);
    if (window.lucide) lucide.createIcons();
  },

  drawChart(tx, from, to) {
    if (!window.Chart) return;
    this._chart?.destroy();
    const canvas = document.getElementById('rep-chart');
    if (!canvas) return;
    const css = getComputedStyle(document.documentElement);
    const primary = css.getPropertyValue('--primary').trim() || '#2f6bff';
    const bad = css.getPropertyValue('--bad').trim() || '#df4060';

    let labels = [], buckets = [];
    if (ReportState.period === 'yearly') {
      const year = from.slice(0, 4);
      for (let m = 1; m <= 12; m++) {
        const key = year + '-' + String(m).padStart(2, '0');
        labels.push(new Date(year, m - 1, 1).toLocaleDateString('id-ID', { month: 'short' }));
        buckets.push({ key, inc: 0, exp: 0 });
      }
      tx.forEach(t => { const b = buckets.find(x => x.key === t.monthKey); if (b) { if (t.type === 'income') b.inc += t.amount; if (t.type === 'expense') b.exp += t.amount; } });
    } else {
      const start = new Date(from + 'T00:00:00');
      const end = new Date(to + 'T00:00:00');
      const days = Math.min(Math.round((end - start) / 864e5) + 1, 62);
      for (let i = 0; i < days; i++) {
        const d = Utils.addDays(start, i);
        labels.push(d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }));
        buckets.push({ key: Utils.dateISO(d), inc: 0, exp: 0 });
      }
      tx.forEach(t => { const b = buckets.find(x => x.key === t.date); if (b) { if (t.type === 'income') b.inc += t.amount; if (t.type === 'expense') b.exp += t.amount; } });
    }

    this._chart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: 'Pemasukan', data: buckets.map(b => b.inc), backgroundColor: primary, borderRadius: 5, maxBarThickness: 18 },
          { label: 'Pengeluaran', data: buckets.map(b => b.exp), backgroundColor: bad, borderRadius: 5, maxBarThickness: 18 }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { color: css.getPropertyValue('--muted').trim(), usePointStyle: true, boxWidth: 8, font: { family: 'Inter', size: 11 } } },
          tooltip: { callbacks: { label: c => ' ' + c.dataset.label + ': ' + Utils.fmtIDR(c.parsed.y) } }
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: css.getPropertyValue('--faint').trim(), font: { family: 'Inter', size: 10 }, maxRotation: 0, autoSkip: true } },
          y: { grid: { color: css.getPropertyValue('--border').trim() }, border: { display: false }, ticks: { color: css.getPropertyValue('--faint').trim(), font: { family: 'Inter', size: 10 }, callback: v => (v >= 1e6 ? (v / 1e6) + ' jt' : v) } }
        }
      }
    });
  }
};
