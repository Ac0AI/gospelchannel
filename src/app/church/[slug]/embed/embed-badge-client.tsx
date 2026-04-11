'use client';

import { useState } from 'react';

interface Props {
  churchName: string;
  churchUrl: string;
}

type Variant = 'light' | 'dark';
type Size = 'default' | 'compact';

export function EmbedBadgeClient({ churchName, churchUrl }: Props) {
  const [variant, setVariant] = useState<Variant>('light');
  const [size, setSize] = useState<Size>('default');
  const [copied, setCopied] = useState(false);

  const siteUrl = typeof window !== 'undefined'
    ? window.location.origin
    : 'https://gospelchannel.com';

  const badgeSrc = size === 'compact'
    ? `${siteUrl}/badges/concept-4-compact-${variant}.svg`
    : `${siteUrl}/badges/concept-3-medallion-${variant}.svg`;

  const badgeWidth = size === 'compact' ? 160 : 280;
  const badgeHeight = size === 'compact' ? 44 : 76;

  const embedCode = `<a href="${churchUrl}" target="_blank" rel="noopener" title="${churchName} on GospelChannel"><img src="${badgeSrc}" alt="GospelChannel Verified Church" width="${badgeWidth}" height="${badgeHeight}" style="border:0" /></a>`;

  async function copyToClipboard() {
    try {
      await navigator.clipboard.writeText(embedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = embedCode;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  }

  return (
    <div className="mt-8 space-y-8">
      {/* Preview */}
      <div className="rounded-2xl border border-rose-200/60 bg-white p-8">
        <h2 className="mb-4 font-serif text-lg font-semibold text-espresso">Preview</h2>

        {/* Variant + size toggles */}
        <div className="mb-6 flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-warm">Background</span>
            <div className="flex overflow-hidden rounded-lg border border-gray-200">
              <button
                onClick={() => setVariant('light')}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  variant === 'light'
                    ? 'bg-espresso text-white'
                    : 'bg-white text-warm-brown hover:bg-linen-deep'
                }`}
              >
                Light
              </button>
              <button
                onClick={() => setVariant('dark')}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  variant === 'dark'
                    ? 'bg-espresso text-white'
                    : 'bg-white text-warm-brown hover:bg-linen-deep'
                }`}
              >
                Dark
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-warm">Size</span>
            <div className="flex overflow-hidden rounded-lg border border-gray-200">
              <button
                onClick={() => setSize('default')}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  size === 'default'
                    ? 'bg-espresso text-white'
                    : 'bg-white text-warm-brown hover:bg-linen-deep'
                }`}
              >
                Standard
              </button>
              <button
                onClick={() => setSize('compact')}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  size === 'compact'
                    ? 'bg-espresso text-white'
                    : 'bg-white text-warm-brown hover:bg-linen-deep'
                }`}
              >
                Compact
              </button>
            </div>
          </div>
        </div>

        {/* Badge preview with background */}
        <div
          className={`flex items-center justify-center rounded-xl p-8 ${
            variant === 'dark' ? 'bg-gray-900' : 'bg-gray-50 border border-gray-100'
          }`}
        >
          <a href={churchUrl} target="_blank" rel="noopener noreferrer">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={badgeSrc}
              alt="GospelChannel Verified Church"
              width={badgeWidth}
              height={badgeHeight}
              style={{ border: 0 }}
            />
          </a>
        </div>
      </div>

      {/* Embed code */}
      <div className="rounded-2xl border border-rose-200/60 bg-white p-8">
        <h2 className="mb-2 font-serif text-lg font-semibold text-espresso">Embed code</h2>
        <p className="mb-4 text-sm text-warm-brown">
          Copy this code and paste it into your church website.
        </p>

        <div className="relative">
          <pre className="overflow-x-auto rounded-xl bg-gray-900 p-4 text-xs leading-relaxed text-gray-300">
            <code>{embedCode}</code>
          </pre>
          <button
            onClick={copyToClipboard}
            className={`absolute right-3 top-3 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              copied
                ? 'bg-green-500 text-white'
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>

      {/* Mockup */}
      <div className="rounded-2xl border border-rose-200/60 bg-white p-8">
        <h2 className="mb-4 font-serif text-lg font-semibold text-espresso">How it can look</h2>
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-6">
          <div className="mb-1 font-serif text-lg font-bold text-gray-800">{churchName}</div>
          <p className="mb-4 text-sm leading-relaxed text-gray-500">
            Welcome to our church community. Join us for worship every Sunday.
          </p>
          <div className="border-t border-gray-200 pt-4">
            <a href={churchUrl} target="_blank" rel="noopener noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`${siteUrl}/badges/concept-3-medallion-light.svg`}
                alt="GospelChannel Verified Church"
                width={220}
                height={60}
                style={{ border: 0 }}
              />
            </a>
          </div>
        </div>
      </div>

      {/* Tips */}
      <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-6">
        <h3 className="mb-2 font-serif text-base font-semibold text-espresso">Tips</h3>
        <ul className="space-y-1.5 text-sm text-warm-brown">
          <li>Place the badge in your footer or on your contact page for best visibility.</li>
          <li>Use the dark badge on a light page, and the light badge on a dark page.</li>
          <li>The badge links directly to your GospelChannel profile.</li>
        </ul>
      </div>
    </div>
  );
}
