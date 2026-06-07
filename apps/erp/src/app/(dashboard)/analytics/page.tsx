import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

/** Analytics moved to admin-only leadership dashboard. */
export default function AnalyticsRedirectPage() {
  redirect('/admin/analytics');
}
