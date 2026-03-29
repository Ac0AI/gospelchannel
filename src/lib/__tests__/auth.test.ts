import { describe, expect, it } from "vitest";
import { createTemporaryUserPassword } from "../auth";

describe("createTemporaryUserPassword", () => {
  it("stays within Supabase password length limits", () => {
    const password = createTemporaryUserPassword();

    expect(password.length).toBeGreaterThanOrEqual(6);
    expect(password.length).toBeLessThanOrEqual(72);
  });
});
