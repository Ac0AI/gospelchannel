type AdSlotProps = {
  id: string;
  className?: string;
  label?: string;
};

export function AdSlot({ id, className = "", label = "Advertisement" }: AdSlotProps) {
  return (
    <div
      id={id}
      className={`flex min-h-20 w-full items-center justify-center rounded-xl border border-dashed border-amber-300 bg-amber-50 text-xs uppercase tracking-wide text-zinc-500 ${className}`}
    >
      {label}
    </div>
  );
}
