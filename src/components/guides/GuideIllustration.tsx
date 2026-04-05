import { cfImage } from "@/lib/media";

interface GuideIllustrationProps {
  src: string;
  alt: string;
  wide?: boolean;
}

export function GuideIllustration({ src, alt, wide }: GuideIllustrationProps) {
  const optimized = cfImage(src, {
    width: wide ? 1200 : 800,
    quality: 80,
    format: "auto",
  });

  return (
    <img
      src={optimized}
      alt={alt}
      loading="lazy"
      className={
        wide
          ? "-mx-4 my-10 w-full sm:-mx-6"
          : "my-8 w-full rounded-2xl"
      }
    />
  );
}
