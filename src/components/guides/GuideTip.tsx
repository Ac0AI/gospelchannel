import type { ReactNode } from "react";

interface GuideTipProps {
  label: string;
  children: ReactNode;
}

export function GuideTip({ label, children }: GuideTipProps) {
  return (
    <aside className="my-6 rounded-2xl bg-mauve-light px-5 py-4">
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-mauve">
        {label}
      </p>
      <div className="mt-1.5 text-sm leading-relaxed text-espresso">
        {children}
      </div>
    </aside>
  );
}
