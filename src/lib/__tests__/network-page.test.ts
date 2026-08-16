import { describe, expect, it } from "vitest";
import { getNetworkLocationsTitle } from "@/lib/network-page";

describe("network page", () => {
  it("does not repeat Church in location titles", () => {
    expect(getNetworkLocationsTitle("ICF Church")).toBe("ICF Church Locations");
    expect(getNetworkLocationsTitle("Hillsong")).toBe("Hillsong Church Locations");
  });
});
