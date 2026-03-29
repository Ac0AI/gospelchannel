import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleAuth } from 'google-auth-library';

// Load .env.local
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envFile = fs.readFileSync(path.join(root, '.env.local'), 'utf8');
for (const match of envFile.matchAll(/^([A-Z_]+)=(".*?"|.*?)$/gms)) {
  const [, k, v] = match;
  if (!process.env[k]) {
    process.env[k] = v.startsWith('"') ? v.slice(1, -1) : v;
  }
}

const SITE_URL = 'sc-domain:gospelchannel.com';
const API_BASE = 'https://searchconsole.googleapis.com/webmasters/v3';

function getAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  if (!email || !key) {
    throw new Error('Missing GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY in env');
  }
  return new GoogleAuth({
    credentials: {
      client_email: email,
      private_key: key.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
  });
}

async function apiFetch(path, options = {}) {
  const auth = getAuth();
  const client = await auth.getClient();
  const url = `${API_BASE}${path}`;
  const res = await client.request({ url, ...options });
  return res.data;
}

// ── Commands ──

async function testConnection() {
  console.log('Testing connection to Google Search Console...\n');
  const data = await apiFetch('/sites');
  const sites = data.siteEntry || [];
  console.log(`Found ${sites.length} site(s):`);
  for (const site of sites) {
    console.log(`  - ${site.siteUrl} (${site.permissionLevel})`);
  }
  return sites;
}

async function searchAnalytics({ days = 28, dimensions = ['query'], rowLimit = 25 } = {}) {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - days);

  const fmt = (d) => d.toISOString().split('T')[0];

  console.log(`\nSearch Analytics for ${SITE_URL}`);
  console.log(`Period: ${fmt(startDate)} → ${fmt(endDate)}`);
  console.log(`Dimensions: ${dimensions.join(', ')}\n`);

  const data = await apiFetch(`/sites/${encodeURIComponent(SITE_URL)}/searchAnalytics/query`, {
    method: 'POST',
    data: {
      startDate: fmt(startDate),
      endDate: fmt(endDate),
      dimensions,
      rowLimit,
    },
  });

  const rows = data.rows || [];
  if (rows.length === 0) {
    console.log('No data found for this period.');
    return;
  }

  // Print table
  const header = [...dimensions, 'clicks', 'impressions', 'ctr', 'position'];
  console.log(header.join('\t'));
  console.log('-'.repeat(80));

  for (const row of rows) {
    const keys = row.keys.join(' | ');
    const ctr = (row.ctr * 100).toFixed(1) + '%';
    const pos = row.position.toFixed(1);
    console.log(`${keys}\t${row.clicks}\t${row.impressions}\t${ctr}\t${pos}`);
  }

  console.log(`\nTotal: ${rows.length} rows`);
}

async function topPages({ days = 28, rowLimit = 25 } = {}) {
  return searchAnalytics({ days, dimensions: ['page'], rowLimit });
}

async function inspectUrl(urlToInspect) {
  console.log(`\nInspecting: ${urlToInspect}`);
  const auth = getAuth();
  const client = await auth.getClient();
  const res = await client.request({
    url: 'https://searchconsole.googleapis.com/v1/urlInspection/index:inspect',
    method: 'POST',
    data: {
      inspectionUrl: urlToInspect,
      siteUrl: SITE_URL,
      languageCode: 'sv',
    },
  });
  const data = res.data;
  console.log(JSON.stringify(data, null, 2));
}

// ── CLI ──

const [command, ...args] = process.argv.slice(2);

const commands = {
  test: testConnection,
  queries: () => searchAnalytics({ days: Number(args[0]) || 28 }),
  pages: () => topPages({ days: Number(args[0]) || 28 }),
  inspect: () => {
    if (!args[0]) {
      console.error('Usage: search-console.mjs inspect <url>');
      process.exit(1);
    }
    return inspectUrl(args[0]);
  },
};

if (!command || !commands[command]) {
  console.log(`Usage: node scripts/search-console.mjs <command>

Commands:
  test              Test connection, list sites
  queries [days]    Top search queries (default 28 days)
  pages [days]      Top pages by clicks (default 28 days)
  inspect <url>     Inspect a specific URL's index status
`);
  process.exit(0);
}

commands[command]().catch((err) => {
  console.error('Error:', err.message);
  if (err.response?.data) {
    console.error(JSON.stringify(err.response.data, null, 2));
  }
  process.exit(1);
});
