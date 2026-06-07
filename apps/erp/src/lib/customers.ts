import { getPool } from './db';

export { CUSTOMER_TYPES, defaultPriceLevelNameForType } from './customers-shared';
export type { CustomerType } from './customers-shared';

export type Customer = {
  id: string;
  code: string;
  name: string;
  customer_type: string;
  price_level_id: string | null;
  price_level_name: string | null;
  credit_limit: string | null;
  payment_terms_days: number;
  email: string | null;
  phone: string | null;
  address: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

export type CustomerSaleRow = {
  source: 'document' | 'pos';
  id: string;
  docNumber: string;
  channel: string;
  status: string;
  total: number;
  createdAt: Date;
};

export async function nextCustomerCode(companyId: string): Promise<string> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT code FROM customers
     WHERE company_id = $1::uuid AND code ~ '^CUST-[0-9]+$'
     ORDER BY CAST(SUBSTRING(code FROM 6) AS INT) DESC
     LIMIT 1`,
    [companyId]
  );
  const last = rows[0]?.code as string | undefined;
  const n = last ? parseInt(last.slice(5), 10) + 1 : 1;
  return `CUST-${String(n).padStart(5, '0')}`;
}

export async function listCustomers(opts?: {
  q?: string;
  activeOnly?: boolean;
  page?: number;
  pageSize?: number;
}) {
  const pool = getPool();
  const page = Math.max(1, opts?.page ?? 1);
  const pageSize = Math.min(100, Math.max(25, opts?.pageSize ?? 50));
  const offset = (page - 1) * pageSize;
  const values: unknown[] = [];
  let where = 'WHERE 1=1';
  if (opts?.activeOnly !== false) {
    where += ' AND c.is_active = true';
  }
  if (opts?.q?.trim()) {
    values.push(`%${opts.q.trim()}%`);
    const i = values.length;
    where += ` AND (c.name ILIKE $${i} OR c.code ILIKE $${i} OR c.phone ILIKE $${i})`;
  }
  values.push(pageSize, offset);

  const { rows } = await pool.query(
    `SELECT
       c.*,
       pl.name AS price_level_name,
       COUNT(*) OVER()::int AS total_count
     FROM customers c
     LEFT JOIN price_levels pl ON pl.id = c.price_level_id
     ${where}
     ORDER BY c.name
     LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values
  );

  const totalCount = rows.length > 0 ? Number(rows[0].total_count) : 0;
  const items = rows.map(({ total_count: _, ...row }) => row) as Customer[];
  return { items, totalCount, page, pageSize };
}

export async function getCustomer(id: string) {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT c.*, pl.name AS price_level_name
     FROM customers c
     LEFT JOIN price_levels pl ON pl.id = c.price_level_id
     WHERE c.id = $1`,
    [id]
  );
  return (rows[0] as Customer) ?? null;
}

export async function createCustomer(input: {
  companyId: string;
  code?: string;
  name: string;
  customerType?: string;
  priceLevelId?: string;
  creditLimit?: number;
  paymentTermsDays?: number;
  email?: string;
  phone?: string;
  address?: string;
}) {
  const pool = getPool();
  const code = input.code?.trim() || (await nextCustomerCode(input.companyId));
  const { rows } = await pool.query(
    `INSERT INTO customers (
       company_id, code, name, customer_type, price_level_id,
       credit_limit, payment_terms_days, email, phone, address
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      input.companyId,
      code,
      input.name,
      input.customerType ?? 'contractor',
      input.priceLevelId ?? null,
      input.creditLimit ?? null,
      input.paymentTermsDays ?? 30,
      input.email ?? null,
      input.phone ?? null,
      input.address ?? null,
    ]
  );
  return rows[0];
}

export async function updateCustomer(
  id: string,
  input: Partial<{
    name: string;
    customerType: string;
    priceLevelId: string | null;
    creditLimit: number | null;
    paymentTermsDays: number;
    email: string | null;
    phone: string | null;
    address: string | null;
    isActive: boolean;
  }>
) {
  const pool = getPool();
  const sets: string[] = [];
  const values: unknown[] = [id];
  let i = 2;

  const add = (column: string, value: unknown) => {
    sets.push(`${column} = $${i++}`);
    values.push(value);
  };

  if (input.name !== undefined) add('name', input.name);
  if (input.customerType !== undefined) add('customer_type', input.customerType);
  if (input.priceLevelId !== undefined) add('price_level_id', input.priceLevelId);
  if (input.creditLimit !== undefined) add('credit_limit', input.creditLimit);
  if (input.paymentTermsDays !== undefined) add('payment_terms_days', input.paymentTermsDays);
  if (input.email !== undefined) add('email', input.email);
  if (input.phone !== undefined) add('phone', input.phone);
  if (input.address !== undefined) add('address', input.address);
  if (input.isActive !== undefined) add('is_active', input.isActive);

  if (sets.length === 0) return getCustomer(id);

  sets.push('updated_at = now()');
  const { rows } = await pool.query(
    `UPDATE customers SET ${sets.join(', ')} WHERE id = $1::uuid RETURNING *`,
    values
  );
  return rows[0] ?? null;
}

export async function getCustomerRecentSales(customerId: string, limit = 10) {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT * FROM (
       SELECT
         'pos'::text AS source,
         pt.id::text AS id,
         pt.transaction_number AS doc_number,
         'counter'::text AS channel,
         'completed'::text AS status,
         pt.total_amount::numeric AS total,
         pt.created_at
       FROM pos_transactions pt
       WHERE pt.customer_id = $1::uuid
       UNION ALL
       SELECT
         'document'::text AS source,
         sd.id::text AS id,
         sd.doc_number,
         CASE
           WHEN sd.doc_kind = 'quote' THEN 'quote'
           WHEN sd.fulfillment_type = 'delivery' THEN 'delivery'
           ELSE 'pickup'
         END AS channel,
         sd.status::text AS status,
         sd.total_amount::numeric AS total,
         sd.created_at
       FROM sales_documents sd
       WHERE sd.customer_id = $1::uuid
     ) combined
     ORDER BY created_at DESC
     LIMIT $2`,
    [customerId, limit]
  );

  return rows.map((row) => ({
    source: row.source as 'document' | 'pos',
    id: row.id as string,
    docNumber: row.doc_number as string,
    channel: row.channel as string,
    status: row.status as string,
    total: Number(row.total),
    createdAt: row.created_at as Date,
  })) as CustomerSaleRow[];
}

export async function getCustomerSalesSummary(customerId: string) {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT
       COUNT(*)::int AS order_count,
       MAX(created_at) AS last_sale_at
     FROM (
       SELECT pt.created_at FROM pos_transactions pt WHERE pt.customer_id = $1::uuid
       UNION ALL
       SELECT sd.created_at FROM sales_documents sd WHERE sd.customer_id = $1::uuid
     ) combined`,
    [customerId]
  );
  const row = rows[0];
  return {
    orderCount: Number(row?.order_count ?? 0),
    lastSaleAt: (row?.last_sale_at as Date | null) ?? null,
  };
}
