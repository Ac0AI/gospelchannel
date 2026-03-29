import type { ProfileFieldDefinition } from '@/types/gospel';

export const PROFILE_FIELDS: ProfileFieldDefinition[] = [
  // Badge requirements
  {
    name: 'service_times',
    label: 'Gudstjänsttider',
    category: 'badge',
    points: 10,
    type: 'service-times',
    validation: { min: 1, max: 10 },
  },
  {
    name: 'address',
    label: 'Adress',
    category: 'badge',
    points: 10,
    type: 'address',
  },
  {
    name: 'phone',
    label: 'Telefon',
    category: 'badge',
    points: 10,
    type: 'tel',
    validation: { pattern: '^\\+[0-9]{7,15}$' },
  },
  {
    name: 'contact_email',
    label: 'Kontakt-epost',
    category: 'badge',
    points: 10,
    type: 'email',
    validation: { maxLength: 254 },
  },
  // Bonus
  {
    name: 'description',
    label: 'Beskrivning',
    category: 'bonus',
    points: 10,
    type: 'textarea',
    validation: { minLength: 80, maxLength: 500 },
  },
  {
    name: 'instagram_url',
    label: 'Instagram',
    category: 'bonus',
    points: 0,
    type: 'url',
    validation: { maxLength: 200 },
  },
  {
    name: 'facebook_url',
    label: 'Facebook',
    category: 'bonus',
    points: 0,
    type: 'url',
    validation: { maxLength: 500 },
  },
  {
    name: 'youtube_url',
    label: 'YouTube',
    category: 'bonus',
    points: 0,
    type: 'url',
    validation: { maxLength: 300 },
  },
  {
    name: 'website_url',
    label: 'Hemsida',
    category: 'bonus',
    points: 7,
    type: 'url',
    validation: { maxLength: 500 },
  },
  {
    name: 'rss_feed_url',
    label: 'RSS-flöde',
    category: 'bonus',
    points: 0,
    type: 'url',
    validation: { maxLength: 500 },
  },
  {
    name: 'google_news_query',
    label: 'Google News-sökning',
    category: 'extra',
    points: 0,
    type: 'text',
    validation: { minLength: 3, maxLength: 160 },
  },
  {
    name: 'denomination',
    label: 'Samfund',
    category: 'bonus',
    points: 8,
    type: 'select',
    options: ['Pingst', 'EFK', 'Equmenia', 'Svenska kyrkan', 'Katolska', 'Vineyard', 'Trosrörelsen', 'Frälsningsarmén', 'Baptistsamfundet', 'Annat'],
    validation: { maxLength: 100 },
  },
  {
    name: 'theological_orientation',
    label: 'Teologisk inriktning',
    category: 'bonus',
    points: 0,
    type: 'select',
    options: ['Karismatisk', 'Liturgisk', 'Evangelikal', 'Reformert', 'Annat'],
  },
  {
    name: 'languages',
    label: 'Språk',
    category: 'bonus',
    points: 7,
    type: 'multi-select',
    options: ['Svenska', 'Engelska', 'Spanska', 'Arabiska', 'Farsi', 'Tigrinja', 'Franska', 'Finska', 'Annat'],
    validation: { min: 1, max: 10 },
  },
  // Extra
  {
    name: 'logo_url',
    label: 'Logotyp',
    category: 'extra',
    points: 8,
    type: 'image',
  },
  {
    name: 'ministries',
    label: 'Verksamheter',
    category: 'extra',
    points: 7,
    type: 'checkboxes',
    options: ['Barnverksamhet', 'Ungdom', 'Kör/lovsång', 'Bönegrupp', 'Alphakurs', 'Bibelstudium', 'Diakoni', 'Internationellt', 'Annat'],
    validation: { max: 15 },
  },
  {
    name: 'church_size',
    label: 'Kyrkstorlek',
    category: 'extra',
    points: 5,
    type: 'select',
    options: ['small', 'medium', 'large', 'mega'],
  },
];

export const SOCIAL_MEDIA_FIELDS = ['instagram_url', 'facebook_url', 'youtube_url'];
export const SOCIAL_MEDIA_POINTS = 8;

export const CONTACT_FIELDS = ['phone', 'contact_email'];

export const DENOMINATION_OPTIONS = PROFILE_FIELDS.find(f => f.name === 'denomination')!.options!;
export const CHURCH_SIZE_LABELS: Record<string, string> = {
  small: 'Under 100 besökare',
  medium: '100–300 besökare',
  large: '300–1000 besökare',
  mega: 'Över 1000 besökare',
};

export const DAY_OPTIONS = ['Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag', 'Söndag'];
