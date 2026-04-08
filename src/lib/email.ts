import { getConfiguredSiteUrl } from "@/lib/site-url";

function getEmailConfig() {
  const AUTH_FROM_EMAIL = process.env.AUTH_FROM_EMAIL || "noreply@gospelchannel.com";
  const NOTIFY_FROM_EMAIL = process.env.NOTIFY_FROM_EMAIL || AUTH_FROM_EMAIL;
  return { AUTH_FROM_EMAIL, NOTIFY_FROM_EMAIL };
}

async function sendBrevoEmail(params: {
  to: string;
  subject: string;
  html: string;
  from?: string;
}): Promise<boolean> {
  const BREVO_API_KEY = process.env.BREVO_API_KEY;
  console.log("[email] Brevo key present:", !!BREVO_API_KEY);

  if (!BREVO_API_KEY) {
    return false;
  }

  const { NOTIFY_FROM_EMAIL } = getEmailConfig();

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": BREVO_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sender: { name: "Gospel Channel", email: params.from || NOTIFY_FROM_EMAIL },
      to: [{ email: params.to }],
      subject: params.subject,
      htmlContent: params.html,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`[email] Brevo error ${res.status}: ${body}`);
    return false;
  }

  return true;
}

async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  from?: string;
}) {
  console.log("[email] Sending to:", params.to, "subject:", params.subject);

  if (await sendBrevoEmail(params)) {
    return;
  }

  console.warn("[email] Brevo not configured or failed, email not sent");
}

export async function sendAuthOtpEmail(params: {
  email: string;
  otp: string;
}): Promise<void> {
  const { AUTH_FROM_EMAIL } = getEmailConfig();

  const html = `
    <div style="font-family: Georgia, serif; max-width: 520px; margin: 0 auto; color: #3b2f2f;">
      <h2 style="margin-bottom: 4px;">Your sign-in code</h2>
      <p>Use this code to sign in to Gospel Channel church admin.</p>
      <div style="margin: 24px 0; font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #b06a50;">
        ${params.otp}
      </div>
      <p style="font-size: 14px; color: #7a6a5a;">This code expires soon. If you did not request it, you can ignore this email.</p>
    </div>
  `.trim();

  await sendEmail({
    to: params.email,
    from: AUTH_FROM_EMAIL,
    subject: "Your Gospel Channel sign-in code",
    html,
  });
}

export async function sendClaimVerifiedEmail(params: {
  to: string;
  churchName: string;
  churchSlug: string;
}): Promise<void> {
  const { NOTIFY_FROM_EMAIL } = getEmailConfig();
  const siteUrl = getConfiguredSiteUrl();
  const loginUrl = `${siteUrl}/church-admin/login`;
  const churchUrl = `${siteUrl}/church/${params.churchSlug}`;

  const html = `
    <div style="font-family: Georgia, serif; max-width: 520px; margin: 0 auto; color: #3b2f2f;">
      <h2 style="margin-bottom: 4px;">Your claim has been verified</h2>
      <p>
        Great news - your claim for <strong>${params.churchName}</strong> has been approved.
        You can now sign in to your church admin dashboard to update your listing.
      </p>
      <p style="margin: 24px 0;">
        <a href="${loginUrl}" style="background: #c08888; color: #fff; padding: 12px 28px; border-radius: 999px; text-decoration: none; font-weight: 600;">
          Sign in to Church Admin
        </a>
      </p>
      <p style="font-size: 14px; color: #7a6a5a;">
        Use the same email address you submitted with your claim. You'll receive a one-time code to verify your identity.
      </p>
      <hr style="border: none; border-top: 1px solid #e8d8d0; margin: 24px 0;" />
      <p style="font-size: 13px; color: #9a8a7a;">
        <a href="${churchUrl}" style="color: #c08888;">View your church page</a> &middot; Gospel Channel
      </p>
    </div>
  `.trim();

  await sendEmail({
    to: params.to,
    from: NOTIFY_FROM_EMAIL,
    subject: `Your claim for ${params.churchName} has been verified`,
    html,
  });
}

