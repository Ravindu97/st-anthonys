import { getPool } from './db';

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
  is_active: boolean;
};

export async function listCustomers(opts?: { q?: string; activeOnly?: boolean }) {
  const pool = getPool();
  const values: unknown[] = [];
  let where = 'WHERE 1=1';
  if (opts?.activeOnly !== false) {
    where += ' AND c.is_active = true';
  }
  if (opts?.q?.trim()) {
    values.push(`%${opts.q.trim()}%`);
    where += ` AND (c.name ILIKE $${values.length} OR c.code ILIKE $${values.length})`;
  }

  const { rows } = await pool.query(
    `SELECT
       c.*,
       pl.name AS price_level_name
     FROM customers c
     LEFT JOIN price_levels pl ON pl.id = c.price_level_id
     ${where}
     ORDER BY c.name`,
    values
  );
  return rows as Customer[];
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
  code: string;
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
  const { rows } = await pool.query(
    `INSERT INTO customers (
       company_id, code, name, customer_type, price_level_id,
       credit_limit, payment_terms_days, email, phone, address
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      input.companyId,
      input.code,
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
    email: string;
    phone: string;
    address: string;
    isActive: boolean;
  }>
) {
  const pool = getPool();
  const { rows } = await pool.query(
    `UPDATE customers SET
       name = COALESCE($2, name),
       customer_type = COALESCE($3, customer_type),
       price_level_id = COALESCE($4, price_level_id),
       credit_limit = COALESCE($5, credit_limit),
       payment_terms_days = COALESCE($6, payment_terms_days),
       email = COALESCE($7, email),
       phone = COALESCE($8, phone),
       address = COALESCE($9, address),
       is_active = COALESCE($10, is_active),
       updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [
      id,
      input.name ?? null,
      input.customerType ?? null,
      input.priceLevelId !== undefined ? input.priceLevelId : null,
      input.creditLimit !== undefined ? input.creditLimit : null,
      input.paymentTermsDays ?? null,
      input.email ?? null,
      input.phone ?? null,
      input.address ?? null,
      input.isActive ?? null,
    ]
  );
  return rows[0] ?? null;
}
