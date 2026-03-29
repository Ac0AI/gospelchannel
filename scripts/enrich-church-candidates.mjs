#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCREENING_PATH = resolve(__dirname, "../src/data/cache/church-candidate-screening.json");

const OFFICIAL_HOST_BLOCKLIST = [
  "tripadvisor.",
  "tripzilla.",
  "linkedin.",
  "fodors.",
  "visitberlin.",
  "kyrktorget.",
  "lobpreissuche.",
  "mapaosc.ipea.gov.br",
  "noticias.cancaonova.",
  "arqrio.org.br",
  "sacramentinos.com",
];

const EMAIL_IGNORE = [
  "sentry",
  "wixpress",
  "youtube.com",
  "facebook.com",
  "frontend",
  "example.com",
  "user@domain.com",
  "@mail.com",
];

const CURATED_UPDATES = {
  "4a0a571a-c023-4972-a04e-4989dab2dc33": {
    website: "https://www.hopebiblechurch.org/",
    location: "Columbia, Maryland",
    country: "United States",
  },
  "37e55f70-9adc-428b-b856-610029465061": {
    website: "https://restorationarlington.org/",
    location: "Arlington, Virginia",
    country: "United States",
  },
  "22dc9619-b3ac-4280-b08c-b2ebb5620519": {
    website: "https://www.lifepoint.org/",
    contactEmail: "info@lifepoint.org",
    location: "Fredericksburg, Virginia",
    country: "United States",
  },
  "462a06e9-4b5c-4245-b79d-61ce4ea36ea4": {
    website: "https://trailhead.church/",
    location: "Graham, North Carolina",
    country: "United States",
  },
  "87068125-1595-4d39-a367-ff420b9be9d1": {
    website: "https://cathedralofpraisemanila.com.ph/",
    location: "Manila",
    country: "Philippines",
  },
  "b46ea7d8-812a-43ad-bff5-bb61ba92831b": {
    website: "http://eebh.org/es/",
    location: "Barcelona",
    country: "Spain",
  },
  "cec47ba5-19f0-492f-a915-fc3692dc1e87": {
    website: "https://gracechurch.se/",
    contactEmail: "hej@gracechurch.se",
    location: "Stockholm",
    country: "Sweden",
  },
  "7779adb5-68e9-4d30-9c30-c530797cfe51": {
    website: "https://www.kingschurchbirmingham.org/",
    contactEmail: "hello@kingschurchbirmingham.org",
    location: "Birmingham",
    country: "United Kingdom",
  },
  "e1bb3f1c-af27-48cd-9c03-213d23b2deaf": {
    website: "https://christchapel.org.ng/about-christ-chapel/ccic-worship-centers/",
    contactEmail: "info@christchapel.org.ng",
    country: "Nigeria",
  },
  "7cf92429-5388-4504-8006-4abf746932f7": {
    website: "https://churchofchristlekki.org/",
    contactEmail: "coclekki@yahoo.com",
    location: "Lekki, Lagos",
    country: "Nigeria",
  },
  "de56b0e9-604b-447c-ab9f-d34a0cef8551": {
    website: "https://cks.se/en/",
    location: "Stockholm",
    country: "Sweden",
  },
  "4e3b4e3c-0cb5-4b24-9e75-6f51172617a4": {
    website: "https://gccp.org.ph/",
    contactEmail: "info@gccp.org.ph",
    location: "Quezon City",
    country: "Philippines",
  },
  "2d3d51cb-5c68-4d8c-822c-4163df93f5b1": {
    website: "https://citychurchlagos.com/",
    contactEmail: "info@citychurchlagos.com",
    location: "Lekki, Lagos",
    country: "Nigeria",
  },
  "1cbd8676-a59c-4d88-ae7b-3647adcff85f": {
    website: "https://stpaulsjq.church/",
    contactEmail: "enquiries@stpaulsjq.church",
    location: "Birmingham",
    country: "United Kingdom",
  },
  "04354420-0c96-41af-9186-ab73be42d698": {
    website: "https://www.americanchurchberlin.de/",
    contactEmail: "office@americanchurchberlin.de",
    location: "Berlin",
    country: "Germany",
  },
  "b2b2e8c5-b211-4f1e-aae8-0fcc9c5cab4c": {
    website: "https://awakeningberlin.de/",
    contactEmail: "info@awakeningber.de",
    location: "Berlin",
    country: "Germany",
  },
  "269089b6-eb4f-4b2b-99b1-23d668c16405": {
    website: "https://www.birminghamvineyard.com/",
    location: "Birmingham",
    country: "United Kingdom",
  },
  "1196ab87-cf4b-4c8e-bc0a-337d372c573c": {
    website: "https://elimkirche.de/",
    location: "Hamburg",
    country: "Germany",
  },
  "dc0c8b65-e7f4-48b8-b758-7e4cda5ffd91": {
    website: "https://centro.nu/",
    location: "Göteborg",
    country: "Sweden",
  },
  "a73f7898-3f98-4162-ac12-90a84d1db97f": {
    website: "https://malmopingst.se/",
    contactEmail: "info@malmopingst.se",
    location: "Malmö",
    country: "Sweden",
  },
  "42bc8861-6d2e-4b6d-89fe-2b6da956b8bc": {
    website: "https://www.stbrides.com/",
    contactEmail: "stb@stbrides.com",
    location: "London",
    country: "United Kingdom",
  },
  "b277b4dd-bd26-460f-8d99-efacc344607e": {
    website: "https://www.stockholmanglicans.se/",
    contactEmail: "chaplain@stockholmanglicans.se",
    location: "Stockholm",
    country: "Sweden",
  },
  "15ed4849-388c-428d-83ea-2e7ccbcfe498": {
    website: "https://unionchurch.ph/",
    location: "Manila",
    country: "Philippines",
  },
  "eba3ac43-c4f3-4c23-9132-73d5775edc46": {
    website: "https://www.immanuel.se/en/",
    contactEmail: "info@immanuelskyrkan.se",
    location: "Stockholm",
    country: "Sweden",
  },
  "bb9bb677-570c-4dec-9b6f-0434c68e5679": {
    website: "https://hillsong.se/",
    contactEmail: "info@hillsong.se",
    location: "Stockholm & Göteborg",
    country: "Sweden",
  },
};

