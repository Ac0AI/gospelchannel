import type { ReactNode } from "react";

interface GuideStepProps {
  id?: string;
  step?: number;
  title: string;
  children: ReactNode;
}

export function GuideStep({ id, step, title, children }: GuideStepProps) {
  return (
    <section id={id} className="scroll-mt-24">
      {step != null && (
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-mauve">
          Step {step}
        </p>
      )}
      <h2 className="font-serif text-2xl font-bold text-espresso">{title}</h2>
      <div className="mt-4 space-y-4 text-base leading-relaxed text-warm-brown [&>p>em]:text-muted-warm">
        {children}
      </div>
    </section>
  );
}
