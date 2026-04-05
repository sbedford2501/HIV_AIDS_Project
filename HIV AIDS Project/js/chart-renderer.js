// js/chart-renderer.js — Chart_Renderer module
// Creates and updates all Chart.js instances, KPI cards, spotlight, and regional summary.

const Chart_Renderer = (() => {
  // Wong (2011) colorblind-safe palette
  const COLORS = {
    female:  '#E69F00',  // Orange
    male:    '#0072B2',  // Blue
    esa:     '#56B4E9',  // Sky Blue (Eastern & Southern Africa)
    wca:     '#009E73',  // Bluish Green (West & Central Africa)
    ratio:   '#D55E00',  // Vermillion
  };

  const charts = {};

  // ── Helpers ──────────────────────────────────────────────────────────────

  function formatNumber(n) {
    if (n == null || isNaN(n)) return '0';
    if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(1) + 'B';
    if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(1) + 'K';
    return n.toFixed(0);
  }

  function formatRatio(r) {
    if (r == null || isNaN(r)) return 'N/A';
    return r.toFixed(2);
  }

  function clampNonNegative(v, label) {
    if (v < 0) {
      console.warn(`Chart_Renderer: negative value (${v}) for "${label}", clamping to 0.`);
      return 0;
    }
    return v;
  }

  function makeDataset(label, data, color) {
    return {
      label,
      data,
      borderColor: color,
      backgroundColor: color + '33',
      pointBackgroundColor: color,
      borderWidth: 2,
      tension: 0.3,
      spanGaps: false,
    };
  }

  function makeBarDataset(label, data, color) {
    return {
      label,
      data: data.map(v => clampNonNegative(v, label)),
      backgroundColor: color + 'cc',
      borderColor: color,
      borderWidth: 1,
    };
  }

  const commonScaleOptions = {
    grid: { color: 'rgba(255,255,255,0.08)' },
    ticks: { color: '#a0aec0' },
  };

  const commonLegend = {
    labels: { color: '#e2e8f0', usePointStyle: true, padding: 16 },
  };

  function createOrUpdate(id, config) {
    if (charts[id]) {
      charts[id].data = config.data;
      charts[id].options = config.options;
      charts[id].update('active');
    } else {
      const canvas = document.getElementById(id);
      if (!canvas) return;
      charts[id] = new Chart(canvas, config);
    }
  }

  // ── KPI Cards ─────────────────────────────────────────────────────────────

  function updateKPICards(kpis) {
    const set = (id, val, ariaVal) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.textContent = val;
      el.closest('[aria-label]')?.setAttribute('aria-label', ariaVal || val);
    };

    set('kpi-female-infections',  formatNumber(kpis.femaleTotalInfections),  `Female new infections: ${formatNumber(kpis.femaleTotalInfections)}`);
    set('kpi-male-infections',    formatNumber(kpis.maleTotalInfections),    `Male new infections: ${formatNumber(kpis.maleTotalInfections)}`);
    set('kpi-female-deaths',      formatNumber(kpis.femaleTotalDeaths),      `Female AIDS deaths: ${formatNumber(kpis.femaleTotalDeaths)}`);
    set('kpi-male-deaths',        formatNumber(kpis.maleTotalDeaths),        `Male AIDS deaths: ${formatNumber(kpis.maleTotalDeaths)}`);
    set('kpi-female-incidence',   kpis.femaleAvgIncidence.toFixed(2),        `Female avg incidence rate: ${kpis.femaleAvgIncidence.toFixed(2)}`);
    set('kpi-male-incidence',     kpis.maleAvgIncidence.toFixed(2),          `Male avg incidence rate: ${kpis.maleAvgIncidence.toFixed(2)}`);
    set('kpi-female-plhiv',       formatNumber(kpis.femaleTotalPLHIV),       `Female PLHIV: ${formatNumber(kpis.femaleTotalPLHIV)}`);
    set('kpi-male-plhiv',         formatNumber(kpis.maleTotalPLHIV),         `Male PLHIV: ${formatNumber(kpis.maleTotalPLHIV)}`);
    set('kpi-disparity-ratio',    formatRatio(kpis.disparityRatio),          `Gender disparity ratio: ${formatRatio(kpis.disparityRatio)}`);
  }

  // ── Trend Charts ──────────────────────────────────────────────────────────

  function updateTrendCharts(trend) {
    const specs = [
      { id: 'chart-infections-trend', metric: 'Annual_New_Infections', label: 'New Infections', yFmt: v => formatNumber(v) },
      { id: 'chart-deaths-trend',     metric: 'Annual_AIDS_Deaths',    label: 'AIDS Deaths',    yFmt: v => formatNumber(v) },
      { id: 'chart-incidence-trend',  metric: 'Incidence_Rate',        label: 'Incidence Rate (per 1,000)', yFmt: v => v != null ? v.toFixed(1) : '' },
    ];

    for (const spec of specs) {
      const d = trend[spec.metric];
      if (!d) continue;
      createOrUpdate(spec.id, {
        type: 'line',
        data: {
          labels: d.years,
          datasets: [
            makeDataset('Female', d.female, COLORS.female),
            makeDataset('Male',   d.male,   COLORS.male),
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: commonLegend,
            tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${spec.yFmt(ctx.parsed.y)}` } },
          },
          scales: {
            x: { ...commonScaleOptions, title: { display: true, text: 'Year', color: '#a0aec0' } },
            y: {
              ...commonScaleOptions,
              title: { display: true, text: spec.label, color: '#a0aec0' },
              ticks: { color: '#a0aec0', callback: v => spec.yFmt(v) },
            },
          },
        },
      });
    }
  }

  // ── Bar Charts ────────────────────────────────────────────────────────────

  function updateBarCharts(bar) {
    const specs = [
      { id: 'chart-infections-bar', metric: 'Annual_New_Infections', label: 'New Infections by Country' },
      { id: 'chart-deaths-bar',     metric: 'Annual_AIDS_Deaths',    label: 'AIDS Deaths by Country' },
    ];

    for (const spec of specs) {
      const d = bar[spec.metric];
      if (!d) continue;
      createOrUpdate(spec.id, {
        type: 'bar',
        data: {
          labels: d.countries,
          datasets: [
            makeBarDataset('Female', d.female, COLORS.female),
            makeBarDataset('Male',   d.male,   COLORS.male),
          ],
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: commonLegend,
            tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${formatNumber(ctx.parsed.x)}` } },
          },
          scales: {
            x: { ...commonScaleOptions, ticks: { color: '#a0aec0', callback: v => formatNumber(v) } },
            y: { ...commonScaleOptions },
          },
        },
      });
    }
  }

  // ── Top-5 Spotlight ───────────────────────────────────────────────────────

  function updateSpotlight(countryRatios) {
    const tbody = document.getElementById('spotlight-tbody');
    if (!tbody) return;
    const top5 = countryRatios.slice(0, 5);
    tbody.innerHTML = top5.length === 0
      ? '<tr><td colspan="3" style="text-align:center;color:#a0aec0">No data</td></tr>'
      : top5.map((e, i) => `
          <tr>
            <td>${i + 1}. ${e.country}</td>
            <td style="color:${COLORS.ratio};font-weight:600">${formatRatio(e.ratio)}</td>
            <td>${e.absDiff.toFixed(2)}</td>
          </tr>`).join('');
  }

  // ── Regional Summary ──────────────────────────────────────────────────────

  function updateRegionalSummary(regional) {
    const esa = regional['Eastern and Southern Africa'] || { newInfections: 0, aidsDeaths: 0, plhiv: 0 };
    const wca = regional['West and Central Africa']     || { newInfections: 0, aidsDeaths: 0, plhiv: 0 };

    const totalInf = esa.newInfections + wca.newInfections;
    const esaPct = totalInf > 0 ? (esa.newInfections / totalInf * 100).toFixed(1) : '0.0';
    const wcaPct = totalInf > 0 ? (wca.newInfections / totalInf * 100).toFixed(1) : '0.0';

    const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setEl('reg-esa-infections', formatNumber(esa.newInfections));
    setEl('reg-esa-deaths',     formatNumber(esa.aidsDeaths));
    setEl('reg-esa-plhiv',      formatNumber(esa.plhiv));
    setEl('reg-esa-pct',        esaPct + '%');
    setEl('reg-wca-infections', formatNumber(wca.newInfections));
    setEl('reg-wca-deaths',     formatNumber(wca.aidsDeaths));
    setEl('reg-wca-plhiv',      formatNumber(wca.plhiv));
    setEl('reg-wca-pct',        wcaPct + '%');

    // Regional grouped bar chart
    createOrUpdate('chart-regional', {
      type: 'bar',
      data: {
        labels: ['New Infections', 'AIDS Deaths', 'PLHIV'],
        datasets: [
          { label: 'Eastern & Southern Africa', data: [esa.newInfections, esa.aidsDeaths, esa.plhiv], backgroundColor: COLORS.esa + 'cc', borderColor: COLORS.esa, borderWidth: 1 },
          { label: 'West & Central Africa',     data: [wca.newInfections, wca.aidsDeaths, wca.plhiv], backgroundColor: COLORS.wca + 'cc', borderColor: COLORS.wca, borderWidth: 1 },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: commonLegend,
          tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${formatNumber(ctx.parsed.y)}` } },
        },
        scales: {
          x: { ...commonScaleOptions },
          y: { ...commonScaleOptions, ticks: { color: '#a0aec0', callback: v => formatNumber(v) } },
        },
      },
    });
  }

  // ── Public API ────────────────────────────────────────────────────────────

  function initialRender(store) {
    updateAll(store);
  }

  function updateAll(store) {
    const { agg } = store;
    updateKPICards(agg.kpis);
    updateTrendCharts(agg.trend);
    updateBarCharts(agg.bar);
    updateSpotlight(agg.countryRatios);
    updateRegionalSummary(agg.regional);
  }

  return {
    charts,
    initialRender,
    updateAll,
    updateKPICards,
    updateTrendCharts,
    updateBarCharts,
    updateSpotlight,
    updateRegionalSummary,
    formatNumber,
    formatRatio,
    clampNonNegative,
  };
})();
