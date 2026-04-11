import type { ServiceTime } from "@/types/gospel";
import { sanitizeServiceTimes } from "@/lib/content-quality";

const DAY_LABELS: Record<string, string> = {
  Monday: "Monday",
  Tuesday: "Tuesday",
  Wednesday: "Wednesday",
  Thursday: "Thursday",
  Friday: "Friday",
  Saturday: "Saturday",
  Sunday: "Sunday",
  Måndag: "Monday",
  Tisdag: "Tuesday",
  Onsdag: "Wednesday",
  Torsdag: "Thursday",
  Fredag: "Friday",
  Lördag: "Saturday",
  Söndag: "Sunday",
};

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
          <span className="w-24 font-semibold text-espresso">{DAY_LABELS[day] ?? day}</span>
          <span className="text-warm-brown">
            {slots.map((s) => `${s.time}${s.label ? ` (${s.label})` : ""}`).join(", ")}
          </span>
        </div>
      ))}
    </div>
  );
}
