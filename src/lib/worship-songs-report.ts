// Worship Songs 2026 — data study derived from the playlist.church corpus
// (our sister catalog). The corpus is a local SQLite build not reachable from
// Cloudflare Workers at runtime, so the aggregates are pre-computed into a
// static JSON snapshot (`src/data/worship-songs-2026.json`) and read here.
// Regenerate the snapshot from the playlist.church pipeline when the corpus
// refreshes; this module only types and re-exports it.
import report from "@/data/worship-songs-2026.json";

export type WorshipSong = {
  rank: number;
  title: string;
  fullTitle: string;
  artist: string;
  churches: number;
  pct: number;
};

export type WorshipArtist = {
  rank: number;
  artist: string;
  churchReach: number;
  songs: number;
  pct: number;
};

export type WorshipHouse = {
  name: string;
  churchesReached: number;
  pct: number;
};

export type CountryChartSong = {
  rank: number;
  title: string;
  artist: string;
  churches: number;
};

export type WorshipTheme = { theme: string; songs: number };
export type CountryCount = { country: string; churches: number };

export type WorshipSongsReport = {
  version: string;
  generatedAt: string;
  builtOn: string;
  denominatorChurches: number;
  corpus: {
    churches: number;
    churchesSinging: number;
    countries: number;
    playlistCountries: number;
    playlists: number;
    worshipSongs: number;
    worshipSongGroups: number;
    songChurchEdges: number;
  };
  topSongs: WorshipSong[];
  topArtists: WorshipArtist[];
  houses: WorshipHouse[];
  houseConcentration: { bigInTop50: number; outOf: number };
  usChart: { churches: number; songs: CountryChartSong[] };
  ukChart: { churches: number; songs: CountryChartSong[] };
  themes: WorshipTheme[];
  countries: CountryCount[];
};

export function getWorshipSongsReport(): WorshipSongsReport {
  return report as WorshipSongsReport;
}
