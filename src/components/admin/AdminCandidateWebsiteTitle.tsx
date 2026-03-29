"use client";

import { useEffect, useState } from "react";
import { loadWebsitePreview } from "@/lib/admin-website-preview-client";

type Props = {
  websiteUrl?: string;
  initialTitle?: string;
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

function shouldRefreshTitle(websiteUrl = "", initialTitle = "", initialFinalUrl = ""): boolean {
  if (!websiteUrl) return false;
  if (!initialTitle) return true;
  if (!initialFinalUrl) return true;
  return getHost(websiteUrl) !== getHost(initialFinalUrl);
}

export function AdminCandidateWebsiteTitle({
  websiteUrl = "",
  initialTitle = "",
  initialFinalUrl = "",
  className = "",
}: Props) {
  const [resolvedTitle, setResolvedTitle] = useState("");

  useEffect(() => {
    if (!shouldRefreshTitle(websiteUrl, initialTitle, initialFinalUrl)) {
      return;
    }

    let cancelled = false;

    loadWebsitePreview(websiteUrl)
      .then((preview) => {
        if (!cancelled && preview.title) {
          setResolvedTitle(preview.title);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [initialFinalUrl, initialTitle, websiteUrl]);

  return (
    <dd className={className}>
      {resolvedTitle || initialTitle || "—"}
    </dd>
  );
}
