import { mixColors } from './mix-colors.js';

/**
 * The values of the VanillaBP design system (tokens/colors.css, typography.css, spacing.css and
 * shape.css), named as the cockpit's theme tokens. The names are the ones the types library
 * exports as THEME_TOKENS.
 */
const designSystem = {
  light: {
    background: '#FFFFFF',
    surface: '#FFFBF0',
    surfaceSunken: '#FDF4E0',
    border: '#F0DFB8',
    text: '#663300',
    textMuted: '#975E26',
    accentText: '#806000',
    primary: '#FFC000',
    onPrimary: '#663300',
    teal: '#2F6F6A',
    amber: '#FFC000',
    release: '#A3231A',
  },
  dark: {
    background: '#181106',
    surface: '#211608',
    surfaceSunken: '#100B04',
    border: '#3A2A10',
    text: '#FFF8EB',
    textMuted: '#C9BFB0',
    accentText: '#FFC000',
    primary: '#FFC000',
    onPrimary: '#663300',
    teal: '#7CC6BE',
    amber: '#FFC000',
    release: '#C42C21',
  },
};

type Palette = typeof designSystem.light;

const shared = {
  '--bc-font-family': '"Carlito", Calibri, system-ui, sans-serif',
  '--bc-font-family-monospace': 'ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace',
  '--bc-font-size-body': '1.0625rem',
  '--bc-font-size-small': '0.9375rem',
  '--bc-spacing-small': '0.5rem',
  '--bc-spacing-medium': '1rem',
  '--bc-spacing-large': '1.5rem',
  '--bc-radius-small': '6px',
  '--bc-radius-medium': '12px',
};

// The design system has no state colours. They are derived from its palette, as light tints over
// the page background: a new row in teal, a changed row in amber, a removed row in the red of
// release announcements. An ended row is a grey tint of the text, a suspended row only lightens
// its text.
function themeOf(palette: Palette) {
  return {
    '--bc-color-background': palette.background,
    '--bc-color-surface': palette.surface,
    '--bc-color-surface-sunken': palette.surfaceSunken,
    '--bc-color-border': palette.border,
    '--bc-color-text': palette.text,
    '--bc-color-text-muted': palette.textMuted,
    '--bc-color-primary': palette.primary,
    '--bc-color-on-primary': palette.onPrimary,
    '--bc-color-accent-text': palette.accentText,
    '--bc-color-row-new': mixColors(palette.teal, 0.2, palette.background),
    '--bc-color-row-changed': mixColors(palette.amber, 0.3, palette.background),
    '--bc-color-row-removed': mixColors(palette.release, 0.2, palette.background),
    '--bc-color-row-ended': mixColors(palette.text, 0.1, palette.background),
    '--bc-color-text-suspended': mixColors(palette.text, 0.55, palette.background),
    ...shared,
  };
}

export type ThemeValues = ReturnType<typeof themeOf>;

export const lightTheme: ThemeValues = themeOf(designSystem.light);
export const darkTheme: ThemeValues = themeOf(designSystem.dark);
