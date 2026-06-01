export function BrandLogo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-2 sm:gap-3">
      <div
        className={`grid shrink-0 grid-cols-2 gap-0.5 ${compact ? 'h-7 w-7' : 'h-9 w-9'}`}
        aria-hidden
      >
        <span className="bg-white" />
        <span className="bg-brand-gold-500" />
        <span className="bg-emerald-500" />
        <span className="bg-white" />
      </div>
      <div className={compact ? 'hidden min-w-0 sm:block' : 'min-w-0'}>
        <p className="truncate font-display text-sm font-semibold leading-tight text-white">
          St. Anthony&apos;s
        </p>
        {!compact && (
          <p className="hidden text-[10px] font-medium tracking-wider text-brand-blue-100 uppercase xs:block sm:block">
            Smart Solutions ERP
          </p>
        )}
      </div>
    </div>
  );
}
