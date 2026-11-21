/**
 * The names of the CSS custom properties that carry the look of the cockpit into every shadow
 * tree. The values live in the theme library; only the names are part of the contract.
 */
export const THEME_TOKENS = {
  colorBackground: '--bc-color-background',
  colorSurface: '--bc-color-surface',
  colorSurfaceSunken: '--bc-color-surface-sunken',
  colorBorder: '--bc-color-border',
  colorText: '--bc-color-text',
  colorTextMuted: '--bc-color-text-muted',
  colorPrimary: '--bc-color-primary',
  colorOnPrimary: '--bc-color-on-primary',
  colorAccentText: '--bc-color-accent-text',
  colorRowNew: '--bc-color-row-new',
  colorRowChanged: '--bc-color-row-changed',
  colorRowRemoved: '--bc-color-row-removed',
  colorRowEnded: '--bc-color-row-ended',
  colorTextSuspended: '--bc-color-text-suspended',
  fontFamily: '--bc-font-family',
  fontFamilyMonospace: '--bc-font-family-monospace',
  fontSizeBody: '--bc-font-size-body',
  fontSizeSmall: '--bc-font-size-small',
  spacingSmall: '--bc-spacing-small',
  spacingMedium: '--bc-spacing-medium',
  spacingLarge: '--bc-spacing-large',
  radiusSmall: '--bc-radius-small',
  radiusMedium: '--bc-radius-medium',
} as const;

export type ThemeTokenName = (typeof THEME_TOKENS)[keyof typeof THEME_TOKENS];
