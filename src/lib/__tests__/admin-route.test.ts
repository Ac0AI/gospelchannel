import { describe, it, expect, vi, afterEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth/server", () => ({
  getServerUser: vi.fn(),
}));

vi.mock("@/lib/admin-users", () => ({
  isAdminUser: vi.fn(),
}));

import { requireAdminRoute } from "@/lib/admin-route";
import { getServerUser } from "@/lib/auth/server";
import { isAdminUser } from "@/lib/admin-users";

const mockGetServerUser = vi.mocked(getServerUser);
const mockIsAdminUser = vi.mocked(isAdminUser);

function makeRequest() {
  return new NextRequest("http://localhost/api/test", { method: "GET" });
}

describe("requireAdminRoute", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("returns ok:false with status 500 when env vars are missing", async () => {
    vi.stubEnv("BETTER_AUTH_URL", "");
    vi.stubEnv("BETTER_AUTH_SECRET", "");

    const result = await requireAdminRoute(makeRequest());

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(500);
    }
  });

  it("returns ok:false with status 401 when user is not authenticated", async () => {
    vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3000");
    vi.stubEnv("BETTER_AUTH_SECRET", "secret");
    mockGetServerUser.mockResolvedValue(null);

    const result = await requireAdminRoute(makeRequest());

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(401);
    }
  });

  it("returns ok:false with status 403 when user is not an admin", async () => {
    vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3000");
    vi.stubEnv("BETTER_AUTH_SECRET", "secret");
    mockGetServerUser.mockResolvedValue({ id: "user-1", email: "user@example.com" } as never);
    mockIsAdminUser.mockResolvedValue(false);

    const result = await requireAdminRoute(makeRequest());

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(403);
    }
  });

  it("returns ok:true with user passed through when user is an admin", async () => {
    vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3000");
    vi.stubEnv("BETTER_AUTH_SECRET", "secret");
    const mockUser = { id: "admin-1", email: "admin@example.com" };
    mockGetServerUser.mockResolvedValue(mockUser as never);
    mockIsAdminUser.mockResolvedValue(true);

    const result = await requireAdminRoute(makeRequest());

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.user).toEqual(mockUser);
    }
  });
});
