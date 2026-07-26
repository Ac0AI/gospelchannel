#!/usr/bin/env node
/**
 * Build the open `data-release-worship/` bundle for the Worship Songs 2026
 * data study, from the in-repo snapshot (src/data/worship-songs-2026.json).
 * Emits flat CSVs + snapshot.json + README + CITATION.cff, ready for the
 * Kaggle / Zenodo / Hugging Face publishers. Reproducible, no DB access.
 *
 *   node scripts/export-worship-songs-dataset.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "data-release-worship");
const DATA = join(OUT, "data");
mkdirSync(DATA, { recursive: true });

const d = JSON.parse(readFileSync(join(ROOT, "src/data/worship-songs-2026.json"), "utf8"));

const csvCell = (v) => {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const toCsv = (rows, headers) =>
  [headers.join(","), ...rows.map((r) => headers.map((h) => csvCell(r[h])).join(","))].join("\n") + "\n";

// top_songs.csv
writeFileSync(
  join(DATA, "top_songs.csv"),
  toCsv(
    d.topSongs.map((s) => ({ rank: s.rank, song: s.title, artist: s.artist, churches: s.churches, pct_of_churches: s.pct })),
    ["rank", "song", "artist", "churches", "pct_of_churches"],
  ),
);

// top_artists.csv
writeFileSync(
  join(DATA, "top_artists.csv"),
  toCsv(
    d.topArtists.map((a) => ({ rank: a.rank, artist: a.artist, church_reach: a.churchReach, songs: a.songs, pct_of_churches: a.pct })),
    ["rank", "artist", "church_reach", "songs", "pct_of_churches"],
  ),
);

// worship_houses.csv
writeFileSync(
  join(DATA, "worship_houses.csv"),
  toCsv(
    d.houses.map((h) => ({ house: h.name, churches_reached: h.churchesReached, pct_of_churches: h.pct })),
    ["house", "churches_reached", "pct_of_churches"],
  ),
);

// charts_by_country.csv (US + UK)
const countryRows = [
  ...d.usChart.songs.map((s) => ({ country: "United States", rank: s.rank, song: s.title, churches: s.churches })),
  ...d.ukChart.songs.map((s) => ({ country: "United Kingdom", rank: s.rank, song: s.title, churches: s.churches })),
];
writeFileSync(join(DATA, "charts_by_country.csv"), toCsv(countryRows, ["country", "rank", "song", "churches"]));

// themes.csv
writeFileSync(
  join(DATA, "themes.csv"),
  toCsv(d.themes.map((t) => ({ theme: t.theme, song_groups: t.songs })), ["theme", "song_groups"]),
);

// snapshot.json (machine-readable everything)
writeFileSync(join(DATA, "snapshot.json"), JSON.stringify(d, null, 2));

// CITATION.cff
writeFileSync(
  join(OUT, "CITATION.cff"),
  `cff-version: 1.2.0
title: "Worship Songs 2026: church-playlist adoption across 825 churches"
message: "If you use this dataset, please cite it as below."
type: dataset
authors:
  - name: "GospelChannel"
url: "https://gospelchannel.com/worship-songs-2026"
license: CC-BY-4.0
date-released: 2026-07-26
keywords:
  - worship
  - church music
  - contemporary worship
  - congregational singing
  - CCLI
  - open data
`,
);

// LICENSE (reuse the CC-BY-4.0 text already in the repo's european release)
const srcLicense = join(ROOT, "data-release", "LICENSE");
if (existsSync(srcLicense)) copyFileSync(srcLicense, join(OUT, "LICENSE"));

// README.md
const song1 = d.topSongs[0], song2 = d.topSongs[1];
const h = Object.fromEntries(d.houses.map((x) => [x.name, x.pct]));
writeFileSync(
  join(OUT, "README.md"),
  `# Worship Songs 2026 — church-playlist adoption data

What worship songs do churches actually sing? This dataset measures it from
the real, church-curated Spotify worship playlists of **${d.corpus.churchesSinging} churches
across ${d.corpus.countries} countries** (${d.corpus.worshipSongs.toLocaleString("en-US")} worship
songs, ${d.corpus.songChurchEdges.toLocaleString("en-US")} song-to-church links). A church is
counted as "singing" a song when the track appears in one of its worship playlists.
No survey, no AI-inferred labels — direct observation of what churches chose.

**Companion report + methodology:** https://gospelchannel.com/worship-songs-2026
**Live, always-current chart:** https://playlist.church

## Headline findings

- The two most widely sung songs tie: **${song1.title}** (${song1.artist}) and
  **${song2.title}** (${song2.artist}), each in ${song1.churches} of ${d.corpus.churchesSinging}
  churches (~${song1.pct}%).
- Four worship houses dominate: Hillsong reaches ${h.Hillsong}% of churches,
  Elevation ${h.Elevation}%, Bethel ${h.Bethel}%, Passion ${h.Passion}%.
  ${d.houseConcentration.bigInTop50} of the top ${d.houseConcentration.outOf} songs come from
  those four houses plus Phil Wickham. This independently echoes the "Big Four"
  concentration long observed on CCLI licensing charts, from a different data source.
- Lyrics skew hard to adoration: the most common themes are
  ${d.themes.slice(0, 4).map((t) => t.theme).join(", ")}.

## Files

\`\`\`
data/top_songs.csv          # Most-sung songs, ranked by # of churches
data/top_artists.csv        # Artist reach (distinct churches with >=1 song)
data/worship_houses.csv     # Hillsong / Bethel / Elevation / Passion reach
data/charts_by_country.csv  # US vs UK song charts
data/themes.csv             # Lyrical theme frequency
data/snapshot.json          # Machine-readable metadata + all of the above
\`\`\`

## Load it

\`\`\`python
import pandas as pd
songs = pd.read_csv("data/top_songs.csv")
print(songs.head(25))
\`\`\`

## Method, and what it does not cover

Source: the playlist.church corpus, built ${d.builtOn} from public Spotify worship
playlists of churches in the GospelChannel network. **Denominator N = ${d.corpus.churchesSinging}**
churches with at least one worship-flagged song. Live and studio cuts of the same
recording are merged; different lead-artist recordings of a song are counted separately.

**Selection bias (important):** every church here publishes a Spotify worship playlist,
so the sample skews contemporary, English-speaking, and Protestant, with most churches
in the US and UK. This is a map of the modern-worship repertoire — not a census of all
churches, and not representative of gospel, traditional, or liturgical worship.

License: [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/). Corrections or
catalog removals: press at gospelchannel.com.
`,
);

console.log("Wrote data-release-worship/ :");
console.log("  data/{top_songs,top_artists,worship_houses,charts_by_country,themes}.csv");
console.log("  data/snapshot.json, README.md, CITATION.cff, LICENSE" + (existsSync(srcLicense) ? "" : " (LICENSE missing — copy manually)"));
