/**
 * jata theme — chrome comes from kiranic-brand; TTC line colors stay
 * TTC-authentic (Yellow/Green/Red) for instant wayfinding recognition.
 *
 * Chrome tokens are vendored from kiranic-brand (see kiranic-tokens.ts).
 * Update path: replace kiranic-tokens.ts whenever kiranic-brand ships a
 * new version.
 */
import { colors, fontSize, spacing, theme } from "./kiranic-tokens";

export const COLORS = {
    // ─── Chrome (kiranic-brand) ───
    background: theme.light.bg,
    card: theme.light.surface,
    text: theme.light.text,
    textSecondary: theme.light.textMuted,
    border: theme.light.border,
    primary: colors.teal,
    accent: colors.ochre,

    // ─── TTC semantic line colors (kept as-is) ───
    line1: "#FFCC00",    // Yonge–University (Yellow)
    line2: "#00A54F",    // Bloor–Danforth (Green)

    // Back-compat: existing screens use `COLORS.surface` as TTC Red for
    // subway-line-3 / accent tags. Preserve that contract; prefer `line3`
    // in new code.
    surface: "#DA291C",
    line3: "#DA291C",
} as const;

export const COLORS_DARK = {
    background: theme.dark.bg,
    card: theme.dark.surface,
    text: theme.dark.text,
    textSecondary: theme.dark.textMuted,
    border: theme.dark.border,
    primary: colors.tealLight,
    accent: colors.ochre,
    line1: "#FFCC00",
    line2: "#00A54F",
    surface: "#DA291C",
    line3: "#DA291C",
} as const;

export const SPACING = {
    xs: spacing.xs,
    sm: spacing.sm,
    md: spacing.lg,
    lg: spacing.xl,
    xl: spacing.xxl,
    xxl: spacing.xxxl,
};

export const FONT_SIZES = {
    sm: fontSize.sm,
    md: fontSize.md,
    lg: fontSize.xl,
    xl: fontSize.xxl,
    xxl: fontSize.xxxl,
};

export const FONTS = {
    sans: "IBM Plex Sans",
    mono: "IBM Plex Mono",
};
