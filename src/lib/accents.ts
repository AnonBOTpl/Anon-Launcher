/**
 * Accent color system for AnonLauncher.
 * Stores hue values in localStorage and applies them as CSS custom properties.
 */

export interface AccentPreset {
  hue: number;
  label: string;
  labelKey: string;
  color: string; // CSS hex color for preview swatch
}

export const ACCENT_PRESETS: AccentPreset[] = [
  { hue: 270, label: "Purple", labelKey: "accent.purple", color: "#a855f7" },
  { hue: 220, label: "Blue", labelKey: "accent.blue", color: "#3b82f6" },
  { hue: 190, label: "Sky", labelKey: "accent.sky", color: "#06b6d4" },
  { hue: 150, label: "Emerald", labelKey: "accent.emerald", color: "#10b981" },
  { hue: 35, label: "Amber", labelKey: "accent.amber", color: "#f59e0b" },
  { hue: 340, label: "Rose", labelKey: "accent.rose", color: "#f43f5e" },
  { hue: 320, label: "Pink", labelKey: "accent.pink", color: "#d946ef" },
  { hue: 210, label: "Slate", labelKey: "accent.slate", color: "#64748b" },
];

const STORAGE_KEY = "anon_accent_hue";

/** Get the saved accent hue, or default to 270 (purple) */
export function getAccentHue(): number {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved !== null) {
      const hue = parseInt(saved, 10);
      if (!isNaN(hue) && hue >= 0 && hue <= 360) return hue;
    }
  } catch {
    // localStorage unavailable
  }
  return 270;
}

/** Get the full preset object for the saved accent hue */
export function getCurrentAccent(): AccentPreset {
  const hue = getAccentHue();
  return ACCENT_PRESETS.find((p) => p.hue === hue) ?? ACCENT_PRESETS[0]!;
}

/** Save accent hue and apply it to CSS vars */
export function setAccentHue(hue: number): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(hue));
  } catch {
    // localStorage unavailable
  }
  applyAccentHue(hue);
}

/** Apply the accent hue to CSS custom properties on document root */
export function applyAccentHue(hue: number): void {
  const root = document.documentElement;
  const isDark = root.classList.contains("dark");
  const s = hue === 270 ? 91 : 85;

  // ── Dark/light aware lightness values ──
  const l_primary = 65;
  const l_ring = 65;
  const l_accent_bg = isDark ? 18 : 95;
  const l_accent_fg = isDark ? 75 : 40;
  const l_sidebar_accent_bg = isDark ? 15 : 95;
  const l_sidebar_accent_fg = isDark ? 75 : 40;

  const chart_hues = [
    hue,
    (hue + 30) % 360,
    (hue + 60) % 360,
    (hue + 90) % 360,
    (hue + 120) % 360,
  ];

  root.style.setProperty("--accent-hue", String(hue));

  root.style.setProperty("--primary", `${hue} ${s}% ${l_primary}%`);
  root.style.setProperty("--ring", `${hue} ${s}% ${l_ring}%`);
  root.style.setProperty("--accent", `${hue} 50% ${l_accent_bg}%`);
  root.style.setProperty("--accent-foreground", `${hue} 91% ${l_accent_fg}%`);

  root.style.setProperty("--sidebar-primary", `${hue} ${s}% ${l_primary}%`);
  root.style.setProperty("--sidebar-accent", `${hue} 50% ${l_sidebar_accent_bg}%`);
  root.style.setProperty("--sidebar-accent-foreground", `${hue} 91% ${l_sidebar_accent_fg}%`);
  root.style.setProperty("--sidebar-ring", `${hue} ${s}% ${l_ring}%`);

  root.style.setProperty("--chart-1", `${chart_hues[0]} ${s}% 50%`);
  root.style.setProperty("--chart-2", `${chart_hues[1]} ${s}% 50%`);
  root.style.setProperty("--chart-3", `${chart_hues[2]} ${s}% 50%`);
  root.style.setProperty("--chart-4", `${chart_hues[3]} ${s}% 50%`);
  root.style.setProperty("--chart-5", `${chart_hues[4]} ${s}% 50%`);
}

/** Initialize accent on app startup: read from localStorage and apply */
export function initAccent(): void {
  const hue = getAccentHue();
  applyAccentHue(hue);
}
