"use client";

import { useState } from "react";
import { VideoCard } from "@/components/VideoCard";

type VideoGridItem = {
  videoId: string;
  title: string;
  thumbnailUrl: string;
  channelTitle?: string;
};

type VideoGridProps = {
  videos: VideoGridItem[];
  ranked?: boolean;
};

export function VideoGrid({ videos, ranked }: VideoGridProps) {
  const [showAll, setShowAll] = useState(false);
  const hasCollapsedVideos = videos.length > 4;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {videos.map((video, index) => (
          <div
            key={video.videoId}
            className={index >= 4 && !showAll ? "hidden sm:block" : ""}
          >
            <VideoCard
              videoId={video.videoId}
              title={video.title}
              channelTitle={video.channelTitle}
              thumbnailUrl={video.thumbnailUrl}
              rank={ranked ? index + 1 : undefined}
            />
          </div>
        ))}
      </div>
      {hasCollapsedVideos && !showAll && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="inline-flex rounded-full border border-rose-200/70 bg-white px-4 py-2 text-sm font-semibold text-espresso shadow-sm transition-colors hover:bg-blush-light sm:hidden"
        >
          Show all {videos.length} videos
        </button>
      )}
    </div>
  );
}
