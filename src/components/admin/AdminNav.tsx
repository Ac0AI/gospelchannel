import Link from "next/link";

const sections = [
  { href: "/admin", label: "Dashboard", key: "dashboard" },
  { href: "/admin/suggestions", label: "Suggestions", key: "suggestions" },
  { href: "/admin/feedback", label: "Feedback", key: "feedback" },
  { href: "/admin/claims", label: "Claims", key: "claims" },
  { href: "/admin/candidates", label: "Candidates", key: "candidates" },
  { href: "/admin/edits", label: "Profile Edits", key: "edits" },
  { href: "/admin/website-tech", label: "Website Tech", key: "website-tech" },
];

type Props = {
  activeHref: string;
  counts?: Record<string, number>;
};

export function AdminNav({ activeHref, counts }: Props) {
  return (
    <nav className="mb-6 flex flex-wrap gap-2">
      {sections.map((section) => {
        const isActive = activeHref === section.href;
        const count = counts?.[section.key] ?? 0;
        return (
          <Link
            key={section.href}
            href={section.href}
            className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
              isActive
                ? "bg-espresso text-white shadow-sm"
                : "bg-white text-warm-brown ring-1 ring-rose-200/70 hover:bg-blush-light hover:text-espresso"
            }`}
          >
            {section.label}
            {count > 0 && (
              <span className={`inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none ${
                isActive ? "bg-white/20 text-white" : "bg-rose-gold text-white"
              }`}>
                {count}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
