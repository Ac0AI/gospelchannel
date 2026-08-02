import { describe, expect, it } from "vitest";
import {
  buildQuery,
  pickBestMatch,
  scorePlaylist,
} from "../enrich-spotify-by-church-name.mjs";

const church = (overrides = {}) => ({
  name: "Grace Church Stockholm",
  location: "Stockholm",
  ambiguousName: false,
  ...overrides,
});

const playlist = (overrides = {}) => ({
  id: "1234567890123456789012",
  name: "Grace Church Stockholm Worship",
  description: "",
  owner: { id: "gracechurchstockholm", display_name: "Grace Church Stockholm" },
  external_urls: { spotify: "https://open.spotify.com/playlist/1234567890123456789012" },
  ...overrides,
});

describe("Spotify church playlist matcher", () => {
  it("accepts a playlist when the owner identity matches the church", () => {
    expect(scorePlaylist(church(), playlist())).toBeGreaterThanOrEqual(0.75);
  });

  it.each([
    ["Hillsong São Paulo", "São Paulo", "Hillsong São Paulo", "Thiago Rocha"],
    ["Horizonte Tequisquiapan", "Tequisquiapan", "Horizonte Tequisquiapan", "mbl-93"],
    ["Fonte Church", "São Paulo", "Fonte Church", "Henrique Pereira"],
  ])("rejects title-only matches owned by an unrelated personal account: %s", (name, location, title, ownerName) => {
    const score = scorePlaylist(
      church({ name, location }),
      playlist({ name: title, owner: { id: ownerName.toLowerCase().replaceAll(" ", "-"), display_name: ownerName } }),
    );

    expect(score).toBeLessThan(0.75);
  });

  it("does not let location text replace owner evidence", () => {
    const score = scorePlaylist(
      church({ name: "Fonte Church", location: "São Paulo" }),
      playlist({
        name: "Fonte Church São Paulo Worship",
        description: "São Paulo",
        owner: { id: "personal-account", display_name: "Henrique Pereira" },
      }),
    );

    expect(score).toBeLessThan(0.75);
  });

  it("rejects generic same-name brands without church identity", () => {
    const score = scorePlaylist(
      church({ name: "Emirates", location: "Bogotá" }),
      playlist({
        name: "Emirates Worship",
        owner: { id: "emirates", display_name: "Emirates" },
      }),
    );

    expect(score).toBeLessThan(0.75);
  });

  it("requires location evidence for duplicate church names", () => {
    const duplicate = church({ name: "Grace Church", ambiguousName: true });
    expect(scorePlaylist(duplicate, playlist({
      name: "Grace Church Worship",
      owner: { id: "gracechurch", display_name: "Grace Church" },
    }))).toBe(0);
    expect(scorePlaylist(duplicate, playlist({
      name: "Grace Church Stockholm Worship",
      description: "Stockholm",
      owner: { id: "gracechurch", display_name: "Grace Church" },
    }))).toBeGreaterThanOrEqual(0.75);
  });

  it("never returns an artist profile as a church Spotify match", () => {
    const match = pickBestMatch(church({ name: "Emirates", location: "Bogotá" }), {
      artists: {
        items: [{
          id: "7G22ONU9ul2OMNem7glmQt",
          name: "Emirates",
          external_urls: { spotify: "https://open.spotify.com/artist/7G22ONU9ul2OMNem7glmQt" },
        }],
      },
      playlists: { items: [] },
    });

    expect(match).toBeNull();
  });

  it("builds a playlist query with the church city", () => {
    expect(buildQuery(church())).toBe("Grace Church Stockholm playlist");
    expect(buildQuery(church({ name: "Grace Church", location: "Stockholm, Sweden" })))
      .toBe("Grace Church Stockholm playlist");
  });
});
