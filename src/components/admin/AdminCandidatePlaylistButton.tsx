"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { postAdminAction } from "@/lib/admin-client";

type Props = {
  churchSlug: string;
  playlistId: string;
  status: "kept" | "rejected";
  label: string;
  variant?: "approve" | "reject" | "neutral";
};

const variantClass = {
  approve: "bg-emerald-600 text-white hover:bg-emerald-700",
  reject: "bg-red-500 text-white hover:bg-red-600",
  neutral: "bg-gray-200 text-gray-700 hover:bg-gray-300",
};

export function AdminCandidatePlaylistButton({
  churchSlug,
  playlistId,
  status,
  label,
  variant = "neutral",
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleClick = async () => {
    setLoading(true);
    setError("");

    try {
      await postAdminAction("/api/admin/candidate-playlists", { churchSlug, playlistId, status });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update playlist");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className={`rounded-full px-3 py-1 text-xs font-semibold transition disabled:opacity-50 ${variantClass[variant]}`}
      >
        {loading ? "..." : label}
      </button>
      {error ? <span className="text-right text-xs font-semibold text-red-700">{error}</span> : null}
    </div>
  );
}
