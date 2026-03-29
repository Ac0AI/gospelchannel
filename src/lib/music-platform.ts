type MusicQueryInput = {
  title: string;
  channelTitle?: string;
};

export type MusicPlatformLink = {
  id: "spotify" | "youtube-music" | "apple-music";
  label: string;
  href: string;
};

const NOISE_PATTERNS = [
  /\bofficial\b/gi,
  /\blyrics?\b/gi,
  /\baudio\b/gi,
  /\blive\b/gi,
  /\bvideo\b/gi,
  /\bperformance\b/gi,
  /\bfeat\.?\b/gi,
  /\bft\.?\b/gi,
];

function cleanupTitle(value: string): string {
  let output = value
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/\([^)]*\)/g, " ")
    .replace(/[|]/g, " ");

  for (const pattern of NOISE_PATTERNS) {
    output = output.replace(pattern, " ");
  }

  return output.replace(/\s+/g, " ").trim();
}

function splitArtistAndSong(value: string): { artist?: string; song: string } {
  const match = value.match(/^(.{2,80})\s(?:-|[\u2013\u2014])\s(.{2,120})$/);
  if (!match) {
    return { song: value };
  }

  const [, left, right] = match;
  return {
    artist: left.trim(),
    song: right.trim(),
  };
}

export function buildMusicSearchQuery({ title, channelTitle }: MusicQueryInput): string {
  const cleaned = cleanupTitle(title);
  const parsed = splitArtistAndSong(cleaned);
  const query = parsed.artist
    ? `${parsed.artist} ${parsed.song}`
    : `${cleaned} ${channelTitle ?? ""}`;

  return query.replace(/\s+/g, " ").trim();
}

export function getMusicPlatformLinks(input: MusicQueryInput): MusicPlatformLink[] {
  const query = encodeURIComponent(buildMusicSearchQuery(input));

  return [
    {
      id: "spotify",
      label: "Spotify",
      href: `https://open.spotify.com/search/${query}`,
    },
    {
      id: "youtube-music",
      label: "YouTube Music",
      href: `https://music.youtube.com/search?q=${query}`,
    },
    {
      id: "apple-music",
      label: "Apple Music",
      href: `https://music.apple.com/us/search?term=${query}`,
    },
  ];
}
