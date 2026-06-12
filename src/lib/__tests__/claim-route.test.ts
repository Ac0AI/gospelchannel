import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/church-community", () => ({
  addChurchClaim: vi.fn(),
}));

vi.mock("@/lib/content", () => ({
  getChurchBySlugAsync: vi.fn(),
}));

vi.mock("@/lib/email", () => ({
  sendClaimReceivedEmail: vi.fn().mockResolvedValue(undefined),
  sendClaimAdminNotification: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/request-guards", () => ({
  getClientIp: vi.fn().mockReturnValue("127.0.0.1"),
  hasKvRateLimit: vi.fn().mockResolvedValue(false),
  isBotTrapFilled: vi.fn().mockReturnValue(false),
  setKvRateLimit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/posthog-server", () => ({
  captureServerEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: vi.fn().mockResolvedValue({
    ctx: { waitUntil: vi.fn() },
  }),
}));

import { POST } from "@/app/api/church/claim/route";
import { addChurchClaim } from "@/lib/church-community";
import { getChurchBySlugAsync } from "@/lib/content";
import { hasKvRateLimit, isBotTrapFilled } from "@/lib/request-guards";
import { getCloudflareContext } from "@opennextjs/cloudflare";

const mockAddChurchClaim = vi.mocked(addChurchClaim);
const mockGetChurchBySlugAsync = vi.mocked(getChurchBySlugAsync);
const mockHasKvRateLimit = vi.mocked(hasKvRateLimit);
const mockIsBotTrapFilled = vi.mocked(isBotTrapFilled);
const mockGetCloudflareContext = vi.mocked(getCloudflareContext);

const defaultChurch = { slug: "test-church", name: "Test Church" };

const validPayload = {
  churchSlug: "test-church",
  name: "John Smith",
  role: "Pastor",
  email: "john@example.com",
  message: "I am the pastor of this church",
  companyWebsite: "",
};

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/church/claim", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

function makeBadRequest() {
  return new NextRequest("http://localhost/api/church/claim", {
    method: "POST",
    body: "not-valid-json{{{",
    headers: { "content-type": "application/json" },
  });
}

describe("POST /api/church/claim", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetChurchBySlugAsync.mockResolvedValue(defaultChurch as never);
    mockAddChurchClaim.mockResolvedValue({ id: "claim-1" } as never);
    mockHasKvRateLimit.mockResolvedValue(false);
    mockIsBotTrapFilled.mockReturnValue(false);
    mockGetCloudflareContext.mockResolvedValue({
      ctx: { waitUntil: vi.fn() },
    } as never);
  });

  it("returns 400 for malformed JSON body", async () => {
    const response = await POST(makeBadRequest());
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe("Invalid request");
  });

  it("returns 200 fake success when honeypot is filled, without calling addChurchClaim", async () => {
    mockIsBotTrapFilled.mockReturnValue(true);

    const response = await POST(makeRequest({ ...validPayload, companyWebsite: "https://spam.com" }));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(mockAddChurchClaim).not.toHaveBeenCalled();
  });

  it("returns 404 when church is unknown", async () => {
    mockGetChurchBySlugAsync.mockResolvedValue(null as never);

    const response = await POST(makeRequest({ ...validPayload, churchSlug: "unknown-church" }));
    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toMatch(/unknown church/i);
  });

  it("returns 400 when name is too short (1 character)", async () => {
    const response = await POST(makeRequest({ ...validPayload, name: "A" }));
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toMatch(/name/i);
  });

  it("returns 400 when email is invalid", async () => {
    const response = await POST(makeRequest({ ...validPayload, email: "not-an-email" }));
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toMatch(/email/i);
  });

  it("returns 429 when rate limited", async () => {
    mockHasKvRateLimit.mockResolvedValue(true);

    const response = await POST(makeRequest(validPayload));
    expect(response.status).toBe(429);
    const data = await response.json();
    expect(data.error).toBeDefined();
  });

  it("returns 200 with claim id on happy path, calls addChurchClaim and waitUntil once", async () => {
    const mockWaitUntil = vi.fn();
    mockGetCloudflareContext.mockResolvedValue({
      ctx: { waitUntil: mockWaitUntil },
    } as never);

    const response = await POST(makeRequest(validPayload));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.id).toBe("claim-1");
    expect(mockAddChurchClaim).toHaveBeenCalledTimes(1);
    expect(mockWaitUntil).toHaveBeenCalledTimes(1);
  });
});
