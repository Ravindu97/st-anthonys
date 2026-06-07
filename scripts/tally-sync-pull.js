#!/usr/bin/env node
/**
 * Spike: pull Location Summary from Tally Prime via HTTP XML API.
 * Falls back gracefully when TALLY_URL is not configured.
 *
 * Env:
 *   TALLY_URL — e.g. http://localhost:9000
 *   TALLY_COMPANY — company name in Tally
 *
 * Usage: npm run tally:sync-pull -- ORANGE "ORANGE MAIN LOCATION"
 */

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
const categoryCode = args[0] ?? 'ORANGE';
const locationName = args[1] ?? `${categoryCode} MAIN LOCATION`;

const tallyUrl = process.env.TALLY_URL;
const tallyCompany = process.env.TALLY_COMPANY ?? 'ST. Anthonys Distributor (2024 -2025)';

if (!tallyUrl) {
  console.log(
    'TALLY_URL not set — skipping live pull. Use CSV import: npm run import:location-summary'
  );
  process.exit(0);
}

const exportRequest = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Data</TYPE>
    <ID>Stock Summary</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
        <SVCURRENTCOMPANY>${escapeXml(tallyCompany)}</SVCURRENTCOMPANY>
      </STATICVARIABLES>
    </DESC>
  </BODY>
</ENVELOPE>`;

console.log(`Pulling stock summary from Tally at ${tallyUrl}...`);

try {
  const xml = await postTally(tallyUrl, exportRequest);
  const outDir = path.join(__dirname, '../reference/tally-pull');
  const fs = await import('node:fs');
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(
    outDir,
    `location-summary-${categoryCode.toLowerCase()}-${Date.now()}.xml`
  );
  fs.writeFileSync(outFile, xml);
  console.log(`Saved Tally response to ${outFile}`);
  console.log(
    'Note: XML must be converted to Location Summary CSV for import. CSV fallback remains primary.'
  );
  console.log(
    `Next: convert and run npm run import:location-summary -- "${outFile}" ${categoryCode} "${locationName}"`
  );
} catch (err) {
  console.error('Tally pull failed:', err.message);
  console.log('Falling back to manual CSV import.');
  process.exit(1);
}

function escapeXml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function postTally(url, body) {
  return new Promise((resolve, reject) => {
    const curl = spawn('curl', ['-s', '-X', 'POST', url, '-d', body]);
    let stdout = '';
    let stderr = '';
    curl.stdout.on('data', (d) => (stdout += d));
    curl.stderr.on('data', (d) => (stderr += d));
    curl.on('close', (code) => {
      if (code !== 0) reject(new Error(stderr || `curl exit ${code}`));
      else if (!stdout.trim()) reject(new Error('Empty response from Tally'));
      else resolve(stdout);
    });
  });
}
