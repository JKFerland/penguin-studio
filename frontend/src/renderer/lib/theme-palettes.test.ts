import { describe, expect, it } from "vitest";
import { contrastRatio, lightness } from "./theme-color";
import { DEFAULT_THEME_STYLE, getThemeDefinition, THEMES, type ThemePalette } from "./theme-palettes";
import { deriveThemeTokens } from "./theme-tokens";

const HUE_ROLES = ["accent", "red", "orange", "yellow", "green", "blue", "purple", "cyan"] as const;

function hue(hex: string): number {
	const [r, g, b] = [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16));
	const max = Math.max(r, g, b);
	const delta = max - Math.min(r, g, b);
	if (delta === 0) return 0;
	if (max === r) return (60 * ((g - b) / delta) + 360) % 360;
	if (max === g) return 60 * ((b - r) / delta) + 120;
	return 60 * ((r - g) / delta) + 240;
}

function hueDistance(a: string, b: string): number {
	const distance = Math.abs(hue(a) - hue(b));
	return Math.min(distance, 360 - distance);
}

// Orchestrate's palette is a swatch mirror of tokens.css, which owns its values.
const cases = THEMES.filter((theme) => theme.id !== "orchestrate").flatMap((theme) =>
	(["dark", "light"] as const).map((mode) => ({ id: theme.id, mode, palette: theme[mode] as ThemePalette })),
);

function ratios(palette: ThemePalette, roles: readonly (keyof ThemePalette)[], surface: string) {
	return Object.fromEntries(roles.map((role) => [role, Number(contrastRatio(palette[role]!, surface).toFixed(2))]));
}

describe("theme palettes", () => {
	it.each(cases)("$id $mode palette matches its mode", ({ mode, palette }) => {
		expect(lightness(palette.bg) < 0.5).toBe(mode === "dark");
	});

	it.each(cases)("$id $mode text clears AAA on every surface", ({ palette }) => {
		const surfaces = { bg: palette.bg, panel: palette.panel, sidebar: palette.sidebar };
		const failing = Object.entries(surfaces).filter(([, surface]) => contrastRatio(palette.text, surface) < 7);
		expect(failing).toEqual([]);
	});

	it.each(cases)("$id $mode muted text clears AA on the canvas", ({ palette }) => {
		expect(contrastRatio(palette.muted, palette.bg)).toBeGreaterThanOrEqual(4.5);
	});

	it.each(cases)("$id $mode accent and status hues clear 3:1 on the canvas", ({ palette }) => {
		const failing = Object.entries(ratios(palette, HUE_ROLES, palette.bg)).filter(([, ratio]) => ratio < 3);
		expect(failing).toEqual([]);
	});

	it("keeps Orchestrate as the default theme", () => {
		expect(DEFAULT_THEME_STYLE).toBe("orchestrate");
		expect(THEMES[0].id).toBe("orchestrate");
	});

	it("gives Matrix a neon accent with a dark label", () => {
		const matrix = getThemeDefinition("matrix");
		expect(matrix.dark.accent).toBe("#00ff41");
		const tokens = deriveThemeTokens(matrix.dark, "dark");
		expect(tokens["--primary-foreground"]).toBe("#000000");
		expect(contrastRatio(tokens["--primary"], tokens["--primary-foreground"])).toBeGreaterThanOrEqual(7);
	});

	it.each(["dark", "light"] as const)("keeps Matrix %s destructive button label at AA", (mode) => {
		const tokens = deriveThemeTokens(getThemeDefinition("matrix")[mode], mode);
		expect(contrastRatio("#ffffff", tokens["--color-danger-strong"])).toBeGreaterThanOrEqual(4.5);
		expect(contrastRatio(tokens["--destructive"], tokens["--background"])).toBeGreaterThanOrEqual(4.5);
	});

	it.each(["dark", "light"] as const)("keeps Matrix %s failure and caution hues off the accent", (mode) => {
		const palette = getThemeDefinition("matrix")[mode];
		for (const hue of [palette.red, palette.orange, palette.yellow]) {
			expect(hueDistance(hue, palette.accent)).toBeGreaterThan(45);
		}
	});
});