export async function sendClaimReceivedEmail(params: {
  to: string;
  name: string;
  churchName: string;
  churchSlug: string;
}): Promise<void> {
  const { NOTIFY_FROM_EMAIL } = getEmailConfig();
  const siteUrl = getConfiguredSiteUrl();
  const churchUrl = `${siteUrl}/church/${params.churchSlug}`;

  const html = `
    <div style="font-family: Georgia, serif; max-width: 520px; margin: 0 auto; color: #3b2f2f;">
      <h2 style="margin-bottom: 4px;">We received your claim</h2>
      <p>
        Hi ${params.name}, thanks for submitting a claim for
        <strong><a href="${churchUrl}" style="color: #b06a50; text-decoration: none;">${params.churchName}</a></strong>.
      </p>
      <p>
        We'll review your claim and get back to you within <strong>48 hours</strong>.
        Once approved you'll be able to sign in and manage your church listing.
      </p>
      <p style="margin: 24px 0;">
        <a href="${churchUrl}" style="background: #c08888; color: #fff; padding: 12px 28px; border-radius: 999px; text-decoration: none; font-weight: 600;">
          View church page
        </a>
      </p>
      <hr style="border: none; border-top: 1px solid #e8d8d0; margin: 24px 0;" />
      <p style="font-size: 13px; color: #9a8a7a;">
        If you did not submit this claim, you can safely ignore this email.
      </p>
    </div>
  `.trim();

  await sendEmail({
    to: params.to,
    from: NOTIFY_FROM_EMAIL,
    subject: `Claim received for ${params.churchName}`,
    html,
  });
}

export async function sendClaimAdminNotification(params: {
  claimantName: string;
  claimantEmail: string;
  role?: string;
  churchName: string;
  churchSlug: string;
  message?: string;
}): Promise<void> {
  const adminEmailsRaw = process.env.ADMIN_EMAILS;
  if (!adminEmailsRaw) {
    console.warn("[email] ADMIN_EMAILS not set, skipping admin notification");
    return;
  }

  const { NOTIFY_FROM_EMAIL } = getEmailConfig();
  const siteUrl = getConfiguredSiteUrl();
  const adminUrl = `${siteUrl}/admin/claims`;
  const churchUrl = `${siteUrl}/church/${params.churchSlug}`;

  const html = `
    <div style="font-family: Georgia, serif; max-width: 520px; margin: 0 auto; color: #3b2f2f;">
      <h2 style="margin-bottom: 4px;">New claim: ${params.churchName}</h2>
      <table style="font-size: 15px; margin: 16px 0; border-collapse: collapse;">
        <tr><td style="padding: 4px 12px 4px 0; color: #7a6a5a;">Name</td><td>${params.claimantName}</td></tr>
        <tr><td style="padding: 4px 12px 4px 0; color: #7a6a5a;">Email</td><td><a href="mailto:${params.claimantEmail}" style="color: #b06a50;">${params.claimantEmail}</a></td></tr>
        ${params.role ? `<tr><td style="padding: 4px 12px 4px 0; color: #7a6a5a;">Role</td><td>${params.role}</td></tr>` : ""}
        <tr><td style="padding: 4px 12px 4px 0; color: #7a6a5a;">Church</td><td><a href="${churchUrl}" style="color: #b06a50;">${params.churchName}</a></td></tr>
        ${params.message ? `<tr><td style="padding: 4px 12px 4px 0; color: #7a6a5a;">Message</td><td>${params.message}</td></tr>` : ""}
      </table>
      <p style="margin: 24px 0;">
        <a href="${adminUrl}" style="background: #c08888; color: #fff; padding: 12px 28px; border-radius: 999px; text-decoration: none; font-weight: 600;">
          Review claims
        </a>
      </p>
    </div>
  `.trim();

  await notifyAdmins(`New claim: ${params.churchName}`, html);
}