function getHostname(url = "") {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function isBlockedHost(hostname) {
  return OFFICIAL_HOST_BLOCKLIST.some((entry) => hostname.includes(entry));
}

function normalizeEmail(email = "") {
  return email.trim().toLowerCase().replace(/^u003e/, "");
}

function isValidOfficialEmail(email = "", hostname = "") {
  if (!email) return false;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return false;
  if (EMAIL_IGNORE.some((entry) => email.includes(entry))) return false;
  if (!hostname) return true;

  const normalizedHost = hostname.replace(/^www\./, "");
  const domain = email.split("@")[1]?.replace(/^www\./, "");

  return Boolean(domain) && domain === normalizedHost;
}

function pickEmail(row, website) {
  const host = getHostname(website);
  const candidates = String(row.website_emails || "")
    .split("|")
    .map((entry) => normalizeEmail(entry))
    .filter(Boolean)
    .filter((email) => isValidOfficialEmail(email, host));

  if (candidates.length === 0) return "";
  candidates.sort((left, right) => {
    const leftPreferred = /^(info|hello|contact|office|worship|music)@/.test(left) ? 1 : 0;
    const rightPreferred = /^(info|hello|contact|office|worship|music)@/.test(right) ? 1 : 0;
    return rightPreferred - leftPreferred;
  });
  return candidates[0] || "";
}

function getSafeWebsite(row) {
  const candidates = [row.website, row.website_final_url, row.resolved_website].filter(Boolean);

  for (const candidate of candidates) {
    const host = getHostname(candidate);
    if (!host || isBlockedHost(host)) continue;
    return candidate;
  }

  return "";
}

function loadScreeningById() {
  const rows = JSON.parse(readFileSync(SCREENING_PATH, "utf8"));
  return new Map(rows.map((row) => [row.id, row]));
}

async function main() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
    throw new Error("Missing Supabase environment variables");
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const screeningById = loadScreeningById();
  const candidateIds = Object.keys(CURATED_UPDATES);

  const { data: candidates, error: fetchError } = await supabase
    .from("church_candidates")
    .select("id,name,website,contact_email,location,country,status")
    .in("id", candidateIds);

  if (fetchError) {
    throw fetchError;
  }

  const updates = [];

  for (const candidate of candidates || []) {
    const screening = screeningById.get(candidate.id) || {};
    const curated = CURATED_UPDATES[candidate.id];
    const safeWebsite = curated.website || getSafeWebsite(screening);
    const safeEmail = curated.contactEmail || pickEmail(screening, safeWebsite);

    const patch = {};

    if (safeWebsite && candidate.website !== safeWebsite) {
      patch.website = safeWebsite;
    }

    if (safeEmail && candidate.contact_email !== safeEmail) {
      patch.contact_email = safeEmail;
    }

    if (curated.location && candidate.location !== curated.location) {
      patch.location = curated.location;
    }

    if (curated.country && candidate.country !== curated.country) {
      patch.country = curated.country;
    }

    if (Object.keys(patch).length === 0) {
      continue;
    }

    updates.push({
      id: candidate.id,
      name: candidate.name,
      patch,
    });
  }

  for (const entry of updates) {
    const { error } = await supabase
      .from("church_candidates")
      .update(entry.patch)
      .eq("id", entry.id);

    if (error) {
      throw error;
    }

    console.log(`Updated ${entry.name}: ${JSON.stringify(entry.patch)}`);
  }

  console.log(`Done. Updated ${updates.length} candidates.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
