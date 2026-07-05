// Seed church_campuses från churches.json för alla nätverk
// Kör: node scripts/seed-network-campuses.mjs

import { readFileSync } from 'fs';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY');
  process.exit(1);
}

const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'return=minimal',
};

const CHURCHES_PATH = new URL('../src/data/churches.json', import.meta.url).pathname.replace(/%20/g, ' ');
const churches = JSON.parse(readFileSync(CHURCHES_PATH, 'utf8'));

// Network definitions: slug → { filter, parentChurchSlug }
const NETWORKS = {
  hillsong: {
    filter: c => c.name.toLowerCase().startsWith('hillsong') && c.slug !== 'hillsong-worship' && c.slug !== 'hillsong-young-free',
    parentSlug: 'hillsong-worship',
    name: 'Hillsong Church',
  },
  c3: {
    filter: c => c.name.toLowerCase().startsWith('c3 ') || c.name.toLowerCase().startsWith('c3church'),
    parentSlug: 'c3-church',
    name: 'C3 Church Global',
  },
  icf: {
    filter: c => c.name.toLowerCase().startsWith('icf ') || c.name.toLowerCase().startsWith('icf-'),
    parentSlug: 'icf-church',
    name: 'ICF Church',
  },
  vineyard: {
    filter: c => c.name.toLowerCase().includes('vineyard'),
    parentSlug: 'vineyard-worship',
    name: 'Vineyard Churches',
  },
  'sos-church': {
    filter: c => c.name.toLowerCase().startsWith('sos church') || c.name.toLowerCase().startsWith('sos kyrka'),
    parentSlug: 'sos-church',
    name: 'SOS Church',
  },
  'calvary-chapel': {
    filter: c => c.name.toLowerCase().startsWith('calvary chapel'),
    parentSlug: null,
    name: 'Calvary Chapel',
  },
  'every-nation': {
    filter: c => c.name.toLowerCase().includes('every nation'),
    parentSlug: null,
    name: 'Every Nation',
  },
  pingstkyrkan: {
    filter: c => c.name.toLowerCase().startsWith('pingstkyrkan') || c.name.toLowerCase().startsWith('pingstförsamlingen'),
    parentSlug: null,
    name: 'Pingst',
  },
};

async function sbFetch(path, opts = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers, ...opts });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase error ${res.status}: ${text}`);
  }
  const ct = res.headers.get('content-type');
  if (ct?.includes('json')) return res.json();
  return null;
}

// 1. Get existing networks
const networks = await sbFetch('church_networks?select=id,slug,name,parent_church_slug');
console.log('Befintliga nätverk:', networks.map(n => n.slug).join(', '));

// 2. Delete all seeded campuses and re-create fresh
console.log('\nTar bort gamla seedade campuses...');
const oldCampuses = await sbFetch('church_campuses?discovered_by=in.(seed-script,seed-network-campuses)&select=id');
for (const oc of oldCampuses) {
  // Unlink enrichments first
  await sbFetch(`church_enrichments?campus_id=eq.${oc.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ campus_id: null }),
  });
}
await sbFetch('church_campuses?discovered_by=in.(seed-script,seed-network-campuses)', {
  method: 'DELETE',
  headers: { ...headers, Prefer: 'return=minimal' },
});
console.log(`Tog bort ${oldCampuses.length} gamla campuses`);

for (const [netSlug, config] of Object.entries(NETWORKS)) {
  const network = networks.find(n => n.slug === netSlug);
  if (!network) {
    console.log(`\n⚠ Nätverk "${netSlug}" finns inte i databasen, skippar`);
    continue;
  }

  // Update parent_church_slug if needed
  if (network.parent_church_slug !== config.parentSlug) {
    const parentExists = churches.find(c => c.slug === config.parentSlug);
    if (parentExists) {
      await sbFetch(`church_networks?id=eq.${network.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ parent_church_slug: config.parentSlug }),
      });
      console.log(`\nUppdaterade ${netSlug} parent → ${config.parentSlug}`);
    }
  }

  // Find matching churches
  const matches = churches.filter(config.filter);
  console.log(`\n${config.name}: ${matches.length} kyrkor att seeda`);

  // Extract city from location
  function extractCity(church) {
    if (!church.location) return null;
    // "Stockholm, Sweden" → "Stockholm"
    // "Sydney, New South Wales, Australia" → "Sydney"
    return church.location.split(',')[0].trim();
  }

  // Build campus rows
  const campuses = matches.map(c => ({
    slug: c.slug,
    network_id: network.id,
    name: c.name,
    city: extractCity(c),
    country: c.country || null,
    status: 'published',
    discovered_by: 'seed-network-campuses',
  }));

  // Insert in batches of 50
  for (let i = 0; i < campuses.length; i += 50) {
    const batch = campuses.slice(i, i + 50);
    await sbFetch('church_campuses', {
      method: 'POST',
      headers: { ...headers, Prefer: 'return=minimal,resolution=merge-duplicates' },
      body: JSON.stringify(batch),
    });
    process.stdout.write(`  Inserted ${Math.min(i + 50, campuses.length)}/${campuses.length}\n`);
  }
}

// Verify
console.log('\n--- Verifiering ---');
for (const netSlug of Object.keys(NETWORKS)) {
  const network = networks.find(n => n.slug === netSlug);
  if (!network) continue;
  const countRes = await fetch(
    `${SUPABASE_URL}/rest/v1/church_campuses?network_id=eq.${network.id}&status=eq.published&select=id`,
    { headers: { ...headers, Prefer: 'count=exact' } }
  );
  const count = countRes.headers.get('content-range')?.split('/')[1] || '?';
  console.log(`${netSlug}: ${count} campuses`);
}
