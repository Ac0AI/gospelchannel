// Hitta YouTube-kanaler för kyrkor via Apify Search + YouTube API + Claude matching
// Kör: node scripts/find-youtube-channels.mjs [batch-size] [offset]
//
// Pipeline:
// 1. Apify YouTube Search → channelIds (inga kvotgränser)
// 2. YouTube Channels API → kanalnamn + beskrivning (1 unit per 50 kanaler)
// 3. Claude Haiku → matchar kyrka ↔ kanal

import { readFileSync, writeFileSync } from 'fs';

const APIFY_TOKEN = process.env.APIFY_TOKEN;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

if (!APIFY_TOKEN || !ANTHROPIC_API_KEY || !YOUTUBE_API_KEY) {
  console.error('Missing env vars: APIFY_TOKEN, ANTHROPIC_API_KEY, YOUTUBE_API_KEY');
  process.exit(1);
}

const CHURCHES_PATH = new URL('../src/data/churches.json', import.meta.url).pathname.replace(/%20/g, ' ');
const churches = JSON.parse(readFileSync(CHURCHES_PATH, 'utf8'));

const BATCH_SIZE = parseInt(process.argv[2]) || 50;
const OFFSET = parseInt(process.argv[3]) || 0;

// --- Apify: sök YouTube videos, extrahera channelIds ---

async function apifySearch(query) {
  const res = await fetch(
    `https://api.apify.com/v2/acts/kawsar~youtube-search-scraper/runs?token=${APIFY_TOKEN}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ searchQuery: query, maxResults: 5 }),
    }
  );
  if (!res.ok) return null;
  const run = await res.json();
  return run.data?.id;
}

async function waitForRun(runId) {
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 3000));
    try {
      const res = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`);
      const text = await res.text();
      const data = JSON.parse(text);
      const status = data.data?.status;
      if (status === 'SUCCEEDED') return true;
      if (status === 'FAILED' || status === 'ABORTED' || status === 'TIMED-OUT') return false;
    } catch {
      // Retry on parse errors
    }
  }
  return false;
}

async function getRunResults(runId) {
  const res = await fetch(`https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${APIFY_TOKEN}`);
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    console.error('\nApify returned non-JSON, skipping');
    return [];
  }
}

// --- YouTube API: slå upp kanalinfo ---

