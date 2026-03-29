import type { ChurchConfig, SpotifyTrack } from "@/types/gospel";
import { readJsonFile } from "@/lib/json-store";
import { uniqueBy } from "@/lib/utils";

type SpotifyTokenCache = {
  token: string;
  expiresAt: number;
};

type SpotifyPlaylistResponse = {
  items: Array<{
    track: {
      id: string | null;
      name: string;
      artists: Array<{ name: string }>;
      album?: { images?: Array<{ url: string }> };
    } | null;
  }>;
  next: string | null;
};

type ManualTrack = {
  spotifyId: string;
  title: string;
  artist: string;
  youtubeVideoId?: string;
};

let tokenCache: SpotifyTokenCache | null = null;

async function getSpotifyToken(): Promise<string | null> {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return null;
  }

  if (tokenCache && Date.now() < tokenCache.expiresAt) {
    return tokenCache.token;
  }

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as {
    access_token: string;
    expires_in: number;
  };

  tokenCache = {
    token: payload.access_token,
    expiresAt: Date.now() + payload.expires_in * 1000 - 20_000,
  };

  return tokenCache.token;
}

async function fetchPlaylistTracks(playlistId: string): Promise<SpotifyTrack[]> {
  const token = await getSpotifyToken();
  if (!token) {
    return [];
  }

  const tracks: SpotifyTrack[] = [];
  let nextUrl: string | null = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=50`;

  while (nextUrl) {
    const response = await fetch(nextUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      if (response.status === 403) {
        console.warn(`Spotify playlist blocked (likely Extended Quota required): ${playlistId}`);
      }
      return [];
    }

    const payload = (await response.json()) as SpotifyPlaylistResponse;
    for (const item of payload.items) {
      const track = item.track;
      if (!track || !track.id) {
        continue;
      }

      tracks.push({
        spotifyId: track.id,
        title: track.name,
        artist: track.artists.map((artist) => artist.name).join(", "),
        albumArt: track.album?.images?.[0]?.url,
      });
    }

    nextUrl = payload.next;
  }

  return tracks;
}

async function getManualTracks(slug: string): Promise<SpotifyTrack[]> {
  const rows = await readJsonFile<ManualTrack[]>(`manual/${slug}.json`, []);
  return rows.map((row) => ({
    spotifyId: row.spotifyId,
    title: row.title,
    artist: row.artist,
    manualYoutubeVideoId: row.youtubeVideoId,
  }));
}

export async function getChurchSpotifyTracks(church: ChurchConfig): Promise<{
  tracks: SpotifyTrack[];
  source: "spotify" | "manual";
  message?: string;
}> {
  const collected: SpotifyTrack[] = [];

  for (const playlistId of church.spotifyPlaylistIds) {
    const tracks = await fetchPlaylistTracks(playlistId);
    collected.push(...tracks);
  }

  const uniqueTracks = uniqueBy(collected, (track) => track.spotifyId);
  if (uniqueTracks.length > 0) {
    return {
      tracks: uniqueTracks,
      source: "spotify",
    };
  }

  const manual = await getManualTracks(church.slug);
  return {
    tracks: manual,
    source: "manual",
    message:
      "Spotify API returned no usable items. Extended Quota or collaborator access may be required.",
  };
}
