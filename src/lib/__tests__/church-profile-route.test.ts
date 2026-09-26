import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

vi.mock('@/lib/auth/server', () => ({ getServerUser: vi.fn() }));
vi.mock('@/lib/church-community', () => ({ getChurchMembershipForUserAndSlug: vi.fn() }));
vi.mock('@/lib/content', () => ({ getChurchBySlugAsync: vi.fn(), revalidatePublicChurchContent: vi.fn() }));
vi.mock('@/lib/neon-client', () => ({ createAdminClient: vi.fn() }));
vi.mock('@/lib/church-updates', () => ({ syncChurchUpdateSourcesFromProfileEdit: vi.fn() }));
vi.mock('@/lib/church-profile', () => ({ submitProfileEdit: vi.fn(), getProfileEditsForChurch: vi.fn() }));

import { POST } from '@/app/api/church/profile/route';
import { getServerUser } from '@/lib/auth/server';
import { getChurchMembershipForUserAndSlug } from '@/lib/church-community';
import { getChurchBySlugAsync, revalidatePublicChurchContent } from '@/lib/content';
import { createAdminClient } from '@/lib/neon-client';
import { submitProfileEdit } from '@/lib/church-profile';
import { syncChurchUpdateSourcesFromProfileEdit } from '@/lib/church-updates';

function request(churchSlug: string, fieldName: string, fieldValue: unknown) {
  return new NextRequest('http://localhost/api/church/profile', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ churchSlug, fieldName, fieldValue }),
  });
}

describe('church profile edits', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerUser).mockResolvedValue({ id: 'owner-1' } as never);
    vi.mocked(getChurchBySlugAsync).mockImplementation(async slug => ({ slug, name: 'Church' }) as never);
    vi.mocked(getChurchMembershipForUserAndSlug).mockResolvedValue({ id: 'membership-1' } as never);
    vi.mocked(createAdminClient).mockReturnValue({
      from: () => ({ select: () => ({ eq: () => ({ limit: () => ({ maybeSingle: async () => ({ data: null }) }) }) }) }),
    } as never);
    vi.mocked(submitProfileEdit).mockResolvedValue({ reviewStatus: 'auto_approved' } as never);
    vi.mocked(syncChurchUpdateSourcesFromProfileEdit).mockResolvedValue(undefined);
  });

  it.each(['established-church', 'newly-approved-church'])('accepts an owner edit for %s', async churchSlug => {
    const response = await POST(request(churchSlug, 'phone', '+49 30 1234567'));
    expect(response.status).toBe(200);
    expect(submitProfileEdit).toHaveBeenCalledWith(expect.objectContaining({ churchSlug, fieldName: 'phone' }));
    expect(revalidatePublicChurchContent).toHaveBeenCalledOnce();
  });

  it('rejects edits without membership', async () => {
    vi.mocked(getChurchMembershipForUserAndSlug).mockResolvedValue(null);
    const response = await POST(request('established-church', 'phone', '+49 30 1234567'));
    expect(response.status).toBe(403);
    expect(submitProfileEdit).not.toHaveBeenCalled();
  });

  it('rejects unknown fields before saving', async () => {
    const response = await POST(request('established-church', 'status', 'approved'));
    expect(response.status).toBe(400);
    expect(submitProfileEdit).not.toHaveBeenCalled();
  });
});
