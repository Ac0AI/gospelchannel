import Image from "next/image";
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
    <Image
      unoptimized
      src={optimized}
      alt={alt}
      width={wide ? 1200 : 800}
      height={wide ? 675 : 900}
      sizes={wide ? "100vw" : "(max-width: 768px) 100vw, 800px"}
      className={
        wide
          ? "-mx-4 my-10 h-auto w-full sm:-mx-6"
          : "my-8 h-auto w-full rounded-2xl"
      }
    />
  );
}
