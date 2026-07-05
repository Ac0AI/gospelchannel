#!/usr/bin/env node

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { loadLocalEnv } from "./lib/local-env.mjs";
import { toSiteRoot } from "./lib/church-intake-utils.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, "..");
const CURATED_AT = "2026-03-27T00:00:00.000Z";

const dryRun = process.argv.includes("--dry-run");

const CURATED_ENTRIES = [
  {
    slug: "copenhagen-vineyard",
    church: {
      name: "Copenhagen Vineyard",
      description:
        "Copenhagen Vineyard is a Vineyard church in central Copenhagen serving both local and international attenders with Sunday gatherings, ministry teams, and city-focused church life.",
      country: "Denmark",
      location: "Copenhagen",
      denomination: "Vineyard",
      website: toSiteRoot("https://kbhvineyard.dk/en/kontakt/"),
      email: "admin@vineyard.dk",
      language: "English",
      source_kind: "discovered",
      status: "pending",
      confidence: 0.84,
      reason:
        "Manual curated Europe shortlist (2026-03-27): urban Vineyard church with visible admin contact, resource signals, and likely website improvement upside.",
      discovery_source: "google-search",
      discovered_at: CURATED_AT,
    },
    enrichment: {
      phone: "+45 60 10 10 65",
      contact_email: "admin@vineyard.dk",
      website_url: toSiteRoot("https://kbhvineyard.dk/en/kontakt/"),
      denomination_network: "Vineyard",
      languages: ["Danish", "English"],
      children_ministry: true,
      youth_ministry: true,
      church_size: "medium",
      summary:
        "Copenhagen Vineyard is a city church in the Copenhagen area with Sunday gatherings, administration, children and youth ministry, and an international-facing contact flow.",
      enrichment_status: "complete",
      confidence: 0.82,
      manualResearch: {
        outreach_priority: "A",
        fit_notes:
          "Strong fit for website outreach because it is urban, not obviously megachurch-scale, and has enough visible structure to justify budget.",
        resource_signals: [
          "central metro location",
          "visible administration",
          "children and youth ministry",
          "international-facing content",
        ],
        outreach_angle:
          "Pitch a clearer multilingual front door and stronger newcomer and volunteer journeys.",
      },
    },
  },
  {
    slug: "brussel-vineyard",
    church: {
      email: "info@vineyard-brussels.be",
      denomination: "Vineyard",
      website: toSiteRoot("https://www.vineyard-brussels.be/contact-us"),
    },
    enrichment: {
      phone: "+32 2 734 9444",
      contact_email: "info@vineyard-brussels.be",
      website_url: toSiteRoot("https://www.vineyard-brussels.be/contact-us"),
      denomination_network: "Vineyard Benelux",
      languages: ["English"],
      church_size: "medium",
      summary:
        "Vineyard Brussels is an international city church in Belgium with two services, visible office contact, and ongoing expansion signals around a new creative center project.",
      enrichment_status: "complete",
      confidence: 0.84,
      manualResearch: {
        outreach_priority: "A",
        fit_notes:
          "Good fit because it has multilingual city-church complexity and clear resource signals without reading as a megachurch.",
        resource_signals: [
          "two Sunday services",
          "office contact",
          "building project / creative center",
          "international congregation",
        ],
        outreach_angle:
          "Pitch campaign pages, donor storytelling, and multilingual first-visit flows.",
      },
    },
  },
  {
    slug: "highway-vineyard",
    church: {
      name: "Highway Vineyard",
      description:
        "Highway Vineyard is a Vineyard church serving East London from Stratford and Manor Park with Sunday services, compassion ministries, kids and youth, and an active community presence.",
      country: "United Kingdom",
      location: "London",
      denomination: "Vineyard",
      website: toSiteRoot("https://www.highwayvineyard.org/"),
      email: "hello@highwayvineyard.org",
      language: "English",
      source_kind: "discovered",
      status: "pending",
      confidence: 0.88,
      reason:
        "Manual curated Europe shortlist (2026-03-27): multi-site urban Vineyard church with visible contact details and strong signs of operational complexity.",
      discovery_source: "google-search",
      discovered_at: CURATED_AT,
    },
    enrichment: {
      phone: "+44 20 8534 4019",
      contact_email: "hello@highwayvineyard.org",
      website_url: toSiteRoot("https://www.highwayvineyard.org/"),
      denomination_network: "Vineyard Churches UK & Ireland",
      languages: ["English"],
      children_ministry: true,
      youth_ministry: true,
      church_size: "medium",
      summary:
        "Highway Vineyard is a multicultural East London church with two sites, visible compassion ministries, kids and youth activity, online giving, and clear office contact details.",
      enrichment_status: "complete",
      confidence: 0.87,
      manualResearch: {
        outreach_priority: "A",
        fit_notes:
          "Very strong website-services target because the church shows budget, operational breadth, and a real need for clearer multi-site communication.",
        resource_signals: [
          "two physical sites",
          "office phone and email",
          "kids and youth ministry",
          "compassion programs",
          "giving flow",
        ],
        outreach_angle:
          "Pitch cleaner information architecture for multi-site, compassion, giving, and first-visit conversion.",
      },
    },
  },
  {
    slug: "citychurch-international",
    church: {
      name: "CityChurch International",
      description:
        "CityChurch International is an English-speaking charismatic church in Bratislava serving locals and internationals with Sunday worship, teaching, and community life.",
      country: "Slovakia",
      location: "Bratislava",
      denomination: "Charismatic",
      website: toSiteRoot("https://www.cci.sk/"),
      email: "info@cci.sk",
      language: "English",
      source_kind: "discovered",
      status: "pending",
      confidence: 0.82,
      reason:
        "Manual curated Europe shortlist (2026-03-27): English-speaking capital-city church with simple web stack and clear outreach fit.",
      discovery_source: "google-search",
      discovered_at: CURATED_AT,
    },
    enrichment: {
      phone: "+421 910 721 051",
      contact_email: "info@cci.sk",
      website_url: toSiteRoot("https://www.cci.sk/"),
      denomination_network: "Apoštolská cirkev na Slovensku",
      languages: ["English"],
      church_size: "medium",
      summary:
        "CityChurch International is an English-speaking church in Bratislava with a central meeting location, a second linked location in Pezinok, and a simple public-facing website.",
      enrichment_status: "complete",
      confidence: 0.8,
      manualResearch: {
        outreach_priority: "A",
        fit_notes:
          "Good outreach target because the church is international, city-based, contactable, and likely to value stronger English-language presentation.",
        resource_signals: [
          "capital-city location",
          "English-speaking community",
          "two linked locations",
          "public giving and sermons",
        ],
        outreach_angle:
          "Pitch an upgraded English-language website focused on newcomers, events, and belonging.",
      },
    },
  },
  {
    slug: "tampereen-helluntaiseurakunta",
    church: {},
    enrichment: {
      manualResearch: {
        outreach_priority: "A",
        fit_notes:
          "Strong fit because the church has multiple pastors, campus structure, media responsibility, and a central city presence without obvious megachurch scale.",
        resource_signals: [
          "multiple named pastors",
          "campus pastor",
          "media pastor",
          "office hours",
          "city-center address",
        ],
        outreach_angle:
          "Pitch clearer ministry navigation, staff access, and better public next-step journeys.",
      },
    },
  },
  {
    slug: "turun-helluntaiseurakunta",
    church: {
      name: "Turun Helluntaiseurakunta",
      description:
        "Turun Helluntaiseurakunta is a Pentecostal church in central Turku with regular worship, prayer, and ministry life for the city.",
      country: "Finland",
      location: "Turku",
      denomination: "Pentecostal",
      website: toSiteRoot("https://turunhelluntaisrk.fi/"),
      email: "toimisto@turunhelluntaisrk.fi",
      language: "Finnish",
      source_kind: "discovered",
      status: "pending",
      confidence: 0.79,
      reason:
        "Manual curated Europe shortlist (2026-03-27): medium-city Pentecostal church with clear office contact and likely room for website improvement.",
      discovery_source: "google-search",
      discovered_at: CURATED_AT,
    },
    enrichment: {
      phone: "+358 41 536 3645",
      contact_email: "toimisto@turunhelluntaisrk.fi",
      website_url: toSiteRoot("https://turunhelluntaisrk.fi/"),
      denomination_network: "Suomen Helluntaikirkko",
      languages: ["Finnish"],
      church_size: "medium",
      summary:
        "Turun Helluntaiseurakunta is a Pentecostal city church in Turku with direct office contact details and a central address, making it a solid regional outreach target.",
      enrichment_status: "complete",
      confidence: 0.79,
      manualResearch: {
        outreach_priority: "A",
        fit_notes:
          "Good medium-city fit with clear office access and enough organizational structure to justify website investment.",
        resource_signals: [
          "central city address",
          "direct office phone",
          "direct office email",
          "official Pentecostal profile",
        ],
        outreach_angle:
          "Pitch a stronger city-facing website that improves trust and contact conversion.",
      },
    },
  },
  {
    slug: "lifecenter-church-vasteras",
    church: {
      name: "Lifecenter Church Västerås",
      description:
        "Lifecenter Church Västerås is a Pentecostal-charismatic church and one of the main campuses in the multi-city Lifecenter network in Sweden.",
      country: "Sweden",
      location: "Västerås",
      denomination: "Pentecostal",
      website: toSiteRoot("https://www.lifecenter.se/"),
      email: "info@lifecenter.se",
      language: "Swedish",
      source_kind: "discovered",
      status: "pending",
      confidence: 0.78,
      reason:
        "Manual curated Europe shortlist (2026-03-27): multi-campus Swedish church with visible resourcing and strong but not fully optimized web complexity.",
      discovery_source: "google-search",
      discovered_at: CURATED_AT,
    },
    enrichment: {
      contact_email: "info@lifecenter.se",
      website_url: toSiteRoot("https://www.lifecenter.se/"),
      denomination_network: "Pingst",
      languages: ["Swedish", "English"],
      children_ministry: true,
      youth_ministry: true,
      church_size: "large",
      summary:
        "Lifecenter Church Västerås is part of a three-campus Swedish church network with giving, newsletter capture, children and youth ministry, second hand, and preschool activity.",
      enrichment_status: "complete",
      confidence: 0.81,
      manualResearch: {
        outreach_priority: "B",
        fit_notes:
          "Resource-rich and clearly organized, but somewhat more digitally mature than the best targets.",
        resource_signals: [
          "three campuses",
          "giving flow",
          "newsletter signup",
          "kids and youth ministry",
          "preschool and second hand",
        ],
        outreach_angle:
          "Pitch campaign-specific improvements and conversion work rather than a full rebuild.",
      },
    },
  },
  {
    slug: "stockholm-community",
    church: {},
    enrichment: {
      manualResearch: {
        outreach_priority: "B",
        fit_notes:
          "Capital-city fit with international appeal, but already reasonably functional digitally.",
        resource_signals: [
          "international profile",
          "recurring giving",
          "conference registrations",
          "team and events pages",
        ],
        outreach_angle:
          "Pitch event funnels, donor pages, and first-visit conversion optimization.",
      },
    },
  },
  {
    slug: "sos-church",
    church: {},
    enrichment: {
      phone: "+46 70 286 36 92",
      manualResearch: {
        outreach_priority: "B",
        fit_notes:
          "Good urban charismatic fit, but already active digitally and therefore less urgent than the top tier.",
        resource_signals: [
          "multiple languages",
          "multiple gatherings",
          "downtown location",
          "missions and ministry breadth",
        ],
        outreach_angle:
          "Pitch localization, supporter journeys, and growth landing pages rather than a full rebuild.",
      },
    },
  },
  {
    slug: "south-west-london-vineyard",
    church: {
      name: "South West London Vineyard",
      description:
        "South West London Vineyard is a Vineyard church in London with Sunday services, kids and youth ministry, community programs, and a well-established local presence.",
      country: "United Kingdom",
      location: "London",
      denomination: "Vineyard",
      website: toSiteRoot("https://swlv.org.uk/contact/"),
      email: "mail@swlv.org.uk",
      language: "English",
      source_kind: "discovered",
      status: "pending",
      confidence: 0.73,
      reason:
        "Manual curated Europe shortlist (2026-03-27): established London Vineyard church with visible office contact, but likely lower urgency than the top targets.",
      discovery_source: "google-search",
      discovered_at: CURATED_AT,
    },
    enrichment: {
      phone: "+44 20 8785 9530",
      contact_email: "mail@swlv.org.uk",
      website_url: toSiteRoot("https://swlv.org.uk/contact/"),
      denomination_network: "Vineyard Churches UK & Ireland",
      languages: ["English"],
      children_ministry: true,
      youth_ministry: true,
      church_size: "large",
      summary:
        "South West London Vineyard is a well-established London church with clear office contact, community ministries, ChurchSuite flows, and visible public governance materials.",
      enrichment_status: "complete",
      confidence: 0.74,
      manualResearch: {
        outreach_priority: "C",
        fit_notes:
          "Still a fit by size and city, but likely less urgent because the church already looks operationally mature.",
        resource_signals: [
          "office contact",
          "community programs",
          "impact reporting",
          "ChurchSuite usage",
        ],
        outreach_angle:
          "Only pitch measurable conversion or campaign work, not generic redesign language.",
      },
    },
  },
  {
    slug: "evangelische-freie-gemeinde-frankfurt-am-main",
    church: {
      description:
        "Freie Christengemeinde Frankfurt am Main is an evangelical free church in Frankfurt Nordend with multiple Sunday services, kids and youth ministry, connect groups, and a visible office contact.",
      location: "Frankfurt",
      website: toSiteRoot("https://fcg-frankfurt.de/en/new-here/"),
      email: "kontakt@fcg-frankfurt.de",
      language: "German",
    },
    enrichment: {
      phone: "+49 69 550 157",
      contact_email: "kontakt@fcg-frankfurt.de",
      website_url: toSiteRoot("https://fcg-frankfurt.de/en/new-here/"),
      denomination_network: "Bund Freier evangelischer Gemeinden",
      languages: ["German", "English"],
      children_ministry: true,
      youth_ministry: true,
      church_size: "medium",
      summary:
        "FCG Frankfurt is a central evangelical free church with 10:00 and 12:00 Sunday services, kids and youth tracks, connect groups, discipleship pathways, translation, and visible office hours.",
      enrichment_status: "complete",
      confidence: 0.88,
      manualResearch: {
        outreach_priority: "A",
        fit_notes:
          "Strong Frankfurt target because it has clear resourcing, multiple services, structured ministry pathways, and visible contact routes without megachurch optics.",
        resource_signals: [
          "two Sunday services",
          "kids and youth ministry",
          "connect groups",
          "discipleship track",
          "ChurchTools / internal portal",
          "newsletter and donations",
        ],
        outreach_angle:
          "Pitch clearer newcomer paths, multilingual landing pages, and conversion-focused ministry navigation.",
      },
    },
  },
  {
    slug: "church-of-pentecost-portugal-lisbon-piwc",
    church: {
      name: "Church of Pentecost Portugal Lisbon PIWC",
      description:
        "Church of Pentecost Portugal Lisbon PIWC is a Pentecostal congregation in Lisbon serving English- and Portuguese-speaking attenders with regular worship, prayer, Bible study, and family ministry.",
      country: "Portugal",
      location: "Lisbon",
      denomination: "Pentecostal",
      website: toSiteRoot("https://thecopportugal.org/contact-us/"),
      email: "cop_portugal@yahoo.com",
      language: "English",
      source_kind: "discovered",
      status: "pending",
      confidence: 0.81,
      reason:
        "Manual curated Europe shortlist (2026-03-27): Lisbon Pentecostal lead with clear public contact details, multilingual profile, and visible ministry structure.",
      discovery_source: "google-search",
      discovered_at: CURATED_AT,
    },
    enrichment: {
      phone: "+351 920 328 362",
      contact_email: "cop_portugal@yahoo.com",
      website_url: toSiteRoot("https://thecopportugal.org/contact-us/"),
      denomination_network: "Church of Pentecost Worldwide",
      languages: ["English", "Portuguese"],
      children_ministry: true,
      youth_ministry: true,
      church_size: "medium",
      summary:
        "The Lisbon PIWC of Church of Pentecost Portugal presents itself as a multi-ethnic English and Portuguese congregation with children's ministry, conventions, multiple weekly meetings, and a wider Portugal church structure.",
      enrichment_status: "complete",
      confidence: 0.82,
      manualResearch: {
        outreach_priority: "A",
        fit_notes:
          "Very good Lisbon prospect because the church is multilingual, organizationally real, and outward-facing while still using a relatively simple site.",
        resource_signals: [
          "English and Portuguese worship",
          "children's ministry",
          "national church structure",
          "retreats and conventions",
          "multiple weekly meetings",
        ],
        outreach_angle:
          "Pitch multilingual navigation, location-specific pages, and stronger event and newcomer journeys.",
      },
    },
  },
  {
    slug: "terceira-igreja-evangelica-baptista-de-lisboa",
    church: {
      name: "Terceira Igreja Evangélica Baptista de Lisboa",
      description:
        "Terceira Igreja Evangélica Baptista de Lisboa is an evangelical Baptist church in Lisbon with public services, ministry teams, online sermons, and live English translation for visitors.",
      country: "Portugal",
      location: "Lisbon",
      denomination: "Baptist",
      website: toSiteRoot("https://terceiraigreja.pt/contactos/"),
      email: "info@terceiraigreja.pt",
      language: "Portuguese",
      source_kind: "discovered",
      status: "pending",
      confidence: 0.84,
      reason:
        "Manual curated Europe shortlist (2026-03-27): resourceful Lisbon evangelical church with direct contact info and clear international-access signal.",
      discovery_source: "google-search",
      discovered_at: CURATED_AT,
    },
    enrichment: {
      phone: "+351 931 190 282",
      contact_email: "info@terceiraigreja.pt",
      website_url: toSiteRoot("https://terceiraigreja.pt/contactos/"),
      denomination_network: "Baptist",
      languages: ["Portuguese", "English"],
      church_size: "medium",
      summary:
        "Terceira Igreja Evangélica Baptista de Lisboa shows named leaders, ministry pages, public giving details, live English translation, and active sermons and activities on its website.",
      enrichment_status: "complete",
      confidence: 0.84,
      manualResearch: {
        outreach_priority: "A",
        fit_notes:
          "Strong evangelical city-church fit because it has clear contactability, visible ministries, and an international-access need via English translation.",
        resource_signals: [
          "live English translation",
          "named leaders",
          "ministry structure",
          "online sermons",
          "public giving details",
        ],
        outreach_angle:
          "Pitch bilingual first-visit flows, ministry discovery, and clearer event and giving UX.",
      },
    },
  },
  {
    slug: "river-church-frankfurt",
    church: {
      name: "River Church Frankfurt",
      description:
        "River Church Frankfurt is a spirit-filled bilingual church in Frankfurt-Rodelheim serving locals and internationals with English and German worship and children's ministry.",
      country: "Germany",
      location: "Frankfurt",
      denomination: "Charismatic",
      website: toSiteRoot("https://riverfrankfurt.com/de/church-in-frankfurt/"),
      email: "info@riverfrankfurt.com",
      language: "English",
      source_kind: "discovered",
      status: "pending",
      confidence: 0.83,
      reason:
        "Manual curated Europe shortlist (2026-03-27): multilingual Frankfurt charismatic church with strong growth signals and clear contact email.",
      discovery_source: "google-search",
      discovered_at: CURATED_AT,
    },
    enrichment: {
      contact_email: "info@riverfrankfurt.com",
      website_url: toSiteRoot("https://riverfrankfurt.com/de/church-in-frankfurt/"),
      languages: ["English", "German"],
      children_ministry: true,
      church_size: "medium",
      summary:
        "River Church Frankfurt describes itself as a spirit-filled bilingual church, meeting weekly at 11:00 with live English-German translation, children's ministry, and a recent move to a larger Frankfurt-Rodelheim location.",
      enrichment_status: "complete",
      confidence: 0.83,
      manualResearch: {
        outreach_priority: "A",
        fit_notes:
          "High-potential target because it is international, visibly growing, and contactable, while the current web presentation still feels operational rather than polished.",
        resource_signals: [
          "bilingual Sunday service",
          "children's program",
          "recent relocation due to growth",
          "international congregation",
          "clear contact email",
        ],
        outreach_angle:
          "Pitch newcomer conversion, bilingual service explanation, and family-focused first-visit UX.",
      },
    },
  },
  {
    slug: "church-of-pentecost-frankfurt-piwc",
    church: {
      name: "Church of Pentecost Frankfurt PIWC",
      description:
        "Church of Pentecost Frankfurt PIWC is a Pentecostal congregation in Frankfurt listed under the Frankfurt District of Church of Pentecost Germany.",
      country: "Germany",
      location: "Frankfurt",
      denomination: "Pentecostal",
      website: "https://thecopgermany.org/frankfurt-district/",
      language: "English",
      source_kind: "discovered",
      status: "pending",
      confidence: 0.74,
      reason:
        "Manual curated Europe shortlist (2026-03-27): Frankfurt Pentecostal lead with clear district-level contact and visible assembly structure.",
      discovery_source: "google-search",
      discovered_at: CURATED_AT,
    },
    enrichment: {
      phone: "+49 151 42678141",
      website_url: "https://thecopgermany.org/frankfurt-district/",
      denomination_network: "Church of Pentecost Germany",
      languages: ["English", "German"],
      church_size: "medium",
      summary:
        "The Frankfurt District page for Church of Pentecost Germany lists both Frankfurt Assembly and Frankfurt PIWC at Thomas-Mann-Strasse 10 with district-level phone contacts and a broader multi-assembly structure.",
      enrichment_status: "complete",
      confidence: 0.75,
      manualResearch: {
        outreach_priority: "B",
        fit_notes:
          "Useful Frankfurt addition because the ministry is structured and contactable, though the public web presence is organized at district level rather than as a standalone local site.",
        resource_signals: [
          "district structure",
          "Frankfurt PIWC listing",
          "district minister contact",
          "multiple assemblies in region",
          "visible address in Frankfurt",
        ],
        outreach_angle:
          "Pitch localized Frankfurt PIWC pages and clearer local visitor-facing navigation within the district site.",
      },
    },
  },
  {
    slug: "agape-christian-church-amsterdam",
    church: {
      name: "Agape Christian Church Amsterdam",
      description:
        "Agape Christian Church Amsterdam is a Pentecostal-charismatic church in Amsterdam with Sunday worship, Friday prayer, online prayer gatherings, and a multicity evangelistic vision.",
      country: "Netherlands",
      location: "Amsterdam",
      denomination: "Pentecostal",
      website: toSiteRoot("https://www.agapecca.com/"),
      email: "info@agapecca.com",
      language: "English",
      source_kind: "discovered",
      status: "pending",
      confidence: 0.84,
      reason:
        "Manual curated Europe shortlist (2026-03-27): Amsterdam Pentecostal-charismatic lead with direct contact info and visible ministry consistency.",
      discovery_source: "google-search",
      discovered_at: CURATED_AT,
    },
    enrichment: {
      phone: "+31 20 341 9609",
      contact_email: "info@agapecca.com",
      website_url: toSiteRoot("https://www.agapecca.com/"),
      languages: ["English"],
      church_size: "medium",
      summary:
        "Agape Christian Church Amsterdam publicly shares Sunday and Friday gatherings, multiple phone numbers, financial reports, and a clearly stated Pentecostal-charismatic identity for Amsterdam.",
      enrichment_status: "complete",
      confidence: 0.84,
      manualResearch: {
        outreach_priority: "A",
        fit_notes:
          "Good Amsterdam target because it appears operationally established, has direct email and phones, and still has room for stronger digital positioning.",
        resource_signals: [
          "financial reports page",
          "multiple public phone numbers",
          "Friday prayer service",
          "regular Facebook Live activity",
          "registered church since 2010",
        ],
        outreach_angle:
          "Pitch a clearer public front door for visitors, prayer requests, and recurring digital engagement.",
      },
    },
  },
  {
    slug: "rccg-jesus-house-amsterdam",
    church: {
      name: "RCCG Jesus House Amsterdam",
      description:
        "RCCG Jesus House Amsterdam is a Pentecostal church in Amsterdam with Sunday worship, weekday prayer rhythms, children's church, and public contact and reporting pages.",
      country: "Netherlands",
      location: "Amsterdam",
      denomination: "Pentecostal",
      website: toSiteRoot("https://rccgamsterdam.org/contact/"),
      email: "info@rccgamsterdam.org",
      language: "English",
      source_kind: "discovered",
      status: "pending",
      confidence: 0.82,
      reason:
        "Manual curated Europe shortlist (2026-03-27): established Amsterdam Pentecostal lead with finance/reporting pages and clear church-office contact.",
      discovery_source: "google-search",
      discovered_at: CURATED_AT,
    },
    enrichment: {
      phone: "+31 20 364 2410",
      contact_email: "info@rccgamsterdam.org",
      website_url: toSiteRoot("https://rccgamsterdam.org/contact/"),
      denomination_network: "RCCG",
      languages: ["English"],
      children_ministry: true,
      church_size: "medium",
      summary:
        "RCCG Jesus House Amsterdam publicizes children's church, online prayer meetings, monthly Holy Ghost Night, financial reports, and multiple contact routes for Amsterdam visitors.",
      enrichment_status: "complete",
      confidence: 0.83,
      manualResearch: {
        outreach_priority: "A",
        fit_notes:
          "Strong fit because the church shows structure, recurring programs, and public accountability pages, but the site still looks like it could benefit from sharper UX.",
        resource_signals: [
          "children's church",
          "financial report page",
          "online prayer schedule",
          "multiple weekly programs",
          "visible contact email and phone",
        ],
        outreach_angle:
          "Pitch clearer ministry funnels, online prayer onboarding, and more trust-building newcomer pages.",
      },
    },
  },
  {
    slug: "icf-praha",
    church: {
      name: "ICF Praha",
      description:
        "ICF Praha is a modern charismatic church in Prague with celebrations, kids and youth ministries, projects in the city, and a strong next-step culture.",
      country: "Czech Republic",
      location: "Prague",
      denomination: "Charismatic",
      website: toSiteRoot("https://www.icf-praha.cz/kontakt/"),
      email: "office@icf-praha.cz",
      language: "Czech",
      source_kind: "discovered",
      status: "pending",
      confidence: 0.82,
      reason:
        "Manual curated Europe shortlist (2026-03-27): Prague charismatic lead with clear ministries, projects, and contact email.",
      discovery_source: "google-search",
      discovered_at: CURATED_AT,
    },
    enrichment: {
      contact_email: "office@icf-praha.cz",
      website_url: toSiteRoot("https://www.icf-praha.cz/kontakt/"),
      denomination_network: "ICF Movement",
      languages: ["Czech", "English"],
      children_ministry: true,
      youth_ministry: true,
      church_size: "medium",
      summary:
        "ICF Praha runs celebrations, ICF Kids, youth tracks, city reach projects, newsletters, and donation flows while presenting a contemporary church identity in Prague.",
      enrichment_status: "complete",
      confidence: 0.82,
      manualResearch: {
        outreach_priority: "A",
        fit_notes:
          "High-potential Prague target because it is clearly organized and growing, but still benefits from clearer English-language and ministry-path presentation.",
        resource_signals: [
          "kids and youth ministries",
          "reach projects",
          "newsletter",
          "donation flow",
          "multiple next-step programs",
        ],
        outreach_angle:
          "Pitch clearer multilingual journeys for newcomers, families, and volunteers.",
      },
    },
  },
  {
    slug: "pentecostal-fellowship-prague",
    church: {
      name: "Pentecostal Fellowship Prague",
      description:
        "Pentecostal Fellowship Prague is an international Pentecostal church in Prague-Karlin with Czech services, English translation, Bible school, and small-group rhythms.",
      country: "Czech Republic",
      location: "Prague",
      denomination: "Pentecostal",
      website: toSiteRoot("https://letnicni.cz/en/"),
      email: "info@letnicni.cz",
      language: "English",
      source_kind: "discovered",
      status: "pending",
      confidence: 0.8,
      reason:
        "Manual curated Europe shortlist (2026-03-27): Prague Pentecostal lead with international profile, direct contact info, and visible program depth.",
      discovery_source: "google-search",
      discovered_at: CURATED_AT,
    },
    enrichment: {
      phone: "+420 737 779 010",
      contact_email: "info@letnicni.cz",
      website_url: toSiteRoot("https://letnicni.cz/en/"),
      languages: ["Czech", "English"],
      church_size: "medium",
      summary:
        "Pentecostal Fellowship Prague describes itself as an international Christian center with English translation, Bible school, annual conference activity, and home-group rhythms in Prague 8.",
      enrichment_status: "complete",
      confidence: 0.81,
      manualResearch: {
        outreach_priority: "A",
        fit_notes:
          "Good Prague fit because the church is international, clearly contactable, and has enough program depth to justify web investment.",
        resource_signals: [
          "English translation",
          "Bible school",
          "annual conference",
          "home groups",
          "international / Filipino service",
        ],
        outreach_angle:
          "Pitch stronger multilingual onboarding and clearer event and community navigation.",
      },
    },
  },
  {
    slug: "international-baptist-church-cologne",
    church: {
      name: "International Baptist Church Cologne",
      description:
        "International Baptist Church Cologne is an English-speaking Baptist church in Cologne with Sunday worship, life groups, discipleship, and a visible leadership structure.",
      country: "Germany",
      location: "Cologne",
      denomination: "Baptist",
      website: toSiteRoot("https://www.ibc-cologne.com/"),
      email: "admin@ibc-cologne.com",
      language: "English",
      source_kind: "discovered",
      status: "pending",
      confidence: 0.82,
      reason:
        "Manual curated Europe shortlist (2026-03-27): Cologne evangelical lead with clear visitor info, governance signals, and an international English-speaking audience.",
      discovery_source: "google-search",
      discovered_at: CURATED_AT,
    },
    enrichment: {
      contact_email: "admin@ibc-cologne.com",
      website_url: toSiteRoot("https://www.ibc-cologne.com/"),
      denomination_network: "Baptist",
      languages: ["English"],
      children_ministry: true,
      church_size: "medium",
      summary:
        "IBC Cologne publishes Sunday service details, children's fellowship, life groups, leadership roles, constitutional governance, and a visible discipleship framework for its English-speaking congregation.",
      enrichment_status: "complete",
      confidence: 0.83,
      manualResearch: {
        outreach_priority: "A",
        fit_notes:
          "Strong Cologne target because it serves an international audience, has enough structure and governance to imply budget, and still has pragmatic rather than highly polished web UX.",
        resource_signals: [
          "English-speaking congregation",
          "elders and deacons",
          "children's fellowship",
          "life groups",
          "constitution / budget governance",
        ],
        outreach_angle:
          "Pitch newcomer and life-group flows, trust-building governance pages, and clearer next steps for internationals.",
      },
    },
  },
];

