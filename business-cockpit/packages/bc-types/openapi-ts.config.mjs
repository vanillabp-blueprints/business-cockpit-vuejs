import { defineConfig } from '@hey-api/openapi-ts';
import { fileURLToPath } from 'node:url';

// The library needs the data of the GUI API only, so it generates the types and no client.
export default defineConfig({
  input: fileURLToPath(new URL('../../build/openapi/official-gui-api.yaml', import.meta.url)),
  output: 'src/generated/official-gui-api',
  plugins: ['@hey-api/typescript'],
});
