#!/usr/bin/env node
/**
 * Classify denominations for churches that don't have one yet.
 * Uses name patterns, descriptions, and manual overrides.
 *
 * Usage: node scripts/classify-denominations.mjs [--dry-run] [--apply]
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CHURCHES_PATH = resolve(__dirname, '../src/data/churches.json');

const churches = JSON.parse(readFileSync(CHURCHES_PATH, 'utf-8'));
const dryRun = !process.argv.includes('--apply');

// ── Name-based pattern rules (order matters: more specific first) ──

const namePatterns = [
  // Specific denominations
  [/\b(assemblies?\s+of\s+god|assembleias?\s+de\s+deus)\b/i, 'Assemblies of God'],
  [/\bvineyard\b/i, 'Vineyard'],
  [/\bsalvation\s+army\b/i, 'Salvation Army'],
  [/\bseventh.day\s+adventist|adventist/i, 'Seventh-day Adventist'],
  [/\borthodox/i, 'Orthodox'],
  [/\bkatolsk|catholic|católic/i, 'Catholic'],
  [/\bmetodist|methodist/i, 'Methodist'],

  // Anglican/Church of England
  [/\banglican|church\s+of\s+england\b/i, 'Anglican'],
  [/\bepiscop/i, 'Anglican'],
  [/\bcathedral\b/i, 'Cathedral'], // Will be refined by context

  // Presbyterian/Reformed
  [/\bpresbyter/i, 'Presbyterian'],
  [/\breform(ed|ée|ierte)|réformé/i, 'Reformed'],
  [/\bevang.*reform|reform.*evang/i, 'Reformed'],

  // Baptist
  [/\bbaptist|batista|baptiste/i, 'Baptist'],

  // Lutheran
  [/\bluther|ev\.\s*-?\s*luth/i, 'Lutheran'],
  [/\bevangelisch-lutheri/i, 'Lutheran'],

  // Pentecostal
  [/\bpentecost|pingst|helluntai|pünkst/i, 'Pentecostal'],
  [/\bapostolic|apostolique|apostolsk/i, 'Pentecostal'],
  [/\bfour\s*square|foursquare/i, 'Pentecostal'],

  // Charismatic
  [/\bcharisma/i, 'Charismatic'],

  // Evangelical (broad)
  [/\bevangeli(cal|que|sche|sk|sch)|évangélique|evangélica|evangélique/i, 'Evangelical'],
  [/\bfreikirche|freie\s+(kirche|gemeinde)|frikyrka|frikirke|fri\s*kirke|vapaaseurakunta|vapaakirk/i, 'Evangelical Free Church'],
  [/\bfrikirk/i, 'Evangelical Free Church'],

  // Church of Christ / Disciples
  [/\bchurch\s+of\s+christ\b/i, 'Church of Christ'],
  [/\bgemeinde\s+christi\b/i, 'Church of Christ'],

  // Salvation Army
  [/\bfrälsningsarmén|heilsarmee/i, 'Salvation Army'],
];

// ── Description-based patterns ──

const descPatterns = [
  [/\bpentecostal\b/i, 'Pentecostal'],
  [/\bcharismatic\b/i, 'Charismatic'],
  [/\bbaptist\b/i, 'Baptist'],
  [/\banglican\b/i, 'Anglican'],
  [/\blutheran\b/i, 'Lutheran'],
  [/\bpresbyterian\b/i, 'Presbyterian'],
  [/\breformed\b/i, 'Reformed'],
  [/\bmethodist\b/i, 'Methodist'],
  [/\bvineyard\b/i, 'Vineyard'],
  [/\bnon.?denominational\b/i, 'Non-denominational'],
  [/\binterdenominational\b/i, 'Interdenominational'],
  [/\bevangelical\b/i, 'Evangelical'],
  [/\bword\s+of\s+faith\b/i, 'Word of Faith'],
  [/\bassemblies?\s+of\s+god\b/i, 'Assemblies of God'],
];

// ── Manual overrides for well-known churches ──

const manualOverrides = {
  // Swedish churches
  'sos-church': 'Pentecostal',
  'sos-church-malm': 'Pentecostal',
  'mfl-movement': 'Pentecostal',
  'betaniakyrkan-i-malm': 'Pentecostal',
  'betlehemskyrkan-g-teborg': 'Pentecostal',
  'pingstkyrkan-v-stra-fr-lunda': 'Pentecostal',
  'pingstkyrka': 'Pentecostal',
  'saronkyrkan': 'Pentecostal',
  'centrumkyrkan-malm': 'Pentecostal',
  'centrumkyrkan': 'Pentecostal',
  'aspn-skyrkan': 'Pentecostal',
  'the-lighthouse-church-malm': 'Charismatic',
  'c3-church-malm': 'Charismatic',
  'fishers-creek-international-church': 'Non-denominational',
  'the-gateway-church-stockholm': 'Charismatic',
  'new-life-church-stockholm': 'Charismatic',
  'grace-church-sweden': 'Evangelical',
  'frimodig-kyrka': 'Lutheran',
  'katolska-f-rsamlingen': 'Catholic',
  'equmeniakyrkan': 'Evangelical (Uniting Church)',
  'evangeliska-frikyrkan-efk': 'Evangelical Free Church',
  'uppsala-missionskyrka': 'Evangelical (Uniting Church)',
  's-derh-jdskyrkan': 'Pentecostal',
  'stockholm-community': 'Non-denominational',
  'g-teborgs-domkyrkas-goss-och-flickk-rer': 'Lutheran',
  'v-lkommen-till-citykyrkan-g-teborg-citykyrkan': 'Pentecostal',

  // UK churches
  'rea-church': 'Charismatic',
  'manchester-cathedral': 'Anglican',
  'ivy-church-manchester': 'Evangelical',
  'life-church-bristol': 'Charismatic',
  'central-church-bristol': 'Non-denominational',
  'city-church-bristol': 'Charismatic',
  'liberty-church-london': 'Charismatic',
  'trinity-church-london': 'Anglican',
  'every-nation-church-london': 'Charismatic',
  'holy-trinity-platt-church-manchester': 'Anglican',
  'reality-church-london': 'Non-denominational',
  'victory-bible-church-international-uk': 'Pentecostal',
  'woodlands-church': 'Evangelical',
  'christ-church-mayfair': 'Anglican',
  'revelation-church': 'Charismatic',
  'city-church': 'Charismatic',
  'king-s-church-london': 'Charismatic',
  'hope-london-church': 'Charismatic',
  'buckingham-chapel': 'Evangelical',
  'the-gate-church': 'Charismatic',
  'christian-revival-church': 'Pentecostal',
  'christ-church-fulham': 'Anglican',
  'emmanuel-church': 'Anglican',
  'fabric-church': 'Non-denominational',
  'grace-church-manchester': 'Evangelical',
  'ramp-church': 'Charismatic',
  'king-s-cross-church': 'Non-denominational',
  'the-elevation-church-london': 'Non-denominational',
  'the-angel-church-in-london': 'Charismatic',
  'redeemer-church-in-manchester': 'Non-denominational',
  'resound-church': 'Charismatic',
  'kingsway-church': 'Charismatic',
  'house-of-worship': 'Pentecostal',
  'the-ark-church': 'Charismatic',
  'christ-church-spitalfields': 'Anglican',
  'church-home': 'Non-denominational',
  'christian-life-church': 'Charismatic',
  'everyday-church': 'Evangelical',
  'hackney-church': 'Non-denominational',
  'beacon-church': 'Non-denominational',
  'sound-church': 'Charismatic',
  'tree-of-life-church': 'Non-denominational',
  'one-church': 'Non-denominational',
  'bristol-cathedral': 'Anglican',
  'emmanuel-church-london': 'Anglican',
  'redland-church-bristol': 'Non-denominational',
  'new-covenant-church-uk': 'Charismatic',
  'severn-church-bristol': 'Non-denominational',
  'monyhull-church': 'Non-denominational',
  'being-built-together': 'Non-denominational',
  'st-germain-s-church-birmingham': 'Anglican',
  'st-george-s-church': 'Anglican',
  'revelation-church-manchester': 'Charismatic',
  'city-church-manchester': 'Charismatic',
  'church-in-birmingham': 'Non-denominational',
  'church-in-bristol': 'Non-denominational',
  'church-in-manchester': 'Non-denominational',
  'lifechurch-manchester': 'Charismatic',
  'manifest-church-manchester': 'Charismatic',
  'living-god-gospel-church': 'Pentecostal',
  'winners-chapel-international-manchester': 'Pentecostal',

  // German churches
  'community-church-berlin': 'Non-denominational',
  'welcome-church-berlin': 'Non-denominational',
  'hey-church-hamburg': 'Charismatic',
  'lukas-gemeinde': 'Evangelical Free Church',
  'hamburg-international-church': 'Non-denominational',
  'munich-church-refresh': 'Non-denominational',
  'church-cologne': 'Non-denominational',
  'anker-kirche': 'Evangelical',
  'christuskirche': 'Lutheran',
  'revivalchurch-berlin': 'Charismatic',
  'new-beginnings-international-church': 'Non-denominational',
  'church-of-the-ascension': 'Anglican',
  'young-church-berlin': 'Non-denominational',
  'cbg-church-munich': 'Non-denominational',
  'citychurch-k-ln-aachen-bergisch-gladbach': 'Charismatic',
  'gospel-church-m-nchen': 'Non-denominational',
  'in-der-katholischen-kirche': 'Catholic',
  'c3-church-hanau': 'Charismatic',
  'ecclesia-church': 'Charismatic',
  'freikirche-f-r-m-nchen': 'Evangelical Free Church',
  'awakening-church': 'Charismatic',
  'fokus-kirche': 'Evangelical Free Church',
  'alpenchurch': 'Evangelical Free Church',
  'kirche-in-k-ln': 'Evangelical',
  'maranatha-church-m-nchen': 'Pentecostal',
  'stadtkirche-k-ln': 'Evangelical',
  'miracle-center-church-berlin': 'Pentecostal',
  'jesusrev-church-hamburg-gemeinde-anker-gnade-jesus': 'Charismatic',
  'christengemeinde-arche-alstertal': 'Evangelical Free Church',
  'kirche-f-r-dich': 'Non-denominational',
  'anskar-kirche-hamburg-mitte': 'Charismatic',

  // French churches
  'eglise-sos-lyon': 'Pentecostal',
  'eglise-vie': 'Evangelical',
  'eglise-boom': 'Charismatic',
  'american-church-in-paris': 'Interdenominational',
  'the-american-cathedral-in-paris': 'Anglican',
  'newhome-church-paris': 'Charismatic',
  'emmanuel-international-church': 'Evangelical',
  'groupe-gospel-church': 'Non-denominational',
  'classictic': 'Non-denominational',
  'gospel-dream': 'Non-denominational',
  'christ-church-lille': 'Anglican',
  'saint-george-s-anglican-church-paris-france': 'Anglican',

  // Swiss churches
  'english-speaking-church-in-zurich': 'Non-denominational',
  'geneva-bible-church': 'Evangelical',
  'the-fortified-city-church': 'Charismatic',
  'international-protestant-church-of-zurich': 'Protestant',
  'viva-kirche-z-rich': 'Evangelical Free Church',
  'westlake-church-lausanne-lausanne-switzerland': 'Non-denominational',
  'church-of-christ-z-rich': 'Church of Christ',
  'crossroads-international-church-basel': 'Non-denominational',
  'zurichcitychurch': 'Charismatic',
  'steinekirche': 'Evangelical Free Church',
  'die-gemeinde-in-z-rich': 'Non-denominational',
  'die-gemeinde-in-basel': 'Non-denominational',
  'redeemer-grace-church-geneva': 'Reformed',
  'mosaic-church-und-fachstelle-z-rich': 'Non-denominational',
  'church-for-the-nations': 'Charismatic',
  'freie-kirche-uster': 'Evangelical Free Church',
  'lifechurch-wil': 'Evangelical Free Church',
  'eglise-passion-neuch-tel': 'Evangelical',
  'st-john-xxiii-parish': 'Catholic',
  'wearechurch': 'Non-denominational',
  'silbern-church': 'Evangelical Free Church',
  'christ-church-lausanne': 'Anglican',
  'anglican-church-of-basel': 'Anglican',
  'gospel-center-lausanne': 'Evangelical',
  'une-glise-qui-vit-ce-qu-elle-croit': 'Evangelical',
  'emmanuel-episcopal-church-geneva': 'Anglican',

  // Norwegian churches
  'new-life-church': 'Charismatic',
  'norkirken-bergen': 'Non-denominational',
  'bydelskirken-filadelfia': 'Pentecostal',
  'oslo-international-church': 'Non-denominational',
  'trondheim-city-church': 'Non-denominational',
  'oslo-church-music-festival': 'Interdenominational',
  'salem-misjonskirke-nlm-bergen': 'Lutheran',
  'imi-kirken': 'Lutheran',
  'imi-kirken-kollektivet': 'Lutheran',
  'karismakirken': 'Charismatic',
  'jesus-church': 'Charismatic',
  'sentrumkirken': 'Pentecostal',
  'menigheten-v-r': 'Non-denominational',
  'dayspring-parish': 'Non-denominational',
  'forside': 'Lutheran',
  'st-edmund-s-anglican-church-oslo-norway': 'Anglican',
  'grace-international-church-of-oslo': 'Non-denominational',
  'stavanger-international-church': 'Non-denominational',
  'den-lutherske-kirke-i-norge': 'Lutheran',
  'startside-kirken-no': 'Lutheran',

  // Danish churches
  'hope-church-copenhagen': 'Charismatic',
  'first-international-baptist-church-of-copenhagen': 'Baptist',
  'international-church-of-copenhagen': 'Non-denominational',
  'community-church': 'Non-denominational',
  'church-in-odense': 'Non-denominational',
  'en-anden-slags-folkekirke': 'Lutheran',
  'odense-domkirke': 'Lutheran',
  'the-church-of-pentecost': 'Pentecostal',
  'the-gospel-fellowship': 'Evangelical',
  'horsens-frikirke': 'Evangelical Free Church',
  'den-ortodokse-kirke-i-danmark': 'Orthodox',
  'folkekirken-dk': 'Lutheran',
  'evangeliekirken': 'Evangelical',
  'jesuskirken-i-valby-k-benhavn': 'Non-denominational',
  'marmorkirken': 'Lutheran',
  'kolding-kirkecenter': 'Charismatic',
  'fordi-vi-elsker-verden': 'Lutheran',
  'velkommen-i-apostolsk-kirke': 'Pentecostal',
  'christianskirken-aarhus': 'Non-denominational',
  'vor-frue-kirke': 'Lutheran',
  'vor-frelsers-kirke': 'Lutheran',
  'aarhus-biblekirke': 'Evangelical',
  'mariagerfjord-frikirke': 'Evangelical Free Church',

  // Finnish churches
  'newhope-church-espoo': 'Charismatic',
  'espoon-vapaaseurakunta': 'Evangelical Free Church',
  'st-nicholas-anglican-church-helsinki': 'Anglican',
  'keski-espoon-l-hiseurakunta': 'Lutheran',
  'rccg-hosanna-chapel-tampere': 'Pentecostal',
  'river-church-finland': 'Charismatic',
  'church-fi': 'Non-denominational',
  'love-story-church': 'Charismatic',
  'calvary-chapel-helsinki': 'Evangelical',
  'andreaskyrkan-helsingfors': 'Pentecostal',
  'etusivu': 'Lutheran',

  // Spanish churches
  'st-georges-anglican-church-madrid': 'Anglican',
  'iglesia-bethel': 'Pentecostal',
  'international-church-of-barcelona': 'Non-denominational',
  'healing-place-church-spain': 'Charismatic',
  '121-church': 'Non-denominational',
  'the-worship-place': 'Non-denominational',
  'iglesia-en-su-presencia': 'Charismatic',
  'iglesia-renacer-m-laga': 'Pentecostal',
  'iglesia-hechos-malaga': 'Pentecostal',
  'iglesia-verbo-de-dios': 'Pentecostal',
  'iglesia-unida-betel': 'Pentecostal',
  'iglesia-cristiana': 'Evangelical',
  'iglesias-cristianas': 'Evangelical',
  'iglesia-san-ant-n': 'Catholic',
  'catedraldevalencia': 'Catholic',
  'turismo-en-val-ncia': 'Catholic',
  'anglicanchurcjesucristovalenvia': 'Anglican',
  'the-community-church-of-madrid': 'Non-denominational',

  // Brazilian churches
  'igreja-renascer': 'Pentecostal',
  'igreja-up-house': 'Non-denominational',
  'catedral-das-igrejas-crist-s-nova-vida': 'Pentecostal',
  'gape-church': 'Evangelical',
  'igreja-em-belo-horizonte': 'Non-denominational',
  'igreja-ad-barra-da-tijuca': 'Assemblies of God',
  'sampa-church': 'Non-denominational',
  'igreja-unasp-sp': 'Seventh-day Adventist',
  'christ-church-rio': 'Anglican',
  'pleno-louvor-church': 'Pentecostal',
  'igreja-mananciais': 'Pentecostal',
  'igreja-do-redentor': 'Presbyterian',
  'livres-church': 'Charismatic',
  'igreja-casa-brasil': 'Non-denominational',
  'igreja-cbrio': 'Baptist',
  'igreja-crist-maranata': 'Pentecostal',

  // Philippines
  'manila-cathedral': 'Catholic',
  'calvary-chapel-manila': 'Evangelical',
  'church-of-god-in-quezon-city': 'Church of God',
  'ellinwood-malate-church-manila-philippines': 'Presbyterian',
  'christ-s-commission-fellowship': 'Non-denominational',
  'soli-deo-gloria-christian-church': 'Evangelical',
  'new-millennium-evagelical-church': 'Evangelical',
  'favor-church': 'Non-denominational',
  'jubilee-evangelical-church': 'Evangelical',
  'citichurch-cebu': 'Charismatic',
  'davao-evangelical-church': 'Evangelical',
  'davao-city-alliance-gospel-church': 'Christian and Missionary Alliance',

  // Nigeria
  'holyhill-church': 'Non-denominational',
  'lagos-international-christian-church': 'Non-denominational',
  'worship-music': 'Non-denominational',

  // South Africa / Music ministries / Other
  'bethany-music': 'Non-denominational',
  'joyous-celebration': 'Interdenominational',
  'soweto-gospel-choir': 'Interdenominational',
  'worship-harvest': 'Non-denominational',
  'grace-truth-worship': 'Non-denominational',
  'en-esp-ritu-y-en-verdad': 'Evangelical',
  'miel-san-marcos': 'Evangelical',
  'twice': 'Non-denominational',
  'red-rocks-worship': 'Non-denominational',
  'worship-together': 'Interdenominational',
  'presencia-de-dios-honduras': 'Pentecostal',
  'the-crossing-hong-kong': 'Non-denominational',
  'welcome-church-music': 'Non-denominational',

  // ── Remaining unknowns ──

  // UK remaining
  'st-clements-church-manchester': 'Anglican',
  'birmingham-church-west-midlands': 'Non-denominational',
  'oasis-church-birmingham-middot-oasis-church-birmingham': 'Charismatic',
  'oasis-church-birmingham-oasis-church-birmingham': 'Charismatic',
  'st-georges-church': 'Anglican',
  'kings-church-london': 'Charismatic',
  'tamil-church-london': 'Pentecostal',
  'family-church-in-bristol': 'Non-denominational',
  'manchester-alliance-church': 'Christian and Missionary Alliance',
  'ebenezer-church': 'Evangelical',
  'river-of-life-church': 'Charismatic',
  'international-central-gospel-church-birmingham': 'Charismatic',
  'new-covenant-church-manchester-united-kingdom': 'Charismatic',
  'new-covenant-church-manchester-united-kingdom-2': 'Charismatic',
  'kings-cross-church': 'Non-denominational',
  'st-pauls-church-bristol': 'Anglican',
  'christ-church-with-st-ewen': 'Anglican',
  'home': 'Non-denominational',
  'church-in-ealing-west-london': 'Non-denominational',
  'national-churches-trust': 'Interdenominational',
  'charltonroadchurch': 'Evangelical',
  'st-james-039-s-church-piccadilly': 'Anglican',
  'st-james-s-church-piccadilly': 'Anglican',
  'st-germains-church-birmingham': 'Anglican',

  // Germany remaining
  'ev-kirchengemeinde-pfingst-berlin': 'Pentecostal',
  'christus-gemeinde-barmbek-s-d-cgbs': 'Evangelical Free Church',
  'hauptkirche-st-jacobi-hauptkirche-st-jacobi': 'Lutheran',
  'hauptkirche-st-michaelis': 'Lutheran',
  'kreuzkirche-berlin-lankwitz-gemeinsam-leben': 'Lutheran',
  'kreuzkirche-berlin-lankwitz-gemeinsam-leben-2': 'Lutheran',

  // Norway remaining
  'pinsekirken-tabernaklet-bergen': 'Pentecostal',
  'domkirken-og-st-petri-menighet': 'Lutheran',
  'stavanger-kirkelige-fellesr-d-hjem': 'Lutheran',

  // France remaining
  'glise-du-sentier': 'Reformed',
  'eglise-de-la-trinit-lille': 'Evangelical',
  'eglise-marseille-kleber': 'Evangelical',
  'glise-connexion': 'Evangelical',
  'eglise-lyon-centre': 'Evangelical',
  'glise-protestante-paris-al-sia': 'Reformed',
  'eglise-paris-m-tropole': 'Evangelical',
  'glise-saint-georges': 'Reformed',
  'eglise-lyon': 'Evangelical',
  'chapelle-de-fuveau': 'Evangelical',
  'paris-centre-church-eglise-paris-centre': 'Evangelical',
  'paris-centre-church-eglise-paris-centre-2': 'Evangelical',
  'eglise-protestante-arm-nienne-de-beaumont': 'Protestant',
  'glises-org': 'Interdenominational',
  'saint-george-s-anglican-church-paris-france': 'Anglican',

  // Switzerland remaining
  'lausanne-free-church-english-speaking-switzerland': 'Evangelical Free Church',
  'basel-christian-fellowship': 'Non-denominational',
  'icf-basel-ndash-kirche-neu-erleben': 'Charismatic',
  'icf-basel-kirche-neu-erleben': 'Charismatic',
  'offene-kirche-elisabethen-basel': 'Reformed',
  'icf-radio-ndash-kirche-neu-erleben': 'Charismatic',
  'icf-radio-kirche-neu-erleben': 'Charismatic',
  'regiogemeinde-riehen': 'Evangelical Free Church',
  'icf-gen-ve-ndash-une-nouvelle-exp-rience-de-l-039-glise': 'Charismatic',
  'icf-geneve-une-nouvelle-experience-de-l-eglise': 'Charismatic',
  'glise-lausanne-inclusive-et-ouverte': 'Reformed',
  'english-church-ch-teau-d-039-oex': 'Anglican',
  'english-church-chateau-d-oex': 'Anglican',
  'kantonalkirche-schaffhausen': 'Reformed',
  'eglise-renens-ab': 'Evangelical',
  'glise-protestante-de-gen-ve': 'Reformed',
  'silbern-church': 'Evangelical Free Church',

  // Spain remaining
  'iglesia-pasi-n-por-cristo-en-madrid-2022-la-gracia': 'Evangelical',
  'iglesia-pasion-por-cristo-en-madridla-gracia': 'Evangelical',
  'st-george-039-s-church': 'Anglican',
  'iglesia-san-nicol-s-valencia': 'Catholic',
  'iglesia-presbiteriana-de-m-laga': 'Presbyterian',
  'iglesia-evangelica-en-barcelona': 'Evangelical',
  'iglesia-cristiana-internacional-de-barcelona': 'Non-denominational',
  'valencia-church': 'Non-denominational',
  'iglesia-bautista-calvario-de-valencia': 'Baptist',
  'iglesia-b-blica-nueva-vida': 'Evangelical',
  'the-community-church-of-madrid-2': 'Non-denominational',
  'iglesia-cristiana-en-madrid-espa-a': 'Evangelical',

  // Brazil remaining
  'igreja-presbiteriana-unida-de-s-xe3-o-paulo': 'Presbyterian',
  'igreja-presbiteriana-unida-de-sao-paulo': 'Presbyterian',
  'oitava-igreja-presbiteriana': 'Presbyterian',
  'igreja-evang-eacute-lica-brasileira': 'Evangelical',

  // Philippines remaining
  'christ-039-s-commission-fellowship': 'Non-denominational',
  'christian-bible-church-of-the-philippines': 'Evangelical',

  // Denmark remaining
  'home': 'Non-denominational',

  // ── Batch 2: newly merged candidates ──

  // Denmark
  'ansgars-kirken': 'Lutheran',
  'the-church-of-jesus-christ-of-latter-day-saints': 'Latter-day Saints',
  'kristi-kirke-kbenhavn': 'Non-denominational',
  'en-moderne-frikirke-i-aalborg': 'Evangelical Free Church',
  'bykirken': 'Non-denominational',
  'aalborg-citykirke': 'Non-denominational',
  'din-frikirke-haderslev': 'Evangelical Free Church',
  'frikirken-i-s-by': 'Evangelical Free Church',
  'frikirken-nu': 'Evangelical Free Church',
  'sakramentskirken': 'Catholic',
  'pinsekirken': 'Pentecostal',
  'kbh-frikirke': 'Evangelical Free Church',
  'k-bnerkirken': 'Baptist',
  'skovlunde-frikirke': 'Evangelical Free Church',
  'kristkirkens-sogn': 'Lutheran',
  'nordkirken': 'Lutheran',
  'abenkirke-odense': 'Non-denominational',
  'interchurch-dk': 'Interdenominational',
  'openchurch-global': 'Non-denominational',
  'den-danske-kirke-i-udlandet': 'Lutheran',
  'aalborg-menighedscenter': 'Pentecostal',
  'sankt-hans-kirke': 'Lutheran',
  'odense-vineyard-kirke': 'Vineyard',
  'aarhus-domkirke': 'Lutheran',
  'frimodig-kirke': 'Lutheran',

  // Finland
  'tampereen-seurakuntayhtyma': 'Lutheran',
  'luther-church-helsinki': 'Lutheran',
  'pyhan-marian-katolinen-seurakunta': 'Catholic',
  'vhnkyrn-vapaaseurakunta': 'Evangelical Free Church',
  'finnish-church': 'Lutheran',
  'helsingin-vapaaseurakunta': 'Evangelical Free Church',
  'hopeseurakunta': 'Charismatic',
  'suomen-helluntailiike': 'Pentecostal',
  'finland-turku-chinese-church': 'Non-denominational',
  'elavat-virrat-seurakunta': 'Pentecostal',
  'one-way-seurakunta': 'Charismatic',
  'turku-cathedral': 'Lutheran',
  'turku-cathedral-international-congregation': 'Lutheran',
  'espoon-helluntaiseurakunta': 'Pentecostal',
  'turun-raamattu-puhuu-seurakunta': 'Pentecostal',
  'ethiopian-evangelical-church-in-finland-eecfin': 'Evangelical',

  // Sweden
  'musik-i-storkyrkan-s-t-jacobs-kyrka': 'Lutheran',
  'english-speaking-international-church-in': 'Non-denominational',
  'sodertornkyrkan': 'Pentecostal',
  'pingstkyrkan-molndal': 'Pentecostal',
  'st-andrew-s-church-anglican-gothenburg': 'Anglican',
  'gothenburg-church-of-christ': 'Church of Christ',
  'fralsningsarmen-i-sverige': 'Salvation Army',
  'wesleykyrkan': 'Methodist',
  'vallhamrakyrkan': 'Pentecostal',
  'backadalskyrkan': 'Pentecostal',
  'holsby-frikyrka': 'Evangelical Free Church',
  'valkommen-till-pingstkyrkan-borlange': 'Pentecostal',
  'pingstkyrkan-nynashamn': 'Pentecostal',
  'church-of-sweden-los-angeles': 'Lutheran',
  'id-church-sweden': 'Non-denominational',
  'katolska-kyrkan': 'Catholic',
  'malmo-international-church': 'Non-denominational',
  'immanuelskyrkan': 'Evangelical (Uniting Church)',
  'malmo-pingstforsamling': 'Pentecostal',
  'the-immanuel-church': 'Evangelical (Uniting Church)',
  'en-kyrka-i-hjartat-av-goteborg-an-international': 'Non-denominational',
  'wao-malmo': 'Non-denominational',
  'st-peter-and-st-sigfrid-stockholm': 'Anglican',
  'city-church-stockholm': 'Charismatic',
  'grace-church-stockholm': 'Evangelical',
  'hillsong-church-sweden': 'Charismatic',

  // Norway
  'bic': 'Baptist',
  'oslochurch': 'Non-denominational',
  'stavanger-lutheran-church': 'Lutheran',
  'hope-church-norway-haugesund-international-church': 'Charismatic',
  'filadelfiakirken-vestby': 'Pentecostal',
  'kristianiakirken': 'Non-denominational',
  'norkirken-trondheim-salem': 'Non-denominational',
  'hjem': 'Lutheran',
  'velkommen-til-frelsesarmeen': 'Salvation Army',
  'nidarosdomen': 'Lutheran',
  'tbbmi': 'Non-denominational',
  'filadelfiakirken-oslo': 'Pentecostal',
  'trondheim-international-church': 'Non-denominational',
  'oslokirken': 'Non-denominational',
  'church-of-pentecost': 'Pentecostal',

  // United Kingdom
  'christcentral-churches': 'Charismatic',
  'welcome-holy-trinity-hotwells': 'Anglican',
  'new-life': 'Charismatic',
  'christ-church-manchester': 'Anglican',
  'kharis-church': 'Charismatic',
  'ivy-church-bristol': 'Evangelical',
  'vine-community-church': 'Non-denominational',
  'the-sound-of-audacious-church': 'Charismatic',
  'potters-church': 'Charismatic',
  'grace-london': 'Charismatic',
  'st-john-s-harborne': 'Anglican',
  'birches-green-evangelical-free-church': 'Evangelical Free Church',
  'victory-charismatic-chapel-gorton-manchester': 'Charismatic',
  'st-paul-s-church': 'Anglican',
  'st-bride-s-church': 'Anglican',
  'kings-church-birmingham': 'Charismatic',
  'christ-church-burney-lane': 'Anglican',
  'htb-church': 'Anglican',
  'birmingham-vineyard-church': 'Vineyard',

  // Germany
  'begegnungskirche-berlin': 'Evangelical Free Church',
  'destiny-church-germany': 'Charismatic',
  'livestreams-christuskirche-hamburg-altona': 'Lutheran',
  'irec-hamburg-international-reformed-evangelical-church': 'Reformed',
  'hope-church-munich': 'Non-denominational',
  'citychurch-beta-in-munchen': 'Charismatic',
  'citychurch': 'Charismatic',
  'st-markus-kirche-munchen': 'Lutheran',
  'eine-kirche-mit-mehreren-standorten': 'Non-denominational',
  'kirche-im-pott': 'Evangelical Free Church',
  'move-church': 'Charismatic',
  'icf-essen-kirche-neu-erleben': 'Charismatic',
  'christus-gemeinde-barmbek-nord': 'Evangelical Free Church',
  'evangelische-trinitatiskirche-koln': 'Lutheran',
  'jesus-haus-church': 'Charismatic',
  'ecclesia-kirche-koln': 'Charismatic',
  'bund-freikirchlicher-pfingstgemeinden-kdor': 'Pentecostal',
  'friedenskirche-berlin-charlottenburg-baptisten': 'Baptist',
  'die-familienkirche': 'Evangelical Free Church',
  'christus-gemeinde-bramfeld': 'Evangelical Free Church',
  'evangelische-freie-gemeinde': 'Evangelical Free Church',
  'internationale-freikirche': 'Evangelical Free Church',
  'internationale-gemeinde-koln': 'Non-denominational',
  'freie-ev-gemeinde-koln-mulheim': 'Evangelical Free Church',
  'every-nation-kirche-berlin-gott-begegnen': 'Charismatic',
  'american-church-in-berlin-e-v': 'Interdenominational',
  'elim-kirche-hamburg': 'Pentecostal',
  'christengemeinde-immanuel-e-v': 'Evangelical Free Church',
  'international-gospel-center': 'Non-denominational',
  'awakening-church-berlin': 'Charismatic',
  'kirche-anders-als-du-denkst': 'Non-denominational',
  'ev-luth-kirchengemeinde-st-andreas': 'Lutheran',

  // France
  'eglise-dans-ma-ville': 'Evangelical',
  'accueil': 'Non-denominational',
  'renaissance-eglise': 'Evangelical',
  'eglise-montplaisir': 'Evangelical',
  'eglise-internationale-du-plein-evangile': 'Pentecostal',
  'eglise-vang-lique-de-pentec-te-de-saint-denis': 'Pentecostal',
  'charisma-eglise-chretienne': 'Charismatic',
  'eglise-missionnaire-evangelique-et-pentecotiste': 'Pentecostal',
  'eglise-evangelique-de-pentecote-a-69006-lyon': 'Pentecostal',
  'l-eglise-catholique-a-marseille': 'Catholic',
  'eglise-evangelique-alliance-de-grace-a-lille': 'Evangelical',
  'cathedrale-notre-dame-de-paris': 'Catholic',
  'eglise-catholique-de-lille': 'Catholic',
  'l-eglise-catholique-dans-le-rhone-et-le-roannais': 'Catholic',
  'an-english-speaking-presbyterian-church-in-paris': 'Presbyterian',

  // Switzerland
  'eerv': 'Reformed',
  'gemeinde-christi-basel': 'Church of Christ',
  'st-ursula-s-church': 'Anglican',
  'eglise-catholique-romaine-geneve': 'Catholic',
  'momentum-church': 'Charismatic',
  'lift-international-church-of-zug': 'Non-denominational',
  'eglise-evangelique-de-reveil-rive-gauche': 'Pentecostal',
  'une-eglise-emerveilee-par-jesus-christ': 'Reformed',
  'eglise-evangelique-libre': 'Evangelical Free Church',
  'communaute-de-saint-loup': 'Reformed',
  'holy-trinity-church-geneva': 'Anglican',
  'serving-anglican-communities-in-europe-turkey-and-morocco': 'Anglican',
  'new-international-church': 'Non-denominational',
  'romisch-katholische-kirche-basel-stadt': 'Catholic',
  'freikirche-im-berner-oberland': 'Evangelical Free Church',
  'adventgemeinde-zurich-cramerstrasse': 'Seventh-day Adventist',
  'gellertkirche-basel': 'Evangelical Free Church',
  'church-of-scotland-in-geneva': 'Presbyterian',

  // Spain
  'vive-church': 'Charismatic',
  'iglesias-y-horarios-de-misa-en-espana': 'Catholic',
  'saint-georges-anglican-chaplaincy': 'Anglican',
  'iglesia-evangelica-en-barcelona-2': 'Evangelical',
  'parroquia-mare-de-deu-de-la-medalla-miraculosa-de-barcelona': 'Catholic',
  'the-centre': 'Non-denominational',
  'primera-iglesia-evangelica-bautista-de-valencia': 'Baptist',
  'euphoria-church': 'Non-denominational',
  'los-pentecostales-de-valencia-central': 'Pentecostal',
  'la-buena-nueva-iglesia-valencia-espana': 'Evangelical',
  'ipue-barcelona-2-iglesia-pentecostal-unida-en-europa': 'Pentecostal',
  'iglesia-evangelica-trevol-barcelona': 'Evangelical',
  'international-evangelical-church-valencia': 'Evangelical',
  'life-church-malaga': 'Charismatic',
  'santa-iglesia-catedral-basilica-de-la-encarnacion': 'Catholic',
  'parroquia-san-juan-ap-stol-y-evangelista': 'Catholic',
  'capilla-de-adoracion-eucaristica-perpetua': 'Catholic',
  'iglesia-cristiana-en-barcelona': 'Evangelical',
  'iglesia-del-camino': 'Evangelical',
  'grupo-de-adoracion-nocturna': 'Catholic',
  'parroquia-santa-cristina-y-santa-margarita-maria-de': 'Catholic',
  'parroquia-san-bonifacio-archidiocesis-de-madrid-iglesia': 'Catholic',
  'parroquia-de-san-agustin': 'Catholic',
  'iglesia-las-aguilas': 'Evangelical',
  'iglesia-evangelica-bautista-de-hostafrancs': 'Baptist',

  // Brazil
  'catedral-evangelica-de-sao-paulo': 'Assemblies of God',
  'igreja-consolacao-correia': 'Presbyterian',
  'igreja-batista-atitude': 'Baptist',
  'igreja-do-recreio': 'Non-denominational',
  'igreja': 'Non-denominational',
  'igreja-messianica-mundial-do-brasil': 'Non-denominational',
  'house-church': 'Non-denominational',
  'paz-church': 'Pentecostal',
  'igreja-evangelica-louvor-na-terra': 'Pentecostal',
  'igreja-batista-da-lagoinha-ibl': 'Baptist',
  'igreja-pentecostal-yeshua-emanuell': 'Pentecostal',
  'zion-church': 'Pentecostal',
  'igreja-central': 'Baptist',
  '1-santuario-de-adoracao-perpetua-do-brasil-completa-200': 'Catholic',
  'igreja-evangelica-oracao-e-louvor-a-deus': 'Pentecostal',

  // Philippines
  'the-church-in-cebu-city-ph': 'Non-denominational',
  'believers-church': 'Evangelical',
  'jesus-is-lord-church-worldwide': 'Charismatic',
  'christ-s-international-fellowship': 'Non-denominational',
  'united-pentecostal-church-in-pasay': 'Pentecostal',
  'the-cathedral-of-praise-cop-church': 'Pentecostal',
  'university-baptist-church': 'Baptist',
  'grace-christian-church-of-the-philippines': 'Evangelical',
  'victory': 'Non-denominational',
  'ccic-worship-centers': 'Non-denominational',

  // Nigeria
  'family-worship-centre': 'Pentecostal',
  'living-faith-church-worldwide': 'Pentecostal',
  'christcare-church': 'Pentecostal',
  'wccrm-lagos': 'Non-denominational',
  'charis-gospel-family-world-outreach': 'Pentecostal',
  'lagos-christian-church': 'Non-denominational',
  'house-hold-of-david': 'Pentecostal',
  'the-church-of-the-bible': 'Non-denominational',
  'city-church-lagos': 'Non-denominational',
  'church-of-the-assumption': 'Catholic',
  'the-lord-s-chosen-charismatic-revival-church': 'Charismatic',

  // USA
  'hope-bible-church': 'Evangelical',
  'trailhead-church': 'Non-denominational',
  'restoration-anglican-church': 'Anglican',
  'lifepoint-church': 'Non-denominational',

  // Other
  'the-old-church-amsterdam': 'Non-denominational',
  'lutheran-church': 'Lutheran',
  'jesu-hjerte-kirke': 'Catholic',
  'une-eglise-emerveillee-par-jesus-christ': 'Reformed',
};

// ── Classification logic ──

function classify(church) {
  // 1. Manual override
  if (manualOverrides[church.slug]) {
    return manualOverrides[church.slug];
  }

  const name = church.name || '';
  const desc = church.description || '';

  // 2. Name patterns
  for (const [pattern, denom] of namePatterns) {
    if (pattern.test(name)) {
      // Cathedral special handling
      if (denom === 'Cathedral') {
        if (/anglican|church\s+of\s+england/i.test(name + ' ' + desc)) return 'Anglican';
        if (/lutheran|luthersk|evangelisch/i.test(name + ' ' + desc)) return 'Lutheran';
        if (/catholic|katolsk/i.test(name + ' ' + desc)) return 'Catholic';
        // Default cathedrals by country
        if (church.country === 'United Kingdom') return 'Anglican';
        if (['Norway', 'Sweden', 'Denmark', 'Finland', 'Germany'].includes(church.country)) return 'Lutheran';
        return 'Catholic';
      }
      return denom;
    }
  }

  // 3. Description patterns
  for (const [pattern, denom] of descPatterns) {
    if (pattern.test(desc)) {
      return denom;
    }
  }

  return null;
}

// ── Run classification ──

let classified = 0;
let unclassified = 0;
const changes = [];

for (const church of churches) {
  if (church.denomination) continue;

  const denom = classify(church);
  if (denom) {
    changes.push({ slug: church.slug, name: church.name, denomination: denom });
    church.denomination = denom;
    classified++;
  } else {
    unclassified++;
    console.log(`UNKNOWN: ${church.slug} | ${church.name} | ${church.country}`);
  }
}

console.log(`\n─── Results ───`);
console.log(`Classified: ${classified}`);
console.log(`Still unknown: ${unclassified}`);
console.log(`Total with denomination: ${churches.filter(c => c.denomination).length}/${churches.length}`);

// Show denomination distribution
const dist = {};
churches.filter(c => c.denomination).forEach(c => {
  dist[c.denomination] = (dist[c.denomination] || 0) + 1;
});
console.log('\nDenomination distribution:');
Object.entries(dist).sort((a, b) => b[1] - a[1]).forEach(([d, n]) => console.log(`  ${n} ${d}`));

if (!dryRun) {
  writeFileSync(CHURCHES_PATH, JSON.stringify(churches, null, 2) + '\n');
  console.log('\n✓ churches.json updated');
} else {
  console.log('\nDry run. Use --apply to write changes.');
}
