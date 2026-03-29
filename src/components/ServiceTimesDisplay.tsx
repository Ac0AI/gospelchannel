import type { ServiceTime } from "@/types/gospel";
import { sanitizeServiceTimes } from "@/lib/content-quality";

export function ServiceTimesDisplay({ times }: { times: ServiceTime[] }) {
  const validTimes = sanitizeServiceTimes(times);
  const grouped = validTimes.reduce<Record<string, ServiceTime[]>>((acc, t) => {
    (acc[t.day] ??= []).push(t);
    return acc;
  }, {});

  if (validTimes.length === 0) {
    return null;
  }

  return (
    <div className="space-y-1">
      {Object.entries(grouped).map(([day, slots]) => (
        <div key={day} className="flex items-baseline gap-2 text-sm">
          <span className="w-24 font-semibold text-espresso">{day}</span>
          <span className="text-warm-brown">
            {slots.map((s) => `${s.time}${s.label ? ` (${s.label})` : ""}`).join(", ")}
          </span>
        </div>
      ))}
    </div>
  );
}
