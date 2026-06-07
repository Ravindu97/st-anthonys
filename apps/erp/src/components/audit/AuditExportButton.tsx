export function AuditExportButton({ search }: { search: string }) {
  const href = `/api/admin/audit/export?${search}`;

  return (
    <a
      href={href}
      className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
    >
      Export CSV
    </a>
  );
}
