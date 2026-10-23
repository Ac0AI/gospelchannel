import { describe, expect, it } from "vitest";
import { cleanDenominationNetwork } from "../denomination-taxonomy";

describe("cleanDenominationNetwork", () => {
  it("drops import-source labels and unknowns", () => {
    expect(cleanDenominationNetwork("OpenStreetMap")).toBeUndefined();
    expect(cleanDenominationNetwork(" unknown ")).toBeUndefined();
    expect(cleanDenominationNetwork("Unknown")).toBeUndefined();
    expect(cleanDenominationNetwork("")).toBeUndefined();
    expect(cleanDenominationNetwork(null)).toBeUndefined();
  });

  it("keeps real networks", () => {
    expect(cleanDenominationNetwork("Assemblies of God")).toBe("Assemblies of God");
    expect(cleanDenominationNetwork(" Hillsong Church ")).toBe("Hillsong Church");
  });
});
