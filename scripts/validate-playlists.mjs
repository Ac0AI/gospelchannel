#!/usr/bin/env node
/**
 * Validates Spotify playlist IDs by scraping the embed page.
 * Checks that each playlist actually relates to the church.
 * Outputs a report and optionally fixes churches.json.
 */
import { readFileSync, writeFileSync } from "fs";

const CHURCHES_PATH = "src/data/churches.json";

async function getPlaylistMeta(playlistId) {
  const url = `https://open.spotify.com/embed/playlist/${playlistId}`;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      },
    });
    if (!res.ok) return { error: res.status, name: null, tracks: [] };

    const html = await res.text();
    const match = html.match(
      /<script id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s
    );
    if (!match) return { error: "no_next_data", name: null, tracks: [] };

    const data = JSON.parse(match[1]);
    const entity = data?.props?.pageProps?.state?.data?.entity;
    if (!entity) return { error: "no_entity", name: null, tracks: [] };

    const tracks = (entity.trackList || []).map((t) => ({
      title: t.title,
      artist: t.subtitle,
    }));

    return { error: null, name: entity.title || entity.name, tracks };
  } catch (err) {
    return { error: err.message, name: null, tracks: [] };
  }
}

function isRelated(churchName, playlistName, tracks) {
  if (!playlistName) return false;

  const cn = churchName.toLowerCase();
  const pn = playlistName.toLowerCase();

  // Check if playlist name contains part of church name
  const churchWords = cn
    .split(/[\s/&,]+/)
    .filter((w) => w.length > 3);
  const nameMatch = churchWords.some((w) => pn.includes(w));
  if (nameMatch) return true;

  // Check for worship-related keywords in playlist name
  const worshipKeywords = [
    "worship",
    "gospel",
    "praise",
    "church",
    "hymn",
    "christian",
    "faith",
    "prayer",
    "jesus",
    "god",
    "spirit",
    "psalm",
    "hillsong",
    "elevation",
    "bethel",
    "maverick",
    "sinach",
  ];
  const hasWorshipWord = worshipKeywords.some((w) => pn.includes(w));
  if (hasWorshipWord) return true;

  // Check if tracks have worship-related artists
  if (tracks.length > 0) {
    const trackArtists = tracks
      .slice(0, 10)
      .map((t) => (t.artist || "").toLowerCase())
      .join(" ");
    const hasWorshipArtist = worshipKeywords.some((w) =>
      trackArtists.includes(w)
    );
    if (hasWorshipArtist) return true;
  }

  return false;
}

async function main() {
  const churches = JSON.parse(readFileSync(CHURCHES_PATH, "utf-8"));
  const fix = process.argv.includes("--fix");

  const results = { valid: [], invalid: [], error: [], noPlaylist: [] };
  let changed = false;

  for (const church of churches) {
    const pids = church.spotifyPlaylistIds || [];
    if (pids.length === 0) {
      results.noPlaylist.push(church.name);
      continue;
    }

    // Only check the first playlist
    const pid = pids[0];
    console.log(`Checking ${church.name}...`);
    const meta = await getPlaylistMeta(pid);

    if (meta.error) {
      results.error.push({
        church: church.name,
        pid,
        error: meta.error,
      });
      // If embed also fails, the playlist ID is truly broken
      if (fix) {
        church.spotifyPlaylistIds = [];
        church.spotifyUrl = "";
        changed = true;
      }
    } else if (!isRelated(church.name, meta.name, meta.tracks)) {
      results.invalid.push({
        church: church.name,
        pid,
        playlistName: meta.name,
        firstTrack:
          meta.tracks[0]
            ? `${meta.tracks[0].artist} - ${meta.tracks[0].title}`
            : "empty",
        trackCount: meta.tracks.length,
      });
      if (fix) {
        church.spotifyPlaylistIds = [];
        church.spotifyUrl = "";
        changed = true;
      }
    } else {
      results.valid.push({
        church: church.name,
        playlistName: meta.name,
        trackCount: meta.tracks.length,
      });
    }

    // Rate limit
    await new Promise((r) => setTimeout(r, 800));
  }

  console.log(`\n=== VALIDATION RESULTS ===`);
  console.log(`Valid: ${results.valid.length}`);
  console.log(`Invalid (wrong playlist): ${results.invalid.length}`);
  console.log(`Error (unreachable): ${results.error.length}`);
  console.log(`No playlist: ${results.noPlaylist.length}`);

  if (results.invalid.length > 0) {
    console.log(`\n--- INVALID (wrong playlist) ---`);
    for (const r of results.invalid) {
      console.log(
        `  ${r.church} -> "${r.playlistName}" | First: ${r.firstTrack} | ${r.trackCount} tracks`
      );
    }
  }

  if (results.error.length > 0) {
    console.log(`\n--- ERROR ---`);
    for (const r of results.error) {
      console.log(`  ${r.church} -> ${r.error} (${r.pid})`);
    }
  }

  if (results.valid.length > 0) {
    console.log(`\n--- VALID (sample) ---`);
    for (const r of results.valid.slice(0, 15)) {
      console.log(`  ${r.church} -> "${r.playlistName}" (${r.trackCount} tracks)`);
    }
    if (results.valid.length > 15)
      console.log(`  ... and ${results.valid.length - 15} more`);
  }

  if (fix && changed) {
    writeFileSync(CHURCHES_PATH, JSON.stringify(churches, null, 2) + "\n");
    console.log(`\n✓ Fixed churches.json — removed ${results.invalid.length + results.error.length} bad playlists`);
  } else if (results.invalid.length + results.error.length > 0) {
    console.log(`\nRun with --fix to automatically remove invalid playlists`);
  }
}

main();
