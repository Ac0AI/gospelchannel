// Per-convention sources for the Assembleia de Deus (Brazil) import.
// AD has no single national directory — each state convention / ministry
// publishes its own. Each source exposes:
//   { key, network, state, baseUrl, fetchAll(limit) -> raw, parseCongregations(raw) -> records[] }
// where a record is { name, city, state, street, sector, phone } (strings, "" when absent).
// The importer (scripts/import-ad-brazil-churches.mjs) consumes only that contract.

import { normalizeWhitespace, decodeHtml } from "./church-intake-utils.mjs";

const UA = { "User-Agent": "Mozilla/5.0 (compatible; GospelChannelBot/1.0)" };

// Wix embeds its dataset in a "wix-warmup-data" blob with its own entity
// encoding (&q; for quote etc.). Decode before JSON.parse.
function decodeWix(s) {
  return String(s || "")
    .replace(/&q;/g, '"')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)));
}

function clean(s) {
  return normalizeWhitespace(decodeHtml(String(s || ""))).trim();
}

export const SOURCES = {
  // AD Ministério de Belo Horizonte (Grande BH, Minas Gerais).
  // Public Wix table; the full dataset (~60 congregations, addresses + city)
  // lives in the page's warmup JSON. Wix's field names are mislabeled — mapped
  // here by value: name<-regional, address<-endereo, city<-cidade, sector<-title.
  adbh: {
    key: "adbh",
    network: "Assembleia de Deus (Ministério Belo Horizonte)",
    state: "MG",
    baseUrl: "https://www.assembleiadedeusbh.com/endereco-das-congregacoes",
    async fetchAll() {
      const res = await fetch(this.baseUrl, { headers: UA });
      if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${this.baseUrl}`);
      return res.text();
    },
    parseCongregations(html) {
      const decoded = decodeWix(html);
      const objs = decoded.match(/\{[^{}]*"bairro"[^{}]*\}/g) || [];
      const byId = new Map();
      for (const chunk of objs) {
        let rec;
        try {
          rec = JSON.parse(chunk);
        } catch {
          continue;
        }
        // Real congregation rows carry _id + cidade; sort/schema metadata does not.
        if (!rec || !rec._id || rec.cidade === undefined) continue;
        byId.set(rec._id, rec);
      }
      const out = [];
      for (const r of byId.values()) {
        const congregation = clean(r.regional || r.bairro);
        if (!congregation) continue;
        out.push({
          name: `Assembleia de Deus ${congregation}`,
          city: clean(r.cidade),
          state: "MG",
          street: clean(r.endereo),
          bairro: clean(r.bairro),
          sector: clean(r.title),
          phone: "",
        });
      }
      return out;
    },
  },
};
