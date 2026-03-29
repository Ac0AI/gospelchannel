function normalizeEmail(value?: string | null): string {
  return (value || "").trim().toLowerCase();
}

export function createTemporaryUserPassword(): string {
  // Supabase Auth enforces a max password length, and OTP login only needs
  // a random placeholder secret for accounts created during claim verification.
  return crypto.randomUUID();
}

export function getAdminEmails(): string[] {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((value) => normalizeEmail(value))
    .filter(Boolean);
}

export function isAdminEmail(email?: string | null): boolean {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;
  return getAdminEmails().includes(normalized);
}
