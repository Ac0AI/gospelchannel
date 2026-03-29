"use client";

import { useEffect, useState } from "react";
import { SectionHeader } from "@/components/SectionHeader";
import { VideoGrid } from "@/components/VideoGrid";

type MovedVideo = {
  videoId: string;
  title: string;
  thumbnailUrl: string;
  channelTitle?: string;
  movedCount?: number;
};

type MostMovedSectionProps = {
  initialVideos: MovedVideo[];
};

export function MostMovedSection({ initialVideos }: MostMovedSectionProps) {
  const [videos, setVideos] = useState<MovedVideo[]>(initialVideos);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch("/api/moved/top?period=7d&limit=8", { cache: "no-store" });
        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as {
          videos?: Array<{
            videoId: string;
            title: string;
            thumbnailUrl: string;
            artist?: string;
            movedCount?: number;
          }>;
        };

        if (!payload.videos || payload.videos.length === 0) {
          return;
        }

        setVideos(
          payload.videos.map((video) => ({
            videoId: video.videoId,
            title: video.title,
            thumbnailUrl: video.thumbnailUrl,
            channelTitle: video.artist,
            movedCount: video.movedCount ?? 0,
          }))
        );
      } catch {
        // Keep server fallback if the live endpoint fails.
      }
    };

    void load();
  }, []);

  return (
    <section>
      <SectionHeader
        eyebrow="Your Community Worships"
        title="Most Moved This Week"
        subtitle="These are the songs that touched people the deepest. Real reactions from real worshippers — just like you."
      />
      <VideoGrid videos={videos} />
    </section>
  );
}
