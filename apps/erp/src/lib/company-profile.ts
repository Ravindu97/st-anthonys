import { getPool } from './db';

/** Branding shown on purchase orders and printed documents */
export const COMPANY_BRANDING = {
  displayName: "St. Anthony's Smart Solutions",
  legalName: "St. Anthony's Distributor",
  tagline: 'Authorised Distributor · Hardware & Electrical',
  addressLines: ['Kurunegala', 'Sri Lanka'],
  phone: process.env.PO_COMPANY_PHONE ?? '',
  email: process.env.PO_COMPANY_EMAIL ?? 'admin@st-anthonys.local',
  vatNo: process.env.PO_COMPANY_VAT ?? '',
};

export type CompanyProfile = {
  id: string;
  name: string;
  tally_company_name: string;
  branding: typeof COMPANY_BRANDING;
};

export async function getCompanyProfile(companyId?: string): Promise<CompanyProfile> {
  const pool = getPool();
  const { rows } = companyId
    ? await pool.query(`SELECT id, name, tally_company_name FROM companies WHERE id = $1`, [
        companyId,
      ])
    : await pool.query(
        `SELECT id, name, tally_company_name FROM companies WHERE is_active = true ORDER BY created_at LIMIT 1`
      );

  const row = rows[0];
  if (!row) throw new Error('No company configured');

  return {
    id: row.id,
    name: row.name,
    tally_company_name: row.tally_company_name,
    branding: {
      ...COMPANY_BRANDING,
      legalName: row.name || COMPANY_BRANDING.legalName,
    },
  };
}
