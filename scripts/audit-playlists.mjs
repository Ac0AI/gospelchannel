#!/usr/bin/env node
import { readFileSync } from "fs";

const clientId = process.env.SPOTIFY_CLIENT_ID;
const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
if (!clientId || !clientSecret) {
  console.error("Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET");
  process.exit(1);
}

async function getToken() {
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  const json = await res.json();
  return json.access_token;
}

async function testPlaylist(token, id) {
  const res = await fetch(`https://api.spotify.com/v1/playlists/${id}/tracks?limit=3`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return { status: res.status, tracks: 0, firstTrack: null, playlistName: null };
  const json = await res.json();
  const first = json.items?.[0]?.track;
  // Also get playlist name
  const metaRes = await fetch(`https://api.spotify.com/v1/playlists/${id}?fields=name,description`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const meta = metaRes.ok ? await metaRes.json() : {};
  return {
    status: 200,
    tracks: json.total || 0,
    firstTrack: first ? `${first.artists[0]?.name} - ${first.name}` : null,
    playlistName: meta.name || null,
  };
}

async function main() {
  const token = await getToken();
  const churches = JSON.parse(readFileSync("src/data/churches.json", "utf-8"));

  const blocked = [];
  const suspicious = [];
  const ok = [];
  const noPlaylist = [];

  for (const c of churches) {
    const pids = c.spotifyPlaylistIds || [];
    if (pids.length === 0) {
      noPlaylist.push(c.name);
      continue;
    }

    for (const pid of pids.slice(0, 1)) {
      const r = await testPlaylist(token, pid);
      if (r.status !== 200) {
        blocked.push({ church: c.name, pid, status: r.status });
      } else {
        // Check if playlist name seems related to church
        const churchLower = c.name.toLowerCase();
        const plNameLower = (r.playlistName || "").toLowerCase();
        const worshipKeywords = ["worship", "gospel", "praise", "church", "hymn", "christian", "faith", "prayer", "jesus", "god", "spirit", "psalm"];
        const hasWorshipWord = worshipKeywords.some(w => plNameLower.includes(w));
        const hasChurchName = churchLower.split(/[\s/]+/).some(w => w.length > 3 && plNameLower.includes(w));

        if (!hasWorshipWord && !hasChurchName) {
          suspicious.push({ church: c.name, pid, playlistName: r.playlistName, firstTrack: r.firstTrack, tracks: r.tracks });
        } else {
          ok.push({ church: c.name, playlistName: r.playlistName, tracks: r.tracks });
        }
      }
    }
  }

  console.log(`\n=== AUDIT RESULTS ===`);
  console.log(`OK (verified): ${ok.length}`);
  console.log(`BLOCKED (403/404): ${blocked.length}`);
  console.log(`SUSPICIOUS (no worship keywords): ${suspicious.length}`);
  console.log(`NO PLAYLIST: ${noPlaylist.length}`);

  if (blocked.length > 0) {
    console.log(`\n--- BLOCKED ---`);
    for (const b of blocked) console.log(`  ${b.church} -> HTTP ${b.status} (${b.pid})`);
  }

  if (suspicious.length > 0) {
    console.log(`\n--- SUSPICIOUS (likely wrong playlist) ---`);
    for (const s of suspicious) console.log(`  ${s.church} -> "${s.playlistName}" | First: ${s.firstTrack} | ${s.tracks} tracks`);
  }

  if (noPlaylist.length > 0) {
    console.log(`\n--- NO PLAYLIST ---`);
    for (const n of noPlaylist) console.log(`  ${n}`);
  }

  console.log(`\n--- OK (sample) ---`);
  for (const o of ok.slice(0, 10)) console.log(`  ${o.church} -> "${o.playlistName}" (${o.tracks} tracks)`);
  if (ok.length > 10) console.log(`  ... and ${ok.length - 10} more`);
}

main();
