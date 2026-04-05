// js/data-store.js — Data_Store module
// Holds raw rows, pre-aggregates on init, recomputes on filter change.

const Data_Store = (() => {
  let _rows = [];       // immutable after init
  let _filtered = [];   // currently filtered rows

  const agg = {
    trend: {},
    bar: {},
    regional: {},
    countryRatios: [],
    kpis: {},
  };

  /**
   * Single-pass aggregation over a row array.
   * Populates agg.trend, agg.bar, agg.regional, agg.countryRatios, agg.kpis.
   * @param {Object[]} rows
   */
  function _aggregate(rows) {
    // --- accumulators ---
    const trendInfections = {};   // key: "year|sex" → number
    const trendDeaths = {};
    const trendIncidenceSum = {};
    const trendIncidenceCount = {};

    const barInfections = {};     // key: "country|sex" → number
    const barDeaths = {};
    const barIRSum = {};          // for disparity ratio per country

    const regional = {
      'Eastern and Southern Africa': { newInfections: 0, aidsDeaths: 0, plhiv: 0 },
      'West and Central Africa':     { newInfections: 0, aidsDeaths: 0, plhiv: 0 },
    };

    let femaleTotalInfections = 0, maleTotalInfections = 0;
    let femaleTotalDeaths = 0, maleTotalDeaths = 0;
    let femaleIRSum = 0, maleIRSum = 0;
    let femaleIRCount = 0, maleIRCount = 0;
    let femaleTotalPLHIV = 0, maleTotalPLHIV = 0;

    // Single O(n) pass
    for (const row of rows) {
      const yk = `${row.Year}|${row.Sex}`;
      const ck = `${row.Country}|${row.Sex}`;
      const reg = row.UNICEF_Region;

      // Trend
      trendInfections[yk] = (trendInfections[yk] || 0) + row.Annual_New_Infections;
      trendDeaths[yk]      = (trendDeaths[yk] || 0) + row.Annual_AIDS_Deaths;
      trendIncidenceSum[yk]   = (trendIncidenceSum[yk] || 0) + row.Incidence_Rate;
      trendIncidenceCount[yk] = (trendIncidenceCount[yk] || 0) + 1;

      // Bar
      barInfections[ck] = (barInfections[ck] || 0) + row.Annual_New_Infections;
      barDeaths[ck]     = (barDeaths[ck] || 0) + row.Annual_AIDS_Deaths;
      barIRSum[ck]      = (barIRSum[ck] || 0) + row.Incidence_Rate;

      // Regional
      if (regional[reg]) {
        regional[reg].newInfections += row.Annual_New_Infections;
        regional[reg].aidsDeaths    += row.Annual_AIDS_Deaths;
        regional[reg].plhiv         += row.PLHIV;
      }

      // KPI accumulators
      if (row.Sex === 'Female') {
        femaleTotalInfections += row.Annual_New_Infections;
        femaleTotalDeaths     += row.Annual_AIDS_Deaths;
        femaleIRSum           += row.Incidence_Rate;
        femaleIRCount++;
        femaleTotalPLHIV      += row.PLHIV;
      } else {
        maleTotalInfections += row.Annual_New_Infections;
        maleTotalDeaths     += row.Annual_AIDS_Deaths;
        maleIRSum           += row.Incidence_Rate;
        maleIRCount++;
        maleTotalPLHIV      += row.PLHIV;
      }
    }

    // --- Build trend structures ---
    function buildTrend(accumulator, isMean, countAcc) {
      const keys = Object.keys(accumulator);
      const years = [...new Set(keys.map(k => Number(k.split('|')[0])))].sort((a, b) => a - b);
      const female = years.map(y => {
        const k = `${y}|Female`;
        if (!(k in accumulator)) return null;
        return isMean ? accumulator[k] / (countAcc[k] || 1) : accumulator[k];
      });
      const male = years.map(y => {
        const k = `${y}|Male`;
        if (!(k in accumulator)) return null;
        return isMean ? accumulator[k] / (countAcc[k] || 1) : accumulator[k];
      });
      return { years, female, male };
    }

    agg.trend = {
      Annual_New_Infections: buildTrend(trendInfections, false, null),
      Annual_AIDS_Deaths:    buildTrend(trendDeaths, false, null),
      Incidence_Rate:        buildTrend(trendIncidenceSum, true, trendIncidenceCount),
    };

    // --- Build bar structures ---
    function buildBar(accumulator) {
      // Collect all countries
      const countries = [...new Set(Object.keys(accumulator).map(k => k.split('|')[0]))];
      // Sort descending by female value
      countries.sort((a, b) => (accumulator[`${b}|Female`] || 0) - (accumulator[`${a}|Female`] || 0));
      const female = countries.map(c => accumulator[`${c}|Female`] || 0);
      const male   = countries.map(c => accumulator[`${c}|Male`] || 0);
      return { countries, female, male };
    }

    agg.bar = {
      Annual_New_Infections: buildBar(barInfections),
      Annual_AIDS_Deaths:    buildBar(barDeaths),
    };

    // --- Regional ---
    agg.regional = regional;

    // --- Country ratios ---
    const allCountries = [...new Set(Object.keys(barIRSum).map(k => k.split('|')[0]))];
    agg.countryRatios = allCountries
      .map(c => {
        const fIR = barIRSum[`${c}|Female`] || 0;
        const mIR = barIRSum[`${c}|Male`] || 0;
        const ratio = mIR > 0 ? fIR / mIR : null;
        const absDiff = Math.abs(fIR - mIR);
        return { country: c, ratio, absDiff };
      })
      .filter(e => e.ratio !== null)
      .sort((a, b) => b.ratio - a.ratio);

    // --- KPIs ---
    const disparityRatio = maleIRSum > 0 ? femaleIRSum / maleIRSum : null;
    agg.kpis = {
      femaleTotalInfections,
      maleTotalInfections,
      femaleTotalDeaths,
      maleTotalDeaths,
      femaleAvgIncidence: femaleIRCount > 0 ? femaleIRSum / femaleIRCount : 0,
      maleAvgIncidence:   maleIRCount > 0   ? maleIRSum / maleIRCount : 0,
      femaleTotalPLHIV,
      maleTotalPLHIV,
      disparityRatio,
    };
  }

  /**
   * Initialize the store with parsed rows. Pre-aggregates immediately.
   * @param {Object[]} rows
   */
  function init(rows) {
    _rows = rows;
    _filtered = rows.slice();
    _aggregate(_filtered);
  }

  /**
   * Replace the filtered view and recompute aggregations.
   * @param {Object[]} rows
   */
  function setFiltered(rows) {
    _filtered = rows;
    _aggregate(_filtered);
  }

  /**
   * Compute aggregations for a given metric keyed by "year|sex".
   * Used by property tests.
   * @param {Object[]} rows
   * @param {string} metric
   * @returns {Object} map of "year|sex" → sum
   */
  function computeAggregations(rows, metric) {
    const result = {};
    for (const row of rows) {
      const k = `${row.Year}|${row.Sex}`;
      result[k] = (result[k] || 0) + row[metric];
    }
    return result;
  }

  /**
   * Compute disparity ratio: sum(female IR) / sum(male IR).
   * Returns null if no male rows.
   * @param {Object[]} rows
   * @returns {number|null}
   */
  function computeDisparityRatio(rows) {
    const femaleSum = rows.filter(r => r.Sex === 'Female').reduce((s, r) => s + r.Incidence_Rate, 0);
    const maleSum   = rows.filter(r => r.Sex === 'Male').reduce((s, r) => s + r.Incidence_Rate, 0);
    return maleSum > 0 ? femaleSum / maleSum : null;
  }

  /**
   * Compute country-level disparity ratios, sorted descending.
   * @param {Object[]} rows  (or pre-computed CountryRatio[] for property tests)
   * @returns {Array<{country, ratio, absDiff}>}
   */
  function computeCountryRatios(rows) {
    // Accept either raw Row[] or CountryRatio[] (for property tests)
    if (rows.length > 0 && 'ratio' in rows[0]) {
      // Already CountryRatio[] — just sort
      return rows.slice().sort((a, b) => b.ratio - a.ratio);
    }
    const irByCountrySex = {};
    for (const row of rows) {
      const k = `${row.Country}|${row.Sex}`;
      irByCountrySex[k] = (irByCountrySex[k] || 0) + row.Incidence_Rate;
    }
    const countries = [...new Set(Object.keys(irByCountrySex).map(k => k.split('|')[0]))];
    return countries
      .map(c => {
        const fIR = irByCountrySex[`${c}|Female`] || 0;
        const mIR = irByCountrySex[`${c}|Male`] || 0;
        return mIR > 0 ? { country: c, ratio: fIR / mIR, absDiff: Math.abs(fIR - mIR) } : null;
      })
      .filter(Boolean)
      .sort((a, b) => b.ratio - a.ratio);
  }

  /**
   * Compute regional summary (newInfections, aidsDeaths, plhiv) per region.
   * @param {Object[]} rows
   * @returns {Object}
   */
  function computeRegionalSummary(rows) {
    const result = {
      'Eastern and Southern Africa': { newInfections: 0, aidsDeaths: 0, plhiv: 0 },
      'West and Central Africa':     { newInfections: 0, aidsDeaths: 0, plhiv: 0 },
    };
    for (const row of rows) {
      const r = result[row.UNICEF_Region];
      if (r) {
        r.newInfections += row.Annual_New_Infections;
        r.aidsDeaths    += row.Annual_AIDS_Deaths;
        r.plhiv         += row.PLHIV;
      }
    }
    return result;
  }

  return {
    get rows() { return _rows; },
    get filtered() { return _filtered; },
    get agg() { return agg; },
    init,
    setFiltered,
    computeAggregations,
    computeDisparityRatio,
    computeCountryRatios,
    computeRegionalSummary,
  };
})();
