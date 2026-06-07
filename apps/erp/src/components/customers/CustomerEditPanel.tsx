'use client';

import { useState } from 'react';
import { CustomerForm, type CustomerFormValues } from '@/components/customers/CustomerForm';

export function CustomerEditPanel({
  customer,
  canWrite,
}: {
  customer: CustomerFormValues & { id: string; code: string };
  canWrite: boolean;
}) {
  const [editing, setEditing] = useState(false);

  if (!canWrite) return null;

  if (editing) {
    return (
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-slate-900">Edit customer</h2>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="text-sm text-slate-500 hover:text-slate-700"
          >
            Cancel edit
          </button>
        </div>
        <CustomerForm
          mode="edit"
          initial={customer}
          cancelHref={`/customers/${customer.id}`}
        />
      </section>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
    >
      Edit customer
    </button>
  );
}
