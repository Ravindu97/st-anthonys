import Link from 'next/link';

export function InsightLink({
  href,
  children,
  className = '',
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-1 text-sm font-medium text-brand-blue-600 hover:text-brand-blue-700 ${className}`}
    >
      {children}
      <span aria-hidden>→</span>
    </Link>
  );
}
