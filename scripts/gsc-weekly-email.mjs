#!/usr/bin/env node

/**
 * Generate the weekly GSC report and email it via Brevo.
 *
 * Called by the GitHub Actions workflow every Monday morning. Can
 * also be run locally with `node scripts/gsc-weekly-email.mjs` for
 * ad-hoc sends — requires the same env vars as gsc-report.mjs plus
 * BREVO_API_KEY and DATABASE_URL.
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";
import { generateReport, delta } from "./gsc-report.mjs";
import { loadLocalEnv } from "./lib/local-env.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
loadLocalEnv(join(__dirname, ".."));
const BREVO_API_KEY = process.env.BREVO_API_KEY;
const FROM_EMAIL = process.env.NOTIFY_FROM_EMAIL || "noreply@gospelchannel.com";

if (!BREVO_API_KEY) {
  console.error("Missing BREVO_API_KEY");
  process.exit(1);
}
if (!process.env.DATABASE_URL && !process.env.DATABASE_URL_UNPOOLED) {
  console.error("Missing DATABASE_URL or DATABASE_URL_UNPOOLED");
  process.exit(1);
}

async function getAdminEmails() {
  const databaseUrl = process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED;
  const sql = neon(databaseUrl);
  const rows = await sql`select email from "user" where role = 'admin' order by email asc`;
  return rows.map((row) => row.email).filter(Boolean);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderEmailHtml(report, days) {
  const { range, totals, prevTotals, topCountries, topQueries, topPages, sitemap } = report;
  const sortedCountries = [...topCountries].sort((a, b) => b.impressions - a.impressions).slice(0, 8);

  const cell = "padding: 6px 10px; border-bottom: 1px solid #f0e5de; font-size: 14px;";
  const headCell = "padding: 8px 10px; background: #faf6f3; text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: #7a6a5a; font-weight: 600;";

  const countryRows = sortedCountries.map(r => `
    <tr>
      <td style="${cell}"><strong>${escapeHtml(r.keys[0].toUpperCase())}</strong></td>
      <td style="${cell} text-align: right;">${r.clicks}</td>
      <td style="${cell} text-align: right;">${r.impressions.toLocaleString()}</td>
      <td style="${cell} text-align: right;">${(r.ctr * 100).toFixed(2)}%</td>
      <td style="${cell} text-align: right;">${r.position.toFixed(1)}</td>
    </tr>
  `).join("");

  const queryRows = topQueries.slice(0, 10).map(r => `
    <tr>
      <td style="${cell}">${escapeHtml(r.keys[0].slice(0, 50))}</td>
      <td style="${cell} text-align: right;">${r.impressions}</td>
      <td style="${cell} text-align: right;">${r.clicks}</td>
      <td style="${cell} text-align: right;">${r.position.toFixed(0)}</td>
    </tr>
  `).join("");

  const pageRows = topPages.slice(0, 10).map(r => {
    const url = r.keys[0].replace("https://gospelchannel.com", "") || "/";
    return `
    <tr>
      <td style="${cell}"><a href="${escapeHtml(r.keys[0])}" style="color: #b06a50; text-decoration: none;">${escapeHtml(url.length > 55 ? url.slice(0, 52) + "..." : url)}</a></td>
      <td style="${cell} text-align: right;">${r.impressions}</td>
      <td style="${cell} text-align: right;">${r.clicks}</td>
      <td style="${cell} text-align: right;">${r.position.toFixed(0)}</td>
    </tr>
  `;
  }).join("");

  const sitemapBlock = sitemap ? `
    <div style="background: #faf6f3; padding: 14px 18px; border-radius: 12px; margin: 20px 0; font-size: 13px; color: #5a4a3a;">
      <strong style="color: #3b2f2f;">Sitemap status</strong><br>
      Last downloaded: ${escapeHtml(sitemap.lastDownloaded)}<br>
      URLs submitted: ${escapeHtml(String(sitemap.contents?.[0]?.submitted || "—"))}<br>
      Errors: ${escapeHtml(String(sitemap.errors))} &middot; Warnings: ${escapeHtml(String(sitemap.warnings))}
    </div>
  ` : "";

  return `
<!DOCTYPE html>
<html>
<body style="margin: 0; padding: 0; background: #fff; font-family: Georgia, serif; color: #3b2f2f;">
  <div style="max-width: 640px; margin: 0 auto; padding: 32px 24px;">
    <h1 style="font-size: 24px; margin: 0 0 4px 0;">GospelChannel weekly report</h1>
    <p style="font-size: 14px; color: #7a6a5a; margin: 0 0 24px 0;">
      ${escapeHtml(range.current.start)} → ${escapeHtml(range.current.end)} &middot; vs previous ${days} days
    </p>

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 24px;">
      <div style="background: #faf6f3; padding: 16px 18px; border-radius: 12px;">
        <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: #7a6a5a;">Clicks</div>
        <div style="font-size: 28px; font-weight: 700; color: #3b2f2f; margin: 4px 0;">${totals.clicks.toLocaleString()}</div>
        <div style="font-size: 13px; color: #b06a50;">${escapeHtml(delta(totals.clicks, prevTotals.clicks))}</div>
      </div>
      <div style="background: #faf6f3; padding: 16px 18px; border-radius: 12px;">
        <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: #7a6a5a;">Impressions</div>
        <div style="font-size: 28px; font-weight: 700; color: #3b2f2f; margin: 4px 0;">${totals.impressions.toLocaleString()}</div>
        <div style="font-size: 13px; color: #b06a50;">${escapeHtml(delta(totals.impressions, prevTotals.impressions))}</div>
      </div>
      <div style="background: #faf6f3; padding: 16px 18px; border-radius: 12px;">
        <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: #7a6a5a;">CTR</div>
        <div style="font-size: 28px; font-weight: 700; color: #3b2f2f; margin: 4px 0;">${(totals.ctr * 100).toFixed(2)}%</div>
        <div style="font-size: 13px; color: #7a6a5a;">prev ${(prevTotals.ctr * 100).toFixed(2)}%</div>
      </div>
      <div style="background: #faf6f3; padding: 16px 18px; border-radius: 12px;">
        <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: #7a6a5a;">Avg position</div>
        <div style="font-size: 28px; font-weight: 700; color: #3b2f2f; margin: 4px 0;">${totals.position.toFixed(1)}</div>
        <div style="font-size: 13px; color: #7a6a5a;">prev ${prevTotals.position.toFixed(1)}</div>
      </div>
    </div>

    ${sitemapBlock}

    <h2 style="font-size: 16px; margin: 28px 0 12px 0; color: #3b2f2f;">Top countries</h2>
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
      <thead>
        <tr>
          <th style="${headCell}">Country</th>
          <th style="${headCell} text-align: right;">Clicks</th>
          <th style="${headCell} text-align: right;">Impressions</th>
          <th style="${headCell} text-align: right;">CTR</th>
          <th style="${headCell} text-align: right;">Avg pos</th>
        </tr>
      </thead>
      <tbody>${countryRows}</tbody>
    </table>

    <h2 style="font-size: 16px; margin: 28px 0 12px 0; color: #3b2f2f;">Top queries</h2>
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
      <thead>
        <tr>
          <th style="${headCell}">Query</th>
          <th style="${headCell} text-align: right;">Imp</th>
          <th style="${headCell} text-align: right;">Clk</th>
          <th style="${headCell} text-align: right;">Pos</th>
        </tr>
      </thead>
      <tbody>${queryRows}</tbody>
    </table>

    <h2 style="font-size: 16px; margin: 28px 0 12px 0; color: #3b2f2f;">Top pages</h2>
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
      <thead>
        <tr>
          <th style="${headCell}">Page</th>
          <th style="${headCell} text-align: right;">Imp</th>
          <th style="${headCell} text-align: right;">Clk</th>
          <th style="${headCell} text-align: right;">Pos</th>
        </tr>
      </thead>
      <tbody>${pageRows}</tbody>
    </table>

    <hr style="border: none; border-top: 1px solid #e8d8d0; margin: 32px 0;">
    <p style="font-size: 12px; color: #9a8a7a; margin: 0;">
      Automated weekly report from GospelChannel.com.
      Full dashboard: <a href="https://search.google.com/search-console?resource_id=sc-domain%3Agospelchannel.com" style="color: #b06a50;">Google Search Console</a>.
    </p>
  </div>
</body>
</html>
  `.trim();
}

async function sendEmail({ to, subject, html }) {
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": BREVO_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sender: { name: "GospelChannel Reports", email: FROM_EMAIL },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Brevo error ${res.status}: ${body}`);
  }
}

async function main() {
  const days = 7;
  console.log(`Generating ${days}-day report...`);
  const report = await generateReport(days);

  const dateLabel = report.range.current.end;
  const subject = `GospelChannel weekly report — ${dateLabel}`;
  const html = renderEmailHtml(report, days);

  const recipients = await getAdminEmails();
  if (recipients.length === 0) {
    throw new Error("No admin users found in database");
  }
  console.log(`Sending to ${recipients.length} recipient(s): ${recipients.join(", ")}`);

  for (const to of recipients) {
    await sendEmail({ to, subject, html });
    console.log(`✓ Sent to ${to}`);
  }

  console.log("Done.");
}

main().catch(err => {
  console.error("Error:", err.message);
  if (err.response?.data) console.error(JSON.stringify(err.response.data, null, 2));
  process.exit(1);
});
