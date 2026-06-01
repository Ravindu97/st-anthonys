import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getPool, sha256File } from './lib/db.js';
import { parseLocationSummaryCsv } from './lib/parse-location-summary.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function slugAlias(name) {
  const base = name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  return `NAME-${base}`;
}

async function main() {
  const filePath =
    process.argv[2] ??
    path.join(__dirname, '../reference/orange product list 3.csv');
  const categoryCode = process.argv[3] ?? 'ORANGE';
  const locationTallyName = process.argv[4] ?? null;

  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const fileHash = sha256File(filePath);
  const parsed = parseLocationSummaryCsv(content);

  if (!parsed.period) {
    console.error('Could not detect period range in CSV.');
    process.exit(1);
  }

  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { rows: companies } = await client.query(
      `SELECT id FROM companies WHERE tally_company_name = $1`,
      [parsed.companyName ?? 'ST. Anthonys Distributor (2024 -2025)']
    );
    if (companies.length === 0) {
      throw new Error('Company not found. Run npm run db:seed first.');
    }
    const companyId = companies[0].id;

    const locName =
      locationTallyName ??
      parsed.locationName ??
      (categoryCode === 'ORANGE' ? 'ORANGE MAIN LOCATION' : `${categoryCode} MAIN LOCATION`);
    const { rows: locations } = await client.query(
      `SELECT l.id, l.stock_category_id
       FROM locations l
       WHERE l.company_id = $1 AND l.tally_name = $2`,
      [companyId, locName]
    );
    if (locations.length === 0) {
      throw new Error(`Location not found: ${locName}. Run db:seed first.`);
    }
    const locationId = locations[0].id;

    const { rows: categories } = await client.query(
      `SELECT id FROM stock_categories WHERE company_id = $1 AND code = $2`,
      [companyId, categoryCode]
    );
    if (categories.length === 0) {
      throw new Error(`Category not found: ${categoryCode}`);
    }
    const categoryId = categories[0].id;

    const { rows: units } = await client.query(`SELECT id, code FROM units`);
    const unitByCode = Object.fromEntries(units.map((u) => [u.code, u.id]));
    const defaultUnitId = unitByCode.NOS;

    const { rows: importRuns } = await client.query(
      `INSERT INTO import_runs (company_id, source, file_name, file_hash, status)
       VALUES ($1, 'tally_location_summary_csv', $2, $3, 'running')
       RETURNING id`,
      [companyId, path.basename(filePath), fileHash]
    );
    const importRunId = importRuns[0].id;

    let currentGroupId = null;
    const groupByName = new Map();
    let itemCount = 0;
    let groupCount = 0;
    let footerValue = null;

    async function ensureGroup(groupName) {
      if (groupByName.has(groupName)) {
        currentGroupId = groupByName.get(groupName);
        return currentGroupId;
      }
      const { rows: existing } = await client.query(
        `SELECT id FROM stock_groups WHERE category_id = $1 AND name = $2`,
        [categoryId, groupName]
      );
      if (existing.length > 0) {
        groupByName.set(groupName, existing[0].id);
        currentGroupId = existing[0].id;
        return currentGroupId;
      }
      const { rows: inserted } = await client.query(
        `INSERT INTO stock_groups (category_id, name, tally_name)
         VALUES ($1, $2, $2) RETURNING id`,
        [categoryId, groupName]
      );
      groupByName.set(groupName, inserted[0].id);
      currentGroupId = inserted[0].id;
      return currentGroupId;
    }

    async function ensureItem(row) {
      const groupId = currentGroupId;
      if (!groupId) {
        throw new Error(`Item without group: ${row.rawParticulars}`);
      }
      const tallyName = row.tallyName;
      const unitId = unitByCode[row.unitCode] ?? defaultUnitId;
      const alias = row.sku ?? slugAlias(row.name ?? tallyName);

      let itemId;
      const { rows: byAlias } = await client.query(
        `SELECT sia.item_id
         FROM stock_item_aliases sia
         WHERE sia.company_id = $1 AND sia.alias = $2`,
        [companyId, alias]
      );
      if (byAlias.length > 0) {
        itemId = byAlias[0].item_id;
        await client.query(
          `UPDATE stock_items SET group_id = $1, name = $2, tally_name = $3, updated_at = now()
           WHERE id = $4`,
          [groupId, row.name ?? tallyName, tallyName, itemId]
        );
      } else {
        const { rows: byTally } = await client.query(
          `SELECT id FROM stock_items WHERE category_id = $1 AND tally_name = $2`,
          [categoryId, tallyName]
        );
        if (byTally.length > 0) {
          itemId = byTally[0].id;
          await client.query(
            `UPDATE stock_items SET group_id = $1, name = $2, updated_at = now() WHERE id = $3`,
            [groupId, row.name ?? tallyName, itemId]
          );
        } else {
          const { rows: ins } = await client.query(
            `INSERT INTO stock_items (
               group_id, category_id, name, tally_name, base_unit_id
             ) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
            [groupId, categoryId, row.name ?? tallyName, tallyName, unitId]
          );
          itemId = ins[0].id;
        }
        await client.query(
          `INSERT INTO stock_item_aliases (item_id, company_id, alias, is_primary)
           VALUES ($1, $2, $3, true)
           ON CONFLICT (company_id, alias) DO UPDATE SET item_id = EXCLUDED.item_id`,
          [itemId, companyId, alias]
        );
      }

      return itemId;
    }

    for (const row of parsed.dataRows) {
      if (row.rowKind === 'footer') {
        footerValue = row.value;
        await client.query(
          `INSERT INTO import_rows (
             import_run_id, line_no, raw_particulars, row_kind, quantity, rate, value
           ) VALUES ($1, $2, $3, 'footer', $4, $5, $6)`,
          [
            importRunId,
            row.lineNo,
            row.rawParticulars,
            row.quantity,
            row.rate,
            row.value,
          ]
        );
        continue;
      }

      if (row.rowKind === 'group') {
        groupCount++;
        const groupId = await ensureGroup(row.rawParticulars);
        await client.query(
          `INSERT INTO import_rows (
             import_run_id, line_no, raw_particulars, row_kind,
             resolved_group_id, quantity, rate, value
           ) VALUES ($1, $2, $3, 'group', $4, $5, $6, $7)`,
          [
            importRunId,
            row.lineNo,
            row.rawParticulars,
            groupId,
            row.quantity,
            row.rate,
            row.value,
          ]
        );
        continue;
      }

      if (row.rowKind === 'item') {
        if (!currentGroupId) {
          await ensureGroup('UNCATEGORIZED');
        }
        const itemId = await ensureItem(row);
        itemCount++;
        await client.query(
          `INSERT INTO import_rows (
             import_run_id, line_no, raw_particulars, row_kind,
             resolved_group_id, resolved_item_id, quantity, rate, value
           ) VALUES ($1, $2, $3, 'item', $4, $5, $6, $7, $8)`,
          [
            importRunId,
            row.lineNo,
            row.rawParticulars,
            currentGroupId,
            itemId,
            row.quantity,
            row.rate,
            row.value,
          ]
        );
      }
    }

    const { rows: existingSnap } = await client.query(
      `SELECT id FROM inventory_snapshots
       WHERE company_id = $1 AND location_id = $2
         AND period_starts_on = $3 AND period_ends_on = $4
         AND source = 'tally_location_summary_csv' AND file_hash = $5`,
      [
        companyId,
        locationId,
        parsed.period.periodStartsOn,
        parsed.period.periodEndsOn,
        fileHash,
      ]
    );

    let snapshotId;
    if (existingSnap.length > 0) {
      snapshotId = existingSnap[0].id;
      await client.query(`DELETE FROM inventory_balances WHERE snapshot_id = $1`, [
        snapshotId,
      ]);
      await client.query(
        `UPDATE inventory_snapshots SET import_run_id = $1 WHERE id = $2`,
        [importRunId, snapshotId]
      );
    } else {
      const { rows: snap } = await client.query(
        `INSERT INTO inventory_snapshots (
           import_run_id, company_id, location_id,
           period_starts_on, period_ends_on, report_label, file_hash, source
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'tally_location_summary_csv')
         RETURNING id`,
        [
          importRunId,
          companyId,
          locationId,
          parsed.period.periodStartsOn,
          parsed.period.periodEndsOn,
          `Location Summary ${parsed.period.periodStartsOn} to ${parsed.period.periodEndsOn}`,
          fileHash,
        ]
      );
      snapshotId = snap[0].id;
    }

    const { rows: itemRows } = await client.query(
      `SELECT resolved_item_id, quantity, rate, value
       FROM import_rows
       WHERE import_run_id = $1 AND row_kind = 'item' AND resolved_item_id IS NOT NULL`,
      [importRunId]
    );

    for (const ir of itemRows) {
      await client.query(
        `INSERT INTO inventory_balances (snapshot_id, stock_item_id, quantity, rate, value)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (snapshot_id, stock_item_id) DO UPDATE SET
           quantity = EXCLUDED.quantity,
           rate = EXCLUDED.rate,
           value = EXCLUDED.value`,
        [snapshotId, ir.resolved_item_id, ir.quantity, ir.rate, ir.value]
      );

      await client.query(
        `INSERT INTO item_location_stats (
           stock_item_id, location_id, last_snapshot_id, last_qty, last_rate, last_value, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, now())
         ON CONFLICT (stock_item_id, location_id) DO UPDATE SET
           last_snapshot_id = EXCLUDED.last_snapshot_id,
           last_qty = EXCLUDED.last_qty,
           last_rate = EXCLUDED.last_rate,
           last_value = EXCLUDED.last_value,
           updated_at = now()`,
        [
          ir.resolved_item_id,
          locationId,
          snapshotId,
          ir.quantity,
          ir.rate,
          ir.value,
        ]
      );
    }

    const { rows: sumRows } = await client.query(
      `SELECT COALESCE(SUM(value), 0) AS total_value, COUNT(*) AS balance_count
       FROM inventory_balances WHERE snapshot_id = $1`,
      [snapshotId]
    );

    await client.query(
      `UPDATE import_runs SET
         status = 'completed',
         row_counts = $2::jsonb
       WHERE id = $1`,
      [
        importRunId,
        JSON.stringify({
          groups: groupCount,
          items: itemCount,
          balances: Number(sumRows[0].balance_count),
          footer_value: footerValue,
          computed_total_value: Number(sumRows[0].total_value),
        }),
      ]
    );

    await client.query('COMMIT');

    console.log('Import completed.');
    console.log(`  Snapshot: ${snapshotId}`);
    console.log(`  Items: ${itemCount}, Groups: ${groupCount}`);
    console.log(`  Footer value (Tally): ${footerValue}`);
    console.log(`  Sum of leaf values: ${sumRows[0].total_value}`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
