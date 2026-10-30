import { describe, it, expect } from "vitest";
import {
  DEFAULT_SEO_GEO_SETTINGS,
  seoGeoSettingsSchema,
} from "./types";

describe("SEO & GEO Schemas and Settings", () => {
  it("validates default SEO & GEO settings schema cleanly", () => {
    const parsed = seoGeoSettingsSchema.parse({});
    expect(parsed.defaultTitle).toBe("Atölye Mağaza");
    expect(parsed.llmsEnabled).toBe(true);
    expect(parsed.aiBotPermissions.gptBot).toBe("ALLOW");
    expect(parsed.aiBotPermissions.perplexityBot).toBe("ALLOW");
    expect(parsed.geoTargetCountry).toBe("TR");
    expect(parsed.geoTargetRegion).toBe("İstanbul");
    expect(parsed.geoLatitude).toBe(41.0369);
  });

  it("handles custom template variables replacement", () => {
    const template = "{urun_adi} | En Uygun Fiyatlarla {magaza_adi}";
    const output = template
      .replace(/{urun_adi}/g, "Alüminyum Laptop Standı")
      .replace(/{magaza_adi}/g, "Atölye Mağaza");

    expect(output).toBe("Alüminyum Laptop Standı | En Uygun Fiyatlarla Atölye Mağaza");
  });

  it("validates bot permissions enum strictly", () => {
    const valid = seoGeoSettingsSchema.safeParse({
      aiBotPermissions: {
        gptBot: "DISALLOW",
        perplexityBot: "ALLOW",
        claudeBot: "ALLOW",
        googleExtended: "DISALLOW",
        applebot: "ALLOW",
      },
    });
    expect(valid.success).toBe(true);
    if (valid.success) {
      expect(valid.data.aiBotPermissions.gptBot).toBe("DISALLOW");
    }

    const invalid = seoGeoSettingsSchema.safeParse({
      aiBotPermissions: {
        gptBot: "MAYBE",
      },
    });
    expect(invalid.success).toBe(false);
  });

  it("validates hreflang mapping format", () => {
    const valid = seoGeoSettingsSchema.safeParse({
      hreflangMappings: [
        { lang: "tr", region: "TR", urlPrefix: "https://atolyemagaza.com" },
        { lang: "en", region: "GB", urlPrefix: "https://atolyemagaza.com/en-gb" },
      ],
    });
    expect(valid.success).toBe(true);
    if (valid.success) {
      expect(valid.data.hreflangMappings).toHaveLength(2);
      expect(valid.data.hreflangMappings?.[1]?.region).toBe("GB");
    }
  });
});
