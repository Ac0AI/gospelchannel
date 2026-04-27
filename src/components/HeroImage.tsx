"use client";

import { useCallback, useMemo, useState } from "react";
import { devMediaImage } from "@/lib/media";

function uniqueSources(src: string, fallbackSrcs: string[] = []): string[] {
  const seen = new Set<string>();
  return [src, ...fallbackSrcs]
    .map((value) => value.trim())
    .map(devMediaImage)
    .filter((value) => {
      if (!value || seen.has(value)) return false;
      seen.add(value);
      return true;
    });
}

export function HeroImage({
  src,
  fallbackSrcs = [],
  className,
}: {
  src: string;
  fallbackSrcs?: string[];
  className?: string;
}) {
  const sources = useMemo(() => uniqueSources(src, fallbackSrcs), [src, fallbackSrcs]);
  const sourceKey = sources.join("\0");
  const [failedSourcesByKey, setFailedSourcesByKey] = useState<Record<string, string[]>>({});
  const failedSources = useMemo(
    () => new Set(failedSourcesByKey[sourceKey] ?? []),
    [failedSourcesByKey, sourceKey],
  );
  const currentSrc = sources.find((source) => !failedSources.has(source));

  const markFailed = useCallback((failedSrc: string) => {
    setFailedSourcesByKey((current) => {
      const existing = current[sourceKey] ?? [];
      if (existing.includes(failedSrc)) return current;
      return {
        ...current,
        [sourceKey]: [...existing, failedSrc],
      };
    });
  }, [sourceKey]);

  if (!currentSrc) return null;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={currentSrc}
      alt=""
      aria-hidden="true"
      loading="eager"
      fetchPriority="high"
      decoding="async"
      className={className}
      ref={(image) => {
        if (image?.complete && image.naturalWidth === 0) {
          markFailed(currentSrc);
        }
      }}
      onError={() => markFailed(currentSrc)}
    />
  );
}
