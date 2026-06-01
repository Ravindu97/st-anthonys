import { BrandLogo } from '@/components/BrandLogo';
import { Sidebar } from '@/components/Sidebar';
import { getActiveVendors } from '@/lib/inventory-search';

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let vendors: { code: string; name: string; slug: string }[] = [];
  try {
    const rows = await getActiveVendors();
    vendors = rows.map((v) => ({
      code: v.code,
      name: v.name,
      slug: v.slug,
    }));
  } catch {
    vendors = [];
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar vendors={vendors} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-brand-blue-600 bg-brand-blue-500 px-6 py-3 shadow-sm">
          <BrandLogo />
          <div className="flex items-center gap-3 text-sm text-white/90">
            <span className="hidden sm:inline">ST. Anthonys Distributor</span>
            <span className="rounded-md bg-white/15 px-2 py-1 font-mono text-xs">
              FY 2026
            </span>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
