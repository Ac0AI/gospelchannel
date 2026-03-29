"use client";

import { useEffect, useState } from "react";
import { loadWebsitePreview } from "@/lib/admin-website-preview-client";

type Props = {
  websiteUrl?: string;
  initialEmail?: string;
  initialFinalUrl?: string;
  className?: string;
};

function getHost(url = ""): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function shouldRefreshEmail(websiteUrl = "", initialEmail = "", initialFinalUrl = ""): boolean {
  if (!websiteUrl) return false;
  if (!initialEmail) return true;
  if (!initialFinalUrl) return true;
  return getHost(websiteUrl) !== getHost(initialFinalUrl);
}

export function AdminCandidateWebsiteEmail({
  websiteUrl = "",
  initialEmail = "",
  initialFinalUrl = "",
  className = "",
}: Props) {
  const [resolvedEmail, setResolvedEmail] = useState("");

  useEffect(() => {
    if (!shouldRefreshEmail(websiteUrl, initialEmail, initialFinalUrl)) {
      return;
    }

    let cancelled = false;

    loadWebsitePreview(websiteUrl)
      .then((preview) => {
        if (!cancelled && preview.contactEmail) {
          setResolvedEmail(preview.contactEmail);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [initialEmail, initialFinalUrl, websiteUrl]);

  return (
    <dd className={className}>
      {resolvedEmail || initialEmail || "—"}
    </dd>
  );
}
