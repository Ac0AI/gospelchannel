type AddressValue = { street: string; city: string; postal_code?: string; country: string };
type ServiceTimeValue = { day: string; time: string; label?: string };

export function validateField(fieldName: string, value: unknown): string | null {
  switch (fieldName) {
    case 'phone': {
      const v = String(value).trim();
      if (!v.startsWith('+')) return 'Phone number must start with +';
      const digits = v.slice(1).replace(/\D/g, '');
      if (digits.length < 7 || digits.length > 15) return 'Phone number must be 7-15 digits';
      return null;
    }

    case 'contact_email': {
      const v = String(value).trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'Invalid email address';
      if (v.length > 254) return 'Email address is too long';
      return null;
    }

    case 'description': {
      const v = String(value);
      if (v.length < 80) return 'Description must be at least 80 characters';
      if (v.length > 500) return 'Description must be 500 characters or less';
      if (v === v.toUpperCase() && v.length > 10) return 'Description cannot be all caps';
      const urlCount = (v.match(/https?:\/\//g) ?? []).length;
      if (urlCount > 3) return 'Description contains too many links';
      return null;
    }

    case 'website_url':
    case 'facebook_url':
    case 'youtube_url':
    case 'rss_feed_url':
    case 'livestream_url':
    case 'giving_url':
    case 'logo_url':
    case 'cover_image_url': {
      const v = String(value).trim();
      if (!v.startsWith('https://')) return 'URL must start with https://';
      return null;
    }

    case 'instagram_url': {
      const v = String(value).trim();
      if (v.startsWith('@')) return null;
      if (!v.startsWith('https://')) return 'URL must start with https:// or use an @handle';
      return null;
    }

    case 'service_times': {
      const arr = value as ServiceTimeValue[];
      if (!Array.isArray(arr) || arr.length === 0) return 'Add at least one service time';
      if (arr.length > 10) return 'Maximum 10 service times';
      return null;
    }

    case 'address': {
      const addr = value as AddressValue;
      if (!addr.street?.trim()) return 'Street address is required';
      if (addr.street.trim().length < 2) return 'Street address is too short';
      if (!addr.city?.trim()) return 'City is required';
      if (!addr.country?.trim()) return 'Country is required';
      return null;
    }

    case 'languages': {
      const arr = value as string[];
      if (!Array.isArray(arr) || arr.length === 0) return 'Select at least one language';
      if (arr.length > 10) return 'Maximum 10 languages';
      return null;
    }

    case 'ministries': {
      const arr = value as string[];
      if (Array.isArray(arr) && arr.length > 15) return 'Maximum 15 ministries';
      return null;
    }

    case 'denomination':
    case 'theological_orientation':
    case 'church_size': {
      if (!value || String(value).trim().length === 0) return 'Select an option';
      return null;
    }

    case 'pastor': {
      const obj = value as { name?: string; title?: string };
      if (!obj || typeof obj !== 'object') return 'Invalid format';
      const name = obj.name?.trim() ?? '';
      if (name.length < 2) return 'Name must be at least 2 characters';
      if (name.length > 100) return 'Name must be 100 characters or less';
      if (obj.title && obj.title.length > 100) return 'Title must be 100 characters or less';
      return null;
    }

    case 'what_to_expect': {
      const v = String(value);
      if (v.length < 30) return 'Text must be at least 30 characters';
      if (v.length > 500) return 'Text must be 500 characters or less';
      return null;
    }

    case 'google_news_query': {
      const v = String(value).trim();
      if (v.length < 3) return 'Query must be at least 3 characters';
      if (v.length > 160) return 'Query must be 160 characters or less';
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
