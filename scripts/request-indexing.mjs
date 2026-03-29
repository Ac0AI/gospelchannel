import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleAuth } from 'google-auth-library';

// Load .env.local
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envFile = fs.readFileSync(path.join(root, '.env.local'), 'utf8');
for (const match of envFile.matchAll(/^([A-Z_]+)=(".*?"|.*?)$/gms)) {
  const [, k, v] = match;
  if (!process.env[k]) process.env[k] = v.startsWith('"') ? v.slice(1, -1) : v;
}

const SITE_URL = 'https://gospelchannel.com';
const BATCH_SIZE = 100; // Google max per batch request
const DELAY_MS = 1000; // Delay between batches to be polite

function getAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  if (!email || !key) {
    throw new Error('Missing GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY');
  }
  return new GoogleAuth({
    credentials: {
      client_email: email,
      private_key: key.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/indexing'],
  });
}

// Build multipart/mixed batch body
function buildBatchBody(urls, boundary) {
  let body = '';
  for (const url of urls) {
    body += `--${boundary}\r\n`;
    body += 'Content-Type: application/http\r\n\r\n';
    body += 'POST /v3/urlNotifications:publish HTTP/1.1\r\n';
    body += 'Content-Type: application/json\r\n\r\n';
    body += JSON.stringify({ url, type: 'URL_UPDATED' }) + '\r\n';
  }
  body += `--${boundary}--`;
  return body;
}

async function sendBatch(client, urls) {
  const boundary = 'batch_gospel_' + Date.now();
  const body = buildBatchBody(urls, boundary);

  const res = await client.request({
    url: 'https://indexing.googleapis.com/batch',
    method: 'POST',
    headers: {
      'Content-Type': `multipart/mixed; boundary=${boundary}`,
    },
    body,
  });

  return res.data;
}

async function sendSingle(client, url) {
  const res = await client.request({
    url: 'https://indexing.googleapis.com/v3/urlNotifications:publish',
    method: 'POST',
    data: { url, type: 'URL_UPDATED' },
  });
  return res.data;
}

function getAllUrls() {
  // Static routes
  const staticPaths = ['', '/church', '/about', '/for-churches', '/church/suggest', '/pray'];
  const urls = staticPaths.map((p) => `${SITE_URL}${p}`);

  // Church pages from churches.json
  const churchesPath = path.join(root, 'src/data/churches.json');
  const churches = JSON.parse(fs.readFileSync(churchesPath, 'utf8'));
  for (const church of churches) {
    urls.push(`${SITE_URL}/church/${church.slug}`);
  }

  return urls;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── CLI ──

const [command, ...args] = process.argv.slice(2);

const commands = {
  async all() {
    const urls = getAllUrls();
    console.log(`Requesting indexing for ${urls.length} URLs...\n`);

    const auth = getAuth();
    const client = await auth.getClient();

    let success = 0;
    let failed = 0;

    // Send in batches of 100
    for (let i = 0; i < urls.length; i += BATCH_SIZE) {
      const batch = urls.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(urls.length / BATCH_SIZE);

      console.log(`Batch ${batchNum}/${totalBatches} (${batch.length} URLs)...`);

      try {
        await sendBatch(client, batch);
        success += batch.length;
        console.log(`  ✓ Sent ${batch.length} URLs`);
      } catch (err) {
        // Fallback: try individually
        console.log(`  Batch failed (${err.message}), trying individually...`);
        for (const url of batch) {
          try {
            await sendSingle(client, url);
            success++;
            process.stdout.write('.');
          } catch (e) {
            failed++;
            if (failed === 1) {
              console.log(`\n  First error: ${e.message}`);
              if (e.response?.data) {
                console.log('  ', JSON.stringify(e.response.data));
              }
            }
          }
        }
        console.log();
      }

      if (i + BATCH_SIZE < urls.length) {
        await sleep(DELAY_MS);
      }
    }

    console.log(`\nDone: ${success} sent, ${failed} failed (of ${urls.length} total)`);
  },

  async top() {
    // Send just the most important pages
    const prioritySlugs = [
      'hillsong-worship', 'elevation-worship', 'bethel-music',
      'maverick-city', 'upperroom', 'passion', 'jesus-culture',
      'planetshakers', 'cityalight', 'gateway-worship',
    ];
    const urls = [
      SITE_URL,
      `${SITE_URL}/church`,
      ...prioritySlugs.map((s) => `${SITE_URL}/church/${s}`),
    ];

    console.log(`Requesting indexing for ${urls.length} priority URLs...\n`);

    const auth = getAuth();
    const client = await auth.getClient();

    let success = 0;
    for (const url of urls) {
      try {
        const res = await sendSingle(client, url);
        console.log(`✓ ${url.replace(SITE_URL, '')}`);
        success++;
      } catch (e) {
        console.log(`✗ ${url.replace(SITE_URL, '')} — ${e.response?.data?.error?.message || e.message}`);
      }
    }

    console.log(`\nDone: ${success}/${urls.length} sent`);
  },

  async url() {
    const targetUrl = args[0];
    if (!targetUrl) {
      console.error('Usage: request-indexing.mjs url <full-url>');
      process.exit(1);
    }

    const auth = getAuth();
    const client = await auth.getClient();

    try {
      const res = await sendSingle(client, targetUrl);
      console.log('✓ Submitted:', targetUrl);
      console.log(JSON.stringify(res, null, 2));
    } catch (e) {
      console.error('✗ Failed:', e.response?.data?.error?.message || e.message);
      process.exit(1);
    }
  },
};

if (!command || !commands[command]) {
  console.log(`Usage: node scripts/request-indexing.mjs <command>

Commands:
  top          Request indexing for top 12 priority pages
  all          Request indexing for ALL pages (${getAllUrls().length} URLs)
  url <url>    Request indexing for a specific URL
`);
  process.exit(0);
}

commands[command]().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
