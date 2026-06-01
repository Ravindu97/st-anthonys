#!/usr/bin/env node
/**
 * Compare a candidate vendor CSV structure to the reference ORANGE export.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseLocationSummaryCsv } from './lib/parse-location-summary.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const referencePath = path.join(
  __dirname,
  '../reference/orange product list 3.csv'
);
const candidatePath = process.argv[2];

if (!candidatePath) {
  console.error('Usage: node scripts/diff-import-structure.js <candidate-csv-path>');
  process.exit(1);
}

const ref = parseLocationSummaryCsv(fs.readFileSync(referencePath, 'utf8'));
const cand = parseLocationSummaryCsv(fs.readFileSync(candidatePath, 'utf8'));

function summarize(label, parsed) {
  const kinds = parsed.dataRows.reduce((acc, r) => {
    acc[r.rowKind] = (acc[r.rowKind] ?? 0) + 1;
    return acc;
  }, {});
  return {
    label,
    companyName: parsed.companyName,
    locationName: parsed.locationName,
    period: parsed.period,
    rowCounts: kinds,
    totalRows: parsed.dataRows.length,
  };
}

const a = summarize('reference', ref);
const b = summarize('candidate', cand);

console.log(JSON.stringify({ reference: a, candidate: b }, null, 2));

const compatible =
  Boolean(b.period) &&
  (b.rowCounts.item ?? 0) > 0 &&
  (b.rowCounts.group ?? 0) > 0;

if (compatible) {
  console.log('\nStructure compatible with tally_location_summary_csv parser.');
} else {
  console.error('\nStructure may differ — extend import_source / parser before importing.');
  process.exit(1);
}
