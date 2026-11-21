import { client as officialGuiApiClient } from '../generated/official-gui-api/client.gen';
import { client as cockpitGuiApiClient } from '../generated/cockpit-gui-api/client.gen';
import { guiApiBasePath } from '../config';
import { sendBrowserToLogin } from '../session/login';

// The GUI API answers JSON only when the request says that it accepts JSON.
const jsonHeaders = { Accept: 'application/json' };

/** Points both generated clients at the GUI API. The update stream takes the same base path. */
export function configureGuiApiClients(baseUrl: string = guiApiBasePath()): void {
  officialGuiApiClient.setConfig({ baseUrl, headers: jsonHeaders });
  cockpitGuiApiClient.setConfig({ baseUrl, headers: jsonHeaders });

  for (const client of [officialGuiApiClient, cockpitGuiApiClient]) {
    // The login ends after seven days, also in the middle of work. So any answer can be a 401.
    client.interceptors.response.use((response) => {
      if (response.status === 401) sendBrowserToLogin();
      return response;
    });
  }
}