export async function sendSuggestionAdminNotification(params: {
  churchName: string;
  contactEmail: string;
  country?: string;
  website?: string;
  playlistUrl?: string;
  message?: string;
}): Promise<void> {
  const siteUrl = getConfiguredSiteUrl();
  const html = `
    <div style="font-family: Georgia, serif; max-width: 520px; margin: 0 auto; color: #3b2f2f;">
      <h2 style="margin-bottom: 4px;">New suggestion: ${params.churchName}</h2>
      <table style="font-size: 15px; margin: 16px 0; border-collapse: collapse;">
        <tr><td style="padding: 4px 12px 4px 0; color: #7a6a5a;">Church</td><td>${params.churchName}</td></tr>
        <tr><td style="padding: 4px 12px 4px 0; color: #7a6a5a;">Email</td><td><a href="mailto:${params.contactEmail}" style="color: #b06a50;">${params.contactEmail}</a></td></tr>
        ${params.country ? `<tr><td style="padding: 4px 12px 4px 0; color: #7a6a5a;">Country</td><td>${params.country}</td></tr>` : ""}
        ${params.website ? `<tr><td style="padding: 4px 12px 4px 0; color: #7a6a5a;">Website</td><td><a href="${params.website}" style="color: #b06a50;">${params.website}</a></td></tr>` : ""}
        ${params.playlistUrl ? `<tr><td style="padding: 4px 12px 4px 0; color: #7a6a5a;">Playlist</td><td><a href="${params.playlistUrl}" style="color: #b06a50;">${params.playlistUrl}</a></td></tr>` : ""}
        ${params.message ? `<tr><td style="padding: 4px 12px 4px 0; color: #7a6a5a;">Message</td><td>${params.message}</td></tr>` : ""}
      </table>
      <p style="margin: 24px 0;">
        <a href="${siteUrl}/admin/suggestions" style="background: #c08888; color: #fff; padding: 12px 28px; border-radius: 999px; text-decoration: none; font-weight: 600;">
          Review suggestions
        </a>
      </p>
    </div>
  `.trim();

  await notifyAdmins(`New suggestion: ${params.churchName}`, html);
}

