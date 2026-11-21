import { client as officialGuiApiClient } from '../generated/official-gui-api/client.gen';
import { client as cockpitGuiApiClient } from '../generated/cockpit-gui-api/client.gen';
import { guiApiBasePath } from '../config';

/** Points both generated clients at the GUI API. The update stream takes the same base path. */
export function configureGuiApiClients(baseUrl: string = guiApiBasePath()): void {
  officialGuiApiClient.setConfig({ baseUrl });
  cockpitGuiApiClient.setConfig({ baseUrl });
}
