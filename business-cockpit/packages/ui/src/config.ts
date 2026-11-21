export const DEFAULT_GUI_API_BASE_PATH = '/gui/api/v1';

const GUI_API_BASE_PATH_META_NAME = 'bc-gui-api-base-path';

/**
 * The one place that knows where the GUI API lives. A page, a test or a dev shell that serves the
 * API somewhere else says so with `<meta name="bc-gui-api-base-path" content="...">`.
 */
export function guiApiBasePath(page: Pick<Document, 'querySelector'> = document): string {
  const configured = page.querySelector(`meta[name="${GUI_API_BASE_PATH_META_NAME}"]`)?.getAttribute('content');
  return configured?.trim() || DEFAULT_GUI_API_BASE_PATH;
}

/** The login of the backend for the Keycloak of the docker-compose.yaml: /oauth2/authorization/<registration id>. */
export const LOGIN_PATH = '/oauth2/authorization/keycloak';

export const LOGOUT_PATH = '/logout';