function stripUndefined(value) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));
}

function mergeDefined(base, patch) {
  const output = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) {
      output[key] = value;
    }
  }
  return output;
}

function buildDefaultChurchRow(slug) {
  return {
    slug,
    name: "",
    description: "",
    country: "",
    location: null,
    denomination: null,
    founded: null,
    website: null,
    email: null,
    language: null,
    logo: null,
    header_image: null,
    header_image_attribution: null,
    spotify_url: null,
    spotify_playlist_ids: [],
    additional_playlists: [],
    spotify_playlists: null,
    music_style: null,
    notable_artists: null,
    youtube_channel_id: null,
    spotify_artist_ids: null,
    youtube_videos: null,
    aliases: null,
    source_kind: "discovered",
    status: "pending",
    candidate_id: null,
    reason: null,
    confidence: 0.7,
    discovery_source: "google-search",
    discovered_at: CURATED_AT,
    spotify_owner_id: null,
    last_researched: CURATED_AT,
    verified_at: null,
  };
}

function buildDefaultEnrichmentRow(slug) {
  return {
    church_slug: slug,
    candidate_id: null,
    street_address: null,
    google_maps_url: null,
    latitude: null,
    longitude: null,
    service_times: null,
    theological_orientation: null,
    denomination_network: null,
    languages: null,
    phone: null,
    contact_email: null,
    website_url: null,
    instagram_url: null,
    facebook_url: null,
    youtube_url: null,
    children_ministry: null,
    youth_ministry: null,
    ministries: null,
    church_size: null,
    seo_description: null,
    summary: null,
    raw_website_markdown: null,
    raw_google_places: null,
    raw_crawled_pages: null,
    sources: {},
    enrichment_status: "pending",
    confidence: 0,
    schema_version: 1,
    last_enriched_at: CURATED_AT,
  };
}

