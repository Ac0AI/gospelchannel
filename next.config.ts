import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  async redirects() {
    return [
      {
        source: "/discover",
        destination: "/church",
        permanent: true,
      },
      {
        source: "/trending",
        destination: "/church",
        permanent: true,
      },
      {
        source: "/pray",
        destination: "/prayerwall",
        permanent: true,
      },
      {
        source: "/tools",
        destination: "/guides",
        permanent: true,
      },
      {
        source: "/tools/:path*",
        destination: "/guides/:path*",
        permanent: true,
      },
    ];
  },
  async rewrites() {
    return [
      { source: "/ingest/static/:path*", destination: "https://eu-assets.i.posthog.com/static/:path*" },
      { source: "/ingest/:path*", destination: "https://eu.i.posthog.com/:path*" },
      { source: "/ingest/decide", destination: "https://eu.i.posthog.com/decide" },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob: https://media.gospelchannel.com https://i.ytimg.com https://i.scdn.co https://mosaic.scdn.co https://*.googleusercontent.com",
              "frame-src 'self' https://open.spotify.com https://www.youtube.com https://embed.music.apple.com",
              "frame-ancestors 'self'",
              "connect-src 'self' https://eu.i.posthog.com https://eu-assets.i.posthog.com https://api.posthog.com",
              "media-src 'self' https://media.gospelchannel.com",
            ].join("; "),
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "i.ytimg.com",
      },
      {
        protocol: "https",
        hostname: "i.scdn.co",
      },
      {
        protocol: "https",
        hostname: "media.gospelchannel.com",
      },
    ],
  },
};

export default nextConfig;
