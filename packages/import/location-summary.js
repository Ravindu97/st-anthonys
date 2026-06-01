import crypto from 'node:crypto';
import { parseLocationSummaryCsv } from './parse-location-summary.js';

export class ImportConflictError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ImportConflictError';
  }
}

export class ImportValidationError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'ImportValidationError';
    this.details = details;
  }
}

export function sha256Buffer(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

export function slugAlias(name) {
  const base = String(name)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  return `NAME-${base}`;
}

const FOOTER_ABS_TOLERANCE = 0.01;
const FOOTER_REL_TOLERANCE = 0.0001;

/** @typedef {{ type: string, lineNo?: number, message: string, alias?: string, tallyName?: string, particulars?: string, footer_value?: number, computed_total_value?: number, diff?: number, aliasItemId?: string, tallyItemId?: string }} ImportIssue */

function pushIssue(issues, issue) {
  issues.push(issue);
}

function checkFooterTotals(footerValue, computedTotal) {
  if (footerValue == null || !Number.isFinite(Number(footerValue))) {
    return { ok: true, skipped: true };
  }
  const footer = Number(footerValue);
  const computed = Number(computedTotal);
  const diff = Math.abs(footer - computed);
  const rel = footer !== 0 ? diff / Math.abs(footer) : diff;
  const ok = diff <= FOOTER_ABS_TOLERANCE || rel <= FOOTER_REL_TOLERANCE;
  return {
    ok,
    skipped: false,
    footer_value: footer,
    computed_total_value: computed,
    diff,
  };
}

function failIfIssues(issues, extra = {}) {
  if (issues.length === 0) return;
  const byType = issues.reduce((acc, i) => {
    acc[i.type] = (acc[i.type] ?? 0) + 1;
    return acc;
  }, /** @type {Record<string, number>} */ ({}));
  throw new ImportValidationError(
    `Import blocked: ${issues.length} problem${issues.length === 1 ? '' : 's'} found. No changes were saved.`,
    { issues, summary: { total: issues.length, byType, ...extra } }
  );
}

async function ensurePrimaryAlias(client, companyId, itemId, alias, issues, ctx) {
  const { rows: existing } = await client.query(
    `SELECT item_id FROM stock_item_aliases WHERE company_id = $1 AND alias = $2`,
    [companyId, alias]
  );
  if (existing.length > 0) {
    if (existing[0].item_id !== itemId) {
      pushIssue(issues, {
        type: 'alias_in_use',
        lineNo: ctx.lineNo,
        alias,
        particulars: ctx.particulars,
        message: `Unit code "${alias}" is already linked to another product (${existing[0].item_id}).`,
        aliasItemId: existing[0].item_id,
        tallyItemId: itemId,
      });
      return false;
    }
    return true;
  }
  await client.query(
    `INSERT INTO stock_item_aliases (item_id, company_id, alias, is_primary)
     VALUES ($1, $2, $3, true)
     ON CONFLICT (company_id, alias) DO NOTHING`,
    [itemId, companyId, alias]
  );
  const { rows: check } = await client.query(
    `SELECT item_id FROM stock_item_aliases WHERE company_id = $1 AND alias = $2`,
    [companyId, alias]
  );
  if (check.length === 0) {
    pushIssue(issues, {
      type: 'alias_in_use',
      lineNo: ctx.lineNo,
      alias,
      particulars: ctx.particulars,
      message: `Could not assign unit code "${alias}" to this product.`,
    });
    return false;
  }
  if (check[0].item_id !== itemId) {
    pushIssue(issues, {
      type: 'alias_in_use',
      lineNo: ctx.lineNo,
      alias,
      particulars: ctx.particulars,
      message: `Unit code "${alias}" is already linked to another product (${check[0].item_id}).`,
      aliasItemId: check[0].item_id,
      tallyItemId: itemId,
    });
    return false;
  }
  return true;
}

/**
 * @param {import('pg').PoolClient} client - caller owns transaction
 * @param {object} options
 */
export async function runLocationSummaryImport(client, options) {
  const {
    content,
    fileName = 'upload.csv',
    fileHash,
    categoryCode,
    locationTallyName = null,
    dryRun = false,
    companyNameOverride = null,
  } = options;

  /** @type {ImportIssue[]} */
  const issues = [];

  const parsed = parseLocationSummaryCsv(content);
  if (!parsed.period) {
    pushIssue(issues, {
      type: 'missing_period',
      message:
        'Could not detect the report period (e.g. "1-Apr-25 to 1-Jun-25") in the CSV header.',
    });
    failIfIssues(issues);
  }

  const hash =
    fileHash ?? sha256Buffer(Buffer.from(content, typeof content === 'string' ? 'utf8' : undefined));

  const report = {
    itemsCreated: 0,
    itemsUpdated: 0,
    groupsCreated: 0,
    issues,
  };

  const { rows: companies } = await client.query(
    `SELECT id FROM companies WHERE tally_company_name = $1`,
    [companyNameOverride ?? parsed.companyName ?? 'ST. Anthonys Distributor (2024 -2025)']
  );
  if (companies.length === 0) {
    throw new Error('Company not found. Run db:seed first.');
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
    [companyId, fileName, hash]
  );
  const importRunId = importRuns[0].id;

  let currentGroupId = null;
  const groupByName = new Map();
  let itemCount = 0;
  let groupCount = 0;
  let footerValue = null;
  const seenLineNos = new Set();

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
    report.groupsCreated++;
    return currentGroupId;
  }

  async function ensureItem(row) {
    const groupId = currentGroupId;
    if (!groupId) {
      pushIssue(issues, {
        type: 'missing_group',
        lineNo: row.lineNo,
        particulars: row.rawParticulars,
        message: 'Product line has no stock group above it in the file.',
      });
      return null;
    }
    const tallyName = row.tallyName;
    const unitId = unitByCode[row.unitCode] ?? defaultUnitId;
    const alias = row.sku ?? slugAlias(row.name ?? tallyName);
    const ctx = { lineNo: row.lineNo, particulars: row.rawParticulars };

    const { rows: byAlias } = await client.query(
      `SELECT sia.item_id FROM stock_item_aliases sia
       WHERE sia.company_id = $1 AND sia.alias = $2`,
      [companyId, alias]
    );
    const { rows: byTally } = await client.query(
      `SELECT id FROM stock_items WHERE category_id = $1 AND tally_name = $2`,
      [categoryId, tallyName]
    );

    const aliasItemId = byAlias[0]?.item_id ?? null;
    const tallyItemId = byTally[0]?.id ?? null;

    if (aliasItemId && tallyItemId && aliasItemId !== tallyItemId) {
      pushIssue(issues, {
        type: 'identity_conflict',
        lineNo: row.lineNo,
        alias,
        tallyName,
        particulars: row.rawParticulars,
        aliasItemId,
        tallyItemId,
        message: `Unit code "${alias}" belongs to one product in the database, but this Tally line matches a different product.`,
      });
      return null;
    }

    let itemId = aliasItemId ?? tallyItemId;

    if (!itemId) {
      const { rows: ins } = await client.query(
        `INSERT INTO stock_items (group_id, category_id, name, tally_name, base_unit_id)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [groupId, categoryId, row.name ?? tallyName, tallyName, unitId]
      );
      itemId = ins[0].id;
      report.itemsCreated++;
      if (!(await ensurePrimaryAlias(client, companyId, itemId, alias, issues, ctx))) {
        return null;
      }
    } else {
      report.itemsUpdated++;
      if (aliasItemId) {
        await client.query(
          `UPDATE stock_items SET group_id = $1, name = $2, tally_name = $3, updated_at = now()
           WHERE id = $4`,
          [groupId, row.name ?? tallyName, tallyName, itemId]
        );
      } else {
        await client.query(
          `UPDATE stock_items SET group_id = $1, name = $2, updated_at = now() WHERE id = $3`,
          [groupId, row.name ?? tallyName, itemId]
        );
        if (!(await ensurePrimaryAlias(client, companyId, itemId, alias, issues, ctx))) {
          return null;
        }
      }
    }

    return itemId;
  }

  try {
    for (const row of parsed.dataRows) {
      if (seenLineNos.has(row.lineNo)) {
        pushIssue(issues, {
          type: 'duplicate_line',
          lineNo: row.lineNo,
          message: `Duplicate row at CSV line ${row.lineNo}.`,
        });
        continue;
      }
      seenLineNos.add(row.lineNo);

      if (row.rowKind === 'footer') {
        footerValue = row.value;
        await client.query(
          `INSERT INTO import_rows (
             import_run_id, line_no, raw_particulars, row_kind, quantity, rate, value
           ) VALUES ($1, $2, $3, 'footer', $4, $5, $6)`,
          [importRunId, row.lineNo, row.rawParticulars, row.quantity, row.rate, row.value]
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
        if (!row.rawParticulars?.trim()) {
          pushIssue(issues, {
            type: 'empty_row',
            lineNo: row.lineNo,
            message: 'Product row has no description.',
          });
          continue;
        }
        if (!currentGroupId) {
          await ensureGroup('UNCATEGORIZED');
        }
        const itemId = await ensureItem(row);
        if (!itemId) continue;
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

    failIfIssues(issues, {
      items_processed: itemCount,
      groups: groupCount,
    });

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
        hash,
      ]
    );

    let snapshotId;
    if (existingSnap.length > 0) {
      snapshotId = existingSnap[0].id;
      await client.query(`DELETE FROM inventory_balances WHERE snapshot_id = $1`, [snapshotId]);
      await client.query(`UPDATE inventory_snapshots SET import_run_id = $1 WHERE id = $2`, [
        importRunId,
        snapshotId,
      ]);
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
          hash,
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
      `SELECT COALESCE(SUM(value), 0) AS total_value, COUNT(*)::int AS balance_count
       FROM inventory_balances WHERE snapshot_id = $1`,
      [snapshotId]
    );

    const computedTotal = Number(sumRows[0].total_value);
    const validation = checkFooterTotals(footerValue, computedTotal);
    if (!validation.ok && !validation.skipped) {
      pushIssue(issues, {
        type: 'footer_mismatch',
        message: `Tally footer total (${validation.footer_value?.toLocaleString('en-LK')}) does not match the sum of product values (${validation.computed_total_value?.toLocaleString('en-LK')}). Difference: ${validation.diff?.toFixed(2)} LKR.`,
        footer_value: validation.footer_value,
        computed_total_value: validation.computed_total_value,
        diff: validation.diff,
      });
    }
    failIfIssues(issues);

    const rowCounts = {
      groups: groupCount,
      items: itemCount,
      balances: Number(sumRows[0].balance_count),
      footer_value: footerValue,
      computed_total_value: computedTotal,
      validation_ok: true,
      items_created: report.itemsCreated,
      items_updated: report.itemsUpdated,
      groups_created: report.groupsCreated,
      dry_run: dryRun,
      ...validation,
    };

    const status = dryRun ? 'completed' : 'completed';
    await client.query(
      `UPDATE import_runs SET status = $2, row_counts = $3::jsonb, error_summary = NULL WHERE id = $1`,
      [importRunId, status, JSON.stringify(rowCounts)]
    );

    if (dryRun) {
      throw new DryRunComplete({ importRunId, snapshotId, rowCounts, report });
    }

    return {
      importRunId,
      snapshotId,
      locationId,
      categoryCode,
      rowCounts,
      report,
      dryRun: false,
    };
  } catch (err) {
    if (err instanceof DryRunComplete) {
      throw err;
    }
    const summary =
      err instanceof ImportValidationError && err.details?.issues
        ? `${err.message} (${err.details.issues.length} issues)`
        : err instanceof Error
          ? err.message
          : String(err);
    const rowCountsJson =
      err instanceof ImportValidationError
        ? JSON.stringify({
            validation_ok: false,
            issues: err.details?.issues ?? [],
            summary: err.details?.summary,
          })
        : null;
    await client.query(
      `UPDATE import_runs SET status = 'failed', error_summary = $2, row_counts = COALESCE($3::jsonb, row_counts) WHERE id = $1`,
      [importRunId, summary, rowCountsJson]
    );
    throw err;
  }
}

/** Internal: rollback signal after successful dry-run work */
class DryRunComplete extends Error {
  constructor(result) {
    super('DRY_RUN_COMPLETE');
    this.name = 'DryRunComplete';
    this.result = result;
  }
}

export function isDryRunComplete(err) {
  return err instanceof DryRunComplete || err?.name === 'DryRunComplete';
}

export function getDryRunResult(err) {
  return err?.result ?? null;
}
