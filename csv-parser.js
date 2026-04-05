// js/csv-parser.js — CSV_Parser module
// Parses the embedded RAW_CSV string using PapaParse and type-coerces numeric fields.

const CSV_Parser = (() => {
  // Map from CSV header (trimmed) to Row field name
  const HEADER_MAP = {
    'Country': 'Country',
    'UNICEF Region': 'UNICEF_Region',
    'Year': 'Year',
    'Sex': 'Sex',
    'Age': 'Age',
    'Estimated incidence rate of new HIV infection per 1 000 uninfected population': 'Incidence_Rate',
    'Estimated number of annual AIDS related deaths': 'Annual_AIDS_Deaths',
    'Estimated number of annual new HIV infections': 'Annual_New_Infections',
    'Estimated number of people living with HIV': 'PLHIV',
    'Estimated rate of annual AIDS related deaths  per 100 000 population': 'Death_Rate',
  };

  const NUMERIC_FIELDS = ['Year', 'Incidence_Rate', 'Annual_AIDS_Deaths', 'Annual_New_Infections', 'PLHIV', 'Death_Rate'];
  const REQUIRED_FIELDS = Object.values(HEADER_MAP);

  /**
   * Parse a raw CSV string into an array of Row objects.
   * Throws an Error if required columns are missing.
   * Skips rows with unparseable numeric fields (logs a warning).
   * @param {string} csvString
   * @returns {Object[]} rows
   */
  function parse(csvString) {
    const result = Papa.parse(csvString.trim(), {
      header: true,
      skipEmptyLines: true,
    });

    if (result.errors && result.errors.length > 0) {
      const fatal = result.errors.filter(e => e.type === 'Delimiter' || e.type === 'Quotes');
      if (fatal.length > 0) {
        throw new Error('CSV parse error: ' + fatal.map(e => e.message).join('; '));
      }
    }

    if (!result.data || result.data.length === 0) {
      throw new Error('Dataset is empty — no data rows found in CSV.');
    }

    // Validate required columns exist (using trimmed header keys)
    const rawHeaders = Object.keys(result.data[0]).map(h => h.trim());
    const missing = Object.keys(HEADER_MAP).filter(h => !rawHeaders.includes(h));
    if (missing.length > 0) {
      throw new Error('Missing required CSV columns: ' + missing.join(', '));
    }

    let skipped = 0;
    const rows = [];

    for (const raw of result.data) {
      // Remap headers (trim keys)
      const row = {};
      for (const [csvHeader, fieldName] of Object.entries(HEADER_MAP)) {
        // Find the matching key in raw (keys may have trailing spaces)
        const rawKey = Object.keys(raw).find(k => k.trim() === csvHeader);
        row[fieldName] = rawKey !== undefined ? raw[rawKey] : '';
      }

      // Type-coerce numeric fields
      let valid = true;
      for (const field of NUMERIC_FIELDS) {
        const val = parseFloat(String(row[field]).replace(/,/g, ''));
        if (isNaN(val)) {
          console.warn(`CSV_Parser: skipping row — unparseable value for ${field}:`, row[field]);
          skipped++;
          valid = false;
          break;
        }
        row[field] = val;
      }

      if (valid) rows.push(row);
    }

    if (skipped > 0) {
      console.warn(`CSV_Parser: skipped ${skipped} row(s) due to invalid numeric fields.`);
    }

    return rows;
  }

  /**
   * Serialize a Row back to a single CSV data line (header not included).
   * Used for round-trip testing.
   * @param {Object} row
   * @returns {string}
   */
  function serialize(row) {
    const values = [
      row.Country,
      row.UNICEF_Region,
      row.Year,
      row.Sex,
      row.Age,
      row.Incidence_Rate,
      row.Annual_AIDS_Deaths,
      row.Annual_New_Infections,
      row.PLHIV,
      row.Death_Rate,
    ];
    const header = Object.keys(HEADER_MAP).join(',');
    const line = values.map(v => (String(v).includes(',') ? `"${v}"` : v)).join(',');
    return header + '\n' + line;
  }

  /**
   * Load and parse the embedded RAW_CSV string.
   * Returns a Promise<Row[]> for API consistency with fetch-based loading.
   * Rejects with a descriptive Error on failure.
   * @returns {Promise<Object[]>}
   */
  function load() {
    return new Promise((resolve, reject) => {
      try {
        if (typeof RAW_CSV === 'undefined' || !RAW_CSV.trim()) {
          throw new Error('RAW_CSV is not defined or empty. Check js/data.js.');
        }
        const rows = parse(RAW_CSV);
        resolve(rows);
      } catch (err) {
        reject(err);
      }
    });
  }

  return { load, parse, serialize };
})();
