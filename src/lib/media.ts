const SUPABASE_PUBLIC_PREFIX = "/storage/v1/object/public/church-assets/";

function getMediaBaseUrl() {
  return (process.env.NEXT_PUBLIC_MEDIA_BASE_URL || "https://media.gospelchannel.com").replace(/\/$/, "");
}

export function rewriteLegacySupabaseMediaUrl(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;

  try {
    const parsed = new URL(trimmed);
    const index = parsed.pathname.indexOf(SUPABASE_PUBLIC_PREFIX);
    if (index < 0) {
      return trimmed;
    }

    const key = parsed.pathname.slice(index + SUPABASE_PUBLIC_PREFIX.length).replace(/^\/+/, "");
    if (!key) {
      return trimmed;
    }

    return `${getMediaBaseUrl()}/${key}`;
  } catch {
    return trimmed;
  }
}
