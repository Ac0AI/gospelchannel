'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ChurchProfileEdit, ChurchProfileScore, ProfileFieldDefinition } from '@/types/gospel';

interface Props {
  slug: string;
  profileScore: ChurchProfileScore;
  mergedProfile: Record<string, unknown>;
  edits: ChurchProfileEdit[];
  fields: ProfileFieldDefinition[];
  churchSizeLabels: Record<string, string>;
  dayOptions: string[];
}

export function ProfileManageClient({
  slug,
  profileScore,
  mergedProfile,
  edits,
  fields,
  churchSizeLabels,
  dayOptions,
}: Props) {
  const router = useRouter();
  const [editingField, setEditingField] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const pendingEdits = edits.filter(e => e.reviewStatus === 'pending');
  const rejectedEdits = edits.filter(e => e.reviewStatus === 'rejected');

  function getFieldStatus(fieldName: string): 'approved' | 'pending' | 'rejected' | 'missing' {
    const pending = pendingEdits.find(e => e.fieldName === fieldName);
    if (pending) return 'pending';
    const rejected = rejectedEdits.find(e => e.fieldName === fieldName);
    if (rejected) return 'rejected';
    const value = getFieldValue(fieldName);
    if (value !== null && value !== undefined && value !== '') return 'approved';
    return 'missing';
  }

  function getFieldValue(fieldName: string): unknown {
    const keyMap: Record<string, string> = {
      service_times: 'serviceTimes',
      address: 'streetAddress',
      phone: 'phone',
      contact_email: 'contactEmail',
      description: 'description',
      website_url: 'websiteUrl',
      rss_feed_url: 'rssFeedUrl',
      google_news_query: 'googleNewsQuery',
      instagram_url: 'instagramUrl',
      facebook_url: 'facebookUrl',
      youtube_url: 'youtubeUrl',
      denomination: 'denomination',
      theological_orientation: 'theologicalOrientation',
      languages: 'languages',
      ministries: 'ministries',
      church_size: 'churchSize',
      logo_url: 'logoUrl',
      livestream_url: 'livestreamUrl',
      giving_url: 'givingUrl',
      what_to_expect: 'whatToExpect',
    };
    if (fieldName === 'pastor') {
      const name = mergedProfile.pastorName;
      const title = mergedProfile.pastorTitle;
      if (name) return { name, title: title ?? '' };
      return undefined;
    }
    return mergedProfile[keyMap[fieldName] ?? fieldName];
  }

  function getRejectionReason(fieldName: string): string | undefined {
    return rejectedEdits.find(e => e.fieldName === fieldName)?.rejectionReason ?? undefined;
  }

  async function handleSave(fieldName: string, fieldValue: unknown) {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/church/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ churchSlug: slug, fieldName, fieldValue }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: 'error', text: data.error });
      } else {
        const status = data.edit.reviewStatus === 'auto_approved'
          ? 'Sparat och godkänt!'
          : 'Sparat — väntar på granskning.';
        setMessage({ type: 'success', text: status });
        setEditingField(null);
        router.refresh();
      }
    } catch {
      setMessage({ type: 'error', text: 'Något gick fel. Försök igen.' });
    } finally {
      setSaving(false);
    }
  }

  const statusIcons: Record<string, string> = {
    approved: '✓',
    pending: '⏳',
    rejected: '✗',
    missing: '—',
  };

  const statusColors: Record<string, string> = {
    approved: 'text-green-600',
    pending: 'text-yellow-600',
    rejected: 'text-red-600',
    missing: 'text-gray-400',
  };

  const categories = [
    { key: 'badge', label: 'Krävs för verifiering', description: 'Fyll i dessa fält för att få en verifierad badge på er kyrksida.', fields: fields.filter(f => f.category === 'badge') },
    { key: 'bonus', label: 'Berätta mer om er kyrka', description: 'Ju mer ni fyller i, desto lättare för besökare att hitta och lära känna er.', fields: fields.filter(f => f.category === 'bonus') },
    { key: 'extra', label: 'Extra', description: 'Kompletterande information som gör er profil ännu starkare.', fields: fields.filter(f => f.category === 'extra') },
  ];

  return (
    <div className="space-y-8">
      {/* Profile Score Bar */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium">Din profil</span>
          <span className="text-2xl font-bold">{profileScore.score}/100</span>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-gray-100">
          <div
            className="h-full rounded-full bg-gradient-to-r from-rose-500 to-blue-500 transition-all"
            style={{ width: `${profileScore.score}%` }}
          />
        </div>
        {profileScore.badgeStatus === 'verified' ? (
          <div className="mt-3 flex items-center justify-between">
            <p className="text-sm text-green-600">✓ Verifierad — din badge visas på kyrksidan</p>
            <a
              href={`/church/${slug}/embed`}
              className="rounded-lg bg-blue-500 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-600 transition-colors"
            >
              Hamta din badge
            </a>
          </div>
        ) : profileScore.missingForBadge.length > 0 ? (
          <p className="mt-3 text-sm text-yellow-600">
            Fyll i {profileScore.missingForBadge.map(f => {
              if (f === 'contact') return 'kontaktinfo (telefon eller e-post)';
              const field = fields.find(fd => fd.name === f);
              return field?.label?.toLowerCase() ?? f;
            }).join(', ')} för att bli verifierad
          </p>
        ) : null}
      </div>

      {/* Message */}
      {message && (
        <div className={`rounded-xl p-4 text-sm ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message.text}
        </div>
      )}

      {/* Field Groups */}
      {categories.map(cat => (
        <div key={cat.key} className="rounded-2xl border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-6 py-4">
            <h2 className="font-serif text-lg font-semibold">{cat.label}</h2>
            <p className="mt-0.5 text-xs text-gray-400">{cat.description}</p>
          </div>
          <div className="divide-y divide-gray-50">
            {cat.fields.map(field => {
              const status = getFieldStatus(field.name);
              const value = getFieldValue(field.name);
              const rejection = getRejectionReason(field.name);
              const isEditing = editingField === field.name;

              return (
                <div key={field.name} className={`px-6 py-4 ${field.name === 'description' ? 'bg-amber-50/50' : ''}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm ${statusColors[status]}`}>
                        {statusIcons[status]}
                      </span>
                      <span className="text-sm font-medium">{field.label}</span>
                      {field.name === 'description' && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-700">
                          Viktig
                        </span>
                      )}
                    </div>
                    {!isEditing && (
                      <button
                        onClick={() => setEditingField(field.name)}
                        className="text-xs text-rose-500 hover:underline"
                      >
                        {value ? 'Redigera' : 'Lägg till'}
                      </button>
                    )}
                  </div>

                  {field.hint && (
                    <p className="mt-0.5 ml-6 text-xs text-gray-400">{field.hint}</p>
                  )}

                  {!isEditing && value != null && value !== '' && (
                    <p className="mt-1 ml-6 text-sm text-gray-600">
                      {field.name === 'pastor' && typeof value === 'object' ? (
                        <>
                          {(value as { name: string; title?: string }).name}
                          {(value as { name: string; title?: string }).title && (
                            <span className="text-gray-400"> - {(value as { name: string; title?: string }).title}</span>
                          )}
                        </>
                      ) : typeof value === 'object' ? JSON.stringify(value) : String(value as string | number | boolean)}
                    </p>
                  )}

                  {!isEditing && !value && status === 'missing' && (
                    <p className="mt-1 text-xs text-gray-400">Saknas</p>
                  )}

                  {status === 'rejected' && rejection && (
                    <p className="mt-1 text-xs text-red-500">Avslaget: {rejection}</p>
                  )}

                  {status === 'pending' && (
                    <p className="mt-1 text-xs text-yellow-600">Väntar på granskning</p>
                  )}

                  {isEditing && (
                    <FieldEditor
                      field={field}
                      currentValue={value}
                      slug={slug}
                      churchSizeLabels={churchSizeLabels}
                      dayOptions={dayOptions}
                      saving={saving}
                      onSave={(val) => handleSave(field.name, val)}
                      onCancel={() => setEditingField(null)}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// --- Field Editor ---

function FieldEditor({
  field,
  currentValue,
  slug,
  churchSizeLabels,
  dayOptions,
  saving,
  onSave,
  onCancel,
}: {
  field: ProfileFieldDefinition;
  currentValue: unknown;
  slug: string;
  churchSizeLabels: Record<string, string>;
  dayOptions: string[];
  saving: boolean;
  onSave: (value: unknown) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState<unknown>(currentValue ?? getDefaultValue(field));

  function getDefaultValue(f: ProfileFieldDefinition): unknown {
    switch (f.type) {
      case 'service-times': return [{ day: 'Söndag', time: '10:00', label: '' }];
      case 'address': return { street: '', city: '', postal_code: '', country: '' };
      case 'pastor': return { name: '', title: '' };
      case 'multi-select':
      case 'checkboxes': return [];
      default: return '';
    }
  }

  switch (field.type) {
    case 'text':
    case 'url':
    case 'email':
    case 'tel':
      return (
        <div className="mt-2 space-y-2">
          <input
            type={field.type === 'tel' ? 'tel' : field.type === 'email' ? 'email' : 'text'}
            value={String(value ?? '')}
            onChange={e => setValue(e.target.value)}
            placeholder={field.label}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
          />
          <EditButtons saving={saving} onSave={() => onSave(value)} onCancel={onCancel} />
        </div>
      );

    case 'textarea':
      return (
        <div className="mt-2 space-y-2">
          <textarea
            value={String(value ?? '')}
            onChange={e => setValue(e.target.value)}
            placeholder={field.label}
            rows={4}
            maxLength={field.validation?.maxLength}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
          />
          <div className="flex justify-between text-xs text-gray-400">
            <span>{String(value ?? '').length}/{field.validation?.maxLength ?? 500} tecken</span>
            <span>Min {field.validation?.minLength ?? 80} tecken</span>
          </div>
          <EditButtons saving={saving} onSave={() => onSave(value)} onCancel={onCancel} />
        </div>
      );

    case 'select':
      return (
        <div className="mt-2 space-y-2">
          <select
            value={String(value ?? '')}
            onChange={e => setValue(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
          >
            <option value="">Välj...</option>
            {field.options?.map(opt => (
              <option key={opt} value={opt}>
                {field.name === 'church_size' ? churchSizeLabels[opt] ?? opt : opt}
              </option>
            ))}
          </select>
          <EditButtons saving={saving} onSave={() => onSave(value)} onCancel={onCancel} />
        </div>
      );

    case 'multi-select':
    case 'checkboxes': {
      const selected = Array.isArray(value) ? value as string[] : [];
      return (
        <div className="mt-2 space-y-2">
          <div className="flex flex-wrap gap-2">
            {field.options?.map(opt => (
              <label key={opt} className="inline-flex items-center gap-1 text-sm">
                <input
                  type="checkbox"
                  checked={selected.includes(opt)}
                  onChange={e => {
                    if (e.target.checked) setValue([...selected, opt]);
                    else setValue(selected.filter(s => s !== opt));
                  }}
                />
                {opt}
              </label>
            ))}
          </div>
          <EditButtons saving={saving} onSave={() => onSave(value)} onCancel={onCancel} />
        </div>
      );
    }

    case 'service-times': {
      const times = Array.isArray(value) ? value as { day: string; time: string; label: string }[] : [];
      return (
        <div className="mt-2 space-y-2">
          {times.map((entry, i) => (
            <div key={i} className="flex items-center gap-2">
              <select
                value={entry.day}
                onChange={e => {
                  const updated = [...times];
                  updated[i] = { ...entry, day: e.target.value };
                  setValue(updated);
                }}
                className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
              >
                {dayOptions.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <input
                type="time"
                value={entry.time}
                onChange={e => {
                  const updated = [...times];
                  updated[i] = { ...entry, time: e.target.value };
                  setValue(updated);
                }}
                className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
              />
              <input
                type="text"
                value={entry.label ?? ''}
                onChange={e => {
                  const updated = [...times];
                  updated[i] = { ...entry, label: e.target.value };
                  setValue(updated);
                }}
                placeholder="Beskrivning (valfritt)"
                maxLength={50}
                className="flex-1 rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
              />
              {times.length > 1 && (
                <button
                  onClick={() => setValue(times.filter((_, j) => j !== i))}
                  className="text-xs text-red-500"
                >
                  Ta bort
                </button>
              )}
            </div>
          ))}
          {times.length < 10 && (
            <button
              onClick={() => setValue([...times, { day: 'Söndag', time: '10:00', label: '' }])}
              className="text-xs text-rose-500 hover:underline"
            >
              + Lägg till tid
            </button>
          )}
          <EditButtons saving={saving} onSave={() => onSave(value)} onCancel={onCancel} />
        </div>
      );
    }

    case 'address': {
      const addr = (value ?? { street: '', city: '', postal_code: '', country: '' }) as {
        street: string; city: string; postal_code: string; country: string;
      };
      return (
        <div className="mt-2 space-y-2">
          <input
            type="text"
            value={addr.street}
            onChange={e => setValue({ ...addr, street: e.target.value })}
            placeholder="Gatuadress"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <input
              type="text"
              value={addr.postal_code ?? ''}
              onChange={e => setValue({ ...addr, postal_code: e.target.value })}
              placeholder="Postnummer"
              className="w-1/3 rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
            <input
              type="text"
              value={addr.city}
              onChange={e => setValue({ ...addr, city: e.target.value })}
              placeholder="Stad"
              className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </div>
          <input
            type="text"
            value={addr.country}
            onChange={e => setValue({ ...addr, country: e.target.value })}
            placeholder="Land"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
          />
          <EditButtons saving={saving} onSave={() => onSave(value)} onCancel={onCancel} />
        </div>
      );
    }

    case 'image':
      return (
        <div className="mt-2 space-y-2">
          <p className="text-xs text-gray-500">JPG, PNG, WebP, SVG. Max 2 MB.</p>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/svg+xml"
            onChange={async e => {
              const file = e.target.files?.[0];
              if (!file) return;
              if (file.size > 2 * 1024 * 1024) {
                alert('Bilden är för stor. Max 2 MB.');
                return;
              }
              const formData = new FormData();
              formData.append('file', file);
              formData.append('churchSlug', slug);
              const res = await fetch('/api/church/upload-logo', {
                method: 'POST',
                body: formData,
              });
              if (res.ok) {
                const { url } = await res.json();
                setValue(url);
              } else {
                alert('Uppladdning misslyckades.');
              }
            }}
            className="text-sm"
          />
          {typeof value === 'string' && value && !value.startsWith('blob:') && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="Logo preview" className="h-16 w-16 rounded-lg object-cover" />
          )}
          <EditButtons saving={saving} onSave={() => onSave(value)} onCancel={onCancel} />
        </div>
      );

    case 'pastor': {
      const pastor = (value ?? { name: '', title: '' }) as { name: string; title: string };
      return (
        <div className="mt-2 space-y-2">
          <input
            type="text"
            value={pastor.name}
            onChange={e => setValue({ ...pastor, name: e.target.value })}
            placeholder="Namn (t.ex. Johan Eriksson)"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
          />
          <input
            type="text"
            value={pastor.title}
            onChange={e => setValue({ ...pastor, title: e.target.value })}
            placeholder="Titel (t.ex. Senior Pastor) - valfritt"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
          />
          <EditButtons saving={saving} onSave={() => onSave(value)} onCancel={onCancel} />
        </div>
      );
    }

    default:
      return null;
  }
}

function EditButtons({
  saving,
  onSave,
  onCancel,
}: {
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex gap-2">
      <button
        onClick={onSave}
        disabled={saving}
        className="rounded-lg bg-rose-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-rose-600 disabled:opacity-50"
      >
        {saving ? 'Sparar...' : 'Spara'}
      </button>
      <button
        onClick={onCancel}
        disabled={saving}
        className="rounded-lg border border-gray-200 px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
      >
        Avbryt
      </button>
    </div>
  );
}
