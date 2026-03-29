"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { postAdminAction } from "@/lib/admin-client";

type Status = "pending" | "approved" | "rejected";

type Props = {
  churchSlug: string;
  currentStatus: Status;
};

const statusColors: Record<Status, string> = {
  pending: "bg-amber-50 text-amber-800 ring-amber-200",
  approved: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  rejected: "bg-red-50 text-red-700 ring-red-200",
};

export function AdminCandidateStatusSelect({ churchSlug, currentStatus }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isLocked = currentStatus === "approved";

  const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStatus = e.target.value as Status;
    if (newStatus === currentStatus) return;

    setLoading(true);
    setError("");

    try {
      await postAdminAction("/api/admin/status", {
        table: "churches",
        id: churchSlug,
        status: newStatus,
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-start gap-1">
      <select
        value={currentStatus}
        onChange={handleChange}
        disabled={loading || isLocked}
        className={`rounded-full px-3 py-1.5 text-xs font-semibold ring-1 outline-none transition disabled:opacity-60 ${statusColors[currentStatus]} ${isLocked ? "cursor-not-allowed" : "cursor-pointer"}`}
      >
        {isLocked ? (
          <option value="approved">Approved</option>
        ) : (
          <>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Removed</option>
          </>
        )}
      </select>
      {error ? <span className="text-xs font-semibold text-red-700">{error}</span> : null}
    </div>
  );
}
