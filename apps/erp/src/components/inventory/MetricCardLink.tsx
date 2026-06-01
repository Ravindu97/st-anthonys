import Link from 'next/link';
import { MetricCardCount, MetricCardMoney } from '@/components/MetricCard';

export function MetricCardCountLink({
  href,
  label,
  count,
  sub,
  accent = 'blue',
  className,
}: {
  href: string;
  label: string;
  count: number | string;
  sub?: string;
  accent?: 'blue' | 'gold';
  className?: string;
}) {
  return (
    <Link href={href} className={`block transition hover:opacity-90 ${className ?? ''}`}>
      <MetricCardCount label={label} count={count} sub={sub} accent={accent} />
    </Link>
  );
}

export function MetricCardMoneyLink({
  href,
  label,
  amount,
  sub,
  className,
}: {
  href: string;
  label: string;
  amount: number | string;
  sub?: string;
  className?: string;
}) {
  return (
    <Link href={href} className={`block transition hover:opacity-90 ${className ?? ''}`}>
      <MetricCardMoney label={label} amount={amount} sub={sub} />
    </Link>
  );
}
