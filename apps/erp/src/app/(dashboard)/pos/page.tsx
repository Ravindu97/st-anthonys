import Link from 'next/link';
import { PosCounter } from '@/components/pos/PosCounter';
import { hasPermission } from '@/lib/auth/permissions';
import { getSessionFromCookies } from '@/lib/auth/session';
import { getDefaultCompanyId } from '@/lib/company';
import { listRegisters } from '@/lib/pos';

export const dynamic = 'force-dynamic';

export default async function PosPage() {
  const session = await getSessionFromCookies();
  if (!session || !hasPermission(session.role, 'pos:read')) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-xl font-semibold text-slate-900">POS counter</h1>
        <p className="text-sm text-slate-600">
          You do not have permission to use the POS counter. Contact an administrator if you
          need cashier access.
        </p>
        <Link href="/" className="text-sm text-brand-blue-600 hover:underline">
          ← Dashboard
        </Link>
      </div>
    );
  }

  const companyId = await getDefaultCompanyId();
  const registers = await listRegisters(companyId);

  return (
    <div className="space-y-4 min-h-[calc(100vh-8rem)]">
      <header>
        <h1 className="font-display text-xl font-semibold text-slate-900">POS counter</h1>
        <p className="mt-1 text-sm text-slate-500">
          Fast SKU lookup, contractor pricing, real-time stock decrement
        </p>
      </header>
      <PosCounter
        registers={registers.map((r) => ({
          id: r.id,
          name: r.name,
          location_id: r.location_id,
          location_name: r.location_name,
          price_level_id: r.price_level_id,
          price_level_name: r.price_level_name,
        }))}
      />
    </div>
  );
}
