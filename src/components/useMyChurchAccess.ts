"use client";

import { useEffect, useState } from "react";

type MyChurchAccessPayload = {
  churchSlug?: string | null;
  churchCount?: number;
};

type MyChurchAccessState = {
  churchSlug: string | null;
  churchCount: number;
  isLoading: boolean;
};

type InternalMyChurchAccessState = MyChurchAccessState & {
  userId: string | null;
};

const EMPTY_ACCESS: MyChurchAccessState = {
  churchSlug: null,
  churchCount: 0,
  isLoading: false,
};

const EMPTY_INTERNAL_ACCESS: InternalMyChurchAccessState = {
  ...EMPTY_ACCESS,
  userId: null,
};

function setMyChurchCookie(slug: string) {
  const expires = new Date(Date.now() + 365 * 864e5).toUTCString();
  document.cookie = `my_church=${encodeURIComponent(slug)};expires=${expires};path=/;SameSite=Lax`;
}

export function useMyChurchAccess(userId: string | null | undefined): MyChurchAccessState {
  const activeUserId = userId ?? null;
  const [access, setAccess] = useState<InternalMyChurchAccessState>(EMPTY_INTERNAL_ACCESS);

  useEffect(() => {
    if (!activeUserId) {
      return;
    }

    let cancelled = false;

    async function loadAccess() {
      try {
        const response = await fetch("/api/church/my-membership", {
          cache: "no-store",
          credentials: "same-origin",
        });

        if (!response.ok) {
          if (!cancelled) setAccess({ ...EMPTY_INTERNAL_ACCESS, userId: activeUserId });
          return;
        }

        const data = (await response.json().catch(() => null)) as MyChurchAccessPayload | null;
        const churchSlug = typeof data?.churchSlug === "string" && data.churchSlug ? data.churchSlug : null;
        const rawCount = typeof data?.churchCount === "number" ? data.churchCount : churchSlug ? 1 : 0;
        const churchCount = Number.isFinite(rawCount) && rawCount > 0 ? rawCount : 0;

        if (churchSlug) {
          setMyChurchCookie(churchSlug);
        }

        if (!cancelled) {
          setAccess({ userId: activeUserId, churchSlug, churchCount, isLoading: false });
        }
      } catch {
        if (!cancelled) setAccess({ ...EMPTY_INTERNAL_ACCESS, userId: activeUserId });
      }
    }

    void loadAccess();

    return () => {
      cancelled = true;
    };
  }, [activeUserId]);

  if (!activeUserId) {
    return EMPTY_ACCESS;
  }

  if (access.userId !== activeUserId) {
    return { ...EMPTY_ACCESS, isLoading: true };
  }

  return {
    churchSlug: access.churchSlug,
    churchCount: access.churchCount,
    isLoading: access.isLoading,
  };
}
