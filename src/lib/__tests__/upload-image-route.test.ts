import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockUpload = vi.fn().mockResolvedValue({ error: null });
const mockGetPublicUrl = vi.fn().mockReturnValue({
  data: { publicUrl: "https://example.com/x.png" },
});

vi.mock("@/lib/auth/server", () => ({
  getServerUser: vi.fn(),
}));

vi.mock("@/lib/church-community", () => ({
  getChurchMembershipForUserAndSlug: vi.fn(),
}));

vi.mock("@/lib/neon-client", () => ({
  createAdminClient: vi.fn(() => ({
    storage: {
      from: () => ({
        upload: mockUpload,
        getPublicUrl: mockGetPublicUrl,
      }),
    },
  })),
}));

import { POST } from "@/app/api/church/upload-image/route";
import { getServerUser } from "@/lib/auth/server";
import { getChurchMembershipForUserAndSlug } from "@/lib/church-community";

const mockGetServerUser = vi.mocked(getServerUser);
const mockGetMembership = vi.mocked(getChurchMembershipForUserAndSlug);

const mockUser = { id: "user-1", email: "user@example.com" };
const mockMembership = { id: "membership-1", churchSlug: "test-church", userId: "user-1" };

function makeFormDataRequest(fields: Record<string, string | File>) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    formData.append(key, value);
  }
  return new NextRequest("http://localhost/api/church/upload-image", {
    method: "POST",
    body: formData,
  });
}

function makeSmallPngFile(name = "logo.png") {
  return new File([new Uint8Array(10)], name, { type: "image/png" });
}

function makeLargeFile(sizeBytes: number, name = "large.png") {
  return new File([new Uint8Array(sizeBytes)], name, { type: "image/png" });
}

describe("POST /api/church/upload-image", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerUser.mockResolvedValue(mockUser as never);
    mockGetMembership.mockResolvedValue(mockMembership as never);
    mockUpload.mockResolvedValue({ error: null });
    mockGetPublicUrl.mockReturnValue({ data: { publicUrl: "https://example.com/x.png" } });
  });

  it("returns 401 when user is not authenticated", async () => {
    mockGetServerUser.mockResolvedValue(null);

    const request = makeFormDataRequest({
      file: makeSmallPngFile(),
      churchSlug: "test-church",
      fieldName: "logo_url",
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it("returns 400 when fieldName is missing", async () => {
    const request = makeFormDataRequest({
      file: makeSmallPngFile(),
      churchSlug: "test-church",
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it("returns 400 for unknown fieldName (hero_url)", async () => {
    const request = makeFormDataRequest({
      file: makeSmallPngFile(),
      churchSlug: "test-church",
      fieldName: "hero_url",
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toMatch(/unsupported/i);
  });

  it("returns 400 for SVG uploaded to cover_image_url (SVG not allowed there)", async () => {
    const svgFile = new File([new Uint8Array(10)], "logo.svg", { type: "image/svg+xml" });
    const request = makeFormDataRequest({
      file: svgFile,
      churchSlug: "test-church",
      fieldName: "cover_image_url",
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toMatch(/invalid file type/i);
  });

  it("returns 400 for file larger than 2MB", async () => {
    const threeМegFile = makeLargeFile(3 * 1024 * 1024);
    const request = makeFormDataRequest({
      file: threeМegFile,
      churchSlug: "test-church",
      fieldName: "logo_url",
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toMatch(/max 2 mb/i);
  });

  it("returns 403 when user has no membership, and upload is never called", async () => {
    mockGetMembership.mockResolvedValue(null);

    const request = makeFormDataRequest({
      file: makeSmallPngFile(),
      churchSlug: "test-church",
      fieldName: "logo_url",
    });

    const response = await POST(request);
    expect(response.status).toBe(403);
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it("returns 200 with url on happy path for logo_url PNG", async () => {
    const request = makeFormDataRequest({
      file: makeSmallPngFile(),
      churchSlug: "test-church",
      fieldName: "logo_url",
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.url).toBe("https://example.com/x.png");
    expect(mockUpload).toHaveBeenCalledTimes(1);
  });

  it("uses extension from MIME type (not filename) even when file is named evil.html with type image/png", async () => {
    const evilFile = new File([new Uint8Array(10)], "evil.html", { type: "image/png" });
    const request = makeFormDataRequest({
      file: evilFile,
      churchSlug: "test-church",
      fieldName: "logo_url",
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    // The upload path argument (first arg) should end with .png, not .html
    const uploadPath = mockUpload.mock.calls[0][0] as string;
    expect(uploadPath).toMatch(/\.png$/);
    expect(uploadPath).not.toMatch(/\.html/);
  });
});
