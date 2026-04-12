"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AdminLogout } from "@/components/AdminLogout";
import { ChurchAdminLogoutButton } from "@/components/church-admin/ChurchAdminLogoutButton";

type ViewerMode = "anonymous" | "owner" | "church" | "admin";

type ViewerResponse = {
  mode?: ViewerMode;
};

export function ChurchViewerActions({ churchSlug }: { churchSlug: string }) {
  const [mode, setMode] = useState<ViewerMode>("anonymous");

  useEffect(() => {
    let cancelled = false;

    async function loadViewerMode() {
      try {
        const response = await fetch(`/api/church/${encodeURIComponent(churchSlug)}/viewer`, {
          cache: "no-store",
          credentials: "same-origin",
        });
        if (!response.ok) return;
        const data = (await response.json()) as ViewerResponse;
        if (!cancelled && data.mode) {
          setMode(data.mode);
        }
      } catch {
        // Public church pages should stay fully usable if viewer lookup fails.
      }
    }

    void loadViewerMode();

    return () => {
      cancelled = true;
    };
  }, [churchSlug]);

  if (mode !== "owner" && mode !== "church" && mode !== "admin") {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {mode === "owner" && (
        <Link
          href={`/church/${churchSlug}/manage`}
          className="inline-flex items-center rounded-full bg-white/12 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/20"
        >
          Manage page
        </Link>
      )}
      {mode === "church" && (
        <Link
          href="/church-admin"
          className="inline-flex items-center rounded-full bg-white/12 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/20"
        >
          Church Admin
        </Link>
      )}
      {mode === "admin" && (
        <Link
          href="/admin"
          className="inline-flex items-center rounded-full bg-white/12 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/20"
        >
          Open admin
        </Link>
      )}
      {mode === "admin" ? (
        <AdminLogout className="border-white/25 bg-white/8 text-white hover:bg-white/16" />
      ) : (
        <ChurchAdminLogoutButton className="border-white/25 bg-white/8 text-white hover:bg-white/16" />
      )}
    </div>
  );
}
