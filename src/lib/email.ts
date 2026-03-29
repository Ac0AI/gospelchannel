import { getConfiguredSiteUrl } from "@/lib/site-url";

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const AUTH_FROM_EMAIL = process.env.AUTH_FROM_EMAIL || "noreply@gospelchannel.com";
const NOTIFY_FROM_EMAIL = process.env.NOTIFY_FROM_EMAIL || AUTH_FROM_EMAIL;

async function sendBrevoEmail(params: {
  to: string;
  subject: string;
  html: string;
  from?: string;
}): Promise<boolean> {
  if (!BREVO_API_KEY) {
    return false;
  }

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

async function sendResendEmail(params: {
  to: string;
  subject: string;
  html: string;
  from?: string;
}): Promise<boolean> {
  if (!RESEND_API_KEY) {
    return false;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: params.from || NOTIFY_FROM_EMAIL,
      to: [params.to],
      subject: params.subject,
      html: params.html,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`[email] Resend error ${res.status}: ${body}`);
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
  if (await sendResendEmail(params)) {
    return;
  }

  if (await sendBrevoEmail(params)) {
    return;
  }

  console.warn("[email] No configured provider accepted the email");
}

export async function sendAuthOtpEmail(params: {
  email: string;
  otp: string;
}): Promise<void> {
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
  const siteUrl = getConfiguredSiteUrl();
  const loginUrl = `${siteUrl}/church-admin/login`;
  const churchUrl = `${siteUrl}/church/${params.churchSlug}`;

  const html = `
    <div style="font-family: Georgia, serif; max-width: 520px; margin: 0 auto; color: #3b2f2f;">
      <h2 style="margin-bottom: 4px;">Your claim has been verified</h2>
      <p>
        Great news — your claim for <strong>${params.churchName}</strong> has been approved.
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
        <a href="${churchUrl}" style="color: #c08888;">View your church page</a> · Gospel Channel
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
