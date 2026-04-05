// js/app.js — Bootstrap, event wiring, and PDF export

(function () {
  'use strict';

  // ── ES2020 feature detection ──────────────────────────────────────────────
  function checkBrowserSupport() {
    try {
      // Test optional chaining and nullish coalescing (ES2020)
      eval('null?.x ?? 0');
      return true;
    } catch (e) {
      return false;
    }
  }

  if (!checkBrowserSupport()) {
    document.body.innerHTML = `
      <div style="padding:2rem;text-align:center;color:#e2e8f0;font-family:sans-serif">
        <h2>Browser Not Supported</h2>
        <p>Please use a modern browser (Chrome 80+, Firefox 74+, Edge 80+) to view this dashboard.</p>
      </div>`;
    return;
  }

  // ── Error banner ──────────────────────────────────────────────────────────
  function showError(message) {
    const banner = document.getElementById('error-banner');
    const msg    = document.getElementById('error-message');
    if (banner && msg) {
      msg.textContent = message;
      banner.style.display = 'block';
    }
    document.getElementById('dashboard-content')?.style.setProperty('display', 'none');
  }

  // ── Filter state ──────────────────────────────────────────────────────────
  let currentRegion    = 'All Regions';
  let currentYearStart = 1990;
  let currentYearEnd   = 2019;

  function applyFilters() {
    const yearRange = { start: currentYearStart, end: currentYearEnd };
    const filtered  = Filter_Engine.applyAll(Data_Store.rows, currentRegion, yearRange);
    Data_Store.setFiltered(filtered);
    requestAnimationFrame(() => Chart_Renderer.updateAll(Data_Store));
  }

  // ── Event wiring ──────────────────────────────────────────────────────────
  function wireFilters() {
    const regionSelect = document.getElementById('filter-region');
    const yearStart    = document.getElementById('filter-year-start');
    const yearEnd      = document.getElementById('filter-year-end');
    const resetBtn     = document.getElementById('filter-reset');

    regionSelect?.addEventListener('change', e => {
      currentRegion = e.target.value;
      applyFilters();
    });

    yearStart?.addEventListener('change', e => {
      const val = parseInt(e.target.value, 10);
      if (!isNaN(val) && val >= 1990 && val <= currentYearEnd) {
        currentYearStart = val;
        applyFilters();
      }
    });

    yearEnd?.addEventListener('change', e => {
      const val = parseInt(e.target.value, 10);
      if (!isNaN(val) && val <= 2019 && val >= currentYearStart) {
        currentYearEnd = val;
        applyFilters();
      }
    });

    resetBtn?.addEventListener('click', () => {
      currentRegion    = 'All Regions';
      currentYearStart = 1990;
      currentYearEnd   = 2019;
      if (regionSelect) regionSelect.value = 'All Regions';
      if (yearStart)    yearStart.value    = '1990';
      if (yearEnd)      yearEnd.value      = '2019';
      applyFilters();
    });
  }

  // ── PDF Export ────────────────────────────────────────────────────────────
  function wirePDFExport() {
    const btn = document.getElementById('btn-export-pdf');
    if (!btn) return;

    btn.addEventListener('click', async () => {
      btn.textContent = 'Generating PDF...';
      btn.disabled = true;

      try {
        const content = document.getElementById('dashboard-content');
        const canvas  = await html2canvas(content, {
          scale: 1.5,
          useCORS: true,
          backgroundColor: '#0f1117',
          logging: false,
        });

        const imgData = canvas.toDataURL('image/png');
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

        const pageW = pdf.internal.pageSize.getWidth();
        const pageH = pdf.internal.pageSize.getHeight();
        const ratio = canvas.width / canvas.height;
        let imgW = pageW;
        let imgH = imgW / ratio;

        // If taller than one page, scale to fit height and paginate
        if (imgH <= pageH) {
          pdf.addImage(imgData, 'PNG', 0, 0, imgW, imgH);
        } else {
          // Multi-page: slice canvas into page-height chunks
          const pageHeightPx = Math.floor(canvas.width / pageW * pageH);
          let yOffset = 0;
          let pageNum = 0;
          while (yOffset < canvas.height) {
            const sliceH = Math.min(pageHeightPx, canvas.height - yOffset);
            const sliceCanvas = document.createElement('canvas');
            sliceCanvas.width  = canvas.width;
            sliceCanvas.height = sliceH;
            sliceCanvas.getContext('2d').drawImage(canvas, 0, -yOffset);
            const sliceData = sliceCanvas.toDataURL('image/png');
            if (pageNum > 0) pdf.addPage();
            pdf.addImage(sliceData, 'PNG', 0, 0, pageW, sliceH / canvas.width * pageW);
            yOffset += sliceH;
            pageNum++;
          }
        }

        pdf.save('hiv-aids-dashboard.pdf');
      } catch (err) {
        console.error('PDF export failed:', err);
        alert('PDF export failed: ' + err.message);
      } finally {
        btn.textContent = '📄 Export PDF';
        btn.disabled = false;
      }
    });
  }

  // ── Bootstrap ─────────────────────────────────────────────────────────────
  async function init() {
    try {
      const rows = await CSV_Parser.load();
      Data_Store.init(rows);

      // Update data source info
      const years = rows.map(r => r.Year);
      const minY  = Math.min(...years);
      const maxY  = Math.max(...years);
      const infoEl = document.getElementById('data-info');
      if (infoEl) infoEl.textContent = `Data: UNICEF · Ages 10–19 · ${minY}–${maxY} · ${rows.length} records`;

      Chart_Renderer.initialRender(Data_Store);
      wireFilters();
      wirePDFExport();
    } catch (err) {
      console.error('Dashboard init failed:', err);
      showError(err.message || 'Failed to load dashboard data.');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
