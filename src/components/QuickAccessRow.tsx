import Image from "next/image";
import Link from "next/link";

type ChurchOption = {
  slug: string;
  name: string;
  country: string;
  thumbnailUrl?: string;
  logoUrl?: string;
};

const GRADIENTS = [
  "from-rose-400 to-pink-500",
  "from-violet-400 to-purple-500",
  "from-sky-400 to-blue-500",
  "from-amber-400 to-orange-500",
  "from-emerald-400 to-teal-500",
  "from-fuchsia-400 to-pink-600",
  "from-indigo-400 to-violet-500",
  "from-teal-400 to-cyan-500",
];

function getGradient(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return GRADIENTS[Math.abs(hash) % GRADIENTS.length];
}

export function QuickAccessRow({ churches }: { churches: ChurchOption[] }) {
  if (churches.length === 0) return null;

  return (
    <div className="scrollbar-hide -mx-4 flex gap-3 overflow-x-auto px-4 py-1 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8" style={{ scrollSnapType: "x mandatory" }}>
      {churches.map((church) => (
        <Link
          key={church.slug}
          href={`/church/${church.slug}`}
          className="flex w-16 shrink-0 flex-col items-center gap-1.5 active:scale-95"
          style={{ scrollSnapAlign: "start" }}
        >
          <div className={`relative h-14 w-14 overflow-hidden rounded-full ring-2 ring-rose-200/60 ${church.thumbnailUrl || church.logoUrl ? "" : `flex items-center justify-center bg-gradient-to-br ${getGradient(church.name)}`}`}>
            {church.thumbnailUrl || church.logoUrl ? (
              <Image
                src={church.thumbnailUrl || church.logoUrl || "/churches/default-church.svg"}
                alt={church.name}
                fill
                className={church.thumbnailUrl ? "object-cover" : "object-contain p-2"}
                sizes="56px"
              />
            ) : (
              <span className="text-sm font-bold text-white/90">
                {church.name.split(/[\s-]+/).map((w) => w[0]).slice(0, 2).join("")}
              </span>
            )}
          </div>
          <span className="w-full truncate text-center text-[11px] font-medium text-warm-brown">
            {church.name.split(/\s+/).slice(0, 2).join(" ")}
          </span>
        </Link>
      ))}
    </div>
  );
}
