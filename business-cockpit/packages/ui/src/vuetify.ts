import 'vuetify/styles';
import { createVuetify } from 'vuetify';
import { lightTheme, darkTheme, type ThemeValues } from '@example/bc-theme';

function vuetifyColorsOf(theme: ThemeValues) {
  return {
    background: theme['--bc-color-background'],
    surface: theme['--bc-color-surface'],
    'surface-variant': theme['--bc-color-surface-sunken'],
    primary: theme['--bc-color-primary'],
    'on-primary': theme['--bc-color-on-primary'],
    'on-background': theme['--bc-color-text'],
    'on-surface': theme['--bc-color-text'],
  };
}

export const vuetify = createVuetify({
  theme: {
    // Follows the system setting, like the CSS of the theme library.
    defaultTheme: 'system',
    themes: {
      light: { dark: false, colors: vuetifyColorsOf(lightTheme) },
      dark: { dark: true, colors: vuetifyColorsOf(darkTheme) },
    },
  },
});