function withMergedManualResearch(existingSources, manualResearch) {
  const base =
    existingSources && typeof existingSources === "object" && !Array.isArray(existingSources)
      ? { ...existingSources }
      : {};

  if (!manualResearch) {
    return base;
  }

  return {
    ...base,
    manual_research: {
      collected_at: CURATED_AT.slice(0, 10),
      basis: "public website review",
      ...manualResearch,
    },
  };
}

function sanitizeChurchRow(row) {
  const cleaned = { ...row };
  delete cleaned.created_at;
  delete cleaned.updated_at;
  return stripUndefined(cleaned);
}

function sanitizeEnrichmentRow(row) {
  const cleaned = { ...row };
  delete cleaned.id;
  delete cleaned.created_at;
  delete cleaned.updated_at;
  return stripUndefined(cleaned);
}

async function loadExistingMaps(supabase, slugs) {
  const [{ data: churches, error: churchError }, { data: enrichments, error: enrichmentError }] = await Promise.all([
    supabase.from("churches").select("*").in("slug", slugs),
    supabase.from("church_enrichments").select("*").in("church_slug", slugs),
  ]);

  if (churchError) throw new Error(`Failed to load churches: ${churchError.message}`);
  if (enrichmentError) throw new Error(`Failed to load enrichments: ${enrichmentError.message}`);

  return {
    churchBySlug: new Map((churches || []).map((row) => [row.slug, row])),
    enrichmentBySlug: new Map((enrichments || []).map((row) => [row.church_slug, row])),
  };
}

