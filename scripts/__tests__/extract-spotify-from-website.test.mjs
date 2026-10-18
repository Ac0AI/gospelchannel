import { describe, expect, it } from "vitest";
import {
  acceptArtist,
  acceptPlaylist,
  extractSpotifyLinks,
  findMusicPageLinks,
  isChurchOwned,
  isOwnSite,
} from "../extract-spotify-from-website.mjs";

describe("Spotify links on church websites", () => {
  it("collects playlist and artist links, including embeds, once each", () => {
    const html = `
      <a href="https://open.spotify.com/playlist/37i9dQZF1DX0000000000A?si=x">Our songs</a>
      <iframe src="https://open.spotify.com/embed/playlist/37i9dQZF1DX0000000000A"></iframe>
      <a href="https://open.spotify.com/intl-de/artist/1234567890123456789012">Band</a>`;
    expect(extractSpotifyLinks(html)).toEqual([
      { type: "playlist", id: "37i9dQZF1DX0000000000A" },
      { type: "artist", id: "1234567890123456789012" },
    ]);
  });

  it("ignores podcasts and episodes, which are sermons rather than music", () => {
    const html = `<a href="https://open.spotify.com/show/1234567890123456789012">Sermons</a>
      <a href="https://open.spotify.com/episode/1234567890123456789012">Sunday</a>`;
    expect(extractSpotifyLinks(html)).toEqual([]);
  });

  it("only trusts the church's own site", () => {
    expect(isOwnSite("https://gracechurch.org")).toBe(true);
    expect(isOwnSite("www.facebook.com/gracechurch")).toBe(false);
    expect(isOwnSite("https://m.facebook.com/gracechurch")).toBe(false);
    expect(isOwnSite("not a url")).toBe(false);
  });

  it("follows same-site worship and media pages only", () => {
    const html = `
      <a href="/worship">Worship</a>
      <a href="https://other.org/music">Elsewhere</a>
      <a href="/about">About</a>
      <a href="/watch-and-listen">Media</a>
      <a href="/media/">Media</a>`;
    expect(findMusicPageLinks(html, "https://gracechurch.org/")).toEqual([
      "https://gracechurch.org/worship",
      "https://gracechurch.org/watch-and-listen",
    ]);
  });

  it("rejects Spotify-owned playlists", () => {
    const playlist = (owner) => ({ id: "x", owner: { id: owner, display_name: owner } });
    expect(acceptPlaylist(playlist("gracechurch"))).toBe(true);
    expect(acceptPlaylist(playlist("spotify"))).toBe(false);
    expect(acceptPlaylist(null)).toBe(false);
  });

  it("accepts an artist only when it is recognisably the church's own worship team", () => {
    expect(acceptArtist("12Stone Worship", "12stOne Church-Dogwood")).toBe(true);
    expect(acceptArtist("Valley Creek Worship", "Valley Creek Church")).toBe(true);
    expect(acceptArtist("Matt Papa", "Valley Center Community Church")).toBe(false);
    expect(acceptArtist("BEYOND MUS!C", "Every Nation Tshwane Mooikloof")).toBe(false);
    expect(acceptArtist("Bethel Music", "Bethel Baptist Church")).toBe(false);
    expect(acceptArtist("Grace Church Worship", "First Baptist Church")).toBe(false);
    expect(acceptArtist("Calvary Worship Live", "Calvary Christian Center")).toBe(false);
  });

  it("keeps a playlist only when it is the church's own, found in the 520-match audit", () => {
    const pl = (name, owner) => ({ name, owner, type: "playlist" });
    expect(isChurchOwned(pl("ANF Song List", "Tommy Seo"), "All Nations Fellowship of Dallas")).toBe(true);
    expect(isChurchOwned(pl("Weekend Worship", "hopefrisco"), "Hope Fellowship Frisco East")).toBe(true);
    expect(isChurchOwned(pl("Hope Church Sunday Morning Songs", "Hope Community Church"), "Hope Community Church")).toBe(true);
    expect(isChurchOwned(pl("Nocona FBC Worship", "Mudd"), "First Baptist Church", "https://fbcnocona.org")).toBe(true);
    expect(isChurchOwned(pl("Bel Air Church Sunday Playlist", "Creative Bel Air"), "Eagle Rock Presbyterian Church")).toBe(false);
    expect(isChurchOwned(pl("Keith & Kristyn Getty - Essentials", "Getty Music"), "Community Bible Church")).toBe(false);
    expect(isChurchOwned(pl("LIFE Church Songpool", "alessazeiser"), "Freie Christengemeinde e.V.")).toBe(false);
    expect(isChurchOwned(pl("One Of Them Days Official Playlist", "Madison Gate Records"), "Jesus Lifted Me")).toBe(false);
  });
});
