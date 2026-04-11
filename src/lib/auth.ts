export function createTemporaryUserPassword(): string {
  // Auth enforces a max password length, and OTP login only needs
  // a random placeholder secret for accounts created during claim verification.
  return crypto.randomUUID();
}
