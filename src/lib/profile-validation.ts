type AddressValue = { street: string; city: string; postal_code?: string; country: string };
type ServiceTimeValue = { day: string; time: string; label?: string };

export function validateField(fieldName: string, value: unknown): string | null {
  switch (fieldName) {
    case 'phone': {
      const v = String(value).trim();
      if (!v.startsWith('+')) return 'Telefonnummer måste börja med +';
      const digits = v.slice(1).replace(/\D/g, '');
      if (digits.length < 7 || digits.length > 15) return 'Telefonnummer måste vara 7–15 siffror';
      return null;
    }

    case 'contact_email': {
      const v = String(value).trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'Ogiltig e-postadress';
      if (v.length > 254) return 'E-postadressen är för lång';
      return null;
    }

    case 'description': {
      const v = String(value);
      if (v.length < 80) return 'Beskrivningen måste vara minst 80 tecken';
      if (v.length > 500) return 'Beskrivningen får vara max 500 tecken';
      if (v === v.toUpperCase() && v.length > 10) return 'Beskrivningen kan inte vara enbart versaler';
      const urlCount = (v.match(/https?:\/\//g) ?? []).length;
      if (urlCount > 3) return 'Beskrivningen innehåller för många länkar';
      return null;
    }

    case 'website_url':
    case 'facebook_url':
    case 'youtube_url':
    case 'rss_feed_url':
    case 'livestream_url':
    case 'giving_url': {
      const v = String(value).trim();
      if (!v.startsWith('https://')) return 'URL måste börja med https://';
      return null;
    }

    case 'instagram_url': {
      const v = String(value).trim();
      if (v.startsWith('@')) return null;
      if (!v.startsWith('https://')) return 'URL måste börja med https:// eller vara ett @handle';
      return null;
    }

    case 'service_times': {
      const arr = value as ServiceTimeValue[];
      if (!Array.isArray(arr) || arr.length === 0) return 'Minst en gudstjänsttid krävs';
      if (arr.length > 10) return 'Max 10 gudstjänsttider';
      return null;
    }

    case 'address': {
      const addr = value as AddressValue;
      if (!addr.street?.trim()) return 'Gatuadress krävs';
      if (addr.street.trim().length < 2) return 'Gatuadress för kort';
      if (!addr.city?.trim()) return 'Stad krävs';
      if (!addr.country?.trim()) return 'Land krävs';
      return null;
    }

    case 'languages': {
      const arr = value as string[];
      if (!Array.isArray(arr) || arr.length === 0) return 'Välj minst ett språk';
      if (arr.length > 10) return 'Max 10 språk';
      return null;
    }

    case 'ministries': {
      const arr = value as string[];
      if (Array.isArray(arr) && arr.length > 15) return 'Max 15 verksamheter';
      return null;
    }

    case 'denomination':
    case 'theological_orientation':
    case 'church_size': {
      if (!value || String(value).trim().length === 0) return 'Välj ett alternativ';
      return null;
    }

    case 'pastor': {
      const obj = value as { name?: string; title?: string };
      if (!obj || typeof obj !== 'object') return 'Ogiltigt format';
      const name = obj.name?.trim() ?? '';
      if (name.length < 2) return 'Namn måste vara minst 2 tecken';
      if (name.length > 100) return 'Namn får vara max 100 tecken';
      if (obj.title && obj.title.length > 100) return 'Titel får vara max 100 tecken';
      return null;
    }

    case 'what_to_expect': {
      const v = String(value);
      if (v.length < 30) return 'Texten måste vara minst 30 tecken';
      if (v.length > 500) return 'Texten får vara max 500 tecken';
      return null;
    }

    case 'google_news_query': {
      const v = String(value).trim();
      if (v.length < 3) return 'Sökfrågan måste vara minst 3 tecken';
      if (v.length > 160) return 'Sökfrågan får vara max 160 tecken';
      return null;
    }

    default:
      return null;
  }
}

export function normalizeInstagramInput(value: string): string {
  const v = value.trim();
  if (v.startsWith('@')) {
    return `https://instagram.com/${v.slice(1)}`;
  }
  return v;
}

export function sanitizeText(value: string): string {
  return value.replace(/<[^>]*>/g, '');
}