async function upsertRows(supabase, table, rows, onConflict) {
  if (rows.length === 0) return;
  const { error } = await supabase.from(table).upsert(rows, { onConflict });
  if (error) {
    throw new Error(`Failed to upsert ${table}: ${error.message}`);
  }
}

async function main() {
  loadLocalEnv(ROOT_DIR);

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY");
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const slugs = CURATED_ENTRIES.map((entry) => entry.slug);
  const { churchBySlug, enrichmentBySlug } = await loadExistingMaps(supabase, slugs);

  const churchRows = CURATED_ENTRIES.map((entry) => {
    const existing = churchBySlug.get(entry.slug);
    const base = existing ? { ...existing } : buildDefaultChurchRow(entry.slug);

    const patch = {
      ...entry.church,
      last_researched: CURATED_AT,
    };

    return sanitizeChurchRow(mergeDefined(base, patch));
  });

  const enrichmentRows = CURATED_ENTRIES.map((entry) => {
    const existing = enrichmentBySlug.get(entry.slug);
    const base = existing ? { ...existing } : buildDefaultEnrichmentRow(entry.slug);
    const manualResearch = entry.enrichment?.manualResearch;
    const enrichmentPatch = {
      ...entry.enrichment,
      sources: withMergedManualResearch(existing?.sources, manualResearch),
      last_enriched_at: CURATED_AT,
    };

    delete enrichmentPatch.manualResearch;

    return sanitizeEnrichmentRow(mergeDefined(base, enrichmentPatch));
  });

  const newChurches = churchRows.filter((row) => !churchBySlug.has(row.slug));
  const updatedChurches = churchRows.filter((row) => churchBySlug.has(row.slug));

  console.log(
    JSON.stringify(
      {
        dryRun,
        church_rows: churchRows.length,
        new_churches: newChurches.map((row) => ({ slug: row.slug, name: row.name, status: row.status })),
        updated_churches: updatedChurches.map((row) => ({ slug: row.slug, name: row.name, status: row.status })),
        enrichment_rows: enrichmentRows.length,
      },
      null,
      2,
    ),
  );

  if (dryRun) {
    console.log("\nDry run: nothing written.");
    return;
  }

  await upsertRows(supabase, "churches", churchRows, "slug");
  await upsertRows(supabase, "church_enrichments", enrichmentRows, "church_slug");

  console.log(`\nImported ${churchRows.length} curated church rows and ${enrichmentRows.length} enrichment rows.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