export async function sendFeedbackAdminNotification(params: {
  churchName: string;
  churchSlug: string;
  kind: string;
  message: string;
}): Promise<void> {
  const siteUrl = getConfiguredSiteUrl();
  const kindLabel = params.kind === "playlist_addition" ? "Playlist addition" : params.kind === "data_issue" ? "Data issue" : "Profile addition";
  const html = `
    <div style="font-family: Georgia, serif; max-width: 520px; margin: 0 auto; color: #3b2f2f;">
      <h2 style="margin-bottom: 4px;">New feedback: ${params.churchName}</h2>
      <table style="font-size: 15px; margin: 16px 0; border-collapse: collapse;">
        <tr><td style="padding: 4px 12px 4px 0; color: #7a6a5a;">Church</td><td><a href="${siteUrl}/church/${params.churchSlug}" style="color: #b06a50;">${params.churchName}</a></td></tr>
        <tr><td style="padding: 4px 12px 4px 0; color: #7a6a5a;">Type</td><td>${kindLabel}</td></tr>
        <tr><td style="padding: 4px 12px 4px 0; color: #7a6a5a;">Message</td><td>${params.message}</td></tr>
      </table>
      <p style="margin: 24px 0;">
        <a href="${siteUrl}/admin/feedback" style="background: #c08888; color: #fff; padding: 12px 28px; border-radius: 999px; text-decoration: none; font-weight: 600;">
          Review feedback
        </a>
      </p>
    </div>
  `.trim();

  await notifyAdmins(`Feedback: ${params.churchName} (${kindLabel})`, html);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function sendChurchContactInquiry(params: {
  churchEmail: string;
  churchName: string;
  churchSlug: string;
  senderName: string;
  senderEmail: string;
  message: string;
}): Promise<void> {
  const { NOTIFY_FROM_EMAIL } = getEmailConfig();
  const siteUrl = getConfiguredSiteUrl();
  const churchUrl = `${siteUrl}/church/${params.churchSlug}`;

  const safeName = escapeHtml(params.senderName);
  const safeEmail = escapeHtml(params.senderEmail);
  const safeMessage = escapeHtml(params.message).replace(/\n/g, "<br>");
  const safeChurchName = escapeHtml(params.churchName);

  const html = `
    <div style="font-family: Georgia, serif; max-width: 560px; margin: 0 auto; color: #3b2f2f;">
      <h2 style="margin-bottom: 4px;">Someone wants to reach ${safeChurchName}</h2>
      <p style="font-size: 14px; color: #7a6a5a; margin-top: 0;">
        Sent through your church listing on
        <a href="${churchUrl}" style="color: #b06a50;">GospelChannel.com</a>.
        Reply directly to this email to respond.
      </p>
      <table style="font-size: 15px; margin: 16px 0; border-collapse: collapse;">
        <tr><td style="padding: 4px 12px 4px 0; color: #7a6a5a;">From</td><td>${safeName}</td></tr>
        <tr><td style="padding: 4px 12px 4px 0; color: #7a6a5a;">Email</td><td><a href="mailto:${safeEmail}" style="color: #b06a50;">${safeEmail}</a></td></tr>
      </table>
      <div style="background: #faf6f3; border-left: 3px solid #d8b8a8; padding: 12px 16px; margin: 16px 0; font-size: 15px; line-height: 1.55;">
        ${safeMessage}
      </div>
      <hr style="border: none; border-top: 1px solid #e8d8d0; margin: 24px 0;" />
      <p style="font-size: 12px; color: #9a8a7a;">
        You are receiving this because your church is listed on GospelChannel.com.
        We hide your email from public view and forward visitor messages to you.
        If you would like to manage your listing, you can claim it at
        <a href="${churchUrl}" style="color: #b06a50;">${churchUrl}</a>.
      </p>
    </div>
  `.trim();

  // Send to the church, with the visitor's email as reply-to so the church can reply directly.
  // Brevo supports replyTo via the API; we add it via a custom send.
  await sendBrevoEmailWithReplyTo({
    to: params.churchEmail,
    from: NOTIFY_FROM_EMAIL,
    replyTo: params.senderEmail,
    replyToName: params.senderName,
    subject: `New message via GospelChannel: ${params.senderName}`,
    html,
  });

  // Also notify admins quietly so we can monitor abuse / volume
  const adminEmailsRaw = process.env.ADMIN_EMAILS;
  if (adminEmailsRaw) {
    const adminHtml = `
      <div style="font-family: Georgia, serif; max-width: 560px; margin: 0 auto; color: #3b2f2f;">
        <h3 style="margin: 0 0 8px 0;">Contact form submission</h3>
        <p style="font-size: 14px; color: #7a6a5a; margin-top: 0;">
          Forwarded to <strong>${escapeHtml(params.churchEmail)}</strong>
        </p>
        <table style="font-size: 14px; margin: 12px 0; border-collapse: collapse;">
          <tr><td style="padding: 3px 12px 3px 0; color: #7a6a5a;">Church</td><td><a href="${churchUrl}" style="color: #b06a50;">${safeChurchName}</a></td></tr>
          <tr><td style="padding: 3px 12px 3px 0; color: #7a6a5a;">From</td><td>${safeName} &lt;${safeEmail}&gt;</td></tr>
        </table>
        <div style="background: #faf6f3; padding: 10px 14px; font-size: 14px;">${safeMessage}</div>
      </div>
    `.trim();
    await notifyAdmins(`Contact form: ${params.churchName}`, adminHtml);
  }
}

async function sendBrevoEmailWithReplyTo(params: {
  to: string;
  from: string;
  replyTo?: string;
  replyToName?: string;
  subject: string;
  html: string;
}): Promise<void> {
  const BREVO_API_KEY = process.env.BREVO_API_KEY;
  if (!BREVO_API_KEY) {
    console.warn("[email] Brevo not configured, contact inquiry not sent");
    return;
  }

  const body: Record<string, unknown> = {
    sender: { name: "Gospel Channel", email: params.from },
    to: [{ email: params.to }],
    subject: params.subject,
    htmlContent: params.html,
  };

  if (params.replyTo) {
    body.replyTo = params.replyToName
      ? { email: params.replyTo, name: params.replyToName }
      : { email: params.replyTo };
  }

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": BREVO_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Brevo error ${res.status}: ${text}`);
  }
}

async function notifyAdmins(subject: string, html: string): Promise<void> {
  const adminEmailsRaw = process.env.ADMIN_EMAILS;
  if (!adminEmailsRaw) {
    console.warn("[email] ADMIN_EMAILS not set, skipping admin notification");
    return;
  }
  const { NOTIFY_FROM_EMAIL } = getEmailConfig();
  const adminEmails = adminEmailsRaw.split(",").map((e) => e.trim()).filter(Boolean);
  for (const adminEmail of adminEmails) {
    await sendEmail({ to: adminEmail, from: NOTIFY_FROM_EMAIL, subject, html });
  }
}
