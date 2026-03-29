import { describe, expect, it } from "vitest";
import {
  getOfficialDirectoryWebsite,
  inferLocationFromAddress,
  parseCountryLinks,
  parseDirectoryListings,
} from "../../../scripts/lib/international-directory.mjs";

describe("international church directory parser", () => {
  it("parses country links from the directory landing page", () => {
    const html = `
      <li><a href="https://www.internationalchurches.eu/list/wpbdp_category/sweden/">Sweden</a></li>
      <li><a href="https://www.internationalchurches.eu/list/wpbdp_category/portugal/">Portugal</a></li>
    `;

    expect(parseCountryLinks(html)).toEqual([
      {
        slug: "sweden",
        name: "Sweden",
        url: "https://www.internationalchurches.eu/list/wpbdp_category/sweden/",
      },
      {
        slug: "portugal",
        name: "Portugal",
        url: "https://www.internationalchurches.eu/list/wpbdp_category/portugal/",
      },
    ]);
  });

  it("parses listings with website and facebook fields", () => {
    const html = `
      <div id="wpbdp-listing-153" class="wpbdp-listing-153">
        <div class="listing-thumbnail">
          <a href="https://www.internationalchurches.eu/list/153/stockholm-life-church/"><img src="https://www.internationalchurches.eu/wp-content/uploads/2020/07/newlifestockholm.jpg" /></a>
        </div>
        <div class="listing-details">
          <div class="wpbdp-field-display"><span class="field-label">Name</span> <div class="value"><a href="https://www.internationalchurches.eu/list/153/stockholm-life-church/">Stockholm New Life</a></div></div>
          <div class="wpbdp-field-display"><span class="field-label">Country</span> <div class="value"><a href="https://www.internationalchurches.eu/list/wpbdp_category/sweden/">Sweden</a></div></div>
          <div class="address-info wpbdp-field-display wpbdp-field wpbdp-field-value"><span class="field-label address-label">Address</span> <div>Missionsvägen 75, 167 33 Bromma</div></div>
          <div class="wpbdp-field-display"><span class="field-label">Description</span> <div class="value"><p>International church in Stockholm.</p></div></div>
          <div class="wpbdp-field-display"><span class="field-label">Website Address</span> <div class="value"><a href="http://www.newlife.nu/stockholm/">http://www.newlife.nu/stockholm/</a></div></div>
          <div class="wpbdp-field-display"><span class="field-label">Facebook page</span> <div class="value"><a href="http://www.facebook.com/NewLifeStockholm">http://www.facebook.com/NewLifeStockholm</a></div></div>
        </div>
      </div>
      <div class="listing-actions"></div>
    `;

    expect(parseDirectoryListings(html)).toEqual([
      {
        name: "Stockholm New Life",
        country: "Sweden",
        address: "Missionsvägen 75, 167 33 Bromma",
        description: "International church in Stockholm.",
        website: "http://www.newlife.nu/stockholm/",
        facebookUrl: "http://www.facebook.com/NewLifeStockholm",
        youtubeUrl: "",
        phone: "",
        sundayMeetingTime: "",
        listingUrl: "https://www.internationalchurches.eu/list/153/stockholm-life-church/",
        thumbnailUrl: "https://www.internationalchurches.eu/wp-content/uploads/2020/07/newlifestockholm.jpg",
      },
    ]);
  });

  it("keeps only official websites and infers the city from the address", () => {
    expect(getOfficialDirectoryWebsite({ website: "https://www.facebook.com/examplechurch" })).toBe("");
    expect(getOfficialDirectoryWebsite({ website: "https://www.iec-algarve.com" })).toBe("https://www.iec-algarve.com");
    expect(inferLocationFromAddress("32 Rua Doutor Basílio Teles, Lagoa, 8400, Portugal", "Portugal")).toBe("Lagoa");
  });
});
