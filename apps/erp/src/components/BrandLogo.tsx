export function BrandLogo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={`grid grid-cols-2 gap-0.5 ${compact ? 'h-7 w-7' : 'h-9 w-9'}`}
        aria-hidden
      >
        <span className="bg-white" />
        <span className="bg-brand-gold-500" />
        <span className="bg-emerald-500" />
        <span className="bg-white" />
      </div>
      {!compact && (
        <div>
          <p className="font-display text-sm font-semibold leading-tight text-white">
            St. Anthony&apos;s
          </p>
          <p className="text-[10px] font-medium uppercase tracking-wider text-brand-blue-100">
            Smart Solutions ERP
          </p>
        </div>
      )}
    </div>
  );
}
