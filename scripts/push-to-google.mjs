// Push public URLs to Google Indexing API.
// The canonical public URL list is sitemap.xml. This script keeps the old
// queue ordering first for checkpoint stability, then appends any remaining
// sitemap URLs such as campuses, taxonomy pages, and tools.
//
// Kör: node scripts/push-to-google.mjs [batch-size]
// Default: 200 URLs (daily quota)

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { createSign } from 'crypto';

const env = readFileSync(new URL('../.env.local', import.meta.url).pathname.replace(/%20/g, ' '), 'utf8');
const getEnv = k => env.split('\n').find(l => l.startsWith(k + '='))?.slice(k.length + 1);
const SITE_URL = 'https://gospelchannel.com';

const email = getEnv('GOOGLE_SERVICE_ACCOUNT_EMAIL');
let key = getEnv('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY').replace(/^"|"$/g, '').replace(/\\n/g, '\n');

const BATCH_SIZE = parseInt(process.argv[2]) || 200;
const CHECKPOINT_PATH = new URL('../.gsc-push-checkpoint.json', import.meta.url).pathname.replace(/%20/g, ' ');

// --- Auth ---
async function getAccessToken() {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const claim = Buffer.from(JSON.stringify({
    iss: email,
    scope: 'https://www.googleapis.com/auth/indexing',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now, exp: now + 3600,
  })).toString('base64url');

  const sig = createSign('RSA-SHA256').update(header + '.' + claim).sign(key, 'base64url');
  const jwt = header + '.' + claim + '.' + sig;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=' + jwt,
  });
  const data = await res.json();
  if (!data.access_token) throw new Error('Auth failed: ' + JSON.stringify(data));
  return data.access_token;
}

// --- Build URL list (prioritized) ---
async function getAllUrls() {
  const churchesPath = new URL('../src/data/churches.json', import.meta.url).pathname.replace(/%20/g, ' ');
  const churches = JSON.parse(readFileSync(churchesPath, 'utf8'));

  const urls = [];
  const hasPlaylistData = (church) =>
    (church.spotifyPlaylistIds?.length ?? 0) > 0
    || (church.additionalPlaylists?.length ?? 0) > 0;

  // Priority 1: Static pages
  urls.push(SITE_URL);
  urls.push(`${SITE_URL}/church`);
  urls.push(`${SITE_URL}/about`);
  urls.push(`${SITE_URL}/prayerwall`);

  // Priority 2: Network pages
  const networks = ['hillsong', 'c3', 'icf', 'vineyard', 'sos-church', 'calvary-chapel', 'every-nation', 'pingstkyrkan', 'svenska-kyrkan'];
  networks.forEach(n => urls.push(`${SITE_URL}/network/${n}`));

  // Priority 3: Church pages (sorted by quality - those with playlists first)
  const withPlaylists = churches.filter(hasPlaylistData);
  const without = churches.filter((church) => !hasPlaylistData(church));
  [...withPlaylists, ...without].forEach(c => urls.push(`${SITE_URL}/church/${c.slug}`));

  // Append any remaining sitemap URLs (campuses, taxonomy pages, tools, etc.)
  // after the legacy ordering so the existing checkpoint stays valid.
  try {
    const res = await fetch(`${SITE_URL}/sitemap.xml`);
    if (res.ok) {
      const xml = await res.text();
      const sitemapUrls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1].trim());
      const seen = new Set(urls);
      let appended = 0;

      for (const url of sitemapUrls) {
        if (seen.has(url)) continue;
        seen.add(url);
        urls.push(url);
        appended++;
      }

      if (appended > 0) {
        console.log(`Lade till ${appended} extra URLs från sitemap.xml`);
      }
    }
  } catch (error) {
    console.warn(`Kunde inte läsa sitemap.xml: ${error.message}`);
  }

  return urls;
}

// --- Push ---
async function pushUrl(accessToken, url) {
  const res = await fetch('https://indexing.googleapis.com/v3/urlNotifications:publish', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, type: 'URL_UPDATED' }),
  });

  if (res.status === 429) return 'QUOTA_EXCEEDED';
  if (!res.ok) {
    const err = await res.text();
    return 'ERROR: ' + err.substring(0, 100);
  }
  return 'OK';
}

// --- Main ---
const allUrls = await getAllUrls();

// Load checkpoint
let pushed = 0;
if (existsSync(CHECKPOINT_PATH)) {
  const checkpoint = JSON.parse(readFileSync(CHECKPOINT_PATH, 'utf8'));
  pushed = checkpoint.pushed || 0;
  console.log(`Checkpoint: ${pushed} redan pushade`);
}

const batch = allUrls.slice(pushed, pushed + BATCH_SIZE);
console.log(`\nTotalt: ${allUrls.length} URLs | Pushar: ${pushed}–${pushed + batch.length}\n`);

const accessToken = await getAccessToken();
let success = 0;
let errors = 0;

for (const url of batch) {
  const result = await pushUrl(accessToken, url);

  if (result === 'QUOTA_EXCEEDED') {
    console.log('\n⚠ Kvot slut! Sparar checkpoint.');
    break;
  }

  if (result === 'OK') {
    success++;
    if (success % 20 === 0) process.stdout.write(`  ${success}/${batch.length}\n`);
  } else {
    errors++;
    console.log(`✗ ${url}: ${result}`);
  }

  // Small delay
  await new Promise(r => setTimeout(r, 50));
}

// Save checkpoint
pushed += success;
writeFileSync(CHECKPOINT_PATH, JSON.stringify({ pushed, total: allUrls.length, lastRun: new Date().toISOString() }));

console.log(`\n✓ ${success} pushade, ${errors} fel`);
console.log(`Totalt pushat: ${pushed}/${allUrls.length} (${(pushed / allUrls.length * 100).toFixed(1)}%)`);

if (pushed < allUrls.length) {
  console.log(`\nKör igen imorgon: node scripts/push-to-google.mjs`);
}
