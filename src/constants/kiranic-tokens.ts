/**
 * Kiranic Brand Tokens — TypeScript/JS consumable.
 * Matches tokens.css exactly. Use in React Native (jata), React (gta),
 * or anywhere CSS variables aren't available.
 */

export const colors = {
  bg: "#292330",
  surface: "#F5F5F4",
  teal: "#297081",
  tealLight: "#88BDC1",
  ochre: "#E29D35",

  surface0Light: "#F5F5F4",
  surface1Light: "#ffffff",
  surface2Light: "#ebeae6",
  borderLight: "#d4d2cc",

  surface0Dark: "#1a1722",
  surface1Dark: "#211e2b",
  surface2Dark: "#292330",
  borderDark: "#3b344a",

  textLight: "#0f172a",
  textMutedLight: "#475569",
  textDimLight: "#94a3b8",

  textDark: "#e2e8f0",
  textMutedDark: "#94a3b8",
  textDimDark: "#64748b",

  success: "#2D8659",
  warning: "#E29D35",
  error: "#C94444",
  info: "#297081",
} as const;

export const fonts = {
  sans: '"IBM Plex Sans", ui-sans-serif, system-ui, sans-serif',
  mono: '"IBM Plex Mono", ui-monospace, SFMono-Regular, monospace',
  sansFamily: "IBM Plex Sans",
  monoFamily: "IBM Plex Mono",
} as const;

export const radii = { sm: 6, md: 10, lg: 16 } as const;

export const spacing = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48,
} as const;

export const fontSize = {
  xs: 12, sm: 14, md: 16, lg: 18, xl: 20, xxl: 24, xxxl: 32, display: 40,
} as const;

/** Pre-built light/dark theme pairs — convenient for React Native. */
export const theme = {
  light: {
    bg: colors.surface0Light,
    surface: colors.surface1Light,
    surfaceAlt: colors.surface2Light,
    border: colors.borderLight,
    text: colors.textLight,
    textMuted: colors.textMutedLight,
    textDim: colors.textDimLight,
    primary: colors.teal,
    accent: colors.ochre,
  },
  dark: {
    bg: colors.surface0Dark,
    surface: colors.surface1Dark,
    surfaceAlt: colors.surface2Dark,
    border: colors.borderDark,
    text: colors.textDark,
    textMuted: colors.textMutedDark,
    textDim: colors.textDimDark,
    primary: colors.tealLight,
    accent: colors.ochre,
  },
} as const;

export type KiranicTheme = typeof theme.light;
