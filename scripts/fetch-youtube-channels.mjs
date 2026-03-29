// Steg 1: Hämta youtubeChannelId från befintliga youtubeVideos
// Steg 2: Sök YouTube efter kyrkor som saknar allt YouTube-data

import { readFileSync, writeFileSync } from 'fs';

const API_KEY = process.env.YOUTUBE_API_KEY;
if (!API_KEY) {
  console.error('Missing YOUTUBE_API_KEY in environment');
  process.exit(1);
}

const CHURCHES_PATH = new URL('../src/data/churches.json', import.meta.url);
const churchesPath = CHURCHES_PATH.pathname.replace(/%20/g, ' ');
const churches = JSON.parse(readFileSync(churchesPath, 'utf8'));

// --- Steg 1: Extract channelId from existing videos ---

async function getChannelFromVideo(videoId) {
  const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.items?.[0]?.snippet) {
    return {
      channelId: data.items[0].snippet.channelId,
      channelTitle: data.items[0].snippet.channelTitle,
    };
  }
  return null;
}

async function step1_extractFromVideos() {
  const targets = churches.filter(c => c.youtubeVideos?.length > 0 && !c.youtubeChannelId);
  console.log(`\nSteg 1: ${targets.length} kyrkor har videos men inget channelId\n`);

  let updated = 0;
  for (const church of targets) {
    // Pick the first video that has the church name in channelTitle (more likely to be their own channel)
    const ownVideo = church.youtubeVideos.find(v =>
      v.channelTitle?.toLowerCase().includes(church.name.toLowerCase().split(' ')[0])
    ) || church.youtubeVideos[0];

    const result = await getChannelFromVideo(ownVideo.videoId);
    if (result) {
      church.youtubeChannelId = result.channelId;
      console.log(`✓ ${church.name} → ${result.channelTitle} (${result.channelId})`);
      updated++;
    } else {
      console.log(`✗ ${church.name} - kunde inte hämta från video ${ownVideo.videoId}`);
    }

    // Lite paus så vi inte slår i rate limit
    await new Promise(r => setTimeout(r, 100));
  }

  console.log(`\nSteg 1 klar: ${updated}/${targets.length} uppdaterade`);
  return updated;
}

// --- Steg 2: Sök YouTube efter kyrkor utan YouTube-data ---

async function searchYouTube(query) {
  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(query)}&maxResults=3&key=${API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();

  if (data.error) {
    if (data.error.code === 403) {
      console.error('\n⚠ API-kvot slut! Sparar och avslutar.');
      return 'QUOTA_EXCEEDED';
    }
    console.error('API error:', data.error.message);
    return null;
  }

  return data.items || [];
}

function isGoodMatch(church, channel) {
  const churchName = church.name.toLowerCase().replace(/[^a-z0-9]/g, '');
  const channelTitle = channel.snippet.channelTitle.toLowerCase().replace(/[^a-z0-9]/g, '');
  const description = (channel.snippet.description || '').toLowerCase();

  // Exakt eller nära namnmatch
  if (channelTitle.includes(churchName) || churchName.includes(channelTitle)) return true;

  // Kyrkas namn finns i beskrivningen + "church/worship/kyrka" nämns
  const churchWords = church.name.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  const nameWordsInDesc = churchWords.filter(w => description.includes(w)).length;
  const hasChurchKeyword = /church|worship|kyrka|iglesia|kirche|église|gemeente|kirke|församling/.test(description);

  if (nameWordsInDesc >= 2 && hasChurchKeyword) return true;

  return false;
}

async function step2_searchForChannels() {
  const targets = churches.filter(c => !c.youtubeChannelId && (!c.youtubeVideos || c.youtubeVideos.length === 0));
  console.log(`\nSteg 2: Söker YouTube för ${targets.length} kyrkor utan YouTube-data`);
  console.log('(Search API kostar 100 units/sökning, kvot = 10 000/dag = ~100 sökningar)\n');

  let found = 0;
  let searched = 0;

  for (const church of targets) {
    const query = `${church.name} ${church.location || ''} church worship`;
    const results = await searchYouTube(query);

    if (results === 'QUOTA_EXCEEDED') break;

    searched++;

    if (results && results.length > 0) {
      const match = results.find(r => isGoodMatch(church, r));
      if (match) {
        church.youtubeChannelId = match.snippet.channelId;
        console.log(`✓ ${church.name} → ${match.snippet.channelTitle} (${match.snippet.channelId})`);
        found++;
      } else {
        console.log(`~ ${church.name} - hittade kanaler men ingen bra match`);
      }
    } else {
      console.log(`✗ ${church.name} - inga resultat`);
    }

    await new Promise(r => setTimeout(r, 150));
  }

  console.log(`\nSteg 2 klar: ${found} hittade av ${searched} sökta`);
  return found;
}

// --- Main ---

const mode = process.argv[2] || 'step1';

let totalUpdated = 0;

if (mode === 'step1' || mode === 'all') {
  totalUpdated += await step1_extractFromVideos();
}

if (mode === 'step2' || mode === 'all') {
  totalUpdated += await step2_searchForChannels();
}

if (totalUpdated > 0) {
  writeFileSync(churchesPath, JSON.stringify(churches, null, 2) + '\n');
  console.log(`\n💾 Sparade ${totalUpdated} uppdateringar till churches.json`);
} else {
  console.log('\nInga uppdateringar att spara.');
}

const total = churches.filter(c => c.youtubeChannelId).length;
console.log(`\nTotalt med youtubeChannelId: ${total}/${churches.length}`);
