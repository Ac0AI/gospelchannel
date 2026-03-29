'use client';

import { useState } from 'react';
import type { ChurchProfileEdit, ChurchEnrichment } from '@/types/gospel';

interface Props {
  edits: ChurchProfileEdit[];
  enrichments: Record<string, ChurchEnrichment | null>;
}

export function AdminEditsPanel({ edits: initialEdits, enrichments }: Props) {
  const [edits, setEdits] = useState(initialEdits);
  const [processing, setProcessing] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<Record<string, string>>({});

  async function handleReview(editId: string, action: 'approved' | 'rejected') {
    setProcessing(editId);
    try {
      const res = await fetch('/api/admin/edits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          editId,
          action,
          rejectionReason: action === 'rejected' ? rejectReason[editId] : undefined,
        }),
      });
      if (res.ok) {
        setEdits(prev => prev.filter(e => e.id !== editId));
      }
    } finally {
      setProcessing(null);
    }
  }

  function getEnrichmentValue(edit: ChurchProfileEdit): string | null {
    const enrichment = enrichments[edit.churchSlug];
    if (!enrichment) return null;

    const fieldMap: Record<string, keyof ChurchEnrichment> = {
      phone: 'phone',
      contact_email: 'contactEmail',
      website_url: 'websiteUrl',
      denomination: 'denominationNetwork',
    };

    const key = fieldMap[edit.fieldName];
    if (!key) return null;
    const val = enrichment[key];
    return val ? String(val) : null;
  }

  return (
    <div className="space-y-4">
      {edits.map(edit => {
        const enrichVal = getEnrichmentValue(edit);
        const isProcessing = processing === edit.id;

        return (
          <div key={edit.id} className="rounded-2xl border border-gray-200 bg-white p-6">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <span className="font-medium">{edit.churchSlug}</span>
                <span className="mx-2 text-gray-300">·</span>
                <span className="text-sm text-gray-500">{edit.fieldName}</span>
              </div>
              <span className="text-xs text-gray-400">
                {new Date(edit.submittedAt).toLocaleDateString('sv-SE')}
              </span>
            </div>

            <div className="mb-4 grid gap-3 sm:grid-cols-2">
              {enrichVal && (
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="mb-1 text-xs font-medium text-gray-500">Enrichment-data</p>
                  <p className="text-sm">{enrichVal}</p>
                </div>
              )}
              <div className="rounded-lg bg-blue-50 p-3">
                <p className="mb-1 text-xs font-medium text-blue-600">Inskickat</p>
                <p className="text-sm">
                  {typeof edit.fieldValue === 'object'
                    ? JSON.stringify(edit.fieldValue, null, 2)
                    : String(edit.fieldValue)}
                </p>
              </div>
            </div>

            {edit.enrichmentMatch && (
              <p className={`mb-3 text-xs ${
                edit.enrichmentMatch === 'matched' ? 'text-green-600' :
                edit.enrichmentMatch === 'mismatch' ? 'text-red-600' : 'text-gray-500'
              }`}>
                Match: {edit.enrichmentMatch}
              </p>
            )}

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleReview(edit.id, 'approved')}
                disabled={isProcessing}
                className="rounded-lg bg-green-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-green-600 disabled:opacity-50"
              >
                Godkänn
              </button>
              <input
                type="text"
                value={rejectReason[edit.id] ?? ''}
                onChange={e => setRejectReason(prev => ({ ...prev, [edit.id]: e.target.value }))}
                placeholder="Anledning (valfritt)"
                className="flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm"
              />
              <button
                onClick={() => handleReview(edit.id, 'rejected')}
                disabled={isProcessing}
                className="rounded-lg bg-red-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50"
              >
                Avslå
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
