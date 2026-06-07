/** Logo mark for documents and print (light backgrounds) */
export function BrandMark({
  size = 'md',
  framed = false,
}: {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  framed?: boolean;
}) {
  const dim =
    size === 'sm'
      ? 'h-8 w-8'
      : size === 'lg'
        ? 'h-14 w-14'
        : size === 'xl'
          ? 'h-16 w-16'
          : 'h-11 w-11';

  const mark = (
    <div
      className={`grid shrink-0 grid-cols-2 gap-0.5 ${dim}`}
      aria-hidden
      role="img"
      aria-label="St. Anthony's logo"
    >
      <span className="brand-mark-tile brand-mark-tile--white" />
      <span className="brand-mark-tile brand-mark-tile--gold" />
      <span className="brand-mark-tile brand-mark-tile--green" />
      <span className="brand-mark-tile brand-mark-tile--white" />
    </div>
  );

  if (framed) {
    return (
      <div className="brand-mark-frame shrink-0 rounded-lg border border-slate-200 bg-white p-1.5 shadow-sm">
        {mark}
      </div>
    );
  }

  return mark;
}

export function BrandLetterhead({
  subtitle,
  tagline,
}: {
  subtitle?: string;
  tagline?: string;
}) {
  return (
    <div className="brand-letterhead flex items-center gap-4">
      <BrandMark size="xl" framed />
      <div className="min-w-0">
        <p className="brand-letterhead-title font-display text-xl font-bold leading-tight text-white sm:text-2xl">
          St. Anthony&apos;s
        </p>
        <p className="brand-letterhead-sub text-xs font-semibold tracking-[0.2em] text-brand-blue-100 uppercase">
          Smart Solutions
        </p>
        {(tagline || subtitle) && (
          <p className="mt-1 text-xs text-brand-blue-100/90">
            {tagline ?? subtitle}
          </p>
        )}
      </div>
    </div>
  );
}

export function BrandHeader({
  subtitle,
  compact = false,
}: {
  subtitle?: string;
  compact?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <BrandMark size={compact ? 'sm' : 'md'} framed />
      <div>
        <p className="font-display text-lg font-bold leading-tight text-slate-900 sm:text-xl">
          St. Anthony&apos;s
        </p>
        <p className="text-xs font-semibold tracking-wide text-brand-blue-700 uppercase">
          Smart Solutions
        </p>
        {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
      </div>
    </div>
  );
}
