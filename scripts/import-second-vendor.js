#!/usr/bin/env node
/**
 * Import a second vendor Location Summary export (same Tally report layout).
 *
 * Usage:
 *   node scripts/import-second-vendor.js <path-to.csv> <CATEGORY_CODE> <LOCATION_TALLY_NAME>
 *
 * Example (when WATERTEC file arrives):
 *   node scripts/import-second-vendor.js ./reference/watertec-location-summary.csv WATERTEC "WATERTEC MAIN LOCATION"
 *
 * Prerequisites:
 *   - Category and location must exist (seed creates "<CATEGORY> MAIN LOCATION" for non-ORANGE categories).
 *   - Run `node scripts/diff-import-structure.js <file>` first to confirm CSV layout matches ORANGE export.
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const [filePath, categoryCode, locationName] = process.argv.slice(2);

if (!filePath || !categoryCode || !locationName) {
  console.error(
    'Usage: node scripts/import-second-vendor.js <csv-path> <CATEGORY_CODE> <LOCATION_TALLY_NAME>'
  );
  process.exit(1);
}

const importer = path.join(__dirname, 'import-location-summary.js');
const child = spawn(
  process.execPath,
  [importer, path.resolve(filePath), categoryCode, locationName],
  { stdio: 'inherit', env: process.env }
);

child.on('exit', (code) => process.exit(code ?? 1));
