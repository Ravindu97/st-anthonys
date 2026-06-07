import { PosCounter } from '@/components/pos/PosCounter';
import { listRegisters } from '@/lib/pos';
import { getDefaultCompanyId } from '@/lib/company';

export const dynamic = 'force-dynamic';

export default async function PosPage() {
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
      <PosCounter registers={registers} />
    </div>
  );
}
