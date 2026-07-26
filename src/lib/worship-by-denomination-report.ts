// Worship by Denomination 2026 — behavioral data study. Denomination labels
// (directory/import metadata) joined to real church-playlist song adoption
// (playlist.church corpus). Two independent sources: NOT derived from the
// denomination-primed music_style classifier. Pre-computed into a static
// snapshot (regenerate: scripts/export-worship-by-denomination.mjs).
import report from "@/data/worship-by-denomination-2026.json";

export type DenomSong = { title: string; artist: string; pct: number };

export type DenomFamily = {
  family: string;
  churches: number;
  modernHymnPct: number;
  megachurchAnthemPct: number;
  topSongs: DenomSong[];
};

export type WorshipByDenominationReport = {
  version: string;
  generatedAt: string;
  builtOn: string;
  population: {
    churches: number;
    reportableChurches: number;
    countries: string[];
    minFamilySize: number;
    note: string;
  };
  method: string;
  hymnHouses: string[];
  anthemHouses: string[];
  overall: DenomFamily;
  families: DenomFamily[];
};

export function getWorshipByDenominationReport(): WorshipByDenominationReport {
  return report as WorshipByDenominationReport;
}
