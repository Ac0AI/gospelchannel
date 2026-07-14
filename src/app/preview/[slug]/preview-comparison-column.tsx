// Lives outside page.tsx because Next.js only allows route exports from a
// page module, and the mobile-shrink test imports this component directly.
export function PreviewComparisonColumn({ children }: { children: React.ReactNode }) {
  return <div className="min-w-0">{children}</div>;
}