async function getChannelInfo(channelIds) {
  const results = {};
  // YouTube API tillåter 50 kanaler per anrop
  for (let i = 0; i < channelIds.length; i += 50) {
    const batch = channelIds.slice(i, i + 50);
    const url = `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${batch.join(',')}&key=${YOUTUBE_API_KEY}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.items) {
      for (const item of data.items) {
        results[item.id] = {
          channelId: item.id,
          title: item.snippet.title,
          description: item.snippet.description?.substring(0, 300) || '',
          subscriberCount: parseInt(item.statistics?.subscriberCount || '0'),
          videoCount: parseInt(item.statistics?.videoCount || '0'),
          country: item.snippet?.country || '',
        };
      }
    }
  }
  return results;
}

// --- Claude: matcha kyrka ↔ kanal ---

async function claudeMatch(churchBatch) {
  const entries = churchBatch.map((item, i) => {
    const c = item.church;
    const candidates = item.candidates.map((cand, j) =>
      `    ${j + 1}. "${cand.title}" | ${cand.subscriberCount} subs | ${cand.videoCount} videos | ${cand.country || '?'} | ${cand.description.substring(0, 150)}`
    ).join('\n');

    return `${i + 1}. "${c.name}" | ${c.location || c.country || '?'} | ${c.denomination || '?'} | ${c.website || 'ingen website'}
${candidates}`;
  }).join('\n\n');

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: `Matcha kyrkor med deras YouTube-kanal.

Svara BARA med JSON: [{"index": 1, "match": 2}, {"index": 2, "match": null}, ...]
- "index" = kyrkans nummer, "match" = kandidatnummer (1-baserat) eller null
- Kanalen måste tillhöra EXAKT den kyrkan, inte en liknande
- Fan-kanaler, topic-kanaler, VEVO = null
- Osäker = null (bättre missa än matcha fel)
- Kolla namn, plats och beskrivning noga

${entries}

JSON:`
      }],
    }),
  });

  const data = await res.json();
  const text = data.content?.[0]?.text || '';
  try {
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.error('Claude parse error:', text.substring(0, 200));
  }
  return [];
}

// --- Main ---

const targets = churches.filter(c => !c.youtubeChannelId);
const batch = targets.slice(OFFSET, OFFSET + BATCH_SIZE);

console.log(`Utan YouTube: ${targets.length} | Batch: ${OFFSET}–${OFFSET + batch.length}\n`);

// Steg 1: Starta Apify-sökningar parallellt (10 åt gången)
const PARALLEL = 10;
const churchResults = new Map(); // churchIndex → [channelIds]

for (let i = 0; i < batch.length; i += PARALLEL) {
  const chunk = batch.slice(i, i + PARALLEL);
  const queries = chunk.map(c => `${c.name} ${c.location || ''} worship`);

  // Starta alla parallellt
  const runIds = await Promise.all(
    queries.map(q => apifySearch(q))
  );

  process.stdout.write(`Apify ${i}–${i + chunk.length}: `);

  // Vänta på alla
  const successes = await Promise.all(runIds.map(id => id ? waitForRun(id) : false));

  // Hämta resultat
  for (let j = 0; j < chunk.length; j++) {
    if (successes[j] && runIds[j]) {
      const items = await getRunResults(runIds[j]);
      const channelIds = [...new Set(items.map(it => it.channelId).filter(Boolean))];
      if (channelIds.length > 0) {
        churchResults.set(OFFSET + i + j, channelIds);
        process.stdout.write('✓');
      } else {
        process.stdout.write('·');
      }
    } else {
      process.stdout.write('✗');
    }
  }
  console.log();
}

console.log(`\nApify hittade kandidater för ${churchResults.size}/${batch.length} kyrkor`);

// Steg 2: Slå upp alla unika channelIds via YouTube API
const allChannelIds = [...new Set([...churchResults.values()].flat())];
console.log(`Slår upp ${allChannelIds.length} unika kanaler via YouTube API...`);
const channelInfo = await getChannelInfo(allChannelIds);
console.log(`Fick info om ${Object.keys(channelInfo).length} kanaler`);

// Steg 3: Bygg kandidater och skicka till Claude
const withCandidates = [];

for (const [idx, channelIds] of churchResults) {
  const church = batch[idx - OFFSET];
  const candidates = channelIds
    .map(id => channelInfo[id])
    .filter(Boolean)
    .slice(0, 5);

  if (candidates.length > 0) {
    withCandidates.push({ church, candidates });
  }
}

console.log(`\n${withCandidates.length} kyrkor med kanalinfo → Claude för matching...\n`);

let totalMatched = 0;

for (let i = 0; i < withCandidates.length; i += 20) {
  const claudeBatch = withCandidates.slice(i, i + 20);
  const matches = await claudeMatch(claudeBatch);

  for (const m of matches) {
    if (m.match != null) {
      const item = claudeBatch[m.index - 1];
      if (!item) continue;
      const candidate = item.candidates[m.match - 1];
      if (!candidate) continue;

      item.church.youtubeChannelId = candidate.channelId;
      console.log(`✓ ${item.church.name} → ${candidate.title} (${candidate.channelId})`);
      totalMatched++;
    }
  }
  await new Promise(r => setTimeout(r, 300));
}

// Spara
if (totalMatched > 0) {
  writeFileSync(CHURCHES_PATH, JSON.stringify(churches, null, 2) + '\n');
  console.log(`\n💾 ${totalMatched} nya matchningar sparade`);
}

const total = churches.filter(c => c.youtubeChannelId).length;
console.log(`\nTotalt med youtubeChannelId: ${total}/${churches.length} (${(total/churches.length*100).toFixed(1)}%)`);
console.log(`Kvar utan: ${churches.length - total}`);

if (OFFSET + BATCH_SIZE < targets.length) {
  console.log(`\nNästa: node scripts/find-youtube-channels.mjs ${BATCH_SIZE} ${OFFSET + BATCH_SIZE}`);
}
