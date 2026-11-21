import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import vuetify from 'vite-plugin-vuetify';

// The dev server's port is fixed because the backend names its address.
const devServerPort = 5173;

export default defineConfig({
  // The bundle is served at the root of the backend, in the dev server as well.
  base: '/',
  plugins: [vue(), vuetify({ autoImport: true })],
  build: {
    // Every file but index.html lies below /assets/, so one rule of the backend covers them.
    assetsDir: 'assets',
  },
  server: {
    port: devServerPort,
    strictPort: true,
    // The browser opens the backend, not this server, and the backend does not forward WebSockets.
    hmr: { clientPort: devServerPort },
  },
});
