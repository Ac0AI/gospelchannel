// Website platform / tech / sales-angle detection shared between
// `detect-church-website-tech.mjs` and `enrich-llm-bulk.mjs`.
// Mirrors the regex fingerprints in the original detector but exposes a
// pure function so callers can pass the HTML (and optional headers/urls)
// they already have instead of re-fetching.

export const PLATFORM_PRIORITY = [
  "WordPress",
  "Squarespace",
  "Wix",
  "Webflow",
  "Framer",
  "Shopify",
  "Ghost",
  "Drupal",
  "Joomla",
  "HubSpot CMS",
  "Next.js",
  "Nuxt",
  "Gatsby",
];

function addDetection(map, technology, category, reason) {
  if (!map.has(technology)) {
    map.set(technology, { technology, category, reason });
  }
}

function findMetaGenerator(html = "") {
  const m = html.match(/<meta[^>]*name="generator"[^>]*content="([^"]*)"/i);
  return m ? m[1] : "";
}

function hdr(headers, name) {
  if (!headers) return "";
  if (typeof headers.get === "function") return headers.get(name) || "";
  return headers[name] || headers[name.toLowerCase()] || "";
}

export function detectTechnologies({ website = "", finalUrl = "", html = "", headers = null } = {}) {
  const detections = new Map();
  const haystack = `${website}\n${finalUrl}\n${html}`.toLowerCase();
  const generator = findMetaGenerator(html);
  const server = hdr(headers, "server");
  const poweredBy = hdr(headers, "x-powered-by");

  if (generator) {
    if (/wordpress/i.test(generator)) addDetection(detections, "WordPress", "cms", `meta generator: ${generator}`);
    if (/squarespace/i.test(generator)) addDetection(detections, "Squarespace", "builder", `meta generator: ${generator}`);
    if (/ghost/i.test(generator)) addDetection(detections, "Ghost", "cms", `meta generator: ${generator}`);
    if (/drupal/i.test(generator)) addDetection(detections, "Drupal", "cms", `meta generator: ${generator}`);
    if (/joomla/i.test(generator)) addDetection(detections, "Joomla", "cms", `meta generator: ${generator}`);
    if (/hubspot/i.test(generator)) addDetection(detections, "HubSpot CMS", "cms", `meta generator: ${generator}`);
  }

  if (/(wp-content|wp-includes|\/wp-json\/|wordpress\.com)/i.test(haystack)) addDetection(detections, "WordPress", "cms", "wordpress asset or endpoint detected");
  if (/(squarespace\.com|squarespace-cdn\.com|static1\.squarespace\.com)/i.test(haystack)) addDetection(detections, "Squarespace", "builder", "squarespace asset detected");
  if (/(wixsite\.com|wixstatic\.com|parastorage\.com|static\.wixstatic\.com)/i.test(haystack)) addDetection(detections, "Wix", "builder", "wix asset detected");
  if (/(webflow\.js|webflow\.css|data-wf-domain|uploads-ssl\.webflow\.com)/i.test(haystack)) addDetection(detections, "Webflow", "builder", "webflow asset detected");
  if (/(framerusercontent\.com|cdn\.framer\.com|framer\.app)/i.test(haystack)) addDetection(detections, "Framer", "builder", "framer asset detected");
  if (/(cdn\.shopify\.com|\/cdn\/shop\/|shopify\.theme|shopify\.section)/i.test(haystack)) addDetection(detections, "Shopify", "commerce", "shopify asset detected");
  if (/(ghost\/api|content="ghost|cdn\.ghost\.io)/i.test(haystack)) addDetection(detections, "Ghost", "cms", "ghost asset detected");
  if (/(\/_next\/static\/|__next_data__|x-powered-by:\s*next\.js)/i.test(haystack) || /next\.js/i.test(poweredBy)) addDetection(detections, "Next.js", "framework", "next.js asset or header detected");
  if (/(\/_nuxt\/|__nuxt__)/i.test(haystack)) addDetection(detections, "Nuxt", "framework", "nuxt asset detected");
  if (/(webpack-runtime|___gatsby|gatsby-browser)/i.test(haystack)) addDetection(detections, "Gatsby", "framework", "gatsby asset detected");
  if (/(hubspotusercontent|hs-sites|hsforms|hubspot)/i.test(haystack)) addDetection(detections, "HubSpot CMS", "cms", "hubspot asset detected");
  if (/drupal-settings-json|sites\/default\/files/i.test(haystack)) addDetection(detections, "Drupal", "cms", "drupal asset detected");
  if (/\/media\/system\/js\/|joomla/i.test(haystack)) addDetection(detections, "Joomla", "cms", "joomla asset detected");

  // Church-specific CMS platforms — high-signal for outreach
  if (/(churchfolio|subsplash|ministryone|ministrysync|faithlife|ekklesia|planningcenter|pushpay)/i.test(haystack)) {
    const m = haystack.match(/(churchfolio|subsplash|ministryone|ministrysync|faithlife|ekklesia|planningcenter|pushpay)/i);
    const name = (m?.[1] || "Church CMS").replace(/^./, (c) => c.toUpperCase());
    addDetection(detections, name, "church-cms", `${name} asset detected`);
  }

  if (hdr(headers, "x-vercel-id") || hdr(headers, "x-vercel-cache")) addDetection(detections, "Vercel", "hosting", "vercel response header detected");
  if (hdr(headers, "x-nf-request-id")) addDetection(detections, "Netlify", "hosting", "netlify response header detected");
  if (hdr(headers, "cf-ray") || /cloudflare/i.test(server)) addDetection(detections, "Cloudflare", "infrastructure", "cloudflare response header detected");
  if (/firebaseapp\.com|web\.app/i.test(haystack)) addDetection(detections, "Firebase Hosting", "hosting", "firebase host detected");

  return [...detections.values()].sort((a, b) => a.technology.localeCompare(b.technology));
}

export function pickPrimaryPlatform(detections) {
  for (const technology of PLATFORM_PRIORITY) {
    if (detections.some((item) => item.technology === technology)) return technology;
  }
  // Fallback: check for any church-specific CMS
  const churchCms = detections.find((d) => d.category === "church-cms");
  if (churchCms) return churchCms.technology;
  return "Unknown";
}

export function getSalesAngle(primaryPlatform) {
  switch (primaryPlatform) {
    case "WordPress": return "Plugin/theme maintenance, speed, security, and redesign angle.";
    case "Squarespace": return "Migration, SEO control, and conversion-focused redesign angle.";
    case "Wix": return "Migration, SEO flexibility, and editorial control angle.";
    case "Webflow":
    case "Framer": return "Less rebuild urgency; better angle is SEO, content model, and analytics.";
    case "Ghost": return "Publishing/blog optimization and membership/content workflow angle.";
    case "Next.js":
    case "Nuxt":
    case "Gatsby": return "Modern stack already; pitch performance, analytics, and content/editor workflow.";
    case "Churchfolio":
    case "Subsplash":
    case "Ministryone":
    case "Ministrysync":
    case "Faithlife":
    case "Planningcenter":
    case "Pushpay": return `Already on ${primaryPlatform}; pitch integration/feed sync rather than replacement.`;
    case "Unknown": return "Audit and modernization angle.";
    default: return "CMS cleanup, content workflow, and redesign angle.";
  }
}

export function inspectHtml({ website, finalUrl, html, headers } = {}) {
  const technologies = detectTechnologies({ website, finalUrl, html, headers });
  const primary_platform = pickPrimaryPlatform(technologies);
  return {
    primary_platform,
    technologies,
    sales_angle: getSalesAngle(primary_platform),
  };
}
