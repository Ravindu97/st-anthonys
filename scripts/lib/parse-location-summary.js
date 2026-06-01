const SKU_NUMERIC_PARENS = /^(\d{3}-\d{4}|X\d{2}-\d{4})\s*\((.+)\)\s*$/i;
const SKU_NUMERIC_LEADING = /^(\d{3}-\d{4}|X\d{2}-\d{4})\s*(.*)$/i;
/** Vendor codes e.g. FABD2775W205NETLO, MF000-20, CADPEAQ-BLAC00C */
const SKU_ALPHA_PARENS = /^([A-Z0-9][A-Z0-9\-]{3,})\s*\((.+)\)\s*$/i;
const DATE_RANGE = /^(\d{1,2}-[A-Za-z]{3}-\d{2})\s+to\s+(\d{1,2}-[A-Za-z]{3}-\d{2})$/;

const MONTHS = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

export function parseTallyDate(token) {
  const m = token.trim().match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2})$/);
  if (!m) return null;
  const day = Number(m[1]);
  const mon = MONTHS[m[2].toLowerCase()];
  if (mon === undefined) return null;
  const year = 2000 + Number(m[3]);
  return new Date(Date.UTC(year, mon, day));
}

export function parseDateRange(text) {
  const m = text.trim().match(DATE_RANGE);
  if (!m) return null;
  const starts = parseTallyDate(m[1]);
  const ends = parseTallyDate(m[2]);
  if (!starts || !ends) return null;
  return {
    periodStartsOn: starts.toISOString().slice(0, 10),
    periodEndsOn: ends.toISOString().slice(0, 10),
  };
}

export function parseQuantity(cell) {
  if (!cell || !String(cell).trim()) return { quantity: null, unitCode: null };
  const m = String(cell).trim().match(/^(-?[\d,]+(?:\.\d+)?)\s*(\S+)?$/);
  if (!m) return { quantity: null, unitCode: null };
  const quantity = Number(m[1].replace(/,/g, ''));
  const unitCode = m[2] ?? 'NOS';
  return { quantity, unitCode };
}

export function parseMoney(cell) {
  if (cell === undefined || cell === null || String(cell).trim() === '') {
    return null;
  }
  const n = Number(String(cell).replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

export function parseParticulars(raw) {
  const text = String(raw ?? '').trim();
  if (!text) return { kind: 'empty', sku: null, name: null, tallyName: null };

  let m = text.match(SKU_NUMERIC_PARENS);
  if (m) {
    return {
      kind: 'item',
      sku: m[1].toUpperCase(),
      name: m[2].trim(),
      tallyName: text,
    };
  }

  m = text.match(SKU_ALPHA_PARENS);
  if (m) {
    return {
      kind: 'item',
      sku: m[1].toUpperCase(),
      name: m[2].trim(),
      tallyName: text,
    };
  }

  m = text.match(SKU_NUMERIC_LEADING);
  if (m) {
    const name = (m[2] || '').replace(/^\(/, '').replace(/\)$/, '').trim();
    return {
      kind: 'item',
      sku: m[1].toUpperCase(),
      name: name || text,
      tallyName: text,
    };
  }

  if (/^grand\s+total$/i.test(text)) {
    return { kind: 'footer', sku: null, name: null, tallyName: text };
  }

  return {
    kind: 'unknown',
    sku: null,
    name: text,
    tallyName: text,
  };
}

function classifyRowKind(particulars, parsed, quantity, value) {
  if (parsed.kind === 'footer') return 'footer';
  if (parsed.sku) return 'item';

  const hasBalance = quantity !== null && value !== null;
  if (!hasBalance) {
    if (
      /^[A-Z0-9][A-Z0-9 &/'().\-]+$/.test(particulars) &&
      particulars.length <= 48 &&
      !/^SWISSTEK\s/.test(particulars)
    ) {
      return 'group';
    }
    return 'item';
  }

  if (/^SWISSTEK\s/i.test(particulars) && particulars.length > 18) {
    return 'item';
  }
  if (particulars.includes('(') && !parsed.sku) {
    return 'item';
  }
  if (
    /^[A-Z0-9][A-Z0-9 &/'().\-]+$/.test(particulars) &&
    particulars.length <= 40 &&
    !/^SWISSTEK\s/.test(particulars)
  ) {
    return 'group';
  }
  return 'item';
}

/**
 * Parse Tally Location Summary CSV (exported from Excel).
 */
export function parseLocationSummaryCsv(content) {
  const lines = content.split(/\r?\n/);
  const rows = lines.map((line) => {
    const parts = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
        continue;
      }
      if (ch === ',' && !inQuotes) {
        parts.push(cur);
        cur = '';
        continue;
      }
      cur += ch;
    }
    parts.push(cur);
    return parts;
  });

  let companyName = null;
  let locationName = null;
  let period = null;
  let dataStartIndex = -1;
  const dataRows = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const c0 = (row[0] ?? '').trim();

    if (!companyName && c0.includes('Distributor')) {
      companyName = c0.replace(/,+$/, '').trim();
    }
    if (
      !locationName &&
      i === 1 &&
      c0 &&
      !c0.includes('Distributor') &&
      c0 !== 'Location Summary'
    ) {
      locationName = c0;
    }
    if (!locationName && row.some((c) => String(c).includes('MAIN LOCATION'))) {
      locationName = row.find((c) => String(c).includes('LOCATION'))?.trim() ?? c0;
    }
    if (!locationName && i >= 3 && i <= 6) {
      const colB = (row[1] ?? '').trim();
      if (
        colB &&
        !colB.includes('Distributor') &&
        colB !== 'Closing Balance' &&
        !colB.includes(' to ')
      ) {
        locationName = colB;
      }
    }
    if (!period) {
      const joined = row.join(' ');
      const dr = parseDateRange(joined) ?? parseDateRange(c0);
      if (dr) period = dr;
    }
    const col1 = (row[1] ?? '').trim();
    const col2 = (row[2] ?? '').trim();
    if (
      (c0 === 'Quantity' && col1 === 'Rate') ||
      (col1 === 'Quantity' && col2 === 'Rate')
    ) {
      dataStartIndex = i + 1;
      continue;
    }
    if (dataStartIndex >= 0 && i >= dataStartIndex) {
      const particulars = c0;
      if (!particulars) continue;
      const qtyCell = row[1];
      const rateCell = row[2];
      const valueCell = row[3];
      const { quantity, unitCode } = parseQuantity(qtyCell);
      const rate = parseMoney(rateCell);
      const value = parseMoney(valueCell);
      const parsed = parseParticulars(particulars);

      const rowKind = classifyRowKind(
        particulars,
        parsed,
        quantity,
        value
      );

      dataRows.push({
        lineNo: i + 1,
        rawParticulars: particulars,
        rowKind,
        sku: parsed.sku,
        name: parsed.name,
        tallyName: parsed.tallyName,
        quantity,
        unitCode,
        rate,
        value,
      });
    }
  }

  promoteCategoryNamedProductLines(dataRows, locationName);

  return {
    companyName,
    locationName: locationName ?? null,
    period,
    dataRows,
  };
}

/**
 * Tally may list a stock item with the same name as the location/category (e.g. "SWISSTEK").
 */
function promoteCategoryNamedProductLines(dataRows, locationName) {
  if (!locationName) return;
  const key = locationName.trim().toUpperCase();
  for (const row of dataRows) {
    if (
      row.rowKind === 'group' &&
      row.quantity !== null &&
      row.rawParticulars.trim().toUpperCase() === key
    ) {
      row.rowKind = 'item';
      if (!row.name) row.name = row.rawParticulars;
    }
  }
}
