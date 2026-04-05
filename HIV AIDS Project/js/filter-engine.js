// js/filter-engine.js — Filter_Engine module
// Pure filter functions — no mutation of input arrays.

const Filter_Engine = (() => {

  /**
   * Filter rows by UNICEF region.
   * "All Regions" returns all rows unchanged.
   * @param {Object[]} rows
   * @param {string} region
   * @returns {Object[]}
   */
  function filterByRegion(rows, region) {
    if (region === 'All Regions') return rows.slice();
    return rows.filter(r => r.UNICEF_Region === region);
  }

  /**
   * Filter rows to those with Year in [start, end] inclusive.
   * @param {Object[]} rows
   * @param {number} start
   * @param {number} end
   * @returns {Object[]}
   */
  function filterByYearRange(rows, start, end) {
    return rows.filter(r => r.Year >= start && r.Year <= end);
  }

  /**
   * Apply all active filters in sequence.
   * @param {Object[]} rows - full dataset rows
   * @param {string} region - "All Regions" | specific region name
   * @param {{ start: number, end: number } | null} yearRange - null means all years
   * @returns {Object[]}
   */
  function applyAll(rows, region, yearRange) {
    let result = filterByRegion(rows, region);
    if (yearRange) {
      result = filterByYearRange(result, yearRange.start, yearRange.end);
    }
    return result;
  }

  return { filterByRegion, filterByYearRange, applyAll };
})();
