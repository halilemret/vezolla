import { describe, expect, it } from "vitest";
import {
  THEME_PRESETS,
  getThemePresetById,
  getDefaultThemePreset,
} from "@/lib/settings/theme-presets";
import { themeSettingsSchema } from "@/lib/settings/schemas";

describe("Theme Presets & Customization Architecture", () => {
  it("defines at least 6 distinct presets", () => {
    expect(THEME_PRESETS.length).toBeGreaterThanOrEqual(6);
  });

  it("includes exactly 2 dedicated themes for lingerie / fantasy intimate apparel", () => {
    const intimatePresets = THEME_PRESETS.filter((p) => p.category === "intimate");
    expect(intimatePresets.length).toBe(2);

    const ids = intimatePresets.map((p) => p.id);
    expect(ids).toContain("noir-velvet");
    expect(ids).toContain("satin-blush");

    // Gizli paketleme güvencesi iç giyim temalarında zorunlu aktif olmalı
    intimatePresets.forEach((p) => {
      expect(p.values.discreetShippingNotice).toBe(true);
    });
  });

  it("includes general apparel and ready-to-wear themes", () => {
    const apparelPresets = THEME_PRESETS.filter((p) => p.category === "apparel");
    expect(apparelPresets.length).toBeGreaterThanOrEqual(4);

    const ids = apparelPresets.map((p) => p.id);
    expect(ids).toContain("minimal-studio");
    expect(ids).toContain("street-neon");
    expect(ids).toContain("earth-linen");
    expect(ids).toContain("quiet-luxury");
  });

  it("validates that all preset values satisfy themeSettingsSchema", () => {
    THEME_PRESETS.forEach((preset) => {
      const parsed = themeSettingsSchema.safeParse(preset.values);
      expect(parsed.success).toBe(true);
    });
  });

  it("retrieves preset by ID correctly and provides default fallback", () => {
    const noir = getThemePresetById("noir-velvet");
    expect(noir).toBeDefined();
    expect(noir?.name).toBe("Noir & Velvet");
    expect(noir?.values.themeMode).toBe("dark");

    const fallback = getThemePresetById("non-existent-id");
    expect(fallback).toBeUndefined();

    const def = getDefaultThemePreset();
    expect(def).toBeDefined();
    expect(def.id).toBe("vezolla");
  });
});
