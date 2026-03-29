"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { postAdminAction } from "@/lib/admin-client";

type Props = {
  table: string;
  id: string;
  status: string;
  label: string;
  variant?: "approve" | "reject" | "neutral";
};

const variantClass = {
  approve: "bg-emerald-600 text-white hover:bg-emerald-700",
  reject: "bg-red-500 text-white hover:bg-red-600",
  neutral: "bg-gray-200 text-gray-700 hover:bg-gray-300",
};

export function AdminStatusButton({ table, id, status, label, variant = "neutral" }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleClick = async () => {
    const action = variant === "reject" ? "reject" : variant === "approve" ? "approve" : "update";
    if (!confirm(`Are you sure you want to ${action} this item?`)) return;

    setLoading(true);
    setError("");

    try {
      await postAdminAction("/api/admin/status", { table, id, status });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className={`rounded-full px-3 py-1 text-xs font-semibold transition disabled:opacity-50 ${variantClass[variant]}`}
      >
        {loading ? "..." : label}
      </button>
      {error ? <span className="text-xs font-semibold text-red-700">{error}</span> : null}
    </div>
  );
}
